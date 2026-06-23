const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;

export function neutralizeCsvCell(value: string): string {
  if (FORMULA_PREFIX_PATTERN.test(value)) {
    return `'${value}`;
  }
  return value;
}
