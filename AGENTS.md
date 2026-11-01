<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mesa repo notes

## Snapshot

- Single-page Next.js 16 App Router app. Page-level state and orchestration live in `app/page.tsx`; there are no API routes or server actions.
- The browser talks to Supabase directly with the public anon key. Keep Supabase access client-side; only `NEXT_PUBLIC_*` env vars are available.
- UI copy and code comments are in Spanish; identifiers and types are in English. Keep new user-facing text in Spanish.
- Supabase is optional: without env vars, or when calls fail, persistence falls back to `localStorage` and the UI shows local mode.

## Commands

- `npm run dev` — dev server (Turbopack).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — production build; use it as the final verification after typecheck.
- There are no test, lint, or format scripts/configs in the repo. Do not invent `npm test` or `npm run lint`.

## Recipe catalog: the main gotcha

- `lib/recipes.ts` (`RECIPES`, `getRecipe`) is only the **base** catalog.
- The effective catalog is `buildRecipeCatalog(recipeBook)` in `lib/recipe-book.ts`: base recipes minus `hiddenIds`, with `overrides` applied, plus `custom`.
- Planner functions and UI components accept an optional `recipes` argument/prop that defaults to `RECIPES`. Thread the effective catalog through when adding features: `findRecipe(catalog, id)`, `generateWeekPlan(..., catalog)`, `getPlanStats(plan, catalog)`, `buildShoppingList(plan, catalog)`, `getPlanRecipe(plan, key, catalog)`, and the `recipes` prop of `MealModal` / `BalanceCard` / `ShoppingList`. Importing `RECIPES`/`getRecipe` directly silently ignores user recipes and edits.
- Base recipes are declared with the local `r(...)` helper in `lib/recipes.ts`; ingredients are `"name|section"` strings (section defaults to `despensa`). Follow that pattern when adding base recipes.
- Base-recipe edits go to `overrides` keyed by base id; deleting a base recipe adds it to `hiddenIds` (soft hide, restorable). User recipes use `custom-...` ids.
- Deleting a recipe also clears its slots from every stored plan (`handleDeleteRecipe` in `app/page.tsx`); preserve that side effect.

## Domain rules that look like bugs but are intentional

- 14 slots: 7 lunches + 7 dinners, with category targets in `TARGETS` / `LUNCH_REQUIREMENTS` / `DINNER_REQUIREMENTS` (`lib/planner.ts`).
- A repeated recipe counts as a separate meal for balance/stats, but `buildShoppingList` dedupes ingredients by recipe id (leftovers model). Do not "fix" the dedupe.
- Generation avoids repeats within a week, but `pickRecipeForSlot` reuses used recipes when no unused candidate fits the slot. Manual repeats via the **Repetir** tab are intentional and ignore `mealSlots` (e.g. lunch leftovers for dinner).

## Persistence / Supabase

- Tables: `weekly_plans` and `recipe_books`, one row per `auth.uid()` with RLS. Schema lives only in `supabase/schema.sql`; it is idempotent and applied by hand in the Supabase SQL Editor. No migration tooling is configured.
- Anonymous sign-ins must be enabled in Supabase; otherwise cloud writes fail and the app stays in local mode.
- Local keys: `mesa.week-plans.v1`, `mesa.recipe-book.v1`. If you change stored shapes, update `normalizeRecipeBook` / `normalizeRecipe` in `lib/recipe-book.ts`; recipes missing an id, name, valid category, or at least one ingredient are dropped on load.
- Recipe-book sync merges local/cloud by `updatedAt` (`loadRecipeBook` in `lib/storage.ts`). Keep timestamps ISO-comparable when adding fields.
- Keep the initial `loadPlans()` and `loadRecipeBook()` calls sequential on purpose (see the comment in `app/page.tsx`); they share the anonymous Supabase session.
- The anon session lives in browser storage. Clearing site data creates a new anonymous user, so cloud data will appear missing. Use a fresh browser context for clean manual tests.
- `.env.local` holds real project values: never print, commit, or delete it. `.env.example` is the committed template.

## Styling

- Plain CSS in `app/globals.css` (no Tailwind, CSS modules, or styled-components).
