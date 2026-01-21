export const useCanvasOperations = () => {
  /**
   * Creates a canvas with the specified dimensions
   */
  const createCanvas = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };

  /**
   * Loads an image and returns a promise that resolves when loaded
   */
  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  /**
   * Draws background image on canvas
   */
  const drawBackgroundImage = (ctx, img, width, height) => {
    ctx.drawImage(img, 0, 0, width, height);
  };

  /**
   * Renders a check mark on the canvas
   */
  const renderCheckMark = (ctx, x, y, width, height, fontSize) => {
    ctx.save();
    const checkmarkSize = Math.max(fontSize * 1.2, 16);
    ctx.font = `normal ${checkmarkSize}px Arial, sans-serif`;
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.shadowBlur = 2;

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    ctx.fillText("✓", centerX, centerY);
    ctx.restore();
  };

  /**
   * Renders text with word wrapping
   */
  const renderTextWithWrapping = (
    ctx,
    text,
    x,
    y,
    width,
    height,
    fontSize,
    fontFamily = "Arial, sans-serif"
  ) => {
    if (!text || !text.trim()) return;

    ctx.save();
    ctx.font = `normal ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const maxTextWidth = width * 0.95;

    // Word wrapping logic
    const words = text.split(" ");
    let lines = [];
    let line = "";

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxTextWidth && i > 0) {
        lines.push(line.trim());
        line = words[i] + " ";
      } else {
        line = testLine;
      }
    }
    if (line.trim()) lines.push(line.trim());

    // Draw lines
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = lines.length * lineHeight;
    let startY = centerY - totalTextHeight / 2 + lineHeight / 2;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], centerX, startY + i * lineHeight);
    }
    ctx.restore();
  };

  /**
   * Renders text with simple truncation (for form data)
   */
  const renderTextWithTruncation = (
    ctx,
    text,
    x,
    y,
    width,
    height,
    fontSize,
    fontFamily = "Arial, sans-serif"
  ) => {
    if (!text || !text.trim()) return;

    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const maxWidth = width * 0.9;

    let displayText = text;
    // Simple truncation with ellipsis
    while (
      ctx.measureText(displayText).width > maxWidth &&
      displayText.length > 1
    ) {
      displayText = displayText.slice(0, -1);
    }
    if (displayText !== text && displayText.length > 3) {
      displayText = displayText.slice(0, -3) + "...";
    }

    ctx.fillText(displayText, centerX, centerY, maxWidth);
    ctx.restore();
  };

  /**
   * Renders a signature image on the canvas
   */
  const renderSignature = async (
    ctx,
    signatureField,
    signaturePreview,
    scaleRatio
  ) => {
    try {
      const sigImg = await loadImage(signaturePreview);

      const sigX = signatureField.x * scaleRatio;
      const sigY = signatureField.y * scaleRatio;
      const sigW = signatureField.width * scaleRatio;
      const sigH = signatureField.height * scaleRatio;

      const sigScale = Math.min(sigW / sigImg.width, sigH / sigImg.height, 1);
      const sigDrawX = sigX + (sigW - sigImg.width * sigScale) / 2;
      const sigDrawY = sigY + (sigH - sigImg.height * sigScale) / 2;

      ctx.drawImage(
        sigImg,
        sigDrawX,
        sigDrawY,
        sigImg.width * sigScale,
        sigImg.height * sigScale
      );
    } catch (error) {
      console.error("Error rendering signature:", error);
      throw new Error("Failed to render signature");
    }
  };

  /**
   * Converts canvas to blob
   */
  const canvasToBlob = (canvas, mimeType = "image/png", quality = 0.95) => {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });
  };

  /**
   * Calculates font size based on field dimensions
   */
  const calculateFontSize = (
    fieldWidth,
    fieldHeight,
    baseFontSize,
    minFontSize = 12,
    maxFontSize = 48
  ) => {
    return Math.max(
      minFontSize,
      Math.min(
        maxFontSize,
        Math.min(fieldHeight * 0.6, fieldWidth * 0.1, baseFontSize)
      )
    );
  };

  /**
   * Checks if field is within canvas bounds
   */
  const isFieldInBounds = (x, y, width, height, canvasWidth, canvasHeight) => {
    return !(x < -width || y < -height || x > canvasWidth || y > canvasHeight);
  };

  return {
    createCanvas,
    loadImage,
    drawBackgroundImage,
    renderCheckMark,
    renderTextWithWrapping,
    renderTextWithTruncation,
    renderSignature,
    canvasToBlob,
    calculateFontSize,
    isFieldInBounds,
  };
};
