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

test("data has names for every country it uses", () => {
  const D = w.DATA;
  for (const c of Object.keys(D.countries)) assert.ok(D.countryNames[c], c);
  for (const [city, info] of Object.entries(D.cities)) assert.ok(D.countryNames[info.country], city);
});

test("spots headlines about other countries", () => {
  const br = w.allNames("Brasilia");
  assert.ok(w.mentionsForeign("Brasília condena repressão a protestos na Venezuela", "brazil", br));
  assert.ok(w.mentionsForeign("Itamaraty em Brasília acompanha confrontos em Buenos Aires", "brazil", br));
  assert.ok(w.mentionsForeign("Brasilia condemns crackdown on Venezuelan protesters", "brazil", br));
  assert.ok(!w.mentionsForeign("Polícia usa gás lacrimogêneo contra manifestantes em Brasília", "brazil", br));
  assert.ok(!w.mentionsForeign("Brazilian police clash with protesters in Brasília", "brazil", br));
  // "usa" is Portuguese for "uses", so it isn't treated as the United States.
  assert.ok(!w.mentionsForeign("Polícia usa bombas em Brasília", "brazil", br));
  // Own-country names are blanked first: "Papua New Guinea" isn't "Guinea".
  assert.ok(!w.mentionsForeign("Riots in Port Moresby, Papua New Guinea", "papua new guinea", ["Port Moresby"]));
  assert.ok(w.mentionsForeign("Riots in Conakry, Guinea", "papua new guinea", ["Port Moresby"]));
  // Local spellings of foreign cities count too.
  assert.ok(w.mentionsForeign("東京で香港のデモについて会議", "japan", w.allNames("Tokyo")));
  // Everyday words that are also place names aren't read as foreign.
  assert.ok(!w.mentionsForeign("Lima orang tewas dalam kerusuhan di Jakarta", "indonesia", w.allNames("Jakarta")));
  assert.ok(!w.mentionsForeign("Người lao động biểu tình ở Hà Nội", "viet nam", w.allNames("Hanoi")));
  assert.ok(!w.mentionsForeign("Marcha por la paz en Bogotá", "colombia", w.allNames("Bogota")));
  // A watched city that shares a name with a listed foreign city isn't foreign.
  assert.ok(!w.mentionsForeign("Protests in Santiago", "dominican republic", ["Santiago"]));
});

test("Brasília keeps only headlines about Brasília", async () => {
  const fetchText = async (url) => {
    if (url.includes("timelinevolraw")) return fixture("gdelt-timeline.json");
    if (url.includes("ceid=BR:pt-419")) return fixture("google-news-br.xml");
    if (url.includes("news.google.com")) return "<rss></rss>";
    if (url.includes("mfa.gov.sg")) return fixture("mfa-france.html");
    throw new Error("unexpected " + url);
  };
  const r = await w.buildReport({ city: "Brasilia", country: "brazil", translate: false, fetchText, now: NOW });
  // Venezuela, Buenos Aires and Caracas stories are skipped. CNN Brasil's
  // "...confrontos na Ucrânia" needs the translation to be caught (next test).
  assert.deepStrictEqual(r.headlines.map((h) => h.source).sort(), ["CNN Brasil", "Correio Braziliense", "G1"]);
});

test("translations catch foreign names hidden by the local wording", async () => {
  const english = {
    "Brasília pede calma após confrontos na Ucrânia": "Brasília calls for calm after clashes in Ukraine",
  };
  const fetchText = async (url) => {
    if (url.startsWith("https://translate.googleapis.com/")) {
      const lines = decodeURIComponent(url.split("&q=")[1]).split("\n");
      return JSON.stringify([lines.map((l, i) => [(english[l] || l) + (i < lines.length - 1 ? "\n" : ""), l]), null, "pt"]);
    }
    if (url.includes("timelinevolraw")) return fixture("gdelt-timeline.json");
    if (url.includes("ceid=BR:pt-419")) return fixture("google-news-br.xml");
    if (url.includes("news.google.com")) return "<rss></rss>";
    if (url.includes("mfa.gov.sg")) return fixture("mfa-france.html");
    throw new Error("unexpected " + url);
  };
  // "Ucrânia" isn't in the English name list, so only the translation reveals it.
  const before = await w.buildReport({ city: "Brasilia", country: "brazil", translate: false, fetchText, now: NOW });
  assert.ok(before.headlines.some((h) => h.source === "CNN Brasil"));
  const after = await w.buildReport({ city: "Brasilia", country: "brazil", fetchText, now: NOW });
  assert.ok(!after.headlines.some((h) => h.source === "CNN Brasil"));
});
