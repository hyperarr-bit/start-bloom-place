/**
 * A LINHA DO TEMPO DO TESTE GRÁTIS (17/10, 1.0.16) — UM componente e UMA conta de dias pro paywall
 * minimalista (PaywallIOS) e pra explicação antes da 2ª folha da Apple (ExplicaFolha). Os dois
 * mostram os mesmos passos, com a mesma copy; não existem duas cópias pra divergir.
 *
 * Por quê: o paywall é o maior vazamento (só 35–39% tocam em Continuar). No Blinkist (via
 * RevenueCat) a linha do tempo do teste deu +23% de conversão e −55% de reclamação de cobrança, e a
 * 1★ mais forte do CORE é "fui cobrada antes do período de 3 dias acabar".
 *
 * A COPY É A DO DONO (17/10, "minimalismo é melhor"), sem frase a mais:
 *   ✓ Hoje — R$ 0,00 · Seu acesso gratuito começa agora.
 *   🔔 Amanhã — Lembrete · Avisamos que seu teste está terminando.
 *   💳 Dia 3 — R$ 97,90/ano · A cobrança começa se você não cancelar antes do fim do teste.
 * Sem datas. O "R$ 0,00" é o preço da oferta introdutória e o "R$ 97,90/ano" o anual que a loja
 * serviu (97,90 · 119,90 · 69,90 — o teste de preço roda no RevenueCat): NADA chumbado. Com teste
 * de outra duração os rótulos acompanham (7 dias → "Dia 6" e "Dia 7").
 *
 * O LEMBRETE É VERDADE: o passo "Amanhã" é o dia do aviso 920001 ("Seu teste grátis termina
 * amanhã", lib/notificacoes) — `diaDoAviso` aqui é a MESMA conta que o diaDoAvisoDoTeste de lá
 * (dia da compra + N − 2; o teste lembrete-teste-loja confere os dois). E ele só aparece se o app
 * vai mesmo mandar: permissão negada/indisponível → o passo sai (tela só promete o que cumpre).
 * NUNCA fala de a Apple cobrar antes do fim (veto do dono), nunca "sem cartão".
 */
import type { ReactNode } from "react";
import { Bell, Check, CreditCard, RefreshCw } from "lucide-react";

/** O lembrete do fim do teste, como a tela pode prometer: permitido · ainda não perguntado · não vai sair. */
export type AvisoDoTeste = "sim" | "se_ligar" | "nao";
export type TipoDoPasso = "hoje" | "aviso" | "fim" | "renova";
export type PassoDoTeste = { tipo: TipoDoPasso; quando: string; valor: string; texto: string };

const dataCurta = (d: Date): string => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Quantos dias depois de hoje sai o lembrete: o dia N−1 do teste (Dia 1 = hoje). null se o teste tem menos de 3 dias. */
export const diasAteOAviso = (dias: number): number | null => {
  const n = Math.max(1, dias);
  return n >= 3 ? n - 2 : null;
};

/** "DD/MM" do lembrete — o dia em que o 920001 toca (ver diaDoAvisoDoTeste em lib/notificacoes). */
export function diaDoAviso(dias: number, hoje: Date = new Date()): string | null {
  const k = diasAteOAviso(dias);
  if (k === null) return null;
  const d = new Date(hoje);
  d.setDate(d.getDate() + k);
  return dataCurta(d);
}

/** Os passos do teste grátis (pura). `aviso` "nao" tira o lembrete; null = ainda lendo (mostra). */
export function passosDoTeste({ dias, precoAnual, precoTeste, aviso }: {
  dias: number;
  /** "R$ 97,90" — o anual que a loja serviu. */
  precoAnual: string;
  /** "R$ 0,00" — o preço da oferta introdutória, da loja; null = loja calada ("Grátis"). */
  precoTeste: string | null;
  aviso: AvisoDoTeste | null;
}): PassoDoTeste[] {
  const n = Math.max(1, dias);
  const passos: PassoDoTeste[] = [{ tipo: "hoje", quando: "Hoje", valor: precoTeste ?? "Grátis", texto: "Seu acesso gratuito começa agora." }];
  const k = diasAteOAviso(n);
  if (k !== null && aviso !== "nao") {
    passos.push({ tipo: "aviso", quando: k === 1 ? "Amanhã" : `Dia ${n - 1}`, valor: "Lembrete", texto: "Avisamos que seu teste está terminando." });
  }
  passos.push({ tipo: "fim", quando: `Dia ${n}`, valor: `${precoAnual}/ano`, texto: "A cobrança começa se você não cancelar antes do fim do teste." });
  return passos;
}

/** Sem teste grátis (o mensal, ou o anual de quem já usou o teste): cobra hoje e renova. */
export function passosSemTeste({ preco, periodo }: { preco: string; periodo: "mes" | "ano" }): PassoDoTeste[] {
  return [
    { tipo: "hoje", quando: "Hoje", valor: preco, texto: "Seu acesso começa agora." },
    { tipo: "renova", quando: periodo === "mes" ? "Todo mês" : "Todo ano", valor: preco, texto: "Renova sozinho até você cancelar." },
  ];
}

/** O estado da permissão de notificação vira o que a tela pode prometer. Erro/indisponível = "nao". */
export async function lerAvisoDoTeste(): Promise<AvisoDoTeste> {
  // só no servidor de desenvolvimento (some do build): o navegador não tem o plugin de notificação
  if (import.meta.env.DEV) {
    try {
      const f = localStorage.getItem("__dev_aviso_teste");
      if (f === "sim" || f === "se_ligar" || f === "nao") return f;
    } catch { /* noop */ }
  }
  try {
    const { estadoPermissao } = await import("@/lib/notificacoes");
    const e = await estadoPermissao();
    return e === "granted" ? "sim" : e === "prompt" ? "se_ligar" : "nao";
  } catch { return "nao"; }
}

const ICONE: Record<TipoDoPasso, { classe: string; icone: ReactNode }> = {
  hoje: { classe: "bg-accent text-accent-foreground", icone: <Check className="w-4 h-4" strokeWidth={3} /> },
  aviso: { classe: "bg-accent/15 text-accent", icone: <Bell className="w-4 h-4" strokeWidth={2.5} /> },
  fim: { classe: "bg-foreground/[0.07] text-foreground", icone: <CreditCard className="w-4 h-4" strokeWidth={2.25} /> },
  renova: { classe: "bg-foreground/[0.07] text-foreground", icone: <RefreshCw className="w-4 h-4" strokeWidth={2.25} /> },
};
/* o traço entre os ícones esfria do magenta (hoje) pro grafite (a cobrança) */
const TRACO = ["from-accent to-accent/30", "from-accent/30 to-foreground/15"];

/**
 * A linha do tempo vertical: ícone (✓ · sino · cartão) + traço ligando + "Quando — valor" e a frase.
 * Cores só por variável (claro e escuro). Tamanhos por variável, com padrão: `--passo-icone` (32px),
 * `--passo-titulo` (15.5px), `--passo-texto` (13px) e `--passo-gap` (14px) — o paywall cresce com a
 * altura da tela (sem buraco no 390×844) e aperta no 375×667; a explicação usa o padrão.
 */
export function LinhaDoTempoDoTeste({ passos, testid = "linha-do-tempo" }: { passos: PassoDoTeste[]; testid?: string }) {
  return (
    <ol className="text-left" data-testid={testid}>
      {passos.map((p, i) => {
        const ultimo = i === passos.length - 1;
        return (
          <li key={p.tipo} data-tipo={p.tipo} className="grid grid-cols-[var(--passo-icone,32px)_1fr] gap-x-3.5">
            <div className="flex flex-col items-center">
              <span className={`w-[var(--passo-icone,32px)] h-[var(--passo-icone,32px)] rounded-full grid place-items-center shrink-0 ${ICONE[p.tipo].classe}`} aria-hidden>
                {ICONE[p.tipo].icone}
              </span>
              {!ultimo && <span className={`w-[3px] flex-1 min-h-[8px] my-1 rounded-full bg-gradient-to-b ${TRACO[Math.min(i, TRACO.length - 1)]}`} aria-hidden />}
            </div>
            {/* o título no meio do ícone: (ícone − altura da linha do título) / 2 */}
            <div className={`pt-[calc((var(--passo-icone,32px)_-_var(--passo-titulo,15.5px)*1.25)/2)] ${ultimo ? "" : "pb-[var(--passo-gap,14px)]"}`}>
              <p className="text-[length:var(--passo-titulo,15.5px)] font-bold leading-tight text-foreground" data-passo-titulo>
                {p.quando} — {p.valor}
              </p>
              <p className="text-[length:var(--passo-texto,13px)] leading-snug text-muted-foreground mt-0.5">{p.texto}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
