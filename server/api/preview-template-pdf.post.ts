import { Buffer } from 'node:buffer';

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event);

    if (!formData) {
      return createError({ statusCode: 400, statusMessage: 'No form data provided' });
    }

    const pdfPart = formData.find(p => p.name === 'pdfFile');
    const fieldsPart = formData.find(p => p.name === 'fields');
    const templateInfoPart = formData.find(p => p.name === 'templateInfo');

    if (!pdfPart?.data) {
      return createError({ statusCode: 400, statusMessage: 'PDF file is required' });
    }

    const pdfBytes = new Uint8Array(pdfPart.data);
    const fields: any[] = fieldsPart?.data ? JSON.parse(fieldsPart.data.toString()) : [];
    const templateInfo = templateInfoPart?.data ? JSON.parse(templateInfoPart.data.toString()) : {};

    // Generate preview PDF using pdf-lib
    const previewPdfBytes = await generatePreviewPdf(pdfBytes, fields, templateInfo);

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

async function generatePreviewPdf(pdfBytes: Uint8Array, fields: any[], templateInfo: any) {
  try {
    const PDFLib = await import('pdf-lib');
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();

    const templateWidth = templateInfo.documentWidth || 595;
    const templateHeight = templateInfo.documentHeight || 842;

    for (const field of fields) {
      // Use the field label (sample value) — if blank use field name as placeholder
      const sampleValue = field.sampleValue || field.label || field.name || `[${field.type || 'field'}]`;

      if (!sampleValue?.trim())
        continue;

      try {
        const pageIndex = (field.pageNumber || 1) - 1;
        const targetPage = pages[pageIndex];
        if (!targetPage)
          continue;

        const { height: pageHeight } = targetPage.getSize();

        let x = field.x || 0;
        let y = field.y || 0;
        let width = field.width || 100;
        let height = field.height || 30;

        // Convert normalized coordinates to PDF coordinates
        if (field.normalizedX !== undefined) {
          x = field.normalizedX * templateWidth;
          y = field.normalizedY * templateHeight;
          width = field.normalizedWidth * templateWidth;
          height = field.normalizedHeight * templateHeight;
        }

        // Convert field.fontSize (CSS px at 1.5× canvas render scale) to PDF points
        // 1 PDF pt = 1.5 CSS px at the render scale used in template-pdf-create.vue
        const PDF_RENDER_SCALE = 1.5;
        const fontSize = field.fontSize
          ? Math.max(4, field.fontSize / PDF_RENDER_SCALE)
          : Math.min(height * 0.6, 12);

        // Draw a light background rect to make field area visible
        targetPage.drawRectangle({
          x,
          y: pageHeight - y - height,
          width,
          height,
          color: PDFLib.rgb(0.93, 0.97, 1),
          borderColor: PDFLib.rgb(0.4, 0.6, 0.9),
          borderWidth: 0.5,
          opacity: 0.6,
        });

        // Draw the sample value text
        targetPage.drawText(sampleValue, {
          x: x + 2,
          y: pageHeight - y - height + (height * 0.3),
          size: fontSize,
          font,
          color: PDFLib.rgb(0.1, 0.3, 0.7),
          maxWidth: width - 4,
        });
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
