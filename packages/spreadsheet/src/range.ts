import {
  FormulaError,
  ScalarType,
  IRange,
  FormulaContext,
} from "@sheetxl/primitives";
export type Value = number | string | boolean | null | FormulaError.Known;
export type Matrix = Value[][];
type Options = {
  type?: string;
  coerce?: boolean;
  includeEmpty?: boolean;
  orientation?: string;
  bounds?: {
    rowStart?: number;
    rowEnd?: number;
    colStart?: number;
    colEnd?: number;
  };
};
export function scalar(value: unknown): Value {
  if (value instanceof Range) return value.getValueAt(0, 0);
  if (Array.isArray(value))
    return scalar(Array.isArray(value[0]) ? value[0][0] : value[0]);
  return value as Value;
}
export function number(value: unknown): number {
  const raw = scalar(value);
  if (raw instanceof FormulaError.Known) throw raw;
  const result = raw === null || raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(result)) throw FormulaError.BuiltIn.Value;
  return result;
}
export function boolean(value: unknown): boolean {
  const raw = scalar(value);
  if (raw instanceof FormulaError.Known) throw raw;
  if (typeof raw === "string") {
    if (raw.toUpperCase() === "TRUE") return true;
    if (raw.toUpperCase() === "FALSE") return false;
    if (raw === "") return false;
    throw FormulaError.BuiltIn.Value;
  }
  return !!raw;
}
export function coerce(value: Value, options: Options = {}): Value | undefined {
  if (value instanceof FormulaError.Known) throw value;
  if (value === null && !options.includeEmpty && !options.coerce)
    return undefined;
  if (!options.type) return value;
  const expected =
    options.type === ScalarType.Number
      ? "number"
      : options.type === ScalarType.String
        ? "string"
        : options.type === ScalarType.Boolean
          ? "boolean"
          : "any";
  if (expected === "any" || typeof value === expected) return value;
  if (!options.coerce) return undefined;
  if (expected === "number") return number(value);
  if (expected === "boolean") return boolean(value);
  return value === null ? "" : String(value);
}
export class Range {
  readonly isIRange = true;
  readonly isIReferenceRange: boolean;
  readonly isLiteral: boolean;
  constructor(
    public data: Matrix,
    public coords?: {
      rowStart: number;
      rowEnd: number;
      colStart: number;
      colEnd: number;
    },
  ) {
    this.isIReferenceRange = !!coords;
    this.isLiteral = !coords;
  }
  get size() {
    return this.getWidth() * this.getHeight();
  }
  getWidth() {
    return this.data[0]?.length ?? 0;
  }
  getHeight() {
    return this.data.length;
  }
  getCoords() {
    return (
      this.coords ?? {
        rowStart: 0,
        rowEnd: this.getHeight() - 1,
        colStart: 0,
        colEnd: this.getWidth() - 1,
      }
    );
  }
  getValueAt(row: number, column: number, options?: Options): any {
    return coerce(this.data[row]?.[column] ?? null, {
      includeEmpty: true,
      ...options,
    });
  }
  getValues(options: Options = {}): any[][] {
    const data = this.data.map((row) =>
      row.map(
        (value) => coerce(value, { includeEmpty: true, ...options }) ?? null,
      ),
    );
    return options.orientation === IRange.Orientation.Column
      ? Array.from({ length: this.getWidth() }, (_, column) =>
          data.map((row) => row[column]),
        )
      : data;
  }
  *entries(options: Options = {}): Generator<{
    value: Value;
    coords: { rowIndex: number; colIndex: number };
  }> {
    const bounds = options.bounds;
    const rs = bounds?.rowStart ?? 0,
      re = bounds?.rowEnd ?? this.getHeight() - 1,
      cs = bounds?.colStart ?? 0,
      ce = bounds?.colEnd ?? this.getWidth() - 1;
    const columnFirst = options.orientation === IRange.Orientation.Column;
    const major = columnFirst ? [cs, ce] : [rs, re],
      minor = columnFirst ? [rs, re] : [cs, ce];
    for (let a = major[0]; a <= major[1]; a++)
      for (let b = minor[0]; b <= minor[1]; b++) {
        const rowIndex = columnFirst ? b : a,
          colIndex = columnFirst ? a : b;
        const value = coerce(this.data[rowIndex]?.[colIndex] ?? null, options);
        if (value !== undefined)
          yield { value, coords: { rowIndex, colIndex } };
      }
  }
  *values(options: Options = {}) {
    for (const entry of this.entries(options)) yield entry.value;
  }
  flatten(options?: Options) {
    return [...this.values(options)];
  }
  forEach(
    fn: (value: any, coords: any, range: Range) => any,
    options?: Options,
  ): any {
    for (const { value, coords } of this.entries(options)) {
      const result = fn(value, coords, this);
      if (result?.break) return result.value;
    }
  }
  reduce(
    fn: (accumulator: any, value: any, coords: any, range: Range) => any,
    initial: any,
    options?: Options,
  ) {
    let result = initial;
    this.forEach((value, coords) => {
      result = fn(result, value, coords, this);
    }, options);
    return result;
  }
  map(fn: (value: any, coords: any, range: Range) => Value, options?: Options) {
    const data = this.data.map((row) => [...row]);
    this.forEach((value, coords) => {
      data[coords.rowIndex][coords.colIndex] = fn(value, coords, this);
    }, options);
    return new Range(data);
  }
  filter(
    fn: (value: any, coords: any, range: Range) => boolean,
    options?: Options,
  ) {
    return new Range(
      [...this.entries(options)]
        .filter(({ value, coords }) => fn(value, coords, this))
        .map(({ value }) => [value]),
    );
  }
  some(
    fn: (value: any, coords: any, range: Range) => boolean,
    options?: Options,
  ) {
    return [...this.entries(options)].some(({ value, coords }) =>
      fn(value, coords, this),
    );
  }
  every(
    fn: (value: any, coords: any, range: Range) => boolean,
    options?: Options,
  ) {
    return [...this.entries(options)].every(({ value, coords }) =>
      fn(value, coords, this),
    );
  }
  empty() {
    return new Range([]);
  }
  slice(coords: {
    rowStart?: number;
    rowEnd?: number;
    colStart?: number;
    colEnd?: number;
  }) {
    return new Range(
      this.data
        .slice(
          coords.rowStart ?? 0,
          (coords.rowEnd ?? this.getHeight() - 1) + 1,
        )
        .map((row) =>
          row.slice(
            coords.colStart ?? 0,
            (coords.colEnd ?? this.getWidth() - 1) + 1,
          ),
        ),
    );
  }
  fill(
    value: Value,
    coords = {
      rowStart: 0,
      colStart: 0,
      rowEnd: this.getHeight() - 1,
      colEnd: this.getWidth() - 1,
    },
  ) {
    const data = this.data.map((row) => [...row]);
    for (let row = coords.rowStart; row <= coords.rowEnd; row++) {
      data[row] ??= [];
      for (let col = coords.colStart; col <= coords.colEnd; col++)
        data[row][col] = value;
    }
    return new Range(data);
  }
  replace(other: Range | Matrix, coords = { rowIndex: 0, colIndex: 0 }) {
    const source = other instanceof Range ? other.data : other,
      data = this.data.map((row) => [...row]);
    source.forEach((row, r) =>
      row.forEach((value, c) => {
        data[coords.rowIndex + r] ??= [];
        data[coords.rowIndex + r][coords.colIndex + c] = value;
      }),
    );
    return new Range(data);
  }
  broadcast(
    other: Range | Value,
    fn: (a: any, b: any, coords: any, range: Range) => Value,
    options?: { mismatchFill?: Value },
  ) {
    const right = asRange(other),
      rows = Math.max(this.getHeight(), right.getHeight()),
      columns = Math.max(this.getWidth(), right.getWidth());
    return new Range(
      Array.from({ length: rows }, (_, row) =>
        Array.from({ length: columns }, (_, column) =>
          fn(
            this.data[this.getHeight() === 1 ? 0 : row]?.[
              this.getWidth() === 1 ? 0 : column
            ] ??
              options?.mismatchFill ??
              null,
            right.data[right.getHeight() === 1 ? 0 : row]?.[
              right.getWidth() === 1 ? 0 : column
            ] ??
              options?.mismatchFill ??
              null,
            { rowIndex: row, colIndex: column },
            this,
          ),
        ),
      ),
    );
  }
  startIncrementalUpdates() {
    let range: Range = this;
    return {
      pushAt(row: number, column: number, value: Value) {
        range = range.replace([[value]], { rowIndex: row, colIndex: column });
        return this;
      },
      pushMultipleAt(row: number, column: number, values: Value[]) {
        range = range.replace([values], { rowIndex: row, colIndex: column });
        return this;
      },
      apply() {
        return range;
      },
    };
  }
}
export function asRange(value: any): Range {
  return value instanceof Range
    ? value
    : new Range(
        Array.isArray(value)
          ? Array.isArray(value[0])
            ? value
            : [value]
          : [[value ?? null]],
      );
}
export function setFormulaContext(context: Record<string, unknown>) {
  Object.assign(FormulaContext, context);
}
