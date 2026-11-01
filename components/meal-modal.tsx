"use client";

import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  FISH_LABELS,
  RECIPES,
  SEASON_LABELS,
  getRecipe,
} from "@/lib/recipes";
import { getSeasonContext } from "@/lib/dates";
import {
  ALL_MEAL_KEYS,
  getRecentRecipeIds,
  mealKeyLabel,
} from "@/lib/planner";
import { DAYS } from "@/lib/dates";
import type { MealKey, Recipe, SeasonMode, WeekPlan } from "@/lib/types";

interface MealModalProps {
  open: boolean;
  mealKey: MealKey | null;
  plan: WeekPlan | null;
  plans: WeekPlan[];
  seasonMode: SeasonMode;
  onClose: () => void;
  onSelect: (mealKey: MealKey, recipeId: string) => void;
  onSwap: (from: MealKey, to: MealKey) => void;
  onSuggest: (mealKey: MealKey) => void;
}

type Tab = "alternativas" | "intercambiar";
type Scope = "same" | "all";

export function MealModal({
  open,
  mealKey,
  plan,
  plans,
  seasonMode,
  onClose,
  onSelect,
  onSwap,
  onSuggest,
}: MealModalProps) {
  const [tab, setTab] = useState<Tab>("alternativas");
  const [scope, setScope] = useState<Scope>("same");
  const [search, setSearch] = useState("");

  const currentRecipe = plan && mealKey ? getRecipe(plan.meals[mealKey]) : undefined;

  useEffect(() => {
    if (!open) return;
    setTab("alternativas");
    setScope("same");
    setSearch("");
  }, [open, mealKey]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const mealType = mealKey?.endsWith("-comida") ? "comida" : "cena";

  const alternatives = useMemo(() => {
    if (!plan || !mealKey) return [];

    const used = new Set(
      Object.entries(plan.meals)
        .filter(([key]) => key !== mealKey)
        .map(([, recipeId]) => recipeId),
    );
    const recent = getRecentRecipeIds(plans, plan.weekStart);
    const season = getSeasonContext(plan.weekStart, seasonMode);
    const normalizedSearch = search.trim().toLocaleLowerCase("es");

    return RECIPES.filter((recipe) => {
      if (recipe.id === currentRecipe?.id) return false;
      if (!recipe.mealSlots.includes(mealType)) return false;
      if (used.has(recipe.id)) return false;
      if (scope === "same" && currentRecipe && recipe.category !== currentRecipe.category) {
        return false;
      }
      if (!normalizedSearch) return true;

      const haystack = [recipe.name, ...recipe.ingredients.map((item) => item.name)]
        .join(" ")
        .toLocaleLowerCase("es");
      return haystack.includes(normalizedSearch);
    })
      .sort((left, right) => {
        const leftKind = currentRecipe?.fishKind && left.fishKind === currentRecipe.fishKind ? 0 : 1;
        const rightKind = currentRecipe?.fishKind && right.fishKind === currentRecipe.fishKind ? 0 : 1;
        if (leftKind !== rightKind) return leftKind - rightKind;

        const leftSeason = season.climate === "templado" || left.season === "todo" || left.season === season.climate ? 0 : 1;
        const rightSeason = season.climate === "templado" || right.season === "todo" || right.season === season.climate ? 0 : 1;
        if (leftSeason !== rightSeason) return leftSeason - rightSeason;

        const leftRecent = recent.has(left.id) ? 1 : 0;
        const rightRecent = recent.has(right.id) ? 1 : 0;
        if (leftRecent !== rightRecent) return leftRecent - rightRecent;

        return left.name.localeCompare(right.name, "es");
      });
  }, [plan, mealKey, plans, search, scope, currentRecipe, mealType, seasonMode]);

  if (!open || !mealKey || !plan) return null;

  const currentMeta = currentRecipe ? CATEGORIES[currentRecipe.category] : null;
  const season = getSeasonContext(plan.weekStart, seasonMode);

  const handleSelect = (recipe: Recipe) => {
    onSelect(mealKey, recipe.id);
    onClose();
  };

  const handleSwap = (target: MealKey) => {
    if (target === mealKey) return;
    onSwap(mealKey, target);
    onClose();
  };

  const handleSuggest = () => {
    onSuggest(mealKey);
    onClose();
  };

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal meal-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Cambiar ${mealKeyLabel(mealKey)}`}
      >
        <header className="modal-head">
          <div className="modal-head-main">
            <div
              className="modal-emoji"
              style={
                currentMeta
                  ? { background: currentMeta.soft, color: currentMeta.color }
                  : undefined
              }
              aria-hidden="true"
            >
              {currentRecipe?.emoji ?? "＋"}
            </div>
            <div className="modal-head-copy">
              <span className="modal-eyebrow">{mealKeyLabel(mealKey)}</span>
              <h2>{currentRecipe?.name ?? "Elige un plato"}</h2>
              <div className="modal-badges">
                {currentMeta && (
                  <span
                    className="mini-badge"
                    style={{ background: currentMeta.soft, color: currentMeta.color }}
                  >
                    {currentMeta.label}
                  </span>
                )}
                {currentRecipe && (
                  <span className="mini-badge mini-badge-neutral">
                    {SEASON_LABELS[currentRecipe.season]}
                  </span>
                )}
                {currentRecipe?.fishKind && (
                  <span className="mini-badge mini-badge-neutral">
                    {FISH_LABELS[currentRecipe.fishKind]}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          {currentRecipe && (
            <details className="ingredients-details">
              <summary>
                Ingredientes
                <span>{currentRecipe.ingredients.length}</span>
                <ChevronDown size={13} className="ingredients-chevron" />
              </summary>
              <div className="ingredient-chips">
                {currentRecipe.ingredients.map((ingredient) => (
                  <span className="ingredient-chip" key={`${ingredient.section}-${ingredient.name}`}>
                    {ingredient.name}
                  </span>
                ))}
              </div>
            </details>
          )}

          <div className="modal-tabs" role="tablist" aria-label="Opciones del plato">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "alternativas"}
              className={tab === "alternativas" ? "active" : ""}
              onClick={() => setTab("alternativas")}
            >
              <Sparkles size={15} />
              Cambiar plato
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "intercambiar"}
              className={tab === "intercambiar" ? "active" : ""}
              onClick={() => setTab("intercambiar")}
            >
              <ArrowLeftRight size={15} />
              Intercambiar
            </button>
          </div>

          {tab === "alternativas" ? (
            <>
              <div className="modal-toolbar">
                <label className="search-field">
                  <Search size={15} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por plato o ingrediente"
                    type="search"
                  />
                </label>
                <div className="scope-switch" aria-label="Filtrar alternativas">
                  <button
                    type="button"
                    className={scope === "same" ? "active" : ""}
                    onClick={() => setScope("same")}
                    disabled={!currentRecipe}
                  >
                    Misma categoría
                  </button>
                  <button
                    type="button"
                    className={scope === "all" ? "active" : ""}
                    onClick={() => setScope("all")}
                  >
                    Todos
                  </button>
                </div>
              </div>

              <div className="alternatives-head">
                <span>
                  {alternatives.length} {alternatives.length === 1 ? "opción" : "opciones"} para{" "}
                  {mealType}
                </span>
                <button type="button" className="text-button" onClick={handleSuggest}>
                  <Shuffle size={13} />
                  Sorpréndeme
                </button>
              </div>

              {alternatives.length > 0 ? (
                <div className="alternatives-grid">
                  {alternatives.map((recipe) => {
                    const meta = CATEGORIES[recipe.category];
                    return (
                      <button
                        className="alternative-card"
                        type="button"
                        key={recipe.id}
                        onClick={() => handleSelect(recipe)}
                      >
                        <span
                          className="alternative-emoji"
                          style={{ background: meta.soft, color: meta.color }}
                          aria-hidden="true"
                        >
                          {recipe.emoji}
                        </span>
                        <span className="alternative-copy">
                          <strong>{recipe.name}</strong>
                          <span>
                            {meta.label}
                            {recipe.fishKind
                              ? ` · ${
                                  recipe.fishKind === "blanco"
                                    ? "blanco"
                                    : recipe.fishKind === "azul"
                                      ? "azul"
                                      : "marisco"
                                }`
                              : ""}
                            {recipe.season !== "todo" ? ` · ${SEASON_LABELS[recipe.season]}` : ""}
                          </span>
                        </span>
                        <ChevronRight size={15} className="alternative-chevron" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="modal-empty">
                  <Search size={22} />
                  <strong>No hay platos con ese filtro</strong>
                  <p>Prueba a buscar otra cosa o cambia a “Todos”.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="swap-intro">
                <span className="swap-icon">
                  <ArrowLeftRight size={18} />
                </span>
                <div>
                  <strong>Mueve el plato a otro hueco</strong>
                  <p>
                    Elige otro día o comida para intercambiar los dos platos. El equilibrio
                    semanal se mantiene.
                  </p>
                </div>
              </div>

              <div className="swap-grid">
                {ALL_MEAL_KEYS.map((targetKey) => {
                  const targetRecipe = getRecipe(plan.meals[targetKey]);
                  const [dayId, targetType] = targetKey.split("-");
                  const day = DAYS.find((item) => item.id === dayId);
                  const isCurrent = targetKey === mealKey;
                  const isComida = targetType === "comida";

                  return (
                    <button
                      key={targetKey}
                      type="button"
                      className={`swap-slot ${isCurrent ? "current" : ""}`}
                      onClick={() => handleSwap(targetKey)}
                      disabled={isCurrent}
                    >
                      <span className="swap-slot-day">
                        {day?.short} · {isComida ? "comida" : "cena"}
                      </span>
                      <span className="swap-slot-name">
                        {targetRecipe?.name ?? "Sin planificar"}
                      </span>
                      {isCurrent ? (
                        <span className="swap-current-tag">
                          <Check size={12} /> Actual
                        </span>
                      ) : (
                        <ArrowLeftRight size={13} className="swap-slot-arrow" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <p className="modal-season-note">
            <Sparkles size={13} />
            Temporada {season.label.toLowerCase()}: priorizamos recetas adecuadas para esta
            época.
          </p>
        </div>
      </div>
    </div>
  );
}
