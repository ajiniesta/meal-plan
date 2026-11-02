"use client";

import {
  CheckCircle2,
  Loader2,
  Mail,
  Share2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  revokePlanShare,
  sharePlanWithEmail,
} from "@/lib/storage";
import type { PlanShare } from "@/lib/types";

interface ShareModalProps {
  open: boolean;
  ownerEmail?: string;
  shares: PlanShare[];
  error?: string;
  onClose: () => void;
  onChanged: (message: string) => Promise<void> | void;
}

function formatShareDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function ShareModal({
  open,
  ownerEmail,
  shares,
  error,
  onClose,
  onChanged,
}: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setSubmitting(false);
    setRevokingId(null);
    setConfirmId(null);
    setLocalError(undefined);
    setSuccess(undefined);
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

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(undefined);
    setSuccess(undefined);

    const target = email.trim().toLowerCase();
    if (!target) {
      setLocalError("Escribe el correo de la persona con la que quieres compartir.");
      return;
    }

    setSubmitting(true);
    const result = await sharePlanWithEmail(target);
    setSubmitting(false);

    if (result.error || !result.share) {
      setLocalError(result.error ?? "No se pudo compartir la planificación.");
      return;
    }

    setEmail("");
    setSuccess(
      `Ahora ${result.share.viewerEmail} puede ver tus semanas en modo lectura.`,
    );
    await onChanged(`Planificación compartida con ${result.share.viewerEmail}`);
  };

  const handleRevoke = async (share: PlanShare) => {
    setLocalError(undefined);
    setSuccess(undefined);
    setRevokingId(share.id);
    const result = await revokePlanShare(share.id);
    setRevokingId(null);
    setConfirmId(null);

    if (result.error) {
      setLocalError(result.error);
      return;
    }

    setSuccess(`Ya no compartes tu planificación con ${share.viewerEmail}.`);
    await onChanged(
      `Has retirado el acceso a ${share.viewerEmail}`,
    );
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
        className="modal share-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Compartir planificación"
      >
        <header className="modal-head">
          <div className="modal-head-main">
            <div className="modal-emoji info-emoji" aria-hidden="true">
              <Share2 size={23} />
            </div>
            <div className="modal-head-copy">
              <span className="modal-eyebrow">Solo lectura</span>
              <h2>Compartir planificación</h2>
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

        <div className="modal-body share-body">
          <p className="share-intro">
            Las personas que añadas podrán ver todas tus semanas, pero no podrán
            cambiar platos ni temporadas. El recetario ya es común para todas las
            cuentas.
          </p>

          {ownerEmail && (
            <div className="share-account">
              <UserRound size={15} />
              <span>
                Tu cuenta: <strong>{ownerEmail}</strong>
              </span>
            </div>
          )}

          <form className="share-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Correo de la persona</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="persona@correo.com"
                autoComplete="off"
              />
            </label>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Mail size={16} />
              )}
              Compartir
            </button>
          </form>

          {(localError || error) && (
            <p className="info-warning" role="alert">
              {localError ?? error}
            </p>
          )}

          {success && (
            <p className="share-success">
              <CheckCircle2 size={15} />
              {success}
            </p>
          )}

          <div className="share-list-head">
            <h3>Personas con acceso</h3>
            <span>{shares.length}</span>
          </div>

          {shares.length === 0 ? (
            <div className="share-empty">
              <Share2 size={20} />
              <p>Todavía no has compartido tu planificación con nadie.</p>
            </div>
          ) : (
            <ul className="share-list">
              {shares.map((share) => (
                <li key={share.id}>
                  <span className="share-person">
                    <span className="share-avatar" aria-hidden="true">
                      {share.viewerEmail.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{share.viewerEmail}</strong>
                      <em>Desde {formatShareDate(share.createdAt)}</em>
                    </span>
                  </span>

                  {confirmId === share.id ? (
                    <span className="share-confirm">
                      <span>¿Retirar acceso?</span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setConfirmId(null)}
                        disabled={revokingId === share.id}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleRevoke(share)}
                        disabled={revokingId === share.id}
                      >
                        {revokingId === share.id ? (
                          <Loader2 size={14} className="spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        Retirar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-button danger"
                      onClick={() => setConfirmId(share.id)}
                    >
                      <Trash2 size={13} />
                      Retirar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
