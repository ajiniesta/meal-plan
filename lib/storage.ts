import {
  EMPTY_RECIPE_BOOK,
  normalizeRecipeBook,
  type RecipeBook,
} from "./recipe-book";
import type { SeasonMode, WeekPlan } from "./types";
import { getOrCreateUser, getSupabaseClient } from "./supabase";

const LOCAL_KEY = "mesa.week-plans.v1";
const TABLE = "weekly_plans";
const RECIPE_LOCAL_KEY = "mesa.recipe-book.v1";
const RECIPE_TABLE = "recipe_books";

export type StorageMode = "local" | "cloud";

export interface LoadPlansResult {
  plans: WeekPlan[];
  mode: StorageMode;
  error?: string;
}

export interface SavePlanResult {
  mode: StorageMode;
  error?: string;
}

export interface LoadRecipeBookResult {
  book: RecipeBook;
  mode: StorageMode;
  error?: string;
}

export interface SaveRecipeBookResult {
  mode: StorageMode;
  error?: string;
}

interface RemotePlanRow {
  week_start: string;
  season_mode: string;
  meals: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

function isSeasonMode(value: string): value is SeasonMode {
  return value === "auto" || value === "verano" || value === "invierno";
}

function friendlyStorageError(message: string): string {
  if (
    /recipe_books/i.test(message) &&
    (/does not exist/i.test(message) ||
      /could not find the table/i.test(message) ||
      /schema cache/i.test(message))
  ) {
    return "Falta la tabla recipe_books. Ejecuta supabase/schema.sql en el SQL Editor de Supabase.";
  }

  if (
    /relation .*weekly_plans.*does not exist/i.test(message) ||
    /could not find the table/i.test(message) ||
    /schema cache/i.test(message)
  ) {
    return "Falta la tabla weekly_plans. Ejecuta supabase/schema.sql en el SQL Editor de Supabase.";
  }

  if (/row-level security|permission denied/i.test(message)) {
    return "Las políticas RLS no permiten acceder a la tabla. Revisa supabase/schema.sql.";
  }

  if (/tardó demasiado|timeout|timed out/i.test(message)) {
    return "Supabase tardó demasiado en responder. Se usará el modo local.";
  }

  return message;
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error("Supabase tardó demasiado en responder."));
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function readLocalPlans(): WeekPlan[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is WeekPlan => {
        return (
          item &&
          typeof item.weekStart === "string" &&
          typeof item.meals === "object" &&
          item.meals !== null
        );
      })
      .map((item) => {
        const now = new Date().toISOString();
        return {
          ...item,
          seasonMode: isSeasonMode(item.seasonMode) ? item.seasonMode : "auto",
          createdAt:
            typeof item.createdAt === "string" ? item.createdAt : now,
          updatedAt:
            typeof item.updatedAt === "string" ? item.updatedAt : now,
        };
      });
  } catch {
    return [];
  }
}

function writeLocalPlans(plans: WeekPlan[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(plans));
  } catch {
    // El modo local puede fallar si el navegador bloquea el almacenamiento.
  }
}

function upsertLocal(plan: WeekPlan): void {
  const plans = readLocalPlans();
  const next = plans.filter((item) => item.weekStart !== plan.weekStart);
  next.push(plan);
  next.sort((left, right) => left.weekStart.localeCompare(right.weekStart));
  writeLocalPlans(next);
}

function rowToPlan(row: RemotePlanRow): WeekPlan {
  return {
    weekStart: row.week_start,
    seasonMode: isSeasonMode(row.season_mode) ? row.season_mode : "auto",
    meals: row.meals ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function planToRow(plan: WeekPlan, userId: string) {
  return {
    user_id: userId,
    week_start: plan.weekStart,
    season_mode: plan.seasonMode,
    meals: plan.meals,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  };
}

export async function loadPlans(): Promise<LoadPlansResult> {
  const local = readLocalPlans();
  const client = getSupabaseClient();

  if (!client) {
    return { plans: local, mode: "local" };
  }

  try {
    const user = await withTimeout(getOrCreateUser(client));
    const { data, error } = await withTimeout(
      client
        .from(TABLE)
        .select("week_start, season_mode, meals, created_at, updated_at")
        .eq("user_id", user.id)
        .order("week_start", { ascending: true }),
    );

    if (error) throw new Error(error.message);

    const remote = ((data ?? []) as RemotePlanRow[]).map(rowToPlan);
    const localByWeek = new Map(local.map((plan) => [plan.weekStart, plan]));
    const remoteByWeek = new Map(remote.map((plan) => [plan.weekStart, plan]));
    const merged = new Map(remoteByWeek);

    for (const localPlan of local) {
      const remotePlan = remoteByWeek.get(localPlan.weekStart);
      if (!remotePlan || localPlan.updatedAt > remotePlan.updatedAt) {
        merged.set(localPlan.weekStart, localPlan);
      }
    }

    const toUpload = [...merged.values()].filter((plan) => {
      const remotePlan = remoteByWeek.get(plan.weekStart);
      const localPlan = localByWeek.get(plan.weekStart);
      return (
        !remotePlan ||
        (localPlan && localPlan.updatedAt > remotePlan.updatedAt)
      );
    });

    if (toUpload.length > 0) {
      const { error: upsertError } = await withTimeout(
        client.from(TABLE).upsert(
          toUpload.map((plan) => planToRow(plan, user.id)),
          {
            onConflict: "user_id,week_start",
          },
        ),
      );
      if (upsertError) throw new Error(upsertError.message);
    }

    const plans = [...merged.values()].sort((left, right) =>
      left.weekStart.localeCompare(right.weekStart),
    );
    writeLocalPlans(plans);

    return { plans, mode: "cloud" };
  } catch (error) {
    return {
      plans: local,
      mode: "local",
      error:
        error instanceof Error
          ? friendlyStorageError(error.message)
          : "No se pudo conectar con Supabase.",
    };
  }
}

export async function savePlan(plan: WeekPlan): Promise<SavePlanResult> {
  upsertLocal(plan);

  const client = getSupabaseClient();
  if (!client) return { mode: "local" };

  try {
    const user = await withTimeout(getOrCreateUser(client));
    const { error } = await withTimeout(
      client.from(TABLE).upsert(planToRow(plan, user.id), {
        onConflict: "user_id,week_start",
      }),
    );

    if (error) throw new Error(error.message);
    return { mode: "cloud" };
  } catch (error) {
    return {
      mode: "local",
      error:
        error instanceof Error
          ? friendlyStorageError(error.message)
          : "No se pudo guardar en Supabase.",
    };
  }
}

export async function deletePlan(weekStart: string): Promise<SavePlanResult> {
  const plans = readLocalPlans().filter((plan) => plan.weekStart !== weekStart);
  writeLocalPlans(plans);

  const client = getSupabaseClient();
  if (!client) return { mode: "local" };

  try {
    const user = await withTimeout(getOrCreateUser(client));
    const { error } = await withTimeout(
      client
        .from(TABLE)
        .delete()
        .eq("user_id", user.id)
        .eq("week_start", weekStart),
    );
    if (error) throw new Error(error.message);
    return { mode: "cloud" };
  } catch (error) {
    return {
      mode: "local",
      error:
        error instanceof Error
          ? friendlyStorageError(error.message)
          : "No se pudo borrar en Supabase.",
    };
  }
}

export function getLocalPlans(): WeekPlan[] {
  return readLocalPlans();
}

function readLocalRecipeBook(): RecipeBook {
  if (typeof window === "undefined") return EMPTY_RECIPE_BOOK;

  try {
    const raw = window.localStorage.getItem(RECIPE_LOCAL_KEY);
    if (!raw) return EMPTY_RECIPE_BOOK;
    return normalizeRecipeBook(JSON.parse(raw));
  } catch {
    return EMPTY_RECIPE_BOOK;
  }
}

function writeLocalRecipeBook(book: RecipeBook): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RECIPE_LOCAL_KEY, JSON.stringify(book));
  } catch {
    // El modo local puede fallar si el navegador bloquea el almacenamiento.
  }
}

function isNewer(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return left > right;
  return leftTime > rightTime;
}

function bookToRow(book: RecipeBook, userId: string) {
  return {
    user_id: userId,
    data: {
      custom: book.custom,
      overrides: book.overrides,
      hiddenIds: book.hiddenIds,
    },
    updated_at: book.updatedAt,
  };
}

export async function loadRecipeBook(): Promise<LoadRecipeBookResult> {
  const local = readLocalRecipeBook();
  const client = getSupabaseClient();

  if (!client) {
    return { book: local, mode: "local" };
  }

  try {
    const user = await withTimeout(getOrCreateUser(client));
    const { data, error } = await withTimeout(
      client
        .from(RECIPE_TABLE)
        .select("data, updated_at")
        .eq("user_id", user.id)
        .maybeSingle(),
    );

    if (error) throw new Error(error.message);

    const row = data as { data: unknown; updated_at: string } | null;
    const remote = row
      ? normalizeRecipeBook({
          ...(row.data && typeof row.data === "object" ? row.data : {}),
          updatedAt: row.updated_at,
        })
      : null;

    let book = local;
    if (remote && isNewer(remote.updatedAt, local.updatedAt)) book = remote;

    if (isNewer(book.updatedAt, remote?.updatedAt ?? EMPTY_RECIPE_BOOK.updatedAt)) {
      const { error: upsertError } = await withTimeout(
        client
          .from(RECIPE_TABLE)
          .upsert(bookToRow(book, user.id), { onConflict: "user_id" }),
      );
      if (upsertError) throw new Error(upsertError.message);
    }

    writeLocalRecipeBook(book);
    return { book, mode: "cloud" };
  } catch (error) {
    return {
      book: local,
      mode: "local",
      error:
        error instanceof Error
          ? friendlyStorageError(error.message)
          : "No se pudo cargar el recetario desde Supabase.",
    };
  }
}

export async function saveRecipeBook(book: RecipeBook): Promise<SaveRecipeBookResult> {
  writeLocalRecipeBook(book);

  const client = getSupabaseClient();
  if (!client) return { mode: "local" };

  try {
    const user = await withTimeout(getOrCreateUser(client));
    const { error } = await withTimeout(
      client
        .from(RECIPE_TABLE)
        .upsert(bookToRow(book, user.id), { onConflict: "user_id" }),
    );

    if (error) throw new Error(error.message);
    return { mode: "cloud" };
  } catch (error) {
    return {
      mode: "local",
      error:
        error instanceof Error
          ? friendlyStorageError(error.message)
          : "No se pudo guardar el recetario en Supabase.",
    };
  }
}
