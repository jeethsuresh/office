# Responsive web app and offline support

Office keeps opened document content and edits in the existing Yjs IndexedDB
store. After network failure, offline startup restores the last signed-in account,
loads its scoped workspace list, and opens persisted documents. New edits stay on
the device and merge through the collaboration protocol after reconnecting. A
confirmed unauthorized session or sign-out clears the offline identity; unsent
document drafts remain in IndexedDB for a later valid sign-in. Existing document
persistence names remain compatible, preserving previous local drafts.

Documents must be opened online before offline use. Document edits and new blocks
in an opened document work offline. Creating, moving, renaming, and deleting
workspace documents/folders needs a connection. Browser-local workspace mode
remains available for development.

## Notifications and platform support

Use **App** in the account bar to install the app, request persistent storage,
choose notifications, or apply an available app update. Updates activate only
when requested, so a waiting worker cannot reload an active editor. Browser data
can still be removed by the user; keep independent backups of important work.

Notification permission is requested only after **Enable notifications** is
clicked. The browser creates a Web Push subscription; the server sends encrypted
notifications through the browser's push provider even when the app is closed.
Notifications can be disabled per device. On iPhone/iPad, add the app to the Home
Screen first where required. Delivery still depends on the browser, OS settings,
and connectivity; there is no background polling loop in the page.

Office combines collaborator document edits across the shared workspace into one
activity round per account. It sends one alert after 10 uninterrupted quiet
minutes, or at 30 minutes if activity continues. After the 30-minute alert,
further activity in that round is silent until a 10-minute quiet gap closes it.
Own edits can extend an existing round but cannot start an own-edit alert.

The server persists VAPID keys, subscriptions, activity rounds, daily limits and a
retry outbox in `office-push.json` beside its existing database/data directory.
Keep this private file on the existing persistent volume and include it in
backups. It is atomically replaced with owner-only permissions. No additional
secret configuration is required. Do not delete it during normal deployments:
rotating VAPID keys requires devices to subscribe again.

Subscriptions are bound to the signed-in account. Federated delivery uses a
separate encrypted, notification-only grant and revalidates the central session
family before sending. The grant cannot authenticate app requests. Temporary
authentication/provider failures retry; revoked grants and gone endpoints are
removed. Signing out disables the worker's account gate, unsubscribes the device,
and revokes its server binding. A queued notice for a different account is ignored.
Generic notification text avoids exposing document/article contents on the lock
screen. Push endpoint hosts are restricted to the Chrome, Firefox, Apple and
Windows push services; redirects and arbitrary outbound destinations are rejected.

## Service worker and deployment

The production build contains a manifest, 192px/512px install icons, an Apple touch
icon, and a versioned service worker. Serve from the origin root over HTTPS
(loopback HTTP works for development). Vite development does not register workers.
Only build assets enter the public cache. API, authentication, RPC, event-stream,
and session requests bypass it. Cached HTML is normalized to avoid redirected
responses failing offline navigation in Chromium. Worker/manifest HTTP responses
revalidate. Remote images, fonts, and original websites are not downloaded; text
and app controls remain available using system fonts when necessary.

## Validation

Run the Docker `backend-test` and `frontend-test` targets, then
`bun run build:web` and `bun run backend:build`. With Playwright Chromium installed,
run `bun run test:e2e tests/e2e/pwa.spec.ts`. `OFFICE_BROWSER_PATH` can point to an
existing Chromium binary. Tests cover seven touch viewport shapes, editing across
two offline reloads and reconnect, the federated startup path, revocation, and
opt-in notification permission. Backend tests advance a controlled clock through
quiet and continuous rounds, daily refresh gating, retries, restart persistence,
encrypted Web Push delivery and revocation. Run the existing E2E suite for shared editor and
navigation regression coverage.
