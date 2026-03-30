# FitStrong 90

A 90-day fitness transformation tracker built as a polished, frontend-only web app. Track workouts, monitor progress, and follow a structured 3-phase program from Foundation through Strength.

## Live App

**[https://MohakChugh.github.io/fit-strong-90/](https://MohakChugh.github.io/fit-strong-90/)**

## Features

- 90-day structured program with 3 phases: Foundation, Hypertrophy, Strength
- 6-day training split (Back, Chest, Legs, Shoulders, Arms, Core+Cardio)
- Per-set tracking with weight, reps, and RPE
- Rest timer
- Exercise library with instructions and YouTube demos
- Progress charts (volume, bodyweight, waist, PRs)
- Workout history calendar
- Data export/import (JSON)
- Light and dark mode
- Fully offline - all data stored in browser localStorage
- Mobile-responsive design

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui
- Recharts
- React Router (hash routing)
- localStorage for persistence

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deployment

Deployed automatically to GitHub Pages via GitHub Actions on push to `main`.
