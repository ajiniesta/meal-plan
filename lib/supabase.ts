import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;
let cloudDisabled = false;
let cloudDisabledReason: string | undefined;

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
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}

export async function getOrCreateUser(client: SupabaseClient): Promise<User> {
  if (cloudDisabled) {
    throw new Error(
      cloudDisabledReason ?? "La nube no está disponible en este dispositivo.",
    );
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  if (session?.user) return session.user;

  const { data, error } = await client.auth.signInAnonymously();

  if (error || !data.user) {
    const rawMessage =
      error?.message ??
      "No se pudo crear la sesión anónima de Supabase. Revisa la configuración.";
    const friendlyMessage = /anonymous.*(disabled|not enabled)/i.test(rawMessage)
      ? "Las sesiones anónimas están desactivadas en Supabase. Actívalas en Authentication → Providers → Anonymous sign-ins."
      : /fetch|network/i.test(rawMessage)
        ? "No se pudo conectar con Supabase. Revisa la conexión y las variables de entorno."
        : rawMessage;

    // Un error 4xx suele indicar un problema de configuración que no se
    // arregla reintentando. Los fallos de red sí se reintentan al guardar.
    if (error?.status && error.status >= 400 && error.status < 500) {
      cloudDisabled = true;
      cloudDisabledReason = friendlyMessage;
    }

    throw new Error(friendlyMessage);
  }

  return data.user;
}
