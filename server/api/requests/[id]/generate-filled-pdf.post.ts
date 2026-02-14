import { eq } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import db from '../../../../lib/db';
import { request, requestTemplate, requestTemplateValues } from '../../../../lib/db/schema';

export default defineEventHandler(async (event) => {
  try {
    const requestId = Number.parseInt(getRouterParam(event, 'id') || '0');

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

    // Save to uploads/filled-requests/
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'filled-requests');

    // Create directory if it doesn't exist
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const filename = `request-${requestId}-filled.pdf`;
    const filePath = join(uploadsDir, filename);

    await writeFile(filePath, filledPdfBytes);

    const fileUrl = `/uploads/filled-requests/${filename}`;

    // Update request with filled document URL
    await db
      .update(request)
      .set({ filledDocumentUrl: fileUrl })
      .where(eq(request.id, requestId));

    return {
      success: true,
      data: {
        filledDocumentUrl: fileUrl,
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
async function generateFilledPdf(pdfBytes: Uint8Array, fields: any[], template: any) {
  try {
    // Dynamic import of pdf-lib for server-side
    const PDFLib = await import('pdf-lib');
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

    // Get font
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { height: pageHeight } = firstPage.getSize();

    // Process each field
    for (const field of fields) {
      if (!field.value || !field.value.trim())
        continue;

      try {
        const pageIndex = (field.pageNumber || 1) - 1;
        const targetPage = pages[pageIndex];

        if (!targetPage)
          continue;

        // Convert normalized coordinates to PDF coordinates
        let x = field.x || 0;
        let y = field.y || 0;
        let width = field.width || 100;
        let height = field.height || 30;

        // If using normalized coordinates
        if (field.normalizedX !== undefined) {
          const templateWidth = template.documentWidth || 595;
          const templateHeight = template.documentHeight || 842;

          x = field.normalizedX * templateWidth;
          y = field.normalizedY * templateHeight;
          width = field.normalizedWidth * templateWidth;
          height = field.normalizedHeight * templateHeight;
        }

        // Calculate font size (fit to height)
        const fontSize = Math.min(height * 0.6, 12);

        // Draw text on PDF
        targetPage.drawText(field.value, {
          x,
          y: pageHeight - y - height + (height * 0.3), // Adjust for baseline
          size: fontSize,
          font: field.type === 'text' ? font : font,
          color: PDFLib.rgb(0, 0, 0),
          maxWidth: width - 4,
        });
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
