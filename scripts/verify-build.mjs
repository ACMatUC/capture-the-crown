import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Script } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist/client");
const htmlPath = resolve(output, "index.html");
const cssPath = resolve(output, "game.css");
const html = readFileSync(htmlPath, "utf8");
const css = readFileSync(cssPath, "utf8");

function verifyReference(reference, importer) {
  if (reference.startsWith("data:") || reference.startsWith("#")) return;
  const url = new URL(reference, pathToFileURL(importer));
  assert.equal(url.protocol, "file:", `External runtime asset: ${reference}`);
  const target = fileURLToPath(url);
  const local = relative(output, target);
  assert(
    !local.startsWith("..") && !isAbsolute(local),
    `Asset outside client: ${reference}`,
  );
  assert(statSync(target).isFile(), `Missing runtime asset: ${reference}`);
}

assert(
  !/<script[^>]+type=["']module["']/i.test(html),
  "Client must use classic scripts.",
);
const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(
  (match) => match[1],
);
assert.deepEqual(scripts, ["./strategy.js", "./game.js"]);
for (const script of scripts) {
  const path = resolve(dirname(htmlPath), script);
  new Script(readFileSync(path, "utf8"), { filename: path });
}
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
  verifyReference(match[1], htmlPath);
}
for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
  verifyReference(match[1].replace(/^["']|["']$/g, ""), cssPath);
}
for (const font of ["ArchivoBlack-Regular.ttf", "DMSans-Variable.ttf"]) {
  const original = readFileSync(resolve(root, "public/fonts", font));
  assert(
    css.includes(`data:font/ttf;base64,${original.toString("base64")}`),
    `${font} must be inline.`,
  );
}
assert(!/<link[^>]+as=["']font["']/i.test(html), "Inline fonts need no file preloads.");
for (const asset of ["strategy.js", "assets/acm-uc-logo.png"]) {
  assert.deepEqual(
    readFileSync(resolve(output, asset)),
    readFileSync(resolve(root, "public", asset)),
    `${asset} must remain unchanged in the client folder.`,
  );
}
console.log("Standalone client verified: classic scripts, local assets, inline fonts.");
