<p align="center">
  <img src="public/logo.png" alt="Kishin Trails Logo" width="200"/>
</p>

# Kishin Trails Frontend

[![CI](https://github.com/KishinTrails/kishin-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/KishinTrails/kishin-frontend/actions/workflows/ci.yml)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Ionic](https://img.shields.io/badge/Ionic-8.x-3880FF?logo=ionic)](https://ionicframework.com/)
[![MapLibre](https://img.shields.io/badge/MapLibre-5.x-3F769E?logo=maplibre)](https://maplibre.org/)

## ⚠️ WARNING: Under Heavy Development ⚠️

**This project is currently under active and heavy development. It is NOT ready for general use and may contain bugs, incomplete features, or breaking changes. Use at your own risk.**

Mobile-first Vue 3 application for exploring and tracking hiking trails with fog-of-war exploration mechanics. Part of the Kishin Trails project.

## Features

- **Map** - MapLibre GL map with three styles (Standard, Ukiyo-e, Ukiyo Toner), fog of war over
  the unexplored S2 cells, POI markers (peaks, natural areas, industrial zones), and Perlin
  noise and tile selection overlays for tuning. Its left panel holds the settings in foldable
  groups
- **GPS tracking** (Android app) - A native background service records each newly explored S2
  cell to the API, screen on or off; the panel's Tracking group starts and stops it
- **Athlete pages** - Overview (activity calendar, distance and moving time per week), Body
  (fat ratio, muscle mass, weight), Activities (list, and each activity with its map, charts
  and laps)
- **Training plan** - Progression of the active plan, week by week, with the completion of
  each training against a Garmin run
- **Single account** - JWT login; an expired or refused token leads back to the login page
- **POI cache** - Cell types kept in localStorage, prefetched once after login
- **Themes** - The other pages follow the map style: light for Standard, navy and parchment
  for the two Ukiyo styles

## Tech Stack

- **Framework**: Vue 3 with Composition API
- **UI**: Ionic Framework 8
- **Language**: TypeScript 5
- **Build**: Vite 7
- **Map**: MapLibre GL
- **Geospatial**: S2 (Google's spherical geometry library)
- **Testing**: Vitest
- **Mobile**: Capacitor 8 (Android)

## Prerequisites

- Node.js 25.x or later
- npm 10.x or later
- [kishin-api](https://github.com/KishinTrails/kishin-api) backend running (for API access)

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

Start the development server with hot reload:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`. Configure `VITE_API_BASE` in a `.env` file to point at your local or remote API (e.g. `VITE_API_BASE=http://localhost:8000`).

### Build for Production

```bash
npm run build
```

Production builds are output to the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test:unit` | Run unit tests with Vitest |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint and TypeScript type check |

## API Integration

This frontend consumes the [kishin-api](https://github.com/KishinTrails/kishin-api) REST API.

### Authentication

- **POST** `/auth/login` - Login to the API's single account (returns a JWT token). The app
  reads the token's expiry: an expired token leads to the login page, and GPS tracking does
  not start when the token expires within 24 hours. When a protected route answers 401 (a
  password change or a new `SECRET_KEY` on the server), the app deletes the token and
  returns to the login page

### Map

- **GET** `/trails/explored` - The explored S2 cells
- **POST** `/trails/explored` - Record a newly explored S2 cell (sent by the Android tracking
  service)
- **GET** `/poi/bycell?s2Cell={cell}`, `/poi/bycells?s2Cells=…` - POIs of one or several cells
- **GET** `/poi/prefetch` - Every tile with an active POI type, for the cache
- **POST** `/noise/cells` - Perlin noise values, for the noise overlay

### Athlete and plan

- **GET** `/athlete/activities`, `/athlete/activities/daily`, `/athlete/activities/{id}` (and
  its `/track` and `/records`), `/athlete/measures`
- **GET** `/plan` - The active plan's progression
- **GET** `/plan/trainings/{id}/candidates`, **POST**/**DELETE** `/plan/trainings/{id}/complete`

All protected endpoints require `Authorization: Bearer <token>` header.

## Mobile Development

### Build Android App

```bash
npm run build:android    # web build, cap sync, then gradlew clean build in android/
```

Or sync the web assets and build from Android Studio:

```bash
npx cap sync android
npx cap open android
```

The Android `versionName` and `versionCode` come from `version` in `package.json`.

### Capacitor Configuration

Key settings:
- `capacitor.config.ts`: `androidScheme: "https"`; `CapacitorHttp` sends `fetch` requests
  through Android's HTTP client. Cleartext HTTP and mixed content are not allowed: the API
  and the tile servers are reached over HTTPS.
- `AndroidManifest.xml`: `allowBackup="false"`, so the WebView storage holding the login
  token is not copied into the device backup.

### Content Security Policy

`npm run build` adds a `Content-Security-Policy` meta tag to `index.html` (see
`vite.config.ts`): scripts from the app only, MapLibre's `blob:` worker, and requests to the
app, the origin of `VITE_API_BASE` and the map tile servers. A new external host the app
loads from must be added there. The development server runs without the policy.

## Testing

### Unit Tests

```bash
npm run test:unit
```

Unit tests use Vitest with jsdom environment. Test files are located alongside source files with `.spec.ts` extension.

### Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory.

## Code Quality

### Linting

```bash
npm run lint
```

Runs ESLint with Vue and TypeScript plugins, plus TypeScript type checking.

### Type Checking

```bash
npx vue-tsc --noEmit
```

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and pull request to `main`:

1. Install dependencies
2. Run linting
3. Run TypeScript type check
4. Run unit tests
5. Build production bundle

## Environment Variables

Configure via a `.env` file in the project root:

- `VITE_API_BASE` — Base URL of the kishin-api backend (e.g. `http://localhost:8000`)
- `VITE_DEFAULT_CENTER_LAT`, `VITE_DEFAULT_CENTER_LON` — Where the map opens before a GPS
  position is known, in degrees. Central Paris when either is missing or invalid. Vite writes
  the values into the built JavaScript, so the built app contains them; `.env` itself is
  git-ignored.
- `BASE_URL` — App base path, used by the router in production deployments

## 🧪 Quality and Testing

Kishin Trails uses **AI-assisted development** tools to accelerate coding, followed by **human validation** and **automated tests** for correctness.

- Vitest for unit tests
- ESLint + TypeScript for code quality

---

## 📂 Related Projects

- [kishin-api](https://github.com/KishinTrails/kishin-api) - Backend API service
- [kishin-frontend](https://github.com/KishinTrails/kishin-frontend) - This repository

---

## 📜 License

This project is released under the [PolyForm Noncommercial License 1.0.0](LICENSE). Any
noncommercial purpose is permitted, which the licence spells out as including personal
study, hobby projects and use by charities, schools, public research organisations and
government bodies. It grants no licence for commercial use. The `LICENSE` file is the
terms; this paragraph is not.

---

*© 2026 Kishin Trails. Built with care, code, and a spirit to explore.*
