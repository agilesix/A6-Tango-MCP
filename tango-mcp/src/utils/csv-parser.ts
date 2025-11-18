/**
 * CSV Parser Utility
 *
 * Simple utility for parsing CSV strings into JSON objects.
 * Used for converting CSV export responses back to structured data if needed.
 *
 * Note: This is a basic parser. For production use with complex CSV,
 * consider using a library like papaparse.
 */

/**
 * Parse CSV string into array of objects
 *
 * @param csvString - Raw CSV string with header row
 * @param delimiter - Column delimiter (default: comma)
 * @returns Array of objects with header names as keys
 *
 * @example
 * ```typescript
 * const csv = "name,amount\nAcme Corp,1000\nTech Inc,2000";
 * const data = parseCSV(csv);
 * // Returns: [
 * //   { name: "Acme Corp", amount: "1000" },
 * //   { name: "Tech Inc", amount: "2000" }
 * // ]
 * ```
 */
export function parseCSV(
  csvString: string,
  delimiter = ',',
): Array<Record<string, string>> {
  if (!csvString || csvString.trim().length === 0) {
    return [];
  }

  const lines = csvString.trim().split('\n');
  if (lines.length < 2) {
    // Need at least header + 1 data row
    return [];
  }

  // Parse header row
  const headers = parseCSVLine(lines[0], delimiter);

  // Parse data rows
  const result: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (values.length === 0) continue; // Skip empty lines

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    result.push(row);
  }

  return result;
}

/**
 * Parse a single CSV line, handling quoted fields
 *
 * @param line - Single line of CSV
 * @param delimiter - Column delimiter
 * @returns Array of field values
 */
function parseCSVLine(line: string, delimiter = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

/**
 * Get CSV column headers from CSV string
 *
 * @param csvString - Raw CSV string
 * @param delimiter - Column delimiter (default: comma)
 * @returns Array of column names
 */
export function getCSVHeaders(
  csvString: string,
  delimiter = ',',
): string[] {
  if (!csvString || csvString.trim().length === 0) {
    return [];
  }

  const firstLine = csvString.split('\n')[0];
  return parseCSVLine(firstLine, delimiter);
}

/**
 * Count rows in CSV (excluding header)
 *
 * @param csvString - Raw CSV string
 * @returns Number of data rows
 */
export function getCSVRowCount(csvString: string): number {
  if (!csvString || csvString.trim().length === 0) {
    return 0;
  }

  const lines = csvString.trim().split('\n');
  // Subtract 1 for header row, filter out empty lines
  return lines.slice(1).filter(line => line.trim().length > 0).length;
}

/**
 * Convert CSV to JSON string
 *
 * @param csvString - Raw CSV string
 * @param delimiter - Column delimiter (default: comma)
 * @param pretty - Pretty print JSON (default: true)
 * @returns JSON string representation
 */
export function csvToJSON(
  csvString: string,
  delimiter = ',',
  pretty = true,
): string {
  const data = parseCSV(csvString, delimiter);
  return JSON.stringify(data, null, pretty ? 2 : 0);
}
