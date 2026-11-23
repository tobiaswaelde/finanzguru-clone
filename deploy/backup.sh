#!/usr/bin/env bash
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
umask 077
python3 - "$root" <<'PY'
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
import os
import re
import sqlite3
import sys
import time

data = Path(sys.argv[1]) / "data" / "api"
source = data / "app.db"
if not source.is_file():
    raise SystemExit("No app.db found; no backup created.")
directory = data / "backup"
directory.mkdir(mode=0o700, exist_ok=True)
stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
backup = directory / f"app-{stamp}.db"
with NamedTemporaryFile(prefix=".app-backup-", dir=directory, delete=False) as temp:
    pending = Path(temp.name)
try:
    with closing(sqlite3.connect(f"{source.as_uri()}?mode=ro", uri=True)) as live, \
         closing(sqlite3.connect(pending)) as copy:
        live.backup(copy)
        if copy.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
            raise RuntimeError("SQLite backup failed quick_check")
    with pending.open("rb") as file:
        os.fsync(file.fileno())
    pending.replace(backup)
finally:
    pending.unlink(missing_ok=True)

cutoff = time.time() - 7 * 24 * 60 * 60
for entry in directory.iterdir():
    if (re.fullmatch(r"app-\d{8}T\d{12}Z\.db", entry.name)
        and not entry.is_symlink() and entry.is_file() and entry.stat().st_mtime < cutoff):
        entry.unlink(missing_ok=True)
print(f"SQLite backup saved: {backup.relative_to(data)}")
PY
