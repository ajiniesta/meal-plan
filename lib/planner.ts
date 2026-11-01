import { addDaysISO, getSeasonContext } from "./dates";
import { CATEGORIES, CATEGORY_ORDER, INGREDIENT_SECTIONS, RECIPES, getRecipe } from "./recipes";
import type {
  Category,
  DayId,
  FishKind,
  IngredientSection,
  MealKey,
  MealType,
  PlanStats,
  Recipe,
  SeasonMode,
  WeekPlan,
} from "./types";
import { DAYS } from "./dates";

export interface SlotRequirement {
  category: Category;
  fishKind?: FishKind;
}

export const LUNCH_REQUIREMENTS: SlotRequirement[] = [
  { category: "carne" },
  { category: "carne" },
  { category: "pasta" },
  { category: "arroz" },
  { category: "legumbre" },
  { category: "legumbre" },
  { category: "pescado", fishKind: "blanco" },
];

export const DINNER_REQUIREMENTS: SlotRequirement[] = [
  { category: "carne" },
  { category: "pescado", fishKind: "azul" },
  { category: "huevo" },
  { category: "huevo" },
  { category: "verdura" },
  { category: "verdura" },
  { category: "otros" },
];

export const TARGETS: Record<Category, number> = {
  carne: 3,
  pasta: 1,
  arroz: 1,
  legumbre: 2,
  pescado: 2,
  huevo: 2,
  verdura: 2,
  otros: 1,
};

export const ALL_MEAL_KEYS: MealKey[] = DAYS.flatMap((day) => [
  `${day.id}-comida` as MealKey,
  `${day.id}-cena` as MealKey,
]);

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function weightedPick<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function seasonScore(recipe: Recipe, climate: "verano" | "invierno" | "templado"): number {
  if (climate === "templado") {
    return recipe.season === "todo" ? 3 : 2;
  }
  if (recipe.season === climate) return 5;
  if (recipe.season === "todo") return 3;
  return -6;
}

export function getRecentRecipeIds(
  plans: WeekPlan[],
  weekStart: string,
  weeks = 3,
): Set<string> {
  const from = addDaysISO(weekStart, -7 * weeks);
  const ids = new Set<string>();

  for (const plan of plans) {
    if (plan.weekStart >= weekStart) continue;
    if (plan.weekStart < from) continue;
    Object.values(plan.meals).forEach((id) => {
      if (id) ids.add(id);
    });
  }

  return ids;
}

interface PickOptions {
  requirement: SlotRequirement;
  mealType: MealType;
  usedIds: Set<string>;
  recentIds: Set<string>;
  climate: "verano" | "invierno" | "templado";
  excludeId?: string;
}

export function pickRecipeForSlot({
  requirement,
  mealType,
  usedIds,
  recentIds,
  climate,
  excludeId,
}: PickOptions): Recipe | undefined {
  const base = RECIPES.filter(
    (recipe) =>
      recipe.category === requirement.category &&
      (!requirement.fishKind || recipe.fishKind === requirement.fishKind) &&
      recipe.mealSlots.includes(mealType) &&
      recipe.id !== excludeId,
  );

  const available = base.filter((recipe) => !usedIds.has(recipe.id));
  const pool = available.length > 0 ? available : base;

  if (pool.length === 0) return undefined;

  const scored = pool.map((recipe) => {
    let score = seasonScore(recipe, climate) * 2;
    score += recentIds.has(recipe.id) ? -16 : 5;
    score += Math.random() * 3;
    return { value: recipe, score };
  });

  const best = Math.max(...scored.map((item) => item.score));
  return weightedPick(
    scored.map((item) => ({
      value: item.value,
      weight: Math.exp((item.score - best) / 2.2),
    })),
  );
}

export function generateWeekPlan(
  weekStart: string,
  seasonMode: SeasonMode,
  historyPlans: WeekPlan[] = [],
): WeekPlan {
  const season = getSeasonContext(weekStart, seasonMode);
  const recentIds = getRecentRecipeIds(historyPlans, weekStart);
  const usedIds = new Set<string>();
  const meals: Record<string, string> = {};

  const lunches = shuffle(LUNCH_REQUIREMENTS);
  const dinners = shuffle(DINNER_REQUIREMENTS);

  DAYS.forEach((day, index) => {
    const lunchRequirement = lunches[index];
    const dinnerRequirement = dinners[index];

    const lunch = pickRecipeForSlot({
      requirement: lunchRequirement,
      mealType: "comida",
      usedIds,
      recentIds,
      climate: season.climate,
    });

    if (lunch) {
      meals[`${day.id}-comida`] = lunch.id;
      usedIds.add(lunch.id);
    }

    const dinner = pickRecipeForSlot({
      requirement: dinnerRequirement,
      mealType: "cena",
      usedIds,
      recentIds,
      climate: season.climate,
    });

    if (dinner) {
      meals[`${day.id}-cena`] = dinner.id;
      usedIds.add(dinner.id);
    }
  });

  const now = new Date().toISOString();

  return {
    weekStart,
    seasonMode,
    meals,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPlanRecipe(plan: WeekPlan, mealKey: MealKey): Recipe | undefined {
  return getRecipe(plan.meals[mealKey]);
}

export function getPlanStats(plan: WeekPlan): PlanStats {
  const byCategory = CATEGORY_ORDER.reduce(
    (accumulator, category) => {
      accumulator[category] = 0;
      return accumulator;
    },
    {} as Record<Category, number>,
  );

  const fish: Record<FishKind, number> = {
    blanco: 0,
    azul: 0,
    marisco: 0,
  };

  let total = 0;

  for (const recipeId of Object.values(plan.meals)) {
    const recipe = getRecipe(recipeId);
    if (!recipe) continue;
    total += 1;
    byCategory[recipe.category] += 1;
    if (recipe.category === "pescado" && recipe.fishKind) {
      fish[recipe.fishKind] += 1;
    }
  }

  const balanced =
    CATEGORY_ORDER.every(
      (category) => byCategory[category] === TARGETS[category],
    ) &&
    fish.blanco === 1 &&
    fish.azul === 1;

  return { total, byCategory, fish, balanced };
}

export function getPlanAlternatives(
  plan: WeekPlan,
  mealKey: MealKey,
  recipe: Recipe,
): Recipe[] {
  const currentId = plan.meals[mealKey];
  const used = new Set(
    Object.entries(plan.meals)
      .filter(([key, value]) => key !== mealKey && Boolean(value))
      .map(([, value]) => value),
  );

  return RECIPES.filter(
    (candidate) =>
      candidate.id !== currentId &&
      candidate.category === recipe.category &&
      candidate.mealSlots.includes(mealKey.endsWith("-comida") ? "comida" : "cena") &&
      (!recipe.fishKind || candidate.fishKind === recipe.fishKind),
  ).sort((left, right) => {
    const leftUsed = used.has(left.id) ? 1 : 0;
    const rightUsed = used.has(right.id) ? 1 : 0;
    if (leftUsed !== rightUsed) return leftUsed - rightUsed;
    return left.name.localeCompare(right.name, "es");
  });
}

export function buildShoppingList(plan: WeekPlan): {
  section: IngredientSection;
  label: string;
  items: { name: string; count: number; recipes: string[] }[];
}[] {
  const items = new Map<
    string,
    { name: string; section: IngredientSection; count: number; recipes: Set<string> }
  >();

  for (const recipeId of new Set(Object.values(plan.meals))) {
    const recipe = getRecipe(recipeId);
    if (!recipe) continue;

    for (const ingredient of recipe.ingredients) {
      const key = `${ingredient.section}:${ingredient.name.toLocaleLowerCase("es")}`;
      const existing = items.get(key);
      if (existing) {
        existing.count += 1;
        existing.recipes.add(recipe.name);
      } else {
        items.set(key, {
          name: ingredient.name,
          section: ingredient.section,
          count: 1,
          recipes: new Set([recipe.name]),
        });
      }
    }
  }

  return INGREDIENT_SECTIONS.map((section) => ({
    section: section.id,
    label: section.label,
    items: [...items.values()]
      .filter((item) => item.section === section.id)
      .sort((left, right) => left.name.localeCompare(right.name, "es"))
      .map((item) => ({
        name: item.name,
        count: item.count,
        recipes: [...item.recipes],
      })),
  })).filter((section) => section.items.length > 0);
}

export function buildShoppingListText(plan: WeekPlan): string {
  const groups = buildShoppingList(plan);
  const lines = ["Lista de la compra · Mesa", ""];

  for (const group of groups) {
    lines.push(group.label.toUpperCase());
    for (const item of group.items) {
      lines.push(`- ${item.name}${item.count > 1 ? ` (${item.count})` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function getCompatibleRecipesForSlot(
  mealKey: MealKey,
  plan: WeekPlan,
): Recipe[] {
  const mealType: MealType = mealKey.endsWith("-comida") ? "comida" : "cena";
  const used = new Set(
    Object.entries(plan.meals)
      .filter(([key]) => key !== mealKey)
      .map(([, value]) => value),
  );

  return RECIPES.filter(
    (recipe) => recipe.mealSlots.includes(mealType) && !used.has(recipe.id),
  );
}

export function getCategoryTargetLabel(category: Category): string {
  const meta = CATEGORIES[category];
  return `${meta.label} ${TARGETS[category]}`;
}

export function mealKeyLabel(mealKey: MealKey): string {
  const [dayId, mealType] = mealKey.split("-") as [DayId, MealType];
  const day = DAYS.find((item) => item.id === dayId);
  return `${day?.label ?? dayId} · ${mealType === "comida" ? "comida" : "cena"}`;
}
