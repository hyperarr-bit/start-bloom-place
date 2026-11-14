/**
 * FUNIL APP WEB (14/11, decisão do dono) — o MESMO funil de entrada do app novo (funil W: ComecarW, como roda no
 * Android 138 / iPhone 1.0.26) numa rota da web, `/funil-app`, mudando SÓ o paywall: em vez da loja, uma folha que sobe por
 * cima do paywall com e-mail + Pix | Cartão, tudo pela STRIPE.
 *
 *   vitalício R$ 97,90  pagamento único · Pix ou cartão em até 3x (marcado por padrão)
 *   mensal    R$ 34,90  assinatura recorrente, SÓ cartão (com o mensal marcado a folha abre no Cartão e oferece
 *                       "Prefere Pix? Vitalício por R$ 97,90")
 *   depois de pago      criar senha → lojas (App Store + Google Play, "Entre com este e-mail") + "Usar no navegador agora"
 *
 * DESLIGADA POR PADRÃO: `FUNIL_APP_WEB = "off"` → `/funil-app` manda pra home do site e nada mais muda (as rotas /app e
 * /funil-w seguem como estão, o /organizar, /simples, /oferta, /tiktok e o funil do app nativo não são tocados — travado em
 * src/test/funil-app-web.test.tsx). QA pelo link: `/funil-app?funil-app-web=on` (grava no aparelho; `=off` ou `=auto`
 * desfaz). Ligar pra todo mundo = "on" aqui + deploy.
 *
 * Medição: todo evento emitido com a rota /funil-app aberta leva `jornada: "app_web"` (lib/analytics) — os do funil W
 * (funnel_view …, funil "w") e os da folha (`appweb_*`, funil "app_web"). A régua do estudo é R$ líquido por visita.
 */
export type ModoFunilAppWeb = "off" | "on";
export const FUNIL_APP_WEB: ModoFunilAppWeb = "off";

export const ROTA_FUNIL_APP_WEB = "/funil-app";
export const PARAM_FUNIL_APP_WEB = "funil-app-web";
export const CHAVE_FORCA_FUNIL_APP_WEB = "core-funil-app-web-force";
/** o identificador da jornada em todo evento (lib/analytics) e o `funil` dos eventos da folha */
export const JORNADA_APP_WEB = "app_web";

export const PRECO_VITALICIO_CENTAVOS = 9790;
export const PRECO_MENSAL_CENTAVOS = 3490;
export const PARCELAS_MAX = 3;
export const reaisDe = (c: number): string => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/** `?funil-app-web=on|off|auto` → grava (ou apaga) a força de QA no aparelho */
export function guardarForcaFunilAppWeb(busca?: string): void {
  let p: URLSearchParams;
  try { p = new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const v = p.get(PARAM_FUNIL_APP_WEB);
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_FUNIL_APP_WEB, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_FUNIL_APP_WEB);
}

/** A rota está ligada AQUI? força de QA > chave. */
export function funilAppWebLigado(modo: ModoFunilAppWeb = FUNIL_APP_WEB): boolean {
  const f = ls.get(CHAVE_FORCA_FUNIL_APP_WEB);
  if (f === "on") return true;
  if (f === "off") return false;
  return modo === "on";
}

/** estamos na rota do funil app web? (o analytics põe `jornada` em todo evento) */
export const naRotaFunilAppWeb = (): boolean => {
  try {
    if (typeof window === "undefined") return false;
    if (window.location.pathname.replace(/\/+$/, "") === ROTA_FUNIL_APP_WEB) return true;
    // a demo do funil (/preview/…) volta pro /funil-app: os eventos dela também são da jornada
    return window.location.pathname.startsWith("/preview/") && (sessionStorage.getItem("core-demo-volta") ?? "").startsWith(`${ROTA_FUNIL_APP_WEB}?`);
  } catch { return false; }
};
export const camposJornadaAppWeb = (): Record<string, string> => (naRotaFunilAppWeb() ? { jornada: JORNADA_APP_WEB } : {});
