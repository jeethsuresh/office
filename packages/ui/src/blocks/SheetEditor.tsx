import { useCallback, useEffect, useRef, useState } from "react";
import DataEditor, {
  GridCellKind,
  CompactSelection,
  type GridCell,
  type GridSelection,
  type Item,
  type DataEditorRef,
  type EditableGridCell,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  Table2,
  Rows3,
  Columns3,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Undo2,
  Redo2,
  Link2,
  ExternalLink,
} from "lucide-react";
import {
  cellID,
  cellPosition,
  cellAddress,
  parseAddress,
  columnLabel,
  sheetAxis,
  editSheetAxis,
  makeUndoManager,
  parseURN,
  type SharedRecord,
  type Target,
} from "@office/model";
import {
  formulaReferences,
  shiftFormula,
  formatFormula,
  type Formula,
} from "@office/spreadsheet/formula";
import type { DocumentSession } from "@office/collaboration";
import { useShared } from "../shared/hooks";
import { useOfficeData, useOfficeRevision } from "../shared/OfficeData";
import { EditorTools, useEditorFullscreen } from "../shared/Fullscreen";
import { ToolButton } from "../shared/Toolbar";
import {
  SlashPopover,
  CopyReference,
  ReferencePicker,
  type SlashState,
} from "../shared/References";
const emptySelection = (): GridSelection => ({
  rows: CompactSelection.empty(),
  columns: CompactSelection.empty(),
});
export function SheetEditor({
  block,
  session,
}: {
  block: SharedRecord;
  session: DocumentSession;
}) {
  useShared(block);
  const data = useOfficeData(),
    revision = useOfficeRevision();
  const blockID = block.get("id") as string,
    fullscreen = useEditorFullscreen(`block:${blockID}`);
  const rows = sheetAxis(block, "rows"),
    columns = sheetAxis(block, "columns");
  const viewport = useRef<HTMLDivElement>(null),
    grid = useRef<DataEditorRef>(null),
    formulaInput = useRef<HTMLInputElement>(null);
  const undo = useRef<ReturnType<typeof makeUndoManager> | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 }),
    [selection, setSelection] = useState<GridSelection>(emptySelection),
    [address, setAddress] = useState("A1"),
    [draft, setDraft] = useState("");
  const [slash, setSlash] = useState<SlashState | null>(null),
    [picker, setPicker] = useState(false);
  const editing = useRef<string | null>(null),
    selected = useRef(cellID(block, 0, 0));
  const position = (selected.current &&
    cellPosition(block, selected.current)) || [0, 0];
  const urn = `${session.id}:${blockID}:${selected.current}`;
  const result = data.calculation.values[urn];
  useEffect(() => {
    undo.current = makeUndoManager([
      block.get("cells"),
      block.get("rows"),
      block.get("columns"),
      block.get("rowMoves"),
      block.get("columnMoves"),
    ]);
    return () => undo.current?.destroy();
  }, [block]);
  useEffect(() => {
    const element = viewport.current!;
    const resize = new ResizeObserver(() =>
      setSize({
        width: Math.max(1, Math.floor(element.clientWidth)),
        height: Math.max(1, Math.floor(element.clientHeight)),
      }),
    );
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  function select(column: number, row: number) {
    const id = cellID(block, column, row);
    if (!id) return;
    selected.current = id;
    setAddress(cellAddress(column, row));
    setSelection({
      ...emptySelection(),
      current: {
        cell: [column, row],
        range: { x: column, y: row, width: 1, height: 1 },
        rangeStack: [],
      },
    });
    if (!editing.current) setDraft(data.formulaText(session.id, blockID, id));
    grid.current?.scrollTo(column, row);
  }
  useEffect(() => {
    if (!editing.current)
      setDraft(
        selected.current
          ? data.formulaText(session.id, blockID, selected.current)
          : "",
      );
  }, [revision, selection]);
  useEffect(() => {
    if (selected.current) {
      const position = cellPosition(block, selected.current);
      if (position) select(...position);
      else select(0, 0);
    }
  }, [rows.join(","), columns.join(",")]);
  useEffect(() => {
    const focus = (event: Event) => {
      const target = (event as CustomEvent<Target>).detail;
      if (
        target.document === session.id &&
        target.block === blockID &&
        target.kind === "cell"
      ) {
        const position = cellPosition(block, target.identifier);
        if (position) {
          select(...position);
          formulaInput.current?.focus({ preventScroll: true });
        }
      }
    };
    window.addEventListener("office:focus-target", focus);
    return () => window.removeEventListener("office:focus-target", focus);
  }, [block, session, blockID]);
  const getCell = useCallback(
    ([column, row]: Item): GridCell => {
      const id =
        rows[row] && columns[column] ? `${rows[row]}~${columns[column]}` : null;
      const input = id ? data.formulaText(session.id, blockID, id) : "";
      const result = data.calculation.values[`${session.id}:${blockID}:${id}`];
      return {
        kind: GridCellKind.Text,
        data: input,
        displayData: String(result?.value ?? input),
        allowOverlay: true,
        readonly:
          !!result?.spill && result.spill !== `${session.id}:${blockID}:${id}`,
        themeOverride: result?.error ? { textDark: "#b85c50" } : undefined,
      };
    },
    [block, revision, data, session.id, blockID],
  );
  function write(edits: { location: Item; value: EditableGridCell }[]) {
    data.writeCells(
      session.id,
      blockID,
      edits.flatMap((edit) => {
        const id = cellID(block, ...edit.location);
        return id && edit.value.kind === GridCellKind.Text
          ? [{ identifier: id, input: edit.value.data }]
          : [];
      }),
    );
  }
  function commit() {
    const id = editing.current;
    editing.current = null;
    if (id)
      data.writeCells(session.id, blockID, [{ identifier: id, input: draft }]);
  }
  function axis(
    kind: "rows" | "columns",
    action: "insert" | "delete" | "move",
    before?: number,
  ) {
    undo.current?.stopCapturing();
    editSheetAxis(
      block,
      kind,
      action,
      position[kind === "rows" ? 1 : 0],
      before,
    );
    undo.current?.stopCapturing();
  }
  const currentCell = data.snapshot.sheets.find(
    (sheet) => sheet.document === session.id && sheet.block === blockID,
  )?.cells[selected.current ?? ""];
  const links = formulaReferences(currentCell?.formula);
  return (
    <div
      ref={fullscreen.ref}
      className={`sheet-editor ${fullscreen.className}`}
    >
      <EditorTools
        label="Spreadsheet tools"
        fullscreen={fullscreen}
        fullscreenLabel="Fullscreen spreadsheet"
        className="sheet-tools"
      >
        <ToolButton
          label="Insert row above"
          onClick={() => axis("rows", "insert")}
        >
          <Rows3 size={18} />
        </ToolButton>
        <ToolButton
          label="Insert column before"
          onClick={() => axis("columns", "insert")}
        >
          <Columns3 size={18} />
        </ToolButton>
        <span className="tool-divider" />
        <ToolButton
          label="Move row up"
          disabled={position[1] === 0}
          onClick={() => axis("rows", "move", position[1] - 1)}
        >
          <ArrowUp size={17} />
        </ToolButton>
        <ToolButton
          label="Move row down"
          disabled={position[1] >= rows.length - 1}
          onClick={() => axis("rows", "move", position[1] + 1)}
        >
          <ArrowDown size={17} />
        </ToolButton>
        <ToolButton
          label="Move column left"
          disabled={position[0] === 0}
          onClick={() => axis("columns", "move", position[0] - 1)}
        >
          <ArrowLeft size={17} />
        </ToolButton>
        <ToolButton
          label="Move column right"
          disabled={position[0] >= columns.length - 1}
          onClick={() => axis("columns", "move", position[0] + 1)}
        >
          <ArrowRight size={17} />
        </ToolButton>
        <ToolButton
          label="Delete selected row"
          disabled={rows.length <= 1}
          onClick={() => axis("rows", "delete")}
        >
          <Trash2 size={16} />
        </ToolButton>
        <ToolButton
          label="Delete selected column"
          disabled={columns.length <= 1}
          onClick={() => axis("columns", "delete")}
        >
          <Columns3 size={16} />
        </ToolButton>
        <span className="tool-divider" />
        <ToolButton
          label="Undo spreadsheet"
          onClick={() => undo.current?.undo()}
        >
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton
          label="Redo spreadsheet"
          onClick={() => undo.current?.redo()}
        >
          <Redo2 size={16} />
        </ToolButton>
        <ToolButton
          label="Link selected cell"
          onClick={() => setPicker(!picker)}
        >
          <Link2 size={16} />
        </ToolButton>
        <CopyReference urn={urn} label="Copy cell reference" />
        {links.length > 0 && (
          <ToolButton
            label="Open linked cell target"
            onClick={() => void data.open(links[0])}
          >
            <ExternalLink size={16} />
          </ToolButton>
        )}
      </EditorTools>
      <div className="sheet-content">
        <div className="formula-bar">
          <input
            className="cell-address"
            aria-label="Cell address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                const position = parseAddress(address);
                if (position) select(...position);
                event.currentTarget.blur();
              }
            }}
          />
          <span className="formula-symbol">ƒx</span>
          <input
            ref={formulaInput}
            aria-label="Cell value or formula"
            value={draft}
            placeholder="Value, =SUM(A1:A10), or /link"
            onFocus={() => {
              editing.current = selected.current;
            }}
            onChange={(event) => {
              setDraft(event.target.value);
              const match = /(?:^|\s)(\/\w*)$/.exec(event.target.value);
              const bounds = event.currentTarget.getBoundingClientRect();
              setSlash(
                match
                  ? {
                      query: match[1],
                      from: event.target.value.length - match[1].length,
                      to: event.target.value.length,
                      x: bounds.left,
                      y: bounds.bottom,
                    }
                  : null,
              );
            }}
            onBlur={() => {
              if (!slash) commit();
            }}
            onKeyDown={(event) => {
              if (slash && event.key === "Enter") {
                event.preventDefault();
                fullscreen.ref.current
                  ?.querySelector<HTMLButtonElement>(
                    ".slash-command-list button",
                  )
                  ?.click();
              } else if (event.key === "Enter") {
                commit();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                editing.current = null;
                setDraft(
                  data.formulaText(session.id, blockID, selected.current!),
                );
                event.currentTarget.blur();
              }
            }}
          />
        </div>
        <div
          className="sheet-grid"
          ref={viewport}
          aria-label="Spreadsheet grid"
        >
          {size.width > 1 && (
            <DataEditor
              ref={grid}
              width={size.width}
              height={size.height}
              columns={columns.map((id, index) => ({
                id,
                title: columnLabel(index),
                width: block.get("columnWidths")?.[id] ?? 120,
              }))}
              rows={rows.length}
              rowMarkers="both"
              getCellContent={getCell}
              getCellsForSelection={true}
              gridSelection={selection}
              onGridSelectionChange={(next) => {
                setSelection(next);
                if (next.current) {
                  selected.current = cellID(block, ...next.current.cell);
                  setAddress(cellAddress(...next.current.cell));
                }
              }}
              onCellsEdited={(edits) => {
                write([...edits]);
                return true;
              }}
              onPaste={true}
              fillHandle={true}
              onFillPattern={(event) => {
                event.preventDefault();
                const source = event.patternSource,
                  destination = event.fillDestination;
                const sheet = data.snapshot.sheets.find(
                  (sheet) =>
                    sheet.document === session.id && sheet.block === blockID,
                )!;
                const edits: {
                  identifier: string;
                  input: string;
                  formula?: Formula | null;
                }[] = [];
                for (
                  let row = destination.y;
                  row < destination.y + destination.height;
                  row++
                )
                  for (
                    let column = destination.x;
                    column < destination.x + destination.width;
                    column++
                  ) {
                    if (
                      row >= source.y &&
                      row < source.y + source.height &&
                      column >= source.x &&
                      column < source.x + source.width
                    )
                      continue;
                    const sourceColumn =
                        source.x +
                        ((((column - source.x) % source.width) + source.width) %
                          source.width),
                      sourceRow =
                        source.y +
                        ((((row - source.y) % source.height) + source.height) %
                          source.height);
                    const id = cellID(block, column, row),
                      from = cellID(block, sourceColumn, sourceRow);
                    if (!id || !from) continue;
                    const cell = sheet.cells[from],
                      formula = cell?.formula
                        ? shiftFormula(
                            cell.formula,
                            column - sourceColumn,
                            row - sourceRow,
                            data.snapshot,
                          )
                        : null;
                    edits.push({
                      identifier: id,
                      input: formula
                        ? formatFormula(formula, data.snapshot)
                        : (cell?.input ?? ""),
                      formula,
                    });
                  }
                data.writeCells(session.id, blockID, edits);
              }}
              onRowAppended={() => {
                editSheetAxis(block, "rows", "insert", rows.length);
              }}
              onRowMoved={(start, end) => {
                undo.current?.stopCapturing();
                editSheetAxis(block, "rows", "move", start, end);
                undo.current?.stopCapturing();
              }}
              onColumnMoved={(start, end) => {
                undo.current?.stopCapturing();
                editSheetAxis(block, "columns", "move", start, end);
                undo.current?.stopCapturing();
              }}
              onColumnResize={(column, width) =>
                block.set("columnWidths", {
                  ...block.get("columnWidths"),
                  [column.id!]: width,
                })
              }
              theme={{
                accentColor: "#6d947d",
                accentLight: "#edf2eb",
                bgCell: "#fffdf8",
                bgHeader: "#f5f4ef",
                textDark: "#535748",
                textMedium: "#949889",
                borderColor: "#e8e6dc",
                fontFamily: "Inter, system-ui, sans-serif",
                baseFontStyle: "13px",
                headerFontStyle: "500 12px",
              }}
            />
          )}
        </div>
        <div className="sheet-status">
          <span>
            {rows.length} rows · {columns.length} columns
          </span>
          <output aria-label="Selected cell result">
            {cellAddress(...position)}: {String(result?.value ?? "")}
          </output>
          <span>
            {data.error ||
              (data.calculating ? "Calculating…" : "Calculated locally")}
          </span>
        </div>
      </div>
      {picker && (
        <div className="sheet-link-picker">
          <ReferencePicker
            onClose={() => setPicker(false)}
            onSelect={(target) => {
              data.writeCells(session.id, blockID, [
                { identifier: selected.current!, input: `=REF("${target}")` },
              ]);
              setPicker(false);
            }}
          />
        </div>
      )}
      {slash && (
        <SlashPopover
          state={slash}
          onClose={() => {
            setSlash(null);
            formulaInput.current?.focus();
          }}
          onLink={(target) => {
            editing.current = null;
            data.writeCells(session.id, blockID, [
              { identifier: selected.current!, input: `=REF("${target}")` },
            ]);
            setSlash(null);
          }}
        />
      )}
    </div>
  );
}
