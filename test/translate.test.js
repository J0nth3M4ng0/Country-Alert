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

const ENGLISH = {
  "Paris : des heurts entre manifestants et forces de l'ordre, gaz lacrymogène tiré":
    "Paris: clashes between protesters and police, tear gas fired",
  "Grève dans les transports à PARIS ce vendredi": "Transport strike in PARIS this Friday",
  "Manifestation pacifique place de la République": "Peaceful demonstration at Place de la République",
};

// Answers like Google Translate: one segment per sentence, newlines kept.
function fakeTranslator(dict, calls) {
  return (url) => {
    const q = decodeURIComponent(url.split("&q=")[1]);
    calls.push(q);
    const lines = q.split("\n");
    return JSON.stringify([lines.map((l, i) => [(dict[l] || l) + (i < lines.length - 1 ? "\n" : ""), l, null, null, 10]), null, "fr"]);
  };
}

function newsFetch(translator) {
  return async (url) => {
    if (url.startsWith("https://translate.googleapis.com/")) return translator(url);
    if (url.includes("timelinevolraw")) return fixture("gdelt-timeline.json");
    if (url.includes("ceid=FR:fr")) return fixture("google-news-fr.xml");
    if (url.includes("news.google.com")) return fixture("google-news.xml");
    if (url.includes("mfa.gov.sg")) return fixture("mfa-france.html");
    throw new Error("unexpected " + url);
  };
}

test("parses Google Translate replies", () => {
  assert.strictEqual(w.parseTranslation([[["Hello. ", "Bonjour. "], ["World", "Monde"]], null, "fr"]), "Hello. World");
  assert.throws(() => w.parseTranslation({ error: 1 }));
  assert.throws(() => w.parseTranslation(null));
});

test("translates foreign headlines in one request and labels them", async () => {
  const calls = [];
  const r = await w.buildReport({ city: "Paris", country: "france", fetchText: newsFetch(fakeTranslator(ENGLISH, calls)), now: NOW });
  assert.strictEqual(calls.length, 1);
  const fr = r.headlines.filter((h) => h.lang === "fr");
  assert.strictEqual(fr.length, 3);
  for (const h of fr) {
    assert.strictEqual(h.translated, ENGLISH[h.title]);
    assert.strictEqual(w.displayTitle(h), "[Translated] " + ENGLISH[h.title]);
  }
  // English headlines are left alone and never sent.
  for (const h of r.headlines.filter((h) => h.lang === "en")) {
    assert.strictEqual(h.translated, undefined);
    assert.strictEqual(w.displayTitle(h), h.title);
    assert.ok(!calls[0].includes(h.title));
  }
  assert.strictEqual(r.score, 73); // translation doesn't change the score
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(Object.keys(r.translations).length, 3);
});

test("remembers translations between refreshes", async () => {
  const calls = [];
  const fetchText = newsFetch(fakeTranslator(ENGLISH, calls));
  const first = await w.buildReport({ city: "Paris", country: "france", fetchText, now: NOW });
  const second = await w.buildReport({ city: "Paris", country: "france", translations: first.translations, fetchText, now: NOW });
  assert.strictEqual(calls.length, 1);
  assert.ok(second.headlines.some((h) => h.translated));
});

test("shows originals when translation fails", async () => {
  const fetchText = newsFetch(() => {
    throw new Error("HTTP 429");
  });
  const r = await w.buildReport({ city: "Paris", country: "france", fetchText, now: NOW });
  assert.ok(r.headlines.every((h) => !h.translated));
  assert.deepStrictEqual(r.errors, ["Translate: HTTP 429"]);
  assert.strictEqual(r.score, 73);
});

test("ignores replies that don't line up with the headlines", async () => {
  const fetchText = newsFetch(() => JSON.stringify([[["just one line", "x"]], null, "fr"]));
  const r = await w.buildReport({ city: "Paris", country: "france", fetchText, now: NOW });
  assert.ok(r.headlines.every((h) => !h.translated));
  assert.strictEqual(r.errors.length, 1);
});

test("translation can be turned off", async () => {
  const calls = [];
  const r = await w.buildReport({ city: "Paris", country: "france", translate: false, fetchText: newsFetch(fakeTranslator(ENGLISH, calls)), now: NOW });
  assert.strictEqual(calls.length, 0);
  assert.ok(r.headlines.every((h) => !h.translated));
});

test("handles Google's 'unusual traffic' page", async () => {
  const fetchText = newsFetch(() => "<html><title>Sorry...</title></html>");
  const r = await w.buildReport({ city: "Paris", country: "france", fetchText, now: NOW });
  assert.ok(r.headlines.every((h) => !h.translated));
  assert.deepStrictEqual(r.errors, ["Translate: service unavailable, showing originals"]);
});
