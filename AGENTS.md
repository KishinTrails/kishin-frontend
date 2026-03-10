# Kishin Frontend - Developer Guide for Agents

## Project Overview
Vue 3/Ionic mobile frontend for the Kishin project. Communicates with the kishin-api backend for OSM trail data, user authentication, and geo-spatial operations.

## Relationship with kishin-api

The frontend consumes the kishin-api REST API. Key integration points:
- **Base URL**: Configure via environment or proxy in `vite.config.ts`
- **Authentication**: JWT tokens stored in localStorage/sessionStorage
- **API Endpoints**:
  - `POST /auth/register` - User registration
  - `POST /auth/token` - Login (get JWT)
  - `GET /auth/me` - Get current user
  - `GET /elements/nearest` - Get nearest trail elements
  - `GET /elements/bbox` - Get elements in bounding box
- **Headers**: Include `Authorization: Bearer <token>` for protected routes

## Build & Test Commands

**Development server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Type check:**
```bash
npx vue-tsc --noEmit
```

**Run unit tests:**
```bash
npm run test:unit
```

**Run e2e tests:**
```bash
npm run test:e2e
```

**Lint:**
```bash
npm run lint
```

**Install dependencies:**
```bash
npm install
```

## Code Style Guidelines

### TypeScript
- Use explicit types for props, emit, and function parameters
- Prefer interfaces for object shapes
- Use `strict: true` in tsconfig

### Vue Components
- Use `<script setup lang="ts">` syntax
- Define props with `defineProps<Props>()` and `withDefaults`
- Use Composition API exclusively
- Keep components small and focused

### Naming Conventions
- Components: PascalCase (`HomePage.vue`, `TrailList.vue`)
- Composables: camelCase, use prefix `use` (`useAuth.ts`, `useTrail.ts`)
- Types/Interfaces: PascalCase
- Files: kebab-case (`auth-service.ts`, `trail-map.vue`)

### CSS/Styling
- Use Ionic utility classes first (`ion-padding`, `ion-content`)
- Scoped styles in components
- CSS variables in `src/theme/variables.css`

### State Management
- Use Vue composables for shared state
- Pinia not currently used; prefer Composition API reactive objects

### API Communication
- Use native `fetch` or create service modules
- Handle errors consistently with try/catch
- Store JWT in localStorage after login
- Include auth header in API requests

### Capacitor/Mobile
- Use `@capacitor/*` plugins for native features
- Platform-specific code via `Capacitor.isNativePlatform()`
- Android builds in `android/` directory

### Testing
- Vitest for unit tests (`.spec.ts` files in component directories)
- Cypress for e2e tests (`tests/e2e/`)
- Mock API calls in tests using Cypress intercept or Vitest mocks

### Git & Version Control
- Commit messages: concise, imperative mood
- Include test updates for all changes
- Match conventions from kishin-api AGENTS.md

## Agent Instructions
- ONLY do exactly what is asked. Do not add features, refactor, or improve code beyond the explicit request.
- When asked to create a component, only create that component. Do not add subcomponents, routes, or related functionality unless explicitly requested.
- Do not modify other files unless explicitly instructed.
- Do not add comments, documentation, or explanations unless asked.
- Do not replace or refactor existing code unless explicitly told to do so.
- Never remove existing comments from files unless explicitly told to do so.