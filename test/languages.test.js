const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadWidget } = require("../scripts/load-widget");

const fixture = (f) => fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8");
const NOW = new Date("2026-10-22T12:00:00Z");
let w;
test.before(async () => {
  w = await loadWidget();
});

test("widget carries the current shared data file", () => {
  execFileSync("node", [path.join(__dirname, "..", "scripts", "sync-data.js"), "--check"]);
});

test("data file is consistent", () => {
  const D = w.DATA;
  assert.ok(D.editions[D.international]);
  for (const [ceid, e] of Object.entries(D.editions)) {
    assert.ok(D.languages[e.lang], ceid);
    assert.strictEqual(ceid.split(":")[0], e.gl, ceid);
  }
  for (const [country, eds] of Object.entries(D.countries)) for (const e of eds) assert.ok(D.editions[e], country);
  for (const [city, c] of Object.entries(D.cities)) {
    assert.strictEqual(city, w.fold(city), city);
    for (const e of c.editions || []) assert.ok(D.editions[e], city);
  }
  for (const [code, L] of Object.entries(D.languages)) {
    assert.ok(["word", "prefix", "substring"].includes(L.match), code);
    assert.ok(L.query.length && L.terms["1"].length && L.terms["2"].length && L.terms["3"].length, code);
  }
});

test("picks local editions plus English", () => {
  assert.deepStrictEqual(w.editionsFor("Paris", "france"), ["FR:fr", "US:en"]);
  assert.deepStrictEqual(w.editionsFor("Geneva", "switzerland"), ["CH:fr", "US:en"]);
  assert.deepStrictEqual(w.editionsFor("Nairobi", "kenya"), ["KE:en"]);
  assert.deepStrictEqual(w.editionsFor("Delhi", "india"), ["IN:hi", "IN:en"]);
  assert.deepStrictEqual(w.editionsFor("Tokyo", "Japan"), ["JP:ja", "US:en"]);
  assert.deepStrictEqual(w.editionsFor("Smalltown", ""), ["US:en"]);
  assert.deepStrictEqual(w.editionsFor("Paris", "france", false), ["US:en"]);
});

test("local spellings", () => {
  assert.deepStrictEqual(w.allNames("Moscow"), ["Moscow", "Москва", "Москве", "Москвы", "Москву"]);
  assert.deepStrictEqual(w.allNames("Tokyo", ["Tōkyō", "Edo"]), ["Tokyo", "Edo", "東京"]); // "Tōkyō" = "Tokyo"
  assert.deepStrictEqual(w.allNames("Bogota"), ["Bogota"]); // "Bogotá" folds to the same name
});

test("rates headlines in many languages", () => {
  const cases = [
    ["fr", "Des heurts éclatent à Paris, gaz lacrymogène", 2],
    ["fr", "GRÈVE GÉNÉRALE À MARSEILLE", 1],
    ["fr", "Le manifeste d'un artiste", 0],
    ["es", "Disturbios y saqueos en Caracas", 2],
    ["es", "Toque de queda en Lima tras protestas", 3],
    ["pt", "Protesto termina em confronto em São Paulo", 2],
    ["de", "Ausschreitungen bei Demonstration in Berlin", 2],
    ["de", "Demokratie-Gipfel in Berlin", 0],
    ["it", "Scontri al corteo di Roma", 2],
    ["ru", "В Москве задержаны участники митинга", 2],
    ["uk", "У Києві пройшов мітинг", 1],
    ["tr", "İstanbul'da protestoya biber gazı", 2],
    ["ar", "اشتباكات بين المتظاهرين والشرطة في القاهرة", 2],
    ["ar", "قتلى في احتجاجات بغداد", 3],
    ["he", "מפגינים חסמו כביש בתל אביב", 1],
    ["id", "Demo di Jakarta berujung ricuh", 2],
    ["id", "Demokrasi di Jakarta", 0],
    ["th", "ผู้ชุมนุมปะทะเจ้าหน้าที่ในกรุงเทพ", 2],
    ["vi", "Biểu tình ở Hà Nội", 1],
    ["ja", "東京で大規模なデモ", 1],
    ["ja", "香港で催涙ガス使用", 2],
    ["ko", "서울 도심서 대규모 집회", 1],
    ["zh", "香港示威者與警方衝突", 2],
    ["zh", "曼谷宣布宵禁", 3],
    ["hi", "दिल्ली में प्रदर्शनकारियों पर लाठीचार्ज", 2],
    ["el", "Επεισόδια στην Αθήνα μετά τη διαδήλωση", 2],
    ["pl", "Zamieszki w Warszawie", 2],
    ["nl", "Rellen in Amsterdam, traangas ingezet", 2],
  ];
  for (const [lang, title, sev] of cases) {
    assert.strictEqual(w.rateHeadline(title, lang).severity, sev, `${lang}: ${title}`);
  }
  // English terms still count in a local feed.
  assert.strictEqual(w.rateHeadline("Riots in Paris", "fr").severity, 2);
  // "Peaceful" softens low-severity local headlines too.
  assert.strictEqual(w.rateHeadline("Manifestation pacifique à Paris", "fr").severity, 0.5);
});

test("spots the city in local spellings and scripts", () => {
  assert.ok(w.mentionsAny("В Москве задержаны", w.allNames("Moscow")));
  assert.ok(w.mentionsAny("東京で大規模なデモ", w.allNames("Tokyo")));
  assert.ok(w.mentionsAny("Grève à PARIS", ["Paris"]));
  assert.ok(w.mentionsAny("Protesta en Bogotá", ["Bogota"]));
  assert.ok(!w.mentionsAny("Grève à Lyon", ["Paris"]));
});

test("non-Latin headlines aren't merged as duplicates", () => {
  const items = [
    { title: "東京で大規模なデモ", source: "A", lang: "ja" },
    { title: "香港で催涙ガス使用", source: "B", lang: "ja" },
  ];
  assert.strictEqual(w.prepareHeadlines(items, ["Tokyo", "東京"], NOW).length, 2);
});

test("report reads the local and English feeds", async () => {
  const urls = [];
  const fetchText = async (url) => {
    urls.push(url);
    if (url.includes("timelinevolraw")) return fixture("gdelt-timeline.json");
    if (url.includes("ceid=FR:fr")) return fixture("google-news-fr.xml");
    if (url.includes("ceid=US:en")) return fixture("google-news.xml");
    if (url.includes("mfa.gov.sg")) return fixture("mfa-france.html");
    throw new Error("unexpected " + url);
  };
  const r = await w.buildReport({ city: "Paris", country: "france", translate: false, fetchText, now: NOW });
  assert.deepStrictEqual(r.editions, ["FR:fr", "US:en"]);
  const fr = r.headlines.filter((h) => h.lang === "fr").map((h) => h.source).sort();
  assert.deepStrictEqual(fr, ["20 Minutes", "BFM", "Le Parisien"]);
  assert.ok(r.headlines.some((h) => h.lang === "en"));
  // Local news adds to the English-only score (67). The Android CoreTest expects the same.
  assert.strictEqual(r.score, 73);
  const frUrl = urls.find((u) => u.includes("FR:fr"));
  assert.ok(decodeURIComponent(frUrl).includes("manifestation"));
  assert.ok(frUrl.includes("hl=fr&gl=FR"));
  assert.deepStrictEqual(r.errors, []);
});

test("a failing local feed doesn't break the report", async () => {
  const fetchText = async (url) => {
    if (url.includes("timelinevolraw")) return fixture("gdelt-timeline.json");
    if (url.includes("ceid=FR:fr")) throw new Error("HTTP 400");
    if (url.includes("news.google.com")) return fixture("google-news.xml");
    if (url.includes("mfa.gov.sg")) return fixture("mfa-france.html");
    throw new Error("unexpected " + url);
  };
  const r = await w.buildReport({ city: "Paris", country: "france", translate: false, fetchText, now: NOW });
  assert.strictEqual(r.score, 67);
  assert.deepStrictEqual(r.errors, ["Google News (FR:fr): HTTP 400"]);
});
