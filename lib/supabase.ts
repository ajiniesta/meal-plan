import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;

function getSupabaseConfig(): { url?: string; key?: string } {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const { url, key } = getSupabaseConfig();

  if (!url || !key) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cachedClient;
}

export async function getSessionUser(client: SupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;

  const user = data.session?.user ?? null;

  // Las sesiones anónimas de versiones anteriores no tienen correo ni pueden
  // compartir. Se cierran para que la persona cree una cuenta real.
  if (user?.is_anonymous) {
    void client.auth.signOut({ scope: "local" }).catch(() => {
      // Si falla la red, la pantalla de acceso igualmente impide usarla.
    });
    return null;
  }

  return user;
}

export async function requireSessionUser(client: SupabaseClient): Promise<User> {
  const user = await getSessionUser(client);
  if (!user) {
    throw new Error("Inicia sesión para acceder a tus datos.");
  }
  return user;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase no está configurado en este dispositivo.");
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error("No se pudo iniciar sesión.");
  return data.user;
}

export interface SignUpResult {
  user: User | null;
  needsConfirmation: boolean;
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<SignUpResult> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase no está configurado en este dispositivo.");
  }

  const { data, error } = await client.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      emailRedirectTo:
        typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });

  if (error) throw error;

  return {
    user: data.user,
    needsConfirmation: Boolean(data.user && !data.session),
  };
}

export async function signOutUser(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export function describeAuthError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "No se pudo completar la operación.";

  if (/invalid login credentials/i.test(message)) {
    return "Correo o contraseña incorrectos.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.";
  }

  if (/user already registered|already been registered/i.test(message)) {
    return "Ya existe una cuenta con ese correo. Prueba a iniciar sesión.";
  }

  if (/password should be at least|password.*characters/i.test(message)) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  if (/unable to validate email|invalid email/i.test(message)) {
    return "Introduce un correo electrónico válido.";
  }

  if (/rate limit|too many requests|email rate/i.test(message)) {
    return "Demasiados intentos seguidos. Espera un momento e inténtalo de nuevo.";
  }

  if (/fetch|network|failed to fetch/i.test(message)) {
    return "No se pudo conectar con Supabase. Revisa la conexión y las variables de entorno.";
  }

  return message;
}
