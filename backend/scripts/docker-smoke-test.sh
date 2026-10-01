#!/usr/bin/env bash
set -Eeuo pipefail

for command in docker curl openssl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command" >&2
    exit 1
  fi
done

if [[ ! ${SMOKE_PORT:-18080} =~ ^[0-9]+$ ]] || (( ${SMOKE_PORT:-18080} < 1 || ${SMOKE_PORT:-18080} > 65535 )); then
  printf 'SMOKE_PORT must be an available TCP port from 1 to 65535.\n' >&2
  exit 1
fi

project="backend-smoke-$(date +%s)-$$"
port="${SMOKE_PORT:-18080}"
base_url="http://127.0.0.1:${port}"
key="$(openssl rand -hex 32)"
compose=(docker compose --env-file /dev/null -p "$project" -f compose.yaml)
docker_client_env=()
for name in DOCKER_HOST DOCKER_CONTEXT DOCKER_CONFIG DOCKER_TLS_VERIFY DOCKER_CERT_PATH DOCKER_API_VERSION; do
  if declare -p "$name" >/dev/null 2>&1; then
    docker_client_env+=("$name=${!name}")
  fi
done

compose_run() {
  env -i PATH="$PATH" HOME="${HOME:-/tmp}" COMPOSE_DISABLE_ENV_FILE=1 \
    "${docker_client_env[@]}" API_PORT="$port" \
    ConnectionStrings__MigrationDb='Server=127.0.0.1,1;Connect Timeout=1;Encrypt=False' \
    Jwt__SigningKey="$key" "${compose[@]}" "$@"
}

cleanup() {
  local status=$?
  trap - EXIT
  if ! compose_run down --volumes --remove-orphans >/dev/null 2>&1; then
    printf 'Smoke-test cleanup failed for Compose project %s.\n' "$project" >&2
    (( status == 0 )) && status=1
  fi
  exit "$status"
}
trap cleanup EXIT

compose_run config -q
compose_run build api
compose_run up -d api

ready=false
for attempt in {1..30}; do
  readiness_status=$(curl --silent --max-time 2 --output /dev/null --write-out '%{http_code}' "$base_url/api/auth/session" || true)
  if [[ "$readiness_status" == 401 ]]; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  printf 'API did not become ready at %s.\n' "$base_url" >&2
  compose_run logs --no-color api >&2 || true
  exit 1
fi

session_status=$(curl --silent --max-time 5 --output /dev/null --write-out '%{http_code}' "$base_url/api/auth/session")
if [[ "$session_status" != 401 ]]; then
  printf 'Expected unauthenticated session HTTP 401; got %s.\n' "$session_status" >&2
  exit 1
fi
printf 'Unauthenticated session: HTTP %s (expected 401).\n' "$session_status"

logout_status=$(curl --silent --max-time 5 --output /dev/null --write-out '%{http_code}' --request POST "$base_url/api/auth/logout")
if [[ "$logout_status" != 204 ]]; then
  printf 'Expected logout HTTP 204; got %s.\n' "$logout_status" >&2
  exit 1
fi
printf 'Logout: HTTP %s (expected 204).\n' "$logout_status"
