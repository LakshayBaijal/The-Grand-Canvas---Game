# deploy/

Scripts for running the server on a Linux VM. The plain-words walkthrough
that uses them is `GOING-LIVE.md` at the repo root.

- `setup-vm.sh <domain>` — one-time setup of a fresh Ubuntu VM: Node 24,
  Caddy (free HTTPS), the server as a system service, nightly backups.
  Safe to re-run.
- `update.sh` — pull the latest code, rebuild, restart.
- `backup.sh` — consistent copy of the database into `~/backups`.
