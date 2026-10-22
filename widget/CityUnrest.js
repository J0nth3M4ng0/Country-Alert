// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: exclamation-triangle;

/*
 * City Unrest — a phone widget that estimates the current level of civil
 * unrest in a city from open-source news reporting.
 *
 * Runs in Scriptable (iOS). Set the widget's "Parameter" to a city, e.g.
 *   Paris
 *   Portland | Oregon                  (second part narrows ambiguous names)
 *   Portland | Oregon | United States  (third part: country for the MFA check)
 *
 * Sources (no API keys needed):
 *   - GDELT DOC 2.0 API: 7-day volume of unrest coverage mentioning the city
 *   - Google News RSS:   last-24h headlines, scored for severity
 *   - Singapore MFA:     the country's travel advisory / notice, and whether
 *                        it names the city
 *
 * The score is a rough signal, not ground truth. Always check the headlines.
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const CONFIG = {
  defaultCity: "Paris",
  // Google News edition. Change for local-language coverage, e.g. "fr", "FR".
  newsLanguage: "en",
  newsCountry: "US",
  // Minutes before iOS is asked to refresh the widget (iOS may delay it).
  refreshMinutes: 30,
  requestTimeoutSeconds: 15,
};

// Words that suggest unrest, grouped by severity (3 = most severe).
const UNREST_TERMS = {
  3: [
    "killed", "dead", "deaths", "death toll", "shooting", "shot dead",
    "gunfire", "gunmen", "explosion", "bombing", "martial law",
    "state of emergency", "curfew", "coup", "massacre", "live ammunition",
    "troops deployed", "army deployed", "lynching",
  ],
  2: [
    "riot", "riots", "rioting", "rioters", "clash", "clashes", "clashed",
    "tear gas", "teargas", "looting", "looted", "looters", "arson",
    "set fire", "torched", "violent", "violence", "injured", "wounded",
    "arrested", "arrests", "detained", "rubber bullets", "water cannon",
    "barricade", "barricades", "unrest", "crackdown", "mob", "stampede",
    "molotov", "vandalism", "uprising", "insurrection",
  ],
  1: [
    "protest", "protests", "protested", "protesting", "protesters",
    "protestors", "demonstration", "demonstrations", "demonstrators",
    "marchers", "strike", "strikes", "general strike", "walkout", "blockade",
    "blockades", "rally", "rallies", "sit-in", "picket", "boycott",
    "shutdown", "hartal", "bandh", "unions", "dissent",
  ],
};

// Words that suggest a calm outcome; they soften low-severity headlines.
const CALMING_TERMS = ["peaceful", "peacefully", "calm returns", "called off", "ends", "ended"];

// Search terms used to find unrest coverage.
const QUERY_TERMS = [
  "protest", "protesters", "riot", "clashes", "unrest", "curfew",
  "\"tear gas\"", "demonstrators", "strike", "looting",
];

const LEVELS = [
  { min: 75, name: "Severe", color: "#FF3B30" },
  { min: 55, name: "High", color: "#FF9500" },
  { min: 35, name: "Elevated", color: "#FFCC00" },
  { min: 15, name: "Low", color: "#A3D65C" },
  { min: 0, name: "Calm", color: "#34C759" },
];

// Singapore Ministry of Foreign Affairs country travel pages.
const MFA_BASE = "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/";

// MFA advice levels, most serious first.
const MFA_LEVELS = {
  "defer-all": { label: "Defer all travel", color: "#FF3B30", rank: 4 },
  "defer-non-essential": { label: "Defer non-essential travel", color: "#FF9500", rank: 3 },
  caution: { label: "Exercise caution", color: "#FFCC00", rank: 2 },
  notice: { label: "Travel notice", color: "#FFCC00", rank: 1 },
  none: { label: "No advisory", color: "#34C759", rank: 0 },
  unreadable: { label: "Check MFA page", color: "#8E8E93", rank: -1 },
};

// Other names for countries, mapped to the words MFA uses.
const COUNTRY_ALIASES = {
  usa: "united states", us: "united states", america: "united states",
  uk: "united kingdom", britain: "united kingdom", "great britain": "united kingdom",
  england: "united kingdom", scotland: "united kingdom", wales: "united kingdom",
  turkey: "turkiye", "south korea": "korea", "ivory coast": "cote d ivoire",
  "czech republic": "czechia", burma: "myanmar", holland: "netherlands",
  uae: "united arab emirates", drc: "democratic republic of the congo",
  "east timor": "timor leste", vietnam: "viet nam", laos: "lao",
};

// Common cities and their countries, so most users only need to type a city.
const CITY_COUNTRIES = Object.fromEntries(
  (
    "paris:france,lyon:france,marseille:france,london:united kingdom,manchester:united kingdom," +
    "birmingham:united kingdom,glasgow:united kingdom,belfast:united kingdom,dublin:ireland," +
    "berlin:germany,hamburg:germany,munich:germany,frankfurt:germany,madrid:spain,barcelona:spain," +
    "lisbon:portugal,rome:italy,milan:italy,naples:italy,athens:greece,amsterdam:netherlands," +
    "brussels:belgium,vienna:austria,zurich:switzerland,geneva:switzerland,stockholm:sweden," +
    "oslo:norway,copenhagen:denmark,helsinki:finland,warsaw:poland,prague:czechia,budapest:hungary," +
    "bucharest:romania,belgrade:serbia,sofia:bulgaria,kyiv:ukraine,kiev:ukraine,moscow:russia," +
    "st petersburg:russia,tbilisi:georgia,yerevan:armenia,baku:azerbaijan,istanbul:turkiye,ankara:turkiye," +
    "tel aviv:israel,jerusalem:israel,beirut:lebanon,amman:jordan,damascus:syria,baghdad:iraq," +
    "tehran:iran,riyadh:saudi arabia,jeddah:saudi arabia,dubai:united arab emirates," +
    "abu dhabi:united arab emirates,doha:qatar,kuwait city:kuwait,muscat:oman,sanaa:yemen,cairo:egypt," +
    "alexandria:egypt,tunis:tunisia,algiers:algeria,tripoli:libya,casablanca:morocco,rabat:morocco," +
    "khartoum:sudan,addis ababa:ethiopia,nairobi:kenya,mombasa:kenya,kampala:uganda,kigali:rwanda," +
    "dar es salaam:tanzania,lagos:nigeria,abuja:nigeria,accra:ghana,dakar:senegal,abidjan:cote d ivoire," +
    "kinshasa:democratic republic of the congo,luanda:angola,johannesburg:south africa," +
    "cape town:south africa,durban:south africa,pretoria:south africa,harare:zimbabwe,maputo:mozambique," +
    "antananarivo:madagascar,new york:united states,washington:united states,los angeles:united states," +
    "chicago:united states,san francisco:united states,seattle:united states,boston:united states," +
    "miami:united states,atlanta:united states,minneapolis:united states,houston:united states," +
    "toronto:canada,montreal:canada,vancouver:canada,ottawa:canada,mexico city:mexico," +
    "guadalajara:mexico,havana:cuba,port-au-prince:haiti,bogota:colombia,medellin:colombia," +
    "caracas:venezuela,quito:ecuador,lima:peru,la paz:bolivia,santiago:chile,buenos aires:argentina," +
    "sao paulo:brazil,rio de janeiro:brazil,brasilia:brazil,montevideo:uruguay,karachi:pakistan," +
    "lahore:pakistan,islamabad:pakistan,kabul:afghanistan,delhi:india,new delhi:india,mumbai:india," +
    "kolkata:india,chennai:india,bangalore:india,bengaluru:india,hyderabad:india,dhaka:bangladesh," +
    "colombo:sri lanka,kathmandu:nepal,male:maldives,yangon:myanmar,mandalay:myanmar,bangkok:thailand," +
    "chiang mai:thailand,phnom penh:cambodia,vientiane:lao,hanoi:viet nam,ho chi minh city:viet nam," +
    "kuala lumpur:malaysia,johor bahru:malaysia,penang:malaysia,jakarta:indonesia,bali:indonesia," +
    "denpasar:indonesia,surabaya:indonesia,manila:philippines,cebu:philippines,davao:philippines," +
    "hong kong:hong kong,taipei:taiwan,beijing:china,shanghai:china,guangzhou:china,shenzhen:china," +
    "chengdu:china,tokyo:japan,osaka:japan,seoul:korea,busan:korea,ulaanbaatar:mongolia," +
    "sydney:australia,melbourne:australia,brisbane:australia,perth:australia,auckland:new zealand," +
    "wellington:new zealand,port moresby:papua new guinea,noumea:new caledonia,suva:fiji"
  )
    .split(",")
    .map((pair) => pair.split(":"))
);

// ---------------------------------------------------------------------------
// Core logic (pure functions; also used by the tests and the command-line tool)
// ---------------------------------------------------------------------------

// Only plain web links may be opened. Feed data is untrusted, and other
// schemes (shortcuts://, file:, javascript:) could do more than open a page.
function safeUrl(u) {
  const s = String(u || "").trim();
  return /^https?:\/\/[^\s"<>]+$/i.test(s) ? s : "";
}

// MFA links must point at MFA's own site.
function isMfaUrl(u) {
  return /^https:\/\/(www\.)?mfa\.gov\.sg\//i.test(safeUrl(u));
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

// "City", "City | context" or "City | context | country".
// The country (for the MFA check) is the third part, else the second part,
// else looked up from CITY_COUNTRIES.
function parseParam(raw) {
  const text = String(raw || "").trim() || CONFIG.defaultCity;
  const [city, context, country] = text.split("|").map((s) => s.trim());
  const c = city || CONFIG.defaultCity;
  return {
    city: c,
    context: context || "",
    country: country || context || CITY_COUNTRIES[c.toLowerCase()] || "",
  };
}

function quoteTerm(s) {
  return `"${s.replace(/"/g, "")}"`;
}

function gdeltTimelineUrl(city, context) {
  const q = `${quoteTerm(city)}${context ? " " + quoteTerm(context) : ""} (${QUERY_TERMS.join(" OR ")})`;
  return (
    "https://api.gdeltproject.org/api/v2/doc/doc?mode=timelinevolraw&format=json" +
    "&timespan=7d&timelinesmooth=0&query=" + encodeURIComponent(q)
  );
}

function gdeltArticlesUrl(city, context) {
  const q = `${quoteTerm(city)}${context ? " " + quoteTerm(context) : ""} (${QUERY_TERMS.join(" OR ")})`;
  return (
    "https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json" +
    "&timespan=24h&maxrecords=75&sort=datedesc&query=" + encodeURIComponent(q)
  );
}

function googleNewsQuery(city, context) {
  return `${quoteTerm(city)}${context ? " " + quoteTerm(context) : ""} (${QUERY_TERMS.join(" OR ")}) when:1d`;
}

function googleNewsRssUrl(city, context) {
  const lang = CONFIG.newsLanguage;
  const country = CONFIG.newsCountry;
  return (
    "https://news.google.com/rss/search?q=" + encodeURIComponent(googleNewsQuery(city, context)) +
    `&hl=${lang}-${country}&gl=${country}&ceid=${country}:${lang}`
  );
}

function googleNewsWebUrl(city, context) {
  const lang = CONFIG.newsLanguage;
  const country = CONFIG.newsCountry;
  return (
    "https://news.google.com/search?q=" + encodeURIComponent(googleNewsQuery(city, context)) +
    `&hl=${lang}-${country}&gl=${country}&ceid=${country}:${lang}`
  );
}

// GDELT dates look like 20261022T101500Z.
function parseGdeltDate(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?$/.exec(String(s || ""));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function tagText(xml, tag) {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return m ? decodeEntities(m[1]) : "";
}

// Minimal RSS parser (Scriptable has no DOMParser).
function parseRss(xml) {
  const items = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[1];
    let title = tagText(body, "title");
    let source = tagText(body, "source");
    // Google News titles end with " - Source Name".
    if (source && title.endsWith(" - " + source)) {
      title = title.slice(0, -(" - " + source).length).trim();
    } else if (!source) {
      const i = title.lastIndexOf(" - ");
      if (i > 0) {
        source = title.slice(i + 3).trim();
        title = title.slice(0, i).trim();
      }
    }
    const pub = Date.parse(tagText(body, "pubDate"));
    items.push({
      title,
      source: source || "Unknown",
      url: safeUrl(tagText(body, "link")),
      date: isNaN(pub) ? null : new Date(pub),
    });
  }
  return items;
}

function parseGdeltArticles(json) {
  const list = (json && json.articles) || [];
  return list.map((a) => ({
    title: decodeEntities(a.title),
    source: a.domain || "Unknown",
    url: safeUrl(a.url),
    date: parseGdeltDate(a.seendate),
  }));
}

// Turns a GDELT raw volume timeline into last-24h vs. prior-6-day numbers.
function summarizeTimeline(json, now) {
  const series = (json && json.timeline && json.timeline[0] && json.timeline[0].data) || [];
  if (!series.length) return null;
  const nowMs = now.getTime();
  const DAY = 24 * 3600 * 1000;
  const daily = [0, 0, 0, 0, 0, 0, 0]; // oldest .. newest (last 24h)
  for (const point of series) {
    const d = parseGdeltDate(point.date);
    if (!d) continue;
    const ageDays = Math.floor((nowMs - d.getTime()) / DAY);
    if (ageDays < 0 || ageDays > 6) continue;
    daily[6 - ageDays] += Number(point.value) || 0;
  }
  const last24h = daily[6];
  const baseline = daily.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
  return { last24h, baseline, daily };
}

// ---- Singapore MFA travel advisories ----

function normalizeName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mfaCountryName(country) {
  const n = normalizeName(country);
  return COUNTRY_ALIASES[n] || n;
}

function mfaCountryUrl(country) {
  return MFA_BASE + mfaCountryName(country).replace(/ /g, "-") + "/";
}

function htmlToText(html) {
  let h = String(html || "");
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(h) || /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(h);
  if (main) h = main[1];
  return decodeEntities(
    h
      .replace(/<(script|style|noscript|svg|nav|header|footer)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

// Finds the country's travel page among the links on MFA's index page.
function findMfaCountryLink(indexHtml, country) {
  const want = mfaCountryName(country);
  const re = /<a\b[^>]*href="([^"]*travel-advisories-notices-and-visa-information\/([a-z0-9-]+)\/?)"[^>]*>([\s\S]*?)<\/a>/gi;
  let best = null;
  let m;
  while ((m = re.exec(indexHtml))) {
    const slug = m[2].replace(/-/g, " ");
    const text = normalizeName(decodeEntities(m[3].replace(/<[^>]+>/g, " ")));
    let score = 0;
    if (text === want || slug === want) score = 3;
    else if (new RegExp(`(^| )${escapeRegex(want)}( |$)`).test(slug + " | " + text)) score = 2;
    if (score > (best ? best.score : 0)) {
      const href = /^https?:/i.test(m[1]) ? m[1] : "https://www.mfa.gov.sg" + (m[1].startsWith("/") ? "" : "/") + m[1];
      if (isMfaUrl(href)) best = { score, url: href };
    }
  }
  return best ? best.url : null;
}

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_RE = new RegExp(`\\b(\\d{1,2}) (${MONTHS}) (20\\d\\d)\\b`, "gi");

function parseMfaPage(html, city, url) {
  const text = htmlToText(html);
  const result = { status: "unreadable", date: null, summary: "", mentionsCity: false, cityNote: "", url };
  if (text.length < 200) return result;

  const sentences = text.replace(/([.!?])\s+/g, "$1\n").split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const rules = [
    ["defer-all", /\bdefer all travel\b/i],
    ["defer-non-essential", /\bdefer (all )?non-essential travel\b/i],
    ["caution", /\b(exercise|remain|stay|be)( extra| heightened| increased| high degree of)? (caution|vigilant|vigilance|alert)\b|\bavoid (large )?(crowds|gatherings|protests|demonstrations)\b/i],
    ["notice", /\btravel notice\b/i],
  ];
  let hit = null;
  for (const [status, re] of rules) {
    const s = sentences.find((x) => re.test(x));
    if (s) {
      hit = { status, sentence: s };
      break;
    }
  }
  result.status = hit ? hit.status : "none";
  if (hit) result.summary = hit.sentence.length > 220 ? hit.sentence.slice(0, 217) + "…" : hit.sentence;
  result.leave = /\b(leave|leaving|depart|departing)\b[^.]{0,80}\b(as soon as possible|immediately|while (it is )?still possible|commercial)/i.test(text);

  // Date: the last date before the advisory sentence, else the first on the page.
  const at = hit ? text.indexOf(hit.sentence) : text.length;
  const dates = [...text.matchAll(DATE_RE)];
  const before = dates.filter((d) => d.index <= at);
  const d = before.length ? before[before.length - 1] : dates[0];
  if (d) result.date = `${d[1]} ${d[2][0].toUpperCase()}${d[2].slice(1).toLowerCase()} ${d[3]}`;

  const cityRe = new RegExp(`(^|[^a-z])${escapeRegex(city.toLowerCase())}([^a-z]|$)`, "i");
  const citySentence = sentences.find((s) => cityRe.test(s));
  result.mentionsCity = !!citySentence;
  if (citySentence) result.cityNote = citySentence.length > 220 ? citySentence.slice(0, 217) + "…" : citySentence;
  return result;
}

async function checkMfa({ city, country, fetchText }) {
  if (!country) return { status: "unreadable", error: "No country set", url: MFA_BASE };
  let url = mfaCountryUrl(country);
  let html;
  try {
    html = await fetchText(url);
  } catch (e) {
    // The guessed address failed; look the country up on the index page.
    const index = await fetchText(MFA_BASE);
    url = findMfaCountryLink(index, country);
    if (!url) throw new Error(`"${country}" not found on MFA site`);
    html = await fetchText(url);
  }
  return parseMfaPage(html, city, url);
}

function mfaInfo(mfa) {
  if (!mfa) return null;
  const lvl = MFA_LEVELS[mfa.status] || MFA_LEVELS.unreadable;
  return { ...lvl, short: mfa.date ? mfa.date.replace(/ 20\d\d$/, "").replace(/^(\d+ \w{3})\w*$/, "$1") : "" };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TERM_PATTERNS = Object.keys(UNREST_TERMS).flatMap((w) =>
  UNREST_TERMS[w].map((term) => ({
    term,
    weight: Number(w),
    re: new RegExp(`(^|[^a-z])${escapeRegex(term)}([^a-z]|$)`, "i"),
  }))
);
const CALM_PATTERNS = CALMING_TERMS.map((t) => new RegExp(`(^|[^a-z])${escapeRegex(t)}([^a-z]|$)`, "i"));

function rateHeadline(title) {
  let severity = 0;
  const matched = [];
  for (const p of TERM_PATTERNS) {
    if (p.re.test(title)) {
      matched.push(p.term);
      severity = Math.max(severity, p.weight);
    }
  }
  if (severity <= 1 && CALM_PATTERNS.some((re) => re.test(title))) severity *= 0.5;
  return { severity, matched };
}

function normalizeTitle(t) {
  return t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

// Keeps recent headlines that mention the city, removes duplicates, rates each.
function prepareHeadlines(items, city, now) {
  const cutoff = now.getTime() - 24 * 3600 * 1000;
  const cityRe = new RegExp(`(^|[^a-z])${escapeRegex(city.toLowerCase())}`, "i");
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it.title) continue;
    if (it.date && it.date.getTime() < cutoff) continue;
    const key = normalizeTitle(it.title);
    if (seen.has(key)) continue;
    seen.add(key);
    const rating = rateHeadline(it.title);
    if (rating.severity === 0) continue;
    // Headlines that name the city count fully; others (matched on article body) count half.
    const mentionsCity = cityRe.test(it.title);
    out.push({ ...it, ...rating, weight: rating.severity * (mentionsCity ? 1 : 0.5) });
  }
  out.sort((a, b) => b.severity - a.severity || (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
  return out;
}

function levelFor(score) {
  return LEVELS.find((l) => score >= l.min);
}

function scoreReport(headlines, volume) {
  const sevSum = headlines.reduce((s, h) => s + h.weight, 0);
  const severeCount = headlines.filter((h) => h.severity >= 3).length;
  const headlinePts = 50 * (1 - Math.exp(-sevSum / 15));
  let score;
  if (volume) {
    const ratio = volume.last24h / Math.max(volume.baseline, 1);
    const spikePts = 30 * clamp((ratio - 1) / 3, 0, 1);
    const volumePts = 20 * (1 - Math.exp(-volume.last24h / 60));
    score = headlinePts + spikePts + volumePts;
  } else {
    score = headlinePts * 1.6; // headlines only: max 80
  }
  if (severeCount >= 3) score = Math.max(score, 55);
  return Math.round(clamp(score, 0, 100));
}

// An official "defer travel" advisory sets a minimum score, higher when it names the city.
function applyMfaFloor(score, mfa) {
  if (!mfa) return score;
  if (mfa.status === "defer-all") return Math.max(score, mfa.mentionsCity ? 55 : 35);
  if (mfa.status === "defer-non-essential" && mfa.mentionsCity) return Math.max(score, 35);
  return score;
}

async function settle(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// fetchText(url) -> Promise<string>. Injected so this runs in Scriptable and Node.
async function buildReport({ city, context = "", country = "", fetchText, now = new Date() }) {
  const errors = [];
  const [timelineRes, rssRes, mfaRes] = await Promise.all([
    settle(fetchText(gdeltTimelineUrl(city, context)).then((t) => JSON.parse(t))),
    settle(fetchText(googleNewsRssUrl(city, context))),
    country ? settle(checkMfa({ city, country, fetchText })) : Promise.resolve({ ok: true, value: null }),
  ]);

  let mfa = mfaRes.value || null;
  if (!mfaRes.ok) {
    errors.push("MFA: " + mfaRes.error);
    mfa = { status: "unreadable", error: mfaRes.error, url: MFA_BASE };
  }

  let volume = null;
  if (timelineRes.ok) volume = summarizeTimeline(timelineRes.value, now);
  else errors.push("GDELT: " + timelineRes.error);

  let items = [];
  if (rssRes.ok) items = parseRss(rssRes.value);
  else errors.push("Google News: " + rssRes.error);

  // Fall back to GDELT's article list if Google News failed.
  if (!rssRes.ok) {
    const art = await settle(fetchText(gdeltArticlesUrl(city, context)).then((t) => JSON.parse(t)));
    if (art.ok) items = parseGdeltArticles(art.value);
    else errors.push("GDELT articles: " + art.error);
  }

  if (!volume && !items.length && errors.length) {
    throw new Error("No sources reachable. " + errors.join("; "));
  }

  const headlines = prepareHeadlines(items, city, now);
  const score = applyMfaFloor(scoreReport(headlines, volume), mfa);
  const level = levelFor(score);
  const sources = new Set(headlines.map((h) => h.source)).size;

  return {
    city,
    context,
    score,
    level: level.name,
    color: level.color,
    reports: headlines.length,
    sources,
    headlines: headlines.slice(0, 10),
    volume,
    country,
    mfa,
    errors,
    link: googleNewsWebUrl(city, context),
    generatedAt: now.toISOString(),
  };
}

// Compares the current score with one from at least 3 hours earlier.
function trendFrom(history, report) {
  const t = new Date(report.generatedAt).getTime();
  const older = history.filter((h) => t - h.t >= 3 * 3600 * 1000);
  const ref = older.length ? older[older.length - 1] : null;
  if (!ref) return { arrow: "", delta: 0 };
  const delta = report.score - ref.score;
  if (delta >= 8) return { arrow: "▲", delta };
  if (delta <= -8) return { arrow: "▼", delta };
  return { arrow: "▶", delta };
}

// ---------------------------------------------------------------------------
// Scriptable widget
// ---------------------------------------------------------------------------

const IS_SCRIPTABLE = typeof ListWidget !== "undefined" && typeof Script !== "undefined";

async function scriptableFetch(url) {
  const req = new Request(url);
  req.timeoutInterval = CONFIG.requestTimeoutSeconds;
  req.headers = { "User-Agent": "Mozilla/5.0 (iPhone) CityUnrestWidget/1.0" };
  const text = await req.loadString();
  const status = req.response && req.response.statusCode;
  if (status && status >= 400) throw new Error("HTTP " + status);
  return text;
}

function cacheStore(city) {
  const fm = FileManager.local();
  const dir = fm.joinPath(fm.documentsDirectory(), "city-unrest");
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  const file = fm.joinPath(dir, city.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json");
  return {
    load() {
      try {
        return fm.fileExists(file) ? JSON.parse(fm.readString(file)) : null;
      } catch (e) {
        return null;
      }
    },
    save(data) {
      fm.writeString(file, JSON.stringify(data));
    },
  };
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const h = Math.round(mins / 60);
  return h < 48 ? h + "h" : Math.round(h / 24) + "d";
}

function formatTime(iso) {
  const df = new DateFormatter();
  df.useNoDateStyle();
  df.useShortTimeStyle();
  return df.string(new Date(iso));
}

function sparkline(daily, color, width, height) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const max = Math.max(1, ...daily);
  const gap = 4;
  const barW = (width - gap * (daily.length - 1)) / daily.length;
  daily.forEach((v, i) => {
    const h = Math.max(2, (v / max) * height);
    ctx.setFillColor(i === daily.length - 1 ? new Color(color) : new Color("#FFFFFF", 0.35));
    const path = new Path();
    path.addRoundedRect(new Rect(i * (barW + gap), height - h, barW, h), 2, 2);
    ctx.addPath(path);
    ctx.fillPath();
  });
  return ctx.getImage();
}

function addText(stack, text, size, opts = {}) {
  const t = stack.addText(text);
  t.font = opts.bold ? Font.boldSystemFont(size) : opts.medium ? Font.mediumSystemFont(size) : Font.systemFont(size);
  t.textColor = opts.color ? new Color(opts.color, opts.alpha == null ? 1 : opts.alpha) : Color.white();
  if (opts.lines) t.lineLimit = opts.lines;
  t.minimumScaleFactor = opts.scale || 0.7;
  return t;
}

function addScoreBlock(stack, report, trend, stale) {
  const top = stack.addStack();
  top.centerAlignContent();
  addText(top, report.city.toUpperCase(), 12, { bold: true, alpha: 0.85, color: "#FFFFFF", lines: 1 });
  top.addSpacer();
  if (trend.arrow) addText(top, trend.arrow, 12, { color: report.color });

  stack.addSpacer(2);
  addText(stack, String(report.score), 40, { bold: true, color: report.color, lines: 1 });
  addText(stack, report.level.toUpperCase(), 14, { bold: true, color: report.color, lines: 1 });
  stack.addSpacer();
  addMfaLine(stack, report);
  addText(stack, `${report.reports} reports · ${report.sources} sources`, 10, { alpha: 0.75, color: "#FFFFFF", lines: 1 });
  addText(stack, (stale ? "⚠︎ cached " : "Updated ") + formatTime(report.generatedAt), 10, {
    alpha: 0.6,
    color: stale ? "#FFCC00" : "#FFFFFF",
    lines: 1,
  });
}

// One line such as "SG MFA: Defer all travel · 10 Jun". Tapping opens the MFA page.
function addMfaLine(stack, report) {
  const info = mfaInfo(report.mfa);
  if (!info) return;
  const row = stack.addStack();
  row.centerAlignContent();
  if (isMfaUrl(report.mfa.url)) row.url = report.mfa.url;
  const city = report.mfa.mentionsCity ? " ⚑" : "";
  addText(row, "SG MFA: ", 10, { bold: true, alpha: 0.75, color: "#FFFFFF", lines: 1 });
  addText(row, info.label + city + (info.short ? " · " + info.short : ""), 10, {
    bold: true,
    color: info.color,
    lines: 1,
    scale: 0.6,
  });
}

function addHeadline(stack, h, size) {
  const row = stack.addStack();
  row.layoutHorizontally();
  row.topAlignContent();
  if (safeUrl(h.url)) row.url = h.url;
  const dotColor = h.severity >= 3 ? "#FF3B30" : h.severity >= 2 ? "#FF9500" : "#FFCC00";
  addText(row, "● ", size - 2, { color: dotColor });
  const col = row.addStack();
  col.layoutVertically();
  addText(col, h.title, size, { medium: true, lines: 2, scale: 0.85 });
  const meta = h.source + (h.date ? " · " + timeAgo(h.date) : "");
  addText(col, meta, size - 2, { alpha: 0.55, color: "#FFFFFF", lines: 1 });
}

function buildWidget(report, trend, stale) {
  const family = config.widgetFamily || "medium";
  const w = new ListWidget();
  w.url = report.link;
  w.refreshAfterDate = new Date(Date.now() + CONFIG.refreshMinutes * 60000);

  // Lock screen widgets
  if (family === "accessoryInline") {
    const info = mfaInfo(report.mfa);
    const mfa = info && info.rank >= 1 ? ` · MFA: ${info.label}` : "";
    w.addText(`${report.city}: ${report.level} (${report.score})${trend.arrow ? " " + trend.arrow : ""}${mfa}`);
    return w;
  }
  if (family === "accessoryCircular") {
    const s = w.addStack();
    s.layoutVertically();
    s.centerAlignContent();
    const n = s.addText(String(report.score));
    n.font = Font.boldSystemFont(20);
    n.centerAlignText();
    const l = s.addText(report.level.slice(0, 4).toUpperCase());
    l.font = Font.systemFont(9);
    l.centerAlignText();
    return w;
  }
  if (family === "accessoryRectangular") {
    const t = w.addText(`${report.city} · ${report.level} ${report.score} ${trend.arrow}`);
    t.font = Font.boldSystemFont(13);
    const info = mfaInfo(report.mfa);
    const showMfa = info && info.rank >= 2;
    if (showMfa) {
      const m = w.addText("SG MFA: " + info.label + (report.mfa.mentionsCity ? " ⚑" : ""));
      m.font = Font.mediumSystemFont(11);
    }
    const top = report.headlines[0];
    const h = w.addText(top ? top.title : "No unrest reports in last 24h");
    h.font = Font.systemFont(11);
    h.lineLimit = showMfa ? 1 : 2;
    return w;
  }

  const bg = new LinearGradient();
  bg.colors = [new Color("#1C1C1E"), new Color(report.color, 0.35)];
  bg.locations = [0.35, 1];
  bg.startPoint = new Point(0, 0);
  bg.endPoint = new Point(1, 1);
  w.backgroundGradient = bg;
  w.setPadding(14, 14, 14, 14);

  if (family === "small") {
    addScoreBlock(w, report, trend, stale);
    return w;
  }

  const main = w.addStack();
  main.layoutHorizontally();
  const left = main.addStack();
  left.layoutVertically();
  left.size = new Size(family === "large" ? 0 : 110, 0);
  addScoreBlock(left, report, trend, stale);

  if (family === "medium") {
    main.addSpacer(10);
    const right = main.addStack();
    right.layoutVertically();
    if (!report.headlines.length) {
      addText(right, "No unrest-related reports in the last 24 hours.", 12, { alpha: 0.7, color: "#FFFFFF" });
    }
    report.headlines.slice(0, 3).forEach((h, i) => {
      if (i) right.addSpacer(5);
      addHeadline(right, h, 11);
    });
    right.addSpacer();
    return w;
  }

  // Large
  if (report.mfa && report.mfa.summary) {
    w.addSpacer(8);
    const box = w.addStack();
    box.layoutVertically();
    if (isMfaUrl(report.mfa.url)) box.url = report.mfa.url;
    addText(box, report.mfa.mentionsCity && report.mfa.cityNote ? report.mfa.cityNote : report.mfa.summary, 10, {
      alpha: 0.8,
      color: "#FFFFFF",
      lines: 2,
      scale: 0.85,
    });
  }
  if (report.volume) {
    w.addSpacer(8);
    addText(w, "Unrest coverage, last 7 days", 10, { alpha: 0.6, color: "#FFFFFF" });
    w.addSpacer(3);
    const img = w.addImage(sparkline(report.volume.daily, report.color, 300, 28));
    img.imageSize = new Size(300, 28);
  }
  w.addSpacer(8);
  if (!report.headlines.length) {
    addText(w, "No unrest-related reports in the last 24 hours.", 12, { alpha: 0.7, color: "#FFFFFF" });
  }
  report.headlines.slice(0, 5).forEach((h, i) => {
    if (i) w.addSpacer(5);
    addHeadline(w, h, 12);
  });
  w.addSpacer();
  return w;
}

function errorWidget(message) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#1C1C1E");
  addText(w, "City Unrest", 13, { bold: true });
  w.addSpacer(4);
  addText(w, message, 11, { alpha: 0.7, color: "#FFFFFF", lines: 6 });
  return w;
}

async function showInApp(report, trend) {
  const table = new UITable();
  table.showSeparators = true;
  const head = new UITableRow();
  head.height = 70;
  head.isHeader = true;
  head.addText(
    `${report.city}: ${report.level} (${report.score}/100) ${trend.arrow}`,
    `${report.reports} reports from ${report.sources} sources · ${formatTime(report.generatedAt)}`
  );
  table.addRow(head);
  for (const h of report.headlines) {
    const row = new UITableRow();
    row.height = 74;
    row.addText(h.title, `${h.source}${h.date ? " · " + timeAgo(h.date) : ""} · ${h.matched.join(", ")}`).titleFont =
      Font.mediumSystemFont(14);
    row.dismissOnSelect = false;
    row.onSelect = () => Safari.open(safeUrl(h.url) || report.link);
    table.addRow(row);
  }
  if (report.mfa) {
    const info = mfaInfo(report.mfa);
    const row = new UITableRow();
    row.height = 110;
    const detail = [
      report.mfa.date ? "Updated " + report.mfa.date : "",
      report.mfa.mentionsCity ? `Mentions ${report.city}: ${report.mfa.cityNote}` : `Does not mention ${report.city}`,
      report.mfa.summary,
      report.mfa.error || "",
    ]
      .filter(Boolean)
      .join("\n");
    const cell = row.addText(`Singapore MFA (${report.country}): ${info.label}`, detail);
    cell.titleColor = new Color(info.color);
    cell.subtitleFont = Font.systemFont(12);
    row.dismissOnSelect = false;
    row.onSelect = () => Safari.open(isMfaUrl(report.mfa.url) ? report.mfa.url : MFA_BASE);
    table.addRow(row);
  }
  if (report.errors.length) {
    const row = new UITableRow();
    row.addText("Some sources failed", report.errors.join("\n"));
    table.addRow(row);
  }
  await table.present();
}

async function main() {
  let param = args.widgetParameter;
  if (config.runsInApp && !param) {
    const a = new Alert();
    a.title = "City Unrest";
    a.message = "Which city? Optionally add context and country: Portland | Oregon | United States";
    a.addTextField("City", CONFIG.defaultCity);
    a.addAction("Check");
    a.addCancelAction("Cancel");
    if ((await a.presentAlert()) === -1) return;
    param = a.textFieldValue(0);
  }
  const { city, context, country } = parseParam(param);
  const cache = cacheStore([city, context, country].filter(Boolean).join("-"));
  const cached = cache.load() || { history: [] };

  let report;
  let stale = false;
  try {
    report = await buildReport({ city, context, country, fetchText: scriptableFetch, now: new Date() });
  } catch (e) {
    if (!cached.report) {
      const w = errorWidget("Couldn't load reports. " + e.message);
      if (config.runsInWidget) Script.setWidget(w);
      else await w.presentMedium();
      return;
    }
    report = cached.report;
    stale = true;
  }

  const history = cached.history || [];
  const trend = trendFrom(history, report);
  if (!stale) {
    history.push({ t: new Date(report.generatedAt).getTime(), score: report.score });
    cache.save({ report, history: history.slice(-96) });
  }

  if (config.runsInWidget) {
    Script.setWidget(buildWidget(report, trend, stale));
  } else {
    await showInApp(report, trend);
  }
}

if (IS_SCRIPTABLE) {
  await main();
  Script.complete();
} else if (typeof module !== "undefined") {
  module.exports = {
    CONFIG,
    parseParam,
    parseRss,
    parseGdeltArticles,
    parseGdeltDate,
    summarizeTimeline,
    rateHeadline,
    prepareHeadlines,
    scoreReport,
    levelFor,
    trendFrom,
    buildReport,
    gdeltTimelineUrl,
    parseMfaPage,
    findMfaCountryLink,
    mfaCountryUrl,
    checkMfa,
    applyMfaFloor,
    htmlToText,
    safeUrl,
    isMfaUrl,
    googleNewsRssUrl,
  };
}
