const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;

export function neutralizeCsvCell(value: string): string {
  if (FORMULA_PREFIX_PATTERN.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim().length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

export function parseCsvObjects(csvText: string): Record<string, string>[] {
  const [headerRow, ...bodyRows] = parseCsvRows(csvText);
  if (!headerRow) return [];

  const headers = headerRow.map((header) => header.trim());
  return bodyRows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = neutralizeCsvCell((row[index] ?? "").trim());
    });
    return record;
  });
}
