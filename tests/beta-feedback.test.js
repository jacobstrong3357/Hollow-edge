"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const feedback = fs.readFileSync(path.join(root, "beta-feedback.html"), "utf8");
const thanks = fs.readFileSync(path.join(root, "beta-thanks.html"), "utf8");
const game = fs.readFileSync(path.join(root, "index.html"), "utf8");
const build = fs.readFileSync(path.join(root, "scripts", "build-site.mjs"), "utf8");

assert.match(feedback, /<form name="beta-feedback" method="POST" action="\/beta-thanks\.html" data-netlify="true" netlify-honeypot="bot-field">/);
assert.doesNotMatch(feedback, /name="form-name"/, "Netlify injects the hidden form-name into static HTML during deployment");
for (const name of ["kind", "where", "happened", "expected", "device", "email", "bot-field"]) {
  assert.match(feedback, new RegExp('name="' + name + '"'), name + " must be part of the static form Netlify detects");
}
assert.match(feedback, /name="happened" required/);
assert.doesNotMatch(feedback, /name="email"[^>]*required/);
assert.match(thanks, /Your feedback has been sent/);
assert.doesNotMatch(feedback + thanks, /\u2014/, "beta pages should not use em dashes");
assert.match(game, /href="\/beta-feedback\.html"/);
assert.match(game, /className="mv-body heBetaFeedbackLink"/);
assert.match(game, /\.heBetaFeedbackLink \{[^}]*color:var\(--he-ink\) !important/);
assert.match(build, /"beta-feedback\.html", "beta-thanks\.html"/);

console.log("beta-feedback: form and build wiring passed");
