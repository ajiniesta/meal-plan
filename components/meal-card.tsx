"use client";

import { Plus, Shuffle, X } from "lucide-react";
import type { CSSProperties } from "react";
import { CATEGORIES, FISH_LABELS } from "@/lib/recipes";
import type { MealKey, MealType, Recipe } from "@/lib/types";

interface MealCardProps {
  mealKey: MealKey;
  mealType: MealType;
  recipes: Recipe[];
  repeatCounts: Map<string, number>;
  onOpen: (dishIndex: number | "new") => void;
  onQuickSwap: () => void;
  onRemoveExtra: (dishIndex: number) => void;
}

function categoryLabel(recipe: Recipe): string {
  const meta = CATEGORIES[recipe.category];
  return recipe.fishKind
    ? `P. ${FISH_LABELS[recipe.fishKind].replace("Pescado ", "")}`
    : meta.label;
}

export function MealCard({
  mealKey,
  mealType,
  recipes,
  repeatCounts,
  onOpen,
  onQuickSwap,
  onRemoveExtra,
}: MealCardProps) {
  const primary = recipes[0];
  const extras = recipes.slice(1);
  const meta = primary ? CATEGORIES[primary.category] : null;
  const style = meta
    ? ({
        "--cat-color": meta.color,
        "--cat-soft": meta.soft,
      } as CSSProperties)
    : undefined;
  const mealLabel = mealType === "comida" ? "Comida" : "Cena";

  if (!primary || !meta) {
    return (
      <article className="meal-card meal-card-empty" style={style}>
        <button
          className="meal-card-main"
          onClick={() => onOpen("new")}
          type="button"
        >
          <span className="meal-type">{mealLabel}</span>
          <span className="meal-empty-plus">+</span>
          <span className="meal-empty-text">Añadir plato</span>
        </button>
      </article>
    );
  }

  const primaryRepeat = repeatCounts.get(primary.id) ?? 0;
  const labels = recipes.map(categoryLabel).join(" · ");
  const emojis = recipes.map((recipe) => recipe.emoji).join("");
  const allNames = recipes.map((recipe) => recipe.name).join(" y ");

  return (
    <article className="meal-card" style={style}>
      <div className="meal-card-content">
        <button
          className="meal-card-main"
          onClick={() => onOpen(0)}
          type="button"
          aria-label={`${allNames}. Abrir opciones para ${mealKey}`}
        >
          <span className="meal-card-top">
            <span className="meal-type">
              {mealLabel}
              {primaryRepeat > 1 && (
                <span
                  className="meal-repeat"
                  title={`Este plato se repite ${primaryRepeat} veces esta semana`}
                >
                  ×{primaryRepeat}
                </span>
              )}
            </span>
            <span
              className={`meal-emoji ${recipes.length > 1 ? "meal-emoji-pair" : ""}`}
              aria-hidden="true"
            >
              {emojis}
            </span>
          </span>
          <h3 className="meal-name">{primary.name}</h3>
        </button>

        {extras.map((recipe, index) => {
          const dishIndex = index + 1;
          const repeat = repeatCounts.get(recipe.id) ?? 0;

          return (
            <div className="meal-extra" key={recipe.id}>
              <button
                className="meal-extra-button"
                type="button"
                onClick={() => onOpen(dishIndex)}
                aria-label={`${recipe.name}. Abrir opciones del segundo plato para ${mealKey}`}
              >
                <span className="meal-extra-plus" aria-hidden="true">
                  ＋
                </span>
                <span className="meal-extra-name">{recipe.name}</span>
                {repeat > 1 && (
                  <span
                    className="meal-repeat meal-repeat-inline"
                    title={`Este plato se repite ${repeat} veces esta semana`}
                  >
                    ×{repeat}
                  </span>
                )}
              </button>
              <button
                className="meal-extra-remove"
                type="button"
                onClick={() => onRemoveExtra(dishIndex)}
                aria-label={`Quitar ${recipe.name}`}
                title="Quitar segundo plato"
              >
                <X size={11} strokeWidth={2.4} />
              </button>
            </div>
          );
        })}

        {extras.length === 0 && (
          <button
            className="meal-add-extra"
            type="button"
            onClick={() => onOpen("new")}
          >
            <Plus size={11} strokeWidth={2.4} />
            Segundo plato
          </button>
        )}

        <span className="meal-category" title={labels}>
          <span className="meal-category-dot" />
          <span className="meal-category-label">{labels}</span>
        </span>
      </div>

      <button
        className="meal-quick-swap"
        type="button"
        onClick={onQuickSwap}
        aria-label={`Proponer otro plato principal para ${mealKey}`}
        title="Proponer otro plato principal"
      >
        <Shuffle size={13} strokeWidth={2.2} />
      </button>
    </article>
  );
}
