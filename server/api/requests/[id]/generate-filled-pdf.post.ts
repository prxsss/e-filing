import { eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import db from '../../../../lib/db';
import { request, requestTemplate, requestTemplateValues } from '../../../../lib/db/schema';
import { supabaseAdmin } from '../../../../lib/supabase/client';

export default defineEventHandler(async (event) => {
  // await requirePermission(event, '<permission>', '<permission>', ...);

  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');
    const userId = event.context.user!.id; // We can assert this because of the require-auth middleware

    if (!requestId) {
      return {
        success: false,
        error: 'Invalid request ID',
      };
    }

    // Get request details
    const requestData = await db
      .select()
      .from(request)
      .where(eq(request.id, requestId))
      .limit(1);

    if (requestData.length === 0) {
      return {
        success: false,
        error: 'Request not found',
      };
    }

    const requestRecord = requestData[0];

    // Ownership check — only the request owner may generate the pre-fill PDF
    if (requestRecord.userId !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' });
    }

    // Get template
    const templateData = await db
      .select()
      .from(requestTemplate)
      .where(eq(requestTemplate.id, Number(requestRecord.templateId)))
      .limit(1);

    if (templateData.length === 0) {
      return {
        success: false,
        error: 'Template not found',
      };
    }

    const template = templateData[0];

    // Get field values
    const fieldValuesData = await db
      .select()
      .from(requestTemplateValues)
      .where(eq(requestTemplateValues.requestId, requestId));

    // Create field values map
    const fieldValuesMap: Record<number, string> = {};
    fieldValuesData.forEach((fv) => {
      if (fv.fieldId) {
        fieldValuesMap[fv.fieldId] = fv.value || '';
      }
    });

    // Load original PDF from URL
    if (!template.documentUrl) {
      return {
        success: false,
        error: 'Template document URL not found',
      };
    }

    if (!requestRecord.templateId) {
      return {
        success: false,
        error: 'Template ID not found in request',
      };
    }

    const pdfResponse = await fetch(template.documentUrl);
    if (!pdfResponse.ok) {
      return {
        success: false,
        error: 'Failed to fetch template PDF',
      };
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    // Get placed fields from template
    const placedFields = (template.placedFieldsData as any[]) || [];

    // Map field values to placed fields
    const fieldsWithValues = placedFields.map((field: any) => {
      const fieldValue = fieldValuesMap[field.id] || '';
      return {
        ...field,
        label: fieldValue, // Use filed value as label to render on PDF
        value: fieldValue,
      };
    });

    // Generate filled PDF using pdf-lib
    const filledPdfBytes = await generateFilledPdf(pdfBytes, fieldsWithValues, template);

    if (!filledPdfBytes) {
      return {
        success: false,
        error: 'Failed to generate filled PDF',
      };
    }

    // Upload to Supabase Storage
    const filename = `request-${requestId}-filled.pdf`;

    // Overwrite if already exists (re-submit case)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('filled-requests')
      .upload(filename, filledPdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return {
        success: false,
        error: `Failed to upload filled PDF: ${uploadError.message}`,
      };
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('filled-requests')
      .getPublicUrl(filename);

    // Update request with filled document URL
    await db
      .update(request)
      .set({ filledDocumentUrl: publicUrl })
      .where(eq(request.id, requestId));

    return {
      success: true,
      data: {
        filledDocumentUrl: publicUrl,
      },
    };
  }
  catch (error: any) {
    console.error('Error generating filled PDF:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate filled PDF',
    };
  }
});

// Generate filled PDF with field values
async function generateFilledPdf(pdfBytes: Uint8Array, fields: any[], _template: any) {
  try {
    // Dynamic import of pdf-lib for server-side
    const PDFLib = await import('pdf-lib');
    const fontkitModule = await import('@pdf-lib/fontkit');
    const fontkit = (fontkitModule as any).default ?? fontkitModule;

    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    // Get font
    let font: any;
    try {
      const fontPath = join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf');
      const fontBytes = new Uint8Array(await readFile(fontPath));
      font = await pdfDoc.embedFont(fontBytes, { subset: true });
    }
    catch (e) {
      console.warn('Failed to load local font:', e);
      font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    }

    const pages = pdfDoc.getPages();
    const CSS_PX_TO_PT = 72 / 96;

    // Process each field
    for (const field of fields) {
      if (!field.value || !field.value.trim())
        continue;

      try {
        const pageIndex = (field.pageNumber || 1) - 1;
        const targetPage = pages[pageIndex];

        if (!targetPage)
          continue;

        const { width: pageWidth, height: pageHeight } = targetPage.getSize();

        // ── Coordinate conversion ──────────────────────────────────────────
        let fieldX: number;
        let fieldYTop: number;
        let fieldW: number;
        let fieldH: number;

        if (field.normalizedX !== undefined) {
          fieldX = field.normalizedX * pageWidth;
          fieldYTop = field.normalizedY * pageHeight;
          fieldW = field.normalizedWidth * pageWidth;
          fieldH = field.normalizedHeight * pageHeight;
        }
        else {
          fieldX = field.x || 0;
          fieldYTop = field.y || 0;
          fieldW = field.width || 100;
          fieldH = field.height || 30;
        }

        const fieldYBottom = pageHeight - fieldYTop - fieldH;

        // ── Font size ──────────────────────────────────────────────────────
        const requestedFontSizePx = Number(field.fontSize || 12);
        const fontSize = Math.max(4, Math.min(requestedFontSizePx * CSS_PX_TO_PT, fieldH * 0.9));

        // ── Top-aligned Vertical Positioning ───────────────────────────────
        let textY = fieldYBottom + fieldH - fontSize;
        try {
          const ascenderHeight = Number(font.heightAtSize(fontSize, { descender: false }));
          if (ascenderHeight > 0) {
            textY = fieldYBottom + fieldH - ascenderHeight - (fontSize * 0.1);
          }
        }
        catch {}

        // ── Horizontal alignment ───────────────────────────────────────────
        let text = String(field.value).trim();

        // --- CUSTOM WRAP LOGIC ---
        // Pre-process text to wrap unbreakable strings that exceed field width
        const lines: string[] = [];
        const paragraphs = text.split('\n');
        for (const paragraph of paragraphs) {
          const words = paragraph.split(/(\s+)/); // keep spaces
          let currentLine = '';
          for (const word of words) {
            if (word.trim() === '') {
              currentLine += word;
              continue;
            }
            try {
              const testWidth = font.widthOfTextAtSize(currentLine + word, fontSize);
              if (testWidth > fieldW && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word;
              }
              else if (testWidth > fieldW && currentLine === '') {
                // Word itself is too long, we need to character break it!
                let tempWord = '';
                for (const char of word) {
                  const charTestWidth = font.widthOfTextAtSize(tempWord + char, fontSize);
                  if (charTestWidth > fieldW && tempWord !== '') {
                    lines.push(tempWord);
                    tempWord = char;
                  }
                  else {
                    tempWord += char;
                  }
                }
                currentLine = tempWord;
              }
              else {
                currentLine += word;
              }
            }
            catch {
              currentLine += word;
            }
          }
          if (currentLine) {
            lines.push(currentLine);
          }
        }
        text = lines.join('\n');

        let textX = fieldX;

        if (field.textAlign === 'center' || field.textAlign === 'right') {
          try {
            const spacing = Number(field.letterSpacing ?? 0) || 0;
            const spacingExtra = spacing !== 0 ? Math.max(0, text.length - 1) * spacing * CSS_PX_TO_PT : 0;
            const textW = font.widthOfTextAtSize(text.split('\n')[0], fontSize) + spacingExtra;
            textX = field.textAlign === 'center'
              ? fieldX + (fieldW - textW) / 2
              : fieldX + fieldW - textW;
          }
          catch { /* keep left */ }
        }

        textX = Math.max(fieldX, textX);

        // ── Letter spacing ─────────────────────────────────────────────────
        const letterSpacing = (Number(field.letterSpacing ?? 0) || 0) * CSS_PX_TO_PT;

        if (letterSpacing !== 0 && text.length > 0) {
          let cursorX = textX;
          for (const char of text) {
            if (char === '\n') {
              textY -= (Number(field.lineHeight) || 1.5) * fontSize;
              cursorX = textX;
              continue;
            }
            if (cursorX >= fieldX + fieldW) {
              textY -= (Number(field.lineHeight) || 1.5) * fontSize;
              cursorX = textX;
            }
            targetPage.drawText(char, {
              x: cursorX,
              y: textY,
              size: fontSize,
              font,
              color: PDFLib.rgb(0, 0, 0),
            });
            try {
              cursorX += font.widthOfTextAtSize(char, fontSize) + letterSpacing;
            }
            catch {
              cursorX += fontSize * 0.6 + letterSpacing;
            }
          }
        }
        else {
          const customLineHeight = (Number(field.lineHeight) || 1.5) * fontSize;
          targetPage.drawText(text, {
            x: textX,
            y: textY,
            size: fontSize,
            font,
            color: PDFLib.rgb(0, 0, 0),
            maxWidth: fieldW,
            lineHeight: customLineHeight,
          });
        }
      }
      catch (error) {
        console.error('Error processing field:', field, error);
      }
    }

    const filledPdfBytes = await pdfDoc.save();
    return filledPdfBytes;
  }
  catch (error) {
    console.error('Error in generateFilledPdf:', error);
    return null;
  }
}
