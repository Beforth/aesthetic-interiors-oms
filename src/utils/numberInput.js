/**
 * Numeric input helpers.
 *
 * A cleared number field must stay visually empty. Returning `0` for an empty
 * string makes a real `0` appear in the input, which then gets submitted as an
 * amount and cannot be removed with backspace.
 */
export function numericOnChange(raw, parser = Number) {
  if (raw === '' || raw === null || raw === undefined) return '';
  const parsed = parser(raw);
  return Number.isNaN(parsed) ? '' : parsed;
}

export function numericValue(value) {
  return value === '' || value === null || value === undefined ? '' : value;
}
