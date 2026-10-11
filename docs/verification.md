# Verification — 2026-10-11

Verified on macOS arm64 with Bun 1.4.0 and Go 1.25.2.

- Fresh Bun dependency installation and locked workspace resolution: passed.
- `bun run typecheck`: passed.
- `bun test`: five CRDT model tests passed.
- `bun run test:race`: seven Go store/server tests passed under the race detector.
- `bun run build`: production UI, Go executable, Electron main, and sandboxed preload built successfully.
- `bun run package:dir`: native macOS arm64 `apps/desktop/release/mac-arm64/office.app` built with bundled Go/UI and the Office icon. The local development signing identity was discovered by electron-builder; the app was not notarized.
- Twenty Playwright acceptance tests passed, with native tests launched against the rebuilt packaged executable.

The acceptance suite verifies:

1. Native Electron startup, sandbox/context isolation, preload, rendered document, and owned Go process shutdown.
2. Persisted rich text, canvas state, and slide titles after restarting Go.
3. An unsent offline edit surviving a full Electron quit and relaunch, with the same origin. The server journal size is asserted unchanged while the offline edit is made.
4. Folder creation, document creation/rename, Markdown, rich text, drawing, slide layouts/content switches, presentation, insertion, and the minimap.
5. Two independent browser clients with shared presence, live edits, deliberately disconnected WebSockets, independent offline edits, convergence on reconnect, shared block/title updates, and reload recovery. Opening an empty document is asserted not to change its updated timestamp.
6. A 390×844 mobile profile with a drawer sidebar, accessible navigation controls, notes, canvases, horizontal slide navigation, and no horizontal page overflow.
7. Wheel/keyboard block isolation, canvas wheel pan and Ctrl-wheel zoom, explicit previous/next and minimap navigation, and inner scrolling for long notes. Canvas position survives block switches.
8. Fullscreen for notes, canvases, decks, individual slides, and embedded note/canvas content; X/Escape exit; editing retention and identical mounted editor nodes; background focus isolation; nested-dialog Escape priority.
9. Full-height embedded editor/toolbar alignment and top-aligned text at 1400×1000, 390×844, and 844×390. Each profile also verifies the fallback used when native element fullscreen is unavailable.
10. Real Chromium touch gestures: vertical swipes cannot navigate blocks, horizontal swipes snap between slides, and the hand tool pans the canvas.

11. Full-height block sections at desktop/mobile sizes, immediate full-title hover tooltips, and tooltip viewport bounds.
12. Horizontal wheel scrolling from title slides and embedded notes, snapping in both directions and fullscreen, active map/counter updates, and embedded canvas gesture isolation.
13. Compact previous/current/next fullscreen previews; hover expansion that hides the rail controls; keyboard/touch access; an anchored expand/collapse click target; navigation among notes, canvases, decks, individual slides, and embedded editors without leaving fullscreen. Tests assert the native fullscreen host stays identical and emits no exit/re-entry events while navigating, and that the original note DOM node survives.
14. Slide markers contained inside one equally sized deck section, with all five rows visible for short decks. Twelve-slide decks center a five-row window on the current slide, including empty slots at the first/last slides. Wheel and hover browsing leave the active slide unchanged; pointer departure recenters it. Real touch scrolling, arrow taps, keyboard browsing, selection/focus, and navigation in the expanded fullscreen map pass. Desktop/mobile checks assert the map stays within the viewport without horizontal page overflow.

Native fullscreen verification covers early Escape during the macOS transition, the bottom X, and entry from an already-fullscreen window. A dedicated preload operation waits for the native fullscreen animation, preventing a window-size change from leaving the renderer stuck in fullscreen. Existing collaboration and persistence checks passed after these UI changes.

Browser offline emulation alone did not close existing WebSockets in Electron. The final tests explicitly close both sides of the WebSocket transport and reject new connections during the partition; they assert local-only status and that each peer cannot see the other's edits until reconnecting.

Screenshots and traces are generated under the ignored `test-results/` directory. Native mobile hardware, Windows/Linux bundles, Internet hosting, production auth, notarization, PPTX export, and very large journals were not verified and are not part of this release.
