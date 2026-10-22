// Loads widget/CityUnrest.js outside Scriptable. The file uses top-level
// await (allowed in Scriptable), so it is evaluated as an async function body.
const fs = require("fs");
const path = require("path");

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function loadWidget() {
  const src = fs.readFileSync(path.join(__dirname, "..", "widget", "CityUnrest.js"), "utf8");
  const mod = { exports: {} };
  await new AsyncFunction("module", "require", src)(mod, require);
  return mod.exports;
}

module.exports = { loadWidget };
