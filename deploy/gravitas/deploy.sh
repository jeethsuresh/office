#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${1:?Pass the ghcr.io image digest}"
server="$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')"
[[ "$server" == 'https://02fe9a55-8048-421e-a03f-eae9a4a60472.k8s.ondigitalocean.com' ]] || { echo 'Refusing an unexpected cluster' >&2; exit 1; }
python3 render.py "$1" | kubectl apply --server-side --field-manager=gravitas-deploy -f -
kubectl -n office rollout status deployment/office --timeout=300s
# Certificate validation stays enabled. An untrusted certificate fails release verification.
status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' https://work.gravitas.cool/api/workspace)"
[[ "$status" == '401' ]] || { echo "Expected authentication challenge, got $status" >&2; exit 1; }
