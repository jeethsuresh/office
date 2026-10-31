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

Open `http://YOUR_COMPUTERS_LAN_IP:4317` on both devices. Use the same server origin; a copied loopback URL is local to the device that opens it. Mobile browsers get the compact profile automatically, including a two-row header with the focused editor’s tools, horizontal slides, and the right-side minimap. The Office logo opens the workspace browser. Browser content is cached in IndexedDB and reconnects automatically; folder operations require the server.

This initial shared-server mode has no accounts or access controls. It is intended for local use and trusted-network collaboration. Internet hosting/authentication and native mobile packages are outside this release.

## Build a desktop bundle

```sh
bun run package:dir  # unpacked native app for this OS and architecture
bun run package      # macOS DMG / Windows NSIS / Linux AppImage
```

Output is under `apps/desktop/release/`. The app includes the compiled Go executable and production web assets; no Bun, Go, or external web server is required to run the bundle. Builds target the current host architecture; build Go for the target platform before cross-platform packaging. macOS distribution signing/notarization requires a configured signing identity; local bundles can be built without one.

## Use the workspace

Office now includes **Sheet** blocks and persistent cross-document references. See [spreadsheet and reference APIs](docs/spreadsheets-and-references.md) for the model, formula semantics, and supported boundaries.

- Organize documents in nested, collapsible folders. Create, rename, move, search, and delete documents and folders. Nonempty folders must be emptied before deletion.
- Click the **Office** logo to browse the workspace. The sidebar automatically hides while browsing and resumes its document preference when a document opens. Open folders/documents, use breadcrumbs or browser history to move around, and switch between a list and icons. Sort by name, type, or updated time in either direction; view and sort preferences persist. Item menus rename, move, or delete; new items start in the current folder. Cmd/Ctrl+K focuses folder search here.
- Add a **Doc**, **Canvas**, **Slides**, or **Sheet** block from the minimap: choose before/after the selected block or either end of the document. Delete the selected block or undo from the same map controls. Beginning/end add buttons sit close to the editor with a 4px gap, giving document content the remaining space.
- Use the right-hand map or neighboring header bars to navigate between blocks: blue notes, red canvases, yellow slides, green sheets. Above the active editor, a clipped strip shows the previous block's bottom with its header at that edge; below it, another shows the next block's header and beginning. Click a neighboring header to navigate; its icon, title, sequence, and arrow identify the destination, and hover reveals the full title. Previous/next controls also appear in the active header, moving into its overflow menu on narrow blocks. Navigation moves smoothly between the mounted editors and respects reduced motion. Each minimap block occupies one section, with slide markers contained inside their deck. Decks with more than five slides show the current slide centered between two earlier and two later slots. Hover the top/bottom arrows or scroll within the deck to browse other slides; leaving it returns to the current slide. Touch scrolling, arrow taps, and keyboard navigation also work. Vertical scrolling stays inside the active editor. The map fills its available height, and hover/focus reveals complete block and slide titles.
- On wider screens, the map expands to show lightweight previews of headings/text lines, canvas shapes, and slide content. These previews update as collaborators edit. The expanded fullscreen map shows the same structure.
- Drag a block title in the minimap to reorder it. On compact/mobile maps, drag its block number instead. Alt+Up/Down moves a focused block marker with the keyboard; Escape cancels a drag. Hover between blocks to reveal an insertion **+** at that gap (always visible on touch screens). This also works in the expanded fullscreen map. Hover labels appear beside the map.
- Right-click any block in the minimap, or press and hold it on mobile, to open its **Delete block** menu. Shift+F10 or the keyboard menu key also opens it. Confirm the named block before deleting; undo restores its content. Slide markers target their entire deck. The menu works in fullscreen, where deleting the current block focuses a surviving block.
- Hover or focus the presence avatars to see everyone’s name, including people beyond the four visible avatars. Tap on mobile to open the list.
- Doc: rich text, headings, lists, quotes, code, undo/redo, Markdown shortcuts/paste, Markdown insertion and export, shared cursor labels.
- Canvas: rectangle, ellipse, arrow, freehand, text, colors/fill, selection/dragging, labels on shapes, pan/zoom/fit, undo/redo, SVG export, live collaborator pointers. The zoom percentage sits between the zoom-in/out buttons in the left tools; there is no canvas footer. Keyboard shortcuts are V/H/R/O/A/P/T while the workspace is focused; Delete removes selection; Cmd/Ctrl+Z undoes local changes. Use the hand tool to pan on touch screens.
- Sheet: select or edit cells in the grid, use the address/formula bar, enter formulas such as `=SUM(A1:A10)`, paste ranges, fill cells, resize/move columns, insert/move/delete rows and columns, and undo/redo. The local formula worker handles dependencies, errors, cross-sheet formulas, and array spills. The green minimap shows a table preview. Fullscreen and the same grid work on mobile. Production assets and previously loaded documents also reopen offline.
- Type **/link** in a note, slide title/subtitle, canvas text, or spreadsheet formula bar to choose a document, block, heading, slide, pin, or cell. Links emphasize the first few words of the target or a cell's calculated value; hover shows the full title, location/address, and persistent URN. Copy reference controls expose the three-part notation. Create a **Pin (I)** on a canvas to name an anchor and optionally link it; double-click a linked pin to open its target. Block headings show backlinks. Links within a document navigate without leaving fullscreen.
- Each block has an attached, single-row header with its icon, title, copy, undo/redo, whole-block deletion, download, backlinks, and shared last-updated time. On narrow blocks, the hamburger opens a labeled action menu; Escape returns focus, arrow keys move through actions, and clicking outside closes it. The focused editor’s toolbar in the app header deletes the selected text element, shape, slide, or cells. Header actions move into the controls rail while that editor is fullscreen. Downloads use Markdown for notes, SVG for canvases, calculated CSV for sheets, and Office JSON for slide decks.
- Fullscreen: use the expand button beneath the right-hand minimap, or in an individual slide’s header. Notes, canvases, decks, individual slides, and embedded slide content can all fill the screen. Exit with the X at the bottom of the rail or Escape. A compact previous/current/next map sits above X. Hover to expand it over the controls; keyboard activation or a tap also opens it. Navigate to any block or slide without leaving fullscreen, and collapse the map to return to the controls. Editing, selection, and canvas position are retained. Mobile browsers without the native API use the same distraction-free view inside the viewport.
- Slides: the editor and slideshow share one 1280 × 720 (16:9) composition, scaled to fit the available space. Text sizes, wrapping, spacing, and canvas view remain the same when presenting. Edit titles and rich text directly on the slide; choose Note or Canvas in the slide header. Scroll/swipe horizontally or use the carousel/map to change slides. Add and present slides from the header toolbar. Presentation reuses the mounted editors in read-only mode. Use arrows, Space, Page Up/Down, Home, and End to navigate; B blanks the screen, Escape exits, and the fullscreen button uses native fullscreen when supported. Controls show the current slide and progress, trap focus during the show, and restore it afterward.
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
- `packages/spreadsheet`: renderer-independent formula binding/evaluation, pinned SheetXL function sources, and calculation worker.
- `packages/collaboration`: WebSocket transport, reconnects, awareness, IndexedDB persistence.
- `packages/ui`: shell and reusable doc/canvas/slide editors.
- `backend`: Go workspace store, journal persistence, static UI server, WebSocket rooms.
- `scripts`: development, build, packaging, and test orchestration.

See [PLAN.md](PLAN.md) for the maintained checklist, [architecture](docs/architecture.md) for boundaries and extension points, and [collaboration](docs/collaboration.md) for the wire protocol and guarantees, and [verification](docs/verification.md) for the tested results and limits.

### Username sign-in

Sign in by entering your username and pressing **🔥** (or Enter). A bare name
such as `alice` uses the identity server configured by `GRAVITAS_ISSUER`, which
also owns the registration button. The Gravitas deployment uses `gravitas.cool`.
`alice@example.org`, `alice:example.org` and `@alice:example.org` select that
public domain's compatible IAM service over HTTPS. Registration always stays on
the configured default server. Login transactions and app sessions retain the
selected issuer, including subsequent session-revocation checks.

## Responsive web and offline use

The production website is installable and supports saved data offline. See
[the PWA guide](docs/pwa.md) for offline behavior, notification limits, installation,
and repeatable browser checks.

Native desktop builds, automatic publishing and Private Store updates: [DESKTOP_RELEASES.md](DESKTOP_RELEASES.md).
