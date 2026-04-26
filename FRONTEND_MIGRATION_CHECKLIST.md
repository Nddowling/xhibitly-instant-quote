# Frontend Migration: Base44 → Next.js 15

## Phase 1 — Extract & Audit

- [ ] **Step 1** — Export frontend code from Base44, pull into fresh repo, run install, audit what builds and what breaks.
- [ ] **Step 2** — Inventory every Base44 integration call in the codebase. These are your replacement points.

## Phase 2 — Scaffold Next.js

- [ ] **Step 3** — Choose framework. Next.js 15 with App Router for Xhibitly (SSR, edge, image optimization).
- [ ] **Step 4** — Spin up new Next.js project. Set up TypeScript, Tailwind, ESLint, Prettier.
- [ ] **Step 5** — Move components from Base44 export into Next.js `app/` directory structure.
- [ ] **Step 6** — Convert React Router routes to file-based App Router routing.
- [ ] **Step 7** — Create route groups: `(authenticated)` for dealer dashboard, `(public)` for marketing and shared booth links.

## Phase 3 — API & Data Layer

- [ ] **Step 8** — Build typed API client at `/lib/api.ts` pointing at your Cloud Run endpoints.
- [ ] **Step 9** — Install TanStack Query for server state. Wrap app in `QueryClientProvider`.
- [ ] **Step 10** — Replace every Base44 integration call with your API client calls.

## Phase 4 — Auth

- [ ] **Step 11** — Install Firebase SDK. Initialize Firebase config from environment variables.
- [ ] **Step 12** — Build auth context provider. Wrap app in `AuthProvider`.
- [ ] **Step 13** — Build login, signup, forgot-password, and reset-password flows.
- [ ] **Step 14** — Add Next.js middleware to protect authenticated routes.
- [ ] **Step 15** — Test bcrypt hash import — existing vendors should log in with current passwords.

## Phase 5 — State & Multi-Tenancy

- [ ] **Step 16** — Install Zustand for UI state (booth editor, brand kit selector, render queue).
- [ ] **Step 17** — Build `TenantProvider` that resolves dealer from subdomain or path.
- [ ] **Step 18** — Pipe tenant ID into every API call automatically via interceptor.

## Phase 6 — Three.js & 3D

- [ ] **Step 19** — Wrap `BoothSnapshotRenderer` in dynamic import with `ssr: false`.
- [ ] **Step 20** — Wire GLB loading to Cloud Storage signed URLs.
- [ ] **Step 21** — Test OrbitControls, drag-and-drop, walkthrough mode, camera presets.
- [ ] **Step 22** — Audit Three.js cleanup — dispose geometries, materials, textures on unmount.

## Phase 7 — Config & Secrets

- [ ] **Step 23** — Configure environment files: `.env.local` for dev, Firebase config for prod.
- [ ] **Step 24** — Move secrets into Google Secret Manager. Reference from backend only.

## Phase 8 — CI/CD & Deployment

- [ ] **Step 25** — Set up Sentry for error tracking.
- [ ] **Step 26** — Build GitHub Actions workflow: lint → typecheck → build → deploy.
- [ ] **Step 27** — Configure Firebase Hosting preview channels for PR previews.
- [ ] **Step 28** — Set up production deploy gated on main branch with manual approval.

## Phase 9 — Performance

- [ ] **Step 29** — Run Lighthouse audit. Fix critical performance issues.
- [ ] **Step 30** — Code-split the Three.js bundle so marketing pages stay fast.
- [ ] **Step 31** — Build mobile touch controls for the booth editor.

## Phase 10 — Testing & Validation

- [ ] **Step 32** — Test multi-tenant flows end-to-end with at least three test dealer accounts.
- [ ] **Step 33** — Smoke test full user journey: signup → booth build → render → quote → share.

## Phase 11 — Rollout

- [ ] **Step 34** — Deploy to staging. Run for 48 hours with internal team.
- [ ] **Step 35** — Deploy to production behind feature flag or 10% traffic split.
- [ ] **Step 36** — Monitor errors, render latency, auth failures for 72 hours.
- [ ] **Step 37** — Full cutover. DNS swap. Decommission Base44 frontend.
