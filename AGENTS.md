# Kishin Frontend - Developer Guide for Agents

## Project Overview
Vue 3/Ionic mobile frontend for the Kishin project: the fog-of-war map, the athlete pages, the
training plan page and, in the Android app, GPS tracking. README.md lists the features, the
API routes it calls and the environment variables.

## Relationship with kishin-api

The frontend consumes the kishin-api REST API. Key integration points:
- **Base URL**: `VITE_API_BASE` in `.env`; each service module in `src/services/` builds its
  URLs from it
- **Authentication**: `POST /auth/login` for the single account; the JWT is kept in
  localStorage (`authService.ts`). A 401 from a protected route deletes it and returns to the
  login page
- **API prefixes**: `/auth`, `/poi`, `/trails`, `/noise`, `/athlete`, `/plan`
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
- Components and views: PascalCase files (`MapPage.vue`, `TrainingCard.vue`)
- Composables: camelCase with the prefix `use` (`useTrailMap.ts`, `useTrailTracker.ts`)
- Services and utilities: camelCase files (`authService.ts`, `planProgress.ts`)
- Types/Interfaces: PascalCase
- Tests: next to the file, `<name>.spec.ts`

### CSS/Styling
- Scoped styles in components
- Colours come from CSS variables: the pages under `AppShell.vue` read the tokens of
  `src/theme/pages.css` (`theme-standard` / `theme-ukiyo`, chosen by the map style); the map
  panel has its own tokens in `MapPage.vue`
- No serif font for Latin text

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
- Vitest for unit tests (`.spec.ts` files next to the file they test), jsdom environment
- Mock services and Capacitor plugins with `vi.mock`; jsdom has no `localStorage` here, so
  tests stub it with `vi.stubGlobal`

### Git & Version Control
- Commit messages: concise, imperative mood
- Include test updates for all changes
- Match conventions from kishin-api AGENTS.md

## Agent Instructions
- ONLY do exactly what is asked. Do not add features, refactor, or improve code beyond the explicit request.
- When asked to create a component, only create that component. Do not add subcomponents, routes, or related functionality unless explicitly requested.
- Do not modify other files unless explicitly instructed.
- Do not replace or refactor existing code unless explicitly told to do so.
- Never remove existing comments from files unless explicitly told to do so.

## Documentation Standards
Every function, method, class, and exported interface must have a professional-level docstring. This applies to TypeScript (TSDoc `/** */` blocks), Vue `<script setup>` (JSDoc above the function), and Kotlin (KDoc `/** */` blocks).

Required elements for each docstring:
- A concise summary line describing **what** the function does and **why** it exists (not just a restatement of the name).
- `@param` tags for every non-obvious parameter.
- `@returns` tag when the return value carries semantic meaning beyond the type.
- Note any important side effects, preconditions, or failure modes.

File-level docblocks are required for all service, composable, utility, and plugin files. They must describe the module's responsibility and what it explicitly does **not** own (to document boundaries between modules).

Inline comments are permitted only for non-obvious logic (e.g. algorithm steps, workarounds, invariants). Do not comment self-explanatory code.