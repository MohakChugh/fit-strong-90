# FitStrong 90

A 90-day fitness program built as a frontend-only web app. One Start button runs a voice-guided 60-minute session: mobility, then strength with rests, then cardio. It is planned each day from a short health profile (back pain and sciatica, diabetes, blood pressure) and a daily check-in, and demonstrated by a 3D coach.

## Live App

**[https://MohakChugh.github.io/fit-strong-90/](https://MohakChugh.github.io/fit-strong-90/)**

## Features

- Guided daily session: mobility (15 min) → strength with timed rests → cardio, narrated step by step (what, how, why, breathing, where to feel it) with a recorded, natural-sounding voice
- Daily plan generated from your profile and check-in, with safety rules for back pain, sciatica, diabetes (glucose checks) and high blood pressure
- 3D form demos for every exercise, with the working muscles highlighted and common mistakes replayed in red
- 12-week program in 3 phases (Foundation, Hypertrophy, Strength), with deloads in weeks 4 and 8 and a taper in week 12
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
- three.js (3D form demos, lazy-loaded)
- React Router (hash routing)
- localStorage for persistence

## Development

```bash
npm install
npm run dev
```

### Assets and checks

```bash
node scripts/character/build.mjs --sex=male        # 3D coach from CC0 MakeHuman assets → public/models/
npx tsx --tsconfig tsconfig.app.json scripts/voice/catalog.ts   # every line the coach can say
sh scripts/voice/render-all.sh                      # Kokoro-82M voice packs → public/voice/
npm test                                            # engine, voice, motion and data tests
npm run e2e -- --viewports=320x568,390x844          # full journey with screenshots (needs npm run dev)
node scripts/e2e/autoplay.mjs --url=http://127.0.0.1:5173/fit-strong-90/ --coalesce=300   # every 3D demo starts by itself
node scripts/e2e/voice-start.mjs --url=http://127.0.0.1:5173/fit-strong-90/ --delay=6500   # the coach's voice starts on the first tap, even on a slow network
```

How the 3D clips are authored and checked: [docs/motion/authoring.md](docs/motion/authoring.md).

## Build

```bash
npm run build
npm run preview
```

## Deployment

Deployed automatically to GitHub Pages via GitHub Actions on push to `main`.

## Credits

- The 3D coach is built from [MakeHuman / MPFB2](https://github.com/makehumancommunity/mpfb2) assets (base mesh, targets, rig and weights), released under CC0 1.0.
- The coach voice is pre-rendered with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0) through `kokoro-js`.
