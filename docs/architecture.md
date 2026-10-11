# Architecture

## Runtime

Electron starts `office-server` on a loopback port chosen on the first launch and retained in `desktop-port` and loads the UI from that same server. The Go process announces readiness as one JSON stdout line. In development, Electron starts Go on port 4317 and loads Vite on 5174; Vite proxies `/api` including WebSockets to Go. In production, Go serves built web assets and the APIs from one origin. A standalone browser/mobile session uses exactly the same modules.

The desktop renderer has sandboxing and context isolation enabled, no Node integration, and a minimal preload exposing desktop/platform information. External web links open in the default browser. The shell owns backend shutdown and reports unexpected process exits. No editor depends on Electron.

## Durable state

A workspace directory contains `workspace.json` and `journals/<document-id>.ylog`. Workspace metadata includes a stable workspace ID, folders, and document names/created/updated timestamps. A stable workspace ID also namespaces IndexedDB within that origin. Electron retains the same origin between launches because IndexedDB itself is origin-scoped. Metadata writes use a synced temporary file followed by atomic rename. Go holds a mutex for catalog mutations and rejects folder cycles and deletion of nonempty folders.

Content journals store big-endian length-prefixed Yjs updates. Each record is synced before its WebSocket acknowledgement. Incomplete final records after interrupted writes are truncated on reopening. Complete malformed records are reported, not silently discarded. The welcome snapshot is embedded in Go and installed once per new workspace; clients never race to seed a document.

## Shared schema

`Y.Doc.getArray('blocks')` holds `Y.Map` block records with `id`, `kind`, and `title`.

- Doc: `content: Y.XmlFragment` bound directly to Tiptap/ProseMirror.
- Canvas: `shapes: Y.Map<Y.Map>`; each shape field is a separately merged register. All clients can edit any object simultaneously.
- Slides: `slides: Y.Array<Y.Map>`; each slide has an ID, layout ID, shared title/subtitle (`Y.Text`), `contentKind`, a rich-text fragment, and a shape map.

A content slide retains both content forms and switches the visible editor without clearing either. Each rich-text editor owns its own collaboration history. Canvas undo targets its shape map and only local mutation origins. Block and slide structural undo targets its own collection. Remote mutations do not enter those local undo stacks.

## UI boundaries

`DocEditor` accepts a fragment and session. `CanvasEditor` accepts a shape map, session, and unique scope ID for cursors. Both support compact and read-only rendering. They can be used as document blocks or nested inside a slide layout. `SlidesEditor` owns horizontal navigation and presentation; it delegates rendering to the layout registry. Shell modules own the folder tree, document navigator, metadata forms, minimap, and block insertion.

The mobile profile activates at 760px. It uses a drawer sidebar and narrower rails/map while preserving all editor functionality. The same document and CRDT structures are used in both profiles.

## Add a slide layout

1. Add a component accepting `SlideProps` in `packages/ui/src/blocks/slideLayouts.tsx` or a separate file.
2. Register `{label, component}` under a stable string ID in `slideLayouts`. The layout picker and add controls derive from this registry.
3. Initialize any new shared types in `createSlide()` in `packages/model`. Use `Y.Text` for collaboratively edited text, `Y.Map` for fields, and `Y.Array` for ordered collections.
4. Keep layout state inside the shared slide record; leave viewport, selection, and tool choices local to the UI.
5. Preserve older field names or introduce an explicit schema migration when changing persisted records.

No switch statement needs to change to register an additional slide layout.

## Deliberate MVP boundaries

- Folder/document catalog operations use server transactions rather than a CRDT and need a live connection. Their names use last-write-wins server mutations.
- The Go server relays opaque Yjs bytes. It does not interpret the editor schema, enforce content permissions, or compact journals. Very long-lived journals need compaction and quotas before large-scale hosting.
- Collaboration is one process with local disk persistence, not a replicated service. Back up the whole data directory while the server is stopped.
- Canvas has one-object selection and translation; multi-select, resizing, image/media imports, grouping, and connector attachment are future extensions. It is an original SVG editor with an Excalidraw-style workflow, not the Excalidraw engine.
- Rich text supports common Markdown, not every Markdown dialect. Slides do not export PPTX; notes export Markdown and drawings export SVG.
- Mobile is a responsive browser profile, not a native iOS/Android application. Offline editing is available after loading a document; cold loading the entire website without a server is not supplied by a service worker.
