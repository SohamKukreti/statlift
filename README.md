# Statlift

Turn a Hevy CSV export into an interactive dashboard of your training: strength trends (estimated 1RM),
personal records, muscle balance, habits and streaks. Everything runs in the browser; the file never leaves it.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/, host anywhere
```

## Get your data

Hevy → Profile → Settings → Export & Import Data → Export Workouts. Drop the CSV on the page.
kg and lbs exports both work. Warm-up sets are left out of strength numbers.

## Where things live

- `src/lib/parse.ts` – CSV → workouts (date formats, units, set types)
- `src/lib/analytics.ts` – e1RM (Epley), PRs, streaks, strength index, weekly series
- `src/lib/muscles.ts` – exercise → muscle rules (users can override in the app)
- `src/lib/route.ts` – page links (home, lift, records, calendar, balance, habits)
- `src/screens/*` – the five screens
