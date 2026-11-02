"use client";

import {
  BookOpen,
  Cloud,
  HardDrive,
  Leaf,
  Share2,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/recipes";
import { TARGETS } from "@/lib/planner";
import type { StorageMode } from "@/lib/storage";

interface InfoModalProps {
  open: boolean;
  mode: StorageMode;
  syncError?: string;
  onClose: () => void;
}

export function InfoModal({ open, mode, syncError, onClose }: InfoModalProps) {
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

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal info-modal" role="dialog" aria-modal="true" aria-label="Cómo funciona Mesa">
        <header className="modal-head">
          <div className="modal-head-main">
            <div className="modal-emoji info-emoji" aria-hidden="true">
              <Leaf size={24} />
            </div>
            <div className="modal-head-copy">
              <span className="modal-eyebrow">Cómo funciona</span>
              <h2>Una semana resuelta</h2>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body info-body">
          <section className="info-section">
            <div className="info-section-title">
              <Utensils size={17} />
              <h3>El reparto de la semana</h3>
            </div>
            <p>
              Cada semana tiene 7 comidas y 7 cenas. El generador reparte los platos para
              que la semana quede equilibrada y variada.
            </p>
            <div className="quota-grid">
              {CATEGORY_ORDER.map((category) => {
                const meta = CATEGORIES[category];
                return (
                  <span
                    className="quota-chip"
                    key={category}
                    style={{ background: meta.soft, color: meta.color }}
                  >
                    <span>{meta.emoji}</span>
                    {meta.plural}
                    <strong>{TARGETS[category]}</strong>
                  </span>
                );
              })}
            </div>
            <p className="info-note">
              Las legumbres, la pasta y el arroz van a la comida; las cenas son más ligeras.
              El pescado se reparte en uno blanco y uno azul.
            </p>
          </section>

          <section className="info-section">
            <div className="info-section-title">
              <Sparkles size={17} />
              <h3>Temporada y variedad</h3>
            </div>
            <p>
              Puedes dejar la temporada en automático o forzar verano o invierno. El
              generador prioriza recetas de temporada y evita repetir platos de las últimas
              tres semanas.
            </p>
            <p className="info-note">
              Si cambias un plato, la lista de la compra y el equilibrio se actualizan al
              momento. Usa el botón de mezclar de cada plato para recibir otra propuesta.
            </p>
          </section>

          <section className="info-section">
            <div className="info-section-title">
              <BookOpen size={17} />
              <h3>Tu recetario y las sobras</h3>
            </div>
            <p>
              Abre cualquier plato y entra en la pestaña <strong>Repetir</strong> para
              reutilizar una comida de la semana, por ejemplo para sobras. Los platos
              repetidos comparten ingredientes en la compra.
            </p>
            <p className="info-note">
              En <strong>Recetario</strong> puedes añadir recetas propias, cambiar
              ingredientes, temporada o categoría, y retirar los platos que no uses.
              El recetario es común: los cambios se comparten entre todas las cuentas.
            </p>
          </section>

          <section className="info-section">
            <div className="info-section-title">
              <Share2 size={17} />
              <h3>Compartir la planificación</h3>
            </div>
            <p>
              Con una cuenta, el botón <strong>Compartir</strong> de la cabecera
              permite dar acceso de edición a otra cuenta usando su correo. Podrá
              ver y cambiar los platos y la temporada de todas tus semanas. Puedes
              retirar el acceso cuando quieras.
            </p>
            <p className="info-note">
              Si alguien comparte su planificación contigo, aparecerá un selector en
              la cabecera para cambiar entre tu semana y la suya. Ambos podéis editar
              las mismas semanas; prevalece la última edición guardada.
            </p>
          </section>

          <section className="info-section">
            <div className="info-section-title">
              {mode === "cloud" ? <Cloud size={17} /> : <HardDrive size={17} />}
              <h3>Tus datos</h3>
            </div>
            {mode === "cloud" ? (
              <p>
                Tus semanas se guardan en Supabase asociadas a tu cuenta y también en
                este dispositivo. Así puedes entrar desde otro navegador sin perder
                nada.
              </p>
            ) : (
              <p>
                Ahora mismo la app guarda las semanas y el recetario solo en este
                dispositivo. Si conectas Supabase, podrás crear una cuenta y guardar
                todo en la nube.
              </p>
            )}
            {syncError && (
              <p className="info-warning">
                No se pudo conectar con Supabase: {syncError}
              </p>
            )}
          </section>

          <button className="btn btn-primary info-close" type="button" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
