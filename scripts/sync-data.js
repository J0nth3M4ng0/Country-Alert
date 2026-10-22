#!/usr/bin/env node
// Copies data/unrest-data.json into widget/CityUnrest.js. Scriptable needs a
// single file, so the iPhone widget carries its own copy. The Android app
// reads the JSON file directly. Run after editing the data file:
//   node scripts/sync-data.js          update the widget
//   node scripts/sync-data.js --check  fail if the widget is out of date
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const widgetPath = path.join(root, "widget", "CityUnrest.js");
const data = JSON.parse(fs.readFileSync(path.join(root, "data", "unrest-data.json"), "utf8"));
delete data._about;

const begin = "// BEGIN GENERATED DATA\n";
const end = "// END GENERATED DATA\n";
const src = fs.readFileSync(widgetPath, "utf8");
const i = src.indexOf(begin);
const j = src.indexOf(end);
if (i < 0 || j < i) throw new Error("Generated-data markers not found in widget");
const block = "const DATA = " + JSON.stringify(data) + ";\n";
const out = src.slice(0, i + begin.length) + block + src.slice(j);

if (process.argv.includes("--check")) {
  if (out !== src) {
    console.error("widget/CityUnrest.js is out of date. Run: node scripts/sync-data.js");
    process.exit(1);
  }
} else {
  fs.writeFileSync(widgetPath, out);
  console.log("Updated widget/CityUnrest.js");
}
