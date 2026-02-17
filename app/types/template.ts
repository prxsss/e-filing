/**
 * Shared Type Definitions for Template Management
 * Used across: create.vue, edit.vue, template-pdf-create.vue, template-pdf-edit.vue
 */

/**
 * Base field structure from database
 */
export type Field = {
  id: number | string;
  name: string;
  label?: string;
  fieldType: string;
  amount?: number;
  fontSize?: number;
  fontFamily?: string;
  [key: string]: any;
};

/**
 * Field instance with placement metadata and coordinates
 * Extends Field with instance-specific properties
 */
export type FieldInstance = Field & {
  instanceId: string;
  instanceNumber: number;
  groupId: string | null;
  isGrouped: boolean;
  groupSize: number;
  groupPosition: number;
  // Display coordinates (pixels) - for UI rendering
  x: number;
  y: number;
  width: number;
  height: number;
  // Normalized coordinates (0-1) - for PDF independence
  normalizedX?: number;
  normalizedY?: number;
  normalizedWidth?: number;
  normalizedHeight?: number;
  // Display coordinates (calculated from normalized) - for UI
  displayX?: number;
  displayY?: number;
  displayWidth?: number;
  displayHeight?: number;
  // Page info
  pageNumber: number;
  // Font properties
  fontSize: number;
  fontFamily: string;
};

/**
 * PDF reference object exposed by canvas components
 * Provides coordinate conversion methods for parent/child communication
 */
export type PdfRef = {
  saveTemplate: () => Promise<void>;
  normalizedToDisplay: (
    normalizedX: number,
    normalizedY: number,
    normalizedWidth: number,
    normalizedHeight: number,
  ) => { x: number; y: number; width: number; height: number };
  displayToNormalized: (
    displayX: number,
    displayY: number,
    displayWidth: number,
    displayHeight: number,
  ) => { x: number; y: number; width: number; height: number };
};

/**
 * File type indicator for uploaded documents
 */
export type FileTypeValue = 'image' | 'pdf' | null;

/**
 * PDF natural dimensions (width/height in points)
 */
export type PdfDimensions = {
  width: number;
  height: number;
};

/**
 * Field update event data from toolbar
 */
export type FieldUpdateData = {
  instanceId: string;
  updates: Partial<FieldInstance>;
};

/**
 * PDF bounds for coordinate transformation
 */
export type PdfBounds = {
  displayWidth: number;
  displayHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  scaleX: number;
  scaleY: number;
};

/**
 * Template data structure
 */
export type TemplateData = {
  id: string | number;
  name: string;
  fileType: FileTypeValue;
  pdfBytes?: Uint8Array;
  originalImageUrl?: string;
  compositeImageUrl?: string;
  placedFields: FieldInstance[];
  selectedContractId?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Active drag state
 */
export type DragState = {
  isDragging: boolean;
  field: FieldInstance | null;
  offsetX: number;
  offsetY: number;
  startX?: number;
  startY?: number;
};

/**
 * Active resize state
 */
export type ResizeState = {
  isResizing: boolean;
  field: FieldInstance | null;
  direction: string | null;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};
