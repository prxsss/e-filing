export const usePdfSigning = () => {
  // Sanitize input to prevent XSS
  const sanitizeInput = (input) => {
    if (typeof input !== "string") return "";
    return input
      .replace(/[<>]/g, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+=/gi, "")
      .trim();
  };

  // Generate composite PDF with filled fields and signature
  const generateCompositePdf = async (
    template,
    formFields,
    groupedFillableFields,
    signatureField,
    signaturePreview
  ) => {
    try {
      // Load PDF bytes from background URL
      const response = await fetch(template.background_image_url);
      const arrayBuffer = await response.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);

      // Get PDF operations composable
      const { generateCompositePdf: generatePdf } = usePdfOperations();

      // Calculate scale ratio (display width vs natural width)
      const displayWidth = 800; // Design width used in templates
      const naturalWidth = template.image_width || displayWidth;
      const scaleRatio = naturalWidth / displayWidth;

      // Collect all fillable fields with values
      const allFields = [
        ...groupedFillableFields.singleFields,
        ...groupedFillableFields.groups.flatMap((g) => g.fields || []),
      ];

      // Group fields by page number
      const fieldsByPage = {};

      allFields.forEach((field) => {
        const value = sanitizeInput(formFields[field.instanceId] || "");
        if (!value.trim()) return; // Skip empty fields

        const pageNum = field.pageNumber || 1;
        if (!fieldsByPage[pageNum]) {
          fieldsByPage[pageNum] = [];
        }

        // Transform field coordinates to natural PDF coordinates
        fieldsByPage[pageNum].push({
          ...field,
          label: value, // Use the filled value as label
          x: Number(field.x) * scaleRatio,
          y: Number(field.y) * scaleRatio,
          width: Number(field.width) * scaleRatio,
          height: Number(field.height) * scaleRatio,
        });
      });

      // Add signature field if exists
      if (signatureField && signaturePreview) {
        const sigPageNum = signatureField.pageNumber || 1;
        if (!fieldsByPage[sigPageNum]) {
          fieldsByPage[sigPageNum] = [];
        }

        // Convert signature data URL to image
        const sigField = {
          ...signatureField,
          x: Number(signatureField.x) * scaleRatio,
          y: Number(signatureField.y) * scaleRatio,
          width: Number(signatureField.width) * scaleRatio,
          height: Number(signatureField.height) * scaleRatio,
          signatureDataUrl: signaturePreview,
        };

        fieldsByPage[sigPageNum].push(sigField);
      }

      // Generate composite PDF for each page
      let compositePdfBytes = pdfBytes;

      for (const [pageNum, pageFields] of Object.entries(fieldsByPage)) {
        compositePdfBytes = await generatePdf(
          compositePdfBytes,
          pageFields,
          parseInt(pageNum)
        );
      }

      if (!compositePdfBytes) {
        throw new Error("Failed to generate composite PDF");
      }

      // Convert to Blob
      return new Blob([compositePdfBytes], { type: "application/pdf" });
    } catch (error) {
      console.error("[usePdfSigning] Error generating composite PDF:", error);
      throw new Error("Failed to generate PDF document: " + error.message);
    }
  };

  return {
    generateCompositePdf,
    sanitizeInput,
  };
};
