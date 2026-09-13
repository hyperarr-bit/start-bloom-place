import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Production domain used for all auth email redirects (signup confirmation,
 * password reset, etc.). When the user opens the app from preview, localhost
 * or the .lovable.app staging URL, we still want the email link to send them
 * to the real custom domain — otherwise Safari tries to open localhost.
 */
const PRODUCTION_AUTH_URL = "https://www.coreaplicativo.com.br";

export function getAuthRedirectUrl(path: string = "/"): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return `${PRODUCTION_AUTH_URL}${safePath === "/" ? "" : safePath}`;
  }
  const host = window.location.hostname;
  const isNonProd =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.endsWith(".lovable.app");
  const base = isNonProd ? PRODUCTION_AUTH_URL : window.location.origin;
  return `${base}${safePath === "/" ? "" : safePath}`;
}

/** Chave de dia LOCAL (YYYY-MM-DD). NUNCA usar toISOString pra chave de dia:
 *  no Brasil (UTC-3), depois das ~21h ela vira o dia SEGUINTE e os registros
 *  "somem" — água/pendências do hub à noite (bug real, 16/07). */
export const localDayKey = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Id da semana local = localDayKey da SEGUNDA-FEIRA. A grade semanal de
 *  hábitos (rotina-habits-checked) é indexada por dia da semana ("TERÇA"),
 *  então sem um carimbo de semana o check de terça PASSADA ressuscitava hoje
 *  ("80% dos hábitos feitos" sem fazer nenhum — bug real de 22/07). Quem lê a
 *  grade só pode confiar nela se rotina-habits-week === semanaAtualId(). */
export const semanaAtualId = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDayKey(d);
};

/** Inverso do localDayKey: "YYYY-MM-DD" → Date à MEIA-NOITE LOCAL. `new
 *  Date("2026-07-18")` parseia como UTC e no Brasil (UTC-3) volta pro dia
 *  ANTERIOR ao formatar (bug real, diário da Dieta 18/07). Sempre parsear
 *  chave de dia por aqui. */
export const parseLocalDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};


/** "Setembro de 2026" — o toLocaleDateString devolve tudo minúsculo e a classe
 *  `capitalize` do Tailwind subia TODA palavra ("Setembro De 2026"), em todos os
 *  17 cabeçalhos de módulo, inclusive nos prints dos posts (11/09). Só a inicial. */
export const mesAtualExtenso = (d: Date = new Date()): string => {
  const t = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};


/**
 * Formata uma data GRAVADA sem derrubar a tela (13/09). Dez cartões faziam
 * `format(new Date(x.date))` direto: um item antigo sem data (sonho do
 * Mente semeado pela demo, pet, momento, evento) virava `RangeError:
 * Invalid time value` dentro de um .map — e o RouteErrorBoundary trocava o
 * módulo inteiro pela tela de erro. Regras: vazio ou inválido → "—";
 * "YYYY-MM-DD" é dia LOCAL (parseLocalDay, não UTC — senão à noite no
 * Brasil mostra o dia anterior); o resto passa pelo `new Date` normal.
 */
export const dataSegura = (valor: unknown, padrao: string, opcoes?: Parameters<typeof format>[2]): string => {
  if (valor == null || valor === "") return "—";
  const texto = String(valor);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? parseLocalDay(texto) : new Date(texto);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  try { return format(d, padrao, opcoes); } catch { return "—"; }
};
