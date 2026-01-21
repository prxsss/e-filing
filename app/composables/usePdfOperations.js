export const usePdfOperations = () => {
  // Load PDF.js
  async function loadPdfJs() {
    if (typeof window === "undefined") return null;

    try {
      // Import PDF.js dynamically
      const pdfjs = await import("pdfjs-dist");

      // Set worker source after importing
      if (process.client) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
      }

      return pdfjs;
    } catch (error) {
      console.error("[PDF Operations] Error initializing PDF.js:", error);
      throw error;
    }
  }

  // Load pdf-lib dynamically
  async function loadPdfLib() {
    if (typeof window !== "undefined" && !window.PDFLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    return window.PDFLib;
  }

  // Load PDF document
  async function loadPdfDocument(pdfUrl) {
    const pdfjsLib = await loadPdfJs();

    try {
      if (typeof pdfUrl === "string") {
        // URL-based loading
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        return await loadingTask.promise;
      } else {
        // ArrayBuffer/Uint8Array-based loading
        const loadingTask = pdfjsLib.getDocument({
          data: pdfUrl,
          cMapUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/pdfjs-dist/3.11.174/cmaps/",
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;

        return pdf;
      }
    } catch (error) {
      console.error("[PDF Operations] Error loading PDF document:", error);
      throw error;
    }
  }

  // Render a PDF page to canvas
  async function renderPdfPage(pdf, pageNumber, scale = 1.5) {
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      // Set display size
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      // Set actual size in memory
      canvas.width = viewport.width * pixelRatio;
      canvas.height = viewport.height * pixelRatio;

      // Scale context to match the device pixel ratio
      context.scale(pixelRatio, pixelRatio);

      // Set white background
      context.fillStyle = "white";
      context.fillRect(0, 0, viewport.width, viewport.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        enableWebGL: true,
      };

      await page.render(renderContext).promise;

      return {
        canvas,
        viewport,
        page,
      };
    } catch (error) {
      console.error("Error rendering PDF page:", error);
      throw error;
    }
  }

  // Convert canvas to blob
  function canvasToBlob(canvas, quality = 0.95) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", quality);
    });
  }

  // Calculate font size based on field dimensions
  function calculateFontSize(width, height, baseFontSize) {
    const aspectRatio = width / height;
    let fontSize = baseFontSize;

    if (aspectRatio > 3) {
      fontSize = baseFontSize * 0.7;
    } else if (aspectRatio > 2) {
      fontSize = baseFontSize * 0.8;
    } else if (aspectRatio < 0.5) {
      fontSize = baseFontSize * 1.2;
    }

    return Math.max(8, Math.min(fontSize, height * 0.6));
  }

  // Render text with wrapping on canvas
  function renderTextWithWrapping(
    ctx,
    text,
    x,
    y,
    width,
    height,
    fontSize,
    fontFamily
  ) {
    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = "#000000";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const words = text.split(" ");
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > width && currentLine !== "") {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    const lineHeight = fontSize * 1.2;
    const startY = y + (height - lines.length * lineHeight) / 2;

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight;
      if (lineY + fontSize <= y + height) {
        ctx.fillText(line, x, lineY);
      }
    });

    ctx.restore();
  }

  // Render check mark on canvas
  function renderCheckMark(ctx, x, y, width, height, fontSize) {
    ctx.save();
    ctx.strokeStyle = "#000000ff";
    ctx.lineWidth = fontSize * 0.12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const size = Math.min(width, height) * 0.4;

    ctx.beginPath();
    ctx.moveTo(centerX - size / 2, centerY);
    ctx.lineTo(centerX - size / 6, centerY + size / 3);
    ctx.lineTo(centerX + size / 2, centerY - size / 3);
    ctx.stroke();

    ctx.restore();
  }

  // Render signature image on canvas
  async function renderSignatureImage(
    ctx,
    x,
    y,
    width,
    height,
    signatureDataUrl
  ) {
    try {
      // Load signature image from data URL
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = signatureDataUrl;
      });

      // Draw signature image
      ctx.save();
      ctx.drawImage(img, x, y, width, height);
      ctx.restore();
    } catch (error) {
      console.error("[usePdfOperations] Error rendering signature:", error);
    }
  }

  // Check if field is within bounds
  function isFieldInBounds(
    x,
    y,
    width,
    height,
    containerWidth,
    containerHeight
  ) {
    return (
      x >= 0 &&
      y >= 0 &&
      x + width <= containerWidth &&
      y + height <= containerHeight
    );
  }

  // Generate composite PDF with fields embedded
  async function generateCompositePdf(pdfBytes, placedFields, pageNumber = 1) {
    const PDFLib = await loadPdfLib();
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const targetPage = pages[pageNumber - 1];

    const { width: pageWidth, height: pageHeight } = targetPage.getSize();

    // Process each field
    for (const field of placedFields) {
      try {
        // Handle signature field
        if (field.signatureDataUrl) {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(field.width, 50);
          canvas.height = Math.max(field.height, 50);
          const ctx = canvas.getContext("2d");

          // Clear canvas (transparent background)
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Render signature image
          await renderSignatureImage(
            ctx,
            0,
            0,
            canvas.width,
            canvas.height,
            field.signatureDataUrl
          );

          const imageData = canvas.toDataURL("image/png");
          const pngImage = await pdfDoc.embedPng(imageData);

          targetPage.drawImage(pngImage, {
            x: field.x,
            y: pageHeight - field.y - field.height,
            width: field.width,
            height: field.height,
          });
        } else if (field.name === "Check Mark") {
          // For check marks, create a transparent canvas
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(field.width, 50);
          canvas.height = Math.max(field.height, 50);
          const ctx = canvas.getContext("2d");

          // Make canvas transparent
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw check mark only (no background or border)
          const fontSize = Math.min(canvas.width, canvas.height) * 0.6;
          renderCheckMark(ctx, 0, 0, canvas.width, canvas.height, fontSize);

          const imageData = canvas.toDataURL("image/png");
          const pngImage = await pdfDoc.embedPng(imageData);

          targetPage.drawImage(pngImage, {
            x: field.x,
            y: pageHeight - field.y - field.height,
            width: field.width,
            height: field.height,
          });
        } else {
          // For text fields - render text only (transparent background, no border)
          const text = field.label ? field.label.trim() : "";

          if (text) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // Calculate proper font size based on field dimensions
            const fontSize = calculateFontSize(field.width, field.height, 12);

            // Use higher resolution for better quality
            const scale = 2;
            canvas.width = field.width * scale;
            canvas.height = field.height * scale;

            ctx.scale(scale, scale);

            // Make canvas transparent (no background)
            ctx.clearRect(0, 0, field.width, field.height);

            // Draw text - centered both horizontally and vertically
            ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`;
            ctx.fillStyle = "#000000";
            ctx.textAlign = "center"; // Center horizontally
            ctx.textBaseline = "middle"; // Center vertically

            const maxWidth = field.width - 16; // Small padding
            const textX = field.width / 2; // Center X position
            const textY = field.height / 2; // Center Y position

            // Measure and truncate text if needed
            let displayText = text;
            let textMetrics = ctx.measureText(displayText);

            if (textMetrics.width > maxWidth) {
              // Truncate text with ellipsis
              while (displayText.length > 0 && textMetrics.width > maxWidth) {
                displayText = displayText.slice(0, -1);
                textMetrics = ctx.measureText(displayText + "...");
              }
              displayText = displayText + "...";
            }

            // Draw main text centered
            ctx.fillText(displayText, textX, textY);

            // If field is grouped, add instance number (top-right corner)
            if (field.isGrouped && field.instanceNumber) {
              const instanceText = `#${field.instanceNumber}`;
              const instFontSize = fontSize * 0.5;
              ctx.font = `${instFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`;
              ctx.fillStyle = "#666";
              ctx.textAlign = "right";
              ctx.textBaseline = "top";

              // Position in top-right with small padding
              const instX = field.width - 5;
              const instY = 5;

              ctx.fillText(instanceText, instX, instY);
            }

            const imageData = canvas.toDataURL("image/png");
            const pngImage = await pdfDoc.embedPng(imageData);

            targetPage.drawImage(pngImage, {
              x: field.x,
              y: pageHeight - field.y - field.height,
              width: field.width,
              height: field.height,
            });
          }
        }
      } catch (error) {
        console.error(
          "[generateCompositePdf] Error processing field:",
          field,
          error
        );
      }
    }

    const modifiedPdfBytes = await pdfDoc.save();

    return modifiedPdfBytes;
  }

  // Convert Uint8Array to base64
  async function uint8ArrayToBase64(bytes) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(new Blob([bytes]));
      reader.onload = () => {
        resolve(reader.result.split(",")[1]);
      };
      reader.onerror = (error) => {
        reject(error);
      };
    });
  }

  // Convert base64 to Uint8Array
  function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  return {
    loadPdfJs,
    loadPdfLib,
    loadPdfDocument,
    renderPdfPage,
    canvasToBlob,
    calculateFontSize,
    renderTextWithWrapping,
    renderCheckMark,
    renderSignatureImage,
    isFieldInBounds,
    generateCompositePdf,
    uint8ArrayToBase64,
    base64ToUint8Array,
  };
};
