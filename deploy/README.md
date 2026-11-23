# Portable deployment

This directory runs two prebuilt images with Docker Compose. Use a dedicated deployment directory and keep `compose.yaml`, `.env`, and `backup.sh` together. The API keeps its SQLite database in `./data/api/app.db`; only the web service is published, on `127.0.0.1:3000` by default. For access from another machine, put an HTTPS reverse proxy on the host in front of the loopback listener. Keep `COOKIE_SECURE=true` for HTTPS and do not publish the API.

## First start

1. Copy `.env.example` to `.env`, restrict it to the operator (`chmod 600 .env`), and set `FINANCE_TAG` to a published release or `sha-…` tag present on **both** images. Do not use `latest`. Leave the default fork prefix or point `FINANCE_IMAGE_PREFIX` to another registry namespace using the same `-api` and `-web` suffixes.
2. Set a random `API_SESSION_SECRET` (`openssl rand -hex 32`) and `API_ENCRYPTION_KEY` (`openssl rand -base64 32`). Keep protected copies separately from database backups. Changing the session secret invalidates sessions; losing the encryption key makes encrypted credentials unreadable.
3. If the packages are private, sign in using a GitHub credential with `read:packages` and access to both packages: pass it from a password manager to `docker login ghcr.io -u YOUR_GITHUB_LOGIN --password-stdin`. Public packages do not need a login.
4. Create `data/api` writable by the API image's non-root user (UID/GID 1000 under standard Linux Docker). Example: `sudo install -d -m 0700 -o 1000 -g 1000 data/api`. For rootless Docker or user namespaces, use the mapped identity instead.

From the deployment directory, run:

```bash
docker compose config --quiet
docker compose pull
docker compose run --rm -T --no-deps finance-api node dist/scripts/migrate.js
docker compose run --rm -T --no-deps finance-api node dist/scripts/seed.js
```

Set the owner password via standard input from a trusted password manager or a Bash no-echo prompt:

```bash
read -rs -p 'Owner password: ' owner_password
printf '\n'
printf '%s\n' "$owner_password" | docker compose run --rm -T --no-deps finance-api node dist/scripts/set-password.js
unset owner_password
docker compose up -d --wait --no-build
```

The CLI accepts 12–1024 characters. Do not put the password in `.env`, shell history, or a Compose argument. To verify a disposable loopback-only install over plain HTTP, temporarily set `COOKIE_SECURE=false`; do not carry that setting into an HTTPS deployment.

## Backup and restore

On the host, `bash backup.sh` uses Python 3.8+ with its `sqlite3` module to copy the running database through SQLite's backup API, including committed WAL data. It checks the copy before publishing it, creates files readable only by the backup user, and removes generated snapshots older than seven days. Run it under an account that can read SQLite and access the WAL and backup directory, such as the data directory owner. Schedule it daily in that account's cron, using the actual deployment path:

```cron
15 2 * * * /bin/bash /path/to/deploy/backup.sh
```

Keep an encrypted off-host copy if you need protection against losing the host. Do not restore by copying over an open SQLite database:

1. Choose a backup, copy it somewhere safe, and verify `PRAGMA integrity_check` returns `ok` before changing the live directory (for example, `sqlite3 -readonly /path/to/verified-copy.db 'PRAGMA integrity_check;'`).
2. Stop both services with `docker compose stop`. Move the existing `app.db` and any `app.db-wal` or `app.db-shm` sidecars **together** into a protected recovery directory outside the bind mount.
3. Copy the verified backup to `data/api/app.db` with mode `0600` and the API's mapped owner. Ensure no old sidecars remain there.
4. Start the matching image tag with `docker compose up -d --wait --no-build`. Verify login and representative records. From the repository, `bash deploy/test-backup.sh` exercises restore and retention without touching the deployment.

## Updating and rolling back

Record the current tag and make a verified pre-upgrade backup. Change `FINANCE_TAG`, run `docker compose pull`, stop both services, run the migration command above, then start them with `docker compose up -d --wait --no-build`. Verify health, login and representative totals before reopening access.

To roll back, stop both services and re-pin the previous tag. If you applied migrations and have not verified backward compatibility, restore the pre-upgrade backup before starting it. A restored backup does not contain changes made since it was created; preserve the post-upgrade database separately.

## Validation status

- **V21 (pre-release):** `bash deploy/check-compose.sh` from the repository validates the image references, isolated API port, mount, health checks and loopback binding using placeholders. It does not pull images or start services.
- **Local rehearsal:** The template started with locally tagged images, `--no-build` and `--pull never`. Owner login, online backup and record persistence after container recreation passed with synthetic data. This does not verify the registry or count as V22.
- **V20 (after an approved release, pending):** verify the GHCR release job published both images with the same expected tag.
- **V22 (after V20, pending):** copy the template into a disposable deployment directory; use synthetic credentials, a separate project name and a free loopback port. Pull the pinned images; initialize and start without building. Log in, add a synthetic record, run `docker compose down` then `docker compose up -d --wait --no-build`, and confirm it persisted. Do not run this check against a real installation.
