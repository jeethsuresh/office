# Collaboration protocol

Yjs merges all content. The Go service provides persistence and ordering within each WebSocket room; there are no editing locks. Two users can modify the same block, fragment, shape, or slide at once. Concurrent insertions into shared arrays/text are retained; conflicts on a map field use Yjs's deterministic resolution. Deleting a structure removes it even if another participant is editing its content.

## Connection

`GET /api/documents/<id>/ws` upgrades to a WebSocket. Messages are binary: one type byte followed by the payload. This is an Office transport around Yjs V1 updates, not the standard y-websocket framing.

- `0`: Yjs V1 update (`Y.applyUpdate` / `Y.encodeStateAsUpdate`). Both directions.
- `1`: standard `y-protocols/awareness` update. Both directions, never persisted.
- `2`: ready. Server has finished sending the existing journal and registered the client for live updates.
- `3`: acknowledgement. Server has synced the preceding content update to disk.
- `4`: awareness request. Existing clients rebroadcast their local awareness state when a new peer joins.

Hydration and registration hold the same room mutex, so live updates cannot overtake journal replay. Replay applies backpressure and can exceed the live send queue's 256-message capacity. Slow live clients are disconnected and reconnect automatically. Room memory is released after the last active or joining client leaves.

## Reconnect and offline edits

The browser opens its IndexedDB persistence before connecting. Every server update is applied to both the live document and a temporary remote-only document. At ready, the client compares their encoded states. If it has offline edits, it sends only the update missing from the remote state vector (including deletions). If the states match, opening a document emits no content update and does not change its updated timestamp.

While connected, local Yjs updates are forwarded immediately. The server persists, acknowledges the sender, and relays to peers. Incoming updates use a transport origin so they are not echoed. Delivery can repeat after a reconnect; Yjs application is idempotent. If an acknowledgement is lost, the next handshake reconciles against the already persisted update.

Reconnect uses exponential backoff from one second to fifteen seconds, and responds to browser online events. Existing documents remain editable during a disconnect. Status reports `All changes saved` only after the outstanding server acknowledgements have arrived; disconnected status reports local-device storage.

## Presence

Awareness carries user name/color, active block ID, ProseMirror caret/selection, and canvas pointer/scope. Rich-text positions are relative Yjs positions. Awareness expires absent peers, is refreshed when joining, and clears the local state on unload/destroy. Canvas cursor scope prevents a cursor from appearing in a different canvas or slide.

## Server endpoints

- `GET /api/health`
- `GET /api/workspace`
- `POST /api/documents` with `name`, `folderId`
- `PATCH /api/documents/<id>` with optional `name`, `folderId`
- `DELETE /api/documents/<id>`
- `POST /api/folders` with `name`, `parentId`
- `PATCH /api/folders/<id>` with optional `name`, `parentId`
- `DELETE /api/folders/<id>`
- `GET /api/documents/<id>/ws`

The server validates IDs, mutation payloads, parent folders, and folder cycles. Same-origin HTTP/WebSocket clients are allowed; `-allow-origin` permits an additional development origin. Loopback is the default bind address. Shared server mode is a trusted-workspace MVP without accounts, authentication, per-document ACLs, or content/schema validation of opaque Yjs payloads.

The append-only journal and metadata files are single-process storage. Do not run multiple Go processes against one data directory. HTTP startup, journal-recovery failures, and disk-write failures are surfaced; the service does not acknowledge updates it cannot persist.
