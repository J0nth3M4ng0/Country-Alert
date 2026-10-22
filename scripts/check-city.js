#!/usr/bin/env node
// Runs the widget's report logic from a computer:  node scripts/check-city.js "Paris"
const { loadWidget } = require("./load-widget");

(async () => {
  const w = await loadWidget();
  const { city, context } = w.parseParam(process.argv.slice(2).join(" "));
  const fetchText = async (url) => {
    const res = await fetch(url, { headers: { "User-Agent": "CityUnrestWidget/1.0" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  };
  const r = await w.buildReport({ city, context, fetchText });
  console.log(`${r.city}${r.context ? " (" + r.context + ")" : ""}: ${r.level} — ${r.score}/100`);
  console.log(`${r.reports} reports from ${r.sources} sources in the last 24h`);
  if (r.volume) {
    console.log(`Coverage: ${r.volume.last24h} articles today vs ${r.volume.baseline.toFixed(1)}/day baseline`);
  }
  for (const h of r.headlines) console.log(`  [${h.severity}] ${h.title} — ${h.source}`);
  if (r.errors.length) console.log("Errors:", r.errors.join("; "));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
