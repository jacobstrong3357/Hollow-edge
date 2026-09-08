"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
var start = html.indexOf("const NAMED_SUBJECT_VERBS");
var end = html.indexOf("function demeanorLine", start);
assert(start >= 0 && end > start, "the named-subject grammar helper is present");

var context = {};
vm.createContext(context);
vm.runInContext(html.slice(start, end) + "; this.namedSubjectLine = namedSubjectLine;", context);

assert.strictEqual(
  context.namedSubjectLine("Father Ansel", "They sit slumped and answer without protest."),
  "Father Ansel sits slumped and answers without protest."
);
assert.strictEqual(
  context.namedSubjectLine("Greta", "They are very still while you speak."),
  "Greta is very still while you speak."
);
assert.strictEqual(
  context.namedSubjectLine("Liesel", "Their hands are cold."),
  "Liesel's hands are cold."
);
assert.strictEqual(
  context.namedSubjectLine("Rosa", "They cannot keep still."),
  "They cannot keep still.",
  "an unrecognised verb keeps the grammatical neutral-pronoun sentence"
);

assert(!html.includes("`the deaths began"), "standalone quoted accusations begin as complete sentences");
assert(!html.includes("lore's hand"), "rite-preparer copy must not form a stacked possessive from an appositive");
assert(html.includes("Greta, keeper of her grandmother's lore") && html.includes("will prepare it"), "rite-preparer copy reads as two complete sentences in the accusation confirmation");
assert(!html.includes("if you'd been stood") && !html.includes("Nothing else. Nothing else is needed."), "a caught favour lie is concise and uses natural English");
assert(html.includes('d.where === "home" ? `${d.name}\'s house`') && html.includes("struck inside ${deathPlace}"), "the ending names a victim's house instead of exposing the internal Home location");

console.log("prose-grammar: all tests passed");
