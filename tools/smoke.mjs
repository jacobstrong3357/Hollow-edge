/**
 * Boot + play smoke test for Hollow's Edge.
 *
 *   bash tools/setup-local.sh && node tools/smoke.mjs
 *   node tools/smoke.mjs --headed     # watch it run
 *
 * What it proves: the ~12k-line single file parses under Babel, mounts, and
 * gets from the gate into a live run without throwing. index.html has no build
 * step and no unit tests, so a JSX typo or a bad reference is invisible until
 * something renders it. This is the cheapest way to catch that.
 *
 * What it does NOT prove: layout. The vendored Tailwind is v4 while production
 * loads the v3 CDN, so spacing and some utilities differ here. Trust this for
 * "does it run", never for "does it look right".
 *
 * Exit code is 0 only if the page booted, mounted, entered a run, and logged
 * no page errors.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, ".local-test");
const PAGE = join(DIR, "index.local.html");
const HEADED = process.argv.includes("--headed");

if (!existsSync(PAGE)) {
  console.error("smoke: .local-test/index.local.html missing — run 'bash tools/setup-local.sh' first.");
  process.exit(1);
}

// Playwright is installed globally in this image, not as a repo dependency
// (the repo has no package.json and should not grow one for a smoke test).
function loadPlaywright() {
  const require_ = createRequire(import.meta.url);
  try {
    return require_("playwright");
  } catch {
    try {
      const gRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
      return createRequire(join(gRoot, "noop.js"))("playwright");
    } catch {
      console.error("smoke: playwright not found. Install it: npm install -g playwright");
      process.exit(1);
    }
  }
}
const { chromium } = loadPlaywright();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

// Tone and Babel both misbehave over file://, so serve the directory.
const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = join(DIR, rel === "/" ? "index.local.html" : rel);
    if (!file.startsWith(DIR)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

// Let Playwright resolve the binary (it honours PLAYWRIGHT_BROWSERS_PATH, set
// to /opt/pw-browsers in this image). Only override via env, for a machine
// where the browser lives somewhere Playwright does not look.
const browser = await chromium.launch({
  headless: !HEADED,
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});

const errors = [];
const fail = (m) => { errors.push(m); console.error("  ✗ " + m); };
const ok = (m) => console.log("  ✓ " + m);

let booted = false;
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });

  // Babel parse errors surface here as well as in #bootErr.
  page.on("pageerror", (e) => fail("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Babel logs this at error level for any inline script over 500KB. The
    // game is ~940KB in one <script type="text/babel">, so it fires on every
    // run and means only that Babel skipped pretty-printing. Ignoring it keeps
    // the test red for real failures only. Kept as a narrow substring match so
    // an actual Babel error still fails the run.
    if (text.includes("has deoptimised the styling")) return;
    fail("console.error: " + text);
  });

  console.log("\nHollow's Edge smoke test");
  console.log("serving " + url);

  await page.goto(url, { waitUntil: "load" });

  // --- boot ---------------------------------------------------------------
  // The mount removes #boot on success and leaves it (with #bootErr filled)
  // on failure, so #boot disappearing is the real signal.
  try {
    await page.waitForFunction(() => !document.getElementById("boot"), { timeout: 45000 });
    booted = true;
    ok("booted (boot shim cleared)");
  } catch {
    const msg = await page.evaluate(() => {
      const e = document.getElementById("bootErr");
      return e && e.textContent ? e.textContent : "(boot shim still present, #bootErr empty)";
    });
    fail("did not boot: " + msg);
  }

  if (booted) {
    const mounted = await page.evaluate(() => {
      const r = document.getElementById("root");
      return !!r && r.children.length > 0;
    });
    mounted ? ok("React mounted into #root") : fail("#root is empty after boot");

    // --- gate -> run ------------------------------------------------------
    // Native .click() on purpose: Playwright's actionability checks fight the
    // overlay animations on these screens (see CLAUDE.md "Testing").
    const entered = await page.evaluate(() => {
      const hit = [...document.querySelectorAll("button")].find((b) =>
        /ENTER HOLLOW'S EDGE|CONTINUE ·/.test(b.textContent || "")
      );
      if (!hit) return null;
      const label = hit.textContent.trim();
      hit.click();
      return label;
    });

    if (!entered) {
      fail("no ENTER / CONTINUE button on the title screen");
    } else {
      ok(`clicked the gate (${entered})`);
      // A live run renders the day screen's committing actions.
      try {
        await page.waitForFunction(() => {
          const t = document.body.innerText || "";
          return /NIGHTFALL|ACCUSE|FACE THE DAY|ONWARD/.test(t);
        }, { timeout: 30000 });
        ok("reached a live run (day/night controls rendered)");
      } catch {
        fail("entered the gate but no run screen appeared within 30s");
      }
    }
  }
} catch (e) {
  fail("harness error: " + (e && e.stack ? e.stack : e));
} finally {
  await browser.close();
  server.close();
}

if (errors.length) {
  console.error(`\nFAIL — ${errors.length} problem(s)\n`);
  process.exit(1);
}
console.log("\nPASS — the game boots, mounts and starts a run.\n");
