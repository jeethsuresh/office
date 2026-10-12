import {
  parseURN,
  parseAddress,
  cellAddress,
  type Reference,
} from "@office/model";
export type Formula =
  | { type: "value"; value: string | number | boolean | null }
  | {
      type: "ref";
      urn: string;
      fixedColumn: boolean;
      fixedRow: boolean;
      qualified: boolean;
    }
  | { type: "range"; start: Formula; end: Formula }
  | { type: "unary"; operator: string; value: Formula }
  | { type: "binary"; operator: string; left: Formula; right: Formula }
  | { type: "call"; name: string; args: Formula[] }
  | { type: "array"; rows: Formula[][] };
export type SheetSnapshot = {
  document: string;
  block: string;
  name: string;
  rows: string[];
  columns: string[];
  cells: Record<string, { input: string; formula?: Formula | null }>;
};
export type WorkbookSnapshot = {
  sheets: SheetSnapshot[];
  targets: Record<string, string>;
  epoch: number;
};
export const sheetKey = (sheet: Pick<SheetSnapshot, "document" | "block">) =>
  `${sheet.document}:${sheet.block}`;
export function sheetCellURN(
  sheet: SheetSnapshot,
  column: number,
  row: number,
) {
  return `${sheetKey(sheet)}:${sheet.rows[row]}~${sheet.columns[column]}`;
}
export function findCell(
  snapshot: WorkbookSnapshot,
  urn: string,
): {
  sheet: SheetSnapshot;
  identifier: string;
  column: number;
  row: number;
} | null {
  const ref = parseURN(urn);
  if (!ref) return null;
  const sheet = snapshot.sheets.find(
    (sheet) => sheet.document === ref.document && sheet.block === ref.block,
  );
  if (!sheet) return null;
  const [r, c] = ref.identifier.split("~");
  const row = sheet.rows.indexOf(r),
    column = sheet.columns.indexOf(c);
  return row >= 0 && column >= 0
    ? { sheet, identifier: ref.identifier, row, column }
    : null;
}
type Token = {
  value: string;
  kind: "number" | "string" | "word" | "operator" | "sheet";
};
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let source = input.slice(1);
  while (source.length) {
    const space = /^\s+/.exec(source);
    if (space) {
      source = source.slice(space[0].length);
      continue;
    }
    const match =
      /^("(?:[^"]|"")*"|'(?:[^']|'')*'!|(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?|[A-Za-z_$][A-Za-z0-9_.$]*|<=|>=|<>|[+\-*/^&%=<>(),:;{}!#])/.exec(
        source,
      );
    if (!match) throw new Error("#PARSE!");
    const value = match[0];
    tokens.push({
      value,
      kind:
        value[0] === '"'
          ? "string"
          : value[0] === "'"
            ? "sheet"
            : /^\d|^\.\d/.test(value)
              ? "number"
              : /^[A-Za-z_$]/.test(value)
                ? "word"
                : "operator",
    });
    source = source.slice(value.length);
  }
  return tokens;
}
export function bindFormula(
  input: string,
  sheet: SheetSnapshot,
  snapshot: WorkbookSnapshot,
): Formula | null {
  if (!input.startsWith("=")) return null;
  if (input.length > 20000) throw new Error("#LIMIT!");
  const tokens = tokenize(input);
  let at = 0,
    depth = 0;
  const peek = () => tokens[at]?.value;
  const take = (expected?: string) => {
    const token = tokens[at++];
    if (!token || (expected && token.value !== expected))
      throw new Error("#PARSE!");
    return token;
  };
  const ref = (address: string, name?: string): Formula => {
    const position = parseAddress(address);
    const matches = name
      ? snapshot.sheets.filter(
          (candidate) =>
            candidate.document === sheet.document &&
            (candidate.name === name || candidate.block === name),
        )
      : [sheet];
    const target = matches.length === 1 ? matches[0] : undefined;
    if (
      !position ||
      !target ||
      !target.columns[position[0]] ||
      !target.rows[position[1]]
    )
      throw new Error("#REF!");
    return {
      type: "ref",
      urn: sheetCellURN(target, ...position),
      fixedColumn: address[0] === "$",
      fixedRow: /\$\d/.test(address),
      qualified: !!name,
    };
  };
  const precedence: Record<string, number> = {
    "=": 1,
    "<>": 1,
    "<": 1,
    ">": 1,
    "<=": 1,
    ">=": 1,
    "&": 2,
    "+": 3,
    "-": 3,
    "*": 4,
    "/": 4,
    "^": 5,
    ":": 6,
  };
  function expression(minimum = 0): Formula {
    if (++depth > 128) throw new Error("#LIMIT!");
    let left: Formula;
    if (peek() === "+" || peek() === "-")
      left = { type: "unary", operator: take().value, value: expression(5) };
    else if (peek() === "(") {
      take();
      left = expression();
      take(")");
    } else if (peek() === "{") {
      take();
      const rows: Formula[][] = [[]];
      while (peek() !== "}") {
        rows[rows.length - 1].push(expression());
        if (peek() === ",") take();
        else if (peek() === ";") {
          take();
          rows.push([]);
        } else break;
      }
      take("}");
      left = { type: "array", rows };
    } else {
      const token = take();
      if (token.kind === "number")
        left = { type: "value", value: Number(token.value) };
      else if (token.kind === "string")
        left = {
          type: "value",
          value: token.value.slice(1, -1).replace(/""/g, '"'),
        };
      else if (token.kind === "sheet")
        left = ref(take().value, token.value.slice(1, -2).replace(/''/g, "'"));
      else if (peek() === "!") {
        take();
        left = ref(take().value, token.value);
      } else if (peek() === "(") {
        take();
        const args: Formula[] = [];
        while (peek() !== ")") {
          args.push(
            peek() === "," ? { type: "value", value: null } : expression(),
          );
          if (peek() !== ",") break;
          take();
          if (peek() === ")") args.push({ type: "value", value: null });
        }
        take(")");
        left = { type: "call", name: token.value.toUpperCase(), args };
      } else if (/^(TRUE|FALSE)$/i.test(token.value))
        left = { type: "value", value: token.value.toUpperCase() === "TRUE" };
      else if (parseAddress(token.value)) left = ref(token.value);
      else throw new Error("#NAME?");
    }
    while (peek() === "%" || peek() === "#")
      left = { type: "unary", operator: take().value, value: left };
    while (peek() && (precedence[peek()] ?? -1) >= minimum) {
      const operator = take().value,
        right = expression(precedence[operator] + (operator === "^" ? 0 : 1));
      left =
        operator === ":"
          ? { type: "range", start: left, end: right }
          : { type: "binary", operator, left, right };
    }
    depth--;
    return left;
  }
  const result = expression();
  if (at !== tokens.length) throw new Error("#PARSE!");
  return result;
}
export function formatFormula(
  formula: Formula,
  snapshot: WorkbookSnapshot,
): string {
  function print(node: Formula): string {
    if (node.type === "value")
      return typeof node.value === "string"
        ? `"${node.value.replace(/"/g, '""')}"`
        : node.value === null
          ? ""
          : String(node.value).toUpperCase();
    if (node.type === "ref") {
      const target = findCell(snapshot, node.urn);
      if (!target) return "#REF!";
      const [column, row] = /([A-Z]+)(\d+)/
        .exec(cellAddress(target.column, target.row))!
        .slice(1);
      return `${node.qualified ? `'${target.sheet.name.replace(/'/g, "''")}'!` : ""}${node.fixedColumn ? "$" : ""}${column}${node.fixedRow ? "$" : ""}${row}`;
    }
    if (node.type === "call")
      return `${node.name}(${node.args.map(print).join(",")})`;
    if (node.type === "array")
      return `{${node.rows.map((row) => row.map(print).join(",")).join(";")}}`;
    if (node.type === "range") return `${print(node.start)}:${print(node.end)}`;
    if (node.type === "unary")
      return node.operator === "%" || node.operator === "#"
        ? `${print(node.value)}${node.operator}`
        : `${node.operator}${print(node.value)}`;
    return `(${print(node.left)}${node.operator}${print(node.right)})`;
  }
  return `=${print(formula)}`;
}
export function formulaReferences(
  formula: Formula | null | undefined,
): string[] {
  if (!formula) return [];
  if (formula.type === "ref") return [formula.urn];
  if (formula.type === "call")
    return formula.name === "REF" && formula.args[0]?.type === "value"
      ? [String(formula.args[0].value)]
      : formula.args.flatMap(formulaReferences);
  if (formula.type === "binary")
    return [
      ...formulaReferences(formula.left),
      ...formulaReferences(formula.right),
    ];
  if (formula.type === "range")
    return [
      ...formulaReferences(formula.start),
      ...formulaReferences(formula.end),
    ];
  if (formula.type === "unary") return formulaReferences(formula.value);
  if (formula.type === "array")
    return formula.rows.flatMap((row) => row.flatMap(formulaReferences));
  return [];
}
export function shiftFormula(
  formula: Formula,
  columnDelta: number,
  rowDelta: number,
  snapshot: WorkbookSnapshot,
): Formula {
  if (formula.type === "ref") {
    const location = findCell(snapshot, formula.urn);
    if (!location) return formula;
    const column = location.column + (formula.fixedColumn ? 0 : columnDelta),
      row = location.row + (formula.fixedRow ? 0 : rowDelta);
    return {
      ...formula,
      urn:
        column < 0 ||
        row < 0 ||
        !location.sheet.columns[column] ||
        !location.sheet.rows[row]
          ? "invalid:_:_"
          : sheetCellURN(location.sheet, column, row),
    };
  }
  if (formula.type === "range")
    return {
      ...formula,
      start: shiftFormula(formula.start, columnDelta, rowDelta, snapshot),
      end: shiftFormula(formula.end, columnDelta, rowDelta, snapshot),
    };
  if (formula.type === "binary")
    return {
      ...formula,
      left: shiftFormula(formula.left, columnDelta, rowDelta, snapshot),
      right: shiftFormula(formula.right, columnDelta, rowDelta, snapshot),
    };
  if (formula.type === "unary")
    return {
      ...formula,
      value: shiftFormula(formula.value, columnDelta, rowDelta, snapshot),
    };
  if (formula.type === "call")
    return {
      ...formula,
      args: formula.args.map((argument) =>
        shiftFormula(argument, columnDelta, rowDelta, snapshot),
      ),
    };
  if (formula.type === "array")
    return {
      ...formula,
      rows: formula.rows.map((row) =>
        row.map((value) =>
          shiftFormula(value, columnDelta, rowDelta, snapshot),
        ),
      ),
    };
  return formula;
}
