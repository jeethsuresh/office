import { test, expect } from "bun:test";
import * as Y from "yjs";
import {
  addBlock,
  editSheetAxis,
  cellID,
  cellPosition,
  DocumentAPI,
  sheetAxis,
  addSlide,
  moveSlide,
  orderedSlides,
  makeUndoManager,
  slideMoves,
  ensureHeadingIDs,
  documentTargets,
  resolveTarget,
  parseURN,
  putShape,
} from "@office/model";
import {
  FormulaEngine,
  bindFormula,
  formatFormula,
  shiftFormula,
  formulaInfo,
  type SheetSnapshot,
  type WorkbookSnapshot,
} from "@office/spreadsheet";
function workbook() {
  const doc = new Y.Doc(),
    block = addBlock(doc, "sheet", 0, "Budget"),
    api = new DocumentAPI("doc", doc);
  const snapshot = (): WorkbookSnapshot => ({
    sheets: [
      {
        document: "doc",
        block: block.get("id"),
        name: block.get("title"),
        rows: sheetAxis(block, "rows"),
        columns: sheetAxis(block, "columns"),
        cells: block.get("cells").toJSON(),
      },
    ],
    targets: {},
    epoch: Date.UTC(2024, 0, 1),
  });
  const write = (column: number, row: number, input: string) => {
    const state = snapshot();
    api.transact([
      {
        type: "cell.set",
        block: block.get("id"),
        identifier: cellID(block, column, row)!,
        input,
        formula: bindFormula(input, state.sheets[0], state),
      },
    ]);
  };
  const value = (engine: FormulaEngine, column: number, row: number) =>
    engine.calculate(snapshot()).values[
      `doc:${block.get("id")}:${cellID(block, column, row)}`
    ]?.value;
  return { doc, block, api, snapshot, write, value };
}
test("SheetXL bindings calculate cascades, ranges, conditionals, lookup, text, dates, and errors", () => {
  const w = workbook(),
    engine = new FormulaEngine();
  expect(formulaInfo.implemented).toBeGreaterThan(350);
  w.write(0, 0, "10");
  w.write(0, 1, "20");
  w.write(1, 0, "=SUM(A1:A2)");
  w.write(2, 0, "=B1*2");
  expect(w.value(engine, 2, 0)).toBe(60);
  w.write(0, 0, "15");
  expect(w.value(engine, 2, 0)).toBe(70);
  for (const [input, expected] of [
    ["=AVERAGE(A1:A2)", 17.5],
    ['=IF(A1>5,UPPER("hello"),1/0)', "HELLO"],
    ['=SUMIF(A1:A2,">15")', 20],
    ["=DATE(2024,1,1)", 45292],
    ["=IFERROR(1/0,99)", 99],
    ["=XLOOKUP(20,A1:A2,{8;9})", 9],
    ["=1/0", "#DIV/0!"],
    ["=UNKNOWN(1)", "#NAME?"],
  ] as const) {
    w.write(3, 0, input);
    expect(w.value(engine, 3, 0)).toBe(expected);
  }
  w.api.destroy();
  w.doc.destroy();
});
test("cycles terminate and nondependent formulas keep their cached results", () => {
  const w = workbook(),
    engine = new FormulaEngine();
  w.write(0, 0, "5");
  w.write(1, 0, "=A1*2");
  w.write(2, 0, "=SUM(1,2)");
  expect(engine.calculate(w.snapshot()).evaluated).toBe(3);
  w.write(0, 0, "6");
  const changed = engine.calculate(w.snapshot());
  expect(changed.evaluated).toBe(2);
  w.write(3, 0, "=E1");
  w.write(4, 0, "=D1");
  expect(w.value(engine, 3, 0)).toBe("#CYCLE!");
  expect(w.value(engine, 1, 0)).toBe(12);
  w.api.destroy();
  w.doc.destroy();
});
test("dynamic arrays spill, support spill references, and reject collisions", () => {
  const w = workbook(),
    engine = new FormulaEngine();
  w.write(0, 0, "=SEQUENCE(3,2)");
  w.write(3, 0, "=SUM(A1#)");
  let calculation = engine.calculate(w.snapshot());
  expect(
    calculation.values[`doc:${w.block.get("id")}:${cellID(w.block, 1, 2)}`]
      .value,
  ).toBe(6);
  expect(w.value(engine, 3, 0)).toBe(21);
  w.write(0, 1, "occupied");
  expect(w.value(engine, 0, 0)).toBe("#SPILL!");
  w.api.destroy();
  w.doc.destroy();
});
test("cross-sheet formulas and URN references retain identity through row/column moves and deletion/undo", () => {
  const w = workbook(),
    engine = new FormulaEngine();
  w.write(0, 0, "25");
  w.write(1, 1, "=A1*2");
  const inputID = cellID(w.block, 0, 0)!,
    formulaID = cellID(w.block, 1, 1)!,
    inputURN = `doc:${w.block.get("id")}:${inputID}`;
  const before = w.snapshot().sheets[0].cells[formulaID].formula!;
  const undo = makeUndoManager([
    w.block.get("rows"),
    w.block.get("rowMoves"),
    w.block.get("columns"),
    w.block.get("columnMoves"),
  ]);
  editSheetAxis(w.block, "rows", "move", 0, 2);
  expect(cellPosition(w.block, inputID)).toEqual([0, 2]);
  expect(formatFormula(before, w.snapshot())).toBe("=(A3*2)");
  expect(
    engine.calculate(w.snapshot()).values[
      `doc:${w.block.get("id")}:${formulaID}`
    ].value,
  ).toBe(50);
  expect(resolveTarget(w.doc, parseURN(inputURN)!, "Document")?.label).toBe(
    "A3",
  );
  undo.stopCapturing();
  editSheetAxis(w.block, "rows", "delete", 2);
  expect(
    engine.calculate(w.snapshot()).values[
      `doc:${w.block.get("id")}:${formulaID}`
    ].value,
  ).toBe("#REF!");
  undo.undo();
  expect(resolveTarget(w.doc, parseURN(inputURN)!, "Document")?.label).toBe(
    "A3",
  );
  const second: SheetSnapshot = {
    document: "doc",
    block: "other",
    name: "Forecast",
    rows: ["r"],
    columns: ["c"],
    cells: {},
  };
  const snapshot = w.snapshot();
  snapshot.sheets.push(second);
  second.cells["r~c"] = {
    input: "='Budget'!A3+REF(\"" + inputURN + '")',
    formula: bindFormula(
      "='Budget'!A3+REF(\"" + inputURN + '")',
      second,
      snapshot,
    ),
  };
  expect(engine.calculate(snapshot).values["doc:other:r~c"].value).toBe(50);
  w.block.set("title", "Renamed budget");
  snapshot.sheets[0].name = "Renamed budget";
  expect(formatFormula(second.cells["r~c"].formula!, snapshot)).toContain(
    "'Renamed budget'!A3",
  );
  undo.destroy();
  w.api.destroy();
  w.doc.destroy();
});
test("large-range calculations run locally and concurrent cell writes/moves converge", () => {
  const w = workbook();
  const state = w.snapshot(),
    sheet = state.sheets[0];
  sheet.rows = Array.from({ length: 10000 }, (_, index) => `r${index}`);
  sheet.cells = {};
  for (let row = 0; row < 10000; row++)
    sheet.cells[`r${row}~${sheet.columns[0]}`] = { input: "1" };
  const input = "=SUM(A1:A10000)";
  sheet.cells[`r0~${sheet.columns[1]}`] = {
    input,
    formula: bindFormula(input, sheet, state),
  };
  expect(
    new FormulaEngine().calculate(state).values[
      `doc:${sheet.block}:r0~${sheet.columns[1]}`
    ].value,
  ).toBe(10000);
  w.write(0, 0, "7");
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(w.doc));
  const peerAPI = new DocumentAPI("doc", peer);
  const peerBlock = peerAPI.readBlock(w.block.get("id"))!;
  editSheetAxis(w.block, "rows", "move", 0, 3);
  peerAPI.transact([
    {
      type: "cell.set",
      block: peerBlock.get("id"),
      identifier: cellID(peerBlock, 1, 0)!,
      input: "9",
    },
  ]);
  const a = Y.encodeStateAsUpdate(w.doc),
    b = Y.encodeStateAsUpdate(peer);
  Y.applyUpdate(w.doc, b);
  Y.applyUpdate(peer, a);
  expect(sheetAxis(w.block, "rows")).toEqual(sheetAxis(peerBlock, "rows"));
  expect(w.block.toJSON()).toEqual(peerBlock.toJSON());
  peerAPI.destroy();
  peer.destroy();
  w.api.destroy();
  w.doc.destroy();
});
test("heading and slide targets have durable identities with lazy labels", () => {
  const doc = new Y.Doc(),
    block = addBlock(doc, "doc"),
    fragment = block.get("content") as Y.XmlFragment;
  const heading = new Y.XmlElement("heading"),
    text = new Y.XmlText();
  text.insert(0, "A heading");
  heading.insert(0, [text]);
  fragment.insert(0, [heading]);
  ensureHeadingIDs(doc);
  const id = heading.getAttribute("officeID");
  ensureHeadingIDs(doc);
  expect(heading.getAttribute("officeID")).toBe(id);
  const copy = new Y.XmlElement("heading");
  copy.setAttribute("officeID", id!);
  fragment.insert(0, [copy]);
  ensureHeadingIDs(doc);
  expect(heading.getAttribute("officeID")).toBe(id);
  expect(copy.getAttribute("officeID")).not.toBe(id);
  text.insert(0, "Renamed ");
  expect(
    documentTargets(doc, "doc", "Office").find(
      (target) => target.identifier === id,
    )?.label,
  ).toBe("Renamed A heading");
  const deck = addBlock(doc, "slides"),
    slide = addSlide(deck, "content");
  const originalID = slide.get("id");
  moveSlide(deck, originalID, orderedSlides(deck)[0].get("id"));
  expect(orderedSlides(deck)[0]).toBe(slide);
  expect(
    documentTargets(doc, "doc", "Office").find(
      (target) => target.identifier === originalID,
    )?.detail,
  ).toContain("Slide 1");
  doc.destroy();
});
test("fill translates relative references while fixed references and stable targets stay intact", () => {
  const w = workbook(),
    state = w.snapshot();
  const original = bindFormula("=$A1+B$2+$C$3", state.sheets[0], state)!;
  expect(formatFormula(shiftFormula(original, 2, 3, state), state)).toBe(
    "=(($A4+D$2)+$C$3)",
  );
  w.api.destroy();
  w.doc.destroy();
});
test("changeset batches validate before any write, and volatile random functions are reproducible across clients", () => {
  const w = workbook();
  expect(() =>
    w.api.transact([
      {
        type: "cell.set",
        block: w.block.get("id"),
        identifier: cellID(w.block, 0, 0)!,
        input: "must not commit",
      },
      {
        type: "cell.set",
        block: "missing",
        identifier: "missing",
        input: "bad",
      },
    ]),
  ).toThrow();
  expect(w.block.get("cells").size).toBe(0);
  w.write(0, 0, "=RAND()+RAND()");
  const snapshot = w.snapshot();
  expect(new FormulaEngine().calculate(snapshot)).toEqual(
    new FormulaEngine().calculate(snapshot),
  );
  w.write(1, 0, "=ISERROR(1/0)");
  expect(w.value(new FormulaEngine(), 1, 0)).toBe(true);
  w.api.destroy();
  w.doc.destroy();
});
test("the shared record API updates pins and slide text without replacing shared content or identities", () => {
  const doc = new Y.Doc(),
    api = new DocumentAPI("doc", doc),
    canvas = addBlock(doc, "canvas"),
    deck = addBlock(doc, "slides");
  putShape(canvas.get("shapes"), {
    id: "pin",
    kind: "pin",
    x: 10,
    y: 20,
    width: 40,
    height: 56,
    color: "#6d947d",
    fill: "none",
    text: "Anchor",
  });
  const slide = orderedSlides(deck)[0],
    title = slide.get("title");
  api.transact([
    {
      type: "record.set",
      block: canvas.get("id"),
      identifier: "pin",
      field: "link",
      value: `doc:${deck.get("id")}:${slide.get("id")}`,
    },
    {
      type: "record.set",
      block: deck.get("id"),
      identifier: slide.get("id"),
      field: "title",
      value: "Changed through the API",
    },
  ]);
  expect(api.readRecord(canvas.get("id"), "pin")?.get("link")).toContain(
    slide.get("id"),
  );
  expect(slide.get("title")).toBe(title);
  expect(title.toString()).toBe("Changed through the API");
  expect(() =>
    api.transact([
      { type: "record.set", block: deck.get("id"), field: "slides", value: [] },
    ]),
  ).toThrow();
  api.destroy();
  doc.destroy();
});
