/**
 * EXPLICAÇÃO ANTES DA FOLHA DA APPLE, NA 2ª VEZ (16/10, só iPhone, 1.0.16).
 *
 * O dado (definitiva/3-onboarding, builds 38+40): 35% aceitam a 1ª folha; quem cancela fica 6 s
 * nela (30% em menos de 5 s, sem ler); quem tenta de novo aceita 58%. Boa parte do "não" é susto
 * com o "R$ 97,90/ano" que a folha mostra. Então, quando a pessoa JÁ FECHOU a folha uma vez e
 * toca de novo (Continuar, "Tentar de novo" ou o presente de 69,90 que vem depois da folha
 * fechada), esta meia-folha calma aparece antes:
 *   · o que acontece nos dias do teste (hoje / aviso / último dia), com as datas reais;
 *   · "Nada é cobrado hoje";
 *   · o lembrete antes do fim — SÓ se o app vai mesmo mandar: é a notificação local do
 *     lib/notificacoes (pedirLembreteDoTeste, ~36 h antes do fim), que precisa da permissão.
 *     Permitida: a linha aparece; ainda não perguntada: aparece com "deixe os avisos ligados";
 *     negada/indisponível: a linha some (tela só promete o que cumpre);
 *   · como a folha da Apple é e como confirmar (clique duplo no botão lateral + Face ID, ou
 *     Touch ID).
 * NUNCA fala de a Apple cobrar antes do fim (veto do dono). Um toque em "Continuar pra Apple"
 * abre a folha. Eventos: explica_folha_view / explica_folha_continuar / explica_folha_fechar
 * (com `ms` na tela).
 *
 * 17/10 (`enxuto`, com o paywall minimalista ligado): a linha do tempo é a MESMA do paywall
 * (components/paywall/LinhaDoTempoDoTeste, copy do dono: Hoje — R$ 0,00 · Amanhã — Lembrete ·
 * Dia 3 — R$ 97,90/ano) e a explicação da folha da Apple cabe numa frase. Sem `enxuto`, a tela de
 * 16/10, igual. A leitura da permissão é a mesma nos dois (lerAvisoDoTeste).
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bell, Check, Lock, Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { LinhaDoTempoDoTeste, lerAvisoDoTeste, passosDoTeste, type AvisoDoTeste } from "@/components/paywall/LinhaDoTempoDoTeste";

/** Estado do lembrete do fim do teste, como a tela promete (mora com a linha do tempo desde 17/10). */
export type { AvisoDoTeste };

const dataCurta = (d: Date): string => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

/** As linhas da explicação — pura (testável): Hoje · [Dia N−1 aviso] · Dia N. */
export function linhasDaExplicacao(dias: number, preco: string, precoTeste: string | null, aviso: AvisoDoTeste, hoje: Date = new Date()): Array<{ quando: string; titulo: string; texto: string; tipo: "hoje" | "aviso" | "fim" }> {
  const n = Math.max(1, dias);
  const em = (k: number) => { const d = new Date(hoje); d.setDate(d.getDate() + k); return dataCurta(d); };
  const linhas: Array<{ quando: string; titulo: string; texto: string; tipo: "hoje" | "aviso" | "fim" }> = [
    { quando: `Hoje · ${em(0)}`, titulo: "Acesso a tudo", texto: `Nada é cobrado hoje${precoTeste ? ` (${precoTeste})` : ""}.`, tipo: "hoje" },
  ];
  if (n >= 3 && aviso !== "nao") {
    linhas.push({
      quando: `Dia ${n - 1} · ${em(n - 2)}`,
      titulo: "A gente te avisa",
      texto: aviso === "sim" ? "Lembrete no celular antes do teste acabar." : "Lembrete no celular antes do teste acabar (é só deixar os avisos ligados).",
      tipo: "aviso",
    });
  }
  linhas.push({ quando: `Dia ${n} · ${em(n - 1)}`, titulo: "Começa o anual", texto: `${preco}/ano, só se você continuar. Cancelou antes, não paga nada.`, tipo: "fim" });
  return linhas;
}

/** O estado da permissão de notificação vira o que a tela pode prometer (o mesmo do paywall minimalista). */
const lerAviso = lerAvisoDoTeste;

export function ExplicaFolha({ lugar, produto, preco, precoTeste, dias, aviso: avisoForcado, enxuto = false, onContinuar, onFechar }: {
  /** De onde veio: "paywall" (Continuar/Tentar de novo) ou o presente ("presente_folha_cancelada"…). */
  lugar: string;
  produto: string;
  /** Preço do ano, da loja ("R$ 97,90"). */
  preco: string;
  /** O que a folha mostra hoje pelo teste ("R$ 0,00"), da loja; null = só o texto. */
  precoTeste: string | null;
  dias: number;
  /** Pula a leitura da permissão: dev/testes, ou o paywall que já leu (a mesma promessa nas duas telas). */
  aviso?: AvisoDoTeste;
  /** 17/10: o paywall minimalista está ligado — a linha do tempo do paywall e a frase curta da folha. */
  enxuto?: boolean;
  onContinuar: () => void;
  onFechar: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const [aviso, setAviso] = useState<AvisoDoTeste | null>(avisoForcado ?? null);
  const abertoEm = useRef(Date.now());
  const feito = useRef(false);
  const base = () => ({ lugar, produto, preco, dias, aviso: aviso ?? "nao" });

  useEffect(() => {
    let vivo = true;
    if (avisoForcado) {
      trackEvent("explica_folha_view", { lugar, produto, preco, dias, aviso: avisoForcado });
    } else {
      void lerAviso().then((a) => {
        if (!vivo) return;
        setAviso(a);
        trackEvent("explica_folha_view", { lugar, produto, preco, dias, aviso: a });
      });
    }
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sair = (acao: "continuar" | "fechar") => {
    if (feito.current) return;
    feito.current = true;
    trackEvent(acao === "continuar" ? "explica_folha_continuar" : "explica_folha_fechar", { ...base(), ms: Date.now() - abertoEm.current });
    if (acao === "continuar") onContinuar(); else onFechar();
  };

  const linhas = linhasDaExplicacao(dias, preco, precoTeste, aviso ?? "nao");
  const icone = (t: "hoje" | "aviso" | "fim") =>
    t === "hoje" ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : t === "aviso" ? <Bell className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={2.5} />;

  return (
    <div className="fixed inset-0 z-[340] flex flex-col justify-end" data-testid="explica-folha" data-lugar={lugar} role="dialog" aria-modal="true" aria-labelledby="explica-folha-titulo">
      <motion.button
        type="button" aria-label="Fechar" data-testid="explica-folha-fundo"
        className="absolute inset-0 bg-black/45"
        initial={reduzir ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduzir ? 0 : 0.2 }}
        onClick={() => sair("fechar")}
      />
      <motion.div
        initial={reduzir ? false : { y: "100%" }} animate={{ y: 0 }}
        transition={reduzir ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }}
        className="relative w-full max-w-[440px] mx-auto rounded-t-[28px] bg-card text-foreground shadow-[0_-18px_48px_-20px_rgba(0,0,0,0.45)] px-5 pt-2.5"
        style={{ paddingBottom: "max(1.1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-10 h-1.5 rounded-full bg-muted-foreground/25 mb-3.5" aria-hidden />
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent">Antes de abrir a Apple</p>
        <h2 id="explica-folha-titulo" className="text-[22px] font-black tracking-[-0.02em] leading-[1.15] mt-1">
          Como funcionam seus {dias} dias grátis
        </h2>

        {/* a linha do tempo: 17/10 enxuto = a MESMA do paywall minimalista; senão a de 16/10, com as datas reais */}
        {enxuto ? (
          <div className="mt-3.5">
            <LinhaDoTempoDoTeste passos={passosDoTeste({ dias, precoAnual: preco, precoTeste, aviso })} testid="explica-folha-linhas" />
          </div>
        ) : (
        <ol className="mt-3.5 relative" data-testid="explica-folha-linhas">
          <span className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-border" aria-hidden />
          {linhas.map((l) => (
            <li key={l.tipo} className="relative grid grid-cols-[28px_1fr] gap-3 items-start py-1.5" data-tipo={l.tipo}>
              <span className={`relative z-[1] w-7 h-7 rounded-full grid place-items-center ${l.tipo === "hoje" ? "bg-accent text-accent-foreground" : "bg-card border-2 border-accent/60 text-accent"}`} aria-hidden>
                {icone(l.tipo)}
              </span>
              <span className="pt-0.5">
                <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{l.quando}</span>
                <b className="block text-[15px] leading-tight">{l.titulo}</b>
                <span className="block text-[13px] text-muted-foreground leading-snug">{l.texto}</span>
              </span>
            </li>
          ))}
        </ol>
        )}

        {/* como a folha da Apple é */}
        <div className="mt-3 rounded-2xl bg-secondary px-3.5 py-3 flex gap-3 items-start" data-testid="explica-folha-apple">
          <div className="shrink-0 w-[54px] rounded-[10px] bg-card border border-border px-1.5 pt-1.5 pb-2 shadow-sm" aria-hidden>
            <div className="h-1 w-5 mx-auto rounded-full bg-muted-foreground/30" />
            <div className="mt-1.5 h-1.5 w-full rounded bg-foreground/70" />
            <div className="mt-1 h-1.5 w-3/4 rounded bg-muted-foreground/35" />
            <div className="mt-2 h-3 w-full rounded-[4px] bg-[#0a84ff]" />
          </div>
          {enxuto ? (
            <p className="text-[12.5px] leading-snug self-center">
              <b>Na tela da Apple</b>, confirme com 2 cliques no botão lateral (ou Touch ID).
            </p>
          ) : (
          <p className="text-[12.5px] leading-snug">
            <b>Na tela da Apple</b> aparece o teste grátis e o valor do ano depois dele.{" "}
            <span className="text-muted-foreground">Pra confirmar: clique 2 vezes no botão lateral e olhe pra tela (Face ID). No iPhone com botão de início, é o Touch ID.</span>
          </p>
          )}
        </div>

        <button
          type="button" data-testid="explica-folha-continuar"
          onClick={() => sair("continuar")}
          className="mt-4 w-full h-14 rounded-full bg-primary text-primary-foreground text-[16.5px] font-bold flex items-center justify-center gap-1.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] active:scale-[0.985] transition-transform"
        >
          Continuar pra Apple <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-2 text-center text-[11.5px] text-muted-foreground flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3" /> Cancele quando quiser em Ajustes › Assinaturas
        </p>
        <button type="button" data-testid="explica-folha-fechar" onClick={() => sair("fechar")} className="w-full text-center text-[13px] font-semibold text-muted-foreground mt-1 py-2">
          Agora não
        </button>
      </motion.div>
    </div>
  );
}
