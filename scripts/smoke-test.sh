#!/usr/bin/env bash
# Smoke test script for notionworker proxy
# Usage: ./scripts/smoke-test.sh [base_url]
# Example: ./scripts/smoke-test.sh http://localhost:8787
#          ./scripts/smoke-test.sh https://testsite.example.com

set -euo pipefail

BASE_URL="${1:-http://localhost:8787}"
PASS=0
FAIL=0

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }
bold() { printf '\033[1m%s\033[0m\n' "$1"; }

check() {
  local desc="$1"
  local url="$2"
  local expected_status="${3:-200}"
  shift 3
  local checks=("$@")

  printf "  %-50s " "$desc"

  local tmpfile
  tmpfile=$(mktemp)
  local status
  status=$(curl -sS -o "$tmpfile" -w '%{http_code}' -L "$url" 2>/dev/null) || {
    red "FAIL (curl error)"
    FAIL=$((FAIL + 1))
    rm -f "$tmpfile"
    return
  }

  if [ "$status" != "$expected_status" ]; then
    red "FAIL (status: $status, expected: $expected_status)"
    FAIL=$((FAIL + 1))
    rm -f "$tmpfile"
    return
  fi

  for pattern in "${checks[@]}"; do
    if ! grep -q "$pattern" "$tmpfile" 2>/dev/null; then
      red "FAIL (missing: $pattern)"
      FAIL=$((FAIL + 1))
      rm -f "$tmpfile"
      return
    fi
  done

  green "PASS"
  PASS=$((PASS + 1))
  rm -f "$tmpfile"
}

check_redirect() {
  local desc="$1"
  local url="$2"
  local expected_status="$3"
  local expected_location="$4"

  printf "  %-50s " "$desc"

  local headers
  headers=$(curl -sS -D - -o /dev/null "$url" 2>/dev/null) || {
    red "FAIL (curl error)"
    FAIL=$((FAIL + 1))
    return
  }

  local status
  status=$(echo "$headers" | head -1 | grep -o '[0-9]\{3\}')
  if [ "$status" != "$expected_status" ]; then
    red "FAIL (status: $status, expected: $expected_status)"
    FAIL=$((FAIL + 1))
    return
  fi

  if ! echo "$headers" | grep -qi "location:.*$expected_location"; then
    red "FAIL (location header missing: $expected_location)"
    FAIL=$((FAIL + 1))
    return
  fi

  green "PASS"
  PASS=$((PASS + 1))
}

bold "=== Smoke Tests for notionworker proxy ==="
echo "Base URL: $BASE_URL"
echo ""

# --- Test A: Basic site access ---
bold "Test A: Basic site rendering"
check "Homepage returns 200" \
  "$BASE_URL" "200" \
  "notion-app"

check "robots.txt" \
  "$BASE_URL/robots.txt" "200" \
  "sitemap.xml"

check "sitemap.xml" \
  "$BASE_URL/sitemap.xml" "200" \
  "urlset" "xmlns"

# --- Test B: Per-page meta ---
bold "Test B: SEO meta tags"
check "Homepage has title tag" \
  "$BASE_URL" "200" \
  "<title>"

check "Homepage has og:title" \
  "$BASE_URL" "200" \
  'og:title'

# --- Test C: Theme injection ---
bold "Test C: Theme & CSS"
check "CSS custom properties injected" \
  "$BASE_URL" "200" \
  "--nw-font" "--nw-accent"

check "nw-theme style block present" \
  "$BASE_URL" "200" \
  'id="nw-theme"'

# --- Test D: Slug routing ---
bold "Test D: Slug routing"
# These need to be adjusted based on actual seed data slugs
# check_redirect "Slug /about redirects" \
#   "$BASE_URL/about" "301" "/"

# --- Test E: Notion JS rewriting ---
bold "Test E: Notion assets"
# Notion JS assets are loaded dynamically, hard to test via curl
echo "  (Notion JS rewriting requires browser testing)"

# --- Test F: API proxying ---
bold "Test F: API proxying"
# API calls need POST with specific payloads
echo "  (API proxying requires browser testing)"

# --- Summary ---
echo ""
bold "=== Results ==="
green "Passed: $PASS"
if [ "$FAIL" -gt 0 ]; then
  red "Failed: $FAIL"
  exit 1
else
  echo "Failed: 0"
fi
