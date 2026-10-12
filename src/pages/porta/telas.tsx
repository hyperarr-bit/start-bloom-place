import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import { SELO_TOPO, SUB_TOPO, TITULO_TOPO, type Opcao } from "./conteudo";

/**
 * As peças da Porta v5 (/comece, 12/10 — o desenho da Dinzo, adaptado ao CORE):
 *   · TopoPorta: logo do CORE (o ícone do app + "CORE" como no site), PLANO GRATUITO, o título e a linha de
 *     baixo. IGUAL em todos os passos (o topo não se mexe; só o card troca);
 *   · CardPorta: o card branco onde tudo acontece (barra de progresso fina magenta + voltar quadradinho);
 *   · PerguntaPorta (1 toque avança) e PerguntaMulti (círculo à direita + "Continuar");
 *   · BotaoCard: o botão principal DENTRO do card (sem rodapé fixo, como na Dinzo).
 * Cores do CORE: grafite #16121c no texto/botões, magenta #d22d80 no selo/progresso/✓, Inter herdada.
 */
export const GRAFITE = "#16121c";
export const MAGENTA = "#d22d80";
/** O ícone do app (o mesmo do manifest/PWA e da App Store: public/icon-192.png, 5 KB). Não é desenho novo. */
export const LOGO_PORTA = "/icon-192.png";

export function TopoPorta() {
  return (
    <header className="flex flex-col items-center text-center" data-testid="porta-topo">
      <div className="flex items-center gap-2" data-testid="porta-logo-linha">
        <img
          src={LOGO_PORTA} alt="" width={30} height={30} decoding="async"
          className="w-[30px] h-[30px] rounded-[8px] border border-[#e6e3e9] bg-white"
          data-testid="porta-logo"
        />
        <span className="text-[22px] font-black tracking-[-0.03em] leading-none text-[#16121c]">CORE</span>
      </div>
      <p className="mt-[18px] text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: MAGENTA }} data-testid="porta-selo">{SELO_TOPO}</p>
      <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.035em] leading-[1.08] text-balance max-w-[320px]" data-testid="porta-titulo">{TITULO_TOPO}</h1>
      <p className="mt-2.5 text-[15.5px] leading-[1.45] text-[#6b6670] max-w-[330px] text-pretty" data-testid="porta-sub">{SUB_TOPO}</p>
    </header>
  );
}

/** O card: barra de progresso (fração 0–1, null = sem barra) e o voltar (só quando há pra onde voltar). */
export function CardPorta({ progresso, onVoltar, children, passo }: {
  progresso: number | null;
  onVoltar?: () => void;
  children: ReactNode;
  passo: string;
}) {
  return (
    <section
      className="mt-[22px] rounded-[20px] border border-[#ebe8ee] bg-white px-5 pt-5 pb-6 shadow-[0_1px_2px_rgba(22,18,28,.04),0_10px_28px_-14px_rgba(22,18,28,.14)]"
      data-testid="porta-card"
    >
      {progresso != null && (
        <div className={`flex items-center gap-3 ${onVoltar ? "h-8" : "h-1.5"}`} data-testid="porta-barra">
          {onVoltar && (
            <button
              type="button" onClick={onVoltar} aria-label="Voltar" data-testid="porta-voltar"
              className="grid place-items-center w-8 h-8 shrink-0 rounded-[9px] border border-[#e3e0e6] bg-white text-[#16121c] active:bg-[#f3f1f5]"
            >
              <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </button>
          )}
          <div className="flex-1 h-[5px] rounded-full bg-[#efedf1] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progresso * 100)}>
            <motion.div className="h-full rounded-full" style={{ background: MAGENTA }} initial={false} animate={{ width: `${Math.round(progresso * 100)}%` }} transition={{ duration: 0.35, ease: "easeOut" }} />
          </div>
        </div>
      )}
      {/* a transição é só DENTRO do card: o topo da página não se mexe */}
      <motion.div key={passo} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
        {children}
      </motion.div>
    </section>
  );
}

export function TituloCard({ children, testid = "porta-pergunta", className = "" }: { children: ReactNode; testid?: string; className?: string }) {
  return <h2 className={`text-[22px] font-extrabold tracking-[-0.025em] leading-[1.2] text-[#16121c] text-balance ${className}`} data-testid={testid}>{children}</h2>;
}

const OPCAO = "w-full min-h-[52px] flex items-center gap-3 rounded-[12px] border px-4 py-3 text-left text-[16px] font-medium leading-snug text-[#16121c] transition-colors";
const OPCAO_ON = "border-[#16121c] bg-[#f5f3f7]";
const OPCAO_OFF = "border-[#e3e0e6] bg-white active:bg-[#f5f3f7] active:border-[#c9c4ce]";

/** Uma pergunta de 1 toque: o toque marca (dá pra ver) e avança. */
export function PerguntaPorta({ titulo, sub, opcoes, onEscolher, testid, inicial = null }: {
  titulo: string;
  sub?: ReactNode;
  opcoes: Opcao[];
  onEscolher: (o: Opcao) => void;
  testid: string;
  /** a resposta já dada (voltou pra cá) */
  inicial?: string | null;
}) {
  const [sel, setSel] = useState<string | null>(inicial);
  const indo = useRef(false);
  const escolher = (o: Opcao) => {
    if (indo.current) return;
    indo.current = true;
    setSel(o.id);
    window.setTimeout(() => onEscolher(o), 170);
  };
  return (
    <div className="mt-6" data-testid={testid}>
      <TituloCard>{titulo}</TituloCard>
      {sub && <p className="mt-1.5 text-[15px] leading-snug text-[#6b6670]" data-testid="porta-pergunta-sub">{sub}</p>}
      <div className="mt-[18px] flex flex-col gap-2.5" role="list">
        {opcoes.map((o) => {
          const on = sel === o.id;
          return (
            <button
              key={o.id} type="button" role="listitem" aria-pressed={on} onClick={() => escolher(o)}
              data-testid={`porta-opcao-${o.id}`} data-on={on ? "" : undefined}
              className={`${OPCAO} ${on ? OPCAO_ON : OPCAO_OFF}`}
            >
              <span className="flex-1 min-w-0">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Multi-seleção: círculo à direita, "Continuar" no card (ativo com pelo menos 1 marcada). */
export function PerguntaMulti({ titulo, sub, opcoes, inicial, alternar, onContinuar, testid }: {
  titulo: string;
  sub?: ReactNode;
  opcoes: Opcao[];
  inicial: string[];
  /** a regra de marcar/desmarcar (ex.: "Não organizo" é exclusiva) */
  alternar: (sel: string[], id: string) => string[];
  onContinuar: (ids: string[]) => void;
  testid: string;
}) {
  const [sel, setSel] = useState<string[]>(inicial);
  return (
    <div className="mt-6" data-testid={testid}>
      <TituloCard>{titulo}</TituloCard>
      {sub && <p className="mt-1.5 text-[15px] leading-snug text-[#6b6670]" data-testid="porta-pergunta-sub">{sub}</p>}
      <div className="mt-[18px] flex flex-col gap-2.5" role="list">
        {opcoes.map((o) => {
          const on = sel.includes(o.id);
          return (
            <button
              key={o.id} type="button" role="listitem" aria-pressed={on} onClick={() => setSel((s) => alternar(s, o.id))}
              data-testid={`porta-opcao-${o.id}`} data-on={on ? "" : undefined}
              className={`${OPCAO} ${on ? OPCAO_ON : OPCAO_OFF}`}
            >
              <span className="flex-1 min-w-0">{o.label}</span>
              <span
                className={`grid place-items-center w-[22px] h-[22px] shrink-0 rounded-full border-[1.5px] transition-colors ${on ? "text-white" : "border-[#cfcad4] bg-white"}`}
                style={on ? { background: MAGENTA, borderColor: MAGENTA } : undefined}
                aria-hidden data-testid={`porta-circulo-${o.id}`}
              >
                {on && <Check className="w-3.5 h-3.5" strokeWidth={3.2} />}
              </span>
            </button>
          );
        })}
      </div>
      <BotaoCard texto="Continuar" disabled={sel.length === 0} onClick={() => onContinuar(sel)} testid="porta-continuar" className="mt-4" />
    </div>
  );
}

/** O botão principal dentro do card (grafite, 52 px). `href` vira <a> (link pra loja tem que ser link de verdade). */
export function BotaoCard({ texto, onClick, href, disabled, testid, className = "", icone }: {
  texto: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  testid: string;
  className?: string;
  icone?: ReactNode;
}) {
  const cls = `w-full h-[52px] rounded-[12px] flex items-center justify-center gap-2 text-[16px] font-semibold text-white no-underline transition-[transform,opacity] active:scale-[.985] disabled:opacity-40 disabled:active:scale-100 ${className}`;
  if (href && !disabled) return <a href={href} onClick={onClick} className={cls} style={{ background: GRAFITE }} data-testid={testid}>{icone}{texto}</a>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls} style={{ background: GRAFITE }} data-testid={testid}>{icone}{texto}</button>;
}
