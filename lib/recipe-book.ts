import { CATEGORIES, CATEGORY_ORDER, RECIPES } from "./recipes";
import type {
  Category,
  FishKind,
  Ingredient,
  IngredientSection,
  MealType,
  Recipe,
  RecipeSeason,
} from "./types";

/**
 * Cambios que la persona hace sobre el recetario base.
 * - `custom`: recetas nuevas creadas desde la app.
 * - `overrides`: recetas base editadas, guardadas por id.
 * - `hiddenIds`: recetas base retiradas del recetario.
 */
export interface RecipeBook {
  custom: Recipe[];
  overrides: Record<string, Recipe>;
  hiddenIds: string[];
  updatedAt: string;
}

export const EMPTY_RECIPE_BOOK: RecipeBook = {
  custom: [],
  overrides: {},
  hiddenIds: [],
  updatedAt: new Date(0).toISOString(),
};

const FISH_KINDS: FishKind[] = ["blanco", "azul", "marisco"];
const SEASONS: RecipeSeason[] = ["verano", "invierno", "todo"];
const MEAL_TYPES: MealType[] = ["comida", "cena"];
const SECTIONS: IngredientSection[] = [
  "verduleria",
  "carniceria",
  "pescaderia",
  "refrigerados",
  "panaderia",
  "despensa",
  "otros",
];

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_ORDER.includes(value as Category);
}

function isFishKind(value: unknown): value is FishKind {
  return typeof value === "string" && FISH_KINDS.includes(value as FishKind);
}

function isSeason(value: unknown): value is RecipeSeason {
  return typeof value === "string" && SEASONS.includes(value as RecipeSeason);
}

function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && MEAL_TYPES.includes(value as MealType);
}

function isSection(value: unknown): value is IngredientSection {
  return typeof value === "string" && SECTIONS.includes(value as IngredientSection);
}

function normalizeIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): Ingredient[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<Ingredient>;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) return [];
    return [
      {
        name,
        section: isSection(raw.section) ? raw.section : "despensa",
      },
    ];
  });
}

export function normalizeRecipe(value: unknown): Recipe | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<Recipe>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";

  if (!id || !name || !isCategory(raw.category)) return null;

  const ingredients = normalizeIngredients(raw.ingredients);
  if (ingredients.length === 0) return null;

  const slots = Array.isArray(raw.mealSlots)
    ? raw.mealSlots.filter(isMealType)
    : [];
  const mealSlots: MealType[] =
    slots.length > 0 ? [...new Set(slots)] : ["comida", "cena"];

  return {
    id,
    name,
    category: raw.category,
    fishKind:
      raw.category === "pescado" && isFishKind(raw.fishKind)
        ? raw.fishKind
        : undefined,
    season: isSeason(raw.season) ? raw.season : "todo",
    mealSlots,
    ingredients,
    emoji:
      typeof raw.emoji === "string" && raw.emoji.trim()
        ? raw.emoji.trim()
        : CATEGORIES[raw.category].emoji,
  };
}

export function normalizeRecipeBook(value: unknown): RecipeBook {
  if (!value || typeof value !== "object") return EMPTY_RECIPE_BOOK;

  const raw = value as Partial<RecipeBook>;

  const custom = Array.isArray(raw.custom)
    ? raw.custom.flatMap((item) => {
        const recipe = normalizeRecipe(item);
        return recipe ? [recipe] : [];
      })
    : [];

  const overrides: Record<string, Recipe> = {};
  if (raw.overrides && typeof raw.overrides === "object") {
    for (const [id, item] of Object.entries(raw.overrides)) {
      const recipe = normalizeRecipe(item);
      if (recipe && recipe.id === id) overrides[id] = recipe;
    }
  }

  const hiddenIds = Array.isArray(raw.hiddenIds)
    ? [...new Set(raw.hiddenIds.filter((id): id is string => typeof id === "string"))]
    : [];

  return {
    custom,
    overrides,
    hiddenIds,
    updatedAt:
      typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString(),
  };
}

/** Une el catálogo base con las recetas propias y las ediciones guardadas. */
export function buildRecipeCatalog(book: RecipeBook): Recipe[] {
  const hidden = new Set(book.hiddenIds);

  const base = RECIPES.filter((recipe) => !hidden.has(recipe.id)).map((recipe) => {
    const override = book.overrides[recipe.id];
    return override ? { ...override, id: recipe.id } : recipe;
  });

  return [...base, ...book.custom.filter((recipe) => !hidden.has(recipe.id))];
}

export function createCustomRecipeId(): string {
  const random =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `custom-${random}`;
}

export function countRecipeUsage(
  plans: { meals: Record<string, string[]> }[],
  id: string,
): number {
  return plans.reduce(
    (total, plan) =>
      total +
      Object.values(plan.meals).reduce(
        (sum, recipeIds) =>
          sum + recipeIds.filter((recipeId) => recipeId === id).length,
        0,
      ),
    0,
  );
}
