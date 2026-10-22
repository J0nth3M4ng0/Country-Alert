const test = require("node:test");
const assert = require("node:assert");
const { loadWidget } = require("../scripts/load-widget");

let w;
test.before(async () => {
  w = await loadWidget();
});

test("only web links survive", () => {
  assert.strictEqual(w.safeUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.strictEqual(w.safeUrl(" http://example.com "), "http://example.com");
  for (const bad of [
    "shortcuts://run-shortcut?name=x",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "scriptable:///run/x",
    "https://exa mple.com",
    "",
    null,
  ]) {
    assert.strictEqual(w.safeUrl(bad), "", String(bad));
  }
});

test("MFA links must be on mfa.gov.sg", () => {
  assert.ok(w.isMfaUrl("https://www.mfa.gov.sg/x/"));
  assert.ok(w.isMfaUrl("https://mfa.gov.sg/x/"));
  assert.ok(!w.isMfaUrl("https://www.mfa.gov.sg.evil.com/x/"));
  assert.ok(!w.isMfaUrl("https://www.mfa.gov.sg@evil.com/x/"));
  assert.ok(!w.isMfaUrl("http://www.mfa.gov.sg/x/"));
});

test("feed links with other schemes are dropped", () => {
  const xml = `<rss><channel>
    <item><title>Riot in Paris - X</title><link>shortcuts://run-shortcut?name=evil</link><source>X</source></item>
    <item><title>Riot in Paris 2 - X</title><link>https://news.example/a</link><source>X</source></item>
  </channel></rss>`;
  const items = w.parseRss(xml);
  assert.strictEqual(items[0].url, "");
  assert.strictEqual(items[1].url, "https://news.example/a");
  const g = w.parseGdeltArticles({ articles: [{ title: "t", url: "javascript:alert(1)", seendate: "" }] });
  assert.strictEqual(g[0].url, "");
});

test("MFA index links to other sites are ignored", () => {
  const html = `<a href="https://evil.example/travel-advisories-notices-and-visa-information/france/">France</a>`;
  assert.strictEqual(w.findMfaCountryLink(html, "France"), null);
});
