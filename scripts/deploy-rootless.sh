#!/bin/sh
set -eu
cd /mnt/docker/postcard-atlas
export PODMAN_COMPOSE_PROVIDER=/usr/libexec/docker/cli-plugins/docker-compose
podman build --format docker -t localhost/postcard-atlas:latest -f Dockerfile .
exec podman compose --project-name postcard-atlas --env-file .env -f docker-compose.yml -f compose.podman.yml up -d --no-build --wait
