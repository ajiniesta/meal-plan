"use client";

import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Repeat2,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
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
import { MAX_DISHES_PER_MEAL } from "@/lib/meals";
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
  dishIndex: number | "new" | null;
  plan: WeekPlan | null;
  plans: WeekPlan[];
  recipes: Recipe[];
  seasonMode: SeasonMode;
  onClose: () => void;
  onSelect: (
    mealKey: MealKey,
    recipeId: string,
    dishIndex: number | "new",
  ) => void;
  onRemove: (mealKey: MealKey, dishIndex: number) => void;
  onSwap: (from: MealKey, to: MealKey) => void;
  onSuggest: (mealKey: MealKey, dishIndex: number | "new") => void;
}

type Tab = "alternativas" | "repetir" | "intercambiar";
type Scope = "same" | "all";

export function MealModal({
  open,
  mealKey,
  dishIndex,
  plan,
  plans,
  recipes,
  seasonMode,
  onClose,
  onSelect,
  onRemove,
  onSwap,
  onSuggest,
}: MealModalProps) {
  const [tab, setTab] = useState<Tab>("alternativas");
  const [scope, setScope] = useState<Scope>("same");
  const [search, setSearch] = useState("");

  const isAdding = dishIndex === "new";
  const targetIndex = typeof dishIndex === "number" ? dishIndex : null;
  const slotRecipeIds = plan && mealKey ? plan.meals[mealKey] ?? [] : [];

  const currentRecipe =
    plan && mealKey && targetIndex !== null
      ? findRecipe(recipes, slotRecipeIds[targetIndex])
      : undefined;

  const otherRecipes = slotRecipeIds
    .filter((_, index) => index !== targetIndex)
    .map((recipeId) => findRecipe(recipes, recipeId))
    .filter((recipe): recipe is Recipe => Boolean(recipe));

  useEffect(() => {
    if (!open) return;
    setTab("alternativas");
    setScope(isAdding ? "all" : "same");
    setSearch("");
  }, [open, mealKey, dishIndex, isAdding]);

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

    for (const [key, recipeIds] of Object.entries(plan.meals)) {
      if (key === mealKey) continue;
      for (const recipeId of recipeIds) {
        counts.set(recipeId, (counts.get(recipeId) ?? 0) + 1);
      }
    }

    return counts;
  }, [plan, mealKey]);

  const alternatives = useMemo(() => {
    if (!plan || !mealKey) return [];

    const recent = getRecentRecipeIds(plans, plan.weekStart);
    const season = getSeasonContext(plan.weekStart, seasonMode);
    const normalizedSearch = search.trim().toLocaleLowerCase("es");
    const excludedIds = new Set(slotRecipeIds);

    return recipes
      .filter((recipe) => {
        if (excludedIds.has(recipe.id)) return false;
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
    slotRecipeIds,
  ]);

  const repeatCandidates = useMemo(() => {
    if (!plan || !mealKey) return [];

    const grouped = new Map<
      string,
      { recipe: Recipe; count: number; slots: string[] }
    >();

    for (const key of ALL_MEAL_KEYS) {
      if (key === mealKey) continue;

      for (const recipeId of plan.meals[key] ?? []) {
        if (slotRecipeIds.includes(recipeId)) continue;
        const recipe = findRecipe(recipes, recipeId);
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
    }

    return [...grouped.values()].sort(
      (left, right) =>
        right.count - left.count ||
        left.recipe.name.localeCompare(right.recipe.name, "es"),
    );
  }, [plan, mealKey, recipes, slotRecipeIds]);

  if (!open || !mealKey || !plan || dishIndex === null) return null;

  const currentMeta = currentRecipe ? CATEGORIES[currentRecipe.category] : null;
  const season = getSeasonContext(plan.weekStart, seasonMode);
  const slotNames = slotRecipeIds
    .map((recipeId) => findRecipe(recipes, recipeId)?.name)
    .filter((name): name is string => Boolean(name));
  const headerTitle = isAdding
    ? slotRecipeIds.length > 0
      ? "Añade un segundo plato"
      : "Elige un plato"
    : currentRecipe?.name ?? "Elige un plato";
  const dishLabel = isAdding
    ? " · segundo plato"
    : targetIndex === 1
      ? " · segundo plato"
      : slotRecipeIds.length > 1
        ? " · plato principal"
        : "";

  const handleSelect = (recipe: Recipe) => {
    onSelect(mealKey, recipe.id, dishIndex);
    onClose();
  };

  const handleSwap = (target: MealKey) => {
    if (target === mealKey) return;
    onSwap(mealKey, target);
    onClose();
  };

  const handleSuggest = () => {
    onSuggest(mealKey, dishIndex);
    onClose();
  };

  const handleRemove = () => {
    if (targetIndex === null) return;
    onRemove(mealKey, targetIndex);
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
              <span className="modal-eyebrow">
                {mealKeyLabel(mealKey)}
                {dishLabel}
              </span>
              <h2>{headerTitle}</h2>
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
          <div className="modal-dish-bar">
            <span className="modal-dish-context">
              {isAdding
                ? slotRecipeIds.length > 0
                  ? `Se añadirá junto a ${slotNames.join(" y ")}.`
                  : "Elige el primer plato de este hueco."
                : otherRecipes.length > 0
                  ? `También en este hueco: ${otherRecipes.map((recipe) => recipe.name).join(" y ")}.`
                  : "Este hueco solo tiene este plato."}
            </span>
            {!isAdding && (
              <button
                type="button"
                className="text-button modal-remove-dish"
                onClick={handleRemove}
              >
                <Trash2 size={13} />
                Quitar plato
              </button>
            )}
          </div>

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
              {isAdding ? <Plus size={15} /> : <Sparkles size={15} />}
              {isAdding ? "Añadir plato" : "Cambiar plato"}
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
                    {isAdding
                      ? "Se añadirá como segundo plato a este hueco. La compra no se duplica: los ingredientes del plato ya están en la lista."
                      : "Perfecto para sobras o para repetir algo que os gusta. La compra no se duplica: los ingredientes del plato ya están en la lista."}
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
                  <strong>Mueve los platos a otro hueco</strong>
                  <p>
                    Elige otro día o comida para intercambiar el contenido de los dos
                    huecos. El equilibrio semanal se mantiene.
                  </p>
                </div>
              </div>

              <div className="swap-grid">
                {ALL_MEAL_KEYS.map((targetKey) => {
                  const targetRecipes = (plan.meals[targetKey] ?? [])
                    .map((recipeId) => findRecipe(recipes, recipeId))
                    .filter((recipe): recipe is Recipe => Boolean(recipe));
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
                        {targetRecipes.length > 0
                          ? targetRecipes.map((recipe) => recipe.name).join(" + ")
                          : "Sin planificar"}
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
