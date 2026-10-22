const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { loadWidget } = require("../scripts/load-widget");

const fixture = (f) => fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8");
const NOW = new Date("2026-10-22T12:00:00Z");
let w;
test.before(async () => {
  w = await loadWidget();
});

test("parses widget parameter", () => {
  assert.deepStrictEqual(w.parseParam(" Portland | Oregon | United States "), {
    city: "Portland",
    names: [],
    context: "Oregon",
    country: "United States",
  });
  assert.deepStrictEqual(w.parseParam(""), { city: w.CONFIG.defaultCity, names: [], context: "", country: "france" });
  assert.deepStrictEqual(w.parseParam("Moscow / Москва").names, ["Москва"]);
});

test("parses Google News RSS and strips source suffix", () => {
  const items = w.parseRss(fixture("google-news.xml"));
  assert.strictEqual(items.length, 7);
  assert.strictEqual(items[0].title, "Police fire tear gas as protesters clash in Paris");
  assert.strictEqual(items[0].source, "Reuters");
  assert.strictEqual(items[3].title, "Paris transport unions call strike for Friday & Saturday");
});

test("rates headline severity", () => {
  assert.strictEqual(w.rateHeadline("Two killed in clashes").severity, 3);
  assert.strictEqual(w.rateHeadline("Police use tear gas").severity, 2);
  assert.strictEqual(w.rateHeadline("Workers strike over pay").severity, 1);
  assert.strictEqual(w.rateHeadline("Peaceful rally downtown").severity, 0.5);
  assert.strictEqual(w.rateHeadline("Fashion week opens").severity, 0);
  // Word boundaries: "airstrike" is not "strike", "March" is not a term.
  assert.strictEqual(w.rateHeadline("Airstrike report due in March").severity, 0);
});

test("prepares headlines: dedupes, drops old and irrelevant, sorts by severity", () => {
  const hs = w.prepareHeadlines(w.parseRss(fixture("google-news.xml")), "Paris", NOW);
  assert.deepStrictEqual(
    hs.map((h) => h.source),
    ["BBC", "Reuters", "Le Monde", "France 24"]
  );
});

test("summarizes GDELT timeline into daily buckets", () => {
  const v = w.summarizeTimeline(JSON.parse(fixture("gdelt-timeline.json")), NOW);
  assert.strictEqual(v.last24h, 8 * 24);
  assert.strictEqual(v.baseline, 2 * 24);
  assert.strictEqual(v.daily.length, 7);
});

test("parses GDELT dates", () => {
  assert.strictEqual(w.parseGdeltDate("20261022T101500Z").toISOString(), "2026-10-22T10:15:00.000Z");
  assert.strictEqual(w.parseGdeltDate("garbage"), null);
});

test("scores stay in range and rise with severity", () => {
  assert.strictEqual(w.scoreReport([], { last24h: 0, baseline: 0, daily: [] }), 0);
  const mild = [{ weight: 1, severity: 1 }];
  const bad = Array.from({ length: 10 }, () => ({ weight: 3, severity: 3 }));
  const spike = { last24h: 300, baseline: 20, daily: [] };
  assert.ok(w.scoreReport(mild, null) < 15);
  assert.ok(w.scoreReport(bad, spike) >= 90);
  assert.ok(w.scoreReport(bad, spike) <= 100);
  assert.strictEqual(w.levelFor(0).name, "Calm");
  assert.strictEqual(w.levelFor(60).name, "High");
  assert.strictEqual(w.levelFor(100).name, "Severe");
});

test("builds a full report from both sources", async () => {
  const fetchText = async (url) => {
    if (url.includes("timelinevolraw")) return fixture("gdelt-timeline.json");
    if (url.includes("news.google.com")) return fixture("google-news.xml");
    throw new Error("unexpected " + url);
  };
  const r = await w.buildReport({ city: "Paris", fetchText, now: NOW });
  assert.strictEqual(r.reports, 4);
  assert.strictEqual(r.sources, 4);
  // The Android app's CoreTest expects the same score; keep them in step.
  assert.strictEqual(r.score, 67);
  assert.strictEqual(r.level, "High");
  assert.deepStrictEqual(r.errors, []);
  assert.ok(r.link.startsWith("https://news.google.com/search?q="));
});

test("falls back to GDELT articles when Google News fails", async () => {
  const fetchText = async (url) => {
    if (url.includes("timelinevolraw")) throw new Error("HTTP 429");
    if (url.includes("news.google.com")) throw new Error("HTTP 503");
    if (url.includes("artlist")) return fixture("gdelt-articles.json");
  };
  const r = await w.buildReport({ city: "Paris", fetchText, now: NOW });
  assert.strictEqual(r.reports, 2);
  assert.strictEqual(r.headlines[0].severity, 3);
  assert.strictEqual(r.errors.length, 2);
});

test("throws when nothing is reachable", async () => {
  const fetchText = async () => {
    throw new Error("offline");
  };
  await assert.rejects(w.buildReport({ city: "Paris", fetchText, now: NOW }), /No sources reachable/);
});

test("handles GDELT's plain-text error replies", async () => {
  const fetchText = async (url) =>
    url.includes("gdelt") ? "Please limit requests to one every 5 seconds" : fixture("google-news.xml");
  const r = await w.buildReport({ city: "Paris", fetchText, now: NOW });
  assert.strictEqual(r.volume, null);
  assert.strictEqual(r.reports, 4);
  assert.strictEqual(r.errors.length, 1);
});

test("trend compares against a reading 3+ hours old", () => {
  const t = NOW.getTime();
  const report = { score: 60, generatedAt: NOW.toISOString() };
  assert.strictEqual(w.trendFrom([], report).arrow, "");
  assert.strictEqual(w.trendFrom([{ t: t - 4 * 3600e3, score: 30 }], report).arrow, "▲");
  assert.strictEqual(w.trendFrom([{ t: t - 4 * 3600e3, score: 75 }], report).arrow, "▼");
  assert.strictEqual(w.trendFrom([{ t: t - 4 * 3600e3, score: 58 }, { t: t - 600e3, score: 10 }], report).arrow, "▶");
});
