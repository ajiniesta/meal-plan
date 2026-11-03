"use client";

import { CheckCircle2, Fish, RefreshCw, Sparkles } from "lucide-react";
import { getAllRecipeIds } from "@/lib/meals";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/recipes";
import { TARGETS, getPlanStats } from "@/lib/planner";
import type { Recipe, WeekPlan } from "@/lib/types";

interface BalanceCardProps {
  plan?: WeekPlan;
  recipes: Recipe[];
  onRebalance: () => void;
}

export function BalanceCard({ plan, recipes, onRebalance }: BalanceCardProps) {
  const stats = plan ? getPlanStats(plan, recipes) : null;
  const allRecipeIds = plan ? getAllRecipeIds(plan.meals) : [];
  const unique = new Set(allRecipeIds).size;
  const repeated = allRecipeIds.length - unique;
  const hasExtras = plan
    ? Object.values(plan.meals).some((recipeIds) => recipeIds.length > 1)
    : false;
  const fishOk = stats?.fish.blanco === 1 && stats?.fish.azul === 1;

  return (
    <section className="side-card balance-card">
      <header className="side-head">
        <div>
          <span className="side-kicker">Reparto</span>
          <h2>Equilibrio semanal</h2>
        </div>
        <span className="count-pill">{stats?.total ?? 0}/14</span>
      </header>

      <p className="side-sub">
        {stats?.balanced
          ? "La semana cumple el reparto que buscabas."
          : "La proporción ideal para 7 comidas y 7 cenas."}
      </p>

      {hasExtras && (
        <p className="balance-extra-note">
          El primer plato de cada hueco marca el equilibrio; los segundos platos se
          suman a la lista de la compra.
        </p>
      )}

      <div className="balance-list">
        {CATEGORY_ORDER.map((category) => {
          const meta = CATEGORIES[category];
          const count = stats?.byCategory[category] ?? 0;
          const target = TARGETS[category];
          const ok = count === target;
          const over = count > target;

          return (
            <div className={`balance-row ${ok ? "ok" : ""} ${over ? "over" : ""}`} key={category}>
              <div className="balance-row-top">
                <span className="balance-label">
                  <span className="balance-dot" style={{ background: meta.color }} />
                  {meta.label}
                </span>
                <span className="balance-count">
                  {count}
                  <span>/{target}</span>
                </span>
              </div>
              <div className="balance-track">
                <span
                  style={{
                    width: `${Math.min(100, (count / target) * 100)}%`,
                    background: meta.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {plan && (
        <div className={`fish-note ${fishOk ? "ok" : ""}`}>
          <span className="fish-icon">
            <Fish size={16} />
          </span>
          <span className="fish-copy">
            <strong>Pescado blanco y azul</strong>
            <span>
              {stats?.fish.blanco ?? 0} blanco · {stats?.fish.azul ?? 0} azul
              {stats?.fish.marisco ? ` · ${stats.fish.marisco} marisco` : ""}
            </span>
          </span>
          {fishOk && <CheckCircle2 size={16} className="fish-check" />}
        </div>
      )}

      <div className="balance-footer">
        <div className="variety-note">
          <Sparkles size={14} />
          <span>
            {unique === 0
              ? "Aún no hay platos"
              : repeated === 0
                ? `${unique} platos distintos`
                : `${unique} platos · ${repeated} repetido${repeated === 1 ? "" : "s"}`}
          </span>
        </div>
        {plan && (
          <button type="button" className="text-button" onClick={onRebalance}>
            <RefreshCw size={13} />
            Reequilibrar
          </button>
        )}
      </div>
    </section>
  );
}
