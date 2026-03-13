import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event);

    if (!formData) {
      return createError({ statusCode: 400, statusMessage: 'No form data provided' });
    }

    const pdfPart = formData.find(p => p.name === 'pdfFile');
    const fieldsPart = formData.find(p => p.name === 'fields');

    if (!pdfPart?.data) {
      return createError({ statusCode: 400, statusMessage: 'PDF file is required' });
    }

    const pdfBytes = new Uint8Array(pdfPart.data);
    const fields: any[] = fieldsPart?.data ? JSON.parse(fieldsPart.data.toString()) : [];

    // Generate preview PDF using pdf-lib
    const previewPdfBytes = await generatePreviewPdf(pdfBytes, fields);

    if (!previewPdfBytes) {
      return createError({ statusCode: 500, statusMessage: 'Failed to generate preview PDF' });
    }

    // Return the PDF as binary
    setResponseHeader(event, 'Content-Type', 'application/pdf');
    setResponseHeader(event, 'Content-Disposition', 'inline; filename="preview.pdf"');
    setResponseHeader(event, 'Content-Length', previewPdfBytes.length);

    return send(event, Buffer.from(previewPdfBytes), 'application/pdf');
  }
  catch (error: any) {
    console.error('Error generating preview PDF:', error);
    return createError({ statusCode: 500, statusMessage: error.message || 'Internal server error' });
  }
});

async function generatePreviewPdf(pdfBytes: Uint8Array, fields: any[]) {
  try {
    const PDFLib = await import('pdf-lib');
    const fontkitModule = await import('@pdf-lib/fontkit');
    const fontkit = (fontkitModule as any).default ?? fontkitModule;

    // Field styles are stored in CSS px in the editor.
    const CSS_PX_TO_PT = 72 / 96;
    const BASELINE_FROM_CENTER_FACTOR = 0.33;

    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    const pages = pdfDoc.getPages();

    // Cache embedded fonts
    const embeddedFontCache = new Map<string, any>();

    async function getFont(fontFamily: string, bold: boolean, italic: boolean) {
      const key = `${fontFamily}|${bold}|${italic}`;
      if (embeddedFontCache.has(key))
        return embeddedFontCache.get(key);

      let font: any;
      try {
        // Since pdf-font-loader.ts is removed, we load Sarabun font directly
        const fontPath = join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf');
        const fontBytes = new Uint8Array(await readFile(fontPath));
        font = await pdfDoc.embedFont(fontBytes, { subset: true });
      }
      catch (e) {
        console.warn('Failed to load local font:', e);
        font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      }

      embeddedFontCache.set(key, font);
      return font;
    }

    function computeBaselineY(fieldYBottom: number, fieldH: number, font: any, fontSize: number): number {
      try {
        const fullHeight = Number(font.heightAtSize(fontSize, { descender: true }));
        const ascenderHeight = Number(font.heightAtSize(fontSize, { descender: false }));

        if (Number.isFinite(fullHeight) && Number.isFinite(ascenderHeight) && fullHeight > 0 && ascenderHeight > 0) {
          const descenderHeight = Math.max(0, fullHeight - ascenderHeight);
          return fieldYBottom + (fieldH - fullHeight) / 2 + descenderHeight;
        }
      }
      catch {
        // Fall back to constant offset when metrics are unavailable.
      }

      return fieldYBottom + fieldH / 2 - fontSize * BASELINE_FROM_CENTER_FACTOR;
    }

    for (const field of fields) {
      const rawPreviewValue = field.sampleValue ?? field.value ?? '';
      const trimmedPreviewValue = String(rawPreviewValue || '').trim();
      const fallbackValue = field.label || field.name || `[${field.type || 'field'}]`;
      const sampleValue = trimmedPreviewValue || (field.useFallbackLabel === false ? '' : fallbackValue);
      if (!sampleValue?.trim())
        continue;

      try {
        const pageIndex = (field.pageNumber || 1) - 1;
        const targetPage = pages[pageIndex];
        if (!targetPage)
          continue;

        const { width: pageWidth, height: pageHeight } = targetPage.getSize();

        // ── Coordinate conversion ──────────────────────────────────────────
        // Use actual page size from pdf-lib for accuracy.
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

        // ── Font ───────────────────────────────────────────────────────────
        const isBold = field.fontWeight === 'bold';
        const isItalic = field.fontStyle === 'italic';
        const font = await getFont(field.fontFamily || 'Sarabun', isBold, isItalic);

        // ── Font size ──────────────────────────────────────────────────────
        const requestedFontSizePx = Number(field.fontSize || 12);
        const fontSize = Math.max(4, Math.min(requestedFontSizePx * CSS_PX_TO_PT, fieldH * 0.9));

        // ── Vertical centering ─────────────────────────────────────────────
        const textY = computeBaselineY(fieldYBottom, fieldH, font, fontSize);

        // ── Background highlight for preview ──────────────────────────────
        if (field.showFieldHighlight !== false) {
          targetPage.drawRectangle({
            x: fieldX,
            y: fieldYBottom,
            width: fieldW,
            height: fieldH,
            color: PDFLib.rgb(0.93, 0.97, 1),
            borderColor: PDFLib.rgb(0.4, 0.6, 0.9),
            borderWidth: 0.5,
            opacity: 0.6,
          });
        }

        // ── Horizontal alignment ───────────────────────────────────────────
        const text = String(sampleValue).trim();
        let textX = fieldX;

        if (field.textAlign === 'center' || field.textAlign === 'right') {
          try {
            const spacing = Number(field.letterSpacing ?? 0) || 0;
            const spacingExtra = spacing !== 0 ? Math.max(0, text.length - 1) * spacing * CSS_PX_TO_PT : 0;
            const textW = font.widthOfTextAtSize(text, fontSize) + spacingExtra;
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
            if (cursorX >= fieldX + fieldW)
              break;
            targetPage.drawText(char, {
              x: cursorX,
              y: textY,
              size: fontSize,
              font,
              color: PDFLib.rgb(0.1, 0.3, 0.7),
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
          targetPage.drawText(text, {
            x: textX,
            y: textY,
            size: fontSize,
            font,
            color: PDFLib.rgb(0.1, 0.3, 0.7),
            maxWidth: fieldW,
          });
        }

        // ── Underline ──────────────────────────────────────────────────────
        if (field.textDecoration === 'underline') {
          let underlineW = fieldW;
          try {
            underlineW = Math.min(font.widthOfTextAtSize(text, fontSize), fieldW);
          }
          catch { /* keep field width */ }

          targetPage.drawRectangle({
            x: textX,
            y: textY - 1.5,
            width: underlineW,
            height: 0.75,
            color: PDFLib.rgb(0.1, 0.3, 0.7),
          });
        }
      }
      catch (err) {
        console.error('Error drawing field in preview:', field, err);
      }
    }

    return await pdfDoc.save();
  }
  catch (error) {
    console.error('Error in generatePreviewPdf:', error);
    return null;
  }
}
