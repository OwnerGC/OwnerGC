/** Rows to CSV text. Quotes every cell, and defuses spreadsheet formulas. */
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          let s = String(cell);
          // A cell starting with = + - @ could run as a formula in Excel.
          if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
}
