import type { DayId, SeasonMode } from "./types";

export const DAYS: { id: DayId; label: string; short: string }[] = [
  { id: "lunes", label: "Lunes", short: "Lun" },
  { id: "martes", label: "Martes", short: "Mar" },
  { id: "miercoles", label: "Miércoles", short: "Mié" },
  { id: "jueves", label: "Jueves", short: "Jue" },
  { id: "viernes", label: "Viernes", short: "Vie" },
  { id: "sabado", label: "Sábado", short: "Sáb" },
  { id: "domingo", label: "Domingo", short: "Dom" },
];

const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysISO(value: string, days: number): string {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function getMondayISO(date = new Date()): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return toISODate(copy);
}

export function getDayDate(weekStart: string, dayIndex: number): Date {
  return parseISODate(addDaysISO(weekStart, dayIndex));
}

export function formatDayNumber(value: string): string {
  return String(parseISODate(value).getDate());
}

export function formatMonthShort(value: string): string {
  return MONTHS_SHORT[parseISODate(value).getMonth()];
}

export function formatWeekRange(weekStart: string): string {
  const start = parseISODate(weekStart);
  const end = parseISODate(addDaysISO(weekStart, 6));
  const startText = `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}`;
  const endText = `${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;

  if (start.getFullYear() !== end.getFullYear()) {
    return `${startText} ${start.getFullYear()} – ${endText} ${end.getFullYear()}`;
  }

  return `${startText} – ${endText}`;
}

export function formatWeekLong(weekStart: string): string {
  const start = parseISODate(weekStart);
  const end = parseISODate(addDaysISO(weekStart, 6));
  const startText = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
  }).format(start);
  const endText = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
  }).format(end);
  return `Del ${startText} al ${endText}`;
}

export function formatMonthYear(weekStart: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(parseISODate(weekStart));
}

export function getWeekNumber(weekStart: string): number {
  const date = parseISODate(weekStart);
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function isCurrentWeek(weekStart: string): boolean {
  return weekStart === getMondayISO(new Date());
}

export type ResolvedSeason = "verano" | "invierno" | "templado";

export interface SeasonContext {
  key: ResolvedSeason;
  label: string;
  climate: ResolvedSeason;
  mode: SeasonMode;
  hint: string;
}

export function getSeasonContext(
  weekStart: string,
  mode: SeasonMode,
): SeasonContext {
  const month = parseISODate(weekStart).getMonth();

  if (mode === "verano") {
    return {
      key: "verano",
      label: "Verano",
      climate: "verano",
      mode,
      hint: "Platos frescos y ligeros, pensados para el calor.",
    };
  }

  if (mode === "invierno") {
    return {
      key: "invierno",
      label: "Invierno",
      climate: "invierno",
      mode,
      hint: "Guisos, cuchara y platos que entran bien con frío.",
    };
  }

  if (month >= 5 && month <= 8) {
    return {
      key: "verano",
      label: "Verano",
      climate: "verano",
      mode,
      hint: "Platos frescos y ligeros, pensados para el calor.",
    };
  }

  if (month === 11 || month <= 2) {
    return {
      key: "invierno",
      label: "Invierno",
      climate: "invierno",
      mode,
      hint: "Guisos, cuchara y platos que entran bien con frío.",
    };
  }

  if (month === 3 || month === 4) {
    return {
      key: "templado",
      label: "Primavera",
      climate: "templado",
      mode,
      hint: "Mezclamos platos ligeros y de temporada.",
    };
  }

  return {
    key: "templado",
    label: "Otoño",
    climate: "templado",
    mode,
    hint: "Mezclamos platos ligeros con recetas de cuchara.",
  };
}

export function formatRelativeWeek(weekStart: string): string {
  const current = getMondayISO(new Date());
  const diff = Math.round(
    (parseISODate(weekStart).getTime() - parseISODate(current).getTime()) /
      86400000,
  );

  if (diff === 0) return "Esta semana";
  if (diff === -7) return "Semana pasada";
  if (diff === 7) return "Próxima semana";
  if (diff < 0) return `Hace ${Math.abs(diff / 7)} semanas`;
  return `En ${diff / 7} semanas`;
}
