/**
 * OFERTAS DEPOIS DO PIX DO VITALÍCIO (21/10) — a CHAVE CENTRAL que o dono mexe. Decisão: no máximo 2 ofertas depois
 * do Pix (1 upsell + 1 downsell), no /inicio (por cima do "Pagamento confirmado" do PixCheckout) e no /hoje.
 *
 *   "off"      → nada muda: os funis /inicio e /hoje ficam exatamente como estão (padrão; travado nos testes).
 *   "2027"     → "Seu 2027 organizado" R$ 19,90 (u2027, src/lib/upsell-2027.ts)
 *                  · Quero → Pix → "Pronto" com as lojas → pós-compra (SEM downsell)
 *                  · Agora não → plano de 30 dias da área dela R$ 9,90 (pk99, src/presente/FluxoPresente `so30Dias`)
 *                    → pós-compra. O PRESENTE NÃO aparece neste caminho.
 *   "presente" → presente R$ 14,90 (pv149, src/lib/presente.ts) → se recusar, o plano de 30 dias (pk99) → pós-compra.
 *
 * As chaves dos ramos (UPSELL_PRESENTE e UPSELL_2027) saem DAQUI — nunca as duas ao mesmo tempo.
 *
 * QA sem mexer em ninguém (fica neste navegador; o heap segura quando o Instagram zera o storage):
 *   · `?ofertas=2027|presente|off` — o jeito certo; esquece as forças antigas de cada ramo.
 *   · as forças antigas seguem valendo: `?up2027=on|off`, `?presente=on|off`. Ligar uma desliga a outra (uma só por vez).
 */
export type ModoOfertas = "off" | "presente" | "2027";
/** A CHAVE. "off" = os funis ficam byte a byte como antes. */
export const OFERTAS_POS_COMPRA: ModoOfertas = "2027";

export const PARAM_QA_OFERTAS = "ofertas";
/** Fora do prefixo core-* de propósito (a vassoura do cache não mexe; é do aparelho, como o presente-force). */
export const CHAVE_FORCA_OFERTAS = "ofertas-force";
/** As forças antigas dos ramos (mesmos nomes de antes, pros links de QA que já circulam). */
export const FORCA_PRESENTE = { param: "presente", chave: "presente-force" } as const;
export const FORCA_2027 = { param: "up2027", chave: "up2027-force" } as const;

const MODOS: readonly ModoOfertas[] = ["off", "presente", "2027"];
type OnOff = "on" | "off";

/** heap por chave de storage (o Instagram zera o storage entre as páginas, o heap segura dentro da mesma aba) */
const heap = new Map<string, string>();

const ler = (chave: string): string | null => {
  if (heap.has(chave)) return heap.get(chave) ?? null;
  try { return localStorage.getItem(chave); } catch { return null; }
};
const gravar = (chave: string, v: string): void => {
  heap.set(chave, v);
  try { localStorage.setItem(chave, v); } catch { /* storage bloqueado: fica o heap */ }
};
const esquecer = (chave: string): void => {
  heap.delete(chave);
  try { localStorage.removeItem(chave); } catch { /* noop */ }
};
const param = (busca: string, nome: string): string | null => {
  try { return new URLSearchParams(busca).get(nome); } catch { return null; }
};

/** Só testes: esquece a força de uma chave (ou de todas). */
export function _zerarForcaOfertas(chave?: string): void {
  if (chave) heap.delete(chave); else heap.clear();
}

/**
 * Qual oferta vale AQUI (lê a URL, guarda a força). "2027" vence "presente" — nunca as duas.
 */
export function modoOfertas(busca: string = typeof window === "undefined" ? "" : window.location.search): ModoOfertas {
  const central = param(busca, PARAM_QA_OFERTAS);
  if (central && (MODOS as readonly string[]).includes(central)) {
    gravar(CHAVE_FORCA_OFERTAS, central);
    esquecer(FORCA_PRESENTE.chave);
    esquecer(FORCA_2027.chave);
  } else {
    const up = param(busca, FORCA_2027.param);
    const pr = param(busca, FORCA_PRESENTE.param);
    if (up === "on" || up === "off") {
      gravar(FORCA_2027.chave, up);
      esquecer(CHAVE_FORCA_OFERTAS);
      if (up === "on") esquecer(FORCA_PRESENTE.chave);
    }
    if (pr === "on" || pr === "off") {
      gravar(FORCA_PRESENTE.chave, pr);
      esquecer(CHAVE_FORCA_OFERTAS);
      // "on" = presente AQUI, mesmo com a chave central em "2027" (só esquecer a força do 2027 cairia na central)
      if (pr === "on" && up !== "on") gravar(FORCA_2027.chave, "off");
    }
  }
  const forcaCentral = ler(CHAVE_FORCA_OFERTAS);
  const base: ModoOfertas = forcaCentral && (MODOS as readonly string[]).includes(forcaCentral) ? (forcaCentral as ModoOfertas) : OFERTAS_POS_COMPRA;
  const decide = (chave: string, modo: ModoOfertas): boolean => {
    const f = ler(chave) as OnOff | null;
    return f === "on" ? true : f === "off" ? false : base === modo;
  };
  if (decide(FORCA_2027.chave, "2027")) return "2027";
  if (decide(FORCA_PRESENTE.chave, "presente")) return "presente";
  return "off";
}
