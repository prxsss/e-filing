import { DROPDOWN_SOURCE_DEFINITIONS } from '../../utils/template-field-dropdown';

export default defineEventHandler(async () => {
  return {
    success: true,
    data: DROPDOWN_SOURCE_DEFINITIONS,
  };
});
