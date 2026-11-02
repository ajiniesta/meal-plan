import {
  EMPTY_RECIPE_BOOK,
  normalizeRecipeBook,
  type RecipeBook,
} from "./recipe-book";
import type { PlanShare, SeasonMode, WeekPlan } from "./types";
import { getSupabaseClient, requireSessionUser } from "./supabase";

const LOCAL_KEY_PREFIX = "mesa.week-plans.v2";
const LEGACY_LOCAL_KEY = "mesa.week-plans.v1";
const TABLE = "weekly_plans";
const RECIPE_LOCAL_KEY = "mesa.recipe-catalog.v2";
const LEGACY_RECIPE_LOCAL_KEY = "mesa.recipe-book.v1";
const RECIPE_TABLE = "recipe_catalog";
const RECIPE_ROW_ID = "global";
const SHARE_TABLE = "plan_shares";

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

export interface LoadSharesResult {
  shares: PlanShare[];
  mode: StorageMode;
  error?: string;
}

export interface SharePlanResult {
  share?: PlanShare;
  error?: string;
}

interface RemotePlanRow {
  week_start: string;
  season_mode: string;
  meals: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

interface RemoteShareRow {
  id: string;
  owner_id: string;
  viewer_id: string;
  owner_email: string;
  viewer_email: string;
  created_at: string;
}

function isSeasonMode(value: string): value is SeasonMode {
  return value === "auto" || value === "verano" || value === "invierno";
}

function friendlyStorageError(message: string): string {
  if (
    /plan_shares/i.test(message) &&
    (/does not exist/i.test(message) ||
      /could not find the table/i.test(message) ||
      /schema cache/i.test(message))
  ) {
    return "Falta la tabla plan_shares. Ejecuta supabase/schema.sql en el SQL Editor de Supabase.";
  }

  if (
    /recipe_catalog/i.test(message) &&
    (/does not exist/i.test(message) ||
      /could not find the table/i.test(message) ||
      /schema cache/i.test(message))
  ) {
    return "Falta la tabla recipe_catalog. Ejecuta supabase/schema.sql en el SQL Editor de Supabase.";
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

function friendlyShareError(message: string): string {
  if (/USER_NOT_FOUND/i.test(message)) {
    return "No hay ninguna cuenta registrada con ese correo.";
  }

  if (/CANNOT_SHARE_WITH_SELF/i.test(message)) {
    return "No puedes compartir tu planificación contigo mismo.";
  }

  if (/EMAIL_REQUIRED/i.test(message)) {
    return "Escribe el correo de la persona con la que quieres compartir.";
  }

  if (/NOT_AUTHENTICATED|JWT/i.test(message)) {
    return "Inicia sesión para compartir tu planificación.";
  }

  if (/share_plan_with_email/i.test(message)) {
    return "Falta la función de compartir. Ejecuta de nuevo supabase/schema.sql en el SQL Editor de Supabase.";
  }

  return friendlyStorageError(message);
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

function localPlansKey(userId?: string | null): string {
  return `${LOCAL_KEY_PREFIX}.${userId ?? "local"}`;
}

function readLocalPlans(userId?: string | null): WeekPlan[] {
  if (typeof window === "undefined") return [];

  try {
    const raw =
      window.localStorage.getItem(localPlansKey(userId)) ??
      (!userId ? window.localStorage.getItem(LEGACY_LOCAL_KEY) : null);
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

function writeLocalPlans(plans: WeekPlan[], userId?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(localPlansKey(userId), JSON.stringify(plans));
  } catch {
    // El modo local puede fallar si el navegador bloquea el almacenamiento.
  }
}

function upsertLocal(plan: WeekPlan, userId?: string | null): void {
  const plans = readLocalPlans(userId);
  const next = plans.filter((item) => item.weekStart !== plan.weekStart);
  next.push(plan);
  next.sort((left, right) => left.weekStart.localeCompare(right.weekStart));
  writeLocalPlans(next, userId);
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

function rowToShare(row: RemoteShareRow): PlanShare {
  return {
    id: row.id,
    ownerId: row.owner_id,
    viewerId: row.viewer_id,
    ownerEmail: row.owner_email,
    viewerEmail: row.viewer_email,
    createdAt: row.created_at,
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

function mergePlans(local: WeekPlan[], remote: WeekPlan[]): WeekPlan[] {
  const merged = new Map(remote.map((plan) => [plan.weekStart, plan]));

  for (const localPlan of local) {
    const remotePlan = merged.get(localPlan.weekStart);
    if (!remotePlan || localPlan.updatedAt > remotePlan.updatedAt) {
      merged.set(localPlan.weekStart, localPlan);
    }
  }

  return [...merged.values()].sort((left, right) =>
    left.weekStart.localeCompare(right.weekStart),
  );
}

export async function loadPlans(userId?: string): Promise<LoadPlansResult> {
  const local = readLocalPlans(userId);
  const client = getSupabaseClient();

  if (!client) {
    return { plans: local, mode: "local" };
  }

  if (!userId) {
    return {
      plans: local,
      mode: "local",
      error: "Inicia sesión para cargar tus semanas.",
    };
  }

  try {
    const { data, error } = await withTimeout(
      client
        .from(TABLE)
        .select("week_start, season_mode, meals, created_at, updated_at")
        .eq("user_id", userId)
        .order("week_start", { ascending: true }),
    );

    if (error) throw new Error(error.message);

    const remote = ((data ?? []) as RemotePlanRow[]).map(rowToPlan);
    const remoteByWeek = new Map(remote.map((plan) => [plan.weekStart, plan]));
    const localByWeek = new Map(local.map((plan) => [plan.weekStart, plan]));
    const plans = mergePlans(local, remote);

    const toUpload = plans.filter((plan) => {
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
          toUpload.map((plan) => planToRow(plan, userId)),
          {
            onConflict: "user_id,week_start",
          },
        ),
      );
      if (upsertError) throw new Error(upsertError.message);
    }

    writeLocalPlans(plans, userId);

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

/** Lee (y sincroniza) las semanas de otra persona con la que se comparte el plan. */
export async function loadPlansForOwner(ownerId: string): Promise<LoadPlansResult> {
  return loadPlans(ownerId);
}

export async function savePlan(
  plan: WeekPlan,
  userId?: string,
): Promise<SavePlanResult> {
  upsertLocal(plan, userId);

  const client = getSupabaseClient();
  if (!client) return { mode: "local" };

  if (!userId) {
    return { mode: "local", error: "Inicia sesión para guardar la planificación." };
  }

  try {
    const { error } = await withTimeout(
      client.from(TABLE).upsert(planToRow(plan, userId), {
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

export async function deletePlan(
  weekStart: string,
  userId?: string,
): Promise<SavePlanResult> {
  const plans = readLocalPlans(userId).filter(
    (plan) => plan.weekStart !== weekStart,
  );
  writeLocalPlans(plans, userId);

  const client = getSupabaseClient();
  if (!client) return { mode: "local" };

  if (!userId) {
    return { mode: "local", error: "Inicia sesión para borrar tus semanas." };
  }

  try {
    const { error } = await withTimeout(
      client
        .from(TABLE)
        .delete()
        .eq("user_id", userId)
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

export function getLocalPlans(userId?: string): WeekPlan[] {
  return readLocalPlans(userId);
}

function readLocalRecipeBook(): RecipeBook {
  if (typeof window === "undefined") return EMPTY_RECIPE_BOOK;

  try {
    const raw =
      window.localStorage.getItem(RECIPE_LOCAL_KEY) ??
      window.localStorage.getItem(LEGACY_RECIPE_LOCAL_KEY);
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

function bookToRow(book: RecipeBook) {
  return {
    id: RECIPE_ROW_ID,
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
    await withTimeout(requireSessionUser(client));
    const { data, error } = await withTimeout(
      client
        .from(RECIPE_TABLE)
        .select("data, updated_at")
        .eq("id", RECIPE_ROW_ID)
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

    const useLocal = !remote || isNewer(local.updatedAt, remote.updatedAt);
    const book = !remote || isNewer(local.updatedAt, remote.updatedAt)
      ? local
      : remote;

    if (useLocal) {
      const { error: upsertError } = await withTimeout(
        client
          .from(RECIPE_TABLE)
          .upsert(bookToRow(book), { onConflict: "id" }),
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
    await withTimeout(requireSessionUser(client));
    const { error } = await withTimeout(
      client
        .from(RECIPE_TABLE)
        .upsert(bookToRow(book), { onConflict: "id" }),
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

export async function loadPlanShares(): Promise<LoadSharesResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { shares: [], mode: "local" };
  }

  try {
    await withTimeout(requireSessionUser(client));
    const { data, error } = await withTimeout(
      client
        .from(SHARE_TABLE)
        .select(
          "id, owner_id, viewer_id, owner_email, viewer_email, created_at",
        )
        .order("created_at", { ascending: true }),
    );

    if (error) throw new Error(error.message);

    return {
      shares: ((data ?? []) as RemoteShareRow[]).map(rowToShare),
      mode: "cloud",
    };
  } catch (error) {
    return {
      shares: [],
      mode: "local",
      error:
        error instanceof Error
          ? friendlyShareError(error.message)
          : "No se pudieron cargar las planificaciones compartidas.",
    };
  }
}

export async function sharePlanWithEmail(email: string): Promise<SharePlanResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: "Supabase no está configurado en este dispositivo." };
  }

  try {
    await withTimeout(requireSessionUser(client));
    const { data, error } = await withTimeout(
      client.rpc("share_plan_with_email", { target_email: email.trim() }),
    );

    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { error: "No se pudo compartir la planificación." };
    }

    return { share: rowToShare(row as RemoteShareRow) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? friendlyShareError(error.message)
          : "No se pudo compartir la planificación.",
    };
  }
}

export async function revokePlanShare(shareId: string): Promise<SavePlanResult> {
  const client = getSupabaseClient();
  if (!client) return { mode: "local" };

  try {
    await withTimeout(requireSessionUser(client));
    const { error } = await withTimeout(
      client.from(SHARE_TABLE).delete().eq("id", shareId),
    );

    if (error) throw new Error(error.message);
    return { mode: "cloud" };
  } catch (error) {
    return {
      mode: "local",
      error:
        error instanceof Error
          ? friendlyShareError(error.message)
          : "No se pudo retirar la planificación compartida.",
    };
  }
}
