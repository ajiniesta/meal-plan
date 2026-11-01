"use client";

import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronRight,
  Repeat2,
  Search,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  FISH_LABELS,
  SEASON_LABELS,
  findRecipe,
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
  recipes: Recipe[];
  seasonMode: SeasonMode;
  onClose: () => void;
  onSelect: (mealKey: MealKey, recipeId: string) => void;
  onSwap: (from: MealKey, to: MealKey) => void;
  onSuggest: (mealKey: MealKey) => void;
}

type Tab = "alternativas" | "repetir" | "intercambiar";
type Scope = "same" | "all";

export function MealModal({
  open,
  mealKey,
  plan,
  plans,
  recipes,
  seasonMode,
  onClose,
  onSelect,
  onSwap,
  onSuggest,
}: MealModalProps) {
  const [tab, setTab] = useState<Tab>("alternativas");
  const [scope, setScope] = useState<Scope>("same");
  const [search, setSearch] = useState("");

  const currentRecipe =
    plan && mealKey ? findRecipe(recipes, plan.meals[mealKey]) : undefined;

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

  const usedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!plan || !mealKey) return counts;

    for (const [key, recipeId] of Object.entries(plan.meals)) {
      if (key === mealKey || !recipeId) continue;
      counts.set(recipeId, (counts.get(recipeId) ?? 0) + 1);
    }

    return counts;
  }, [plan, mealKey]);

  const alternatives = useMemo(() => {
    if (!plan || !mealKey) return [];

    const recent = getRecentRecipeIds(plans, plan.weekStart);
    const season = getSeasonContext(plan.weekStart, seasonMode);
    const normalizedSearch = search.trim().toLocaleLowerCase("es");

    return recipes
      .filter((recipe) => {
        if (recipe.id === currentRecipe?.id) return false;
        if (!recipe.mealSlots.includes(mealType)) return false;
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
        const leftUsed = usedCounts.has(left.id) ? 1 : 0;
        const rightUsed = usedCounts.has(right.id) ? 1 : 0;
        if (leftUsed !== rightUsed) return leftUsed - rightUsed;

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
  }, [
    plan,
    mealKey,
    plans,
    recipes,
    search,
    scope,
    currentRecipe,
    mealType,
    seasonMode,
    usedCounts,
  ]);

  const repeatCandidates = useMemo(() => {
    if (!plan || !mealKey) return [];

    const grouped = new Map<
      string,
      { recipe: Recipe; count: number; slots: string[] }
    >();

    for (const key of ALL_MEAL_KEYS) {
      if (key === mealKey) continue;
      const recipe = findRecipe(recipes, plan.meals[key]);
      if (!recipe) continue;

      const [dayId, slotType] = key.split("-");
      const day = DAYS.find((item) => item.id === dayId);
      const entry = grouped.get(recipe.id) ?? {
        recipe,
        count: 0,
        slots: [],
      };
      entry.count += 1;
      entry.slots.push(`${day?.short ?? dayId} ${slotType}`);
      grouped.set(recipe.id, entry);
    }

    return [...grouped.values()].sort(
      (left, right) =>
        right.count - left.count ||
        left.recipe.name.localeCompare(right.recipe.name, "es"),
    );
  }, [plan, mealKey, recipes]);

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
              aria-selected={tab === "repetir"}
              className={tab === "repetir" ? "active" : ""}
              onClick={() => setTab("repetir")}
            >
              <Repeat2 size={15} />
              Repetir
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
                    const used = usedCounts.get(recipe.id) ?? 0;
                    return (
                      <button
                        className={`alternative-card ${used > 0 ? "is-used" : ""}`}
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
                        {used > 0 && (
                          <span
                            className="alternative-used"
                            title={`Ya está en la semana (${used} ${used === 1 ? "vez" : "veces"})`}
                          >
                            Repetir
                          </span>
                        )}
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
          ) : tab === "repetir" ? (
            <>
              <div className="repeat-intro">
                <span className="swap-icon">
                  <Repeat2 size={18} />
                </span>
                <div>
                  <strong>Repite un plato de esta semana</strong>
                  <p>
                    Perfecto para sobras o para repetir algo que os gusta. La compra no se
                    duplica: los ingredientes del plato ya están en la lista.
                  </p>
                </div>
              </div>

              {repeatCandidates.length > 0 ? (
                <div className="repeat-list">
                  {repeatCandidates.map(({ recipe, count, slots }) => {
                    const meta = CATEGORIES[recipe.category];
                    const visibleSlots = slots.slice(0, 3).join(", ");
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
                            {count} {count === 1 ? "vez" : "veces"} esta semana ·{" "}
                            {visibleSlots}
                            {slots.length > 3 ? "…" : ""}
                          </span>
                        </span>
                        <span className="repeat-action">
                          Repetir
                          <ChevronRight size={13} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="modal-empty">
                  <Repeat2 size={22} />
                  <strong>Todavía no hay platos que repetir</strong>
                  <p>Cuando la semana tenga platos, podrás reutilizarlos aquí.</p>
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
                  const targetRecipe = findRecipe(recipes, plan.meals[targetKey]);
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
