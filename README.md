# City Unrest Widget

Phone widgets for **iPhone** and **Android** that show the current level of
civil unrest in a city from open-source news reporting, plus the
**Singapore MFA** travel advisory for that city's country.

| Size | Shows |
| --- | --- |
| Small | Score (0–100), level, trend arrow, MFA advice, report and source counts |
| Medium | The above plus the top 3 headlines |
| Large | The above plus the MFA advisory text, a 7-day coverage chart and the top 5 headlines |
| iPhone lock screen | Score and level, MFA advice when there is one |

Levels: **Calm** (0–14) · **Low** (15–34) · **Elevated** (35–54) · **High** (55–74) · **Severe** (75+)

MFA line: **Defer all travel** · **Defer non-essential travel** · **Exercise caution** ·
**Travel notice** · **No advisory**, with the advisory date. **⚑** means the
advisory names your city. Tap the line to open the MFA page.

## Choosing a city

Type a city, e.g. `Nairobi`. Optionally add context and a country, separated by bars:

```
Portland | Oregon | United States
```

- **Context** narrows the news search for cities that share a name.
- **Country** is used for the MFA check and to pick the local news language.
  About 170 major cities are filled in automatically; otherwise the context is
  tried, so `Lagos | Nigeria` also works.
- **Local spellings** go after `/`: `Moscow / Москва`, `Cologne / Köln`. Major
  cities already know theirs (Москва, 東京, القاهرة, München…).

## Android

Each build is signed with a temporary key, so Android won't install a new
version over an old one. **Uninstall the previous version first**, then install
the new one. Your widgets and their cities are removed with it, so add them again.

1. Download the APK: on GitHub open **Actions → Build → the latest run →
   Artifacts → city-unrest-android**, and unzip it.
2. Open `app-release.apk` on your phone and allow installing from that source.
3. Long-press the home screen → **Widgets** → **City Unrest** → add it. On
   Android 12 and newer it appears straight away saying **Tap to set up**; tap
   it and enter the city. (Older Android asks for the city as you add it.)
4. Resize it to switch between small, medium and large.

Tap the widget to open the news search, a headline to read it, the MFA line
to open the MFA page, and **Updated … ↻** to refresh now. It refreshes on its
own about every 30 minutes. Long-press → **Reconfigure** (or tap a widget that
says "Tap to set up") to change the city. Open the **City Unrest** app to check
any city without adding a widget.

If the widget stops updating on its own, open the **City Unrest** app: it shows
when each widget last updated, any problem, and whether the phone is limiting
background updates. Tap **Allow background updates** if it appears. Some phones
(OnePlus, Samsung, Xiaomi) hold back background work for apps installed outside
the Play Store; on OnePlus also check **Settings → Apps → City Unrest → Battery
→ Allow background activity**. Tapping **↻** always refreshes straight away.

Requires Android 8.0 or newer. To build it yourself, open the `android/` folder
in Android Studio, or run `./gradlew assembleRelease` there.

## iPhone (about 2 minutes)

1. Install the free [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) app.
2. In Scriptable tap **+**, paste the contents of [`widget/CityUnrest.js`](widget/CityUnrest.js),
   and name the script `City Unrest`.
3. Run it once in the app to try any city.
4. Long-press the home screen → **+** → **Scriptable** → pick a size → **Add Widget**.
5. Long-press the new widget → **Edit Widget**:
   - **Script**: `City Unrest`
   - **When Interacting**: `Open URL` (tapping opens the full news search)
   - **Parameter**: the city, as described above.

Add several widgets with different parameters to watch several cities.

## How it works

Every ~30 minutes (the phone decides the exact timing) the widget pulls three
free, keyless sources:

- **[GDELT](https://www.gdeltproject.org/)**: a global monitor of news in
  100+ languages. The widget asks for the 7-day volume of articles that
  mention the city alongside unrest terms, and compares the last 24 hours
  with the previous 6-day average to detect spikes.
- **Google News RSS**: headlines from the last 24 hours, from the city's
  local-language edition (e.g. French for Paris, Japanese for Tokyo, Hindi and
  English for Delhi) plus the international English edition. Local headlines
  are translated into English and shown as **[Translated] …**, tagged with
  their language (e.g. `· FR`); the app view also shows the original. Each
  headline is rated by its strongest term, in its own language and English:
  - severity 3: *killed, shooting, curfew, state of emergency, coup…*
  - severity 2: *riot, clashes, tear gas, looting, arrests, unrest…*
  - severity 1: *protest, strike, blockade, rally…* (halved if "peaceful")
- **[Singapore MFA](https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/)**:
  the country's travel page. The widget reads the advice ("defer all travel",
  "defer non-essential travel", "exercise caution / remain vigilant", or a
  travel notice), its date, and whether the city is named. If the page
  address can't be guessed from the country name, it looks the country up on
  MFA's index page. If the page can't be read it says **Check MFA page**
  rather than claiming there is no advisory.

Only headlines that name the city count. Headlines that also name another
country, its people or one of its cities are skipped, so a capital's name
used for its government ("Brasília condemns the crackdown in Caracas") doesn't
count as unrest in that city. Translated headlines are checked again in English.

The score combines headline severity (up to 50 points), the coverage spike (up
to 30) and the absolute coverage volume (up to 20). Three or more severity-3
headlines force at least **High**. An MFA "defer all travel" advisory sets a
minimum of **Elevated** (35), or **High** (55) if it names the city; "defer
non-essential travel" naming the city sets a minimum of 35.

If Google News fails, GDELT's article list is used for headlines instead. If
everything fails, the last good result is shown, marked "cached".

Local-language news covers 21 languages: Arabic, Chinese, Dutch, English,
French, German, Greek, Hebrew, Hindi, Indonesian, Italian, Japanese, Korean,
Polish, Portuguese, Russian, Spanish, Thai, Turkish, Ukrainian and Vietnamese.
Countries in other languages get English news only. Turn it off with the
**Also read news in the local language** box (Android) or
`localNews: false` at the top of the iPhone script.

## Limits

- Keyword-based: it measures *reporting about* unrest, not unrest itself.
  Big cities and anniversaries can inflate scores; unreported events won't show.
- The "other country" check uses English country names plus city names in
  several scripts. Without translation, a foreign country written only in the
  local language (e.g. "Ucrânia") can slip through. It can also skip a local
  story that happens to name another country.
- GDELT's 7-day coverage count still includes articles that name the city
  anywhere, so capitals can show slightly higher coverage.
- MFA advisories are written per country. The ⚑ flag only means the city's
  name appears on the page.
- The MFA reader depends on the wording and layout of mfa.gov.sg. If MFA
  redesigns the site it may show "Check MFA page" until the parser is updated.
- The local-language word lists are short and hand-written. They catch common
  wording but will miss some headlines and occasionally misread one. Corrections
  from native speakers are welcome in `data/unrest-data.json`.
- Translation uses Google Translate's free web service (the one
  translate.google.com uses). It's unofficial and Google may limit or change
  it; when it's unavailable the original headlines are shown. Foreign headlines
  are sent to Google to translate. Turn it off with the **Translate foreign
  headlines** box (Android) or `translate: false` (iPhone).
- Don't rely on it for safety decisions — check official advisories and local
  sources.

## Development

```sh
npm test                    # iPhone widget tests (sample data in test/fixtures)
npm run check -- "Paris"    # print a live report from your computer
cd android && ./gradlew testDebugUnitTest assembleRelease   # Android tests + APK
```

Word lists, news editions and city names live in `data/unrest-data.json`,
shared by both apps. After editing it, run `node scripts/sync-data.js` to copy
it into the iPhone script (the tests fail if you forget).

The iPhone widget (`widget/CityUnrest.js`) and the Android app
(`android/app/src/main/java/.../core/`) contain the same logic in JavaScript
and Kotlin. Both test suites use the same sample data and check for the same
score, so change them together.

`android/jvm-check` compiles the Android code and runs its tests without the
Android SDK (against Robolectric's copy of the framework). It's for
environments where Google's Android downloads aren't available.

