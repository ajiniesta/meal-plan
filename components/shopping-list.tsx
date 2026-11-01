"use client";

import { Check, Copy, ShoppingBasket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildShoppingList, buildShoppingListText } from "@/lib/planner";
import type { WeekPlan } from "@/lib/types";

interface ShoppingListProps {
  plan?: WeekPlan;
  onToast: (message: string) => void;
}

export function ShoppingList({ plan, onToast }: ShoppingListProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const groups = useMemo(() => (plan ? buildShoppingList(plan) : []), [plan]);
  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.length, 0),
    [groups],
  );

  useEffect(() => {
    setChecked(new Set());
  }, [plan?.weekStart]);

  const toggle = (key: string) => {
    setChecked((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCopy = async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(buildShoppingListText(plan));
      onToast("Lista copiada al portapapeles");
    } catch {
      onToast("No se pudo copiar la lista");
    }
  };

  return (
    <section className="side-card shopping-card">
      <header className="side-head">
        <div>
          <span className="side-kicker">Para el mercado</span>
          <h2>Lista de la compra</h2>
        </div>
        {plan && (
          <button
            type="button"
            className="icon-button small"
            onClick={handleCopy}
            aria-label="Copiar lista de la compra"
            title="Copiar lista"
          >
            <Copy size={15} />
          </button>
        )}
      </header>

      {!plan || total === 0 ? (
        <div className="side-empty">
          <ShoppingBasket size={22} />
          <p>Genera una semana para preparar la lista.</p>
        </div>
      ) : (
        <>
          <div className="shopping-summary">
            <span>{total} ingredientes</span>
            <span>{checked.size} marcados</span>
          </div>
          <div className="shopping-groups">
            {groups.map((group) => (
              <div className="shopping-group" key={group.section}>
                <h3>
                  {group.label}
                  <span>{group.items.length}</span>
                </h3>
                {group.items.map((item) => {
                  const key = `${group.section}:${item.name.toLocaleLowerCase("es")}`;
                  const isChecked = checked.has(key);
                  return (
                    <label className={`shopping-item ${isChecked ? "checked" : ""}`} key={key}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(key)}
                      />
                      <span className="shopping-box" aria-hidden="true">
                        <Check size={11} />
                      </span>
                      <span className="shopping-name">{item.name}</span>
                      {item.count > 1 && (
                        <span
                          className="shopping-count"
                          title={`Aparece en ${item.count} platos`}
                        >
                          ×{item.count}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          {total > 12 && (
            <p className="shopping-scroll-note">
              Desliza dentro de la lista para ver el resto.
            </p>
          )}
          <p className="shopping-footnote">
            Las cantidades se ajustan al hacer la compra. × indica en cuántos platos se usa.
          </p>
        </>
      )}
    </section>
  );
}
