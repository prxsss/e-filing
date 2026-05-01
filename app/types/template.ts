/**
 * Shared Type Definitions for Template Management
 * Used across: create.vue, edit.vue, template-pdf-create.vue, template-pdf-edit.vue
 */

/**
 * Base field structure from database
 */
export type DropdownSourceTable = 'faculties' | 'departments' | 'roles' | 'users';

export type DropdownConfig = {
  sourceTable: DropdownSourceTable;
  labelColumn?: string;
  roleId?: number;
  dataLabel?: string;
  valueColumn: 'id';
};

export type Field = {
  id: number | string;
  name: string;
  label?: string;
  fieldType: string;
  sessionField?: 'studentName' | 'studentId' | 'studentYearCurrent' | 'facultyNameTh' | 'departmentNameTh' | 'departmentCode' | 'titleThAutoChecked' | 'titleThMrChecked' | 'titleThMissChecked' | 'titleThMrsChecked' | null;
  dropdownConfig?: DropdownConfig | null;
  maxLength?: number | null;
  amount?: number;
  fontSize?: number;
  fontFamily?: string;
  strikeThroughGroupMode?: boolean;
  strikeLineThickness?: number;
  textIndent?: number;
  [key: string]: any;
};

export type ConditionalVisibilityOperator = 'isChecked' | 'isUnchecked';

export type FieldVisibilityRule = {
  enabled?: boolean;
  sourceFieldInstanceId?: string | null;
  sourceGroupId?: string | null;
  operator?: ConditionalVisibilityOperator;
  clearWhenHidden?: boolean;
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
  // Signing step assignment
  signerStepId?: string;
  // Auto-generate flag (system fills value automatically, skips signer assignment)
  isAutoGenerate?: boolean;
  // Optional conditional visibility linked to another field instance.
  visibilityRule?: FieldVisibilityRule | null;
  // Auto-generated date/time format controls
  dateSeparator?: string;
  dateSeparatorSpacing?: number;
  dateShowDay?: boolean;
  dateShowMonth?: boolean;
  dateShowYear?: boolean;
  timeSeparator?: string;
  timeSeparatorSpacing?: number;
  timeShowHour?: boolean;
  timeShowMinute?: boolean;
  strikeThroughGroupMode?: boolean;
  strikeLineThickness?: number;
  textIndent?: number;
  // Student form layout (/admin/templates/[id] Form Layout + template save)
  formOrder?: number;
  formQuestionLabel?: string;
  formSectionTitle?: string;
  /** false = optional (no *); omitted defaults to required on student forms */
  formRequired?: boolean;
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
 * Signing step definition for template signing flow
 */
export type SigningStep = {
  id: string;
  order: number;
  roleId?: number;
  roleName: string;
  description?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  isRequired: boolean;
  rejectsRequestImmediately?: boolean;
  assignedFieldInstanceIds: string[];
  color: string;
};

/**
 * Signing flow data stored as JSONB on request_template
 */
export type SigningFlowData = SigningStep[];

/**
 * Wizard step for multi-step template creation
 */
export type WizardStep = 1 | 2 | 3;

/**
 * Predefined colors for signing steps
 */
export const SIGNER_COLORS: string[] = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1', // indigo
];

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
