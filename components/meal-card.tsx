"use client";

import { Shuffle } from "lucide-react";
import type { CSSProperties } from "react";
import { CATEGORIES, FISH_LABELS } from "@/lib/recipes";
import type { MealKey, MealType, Recipe } from "@/lib/types";

interface MealCardProps {
  mealKey: MealKey;
  mealType: MealType;
  recipe?: Recipe;
  repeatCount?: number;
  onOpen: () => void;
  onQuickSwap: () => void;
}

export function MealCard({
  mealKey,
  mealType,
  recipe,
  repeatCount = 0,
  onOpen,
  onQuickSwap,
}: MealCardProps) {
  const meta = recipe ? CATEGORIES[recipe.category] : null;
  const style = meta
    ? ({
        "--cat-color": meta.color,
        "--cat-soft": meta.soft,
      } as CSSProperties)
    : undefined;

  if (!recipe || !meta) {
    return (
      <article className="meal-card meal-card-empty" style={style}>
        <button className="meal-card-main" onClick={onOpen} type="button">
          <span className="meal-type">
            {mealType === "comida" ? "Comida" : "Cena"}
          </span>
          <span className="meal-empty-plus">+</span>
          <span className="meal-empty-text">Añadir plato</span>
        </button>
      </article>
    );
  }

  return (
    <article className="meal-card" style={style}>
      <button
        className="meal-card-main"
        onClick={onOpen}
        type="button"
        aria-label={`${recipe.name}${repeatCount > 1 ? `, repetido ${repeatCount} veces esta semana` : ""}. Abrir opciones para ${mealKey}`}
      >
        <span className="meal-card-top">
          <span className="meal-type">
            {mealType === "comida" ? "Comida" : "Cena"}
            {repeatCount > 1 && (
              <span
                className="meal-repeat"
                title={`Este plato se repite ${repeatCount} veces esta semana`}
              >
                ×{repeatCount}
              </span>
            )}
          </span>
          <span className="meal-emoji" aria-hidden="true">
            {recipe.emoji}
          </span>
        </span>
        <h3 className="meal-name">{recipe.name}</h3>
        <span className="meal-category">
          <span className="meal-category-dot" />
          <span className="meal-category-label">
            {recipe.fishKind
              ? `P. ${FISH_LABELS[recipe.fishKind].replace("Pescado ", "")}`
              : meta.label}
          </span>
        </span>
      </button>
      <button
        className="meal-quick-swap"
        type="button"
        onClick={onQuickSwap}
        aria-label={`Proponer otro plato para ${mealKey}`}
        title="Proponer otro plato"
      >
        <Shuffle size={13} strokeWidth={2.2} />
      </button>
    </article>
  );
}
