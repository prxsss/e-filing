/**
 * Composable for converting between display (pixel) and normalized (0-1) coordinates
 * Used for PDF field positioning to ensure fields scale correctly with zoom
 */
export function useCoordinateConversion(pdfCanvas, pdfNaturalDimensions) {
  /**
   * Get PDF bounds including scale factors
   */
  function getPdfBounds() {
    if (!pdfCanvas.value) {
      return { scaleX: 1, scaleY: 1, width: 0, height: 0 };
    }

    const rect = pdfCanvas.value.getBoundingClientRect();
    const naturalWidth = pdfNaturalDimensions.value?.width || rect.width;
    const naturalHeight = pdfNaturalDimensions.value?.height || rect.height;

    return {
      scaleX: naturalWidth / rect.width,
      scaleY: naturalHeight / rect.height,
      width: rect.width,
      height: rect.height,
    };
  }

  /**
   * Convert display (pixel) coordinates to normalized (0-1) coordinates
   */
  function displayToNormalized(x, y, width, height) {
    if (!pdfCanvas.value || !pdfNaturalDimensions.value?.width) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const bounds = getPdfBounds();
    const naturalWidth = pdfNaturalDimensions.value.width;
    const naturalHeight = pdfNaturalDimensions.value.height;

    // Convert display coordinates to natural coordinates first
    const naturalX = x * bounds.scaleX;
    const naturalY = y * bounds.scaleY;
    const naturalW = width * bounds.scaleX;
    const naturalH = height * bounds.scaleY;

    // Normalize (0-1) based on natural PDF dimensions
    return {
      x: naturalX / naturalWidth,
      y: naturalY / naturalHeight,
      width: naturalW / naturalWidth,
      height: naturalH / naturalHeight,
    };
  }

  /**
   * Convert normalized (0-1) coordinates to display (pixel) coordinates
   */
  function normalizedToDisplay(normX, normY, normWidth, normHeight) {
    if (!pdfCanvas.value || !pdfNaturalDimensions.value?.width) {
      return { x: 50, y: 50, width: 150, height: 40 };
    }

    const bounds = getPdfBounds();
    const naturalWidth = pdfNaturalDimensions.value.width;
    const naturalHeight = pdfNaturalDimensions.value.height;

    // Convert normalized to natural coordinates
    const naturalX = normX * naturalWidth;
    const naturalY = normY * naturalHeight;
    const naturalW = normWidth * naturalWidth;
    const naturalH = normHeight * naturalHeight;

    // Convert natural to display coordinates
    return {
      x: naturalX / bounds.scaleX,
      y: naturalY / bounds.scaleY,
      width: naturalW / bounds.scaleX,
      height: naturalH / bounds.scaleY,
    };
  }

  return {
    getPdfBounds,
    displayToNormalized,
    normalizedToDisplay,
  };
}
