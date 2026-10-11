# Office

A place for connected thoughts. Notes, canvases, and slides live together in one multiplayer document.

Fresh Bun monorepo with a responsive React UI, a Go HTTP/WebSocket backend, and an Electron desktop shell. Inspired by rss's packaging pattern; no code or Git history was copied from rss.

## Start locally

Requires Bun 1.4+, Go 1.25+, and Node 22+ for Electron tooling.

```sh
bun install
bun dev
```

`bun dev` builds Go, starts Vite on port 5174, and launches Electron. Electron owns its Go process and stores data in the OS application-data directory under `Office/workspace`. Closing the last window on macOS preserves the application; quitting Office shuts down Go.

For browser development:

```sh
bun dev:web
# http://127.0.0.1:5174
```

For the compiled app:

```sh
bun run build
bun run desktop
```

For a compiled web server:

```sh
bun run build
bun run start:web
# http://127.0.0.1:4317
```

The standalone web server uses `.office-data/`; desktop uses its own application-data directory. Set `OFFICE_DATA` to choose a different data directory. A new workspace contains a server-initialized welcome document with all three block types. Newly created documents start empty.

## Another browser or device

Share copies the current document URL. Open it in another browser on the same server to edit together. Each participant can choose a name in Share.

To use a phone or another computer on a trusted network:

```sh
OFFICE_LISTEN=0.0.0.0:4317 bun run start:web
```

Open `http://YOUR_COMPUTERS_LAN_IP:4317` on both devices. Use the same server origin; a copied loopback URL is local to the device that opens it. Mobile browsers get the compact profile automatically, including a drawer sidebar, left-side editor tools, horizontal slides, and the right-side minimap. Browser content is cached in IndexedDB and reconnects automatically; folder operations require the server.

This initial shared-server mode has no accounts or access controls. It is intended for local use and trusted-network collaboration. Internet hosting/authentication and native mobile packages are outside this release.

## Build a desktop bundle

```sh
bun run package:dir  # unpacked native app for this OS and architecture
bun run package      # macOS DMG / Windows NSIS / Linux AppImage
```

Output is under `apps/desktop/release/`. The app includes the compiled Go executable and production web assets; no Bun, Go, or external web server is required to run the bundle. Builds target the current host architecture; build Go for the target platform before cross-platform packaging. macOS distribution signing/notarization requires a configured signing identity; local bundles can be built without one.

## Use the workspace

- Organize documents in nested, collapsible folders. Create, rename, move, search, and delete documents and folders. Nonempty folders must be emptied before deletion.
- Add a **Doc**, **Canvas**, or **Slides** block at either end or between existing blocks. Click the previews to jump to neighboring blocks.
- Use the right-hand map or previous/next previews to navigate between blocks: blue notes, red canvases, yellow slides, with a marker for every slide. Vertical scrolling stays inside the active editor; both block previews remain visible. The map fills its available height, and hover/focus reveals complete block and slide titles.
- Doc: rich text, headings, lists, quotes, code, undo/redo, Markdown shortcuts/paste, Markdown insertion and export, shared cursor labels.
- Canvas: rectangle, ellipse, arrow, freehand, text, colors/fill, selection/dragging, labels on shapes, pan/zoom/fit, undo/redo, SVG export, live collaborator pointers. Keyboard shortcuts are V/H/R/O/A/P/T while the workspace is focused; Delete removes selection; Cmd/Ctrl+Z undoes local changes. Use the hand tool to pan on touch screens.
- Fullscreen: use the expand button at the bottom of any editor’s left rail, or in an individual slide’s header. Notes, canvases, decks, individual slides, and embedded slide content can all fill the screen. Exit with the X at the bottom of the rail or Escape. A compact previous/current/next map sits above X. Hover to expand it over the controls; keyboard activation or a tap also opens it. Navigate to any block or slide without leaving fullscreen, and collapse the map to return to the controls. Editing, selection, and canvas position are retained. Mobile browsers without the native API use the same distraction-free view inside the viewport.
- Slides: scroll horizontally with the trackpad/wheel or swipe; the track snaps to each slide and updates the map/counter. Previous/next controls and slide markers also navigate horizontally. Add a title or content layout, switch layouts, add a note or canvas to a content slide, and present using arrow keys and Escape. Switching content mode preserves the note and drawing.
- Cmd/Ctrl+K opens document search. Edits save automatically. Offline content merges when the connection returns.

## Verify

```sh
bun run typecheck
bun test
bun run test:backend
bun run test:race
bun run build
bunx playwright install chromium
bun run test:e2e
```

`bun test` runs the model tests; `bun run test` also runs the Go tests. Browser tests use temporary documents under `.office-data/e2e/`. Restart and Electron tests create and remove their own temporary workspaces. `OFFICE_BROWSER_PATH` can select an already installed Chromium executable. The native Electron test currently targets macOS; it is skipped on other hosts. `OFFICE_PACKAGED_PATH` selects the packaged executable for that same startup/shutdown test.

The acceptance checks cover two real browser clients, offline text convergence, presence, block propagation, rich text/Markdown, canvas drawing, slide layouts/presentation, mobile navigation, metadata, replay beyond the send-buffer capacity, crash-tail recovery, native startup/shutdown, and persisted content across a Go restart.

## Code map

- `apps/web`: Vite entry point and build configuration.
- `apps/desktop`: sandboxed Electron wrapper and packaging resources.
- `packages/model`: Yjs schema and mutations, independent of React and networking.
- `packages/collaboration`: WebSocket transport, reconnects, awareness, IndexedDB persistence.
- `packages/ui`: shell and reusable doc/canvas/slide editors.
- `backend`: Go workspace store, journal persistence, static UI server, WebSocket rooms.
- `scripts`: development, build, packaging, and test orchestration.

See [PLAN.md](PLAN.md) for the maintained checklist, [architecture](docs/architecture.md) for boundaries and extension points, and [collaboration](docs/collaboration.md) for the wire protocol and guarantees, and [verification](docs/verification.md) for the tested results and limits.
