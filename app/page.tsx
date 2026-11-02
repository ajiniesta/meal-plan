"use client";

import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cloud,
  HardDrive,
  Info,
  Leaf,
  Loader2,
  LogOut,
  RefreshCw,
  Share2,
  ShoppingBasket,
  Snowflake,
  Sparkles,
  Sun,
  UserRound,
  Users,
  Utensils,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { BalanceCard } from "@/components/balance-card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InfoModal } from "@/components/info-modal";
import { MealCard } from "@/components/meal-card";
import { MealModal } from "@/components/meal-modal";
import { RecipeManager } from "@/components/recipe-manager";
import { ShareModal } from "@/components/share-modal";
import { ShoppingList } from "@/components/shopping-list";
import {
  DAYS,
  addDaysISO,
  formatDayNumber,
  formatRelativeWeek,
  formatWeekLong,
  formatWeekRange,
  getMondayISO,
  getSeasonContext,
  getWeekNumber,
  isCurrentWeek,
  toISODate,
} from "@/lib/dates";
import {
  buildShoppingList,
  generateWeekPlan,
  getPlanRecipe,
  getPlanStats,
  getRecentRecipeIds,
  pickRecipeForSlot,
} from "@/lib/planner";
import { RECIPES_BY_ID, findRecipe } from "@/lib/recipes";
import {
  EMPTY_RECIPE_BOOK,
  buildRecipeCatalog,
  type RecipeBook,
} from "@/lib/recipe-book";
import {
  loadPlanShares,
  loadPlans,
  loadPlansForOwner,
  loadRecipeBook,
  savePlan,
  saveRecipeBook,
  type StorageMode,
} from "@/lib/storage";
import {
  getSessionUser,
  getSupabaseClient,
  isSupabaseConfigured,
  signOutUser,
} from "@/lib/supabase";
import type {
  MealKey,
  PlanShare,
  Recipe,
  SeasonMode,
  WeekPlan,
} from "@/lib/types";

interface ToastState {
  id: number;
  message: string;
}

function upsertPlan(plans: WeekPlan[], plan: WeekPlan): WeekPlan[] {
  const exists = plans.some((item) => item.weekStart === plan.weekStart);
  const next = exists
    ? plans.map((item) => (item.weekStart === plan.weekStart ? plan : item))
    : [...plans, plan];

  return next.sort((left, right) => left.weekStart.localeCompare(right.weekStart));
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="loading-screen">
      <div className="loading-brand">
        <span className="loading-mark">
          <Leaf size={24} />
        </span>
        <span>Mesa</span>
      </div>
      <div className="loading-status">
        <Loader2 size={16} className="spin" />
        {label}
      </div>
    </div>
  );
}

export default function HomePage() {
  const supabaseConfigured = isSupabaseConfigured();
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [todayISO, setTodayISO] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [plans, setPlans] = useState<WeekPlan[]>([]);
  const [sharedPlans, setSharedPlans] = useState<WeekPlan[]>([]);
  const [activeShare, setActiveShare] = useState<PlanShare | null>(null);
  const [shares, setShares] = useState<PlanShare[]>([]);
  const [shareError, setShareError] = useState<string | undefined>();
  const [mode, setMode] = useState<StorageMode>("local");
  const [syncError, setSyncError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [viewLoading, setViewLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<SeasonMode>("auto");
  const [modalMeal, setModalMeal] = useState<MealKey | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [recipeBook, setRecipeBook] = useState<RecipeBook>(EMPTY_RECIPE_BOOK);
  const [recipeError, setRecipeError] = useState<string | undefined>();
  const [toast, setToast] = useState<ToastState | null>(null);
  const warnedRef = useRef(false);
  const initGenerationRef = useRef(0);
  const viewGenerationRef = useRef(0);

  const recipes = useMemo(() => buildRecipeCatalog(recipeBook), [recipeBook]);

  const notify = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  const closeMealModal = useCallback(() => setModalMeal(null), []);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const closeManager = useCallback(() => setManagerOpen(false), []);
  const closeShare = useCallback(() => setShareOpen(false), []);

  const initializeLocal = useCallback(async () => {
    const generation = ++initGenerationRef.current;
    const currentWeek = getMondayISO(new Date());

    const result = await loadPlans();
    const bookResult = await loadRecipeBook();
    if (generation !== initGenerationRef.current) return;

    const catalog = buildRecipeCatalog(bookResult.book);
    setRecipeBook(bookResult.book);
    if (bookResult.error) setRecipeError(bookResult.error);

    let nextPlans = result.plans;
    let currentPlan = nextPlans.find((plan) => plan.weekStart === currentWeek);

    if (!currentPlan) {
      currentPlan = generateWeekPlan(currentWeek, "auto", nextPlans, catalog);
      nextPlans = [...nextPlans, currentPlan].sort((left, right) =>
        left.weekStart.localeCompare(right.weekStart),
      );
      void savePlan(currentPlan).then((saveResult) => {
        if (generation !== initGenerationRef.current) return;
        setMode(saveResult.mode);
        if (saveResult.error) setSyncError(saveResult.error);
      });
    }

    setPlans(nextPlans);
    setMode(result.mode);
    setSelectedSeason(currentPlan.seasonMode);
    if (result.error) setSyncError(result.error);
    setLoading(false);
  }, []);

  const initializeUser = useCallback(async (nextUser: User) => {
    const generation = ++initGenerationRef.current;
    const currentWeek = getMondayISO(new Date());

    setUser(nextUser);
    setAuthReady(true);
    setLoading(true);
    setSyncError(undefined);
    setRecipeError(undefined);
    setShareError(undefined);
    setActiveShare(null);
    setSharedPlans([]);
    setShares([]);
    setViewLoading(false);
    viewGenerationRef.current += 1;

    // En serie para no saturar la sesión recién creada.
    const result = await loadPlans(nextUser.id);
    const bookResult = await loadRecipeBook();
    if (generation !== initGenerationRef.current) return;

    const catalog = buildRecipeCatalog(bookResult.book);
    setRecipeBook(bookResult.book);
    if (bookResult.error) setRecipeError(bookResult.error);

    let nextPlans = result.plans;
    let currentPlan = nextPlans.find((plan) => plan.weekStart === currentWeek);

    if (!currentPlan) {
      currentPlan = generateWeekPlan(currentWeek, "auto", nextPlans, catalog);
      nextPlans = [...nextPlans, currentPlan].sort((left, right) =>
        left.weekStart.localeCompare(right.weekStart),
      );
      void savePlan(currentPlan, nextUser.id).then((saveResult) => {
        if (generation !== initGenerationRef.current) return;
        setMode(saveResult.mode);
        if (saveResult.error) setSyncError(saveResult.error);
      });
    }

    setPlans(nextPlans);
    setMode(result.mode);
    setSelectedSeason(currentPlan.seasonMode);
    if (result.error) setSyncError(result.error);
    setLoading(false);

    const sharesResult = await loadPlanShares();
    if (generation !== initGenerationRef.current) return;
    setShares(sharesResult.shares);
    if (sharesResult.error) setShareError(sharesResult.error);
  }, []);

  const handleAuthenticated = useCallback(
    (nextUser: User) => {
      void initializeUser(nextUser);
    },
    [initializeUser],
  );

  useEffect(() => {
    const currentWeek = getMondayISO(new Date());
    setWeekStart(currentWeek);
    setTodayISO(toISODate(new Date()));

    const client = getSupabaseClient();
    if (!client) {
      void initializeLocal();
      return;
    }

    let cancelled = false;

    getSessionUser(client)
      .then((sessionUser) => {
        if (cancelled) return;
        if (sessionUser) {
          void initializeUser(sessionUser);
        } else {
          setAuthReady(true);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAuthReady(true);
        setSyncError(
          error instanceof Error
            ? error.message
            : "No se pudo comprobar la sesión de Supabase.",
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initializeLocal, initializeUser]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;

      initGenerationRef.current += 1;
      viewGenerationRef.current += 1;
      setUser(null);
      setPlans([]);
      setSharedPlans([]);
      setShares([]);
      setActiveShare(null);
      setRecipeBook(EMPTY_RECIPE_BOOK);
      setManagerOpen(false);
      setShareOpen(false);
      setModalMeal(null);
      setShareError(undefined);
      setSyncError(undefined);
      setAuthReady(true);
      setLoading(false);
      setViewLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!syncError || warnedRef.current) return;
    warnedRef.current = true;
    notify("No se pudo conectar con Supabase. Guardando en este dispositivo.");
  }, [syncError, notify]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const incomingShares = useMemo(
    () => shares.filter((share) => share.viewerId === user?.id),
    [shares, user],
  );

  const outgoingShares = useMemo(
    () => shares.filter((share) => share.ownerId === user?.id),
    [shares, user],
  );

  const activePlans = activeShare ? sharedPlans : plans;

  const currentPlan = useMemo(
    () => activePlans.find((plan) => plan.weekStart === weekStart),
    [activePlans, weekStart],
  );

  const stats = useMemo(
    () => (currentPlan ? getPlanStats(currentPlan, recipes) : null),
    [currentPlan, recipes],
  );

  const recipeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!currentPlan) return counts;

    for (const recipeId of Object.values(currentPlan.meals)) {
      if (!recipeId) continue;
      counts.set(recipeId, (counts.get(recipeId) ?? 0) + 1);
    }

    return counts;
  }, [currentPlan]);

  const uniqueDishes = useMemo(
    () =>
      currentPlan
        ? new Set(Object.values(currentPlan.meals).filter(Boolean)).size
        : 0,
    [currentPlan],
  );

  const plannedMeals = useMemo(
    () =>
      currentPlan
        ? Object.values(currentPlan.meals).filter(Boolean).length
        : 0,
    [currentPlan],
  );

  const shoppingCount = useMemo(
    () =>
      currentPlan
        ? buildShoppingList(currentPlan, recipes).reduce(
            (sum, group) => sum + group.items.length,
            0,
          )
        : 0,
    [currentPlan, recipes],
  );

  const persist = useCallback(
    (plan: WeekPlan) => {
      const stamped: WeekPlan = {
        ...plan,
        updatedAt: new Date().toISOString(),
      };

      // Al editar un plan compartido, la semana pertenece a su dueño.
      const ownerId = activeShare?.ownerId ?? user?.id;

      if (activeShare) {
        setSharedPlans((previous) => upsertPlan(previous, stamped));
      } else {
        setPlans((previous) => upsertPlan(previous, stamped));
      }

      void savePlan(stamped, ownerId).then((result) => {
        setMode(result.mode);
        if (result.error) setSyncError(result.error);
        else setSyncError(undefined);
      });
    },
    [user, activeShare],
  );

  const handleGenerate = useCallback(
    (targetWeek = weekStart, seasonMode = selectedSeason) => {
      if (!targetWeek) return;
      const history = activePlans.filter((plan) => plan.weekStart !== targetWeek);
      const next = generateWeekPlan(targetWeek, seasonMode, history, recipes);
      persist(next);
      notify(
        activeShare
          ? "Semana compartida generada con equilibrio y temporada"
          : "Semana generada con equilibrio y temporada",
      );
    },
    [weekStart, selectedSeason, activePlans, recipes, persist, notify, activeShare],
  );

  const requestGenerate = () => {
    if (currentPlan) {
      setConfirmOpen(true);
      return;
    }
    handleGenerate();
  };

  const handleSeasonChange = (nextMode: SeasonMode) => {
    setSelectedSeason(nextMode);
    if (currentPlan) {
      persist({ ...currentPlan, seasonMode: nextMode });
      notify("Temporada guardada. Regenera para aplicarla a los platos.");
    } else {
      notify(
        nextMode === "auto"
          ? "Temporada automática"
          : `Temporada de ${nextMode}`,
      );
    }
  };

  const goToWeek = (offset: number) => {
    if (!weekStart) return;
    const nextWeek = addDaysISO(weekStart, offset * 7);
    const nextPlan = activePlans.find((plan) => plan.weekStart === nextWeek);
    setWeekStart(nextWeek);
    setSelectedSeason(nextPlan?.seasonMode ?? "auto");
    setModalMeal(null);
  };

  const goToCurrentWeek = () => {
    const currentWeek = getMondayISO(new Date());
    const nextPlan = activePlans.find((plan) => plan.weekStart === currentWeek);
    setWeekStart(currentWeek);
    setSelectedSeason(nextPlan?.seasonMode ?? "auto");
    setModalMeal(null);
  };

  const handleQuickSwap = (mealKey: MealKey) => {
    if (!currentPlan) return;
    const currentRecipe = findRecipe(recipes, currentPlan.meals[mealKey]);
    if (!currentRecipe) return;

    const usedIds = new Set(
      Object.entries(currentPlan.meals)
        .filter(([key]) => key !== mealKey)
        .map(([, recipeId]) => recipeId),
    );
    const recentIds = getRecentRecipeIds(activePlans, currentPlan.weekStart);
    const season = getSeasonContext(
      currentPlan.weekStart,
      currentPlan.seasonMode,
    );
    const mealType = mealKey.endsWith("-comida") ? "comida" : "cena";

    const replacement = pickRecipeForSlot({
      requirement: {
        category: currentRecipe.category,
        fishKind: currentRecipe.fishKind,
      },
      mealType,
      usedIds,
      recentIds,
      climate: season.climate,
      excludeId: currentRecipe.id,
      recipes,
    });

    if (!replacement) {
      notify("No hay otra opción disponible para este hueco");
      return;
    }

    persist({
      ...currentPlan,
      meals: { ...currentPlan.meals, [mealKey]: replacement.id },
    });
    notify("Plato cambiado");
  };

  const handleSelect = (mealKey: MealKey, recipeId: string) => {
    if (!currentPlan) return;
    const repeated = Object.entries(currentPlan.meals).some(
      ([key, id]) => key !== mealKey && id === recipeId,
    );
    persist({
      ...currentPlan,
      meals: { ...currentPlan.meals, [mealKey]: recipeId },
    });
    notify(repeated ? "Plato repetido en la semana" : "Plato actualizado");
  };

  const handleSwap = (from: MealKey, to: MealKey) => {
    if (!currentPlan) return;
    const meals = { ...currentPlan.meals };
    const fromRecipe = meals[from];
    meals[from] = meals[to];
    meals[to] = fromRecipe;
    persist({ ...currentPlan, meals });
    notify("Platos intercambiados");
  };

  const handleActivePlanningChange = useCallback(
    async (value: string) => {
      const generation = ++viewGenerationRef.current;
      setModalMeal(null);

      if (value === "own") {
        setActiveShare(null);
        setSharedPlans([]);
        setViewLoading(false);
        const ownCurrent = plans.find((plan) => plan.weekStart === weekStart);
        setSelectedSeason(ownCurrent?.seasonMode ?? "auto");
        return;
      }

      const share = shares.find(
        (item) => item.viewerId === user?.id && item.ownerId === value,
      );
      if (!share) return;

      setActiveShare(share);
      setSharedPlans([]);
      setViewLoading(true);

      const result = await loadPlansForOwner(share.ownerId);
      if (generation !== viewGenerationRef.current) return;

      if (result.error && result.plans.length === 0) {
        setActiveShare(null);
        setSharedPlans([]);
        setViewLoading(false);
        const ownCurrent = plans.find((plan) => plan.weekStart === weekStart);
        setSelectedSeason(ownCurrent?.seasonMode ?? "auto");
        notify(result.error);
        return;
      }

      setSharedPlans(result.plans);
      const target = result.plans.find((plan) => plan.weekStart === weekStart);
      setSelectedSeason(target?.seasonMode ?? "auto");
      setViewLoading(false);
      if (result.error) notify(result.error);
    },
    [shares, plans, weekStart, user, notify],
  );

  const handleSharesChanged = useCallback(
    async (message: string) => {
      notify(message);
      const result = await loadPlanShares();
      if (result.error) {
        setShareError(result.error);
        return;
      }

      setShareError(undefined);
      setShares(result.shares);

      const stillShared = activeShare
        ? result.shares.some(
            (share) =>
              share.viewerId === user?.id &&
              share.ownerId === activeShare.ownerId,
          )
        : true;

      if (!stillShared) {
        viewGenerationRef.current += 1;
        setActiveShare(null);
        setSharedPlans([]);
        setViewLoading(false);
        const ownCurrent = plans.find((plan) => plan.weekStart === weekStart);
        setSelectedSeason(ownCurrent?.seasonMode ?? "auto");
      }
    },
    [notify, activeShare, user, plans, weekStart],
  );

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch {
      notify("No se pudo cerrar la sesión en Supabase.");
    }

    initGenerationRef.current += 1;
    viewGenerationRef.current += 1;
    setUser(null);
    setPlans([]);
    setSharedPlans([]);
    setShares([]);
    setActiveShare(null);
    setRecipeBook(EMPTY_RECIPE_BOOK);
    setManagerOpen(false);
    setShareOpen(false);
    setInfoOpen(false);
    setModalMeal(null);
    setShareError(undefined);
    setSyncError(undefined);
    setAuthReady(true);
    setLoading(false);
    setViewLoading(false);
  };

  const persistBook = useCallback(
    (book: RecipeBook) => {
      const stamped: RecipeBook = {
        ...book,
        updatedAt: new Date().toISOString(),
      };
      setRecipeBook(stamped);

      void saveRecipeBook(stamped).then((result) => {
        if (result.error) {
          setRecipeError(result.error);
          notify("Recetario guardado en este dispositivo. No se pudo sincronizar.");
        } else {
          setRecipeError(undefined);
        }
      });
    },
    [notify],
  );

  const handleSaveRecipe = (recipe: Recipe) => {
    if (RECIPES_BY_ID.has(recipe.id)) {
      persistBook({
        ...recipeBook,
        overrides: { ...recipeBook.overrides, [recipe.id]: recipe },
      });
    } else {
      const exists = recipeBook.custom.some((item) => item.id === recipe.id);
      persistBook({
        ...recipeBook,
        custom: exists
          ? recipeBook.custom.map((item) =>
              item.id === recipe.id ? recipe : item,
            )
          : [...recipeBook.custom, recipe],
      });
    }

    notify("Receta guardada");
  };

  const handleDeleteRecipe = (id: string) => {
    const isBase = RECIPES_BY_ID.has(id);
    const overrides = { ...recipeBook.overrides };
    delete overrides[id];

    persistBook({
      ...recipeBook,
      custom: recipeBook.custom.filter((recipe) => recipe.id !== id),
      overrides,
      hiddenIds: isBase
        ? [...new Set([...recipeBook.hiddenIds, id])]
        : recipeBook.hiddenIds,
    });

    let removed = 0;
    for (const plan of activePlans) {
      const keys = Object.entries(plan.meals)
        .filter(([, recipeId]) => recipeId === id)
        .map(([key]) => key);
      if (keys.length === 0) continue;

      removed += keys.length;
      const meals = { ...plan.meals };
      for (const key of keys) delete meals[key];
      persist({ ...plan, meals });
    }

    notify(
      removed > 0
        ? `Plato eliminado y retirado de ${removed} ${removed === 1 ? "hueco" : "huecos"}`
        : "Plato eliminado del recetario",
    );
  };

  const handleRestoreRecipe = (id: string) => {
    const overrides = { ...recipeBook.overrides };
    delete overrides[id];
    persistBook({ ...recipeBook, overrides });
    notify("Plato original restaurado");
  };

  const handleResetBase = () => {
    persistBook({ ...recipeBook, overrides: {}, hiddenIds: [] });
    notify("Platos base restaurados");
  };

  const scrollToShopping = () => {
    document
      .getElementById("shopping")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!authReady) {
    return <LoadingScreen label="Comprobando tu sesión…" />;
  }

  if (supabaseConfigured && !user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  if (loading || !weekStart) {
    return <LoadingScreen label="Preparando tu semana…" />;
  }

  const season = getSeasonContext(weekStart, selectedSeason);
  const weekNumber = getWeekNumber(weekStart);
  const syncTitle =
    mode === "cloud"
      ? activeShare
        ? `Viendo la planificación compartida de ${activeShare.ownerEmail}.`
        : "Tus semanas se guardan en Supabase y en este dispositivo."
      : syncError ??
        (supabaseConfigured
          ? "No se pudo conectar con Supabase. Usando almacenamiento local."
          : "Configura Supabase para guardar tus semanas en la nube.");
  const sharedOwner = activeShare?.ownerEmail ?? "";

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <button
            className="brand"
            type="button"
            onClick={goToCurrentWeek}
            aria-label="Mesa · ir a la semana actual"
          >
            <span className="brand-mark">
              <Leaf size={17} />
            </span>
            <span className="brand-name">Mesa</span>
            <span className="brand-sep" />
            <span className="brand-sub">Planificador semanal</span>
          </button>

          <div className="topbar-actions">
            {incomingShares.length > 0 && (
              <label className="planning-switcher" title="Cambiar planificación">
                <Users size={14} />
                <select
                  value={activeShare?.ownerId ?? "own"}
                  onChange={(event) =>
                    void handleActivePlanningChange(event.target.value)
                  }
                  aria-label="Planificación que quieres ver"
                >
                  <option value="own">Mi planificación</option>
                  {incomingShares.map((share) => (
                    <option value={share.ownerId} key={share.id}>
                      {share.ownerEmail}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {user && (
              <button
                className="sync-pill"
                type="button"
                onClick={() => setShareOpen(true)}
                title="Compartir mi planificación"
                aria-label="Compartir mi planificación"
              >
                <Share2 size={14} />
                <span>Compartir</span>
              </button>
            )}

            <button
              className={`sync-pill sync-status ${mode} ${syncError ? "has-error" : ""}`}
              type="button"
              onClick={() => setInfoOpen(true)}
              title={syncTitle}
              aria-label={syncTitle}
            >
              {mode === "cloud" ? <Cloud size={14} /> : <HardDrive size={14} />}
              <span>{mode === "cloud" ? "Sincronizado" : "Solo este dispositivo"}</span>
            </button>
            <button
              className="icon-button info-button"
              type="button"
              onClick={() => setInfoOpen(true)}
              aria-label="Cómo funciona"
              title="Cómo funciona"
            >
              <Info size={17} />
            </button>

            {user && (
              <div className="user-chip" title={user.email ?? ""}>
                <UserRound size={14} />
                <span>{user.email}</span>
                <button
                  type="button"
                  className="user-chip-signout"
                  onClick={() => void handleSignOut()}
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {activeShare && (
        <div className="shared-banner" role="status">
          <div className="shared-banner-inner">
            <Users size={15} />
            <span>
              Colaboras en la planificación de <strong>{sharedOwner}</strong>. Los
              cambios se guardan en su cuenta.
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() => void handleActivePlanningChange("own")}
            >
              <UserRound size={13} />
              Volver a la mía
            </button>
          </div>
        </div>
      )}

      <main className="page">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14} />
              Semana {weekNumber} · {formatRelativeWeek(weekStart)}
            </div>
            <h1>
              Comer bien,
              <br />
              <em>sin pensarlo.</em>
            </h1>
            <p className="hero-lead">
              {activeShare
                ? `Edita con ${sharedOwner} su semana: cambia platos, temporada y lista de la compra. Los cambios se guardan en su planificación.`
                : "Una semana de comidas y cenas equilibradas, con temporada, variedad y lista de la compra incluida. Cámbiala cuando te apetezca."}
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={requestGenerate}
              >
                <RefreshCw size={17} />
                {currentPlan ? "Regenerar semana" : "Generar semana"}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={scrollToShopping}
              >
                <ShoppingBasket size={17} />
                Lista de la compra
                {shoppingCount > 0 && (
                  <span className="btn-count">{shoppingCount}</span>
                )}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setManagerOpen(true)}
              >
                <BookOpen size={17} />
                Recetario
              </button>
            </div>
          </div>

          <aside className="hero-panel">
            <div className="hero-panel-top">
              <span className="hero-panel-label">
                <CalendarDays size={13} />
                Semana {weekNumber}
              </span>
              <button
                className="today-link"
                type="button"
                onClick={goToCurrentWeek}
                disabled={isCurrentWeek(weekStart)}
              >
                Hoy
              </button>
            </div>

            <div className="week-nav">
              <button
                className="icon-button"
                type="button"
                onClick={() => goToWeek(-1)}
                aria-label="Semana anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="week-nav-copy">
                <strong>{formatWeekRange(weekStart)}</strong>
                <span>{formatWeekLong(weekStart)}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => goToWeek(1)}
                aria-label="Semana siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="season-block">
              <div className="season-title">
                <span>
                  {season.key === "invierno" ? (
                    <Snowflake size={14} />
                  ) : (
                    <Sun size={14} />
                  )}
                  Temporada
                </span>
                <strong>{season.label}</strong>
              </div>
              <div className="segmented">
                <button
                  type="button"
                  className={selectedSeason === "auto" ? "active" : ""}
                  onClick={() => handleSeasonChange("auto")}
                >
                  Auto
                </button>
                <button
                  type="button"
                  className={selectedSeason === "verano" ? "active" : ""}
                  onClick={() => handleSeasonChange("verano")}
                >
                  <Sun size={13} />
                  Verano
                </button>
                <button
                  type="button"
                  className={selectedSeason === "invierno" ? "active" : ""}
                  onClick={() => handleSeasonChange("invierno")}
                >
                  <Snowflake size={13} />
                  Invierno
                </button>
              </div>
              <p className="season-hint">
                {activeShare
                  ? "La temporada se guarda en esta planificación compartida."
                  : season.hint}
              </p>
            </div>

            <div className="hero-mini-stats">
              <div>
                <strong>{plannedMeals}</strong>
                <span>platos</span>
              </div>
              <div>
                <strong>{uniqueDishes}</strong>
                <span>distintos</span>
              </div>
              <div>
                <strong>{stats?.balanced ? "Sí" : "—"}</strong>
                <span>equilibrada</span>
              </div>
            </div>
          </aside>
        </section>

        <div className="content-grid">
          <section className="planner-panel" aria-label="Planificación semanal">
            <header className="planner-head">
              <div>
                <span className="side-kicker">
                  {activeShare ? "Compartida" : "Planificación"}
                </span>
                <h2>{activeShare ? "Semana compartida" : "Tu semana"}</h2>
                <p>
                  {currentPlan
                    ? `${formatWeekRange(weekStart)} · 7 comidas y 7 cenas`
                    : `${formatWeekRange(weekStart)} · todavía sin planificar`}
                </p>
              </div>
              <div className="planner-legend">
                <span>
                  <Utensils size={13} />
                  Comida
                </span>
                <span>
                  <span className="legend-moon">☾</span>
                  Cena
                </span>
              </div>
            </header>

            {viewLoading ? (
              <div className="planner-loading">
                <Loader2 size={18} className="spin" />
                Cargando planificación compartida…
              </div>
            ) : currentPlan ? (
              <>
                <div className="week-scroll">
                  <div className="week-grid">
                    {DAYS.map((day, index) => {
                      const date = addDaysISO(weekStart, index);
                      const isToday = date === todayISO;
                      const lunchKey = `${day.id}-comida` as MealKey;
                      const dinnerKey = `${day.id}-cena` as MealKey;

                      return (
                        <div
                          className={`day-column ${isToday ? "today" : ""}`}
                          key={day.id}
                        >
                          <div className="day-header">
                            <span className="day-name">{day.label}</span>
                            <span className="day-date">{formatDayNumber(date)}</span>
                          </div>
                          <MealCard
                            mealKey={lunchKey}
                            mealType="comida"
                            recipe={getPlanRecipe(currentPlan, lunchKey, recipes)}
                            repeatCount={
                              recipeCounts.get(currentPlan.meals[lunchKey]) ?? 0
                            }
                            onOpen={() => setModalMeal(lunchKey)}
                            onQuickSwap={() => handleQuickSwap(lunchKey)}
                          />
                          <MealCard
                            mealKey={dinnerKey}
                            mealType="cena"
                            recipe={getPlanRecipe(currentPlan, dinnerKey, recipes)}
                            repeatCount={
                              recipeCounts.get(currentPlan.meals[dinnerKey]) ?? 0
                            }
                            onOpen={() => setModalMeal(dinnerKey)}
                            onQuickSwap={() => handleQuickSwap(dinnerKey)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="scroll-hint">
                  <ChevronLeft size={13} />
                  Desliza para ver la semana
                  <ChevronRight size={13} />
                </p>
                <div className="planner-foot">
                  <span>
                    <Sparkles size={13} />
                    {season.label} · variedad entre semanas
                  </span>
                  <span className={stats?.balanced ? "foot-ok" : "foot-off"}>
                    {stats?.balanced ? "Reparto perfecto" : "Reparto personalizado"}
                  </span>
                </div>
              </>
            ) : (
              <div className="empty-week">
                <span className="empty-plate">
                  <Utensils size={28} />
                </span>
                <h3>Esta semana está en blanco</h3>
                <p>
                  {activeShare
                    ? `${sharedOwner} todavía no ha planificado esta semana. Puedes generarla tú.`
                    : "Genera 14 platos con el reparto equilibrado y la temporada que elijas."}
                </p>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={requestGenerate}
                >
                  <Sparkles size={16} />
                  Generar esta semana
                </button>
              </div>
            )}
          </section>

          <aside className="sidebar" id="shopping">
            <BalanceCard
              plan={currentPlan}
              recipes={recipes}
              onRebalance={requestGenerate}
            />
            <ShoppingList plan={currentPlan} recipes={recipes} onToast={notify} />
            <div className="side-tip">
              <span className="side-tip-icon">
                <Leaf size={17} />
              </span>
              <div>
                <strong>
                  {activeShare ? "Cocina a cuatro manos" : "Cambia el plan, no la calma"}
                </strong>
                <p>
                  {activeShare
                    ? `Puedes cambiar los platos y la temporada; los cambios se guardan en la planificación de ${sharedOwner}. El recetario es común para todas las cuentas.`
                    : "Toca cualquier plato para cambiarlo, repetirlo por sobras o moverlo a otro día. En el recetario puedes editar ingredientes y añadir tus propias recetas."}
                </p>
              </div>
            </div>
          </aside>
        </div>

        <footer className="footer">
          <span>Mesa · planificación semanal</span>
          <span>Hecho para comer mejor, con menos dudas.</span>
        </footer>
      </main>

      <MealModal
        open={Boolean(modalMeal)}
        mealKey={modalMeal}
        plan={currentPlan ?? null}
        plans={activePlans}
        recipes={recipes}
        seasonMode={currentPlan?.seasonMode ?? selectedSeason}
        onClose={closeMealModal}
        onSelect={handleSelect}
        onSwap={handleSwap}
        onSuggest={handleQuickSwap}
      />

      <RecipeManager
        open={managerOpen}
        recipes={recipes}
        book={recipeBook}
        plans={activePlans}
        mode={mode}
        error={recipeError}
        onClose={closeManager}
        onSave={handleSaveRecipe}
        onDelete={handleDeleteRecipe}
        onRestore={handleRestoreRecipe}
        onResetBase={handleResetBase}
      />

      <ShareModal
        open={shareOpen}
        ownerEmail={user?.email ?? undefined}
        shares={outgoingShares}
        error={shareError}
        onClose={closeShare}
        onChanged={handleSharesChanged}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="¿Regenerar la semana?"
        description={
          activeShare
            ? `Se elegirán 14 platos nuevos y se perderán los cambios manuales de esta semana en la planificación de ${sharedOwner}. La lista de la compra también se actualizará.`
            : "Se elegirán 14 platos nuevos y se perderán los cambios manuales de esta semana. La lista de la compra también se actualizará."
        }
        confirmLabel="Regenerar"
        icon={<RefreshCw size={22} />}
        onConfirm={() => {
          setConfirmOpen(false);
          handleGenerate();
        }}
        onClose={closeConfirm}
      />

      <InfoModal
        open={infoOpen}
        mode={mode}
        syncError={syncError}
        onClose={closeInfo}
      />

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast-dot" />
          {toast.message}
        </div>
      )}
    </div>
  );
}
