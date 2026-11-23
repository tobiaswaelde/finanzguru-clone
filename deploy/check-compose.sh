#!/usr/bin/env bash
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
compose=(docker compose --env-file "$root/.env.example" -f "$root/compose.yaml")
unset FINANCE_IMAGE_PREFIX FINANCE_TAG FINANCE_WEB_PORT COOKIE_SECURE API_SESSION_SECRET API_ENCRYPTION_KEY

check() {
  local prefix=$1 tag=$2 port=$3
  "${compose[@]}" config --format json | python3 -c '
import json
from pathlib import Path
import sys

model = json.load(sys.stdin)
root, prefix, tag, port = sys.argv[1:]
services = model["services"]
assert set(services) == {"finance-api", "finance-web"}
assert list(model["networks"]) == ["finance"]
net = model["networks"]["finance"]
assert net["driver"] == "bridge" and not net.get("internal")
for component in ("api", "web"):
    svc = services[f"finance-{component}"]
    assert "build" not in svc and svc["image"] == f"{prefix}-{component}:{tag}"
    assert list(svc["networks"]) == ["finance"] and svc["healthcheck"]["test"]
api, web = services["finance-api"], services["finance-web"]
assert not api.get("ports")
mount, = api["volumes"]
assert mount["type"] == "bind" and mount["target"] == "/data"
assert Path(mount["source"]) == Path(root) / "data" / "api"
assert not mount.get("read_only")
binding, = web["ports"]
assert str(binding["published"]) == port and binding["target"] == 3000 and binding["host_ip"] == "127.0.0.1"
assert web["depends_on"]["finance-api"]["condition"] == "service_healthy"
' "$root" "$prefix" "$tag" "$port"
}

check ghcr.io/tobiaswaelde/finanzguru-clone replace-with-published-tag 3000
FINANCE_IMAGE_PREFIX=ghcr.io/example/finance FINANCE_TAG=sha-fixture FINANCE_WEB_PORT=3999 \
  check ghcr.io/example/finance sha-fixture 3999
printf '%s\n' 'Portable Compose configuration passed (V21).'
