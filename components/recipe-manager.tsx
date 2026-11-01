"use client";

import {
  Check,
  ChevronLeft,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  INGREDIENT_SECTIONS,
  RECIPES_BY_ID,
  SEASON_LABELS,
} from "@/lib/recipes";
import {
  countRecipeUsage,
  createCustomRecipeId,
  type RecipeBook,
} from "@/lib/recipe-book";
import type { StorageMode } from "@/lib/storage";
import type {
  Category,
  FishKind,
  Ingredient,
  MealType,
  Recipe,
  RecipeSeason,
  WeekPlan,
} from "@/lib/types";

interface RecipeManagerProps {
  open: boolean;
  recipes: Recipe[];
  book: RecipeBook;
  plans: WeekPlan[];
  mode: StorageMode;
  error?: string;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onResetBase: () => void;
}

interface RecipeDraft {
  id: string;
  name: string;
  category: Category;
  fishKind: FishKind | "";
  season: RecipeSeason;
  mealSlots: MealType[];
  emoji: string;
  ingredients: Ingredient[];
}

interface FormErrors {
  name?: string;
  ingredients?: string;
  slots?: string;
}

type Filter = Category | "todas";

function makeDraft(recipe?: Recipe): RecipeDraft {
  if (recipe) {
    return {
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      fishKind: recipe.fishKind ?? "",
      season: recipe.season,
      mealSlots: [...recipe.mealSlots],
      emoji: recipe.emoji,
      ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
    };
  }

  return {
    id: createCustomRecipeId(),
    name: "",
    category: "carne",
    fishKind: "",
    season: "todo",
    mealSlots: ["comida", "cena"],
    emoji: CATEGORIES.carne.emoji,
    ingredients: [{ name: "", section: "despensa" }],
  };
}

function slotLabel(slots: MealType[]): string {
  return slots
    .map((slot) => (slot === "comida" ? "Comida" : "Cena"))
    .join(" y ");
}

export function RecipeManager({
  open,
  recipes,
  book,
  plans,
  mode,
  error,
  onClose,
  onSave,
  onDelete,
  onRestore,
  onResetBase,
}: RecipeManagerProps) {
  const [view, setView] = useState<"list" | "form">("list");
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!open) return;
    setView("list");
    setDraft(null);
    setSearch("");
    setFilter("todas");
    setErrors({});
    setConfirmDelete(false);
    setConfirmReset(false);
  }, [open]);

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

  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("es");

    return recipes
      .filter((recipe) => filter === "todas" || recipe.category === filter)
      .filter((recipe) => {
        if (!normalized) return true;
        const haystack = [
          recipe.name,
          ...recipe.ingredients.map((ingredient) => ingredient.name),
        ]
          .join(" ")
          .toLocaleLowerCase("es");
        return haystack.includes(normalized);
      })
      .sort((left, right) => left.name.localeCompare(right.name, "es"));
  }, [recipes, filter, search]);

  const usage = draft ? countRecipeUsage(plans, draft.id) : 0;
  const hasBaseChanges =
    book.hiddenIds.length > 0 || Object.keys(book.overrides).length > 0;
  const canRestoreOriginal = Boolean(
    draft && RECIPES_BY_ID.has(draft.id) && book.overrides[draft.id],
  );
  const draftId = draft?.id;
  const isExisting = Boolean(
    draftId &&
      (RECIPES_BY_ID.has(draftId) ||
        book.custom.some((recipe) => recipe.id === draftId)),
  );

  if (!open) return null;

  const openNew = () => {
    setDraft(makeDraft());
    setErrors({});
    setConfirmDelete(false);
    setView("form");
  };

  const openEdit = (recipe: Recipe) => {
    setDraft(makeDraft(recipe));
    setErrors({});
    setConfirmDelete(false);
    setView("form");
  };

  const backToList = () => {
    setView("list");
    setDraft(null);
    setErrors({});
    setConfirmDelete(false);
  };

  const changeCategory = (category: Category) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        category,
        fishKind: category === "pescado" ? current.fishKind || "blanco" : "",
        emoji:
          current.emoji && current.emoji !== CATEGORIES[current.category].emoji
            ? current.emoji
            : CATEGORIES[category].emoji,
      };
    });
  };

  const toggleSlot = (slot: MealType) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        mealSlots: current.mealSlots.includes(slot)
          ? current.mealSlots.filter((item) => item !== slot)
          : [...current.mealSlots, slot],
      };
    });
  };

  const updateIngredient = (index: number, patch: Partial<Ingredient>) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        ingredients: current.ingredients.map((ingredient, position) =>
          position === index ? { ...ingredient, ...patch } : ingredient,
        ),
      };
    });
  };

  const addIngredient = () => {
    setDraft((current) =>
      current
        ? {
            ...current,
            ingredients: [
              ...current.ingredients,
              { name: "", section: "despensa" },
            ],
          }
        : current,
    );
  };

  const removeIngredient = (index: number) => {
    setDraft((current) => {
      if (!current || current.ingredients.length <= 1) return current;
      return {
        ...current,
        ingredients: current.ingredients.filter(
          (_, position) => position !== index,
        ),
      };
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;

    const nextErrors: FormErrors = {};
    const name = draft.name.trim();
    const ingredients = draft.ingredients
      .map((ingredient) => ({ ...ingredient, name: ingredient.name.trim() }))
      .filter((ingredient) => ingredient.name);

    if (!name) nextErrors.name = "Ponle un nombre al plato.";
    if (ingredients.length === 0) {
      nextErrors.ingredients = "Añade al menos un ingrediente.";
    }
    if (draft.mealSlots.length === 0) {
      nextErrors.slots = "Elige comida, cena o ambas.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSave({
      id: draft.id,
      name,

      category: draft.category,
      fishKind:
        draft.category === "pescado"
          ? draft.fishKind || "blanco"
          : undefined,
      season: draft.season,
      mealSlots: draft.mealSlots,
      ingredients,
      emoji: draft.emoji.trim() || CATEGORIES[draft.category].emoji,
    });

    setSearch("");
    setFilter("todas");
    backToList();
  };

  const handleDelete = () => {
    if (!draft) return;
    onDelete(draft.id);
    backToList();
  };

  const headerTitle =
    view === "form"
      ? isExisting
        ? "Editar plato"
        : "Nueva receta"
      : "Tus platos";

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal recipe-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Recetario"
      >
        <header className="modal-head">
          <div className="modal-head-main">
            <div className="modal-emoji recipe-emoji" aria-hidden="true">
              {view === "form" && draft ? draft.emoji : "📖"}
            </div>
            <div className="modal-head-copy">
              <span className="modal-eyebrow">Recetario</span>
              <h2>{headerTitle}</h2>
              <div className="modal-badges">
                <span className="mini-badge mini-badge-neutral">
                  {recipes.length} platos disponibles
                </span>
                {view === "form" && draft && (
                  <span
                    className="mini-badge"
                    style={{
                      background: CATEGORIES[draft.category].soft,
                      color: CATEGORIES[draft.category].color,
                    }}
                  >
                    {CATEGORIES[draft.category].label}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            type="button"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          {view === "list" ? (
            <>
              <div className="recipe-toolbar">
                <label className="search-field">
                  <Search size={15} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por plato o ingrediente"
                    type="search"
                  />
                </label>
                <button className="btn btn-primary" type="button" onClick={openNew}>
                  <Plus size={15} />
                  Nueva receta
                </button>
              </div>

              <div className="recipe-filters" aria-label="Filtrar por categoría">
                <button
                  type="button"
                  className={filter === "todas" ? "active" : ""}
                  onClick={() => setFilter("todas")}
                >
                  Todas
                </button>
                {CATEGORY_ORDER.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={filter === category ? "active" : ""}
                    onClick={() => setFilter(category)}
                  >
                    <span aria-hidden="true">{CATEGORIES[category].emoji}</span>
                    {CATEGORIES[category].label}
                  </button>
                ))}
              </div>

              {filtered.length > 0 ? (
                <div className="recipe-list">
                  {filtered.map((recipe) => {
                    const meta = CATEGORIES[recipe.category];
                    const isCustom = book.custom.some(
                      (item) => item.id === recipe.id,
                    );
                    const isEdited = Boolean(book.overrides[recipe.id]);
                    const origin = isCustom
                      ? "Propia"
                      : isEdited
                        ? "Editada"
                        : "Base";

                    return (
                      <button
                        className="recipe-row"
                        type="button"
                        key={recipe.id}
                        onClick={() => openEdit(recipe)}
                      >
                        <span
                          className="recipe-row-emoji"
                          style={{ background: meta.soft, color: meta.color }}
                          aria-hidden="true"
                        >
                          {recipe.emoji}
                        </span>
                        <span className="recipe-row-copy">
                          <strong>{recipe.name}</strong>
                          <span>
                            {meta.label} · {SEASON_LABELS[recipe.season]} ·{" "}
                            {slotLabel(recipe.mealSlots)} ·{" "}
                            {recipe.ingredients.length}{" "}
                            {recipe.ingredients.length === 1
                              ? "ingrediente"
                              : "ingredientes"}
                          </span>
                        </span>
                        <span
                          className={`recipe-origin ${isCustom ? "custom" : isEdited ? "edited" : ""}`}
                        >
                          {origin}
                        </span>
                        <Pencil size={14} className="recipe-row-pencil" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="modal-empty">
                  <Search size={22} />
                  <strong>No hay platos con ese filtro</strong>
                  <p>Prueba otra búsqueda o crea una receta nueva.</p>
                </div>
              )}

              <div className="recipe-manager-foot">
                <p className="recipe-footnote">
                  {error
                    ? "Recetario guardado solo en este dispositivo. No se pudo sincronizar con Supabase."
                    : mode === "cloud"
                      ? "Recetario guardado en Supabase y en este dispositivo."
                      : "Recetario guardado solo en este dispositivo."}{" "}
                  Los cambios se aplican a la planificación y a la lista de la compra.
                </p>
                {error && (
                  <p className="info-warning">
                    No se pudo sincronizar el recetario: {error}
                  </p>
                )}
                {hasBaseChanges &&
                  (confirmReset ? (
                    <div className="recipe-confirm">
                      <p>
                        Se recuperarán los platos originales y se perderán las
                        ediciones de los platos base. Tus recetas propias se mantienen.
                      </p>
                      <div className="recipe-confirm-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setConfirmReset(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => {
                            onResetBase();
                            setConfirmReset(false);
                          }}
                        >
                          Restaurar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setConfirmReset(true)}
                    >
                      <RotateCcw size={13} />
                      Restaurar platos base
                    </button>
                  ))}
              </div>
            </>
          ) : (
            draft && (
              <form className="recipe-form" onSubmit={handleSubmit}>
                <button
                  type="button"
                  className="text-button recipe-back"
                  onClick={backToList}
                >
                  <ChevronLeft size={14} />
                  Volver al recetario
                </button>

                <label className="field">
                  <span>Nombre del plato</span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    placeholder="Ej. Lentejas de la abuela"
                    autoFocus
                  />
                  {errors.name && <em>{errors.name}</em>}
                </label>

                <div className="field-row">
                  <label className="field">
                    <span>Categoría</span>
                    <select
                      value={draft.category}
                      onChange={(event) =>
                        changeCategory(event.target.value as Category)
                      }
                    >
                      {CATEGORY_ORDER.map((category) => (
                        <option value={category} key={category}>
                          {CATEGORIES[category].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Temporada</span>
                    <select
                      value={draft.season}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          season: event.target.value as RecipeSeason,
                        })
                      }
                    >
                      <option value="todo">Todo el año</option>
                      <option value="verano">Verano</option>
                      <option value="invierno">Invierno</option>
                    </select>
                  </label>
                </div>

                {draft.category === "pescado" && (
                  <label className="field">
                    <span>Tipo de pescado</span>
                    <select
                      value={draft.fishKind || "blanco"}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          fishKind: event.target.value as FishKind,
                        })
                      }
                    >
                      <option value="blanco">Blanco</option>
                      <option value="azul">Azul</option>
                      <option value="marisco">Marisco</option>
                    </select>
                  </label>
                )}

                <div className="field-row">
                  <div className="field">
                    <span>Huecos de la semana</span>
                    <div className="slot-checks">
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.mealSlots.includes("comida")}
                          onChange={() => toggleSlot("comida")}
                        />
                        Comida
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.mealSlots.includes("cena")}
                          onChange={() => toggleSlot("cena")}
                        />
                        Cena
                      </label>
                    </div>
                    {errors.slots && <em>{errors.slots}</em>}
                  </div>
                  <label className="field">
                    <span>Emoji</span>
                    <input
                      value={draft.emoji}
                      onChange={(event) =>
                        setDraft({ ...draft, emoji: event.target.value })
                      }
                      maxLength={8}
                      aria-label="Emoji del plato"
                    />
                  </label>
                </div>

                <div className="ingredients-editor">
                  <div className="ingredients-editor-head">
                    <span>Ingredientes</span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={addIngredient}
                    >
                      <Plus size={13} />
                      Añadir
                    </button>
                  </div>

                  {draft.ingredients.map((ingredient, index) => (
                    <div className="ingredient-row" key={index}>
                      <input
                        value={ingredient.name}
                        onChange={(event) =>
                          updateIngredient(index, { name: event.target.value })
                        }
                        placeholder="Ej. tomate"
                        aria-label={`Ingrediente ${index + 1}`}
                      />
                      <select
                        value={ingredient.section}
                        onChange={(event) =>
                          updateIngredient(index, {
                            section: event.target.value as Ingredient["section"],
                          })
                        }
                        aria-label={`Sección del ingrediente ${index + 1}`}
                      >
                        {INGREDIENT_SECTIONS.map((section) => (
                          <option value={section.id} key={section.id}>
                            {section.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="icon-button small"
                        onClick={() => removeIngredient(index)}
                        disabled={draft.ingredients.length <= 1}
                        aria-label={`Quitar ingrediente ${index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {errors.ingredients && <em>{errors.ingredients}</em>}
                </div>

                {confirmDelete && (
                  <div className="recipe-confirm">
                    <p>
                      Se eliminará «{draft.name || "este plato"}» del recetario
                      {usage > 0
                        ? ` y de ${usage} ${usage === 1 ? "plato planificado" : "platos planificados"}.`
                        : "."}
                    </p>
                    <div className="recipe-confirm-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={handleDelete}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}

                <div className="recipe-form-actions">
                  {isExisting && (
                    <button
                      type="button"
                      className="text-button danger"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={13} />
                      Eliminar
                    </button>
                  )}
                  {canRestoreOriginal && draft && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        onRestore(draft.id);
                        backToList();
                      }}
                    >
                      <RotateCcw size={13} />
                      Restaurar original
                    </button>
                  )}
                  <span className="recipe-form-spacer" />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={backToList}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Check size={15} />
                    Guardar
                  </button>
                </div>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}
