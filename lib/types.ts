export type Category =
  | "carne"
  | "pescado"
  | "legumbre"
  | "verdura"
  | "pasta"
  | "arroz"
  | "huevo"
  | "otros";

export type FishKind = "blanco" | "azul" | "marisco";
export type RecipeSeason = "verano" | "invierno" | "todo";
export type SeasonMode = "auto" | "verano" | "invierno";
export type MealType = "comida" | "cena";
export type DayId =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";
export type MealKey = `${DayId}-${MealType}`;

export type IngredientSection =
  | "verduleria"
  | "carniceria"
  | "pescaderia"
  | "refrigerados"
  | "despensa"
  | "panaderia"
  | "otros";

export interface Ingredient {
  name: string;
  section: IngredientSection;
}

export interface Recipe {
  id: string;
  name: string;
  category: Category;
  fishKind?: FishKind;
  season: RecipeSeason;
  mealSlots: MealType[];
  ingredients: Ingredient[];
  emoji: string;
}

export interface WeekPlan {
  weekStart: string;
  seasonMode: SeasonMode;
  /**
   * Platos de cada hueco. El primero es el principal y marca el equilibrio
   * semanal; el segundo es opcional y solo suma a la lista de la compra.
   */
  meals: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface PlanShare {
  id: string;
  ownerId: string;
  viewerId: string;
  ownerEmail: string;
  viewerEmail: string;
  createdAt: string;
}

export interface CategoryMeta {
  label: string;
  plural: string;
  target: number;
  color: string;
  soft: string;
  emoji: string;
}

export interface PlanStats {
  total: number;
  byCategory: Record<Category, number>;
  fish: Record<FishKind, number>;
  balanced: boolean;
}
