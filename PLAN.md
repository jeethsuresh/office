# Office implementation plan

## Intent

A fresh Bun monorepo at `~/js/office`, inspired by rss's Electron + Go packaging. One responsive React application runs in a browser or inside Electron. A document is an ordered collection of independently editable doc, canvas, and slides blocks. Go owns durable workspace metadata and WebSocket sessions; Yjs owns concurrent content.

## Work sequence

- [x] Inspect rss, available tooling, and applicable instructions.
- [x] 1. Scaffold Bun workspaces, TypeScript, Vite, Go, Electron, build/dev/package scripts, and a fresh Git repository.
- [x] 2. Implement folder/document persistence and durable WebSocket rooms in Go; verify restart recovery and room isolation.
- [x] 3. Implement shared Yjs block/slide/shape models, browser persistence, reconnect, presence, and concurrent-edit tests.
- [x] 4. Build the responsive document shell: collapsible folders, document names/timestamps, block navigation with adjacent previews and insertion, color minimap with slide subdivisions.
- [x] 5. Build doc editor with left controls, rich text, markdown shortcuts/import/export, and collaborative cursors.
- [x] 6. Build canvas with left tools, drawing/selection/dragging, shapes, text, pan/zoom, undo, and shared element state.
- [x] 7. Build horizontal slides, extensible title/content layout registry, reusable doc/canvas slide content, and presentation mode.
- [x] 8. Bundle Go + UI inside Electron; verify desktop lifecycle, web deployment output, mobile profiles, accessibility, and multiplayer end to end.
- [x] 9. Document commands, architecture, extension points, collaboration protocol, tested results, and explicit limitations; reconcile every requested feature.

## Architectural decisions

- `apps/web`: browser entry and Vite configuration; same UI served by Go in production.
- `apps/desktop`: sandboxed Electron wrapper; spawns Go on a retained loopback port, serves the bundled UI, owns lifecycle.
- `packages/model`: Yjs document schema and mutation helpers; no React or transport dependencies.
- `packages/collaboration`: binary WebSocket provider + awareness + IndexedDB; no editor dependencies.
- `packages/ui`: application shell and independent editors; doc/canvas reused inside slide layouts.
- `backend`: metadata store + append-only CRDT journal + WebSocket room relay. Go need not reinterpret rich text or merge binary Yjs updates; replay is idempotent and commutative.
- Folder metadata is transactional server data; all block order, text, slide content and shapes are CRDT data. New documents start empty (no racing client-side demo seeding).
- Start with two slide layouts registered by ID, with a documented extension contract.
- Drawing tools use SVG and pointer events rather than a heavyweight embedded whiteboard; provide an infinite-workspace experience and per-shape CRDT fields.

## Acceptance / verification

- Fresh install, typecheck, production web/Electron build, Go tests + race detector, meaningful CRDT convergence tests.
- Two real browser clients edit the same document, receive presence and changes, reconnect after offline edits, and retain data across a backend restart.
- Desktop binary launches its bundled Go server and renderer and terminates owned server on quit.
- Desktop and narrow mobile viewport checks cover sidebar, tool placement, minimap, insertion, slide scrolling, rich text, canvas drawing, and persistent document metadata.

## Progress log

- 2026-10-11: Inspected rss. Its current desktop uses stdin/stdout IPC; Office deliberately uses HTTP/WebSockets for the requested common desktop/web/mobile server architecture. rss instructions are reference material only and are not inherited by this new repo.

- 2026-10-11: Scaffolding, backend, shared models, all editors, and responsive shell implemented. Typecheck and production build pass. Five CRDT model tests pass; Go server/store tests pass under the race detector. Browser QA found and prompted repair of stale-catalog document navigation; mobile checks pass. Continuing real-client collaboration, packaged Electron, and restart checks before marking verification complete.

- 2026-10-11: Native Electron lifecycle and Go restart tests pass. Native package was generated. Packaging runner fixed after observing Bun flag-order behavior. Reconnect now compares remote-only state before sending a delta, so opening an unchanged document does not change its timestamp. Electron retains its loopback port to preserve the IndexedDB origin across relaunches; adding a dedicated unsent-offline-edit relaunch test.

- 2026-10-11: Final macOS bundle and icon built. Typecheck, five CRDT model tests, seven Go race tests, and all six acceptance tests pass. Native tests ran against the packaged executable. Verified unsent offline edits survive a full Electron relaunch and that unchanged-document joins preserve updated time. README, architecture, protocol, and verification records are complete. All requested initial features are implemented.

## Known boundaries to revisit after the first release

- Shared server mode is a trusted-workspace MVP, without accounts/permissions or Internet deployment automation.
- CRDT journal compaction, folder CRDT/offline metadata mutations, advanced drawing tools, native mobile shells, and more slide layouts are future work.
