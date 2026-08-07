# AGENTS.md — start here

Hollow's Edge is a gothic social-deduction game: one of eight villagers is
secretly one of fifteen monsters (a sixteenth, The Hollowed, unlocks once the
other fifteen are in the Black Book). You investigate by day, choose how to
spend each night, and must name both WHO and WHAT before the village runs out
of people.

This file is the operational briefing: repo state, how to run it, how to test
it, and the traps. It does **not** restate the game's rules.

---

## 1. Read `CLAUDE.md` before you edit anything

**`CLAUDE.md` at the repo root is the normative spec.** It is ~26 KB and worth
every minute: file layout, the core invariants, and a "Tuning choices
(deliberate — don't 'fix')" section that exists because those numbers look like
bugs and are not. The name is historical — it applies to whichever agent is
working, and this file does not supersede it.

Read it in full before your first edit. Where this file and `CLAUDE.md`
disagree about game behaviour, `CLAUDE.md` wins.

The two rules that get broken most often, repeated here because they are
invisible until a playtest catches them:

- **"Nothing is ever proof."** No single line of narration may uniquely
  identify the monster. Signs and sounds always overlap several types.
- **Never name one of the sixteen in ambient prose.** The mundane explanation
  a villager reaches for ("a wolf, some will say") becomes a leak the moment it
  coincides with the answer.

---

## 2. Repo state — read this before any git operation

Working branch: **`claude/codex-handover-prep-l4mqyf`**. It is pushed.

### `main` and this branch have no common ancestor

This is the one thing that will bite you. The two branches are **unrelated
histories** — separate root commits, no merge base:

| | root commit | tip | commits |
|---|---|---|---|
| `main` | `cd8ebb7` (2026-07-16) | `040bdb5` (2026-07-31) | 59 |
| working branch | `8a9770b` (2026-08-01) | `fb88d50` (2026-08-05) | 50 |

```
$ git merge-base main claude/codex-handover-prep-l4mqyf
$ echo $?
1                      # no common ancestor
```

The branch was started as a fresh root from a snapshot of main's tree rather
than branching off it. So `git merge`, `git rebase`, and a GitHub PR all fail
with *"refusing to merge unrelated histories"*, and `git diff main...branch` is
meaningless. **Do not "fix" this by force-pushing either branch.**

### Nothing on `main` is missing from the branch

Verified, not assumed. Every top-level identifier in main's `index.html`
(845 of them) is present in the branch's, except six that were deliberately
removed or renamed by the redesign:

| removed | why it is not a loss |
|---|---|
| `DAY_TINTS` | already dead on `main` — declared, never referenced |
| `watchModal`, `nightWalkModal` | replaced by the night-walk state machine (`startWalk` / `nextStage` / `commitWalk`) |
| `deathP2` | the odds now live in `followDeathChance` |
| `qtN`, `styleIcon` | locals refactored away |

Feature markers from main's newest work (the Old Mill, the Lich, the coercion
note, the Hollowed) all appear in the branch at equal or higher counts. **The
branch tree is a superset of main's.** Treat the branch as the source of truth.

### Landing the branch on `main` (recipe verified in a throwaway clone)

`main` is what Netlify deploys, so merging is a production release — get the
owner's go-ahead first. When you do, this exact sequence produces a tree
**byte-identical** to the branch while preserving both histories:

```bash
git checkout main
git merge --allow-unrelated-histories --no-commit claude/codex-handover-prep-l4mqyf
# add/add conflicts on CLAUDE.md, index.html, netlify.toml are expected.
# The branch tree is the verified superset — take it wholesale:
git checkout claude/codex-handover-prep-l4mqyf -- .
# main still carries the zip the branch unpacked into design_handoff_.../:
git rm --ignore-unmatch "Hollows-edge mobile redesigns.zip"
git commit -m "Merge the mobile redesign into main"
```

Then confirm before pushing — this should print nothing:

```bash
git diff --stat claude/codex-handover-prep-l4mqyf HEAD
```

The resulting commit has two parents, so main and the redesign share an
ancestor from then on and this problem does not recur.

---

## 3. Running it

There is **no build step, no bundler, no `package.json`**. The whole game is
`index.html` (~12,000 lines, 924 KB): React 18 + Babel standalone transpiling
JSX in the browser + Tailwind + Tone.js, all from CDNs on first load.

To run it, open `index.html` in a browser. That is the entire deploy story.

---

## 4. Testing

`index.html` has no unit tests and no type checking, and JSX is transpiled at
page load — so **a typo is invisible until something renders it**. The repo
ships a harness that catches exactly that:

```bash
bash tools/setup-local.sh     # vendor the 5 CDN libs locally (~30s, once)
node tools/smoke.mjs          # boot + play smoke test
node tools/smoke.mjs --headed # watch it in a real window
```

`setup-local.sh` writes `.local-test/` (gitignored): the vendored libraries
plus `index.local.html`, a copy of `index.html` with its five `<script src>`
URLs repointed at them. This exists because sandboxes and CI usually cannot
reach `unpkg.com`, which otherwise leaves you staring at the boot shim's
"A library failed to load".

`smoke.mjs` serves that directory, drives Chromium, and asserts the page boots
(the mount removes `#boot` on success), React mounts, and clicking the gate
reaches a live run. It exits non-zero on any page error and prints Babel's
line number and code frame when the file fails to parse.

**Run it before every commit.** It takes about ten seconds and it is the only
automated check this project has.

Three things to know:

- **Never commit `.local-test/`,** and never copy `index.local.html` over
  `index.html`. The patched copy only runs on a machine with
  `.local-test/vendor/` beside it; shipping it would load nothing for every
  real player. `.gitignore` covers this — leave it in place.
- **The harness proves "does it run", never "does it look right".** The
  vendored Tailwind is v4; production loads the v3 CDN. Spacing and some
  utilities genuinely differ. Do not chase a layout bug you only saw locally.
- If you bump a library version in `index.html`, bump the matching pin in
  `tools/setup-local.sh`. It fails loudly rather than silently testing the
  wrong thing.

For rare paths (deaths, offers), override `Math.random` via
`page.evaluate(() => { Math.random = () => 0.001; })` after starting the walk.
Use `page.evaluate` + native `el.click()` — Playwright's actionability checks
fight the overlay animations.

---

## 5. Working inside a 12,000-line file

- **Grep for identifiers; do not trust recorded line numbers.** Every `~L####`
  in `design_handoff_hollows_edge_redesign/github.md` is stale by roughly
  2,400 lines (it is a dated snapshot from commit `fa06f0e`, and says so).
  `grep -n "const accuseModal" index.html` is always right.
- `CLAUDE.md`'s "How the file is organized" section maps the file top to
  bottom. Use it to know roughly where you are before grepping.
- Read the function you are changing and its callers. Do not read the whole
  file — it will consume your context for no benefit.
- Match the surrounding prose style: second person, present tense, dread over
  gore, em-dash-free. **Line length is a budget, not a preference** — this is
  a phone game; `CLAUDE.md` lists the per-pool character medians.

---

## 6. The design handoff, and its status

`design_handoff_hollows_edge_redesign/` is the mobile redesign package:
`README.md` (design system), `Hollow's Edge Redesign.dc.html` (the 414 KB
canvas), and `MIGRATION.md`, the ledger.

**All 17 rows are done.** No migration work is outstanding. `MIGRATION.md`
still records what each row changed and — more usefully — the cases where the
mock was innocent but the obvious implementation would have altered the game.
Read it before touching any redesigned screen.

`hollow-art.jsx`, `ios-frame.jsx` and `support.js` are the mock runtime, **not
production code**. Never import from them.

The package is presentation only. Where it appears to add, remove or reweight
a player choice, `index.html` wins.

---

## 7. Git and authorship

- Commits are authored as **Jacob Strong <jacobstrong3357@gmail.com>**.
- **Add no AI attribution of any kind** — no `Co-Authored-By`, no session
  trailers, no model names in commit messages, PR bodies or code comments. The
  owner has asked that authorship be theirs alone. This is not negotiable and
  it is easy to do by reflex; check your commit message before you run it.
- Work on feature branches: `git push -u origin <branch>`.
- Commit messages here are sentence-case and describe the change in the game's
  own register ("Give the hanging its own morning, and stop the cards falling
  off the screen"). Match that voice.
- One screen or one concern per commit.

---

## 8. Deploy

Netlify, site `hollowsedge`, wired to pushes on **`main`**. Pushing to main
publishes.

`netlify.toml` 404s `/CLAUDE.md`, `/AGENTS.md`, `/tools/*` and
`/design_handoff_hollows_edge_redesign/*`, so repo docs and tooling stay off
the public site. If you add a doc or script at the root that should not ship,
add a redirect for it too.

---

## 9. Gotchas that have already cost someone an afternoon

- **The window keeps its own state.** A run persists to `localStorage` under
  `he:mv-run` and the Black Book under `he:mv-black-book`. If the title screen
  shows `CONTINUE · DAY N` when you expected a fresh gate, clear those keys —
  you are not looking at a bug.
- **Babel logs one error on every single run**: *"The code generator has
  deoptimised the styling ... exceeds the max of 500KB."* It is harmless (the
  inline script is 924 KB) and `smoke.mjs` filters exactly that string. Do not
  widen the filter — real Babel errors must still fail.
- **Every stage of the night walk must render at least one button.** A branch
  nobody wrote a case for strands the run on a dead screen, and there is no
  back button in the dark. Write the final case as "any kind not handled
  above", never as an equality check against one expected value.
- **A centred column that can overflow must be `safe` centred** (`.mvSafeCenter`
  / `.mvSafeEnd`). Plain `justify-content: center` pushes the start of a long
  column out through the top edge where no scrollbar can reach it. This has
  eaten a title line and an epilogue heading already.
- **Kill animations must end on a visible dimmed corpse** (opacity ~0.4–0.55),
  never fade to nothing — players screenshot them and arrive after they end.
