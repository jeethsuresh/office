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

## Navigation and fullscreen refinement — 2026-10-11

- [x] Reproduce the content-slide note/toolbar rendering defect and identify its layout cause.
- [x] Capture wheel/touch/keyboard scrolling within editors; restrict block and slide navigation to the minimap and explicit previous/next controls. Keep both adjacent block previews visible.
- [x] Add reusable distraction-free fullscreen for notes, canvases, slide decks, individual slides, and embedded note/canvas content. Preserve the mounted editor and local viewport; keep the exit X at the bottom of the controls rail and support Escape.
- [x] Fix embedded editor sizing and text alignment across desktop and mobile.
- [x] Verify scroll isolation, fullscreen entry/exit, editing retention, layout bounds, existing collaboration, and packaged Electron behavior. Rebuild the native app and update documentation.

The embedded editor and toolbar had independent 310px height caps inside a taller slide body. Removed those caps and made the viewport/child sizing explicit. Block selection now uses a fixed viewport with inactive blocks hidden/inert; slides move only through explicit controls, with inactive cards inert. Canvas wheel handling uses a non-passive native listener. Fullscreen promotes the existing editor subtree, with a viewport fallback for unsupported mobile browsers.

- Verification checkpoint: all 12 acceptance checks pass against the source build, including native element fullscreen entry/Escape/X and entry from an already-fullscreen window; touch pan/swipe capture; desktop, portrait, and short landscape bounds; editor identity/content retention; collaboration/reconnect; and backend restart. Five model tests and seven Go race tests pass. macOS fullscreen exits now wait for the native Space animation to finish. Rebuilding the final package and running acceptance checks against that executable.

- Final result: all 12 acceptance checks pass with native tests running against the rebuilt `apps/desktop/release/mac-arm64/office.app/Contents/MacOS/office`. Typecheck, production build, five model tests, and seven Go race tests pass. README and architecture/verification notes are updated. Existing workspaces are preserved; the refreshed welcome copy only applies to newly created workspaces. Quit/reopen the running app to load the new native bundle.

## Minimap and slide navigation refinement — 2026-10-11

- [x] Make the document minimap distribute its blocks/slide markers across all available height and show full titles on hover/focus.
- [x] Restore horizontal wheel/trackpad/touch slide scrolling with sticky snapping; keep vertical block navigation captured and canvas gestures isolated. This supersedes the earlier slide-scroll lock.
- [x] Add a compact current/previous/next navigator above the fullscreen exit X. Hover, keyboard activation, or tap expands the complete map over the controls.
- [x] Keep a stable fullscreen host while navigating among blocks and slides, including embedded editors, so navigation never exits fullscreen.
- [x] Verify normal/fullscreen scrolling, hover titles, fullscreen navigation and exit, mobile/touch access, collaboration, and the rebuilt Electron package; update documentation.

- Implementation checkpoint: full-height proportional markers and immediate full-title tooltips are implemented. Native slide snapping restores horizontal wheel/touch motion and updates the map/counter after scrolling settles. Fullscreen uses a stable shared host, keeping each editor mounted while the map changes the focused block or slide. Desktop and mobile navigation checks pass. Visual inspection caught a hover expansion replacing the compact button under the pointer with a slide marker; the expand/collapse button now stays anchored above X. Rechecking that click behavior and the rebuilt native package.

- Final result: all 17 acceptance tests pass against the rebuilt packaged Electron executable and web/mobile UI. Typecheck, production/package build, and five model tests pass. Native navigation asserts a stable fullscreen host with no exit/re-entry events, and keyboard focus follows the selected slide. The native test waits for the actual fullscreenchange entry event before counting navigation events; reading fullscreenElement alone could occur before the entry notification. README, architecture, and verification notes are updated. Temporary preview processes are stopped. Quit/reopen Office to load the rebuilt bundle.

## Grouped slide minimap — 2026-10-11

- [x] Give every block one minimap section, with slide markers contained inside a single deck outline instead of separate full-size sections.
- [x] Limit decks longer than five slides to a centered five-row viewport (two before/current/two after), with hover scrolling, wheel/touch access, and keyboard controls for the remaining slides.
- [x] Reuse the grouped deck in the normal and expanded fullscreen maps, keeping full titles, active slide selection, and fullscreen sessions intact.
- [x] Verify short/long decks, beginning/end positions, hover/scroll/touch navigation, full-height layout, and the rebuilt Electron package; update docs.

- Implementation checkpoint: one equal-weight section per block now contains the deck header and its slide rows. Decks with more than five slides center the selected row with two slots on either side; empty slots keep the first and last slides centered. Hovering the edge arrows browses the remaining slides, as do wheel, touch, and keyboard scrolling. Leaving the map recenters the current slide. Three dedicated acceptance tests pass across desktop, mobile, and expanded fullscreen. These checks also caught and fixed intrinsic editor width pushing the map outside the viewport and fractional hover-scroll movement stopping animation. Rebuilding the native bundle and running the complete suite before pushing.

- Final verification: typecheck, production/native package build, and all 20 acceptance tests pass. Native tests used the rebuilt packaged executable; existing fullscreen, horizontal snapping, collaboration, restart, and offline persistence checks also pass. Visual inspection confirms slide markers stay within the single deck outline in normal and expanded fullscreen views. README, architecture, and verification records are updated. Publish the completed change to the user-authorized `origin/main` at `https://github.com/jeethsuresh/office.git`; quit/reopen Office to load the rebuilt bundle.
