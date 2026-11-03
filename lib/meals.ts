/** Cada comida o cena admite un plato principal y un segundo plato opcional. */
export const MAX_DISHES_PER_MEAL = 2;

/**
 * Acepta tanto el formato antiguo (un id suelto) como el nuevo (lista de ids).
 * Sirve para migrar los planes guardados antes de admitir dos platos.
 */
export function normalizeMealRecipeIds(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];

  const ids = raw
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean);

  return [...new Set(ids)].slice(0, MAX_DISHES_PER_MEAL);
}

export function normalizeMeals(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const meals: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const ids = normalizeMealRecipeIds(raw);
    if (ids.length > 0) meals[key] = ids;
  }

  return meals;
}

export function getMealRecipeIds(
  meals: Record<string, string[]> | null | undefined,
  mealKey: string,
): string[] {
  return meals?.[mealKey] ?? [];
}

export function getAllRecipeIds(
  meals: Record<string, string[]> | null | undefined,
): string[] {
  if (!meals) return [];
  return Object.values(meals).flat();
}

export function countPlanRecipes(
  meals: Record<string, string[]> | null | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!meals) return counts;

  for (const ids of Object.values(meals)) {
    for (const id of ids) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return counts;
}
