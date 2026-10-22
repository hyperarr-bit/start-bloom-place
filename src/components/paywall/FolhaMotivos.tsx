/**
 * "O QUE TE FEZ PARAR?" (1.0.18, dono 22/10 — estilo Enxovaly/Cal AI). Regras e chave (`motivos_folha`) em
 * lib/mensal-degraus. Folha de baixo, por cima do paywall do funil, logo depois de a pessoa FECHAR a folha da Apple do
 * anual com teste. Um toque no motivo; três motivos têm resposta aqui mesmo (medo de esquecer, conhecer antes, sem
 * cartão) e voltam pro teste do anual pelo botão; "Achei caro" e "Outro motivo" saem pra quem chama (o presente 69,90).
 *
 * Copy: curta, títulos sem ponto final, neutra de gênero. Sem desconto nas respostas, nunca "a Apple cobra até 24 h
 * antes", nunca Pix/site (é o app da loja). O aviso de 1 dia antes só é prometido se ele vai mesmo sair (`aviso`).
 *
 * Eventos daqui: motivo_folha_view, motivo_escolhido {motivo}, motivo_voltar_plano {motivo|null} — todos com os
 * `campos` de quem chama (funil, área, braço). O resultado da compra de cada caminho é contado por quem chama.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Bell, Sparkles, CreditCard } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import type { AvisoDoTeste } from "@/components/paywall/LinhaDoTempoDoTeste";

export type MotivoDaFolha = "caro" | "medo_esquecer" | "conhecer_antes" | "sem_cartao" | "outro";
/** Os que têm resposta aqui e voltam pro teste do anual. */
export type MotivoComResposta = "medo_esquecer" | "conhecer_antes" | "sem_cartao";

export const OPCOES_DE_MOTIVO: ReadonlyArray<{ id: MotivoDaFolha; texto: string }> = [
  { id: "caro", texto: "Achei caro" },
  { id: "medo_esquecer", texto: "Tenho medo de esquecer de cancelar" },
  { id: "conhecer_antes", texto: "Quero conhecer o app antes" },
  { id: "sem_cartao", texto: "Não tenho cartão na conta Apple" },
  { id: "outro", texto: "Outro motivo" },
];

export const PASSOS_DO_CARTAO = [
  "Abra os Ajustes do iPhone",
  "Toque no seu nome, lá em cima",
  "Pagamento e Envio › Adicionar Forma de Pagamento",
  "Volte aqui e toque em Tentar de novo",
] as const;

export function FolhaMotivos({ dias, aviso, campos = {}, onPresente, onTeste, onVoltar }: {
  /** Os dias grátis que a loja serviu (o mesmo número do paywall). */
  dias: number;
  /** O aviso do fim do teste vai sair? ("nao" = não prometer; null = ainda lendo → não prometer). */
  aviso: AvisoDoTeste | null;
  campos?: Record<string, unknown>;
  /** "Achei caro" / "Outro motivo": quem chama mostra o presente 69,90. */
  onPresente: (motivo: "caro" | "outro") => void;
  /** O botão de uma resposta: a MESMA compra do anual do paywall. */
  onTeste: (motivo: MotivoComResposta) => void;
  /** "Voltar ao plano": a folha sai, o paywall fica. */
  onVoltar: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const [resposta, setResposta] = useState<MotivoComResposta | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    trackEvent("motivo_folha_view", campos);
    return () => { vivo.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolher = (m: MotivoDaFolha) => {
    trackEvent("motivo_escolhido", { ...campos, motivo: m });
    if (m === "caro" || m === "outro") { onPresente(m); return; }
    setResposta(m);
  };
  const voltar = () => { trackEvent("motivo_voltar_plano", { ...campos, motivo: resposta }); onVoltar(); };

  const prometeAviso = aviso === "sim" || aviso === "se_ligar";
  const botaoTeste = `Começar ${dias} dias grátis`;

  const conteudoDaResposta = (m: MotivoComResposta) => {
    if (m === "medo_esquecer") {
      return {
        icone: <Bell className="w-6 h-6" strokeWidth={1.9} />,
        titulo: prometeAviso ? "A gente te avisa antes" : "Cancele quando quiser",
        texto: prometeAviso
          ? "Um aviso 1 dia antes do teste acabar. Cancele quando quiser nos Ajustes do iPhone."
          : "Nos Ajustes do iPhone, em Assinaturas. Cancelou antes do fim do teste, não paga nada.",
        cta: botaoTeste,
      };
    }
    if (m === "conhecer_antes") {
      // TODO (dono 22/10): se um dia existir uma offering de teste de 7 dias, este é o lugar dela — hoje NÃO existe;
      // a resposta volta pro mesmo teste do anual que a loja serviu.
      return {
        icone: <Sparkles className="w-6 h-6" strokeWidth={1.9} />,
        titulo: `São ${dias} dias grátis pra conhecer tudo`,
        texto: "Os 16 módulos liberados. Nada é cobrado hoje.",
        cta: botaoTeste,
      };
    }
    return {
      icone: <CreditCard className="w-6 h-6" strokeWidth={1.9} />,
      titulo: "Adicione um cartão no iPhone",
      texto: null,
      cta: "Tentar de novo",
    };
  };

  const r = resposta ? conteudoDaResposta(resposta) : null;

  return (
    <div className="fixed inset-0 z-[320] flex flex-col justify-end" data-testid="folha-motivos" data-resposta={resposta ?? ""}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-black/40"
        initial={reduzir ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={voltar}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="folha-motivos-titulo"
        className="relative bg-background text-foreground rounded-t-[28px] px-6 pt-3 max-h-[92dvh] overflow-y-auto"
        style={{ paddingBottom: "calc(var(--app-safe-bottom, 0px) + 1rem)" }}
        initial={reduzir ? false : { y: "100%" }}
        animate={{ y: 0 }}
        transition={reduzir ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }}
      >
        <div className="mx-auto w-10 h-1.5 rounded-full bg-foreground/15 mb-5" aria-hidden />
        {!r ? (
          <>
            <h2 id="folha-motivos-titulo" className="text-[22px] font-bold tracking-tight leading-tight text-center">O que te fez parar?</h2>
            <p className="text-[14px] text-muted-foreground text-center mt-1.5">Um toque e a gente ajuda</p>
            <ul className="mt-5 flex flex-col gap-2.5">
              {OPCOES_DE_MOTIVO.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => escolher(o.id)}
                    data-testid={`motivo-${o.id}`}
                    className="w-full min-h-[56px] rounded-2xl border border-border bg-card px-4 text-left text-[15.5px] font-semibold flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
                  >
                    <span>{o.texto}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div data-testid={`motivo-resposta-${resposta}`}>
            <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto" aria-hidden>{r.icone}</div>
            <h2 id="folha-motivos-titulo" className="text-[22px] font-bold tracking-tight leading-tight text-center mt-4">{r.titulo}</h2>
            {r.texto && <p data-testid="motivo-resposta-texto" className="text-[15px] text-muted-foreground text-center leading-relaxed mt-2 px-2">{r.texto}</p>}
            {resposta === "sem_cartao" && (
              <ol data-testid="motivo-passos-cartao" className="mt-5 rounded-2xl border border-border bg-card divide-y divide-border text-left">
                {PASSOS_DO_CARTAO.map((p, i) => (
                  <li key={p} className="flex items-center gap-3 px-4 py-3 text-[14.5px] font-medium">
                    <span className="w-6 h-6 rounded-full bg-foreground text-background text-[12px] font-bold grid place-items-center shrink-0">{i + 1}</span>
                    {p}
                  </li>
                ))}
              </ol>
            )}
            <button
              type="button"
              onClick={() => onTeste(resposta!)}
              data-testid="motivo-cta"
              className="w-full h-14 mt-6 rounded-full bg-foreground text-background text-[16px] font-semibold active:scale-[0.985] transition-transform"
            >
              {r.cta}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={voltar}
          data-testid="motivo-voltar-plano"
          className="w-full h-11 mt-2 text-[14px] font-medium text-muted-foreground"
        >
          Voltar ao plano
        </button>
      </motion.div>
    </div>
  );
}
