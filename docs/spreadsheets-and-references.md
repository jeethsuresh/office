# Spreadsheets and references

Office keeps one authoritative document model: Yjs, persisted locally through IndexedDB and synchronized to the existing Go journal. Spreadsheet inputs, formulas, row/column identities, headings, pins, and links live in that model. Calculated values are local caches and are never synchronized as editable cell content.

## Formula runtime

Glide Data Grid is the spreadsheet renderer on desktop, mobile, web, and Electron. `packages/spreadsheet` owns syntax binding, evaluation, dependency caches, cycle detection, dynamic-array spills, and the worker protocol. The renderer submits changes through the same `DocumentAPI` facade used for shared records; it does not own calculation or storage.

The installed `@sheetxl/formulas@0.7.27` package exports an empty initializer and `formulaCount = 0`. Office generates standalone bindings for 356 implemented functions from the upstream MIT formula sources at commit `0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5`. Office supplies a range/context adapter and common conditional aggregation/lookup/array compatibility functions. No commercial SheetXL SDK or workbook model is used. The pinned source, upstream notices, and regeneration script are included. See [the upstream entry point](https://github.com/sheetxl/sheetxl/blob/0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5/packages/formulas/src/index.ts) and [formula package](https://github.com/sheetxl/sheetxl/tree/0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5/packages/formulas).

Cells accept text, numbers, booleans, formulas beginning with `=`, and literal text beginning with `'`. The adapter handles arithmetic, comparisons, concatenation, fixed/relative A1 references, ranges, quoted sheet names, functions, array literals, and spill references such as `A1#`. A worksheet is a spreadsheet block; other spreadsheet blocks in the same document can be referenced by title, for example `='Budget'!A1`. `=REF("document:block:identifier")` reads a stable cross-block or cross-document target. A linked cell publishes its calculated value to document chips and canvas pins through the Office data facade.

On edit, references are bound to persistent cell identities in a serialized formula tree. The formula bar derives current A1 addresses and sheet names from that tree, so row/column moves, insertion, and renaming do not retarget formulas. Fill translates relative coordinates while retaining dollar-fixed coordinates. Row/column deletion leaves references unresolved with `#REF!`; undo restores the original identities and values. Empty cell identities are derived from their persistent row/column pair, so linking an empty cell does not create a competing random ID.

The worker caches values and records dependencies while evaluating. Changed inputs invalidate downstream caches; evaluation follows dependencies and reports cycles with `#CYCLE!`. Structural changes invalidate layout-dependent caches. Array spills are reproducible derived values; occupied or out-of-bounds destinations return `#SPILL!`. Worker responses are versioned so an older calculation cannot replace a newer one. The worker is terminated when its document scope is disposed, along with foreign-document subscriptions.

Date interpretation uses the Excel serial-date convention and explicit calendar conversion. ISO date strings are supported. `NOW`/`TODAY` use the request's UTC minute timestamp. Random functions use a seed from canonical document inputs and the calling cell, making unchanged states reproducible across clients. An unrelated edit invalidates volatile results. Calculations do not make network requests.

The adapter is a spreadsheet foundation, not complete modern Excel parity. Named ranges/tables, iterative calculations, LAMBDA/LET execution, external workbook files, macros, Excel's entire formatting language, and XLSX import/export are not implemented. Hidden/unimplemented upstream functions and network-dependent functions are omitted. Formula text is limited to 20,000 characters, evaluation depth to 512 cells, and a materialized range/spill to 100,000 cells. The UI starts with 100 rows and 12 columns and can insert more. Errors remain visible per cell. Full function compatibility is not inferred from the binding count; the verification suite exercises the supported integration semantics.

## Persistent references

The stored notation is `<document>:<block>:<identifier>`, with each component URI-encoded. `urn:office:` is accepted as an optional input prefix. Actual references use IDs, never human titles or slide indexes.

- `document:_:_` targets a document.
- `document:block:_` targets a block.
- Doc headings have a persisted `officeID` attribute. Initial IDs are derived from the shared Yjs item identity, avoiding competing random migrations. Copying a heading creates a distinct anchor; reordering blocks does not change its ID.
- Slides use their existing persisted slide ID. Movement replays an append-only placement log while retaining the same shared slide record, text, and embedded content.
- Canvas pins use a persisted shape ID and may also hold an outgoing `link`. Pins can be named, moved, linked, and focused from another block.
- Cells use `rowID~columnID`, with row/column placements tracked separately from those identities.

Human labels are resolved lazily from current shared state: document/block titles, heading text, slide position/title, pin name, and cell address/value. Renaming or moving a target updates the rendered label and hover path without rewriting every referring document. Deleted targets remain explicit missing references instead of silently pointing elsewhere. URL fragments carry document/block/target IDs and support reloads and browser history.

`/link` opens an extensible slash-command surface. Its picker searches documents, blocks, headings, slides, pins, and populated cells. Searching a sheet name plus an address, such as `Budget A1`, also locates empty cells. Keyboard arrows/Enter/Escape and touch activation are supported. Rich-text references are atomic Tiptap nodes; slides have link chips; pins have outgoing references; cells use `REF`. Backlinks are computed from the loaded shared documents and expanded on demand.

Foreign documents are loaded through observe-only collaboration sessions. They reuse the existing WebSocket/IndexedDB transports and do not add fictitious presence avatars. Updates to a foreign cell flow through its changeset subscription, the worker, and the referring renderer. Loading is bounded to four documents at a time; all observers and pending loads are released when the scope closes.

## API boundaries

`DocumentAPI` provides stable record reads, validated transactional operations, and after-transaction changeset subscriptions. Cell edits use `cell.set` with a persistent identifier, authoritative input, and bound formula tree. `record.set` updates fields while preserving immutable IDs. Rich-text and shape adapters continue using their native shared types; the same after-transaction subscription observes their edits. The Go protocol and durable journal remain unchanged.

`OfficeData` composes document APIs, target enumeration/resolution, backlinks, foreign sessions, and derived worker results. Its subscription drives renderers; consumers do not depend on Glide to read a cell. `packages/model` exposes reference parsing, formatting, target enumeration, resolution, and structural mutations independently of React. `packages/spreadsheet` accepts plain snapshots and produces plain calculated values/errors independently of UI and networking.

## Offline operation

Production builds include a versioned service worker that precaches the app, formula worker, and lazy grid editors. Read-only workspace metadata and page assets can fall back to their cache; write requests are never served from a cache. Authoritative edits remain durable in IndexedDB and replay through the existing collaboration transport when connectivity returns. Previously cached documents can be reopened and recalculated without Go or Internet access. Opening content that has never been loaded requires a connection. Browser storage retention still depends on the browser; native mobile hardware is not covered by the acceptance suite.
