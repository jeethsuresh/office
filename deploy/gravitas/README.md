# Office on Gravitas

The existing Go server and React web client run at `https://work.gravitas.cool`.
The image contains production web assets and the original Go server; it runs as
UID 10001 with a read-only root, no capabilities or Kubernetes API token, health
probes, and matching 100m CPU / 256Mi requests and limits.

One replica with Recreate owns the retained 20Gi data volume. The Service is
ClusterIP. Network policy accepts app connections only from Traefik, so the
public authentication gate cannot be bypassed through another namespace. The
app's original same-origin checks and WebSocket transport remain in place.

Office has no native accounts or tenant isolation. The `office-auth` Traefik
Middleware protects every public route (including WebSockets) with Basic auth
over TLS. Its bcrypt users file is in `office/office-auth`, managed separately
from Git and CI. Everyone granted this credential shares the workspace; this is
not a multi-tenant account system. Auth is stripped before proxying to the app.

The `Gravitas` GitHub workflow runs Go and frontend tests, publishes an immutable
AMD64 GHCR image, and deploys from `main` using the namespace-scoped
`gravitas` environment credential. Set repository variable
`GRAVITAS_DEPLOY_ENABLED=true` after bootstrap. `bootstrap.json` requires an
administrator; app CI cannot modify RBAC, Secrets or shared ingress resources.

`deploy.sh` checks the target cluster, renders only a digest-pinned image, waits
for readiness, validates public TLS and requires an unauthenticated request to
return 401. Public image pulls require no registry password. See the RSS
repository's `deploy/gravitas/README.md` for the shared wildcard TLS, delegated
DNS validation, namespace permissions, rotation and backup procedures.

Real deployment verification covered authenticated API access, an Office
WebSocket update and acknowledgement, persisted journal replay after pod
replacement, and retained document metadata. Temporary test documents were
removed afterward. Store backups must include both workspace metadata and
journals consistently; quiesce the process before copying them. Retention alone
is not a backup, and no offsite backup schedule is currently configured.
