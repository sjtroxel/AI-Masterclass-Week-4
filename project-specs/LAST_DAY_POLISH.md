# Last Day Polish — Three Additions (PLAN-LAST-DAY-POLISH)

Three self-contained improvements to ChronoQuizzr before AI Masterclass #5.
None of these changes touch shared types, API routes, or the scoring formula.
All are safe to implement independently in any order.

---

## Addition 1 — Performance Grade on FinalScoreScreen

### Summary

After a 5-round game the player sees their raw numeric total and the Round Logbook
table. A **performance grade** adds a thematic label beneath the total score so the
player immediately knows how well they did relative to the maximum 25,000. The labels
use the historical/cartographic vocabulary of the rest of the app.

### Grade Table

| Score Range | Grade |
|---|---|
| 24,950 – 25,000 | Super Seismic Champion |
| 24,500 – 24,949 | The Omniscient Chronicler |
| 24,000 – 24,499 | Grand Cartographer |
| 23,000 – 23,999 | Master Navigator |
| 22,000 – 22,999 | Royal Geographer |
| 20,000 – 21,999 | Seasoned Explorer |
| 18,000 – 19,999 | Veteran Historian |
| 15,000 – 17,999 | Accomplished Scholar |
| 10,000 – 14,999 | Apprentice Archivist |
| 5,000 – 9,999 | Wandering Scribe |
| 1,000 – 4,999 | Lost Traveller |
| 0 – 999 | Bewildered Stupid Tourist |

### Files Changed

**`client/src/components/FinalScoreScreen.tsx`** — only file affected.

Add a `getGrade(score: number): string` helper above the component (pure function,
no import needed). Insert one new line between the raw score display and the
"out of 25,000 points" subtitle:

```tsx
// After the score number, before "out of 25,000":
<p className="font-ui text-accent text-sm tracking-widest uppercase">
  {getGrade(totalScore)}
</p>
```

### Test Impact

`FinalScoreScreen.test.tsx` — no existing test asserts the absence of a grade label,
so no tests break. Optionally add 1–2 snapshot-style assertions to verify grade
text appears. The 5 existing tests remain valid.

---

## Addition 2 — Location Names in the Round Logbook

### Summary

`FinalScoreScreen` currently shows Round / Distance / Score. After a 5-round game
the player has no way to recall which event corresponded to which score. Adding
the `locationName` to each row makes the ledger genuinely informative.

`locationName` is already revealed to the player during the game in `ResultsOverlay`
(post-guess). Carrying it forward into `roundHistory` does not violate Rule 04
(coordinate privacy) — coordinates are not involved.

### Mobile Layout Strategy

Adding a 4th column would overflow the table on small screens. Instead, the location
name is displayed as a **second line inside the existing Round cell**, styled smaller
and dimmer than the round number. `truncate` + a `max-w` cap prevents the text from
pushing the numeric columns off the right edge.

```
┌──────────────────────┬───────────┬────────┐
│ Round 1              │ Distance  │  Score │
│ Brandenburg Gate, …  │  1,420 km │  3,481 │
├──────────────────────┼───────────┼────────┤
│ Round 2              │   312 km  │  4,291 │
│ Kill Devil Hills, …  │           │        │
└──────────────────────┴───────────┴────────┘
```

### Files Changed

**`client/src/components/FinalScoreScreen.tsx`**

- Add `locationName: string` to the `RoundEntry` interface.
- In the table `<tbody>`, change the Round cell to a two-line layout.

**`client/src/components/GameBoard.tsx`**

- When pushing to `roundHistory` inside `handleNextRound()`, include
  `locationName: currentEvent.locationName`. `currentEvent` is guaranteed non-null
  at that point (the round just completed).

### Test Impact

`FinalScoreScreen.test.tsx` — the inline `RoundEntry` objects used by tests need
`locationName` added (e.g. `'Test Location'`). The 5 existing tests continue to
pass; no new assertions required.

`GameBoard.test.tsx` — the `roundHistory` push is exercised by the existing
"advances to round 2 after next-round" test. That test checks `FinalScoreScreen`
renders but does not inspect individual `RoundEntry` fields, so it continues to
pass after the field addition.

---

## Addition 3 — Seed Event Expansion

### Summary

The current `events.json` has 10 events concentrated in Europe (7 of 10). Two
continents — **Africa** and **South/Southeast Asia** — are entirely absent.
Adding 4 new events fills the most prominent geographic gaps and gives the
dynamic pool more variety when events are randomly selected.

### New Events

All clues follow Rule 06 (Clue Obfuscation Standard): no proper nouns, no city
names, no country names, no monument names, no direct geographic identifiers.

---

#### Event A — Giza Necropolis, c. 2560 BCE (easy)

```json
{
  "id": "giza-pyramids-2560bc",
  "year": "c. 2560 BCE",
  "locationName": "Giza Necropolis, Giza, Egypt",
  "clue": "On a limestone plateau at the edge of an immense desert, tens of thousands of workers organised into rotating labour teams spent decades quarrying and hauling millions of cut stone blocks to build a set of monumental royal tombs aligned with astronomical precision — creating structures so vast they remained the tallest objects made by human hands for nearly four thousand years.",
  "hiddenCoords": { "lat": 29.9792, "lng": 31.1342 },
  "difficulty": "easy",
  "source_url": "https://en.wikipedia.org/wiki/Giza_pyramid_complex"
}
```

**Obfuscation audit:** "limestone plateau," "immense desert," "monumental royal
tombs," "astronomical precision" — no Egypt, no Nile, no pyramid, no pharaoh name. ✓

---

#### Event B — Waterloo, 1815 (medium)

```json
{
  "id": "waterloo-1815",
  "year": "1815",
  "locationName": "Waterloo, Belgium",
  "clue": "On a rolling agricultural plateau south of a major northern trading hub, two armies — one commanded by a recently escaped island exile, the other by a coalition of allied European powers — clashed in driving rain across fields of rye, ending two decades of continental warfare and consigning the defeated commander to permanent exile on a remote island in the southern ocean.",
  "hiddenCoords": { "lat": 50.6797, "lng": 4.4120 },
  "difficulty": "medium",
  "source_url": "https://en.wikipedia.org/wiki/Battle_of_Waterloo"
}
```

**Obfuscation audit:** "rolling agricultural plateau," "northern trading hub" (Brussels,
unnamed), "island exile" (Napoleon, unnamed), "remote island in the southern ocean"
(St Helena, unnamed) — no Belgium, no Waterloo, no Wellington, no Napoleon. ✓

---

#### Event C — Hagia Sophia / Fall of Constantinople, 1453 (hard)

```json
{
  "id": "constantinople-1453",
  "year": "1453",
  "locationName": "Hagia Sophia, Istanbul, Turkey",
  "clue": "After a fifty-three-day siege, the forces of a rising eastern empire breached the ancient land walls of a city that had served as the capital of a Christian realm for over a thousand years — ending the last remnant of a once-vast empire and converting its great domed basilica into a place of Islamic worship, an event historians mark as the close of the medieval age.",
  "hiddenCoords": { "lat": 41.0086, "lng": 28.9802 },
  "difficulty": "hard",
  "source_url": "https://en.wikipedia.org/wiki/Fall_of_Constantinople"
}
```

**Obfuscation audit:** "ancient land walls" (no Constantinople), "Christian realm for
over a thousand years" (Byzantine Empire, unnamed), "great domed basilica" (Hagia
Sophia, unnamed), "rising eastern empire" (Ottoman, acceptable as empire-era term). ✓

---

#### Event D — Taj Mahal, c. 1653 (easy)

```json
{
  "id": "taj-mahal-1653",
  "year": "c. 1653",
  "locationName": "Taj Mahal, Agra, India",
  "clue": "On a sweeping bend of a wide river in a vast alluvial plain, a grief-stricken emperor commanded twenty thousand craftsmen to spend two decades raising a mausoleum of white marble for his favourite wife — its perfect bilateral symmetry and flanking minarets reflected in a long ornamental pool, drawing artisans from across the known world and blending classical West Asian, imperial, and indigenous architectural traditions into what poets called the jewel set in the forehead of the earth.",
  "hiddenCoords": { "lat": 27.1751, "lng": 78.0421 },
  "difficulty": "easy",
  "source_url": "https://en.wikipedia.org/wiki/Taj_Mahal"
}
```

**Obfuscation audit:** "wide river in a vast alluvial plain" (Yamuna/Indo-Gangetic,
unnamed), "mausoleum of white marble" (no "Taj Mahal"), "flanking minarets" ✓
("minarets" is an architectural term, not a place name), "jewel set in the forehead
of the earth" (historical poetic epithet). No India, no Agra, no Mughal, no shah
names. ✓

---

### Post-Expansion Pool

After adding these 4 events the seed pool reaches **14 events**:

| Continent | Count | Events |
|---|---|---|
| Europe | 7 | Berlin Wall, Sarajevo, Hastings, Bastille, Kitty Hawk¹, Chernobyl, Waterloo |
| Africa | 1 → **2** | *(none)* → **Giza** |
| Asia | 1 → **3** | Hiroshima, **Constantinople**, **Taj Mahal** |
| Oceania | 1 | Sydney Opera House |
| South America | 1 | Machu Picchu |
| North America | 1 | Kitty Hawk¹ |

¹ Kitty Hawk / Kill Devil Hills is North American; counted in both rows for clarity.

### Files Changed

**`server/data/events.json`** — append the 4 new event objects. No other files.

### Test Impact

`server/routes/game.test.ts` — uses `server/tests/fixtures/mockEvents.json` (a
separate 5-event fixture, not `events.json`). The integration tests are unaffected.
No test changes required.

---

## Implementation Order

These additions are independent. Suggested order to keep review clean:

1. **Addition 3** — data-only, zero risk, no TypeScript changes
2. **Addition 1** — UI-only, one file, no prop/interface changes
3. **Addition 2** — two files, small interface change, requires test fixture update

## Verification

```bash
# Server tests (should remain 39/39 — events.json not in test path):
npm test --prefix server

# Client tests (FinalScoreScreen fixture needs locationName; should be 30/30):
npm test --prefix client

# TypeScript clean:
cd client && npx tsc -b --noEmit
cd server && npx tsc --noEmit
```
