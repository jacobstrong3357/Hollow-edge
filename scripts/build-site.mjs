import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "dist");
const sourcePath = path.join(root, "index.html");
const source = await fs.readFile(sourcePath, "utf8");
const jsxPattern = /<script type="text\/babel" data-presets="react">([\s\S]*?)<\/script>/;
const jsxMatch = source.match(jsxPattern);

if (!jsxMatch) throw new Error("Could not find the JSX game script in index.html");

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const entry = `
import * as React from "react";
import { createRoot } from "react-dom/client";
import * as Tone from "tone";
const ReactDOM = { createRoot };
${jsxMatch[1]}
`;

await build({
  stdin: {
    contents: entry,
    loader: "jsx",
    resolveDir: root,
    sourcefile: "game.jsx"
  },
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ["es2020"],
  format: "iife",
  outfile: path.join(outDir, "game.js"),
  logLevel: "info"
});

const css = await postcss([
  tailwindcss({
    content: [{ raw: source, extension: "html" }],
    theme: { extend: {} },
    corePlugins: { preflight: true }
  }),
  autoprefixer
]).process("@tailwind base;\n@tailwind components;\n@tailwind utilities;\n", {
  from: undefined,
  to: path.join(outDir, "game.css")
});
await fs.writeFile(path.join(outDir, "game.css"), css.css);

let html = source
  .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*/, "")
  .replace(/<script crossorigin src="https:\/\/unpkg\.com\/react@[^\"]+"><\/script>\s*/, "")
  .replace(/<script crossorigin src="https:\/\/unpkg\.com\/react-dom@[^\"]+"><\/script>\s*/, "")
  .replace(/<script src="https:\/\/unpkg\.com\/tone@[^\"]+"><\/script>\s*/, "")
  .replace(/<script src="https:\/\/unpkg\.com\/@babel\/standalone@[^\"]+"><\/script>\s*/, "")
  .replace(/\s*if \(!window\.React \|\| !window\.ReactDOM \|\| !window\.Tone \|\| !window\.Babel\) \{[\s\S]*?\n  \}/, "")
  .replace(jsxPattern, '<script defer src="game.js"></script>')
  .replace("</head>", '<link rel="stylesheet" href="game.css" />\n</head>');

await fs.writeFile(path.join(outDir, "index.html"), html);

/* Source artwork keeps both lossless PNG masters and browser-ready WebP
   exports. Shipping both made the user-test build more than 200 MB even
   though the game always requests the WebP version. Retain standalone PNGs,
   but leave a PNG master out when an identically named WebP is beside it. */
function productionAsset(source) {
  if (path.extname(source).toLowerCase() !== ".png") return true;
  return !fsSync.existsSync(source.slice(0, -4) + ".webp");
}

await Promise.all([
  fs.cp(path.join(root, "assets"), path.join(outDir, "assets"), { recursive: true, filter: productionAsset }),
  fs.copyFile(path.join(root, "v5-content.js"), path.join(outDir, "v5-content.js")),
  fs.copyFile(path.join(root, "v5-night-director.js"), path.join(outDir, "v5-night-director.js")),
  fs.copyFile(path.join(root, "v6-continuity.js"), path.join(outDir, "v6-continuity.js")),
  fs.copyFile(path.join(root, "v6-director-adapter.js"), path.join(outDir, "v6-director-adapter.js")),
  fs.copyFile(path.join(root, "v6-run-continuity.js"), path.join(outDir, "v6-run-continuity.js")),
  fs.copyFile(path.join(root, "v6-continuity-inspector.js"), path.join(outDir, "v6-continuity-inspector.js"))
]);

for (const optionalFile of ["favicon.svg", "beta-feedback.html", "beta-thanks.html"]) {
  try {
    await fs.copyFile(path.join(root, optionalFile), path.join(outDir, optionalFile));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

console.log("Built Hollow's Edge in dist/");
