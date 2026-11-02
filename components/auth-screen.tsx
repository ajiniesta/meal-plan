"use client";

import type { User } from "@supabase/supabase-js";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Leaf,
  Loader2,
  Lock,
  Mail,
  Share2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  describeAuthError,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/supabase";

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

type AuthMode = "signin" | "signup";

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
    null,
  );

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(undefined);
    setConfirmationEmail(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    if (!email.trim() || !password) {
      setError("Introduce tu correo y tu contraseña.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        const user = await signInWithEmail(email, password);
        onAuthenticated(user);
      } else {
        const result = await signUpWithEmail(email, password);
        if (result.user && !result.needsConfirmation) {
          onAuthenticated(result.user);
        } else {
          setConfirmationEmail(email.trim().toLowerCase());
        }
      }
    } catch (submitError) {
      setError(describeAuthError(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">
            <Leaf size={19} />
          </span>
          <span className="auth-brand-name">Mesa</span>
        </div>

        <span className="auth-eyebrow">Planificador semanal</span>
        <h1>
          {mode === "signin" ? (
            <>
              Vuelve a tu <em>semana</em>.
            </>
          ) : (
            <>
              Empieza a comer <em>mejor</em>.
            </>
          )}
        </h1>
        <p className="auth-lead">
          Guarda tus planificaciones en la nube, compártelas con quien quieras y
          cocina con un recetario común para todas las cuentas.
        </p>

        {confirmationEmail ? (
          <div className="auth-confirmation">
            <CheckCircle2 size={22} />
            <div>
              <strong>Revisa tu correo</strong>
              <p>
                Hemos enviado un enlace de confirmación a{" "}
                <span>{confirmationEmail}</span>. Ábrelo para activar la cuenta
                y entrar en Mesa.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => switchMode("signin")}
            >
              Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <>
            <div className="auth-tabs" role="tablist" aria-label="Acceso">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={mode === "signin" ? "active" : ""}
                onClick={() => switchMode("signin")}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? "active" : ""}
                onClick={() => switchMode("signup")}
              >
                Crear cuenta
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Correo electrónico</span>
                <span className="auth-input">
                  <Mail size={15} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </span>
              </label>

              <label className="field">
                <span>Contraseña</span>
                <span className="auth-input">
                  <Lock size={15} />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={
                      mode === "signup"
                        ? "Al menos 6 caracteres"
                        : "Tu contraseña"
                    }
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    minLength={6}
                    required
                  />
                </span>
              </label>

              {error && (
                <p className="info-warning auth-error" role="alert">
                  {error}
                </p>
              )}

              <button
                className="btn btn-primary auth-submit"
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                {mode === "signin" ? "Entrar en Mesa" : "Crear mi cuenta"}
              </button>
            </form>
          </>
        )}
      </section>

      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-quote">
          <span className="auth-quote-mark">“</span>
          <p>
            La semana entera, resuelta. Tú decides qué se comparte y con quién.
          </p>
        </div>

        <ul className="auth-benefits">
          <li>
            <span>
              <CheckCircle2 size={16} />
            </span>
            <div>
              <strong>Tu planificación, en la nube</strong>
              <p>Entra desde cualquier dispositivo con tu cuenta.</p>
            </div>
          </li>
          <li>
            <span>
              <Share2 size={16} />
            </span>
            <div>
              <strong>Comparte y edita juntos</strong>
              <p>Otra persona puede ver y cambiar tus semanas contigo.</p>
            </div>
          </li>
          <li>
            <span>
              <BookOpen size={16} />
            </span>
            <div>
              <strong>Un recetario común</strong>
              <p>Las recetas y sus mejoras se comparten entre todas las cuentas.</p>
            </div>
          </li>
        </ul>
      </aside>
    </div>
  );
}
