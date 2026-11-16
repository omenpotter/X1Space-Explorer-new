#!/usr/bin/env bash
# Full verification pass. Writes docs/upgrade/verify-log.txt.
# Needs network access to the public X1 RPC, XDEX and geojs.io, and a Chromium for Playwright.
set -u
cd "$(dirname "$0")/.."
LOG=docs/upgrade/verify-log.txt
: > "$LOG"
step() { echo; echo "=== $1 ===" | tee -a "$LOG"; }
run() { local name="$1"; shift; step "$name"; "$@" >> "$LOG" 2>&1; local rc=$?; echo "[$name] exit $rc" | tee -a "$LOG"; return 0; }

echo "commit: $(git rev-parse HEAD)" | tee -a "$LOG"
echo "date: $(date -u +%FT%TZ)" | tee -a "$LOG"

run "eslint"            npx eslint .
run "typecheck"         npm run typecheck
run "production build"  npm run build
run "unit + contract tests" npx vitest run
step "npm audit (all)";  npm audit 2>&1 | tail -25 >> "$LOG"
step "npm audit (production)"; npm audit --omit=dev 2>&1 | tail -25 >> "$LOG"

pkill -f "vite preview --port 4173" 2>/dev/null; pkill -f "dev-functions-server" 2>/dev/null; sleep 1
(npx vite preview --port 4173 --host 127.0.0.1 > /tmp/preview.log 2>&1 &)
(NODE_USE_ENV_PROXY=1 npx vite-node -c vitest.config.js scripts/dev-functions-server.ts > /tmp/functions.log 2>&1 &)
sleep 8
run "live smoke"        env NODE_USE_ENV_PROXY=1 LIVE=1 npx vitest run tests/live/smoke.test.ts
run "live accuracy"     env NODE_USE_ENV_PROXY=1 LIVE=1 npx vitest run tests/live/accuracy.test.ts --disable-console-intercept --reporter=verbose
run "browser suite"     env NODE_USE_ENV_PROXY=1 node tests/e2e/run.mjs
run "detail routes"     env NODE_USE_ENV_PROXY=1 node tests/e2e/detail.mjs
run "X1 View"           env NODE_USE_ENV_PROXY=1 node tests/e2e/x1view.mjs
run "keyboard audit"     env NODE_USE_ENV_PROXY=1 node tests/e2e/keyboard.mjs
run "SEO metadata"      env NODE_USE_ENV_PROXY=1 node tests/e2e/seo.mjs
run "performance and RPC cost" env NODE_USE_ENV_PROXY=1 PERF_WINDOW_MS=45000 node tests/e2e/perf.mjs
run "network/credential audit" env NODE_USE_ENV_PROXY=1 node tests/e2e/network.mjs
step "bundle credential scan"
{ grep -rlE "fbx_[0-9a-f]{20,}|api-key=[A-Za-z0-9]{16,}|X1_NINJA_API_KEY|x1_[A-Za-z0-9]{20,}" dist || echo "no credential patterns in dist"; find dist -name '*.map' | wc -l | sed 's/^/source maps in dist: /'; } >> "$LOG" 2>&1
pkill -f "vite preview --port 4173" 2>/dev/null; pkill -f "dev-functions-server" 2>/dev/null
echo "DONE" >> "$LOG"
