/**
 * Student form: "must fill" flag from template `placedFieldsData` (set in Form Layout).
 * Default true when absent so existing templates stay "required" until admin turns off.
 */
export function isFormFieldRequired(field: { formRequired?: boolean; form_required?: boolean } | null | undefined): boolean {
  if (!field || typeof field !== 'object') {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(field, 'formRequired')) {
    return field.formRequired !== false;
  }
  if (Object.prototype.hasOwnProperty.call(field, 'form_required')) {
    return field.form_required !== false;
  }
  return true;
}
