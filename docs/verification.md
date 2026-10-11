# Verification — 2026-10-11

Verified on macOS arm64 with Bun 1.4.0 and Go 1.25.2.

- Fresh Bun dependency installation and locked workspace resolution: passed.
- `bun run typecheck`: passed.
- `bun test`: five CRDT model tests passed.
- `bun run test:race`: seven Go store/server tests passed under the race detector.
- `bun run build`: production UI, Go executable, Electron main, and sandboxed preload built successfully.
- `bun run package:dir`: native macOS arm64 `apps/desktop/release/mac-arm64/office.app` built with bundled Go/UI and the Office icon. The local development signing identity was discovered by electron-builder; the app was not notarized.
- Six Playwright acceptance tests passed, with native tests launched against the actual packaged executable.

The acceptance suite verifies:

1. Native Electron startup, sandbox/context isolation, preload, rendered document, and owned Go process shutdown.
2. Persisted rich text, canvas state, and slide titles after restarting Go.
3. An unsent offline edit surviving a full Electron quit and relaunch, with the same origin. The server journal size is asserted unchanged while the offline edit is made.
4. Folder creation, document creation/rename, Markdown, rich text, drawing, slide layouts/content switches, presentation, insertion, and the minimap.
5. Two independent browser clients with shared presence, live edits, deliberately disconnected WebSockets, independent offline edits, convergence on reconnect, shared block/title updates, and reload recovery. Opening an empty document is asserted not to change its updated timestamp.
6. A 390×844 mobile profile with a drawer sidebar, accessible navigation controls, notes, canvases, horizontal slide navigation, and no horizontal page overflow.

Browser offline emulation alone did not close existing WebSockets in Electron. The final tests explicitly close both sides of the WebSocket transport and reject new connections during the partition; they assert local-only status and that each peer cannot see the other's edits until reconnecting.

Screenshots and traces are generated under the ignored `test-results/` directory. Native mobile hardware, Windows/Linux bundles, Internet hosting, production auth, notarization, PPTX export, and very large journals were not verified and are not part of this release.
