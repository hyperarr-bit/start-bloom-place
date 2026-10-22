/**
 * A TELA DO MENSAL "ESTILO BITEPAL" (1.0.18, dono 22/10) — os dois lugares novos do 19,90
 * (regras e chaves em lib/mensal-degraus):
 *   · "degrau2" — o 2º degrau da recusa (cartão recusado 7+ dias depois do card, ou sem acesso). Troca o produto da
 *                 próxima tentativa da Apple: NUNCA promete acesso na hora (o mesmo texto do card da recusa).
 *   · "motivo_mensal" — o "Achei caro" da folha "O que te fez parar?" no paywall do funil (recusou o presente 69,90).
 *                 Compra nova: cobra hoje e libera na hora.
 *
 * As leis: UMA decisão por tela; o preço como número-herói no centro (a única cor cheia é ele, em magenta); o que a
 * pessoa já montou no app, só com dado REAL da conta (sem nada real, o bloco some); botão preto pílula de 56 px fixo
 * embaixo; "Agora não" discreto. Visual do CORE (grafite + magenta, Inter). Títulos sem ponto final, neutros de
 * gênero; nada de horário/antecedência da cobrança, nada de Pix/site (é o app da loja).
 *
 * Eventos: <modo>_view (ao aparecer), <modo>_compra {resultado: sucesso|cancelou|falhou, motivo}, <modo>_agora_nao —
 * todos com os `campos` de quem chama (ex.: braço dos motivos, com_acesso/dias_restantes da recusa).
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { erroFolhaNaoConcluiu, erroJaAtivo, erroNaoPermitido, nomeLoja } from "@/lib/loja";
import { UserDataContext } from "@/hooks/use-user-data";
import { CHAVE_DIAS_ANOTADOS, normalizarDias } from "@/lib/sequencia";
import { porDiaExato, registrosPorModulo, type Leitor } from "@/lib/lembrete-dia2";
import { reais } from "@/lib/dinheiro";
import type { OfertaDoMensal19 } from "@/components/paywall/OfertaMensal19";

export type ModoMensalHeroi = "degrau2" | "motivo_mensal";
/** Fora do UserDataProvider (ou com o hook trocado num teste) a tela só não mostra "o que você já montou". */
const SEM_DADOS = createContext<{ get?: unknown } | undefined>(undefined);
const contextoDeDados = (): typeof SEM_DADOS => {
  try { return (UserDataContext as unknown as typeof SEM_DADOS | undefined) ?? SEM_DADOS; } catch { return SEM_DADOS; }
};

/**
 * O que a pessoa já montou, só com dado real (as mesmas contas do app): dias com algo anotado (a sequência nova),
 * o "quanto posso gastar hoje" das Finanças dela (o número do card do Dashboard) e quantos módulos têm registro.
 * Puro sobre o leitor; nada real = lista vazia.
 */
export function oQueJaMontou(get: Leitor | null | undefined): string[] {
  if (!get) return [];
  const linhas: string[] = [];
  try {
    const dias = normalizarDias(get<unknown>(CHAVE_DIAS_ANOTADOS, [])).length;
    if (dias >= 2) linhas.push(`${dias} dias com o CORE`);
  } catch { /* segue */ }
  try {
    const porDia = porDiaExato(get);
    const n = porDia === null ? 0 : Math.round(porDia);
    if (n > 0) linhas.push(`Pode gastar R$ ${reais(n)} hoje`);
  } catch { /* segue */ }
  try {
    const n = Object.values(registrosPorModulo(get)).filter((v) => v > 0).length;
    if (n > 0) linhas.push(`${n} ${n === 1 ? "módulo montado" : "módulos montados"}`);
  } catch { /* segue */ }
  return linhas;
}

/** "R$ 19,90" → { antes: "R$", numero: "19,90" } (moeda pequena, número grande); formato estranho = tudo grande. */
export function partesDoPreco(preco: string): { antes: string; numero: string } {
  const m = /^([^\d]*?)\s*(\d[\d.,]*)\s*$/.exec(preco.trim());
  return m ? { antes: m[1].trim(), numero: m[2] } : { antes: "", numero: preco };
}

export function MensalHeroi({ modo, oferta, comAcesso = true, campos = {}, onFechar, onSucesso }: {
  modo: ModoMensalHeroi;
  oferta: OfertaDoMensal19;
  /** degrau2: a pessoa ainda usa (carência) ou perdeu o acesso — muda só o título e a linha da regra. */
  comAcesso?: boolean;
  /** Vai em todos os eventos (braço, com_acesso, dias_restantes…). */
  campos?: Record<string, unknown>;
  /** "Agora não" (e o "Entendi" depois da troca no degrau2). */
  onFechar: () => void;
  /** A folha da Apple fechou com sucesso. degrau2: a tela mostra "Plano trocado" e chama isto; motivo_mensal: quem chama segue. */
  onSucesso?: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const ctx = useContext(contextoDeDados());
  const construido = useMemo(() => oQueJaMontou(ctx?.get as Leitor | undefined), [ctx]);
  const [comprando, setComprando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [trocou, setTrocou] = useState(false);
  const vivo = useRef(true);
  const extra = { ...campos, preco: oferta.preco };

  useEffect(() => {
    vivo.current = true;
    trackEvent(`${modo}_view`, { ...extra, construido: construido.length });
    return () => { vivo.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agoraNao = () => { trackEvent(`${modo}_agora_nao`, extra); onFechar(); };

  const comprar = async () => {
    if (comprando) return;
    setComprando(true);
    setErro(null);
    const rc = await import("@/lib/revenuecat");
    rc.marcarToqueDeCompra();
    const ok = await rc.comprarMensal19(modo);
    if (!vivo.current) return;
    setComprando(false);
    const motivo = ok ? null : rc.motivoUltimaCompra();
    const resultado = ok ? "sucesso" : motivo === "cancelou" || motivo === null ? "cancelou" : "falhou";
    trackEvent(`${modo}_compra`, { ...extra, resultado, motivo });
    if (ok) {
      if (modo === "degrau2") setTrocou(true);
      onSucesso?.();
      return;
    }
    if (resultado === "cancelou") return; // fechou a folha: sem alarde, a tela fica
    if (motivo === "ja_ativo") setErro(erroJaAtivo());
    else if (motivo === "nao_permitido") setErro(erroNaoPermitido());
    else setErro(erroFolhaNaoConcluiu());
  };

  const { antes, numero } = partesDoPreco(oferta.preco);
  const loja = nomeLoja();
  const titulo = modo === "motivo_mensal" ? "Comece pelo mensal" : comAcesso ? "Seu CORE continua por" : "Seu CORE volta por";
  const regra = modo === "motivo_mensal"
    ? <>Cobrado hoje pela {loja}. Renova todo mês até você cancelar.</>
    : comAcesso
      ? <>Você segue usando enquanto a {loja} tenta cobrar o valor menor. Renova todo mês até você cancelar.</>
      : <>O acesso volta quando a {loja} conseguir cobrar o valor menor. Renova todo mês até você cancelar.</>;
  const entra = (atraso: number, y = 10) => (reduzir
    ? { initial: false as const, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { delay: atraso, duration: 0.42, ease: [0.22, 1, 0.36, 1] as const } });

  const tela = (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mensal-heroi-titulo"
      data-testid={`mensal-heroi-${modo}`}
      data-modo={modo}
      data-aviso-cobranca={modo === "degrau2" ? "" : undefined}
      initial={reduzir ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[320] flex flex-col bg-background text-foreground"
    >
      <div
        className="flex-1 overflow-y-auto px-7 flex flex-col"
        style={{ paddingTop: "calc(var(--app-safe-top, 0px) + 1.5rem)" }}
      >
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-[340px] w-full mx-auto py-6">
          {trocou ? (
            <>
              <h2 id="mensal-heroi-titulo" className="text-[26px] font-bold tracking-tight leading-tight">Plano trocado</h2>
              <p data-testid="mensal-heroi-trocou" className="text-muted-foreground text-[15px] leading-relaxed mt-3">
                Agora é {oferta.preco} por mês. A {loja} cobra o valor novo na próxima tentativa.
              </p>
            </>
          ) : (
            <>
              <motion.h2 {...entra(0.05, 8)} id="mensal-heroi-titulo" className="text-[22px] font-bold tracking-tight leading-tight text-foreground">
                {titulo}
              </motion.h2>
              <motion.div {...entra(0.12, 14)} className="mt-4 flex items-start justify-center text-accent" data-testid="mensal-heroi-preco" aria-label={`${oferta.preco} por mês`}>
                {antes && <span className="text-[26px] font-extrabold leading-none mt-[14px] mr-1.5">{antes}</span>}
                <span className="text-[76px] font-black tracking-[-0.045em] leading-none tabular-nums">{numero}</span>
              </motion.div>
              <motion.p {...entra(0.16, 6)} className="text-[17px] font-semibold text-foreground mt-2">
                por mês
              </motion.p>

              {construido.length > 0 ? (
                <motion.ul
                  {...entra(0.24, 10)}
                  data-testid="mensal-heroi-construido"
                  className="mt-9 w-full rounded-2xl border border-border bg-card text-left divide-y divide-border"
                >
                  <li className="px-4 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">O que você já montou</li>
                  {construido.map((l) => (
                    <li key={l} className="px-4 py-3 text-[15px] font-semibold flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/70 shrink-0" aria-hidden />
                      {l}
                    </li>
                  ))}
                </motion.ul>
              ) : (
                <motion.p {...entra(0.24, 6)} className="text-[14px] text-muted-foreground mt-6">
                  Os 16 módulos, sem limite
                </motion.p>
              )}
            </>
          )}
        </div>
      </div>

      <div
        className="px-6 pt-3 bg-background"
        style={{ paddingBottom: "calc(var(--app-safe-bottom, 0px) + 1rem)" }}
      >
        {trocou ? (
          <button
            type="button"
            onClick={onFechar}
            data-testid="mensal-heroi-entendi"
            className="w-full h-14 rounded-full bg-foreground text-background text-[16px] font-semibold"
          >
            Entendi
          </button>
        ) : (
          <>
            <p data-testid="mensal-heroi-regra" className="text-[12px] text-muted-foreground text-center leading-snug px-2 mb-3">
              {regra}
            </p>
            {erro && <p role="alert" className="text-[13px] text-destructive text-center mb-2">{erro}</p>}
            <button
              type="button"
              onClick={() => void comprar()}
              disabled={comprando}
              data-testid="mensal-heroi-cta"
              className="w-full h-14 rounded-full bg-foreground text-background text-[16px] font-semibold grid place-items-center active:scale-[0.985] transition-transform disabled:opacity-60"
            >
              {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : modo === "motivo_mensal" ? "Continuar com o mensal" : "Mudar pro mensal"}
            </button>
            <button
              type="button"
              onClick={agoraNao}
              disabled={comprando}
              data-testid="mensal-heroi-agora-nao"
              className="w-full h-11 mt-1 text-[14px] font-medium text-muted-foreground"
            >
              Agora não
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
  return typeof document !== "undefined" ? createPortal(tela, document.body) : tela;
}
