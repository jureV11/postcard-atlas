# Instructions for AI agents

This project's rules are in [CLAUDE.md](CLAUDE.md); they apply to every agent, whatever
tool you are. Read it first, then the spec in [docs/spec/](docs/spec/README.md), which
says what each feature does, the rules it must keep and why.

## Live Atlas deployment

Read [HOSTING.md](HOSTING.md#atlas-server-with-rootless-podman) before server work.
Connect with `ssh atlas@t.alexmagnus.uk` and work in `/mnt/docker/postcard-atlas`.
The live stack runs as `atlas` using rootless Podman and the installed Docker Compose provider.
For an authorized deployment, run `./scripts/deploy-rootless.sh` from that directory.
The account has no general sudo or host Docker access.

All live-server work is confined to `/mnt/docker/postcard-atlas` and the documented
Atlas rootless stack. Treat the rest of the server as infrastructure provided by the owner.
Do not modify or attempt to repair host configuration, accounts, packages, networking,
SSH, proxies, or other services. Report infrastructure problems to the owner and let the
owner resolve them. Do not use sudo or the host Docker daemon.
Honor the current task's scope, including any read-only restriction. Existing authorization
in the conversation applies to the requested server work.
