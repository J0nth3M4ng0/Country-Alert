# City Unrest Widget

An iPhone home-screen and lock-screen widget that shows the current level of
civil unrest in a city, based on open-source news reporting.

| Size | Shows |
| --- | --- |
| Small | Score (0–100), level, trend arrow, report and source counts |
| Medium | The above plus the top 3 headlines |
| Large | The above plus a 7-day coverage chart and the top 5 headlines |
| Lock screen | Score and level (circular, inline, or with the top headline) |

Levels: **Calm** (0–14) · **Low** (15–34) · **Elevated** (35–54) · **High** (55–74) · **Severe** (75+)

## Install (about 2 minutes)

1. Install the free [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) app.
2. In Scriptable tap **+**, paste the contents of [`widget/CityUnrest.js`](widget/CityUnrest.js),
   and name the script `City Unrest`.
3. Run it once in the app to try any city.
4. Long-press the home screen → **+** → **Scriptable** → pick a size → **Add Widget**.
5. Long-press the new widget → **Edit Widget**:
   - **Script**: `City Unrest`
   - **When Interacting**: `Open URL` (tapping opens the full news search)
   - **Parameter**: the city, e.g. `Nairobi`. For ambiguous names, add context
     after a bar: `Portland | Oregon`.

Add several widgets with different parameters to watch several cities.

## How it works

Every ~30 minutes (iOS decides the exact timing) the widget pulls two free,
keyless sources:

- **[GDELT](https://www.gdeltproject.org/)**: a global monitor of news in
  100+ languages. The widget asks for the 7-day volume of articles that
  mention the city alongside unrest terms, and compares the last 24 hours
  with the previous 6-day average to detect spikes.
- **Google News RSS**: headlines from the last 24 hours. Each headline is
  rated by its strongest term:
  - severity 3: *killed, shooting, curfew, state of emergency, coup…*
  - severity 2: *riot, clashes, tear gas, looting, arrests, unrest…*
  - severity 1: *protest, strike, blockade, rally…* (halved if "peaceful")

The score combines headline severity (up to 50 points), the coverage spike (up
to 30) and the absolute coverage volume (up to 20). Three or more severity-3
headlines force at least **High**. If Google News fails, GDELT's article list
is used for headlines instead. If everything fails, the last good result is
shown, marked "cached".

Tune the terms, levels, news edition (`newsLanguage` / `newsCountry`) and
refresh interval at the top of `widget/CityUnrest.js`.

## Limits

- Keyword-based: it measures *reporting about* unrest, not unrest itself.
  Big cities and anniversaries can inflate scores; unreported events won't show.
- English terms by default. For non-English coverage change the Google News
  edition and add local-language terms.
- Don't rely on it for safety decisions — check official advisories and local
  sources.

## Development

```sh
npm test                    # unit tests with recorded sample data
npm run check -- "Paris"    # print a live report from your computer
```

The widget file runs unchanged in Node (see `scripts/load-widget.js`), so all
parsing and scoring logic is tested outside Scriptable.
