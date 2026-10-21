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
`gravitas` environment credential. Set repository variable
`GRAVITAS_DEPLOY_ENABLED=true` after bootstrap. `bootstrap.json` requires an
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

`GRAVITAS_REQUIRED=true`, the pinned HTTPS issuer/app URL, and `GRAVITAS_SESSION_KEY`
from `office-runtime` select hosted authentication. The 32-byte base64url key
persists across deployments and encrypts host-only Secure/HttpOnly transaction
and eight-hour session cookies. Tokens are exchanged server-side and discarded
after fetching the stable identity; IAM cookies and passwords stay at IAM.
State/PKCE, issuer pinning, CSRF checks and authenticated WebSocket handshakes and closure at session expiry are
verified in tests. Local app logout leaves IAM signed in; an app session has its
own lifetime, independent of IAM logout/grant revocation.

Public-origin service workers never cache workspace/session API responses. The
local loopback desktop/development mode retains its existing offline behavior.
Egress permits DNS and HTTPS to the shared IAM ingress (including its Traefik
backend after service translation); update this policy if the load balancer IP
changes. The app's private ClusterIP is reachable only through Traefik.

Deployment applies the native authentication guard first and waits for
`/api/readyz` before removing the former edge Basic-auth annotation. This endpoint
exists only in the IAM-capable server. Never roll back to a pre-IAM image with the
edge gate removed; the current readiness check intentionally leaves that image
unready. The obsolete Basic-auth Middleware/Secret can be removed after the live
IAM checks pass. The local desktop server remains usable without IAM on loopback.
