<p align="center">
  <img src="logo.png" alt="Kishin Logo" width="200"/>
</p>

# Kishin Frontend

[![CI](https://github.com/KishinTrails/kishin-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/KishinTrails/kishin-frontend/actions/workflows/ci.yml)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Ionic](https://img.shields.io/badge/Ionic-8.x-3880FF?logo=ionic)](https://ionicframework.com/)
[![MapLibre](https://img.shields.io/badge/MapLibre-5.x-3F769E?logo=maplibre)](https://maplibre.org/)

## ⚠️ WARNING: Under Heavy Development ⚠️

**This project is currently under active and heavy development. It is NOT ready for general use and may contain bugs, incomplete features, or breaking changes. Use at your own risk.**

Mobile-first Vue 3 application for exploring and tracking hiking trails with fog-of-war exploration mechanics. Part of the Kishin project.

## Features

- **Interactive Map** - MapLibre GL-based map with OpenStreetMap tiles
- **Fog of War** - Track explored areas with H3 geospatial indexing
- **POI Markers** - Display points of interest (peaks, natural areas, industrial zones)
- **Authentication** - JWT-based login/logout with protected routes
- **Offline Caching** - LocalStorage persistence for POI data
- **Mobile Ready** - Ionic Framework UI with Capacitor for Android builds
- **Dark Mode** - System-aware dark theme support

## Tech Stack

- **Framework**: Vue 3 with Composition API
- **UI**: Ionic Framework 8
- **Language**: TypeScript 5
- **Build**: Vite 7
- **Map**: MapLibre GL
- **Geospatial**: H3 (Uber's hexagonal hierarchical spatial index)
- **Testing**: Vitest (unit), Cypress (e2e)
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

The app will be available at `http://localhost:5173`. The Vite config proxies API requests to `http://localhost:8000` (see `vite.config.ts`).

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

- **POST** `/auth/login` - User login (returns JWT token)
- **GET** `/auth/me` - Get current user (protected)

### Trails

- **GET** `/trails/explored` - Get user's explored H3 cells (protected)

### POI (Points of Interest)

- **GET** `/poi/bycell?h3Cell={cell}` - Get POI for single H3 cell
- **GET** `/poi/bycells?h3Cells={cell1}&h3Cells={cell2}...` - Batch fetch POIs (up to 100 cells)

All protected endpoints require `Authorization: Bearer <token>` header.

## Mobile Development

### Build Android App

```bash
# Sync web assets to Android project
npx cap sync android

# Open in Android Studio
npx cap open android
```

Then build the APK from Android Studio.

### Capacitor Configuration

Key settings in `capacitor.config.ts`:
- `cleartext: true` - Required for loading map tiles over HTTP
- `allowMixedContent: true` - Android-specific mixed content allowance

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

Configure via `vite.config.ts` proxy settings or environment variables:

- API base URL: Configured in service modules (proxied to `http://localhost:8000` in dev)
- Base URL: Set via `BASE_URL` environment variable

## 🧪 Quality and Testing

Kishin uses **AI-assisted development** tools to accelerate coding, followed by **human validation** and **automated tests** for correctness.

- Vitest for unit tests
- Cypress for e2e tests
- ESLint + TypeScript for code quality

---

## 📂 Related Projects

- [kishin-api](https://github.com/KishinTrails/kishin-api) - Backend API service
- [kishin-frontend](https://github.com/KishinTrails/kishin-frontend) - This repository

---

## 📜 License

This project is released under the [MIT License](LICENSE).

---

*© 2026 Kishin Trails. Built with care, code, and a spirit to explore.*
