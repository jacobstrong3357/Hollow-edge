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

console.log("prose-grammar: all tests passed");
