# Office on Gravitas

The existing Go server and React web client run at `https://work.gravitas.cool`.
The image contains production web assets and the original Go server; it runs as
UID 10001 with a read-only root, no capabilities or Kubernetes API token, health
probes, and matching 100m CPU / 256Mi requests and limits.

One replica with Recreate owns the retained 20Gi data volume. The Service is
ClusterIP. Network policy accepts app connections only from Traefik, so the
public authentication gate cannot be bypassed through another namespace. The
app's original same-origin checks and WebSocket transport remain in place.

Office authenticates through the Gravitas IAM server and creates an app session.
All authenticated users share the existing collaborative workspace; this is not
per-user document tenancy. The former shared Basic-auth gate is retired after
native IAM authentication passes its live checks.

The `Gravitas` GitHub workflow runs Go and frontend tests, publishes an immutable
AMD64 GHCR image, and deploys from `main` using the namespace-scoped
`gravitas` environment credential after bootstrap. Successful pushes to `main` deploy automatically after tests pass. `bootstrap.json` requires an
administrator; app CI cannot modify RBAC, Secrets or shared ingress resources.

`deploy.sh` checks the target cluster, renders only a digest-pinned image, waits
for readiness, validates public TLS and requires an unauthenticated request to
return 401 from the native authentication guard. Public image pulls require no registry password. See the RSS
repository's `deploy/gravitas/README.md` for the shared wildcard TLS, delegated
DNS validation, namespace permissions, rotation and backup procedures.

Real deployment verification covered authenticated API access, an Office
WebSocket update and acknowledgement, persisted journal replay after pod
replacement, and retained document metadata. Temporary test documents were
removed afterward. Store backups must include both workspace metadata and
journals consistently; quiesce the process before copying them. Retention alone
is not a backup, and no offsite backup schedule is currently configured.

## Gravitas federated login

The hosted Office server now protects all workspace APIs and WebSockets with an
app session established through `https://gravitas.cool`. Sign in reuses IAM's
browser session through its custom PKCE S256 protocol; Register opens central
signup and returns through the app callback, preserving IAM's invite/approval
requirements. The public login shell and static assets contain no workspace data.
Office remains a shared collaborative workspace for approved IAM users; this
change does not create separate per-user workspaces.

On startup, `autoSignIn` in the public auth config reflects only IAM's shared
`__Secure-gravitas_signed_in=1` navigation hint. IAM manages that Secure/HttpOnly,
Domain=gravitas.cool, Path=/, SameSite=Lax cookie with the remaining lifetime of
its refresh family (at most 30 days). With no local app session, Office attempts
`prompt=none` once. Validated `consent_required` restarts with interactive consent;
`login_required` and app logout use `auto=off` to stop automatic retries. Safe
document/folder fragments survive the round trip. The marker never authorizes
workspace access. Refresh credentials remain host-only at IAM and are not shared
with Office; app sessions last up to eight hours and remain bound to their IAM family.

`GRAVITAS_REQUIRED=true`, the pinned HTTPS issuer/app URL, and `GRAVITAS_SESSION_KEY`
from `office-runtime` select hosted authentication. The 32-byte base64url key
persists across deployments and encrypts host-only Secure/HttpOnly transaction
and eight-hour session cookies. Access and refresh tokens are exchanged server-side and discarded
after fetching the stable identity; only the encrypted status-only proof remains; IAM cookies and passwords stay at IAM.
State/PKCE, issuer pinning, CSRF checks and authenticated WebSocket handshakes and closure at session expiry are
verified in tests. Local app logout leaves IAM signed in; each app session is bound to the IAM browser family that created it.

Public-origin service workers never cache workspace/session API responses. The
local loopback desktop/development mode retains its existing offline behavior.
Egress permits DNS and HTTPS to the shared IAM ingress (including its Traefik
backend after service translation); update this policy if the load balancer IP
changes. The app's private ClusterIP is reachable only through Traefik.

Deployment applies the native authentication guard first and waits for
`/api/session-readyz` before removing the former edge Basic-auth annotation. This endpoint
exists only in the IAM-capable server. Never roll back to a pre-IAM image with the
edge gate removed; the current readiness check intentionally leaves that image
unready. The obsolete Basic-auth Middleware/Secret can be removed after the live
IAM checks pass. The local desktop server remains usable without IAM on loopback.

## Central logout

The token exchange supplies a confidential status-only proof bound to the IAM
browser family, principal and app grant. Only the encrypted host-only app cookie
retains it. Every protected HTTP request checks the pinned, discovered
`session_check_endpoint`, requiring matching issuer, subject, app origin and family
plus a future expiry. There is no positive status cache. Central logout or grant
revocation returns 401 and denies the next request; network failures, non-401
errors and malformed or mismatched 200 responses return 503 without clearing the
app cookie. Legacy cookies without a family proof require a fresh handshake.

Open tabs check their app session every 15 seconds and on focus/resume. A confirmed
revocation clears the authenticated UI and refreshes the navigation hint before
considering passive sign-in. An IAM outage retains local session state. Own app
logout stays local and works during an IAM outage. Independent browser families
remain signed in, and consent grants are retained after ordinary central logout.

Readiness requires this revocation-aware server. Rollback must use a digest that
implements these checks; do not relax the readiness path to an older image.

Office sockets validate at handshake, every 15 seconds and before each incoming
mutation; revoked sockets close 4401 and temporary failures close 4503. Logout
unmounts the workspace without deleting IndexedDB. Pending initial snapshots
finish before document disposal, so unsent edits can sync after sign-in.

## Private shared deployment tooling

The deployment job checks out `jeethsuresh/gravitas-deploy` at a full commit SHA,
using this repository’s read-only tooling key from the main-only `gravitas`
environment. `.gravitas/deploy.json` selects this app’s existing release script;
its migrations, manifests and public checks remain in this repository. The shared
action checks namespace permissions, exact image digest, readiness and HTTPS,
and removes its temporary kubeconfig on failure or success. Build/test jobs are
unchanged. Review a new tooling pin before updating it. New-app onboarding is
documented in the private tooling repository.

Federated username login permits public HTTPS on port 443. Private, loopback, link-local, metadata and reserved destinations are excluded by NetworkPolicy and the pinned-IP federation client.
