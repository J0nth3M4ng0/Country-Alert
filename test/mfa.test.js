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

test("parameter picks the country for MFA", () => {
  assert.strictEqual(w.parseParam("Paris").country, "france");
  assert.strictEqual(w.parseParam("Yangon").country, "myanmar");
  assert.strictEqual(w.parseParam("Paris | Texas | United States").country, "United States");
  assert.strictEqual(w.parseParam("Springfield | Illinois").country, "Illinois");
  assert.strictEqual(w.parseParam("Smalltown").country, "");
});

test("builds MFA page addresses", () => {
  const base = "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/";
  assert.strictEqual(w.mfaCountryUrl("Saudi Arabia"), base + "saudi-arabia/");
  assert.strictEqual(w.mfaCountryUrl("Côte d'Ivoire"), base + "cote-d-ivoire/");
  assert.strictEqual(w.mfaCountryUrl("Turkey"), base + "turkiye/");
  assert.strictEqual(w.mfaCountryUrl("UK"), base + "united-kingdom/");
});

test("reads a 'defer all travel' advisory and spots the city", () => {
  const r = w.parseMfaPage(fixture("mfa-myanmar.html"), "Yangon", "u");
  assert.strictEqual(r.status, "defer-all");
  assert.strictEqual(r.date, "10 June 2026");
  assert.match(r.summary, /strongly advised to defer all travel to Myanmar/);
  assert.strictEqual(r.leave, true);
  assert.strictEqual(r.mentionsCity, true);
  assert.match(r.cityNote, /Protests have been reported in Yangon/);
});

test("ignores advisory words in scripts and footers", () => {
  const html = "<html><body><script>defer all travel</script><main>" + "<p>Visa free for 30 days.</p>".repeat(12) +
    "</main><footer>Travel Notice</footer></body></html>";
  assert.strictEqual(w.parseMfaPage(html, "X", "u").status, "none");
});

test("reads a 'defer non-essential travel' advisory", () => {
  const r = w.parseMfaPage(fixture("mfa-russia.html"), "Moscow", "u");
  assert.strictEqual(r.status, "defer-non-essential");
  assert.strictEqual(r.date, "29 June 2026");
  assert.strictEqual(r.mentionsCity, false);
});

test("reports no advisory for a visa-only page", () => {
  const r = w.parseMfaPage(fixture("mfa-france.html"), "Paris", "u");
  assert.strictEqual(r.status, "none");
  assert.strictEqual(r.mentionsCity, true); // the embassy address
});

test("flags pages it cannot read instead of saying 'no advisory'", () => {
  const r = w.parseMfaPage("<html><body><div id=app></div></body></html>", "Paris", "u");
  assert.strictEqual(r.status, "unreadable");
});

test("finds a country on the index page when the guessed address fails", () => {
  const index = fixture("mfa-index.html");
  assert.match(w.findMfaCountryLink(index, "Venezuela"), /bolivarian-republic-of-venezuela\/$/);
  assert.match(w.findMfaCountryLink(index, "United States"), /united-states-of-america\/$/);
  assert.match(w.findMfaCountryLink(index, "Turkey"), /^https:\/\/www\.mfa\.gov\.sg\/.*turkiye\/$/);
  assert.strictEqual(w.findMfaCountryLink(index, "Atlantis"), null);
});

test("checkMfa falls back to the index page", async () => {
  const fetched = [];
  const fetchText = async (url) => {
    fetched.push(url);
    if (url.endsWith("/venezuela/")) throw new Error("HTTP 404");
    if (url.endsWith("visa-information/")) return fixture("mfa-index.html");
    if (url.includes("bolivarian")) return fixture("mfa-russia.html").replace(/Russia/g, "Venezuela");
    throw new Error("unexpected " + url);
  };
  const r = await w.checkMfa({ city: "Caracas", country: "Venezuela", fetchText });
  assert.strictEqual(r.status, "defer-non-essential");
  assert.match(r.url, /bolivarian/);
  assert.strictEqual(fetched.length, 3);
});

test("MFA advisory raises the minimum score", () => {
  assert.strictEqual(w.applyMfaFloor(10, { status: "defer-all", mentionsCity: true }), 55);
  assert.strictEqual(w.applyMfaFloor(10, { status: "defer-all", mentionsCity: false }), 35);
  assert.strictEqual(w.applyMfaFloor(10, { status: "defer-non-essential", mentionsCity: true }), 35);
  assert.strictEqual(w.applyMfaFloor(10, { status: "defer-non-essential", mentionsCity: false }), 10);
  assert.strictEqual(w.applyMfaFloor(80, { status: "defer-all", mentionsCity: true }), 80);
  assert.strictEqual(w.applyMfaFloor(10, null), 10);
});

test("full report includes MFA, and MFA failure doesn't break it", async () => {
  const news = async (url) => {
    if (url.includes("timelinevolraw")) return fixture("gdelt-timeline.json");
    if (url.includes("news.google.com")) return fixture("google-news.xml");
    return null;
  };
  const ok = await w.buildReport({
    city: "Yangon", country: "Myanmar", now: NOW, translate: false,
    fetchText: async (u) => (u.includes("mfa.gov.sg") ? fixture("mfa-myanmar.html") : news(u)),
  });
  assert.strictEqual(ok.mfa.status, "defer-all");
  assert.ok(ok.score >= 55);
  assert.deepStrictEqual(ok.errors, []);

  const down = await w.buildReport({
    city: "Paris", country: "France", now: NOW, translate: false,
    fetchText: async (u) => {
      if (u.includes("mfa.gov.sg")) throw new Error("HTTP 503");
      return news(u);
    },
  });
  assert.strictEqual(down.mfa.status, "unreadable");
  assert.strictEqual(down.errors.length, 1);
  assert.strictEqual(down.reports, 4);
});
