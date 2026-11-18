declare module 'xlsx-populate/browser/xlsx-populate.min.js' {
  interface CellRange {
    value(rows: string[][]): CellRange;
    style(values: { bold: boolean; fill: string; fontColor: string }): CellRange;
  }

  interface Sheet {
    name(value: string): Sheet;
    range(address: string): CellRange;
    range(firstRow: number, firstColumn: number, lastRow: number, lastColumn: number): CellRange;
    column(index: number): { width(value: number): void };
  }

  const xlsx: {
    fromBlankAsync(): Promise<{
      sheet(index: number): Sheet;
      addSheet(name: string): Sheet;
      outputAsync(options: { type: 'blob'; password: string }): Promise<Blob>;
    }>;
  };
  export default xlsx;
}
