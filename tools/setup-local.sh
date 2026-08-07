#!/usr/bin/env bash
#
# Build a locally-runnable copy of the game.
#
# index.html loads React, ReactDOM, Tone, Babel and Tailwind from CDNs on first
# page load. Sandboxes and CI often cannot reach those hosts, which leaves the
# boot shim showing "A library failed to load" and nothing else. This script
# vendors the five libraries into .local-test/vendor/ and writes
# .local-test/index.local.html, which is index.html with the five <script src>
# URLs repointed at those local files.
#
#   bash tools/setup-local.sh      # vendor + patch (idempotent)
#   node tools/smoke.mjs           # then: boot + play smoke test
#
# .local-test/ is gitignored. NEVER commit the patched copy: it is index.html
# with rewritten script tags, and committing it would ship a game that only
# runs on a machine with .local-test/vendor/ next to it.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/.local-test"
VENDOR="$OUT/vendor"

cd "$ROOT"

if [ ! -f index.html ]; then
  echo "setup-local: no index.html at $ROOT — run this from the repo." >&2
  exit 1
fi

mkdir -p "$VENDOR"

# --- 1. vendor the libraries -------------------------------------------------
# Pinned to the exact versions index.html asks the CDNs for, so local and
# production run the same code. If you bump a version in index.html, bump it
# here too or the smoke test stops testing what ships.
REACT_V=18.3.1
REACTDOM_V=18.3.1
BABEL_V=7.24.7
TONE_V=14.7.77

if [ ! -f "$VENDOR/babel.js" ]; then
  echo "setup-local: installing vendor libraries (one time, ~30s)..."
  cat > "$OUT/package.json" <<'JSON'
{ "name": "hollow-edge-local-test", "private": true, "version": "1.0.0" }
JSON
  ( cd "$OUT" && npm install --no-audit --no-fund --silent \
      "react@$REACT_V" "react-dom@$REACTDOM_V" \
      "@babel/standalone@$BABEL_V" "tone@$TONE_V" \
      "@tailwindcss/browser" )

  NM="$OUT/node_modules"
  cp "$NM/react/umd/react.production.min.js"          "$VENDOR/react.js"
  cp "$NM/react-dom/umd/react-dom.production.min.js"  "$VENDOR/react-dom.js"
  cp "$NM/@babel/standalone/babel.min.js"             "$VENDOR/babel.js"
  cp "$NM/tone/build/Tone.js"                         "$VENDOR/tone.js"
  cp "$NM/@tailwindcss/browser/dist/index.global.js"  "$VENDOR/tailwind.js"
  echo "setup-local: vendored into .local-test/vendor/"
else
  echo "setup-local: vendor/ present, skipping install"
fi

# --- 2. patch a copy of index.html ------------------------------------------
# Rewrite in node, not sed: the URLs contain '/' and '@' and the failure mode of
# a bad sed here is a silently unpatched tag that then fails to load.
node - "$ROOT/index.html" "$OUT/index.local.html" <<'NODE'
const fs = require("fs");
const [, , src, dest] = process.argv;
let html = fs.readFileSync(src, "utf8");

const MAP = [
  ["https://cdn.tailwindcss.com", "vendor/tailwind.js"],
  ["https://unpkg.com/react@18.3.1/umd/react.production.min.js", "vendor/react.js"],
  ["https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js", "vendor/react-dom.js"],
  ["https://unpkg.com/tone@14.7.77/build/Tone.js", "vendor/tone.js"],
  ["https://unpkg.com/@babel/standalone@7.24.7/babel.min.js", "vendor/babel.js"],
];

let missed = [];
for (const [url, local] of MAP) {
  if (!html.includes(url)) { missed.push(url); continue; }
  html = html.split(url).join(local);
}

// A URL that moved in index.html but not here means the patched copy would
// still reach for the network and boot would fail with a confusing message.
// Fail loudly instead.
if (missed.length) {
  console.error("setup-local: these CDN URLs are no longer in index.html:");
  for (const m of missed) console.error("  " + m);
  console.error("Update the MAP in tools/setup-local.sh to match index.html.");
  process.exit(1);
}

// Leftover absolute CDN script srcs = something new was added upstream.
const stray = [...html.matchAll(/<script[^>]*src="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
if (stray.length) {
  console.error("setup-local: unvendored remote script(s) still in the page:");
  for (const s of stray) console.error("  " + s);
  console.error("Add them to the MAP in tools/setup-local.sh.");
  process.exit(1);
}

fs.writeFileSync(dest, html);
console.log("setup-local: wrote .local-test/index.local.html");
NODE

echo "setup-local: ready — run 'node tools/smoke.mjs'"
