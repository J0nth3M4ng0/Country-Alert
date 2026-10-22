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

If you installed an earlier test version, uninstall it first: the app is now
signed with a permanent key, and Android won't install it over the old one.
Updates after this install normally.

1. Download the APK: on GitHub open **Actions → Build → the latest run →
   Artifacts → city-unrest-android**, and unzip it.
2. Open `app-release.apk` on your phone and allow installing from that source.
3. Long-press the home screen → **Widgets** → **City Unrest** → drag it onto
   the screen, then enter the city.
4. Resize it to switch between small, medium and large.

Tap the widget to open the news search, a headline to read it, the MFA line
to open the MFA page, and **Updated … ↻** to refresh now. It refreshes on its
own about every 30 minutes. Long-press → **Reconfigure** (or tap a widget that
says "Tap to set up") to change the city. Open the **City Unrest** app to check
any city without adding a widget.

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
  are shown as written, tagged with their language (e.g. `· FR`). Each
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
- MFA advisories are written per country. The ⚑ flag only means the city's
  name appears on the page.
- The MFA reader depends on the wording and layout of mfa.gov.sg. If MFA
  redesigns the site it may show "Check MFA page" until the parser is updated.
- The local-language word lists are short and hand-written. They catch common
  wording but will miss some headlines and occasionally misread one. Corrections
  from native speakers are welcome in `data/unrest-data.json`.
- Local headlines aren't translated. Tap one to open it; your browser can
  translate the page.
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

## Android signing key

Release APKs are signed with a permanent key so updates install over each
other. The key is stored as two GitHub repository secrets, never in the code:

| Secret | Contents |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The keystore file, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | Its password |

Add them under **Settings → Secrets and variables → Actions → New repository
secret**. Without them the build still works but signs with a temporary key
(you'll see a warning in the build log). The "Show signing certificate" step
of each build prints the key's SHA-256 fingerprint.

Keep a private backup of the keystore and password (e.g. in a password
manager). If they're lost, the next version can't be installed as an update;
users would have to uninstall and reinstall.
