#!/usr/bin/env bash
# Deploy a folder with the shipsite CLI and report the result to GitHub
# Actions. All settings arrive as environment variables (see action.yml).
set -euo pipefail

fail() {
  echo "::error::$1"
  exit 1
}

is_true() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    true | yes | 1) return 0 ;;
    *) return 1 ;;
  esac
}

[ -n "${INPUT_FOLDER:-}" ] || fail 'The "folder" input is empty. Set it to the folder to deploy, for example: folder: ./dist'
[ -d "$INPUT_FOLDER" ] || fail "The folder \"$INPUT_FOLDER\" does not exist. If a build step creates it, run this action after that step. Paths are relative to the repository root."
[ -n "${SHIPSITE_API_KEY:-}" ] || fail 'The "api-key" input is empty. Add your shipsite.sh API key as a repository secret named SHIPSITE_API_KEY and pass it with: api-key: ${{ secrets.SHIPSITE_API_KEY }}. Secrets are not available to pull requests from forks.'
command -v npx >/dev/null 2>&1 || fail 'Node.js is not installed on this runner. Add a step with actions/setup-node before this action.'

args=("$INPUT_FOLDER" --json)
[ -z "${INPUT_SITE:-}" ] || args+=(--site "$INPUT_SITE")
[ -z "${INPUT_NAME:-}" ] || args+=(--name "$INPUT_NAME")
[ -z "${INPUT_TTL:-}" ] || args+=(--ttl "$INPUT_TTL")
if is_true "${INPUT_PIN:-}"; then args+=(--pin); fi
if is_true "${INPUT_KEEP:-}"; then args+=(--keep); fi

# The password goes through the environment so it never appears in a
# process list, and is masked in the log.
if [ -n "${INPUT_PASSWORD:-}" ]; then
  echo "::add-mask::$INPUT_PASSWORD"
  export SHIPSITE_SITE_PASSWORD="$INPUT_PASSWORD"
fi
if [ -n "${INPUT_API_URL:-}" ]; then
  export SHIPSITE_API_URL="$INPUT_API_URL"
fi

version="${INPUT_CLI_VERSION:-latest}"
case "$version" in
  *[!A-Za-z0-9._-]*) fail "The \"cli-version\" input \"$version\" is not a version. Use a version such as 0.4.0, or latest." ;;
esac

# The CLI prints the site as JSON on stdout and any error on stderr, which
# goes straight to the log.
result="$(npx --yes "shipsite@$version" "${args[@]}")" || fail "The deploy failed. The message above says what went wrong and how to fix it."

# Read the fields with Node, which is present wherever npx is.
field() {
  SITE_JSON="$result" node -e '
    const site = JSON.parse(process.env.SITE_JSON);
    const value = site[process.argv[1]];
    process.stdout.write(value === null || value === undefined ? "" : String(value));
  ' "$1"
}

url="$(field url)"
site_id="$(field id)"
permanent_url="$(field permanent_url)"
expires_at="$(field expires_at)"
[ -n "$url" ] && [ -n "$site_id" ] || fail "The deploy finished but the response had no URL. Response: $result"

{
  echo "url=$url"
  echo "site-id=$site_id"
  echo "permanent-url=$permanent_url"
  echo "expires-at=$expires_at"
} >>"${GITHUB_OUTPUT:-/dev/null}"

{
  echo "### Deployed to shipsite.sh"
  echo
  echo "**URL:** $url"
  echo
  echo "Site ID: \`$site_id\`"
  if [ -n "$expires_at" ]; then echo "Expires: $expires_at"; else echo "Pinned: does not expire"; fi
} >>"${GITHUB_STEP_SUMMARY:-/dev/null}"

echo "Deployed $site_id: $url"
