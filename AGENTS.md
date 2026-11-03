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
- With Supabase configured, real email/password accounts are required (`AuthScreen`); there is no anonymous sign-in. Without env vars, the app runs account-less in local mode.
- After sign-in, persistence failures still fall back to per-account `localStorage` and the UI shows local mode.

## Commands

- `npm run dev` — dev server (Turbopack).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — production build; use it as the final verification after typecheck.
- There are no test, lint, or format scripts/configs in the repo. Do not invent `npm test` or `npm run lint`.

## Recipe catalog: the main gotcha

- `lib/recipes.ts` (`RECIPES`, `getRecipe`) is only the **base** catalog.
- The effective catalog is `buildRecipeCatalog(recipeBook)` in `lib/recipe-book.ts`: base recipes minus `hiddenIds`, with `overrides` applied, plus `custom`.
- The `RecipeBook` is **global**, not per user: it is stored in the single `recipe_catalog` row (`id = 'global'`) and every authenticated account reads/writes it. Custom recipes, base edits and hidden recipes affect everyone. Keep that scope when adding recipe features.
- Planner functions and UI components accept an optional `recipes` argument/prop that defaults to `RECIPES`. Thread the effective catalog through when adding features: `findRecipe(catalog, id)`, `generateWeekPlan(..., catalog)`, `getPlanStats(plan, catalog)`, `buildShoppingList(plan, catalog)`, `getPlanRecipe(plan, key, catalog)`, and the `recipes` prop of `MealModal` / `BalanceCard` / `ShoppingList`. Importing `RECIPES`/`getRecipe` directly silently ignores global recipes and edits.
- Base recipes are declared with the local `r(...)` helper in `lib/recipes.ts`; ingredients are `"name|section"` strings (section defaults to `despensa`). Follow that pattern when adding base recipes.
- Base-recipe edits go to `overrides` keyed by base id; deleting a base recipe adds it to `hiddenIds` (soft hide, restorable). User recipes use `custom-...` ids.
- Deleting a recipe also clears its slots from the plan currently in view, own or shared (`handleDeleteRecipe` in `app/page.tsx`); preserve that side effect. Plans of other accounts that are not being viewed may keep a now-missing recipe id.

## Domain rules that look like bugs but are intentional

- 14 slots: 7 lunches + 7 dinners, with category targets in `TARGETS` / `LUNCH_REQUIREMENTS` / `DINNER_REQUIREMENTS` (`lib/planner.ts`).
- Each slot stores an ordered list of recipe ids (`meals: Record<string, string[]>`): the first dish is the main one and drives balance/stats, the optional second dish only adds ingredients to the shopping list. `normalizeMeals` in `lib/meals.ts` migrates old plans that stored a single id.
- A repeated recipe counts as a separate meal for balance/stats, but `buildShoppingList` dedupes ingredients by recipe id (leftovers model). Do not "fix" the dedupe.
- Generation avoids repeats within a week, but `pickRecipeForSlot` reuses used recipes when no unused candidate fits the slot. Manual repeats via the **Repetir** tab are intentional and ignore `mealSlots` (e.g. lunch leftovers for dinner).

## Persistence / Supabase

- Tables: `weekly_plans` (one set of weeks per `auth.uid()`), `plan_shares` (owner/viewer edit access) and `recipe_catalog` (single global row). Schema lives only in `supabase/schema.sql`; it is idempotent and applied by hand in the Supabase SQL Editor. No migration tooling is configured.
- Email/password auth is required when Supabase is configured. Enable the Email provider; anonymous sign-ins are not used. Email confirmation may be on, so `signUpWithEmail` can return a user without a session.
- Local plans keys: `mesa.week-plans.v2.<userId>` (or `mesa.week-plans.v2.local` without Supabase). The global recipe cache is `mesa.recipe-catalog.v2`, with the old `mesa.recipe-book.v1` read as a fallback. If you change stored shapes, update `normalizeRecipeBook` / `normalizeRecipe` in `lib/recipe-book.ts`; recipes missing an id, name, valid category, or at least one ingredient are dropped on load.
- Recipe-catalog sync merges local/cloud by `updatedAt` (`loadRecipeBook` in `lib/storage.ts`). Because the catalog is global, last-write-wins across accounts is accepted. Keep timestamps ISO-comparable when adding fields.
- Keep the initial `loadPlans()` and `loadRecipeBook()` calls sequential on purpose (`initializeUser` / `initializeLocal` in `app/page.tsx`). Do not auto-generate a week while viewing a shared plan; generation is allowed only on explicit user action.
- `plan_shares` grants read **and write** access to all of an owner's weeks through the `weekly_plans` INSERT/UPDATE policies. Shared users are collaborators: they can change meals, seasons and generate weeks, but cannot delete weeks or change `user_id`. Only the owner can manage shares. The `share_plan_with_email` security-definer RPC resolves the viewer email in `auth.users`; do not add a broad profile/email SELECT policy just to share.
- Sharing is by registered account email. When persisting a shared plan, save it with `activeShare.ownerId` (not the signed-in user's id) and update `sharedPlans`; `persist` in `app/page.tsx` handles both. Keep the global recipe manager available in shared view.
- Auth sessions live in browser storage. Clearing site data signs the user out. Use a fresh browser context for clean manual tests with two accounts.
- `.env.local` holds real project values: never print, commit, or delete it. `.env.example` is the committed template.

## Styling

- Plain CSS in `app/globals.css` (no Tailwind, CSS modules, or styled-components).
- Mobile support lives in the `@media (max-width: …)` blocks: the layout must stay usable at 320–390 px. The main planner scrolls horizontally by design; never let the page itself scroll sideways.
- Mobile rules intentionally set form controls to `font-size: 16px` (prevents iOS auto-zoom) and keep touch targets around 32–44 px. Modals become bottom sheets sized in `dvh` with `env(safe-area-inset-bottom)` padding.
