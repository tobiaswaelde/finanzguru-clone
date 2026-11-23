#!/usr/bin/env bash
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
python3 - "$root" <<'PY'
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
import os
import shutil
import sqlite3
import subprocess
import sys
import time

with TemporaryDirectory(prefix="finance-test-backup-") as temporary:
    work = Path(temporary)
    script = work / "backup.sh"
    shutil.copyfile(Path(sys.argv[1]) / "backup.sh", script)
    data = work / "data" / "api"
    backups = data / "backup"
    backups.mkdir(parents=True)
    old = backups / "app-20000101T000000000000Z.db"
    recent = backups / "app-20000102T000000000000Z.db"
    unrelated = backups / "operator-copy.db"
    for path, days in ((old, 8), (recent, 6), (unrelated, 20)):
        path.touch()
        mtime = time.time() - days * 86400
        os.utime(path, (mtime, mtime))

    with closing(sqlite3.connect(data / "app.db")) as live:
        assert live.execute("PRAGMA journal_mode=WAL").fetchone() == ("wal",)
        live.execute("PRAGMA wal_autocheckpoint=0")
        live.execute("CREATE TABLE booking (id INTEGER PRIMARY KEY, cents INTEGER NOT NULL)")
        live.execute("INSERT INTO booking VALUES (1, 2362)")
        live.commit()
        assert (data / "app.db-wal").stat().st_size > 0
        live.execute("INSERT INTO booking VALUES (2, 999)")  # Uncommitted; must not appear.
        subprocess.run(["bash", script], cwd=work.parent, check=True)
        assert live.execute("SELECT COUNT(*) FROM booking").fetchone() == (2,)
        live.rollback()

    assert not old.exists() and recent.is_file() and unrelated.is_file()
    copy, = [p for p in backups.glob("app-*.db") if p != recent]
    assert copy.stat().st_mode & 0o777 == 0o600
    assert not list(backups.glob(".app-backup-*"))
    restored = work / "restored.db"
    shutil.copyfile(copy, restored)
    with closing(sqlite3.connect(restored)) as db:
        assert db.execute("PRAGMA integrity_check").fetchall() == [("ok",)]
        assert db.execute("SELECT * FROM booking").fetchall() == [(1, 2362)]
print("Restore, SQLite integrity, WAL snapshot isolation and retention passed.")
PY
