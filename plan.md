# Plan: Stats Loading Fix + Profile Redesign + Cleanup Passes

## Problem 1 — Stats don't show on first page visit

### Root cause

`agent-dashboard.ts` was calling a non-existent endpoint (`/presences/mes-presences`). The backend exposes `/presences/me/monthly/:month` instead, so the HTTP call silently failed and stats rendered as 0 until a re-navigation re-triggered the request.

A secondary issue: every page subscribed to `auth.currentUser$` in `ngOnInit` and *also* fired HTTP requests unconditionally. The token interceptor and user data were sometimes not yet ready on first paint, producing inconsistent first-render behavior across pages.

### Approach

1. Use `auth.currentUser$` as the single source of truth and gate every data load behind `if (u)`. `BehaviorSubject` guarantees a synchronous first emission when a user is already in localStorage, so data is available on first render.
2. Fire independent HTTP calls in parallel inside the subscription and only flip `loading` once the relevant call resolves. No `Promise.all` ceremony for one-off calls.
3. Replace `[ngSwitch]` in the dashboard shell with explicit `*ngIf` blocks per role — simpler, no directive overhead, and clearer in templates.
4. Use the correct endpoint everywhere (cross-checked against `backend/src/routes/*.js`).

## Problem 2 — Profile page UX

### Why the original was wrong

- The "Assignment History" card was rendered for every role even though it has no meaning for chefs/admins.
- The page header carried the Edit / Save / Cancel controls, but the user expects those to live next to the section they affect.
- The grid left an empty column when the stats card was shorter than its neighbor.

### Approach

1. Role-aware stats card: agents see their personal assignment counts, chef/admin see team metrics (members, active assignments, sites managed).
2. Hide "Assignment History" entirely for non-agent roles via `*ngIf="isAgent()"`.
3. Move the Edit / Save / Cancel group into a `.card-header` next to the "Personal Information" heading. The page-level header is left clean with just the Back button and title.
4. Two-column responsive grid: collapses to a single column under 1024px. Stats and password card are stacked in their respective columns to avoid empty space.

## Conventions

- Use `ChangeDetectorRef.detectChanges()` only inside HTTP callbacks where Angular's default change detection is otherwise short-circuited.
- Methods are verbs (`loadX`, `saveX`, `toggleX`); boolean state are plain nouns (`loading`, `editMode`).
- CSS: classes describe what an element *is*, not what it looks like. Comments explain *why* (intent), not *what* (mechanics). No `// loop through data` style comments. No generic section labels like `/* Password card */`.

## Cleanup pass — what got removed

- **Dead code**: unused CSS classes (`.back-button`, `.header-actions`) that no longer matched any element after the layout refactor. Unused `AffectationsService` injection in `agent-dashboard.ts`.
- **Generic comments**: section labels like `/* Password card */`, `/* Stats card */`, `/* Assignment history */` were replaced with intent-based notes where they add value, and removed where they just narrated the code.
- **Overly specific CSS selectors**: `.card-header .card-header-actions .btn-primary` collapsed to `.card-header-actions .btn-primary`.
- **Verbose Excel/print HTML builders** in `admin-analytics.ts` were split into small private methods (`excelSummarySheet`, `excelPerChefSheet`, `excelPerSiteSheet`, `excelAllReportsSheet`, `buildPrintHtml`) so the public API stays short and the XML strings are readable.
- **Generic HTTP error handlers** were stripped of their `console.error` calls where they added no debugging value.
