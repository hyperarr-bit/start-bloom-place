import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, QrCode, ShieldCheck } from "lucide-react";
import { BotaoDoFunil } from "@/pages/funis/w/BotaoDoFunil";
import {
  AGORA_NAO, BOTAO_PIX, D24_BOTAO, D24_SELO, D24_SUB, D24_TITULO, D69_BOTAO, D69_LEGAL, D69_SELO, D69_SUB, D69_TITULO, GARANTIA,
  MENSAL_SEM_RENOVACAO, OFERTAS, PAYWALL_LEGAL, PAYWALL_SUB, PAYWALL_TITULO, porMes,
} from "./conteudo";

/**
 * O PAYWALL DA WEB do funil do app (/assinatura, 16/10) — a única tela que NÃO é a do app: no iPhone é a folha da
 * Apple com teste grátis; aqui é Pix, com a escada de presentes.
 *
 *   PaywallWeb   anual R$ 97,90 (R$ 8,16/mês), no desenho do paywall curto da 1.0.15: a foto do app sangrando no topo
 *                com o Voltar redondo, o título, o card do plano com a faixa preta, os 3 itens e o botão no rodapé fixo
 *                do funil ("Pagar com Pix") com "Agora não" logo acima.
 *   PresenteWeb  os degraus: 69 (o mesmo anual por R$ 69,90, "presente · só agora", preço de 97,90 riscado) e 24 (1 mês
 *                por R$ 24,90, com a frase "30 dias de acesso, sem renovação automática — pra continuar, é só pagar de
 *                novo" em destaque). Mesmo Voltar redondo e mesmo rodapé.
 * O Voltar redondo e o "Agora não" são a RECUSA (quem decide o próximo degrau é a página). Nunca "sem cartão".
 */
const MAGENTA = "#d22d80";

function Voltar({ onClick, testid }: { onClick: () => void; testid: string }) {
  return (
    <button
      type="button" aria-label="Voltar" data-testid={testid} onClick={onClick}
      className="absolute top-3 left-4 z-10 w-11 h-11 rounded-full bg-white text-[#16121c] shadow-[0_2px_12px_rgba(0,0,0,0.18)] grid place-items-center active:scale-95 transition-transform"
    >
      <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
    </button>
  );
}

const Item = ({ children }: { children: ReactNode }) => (
  <li className="flex items-start gap-2.5 text-[14px] leading-snug text-[#3d3842]">
    <span className="shrink-0 mt-[1px] grid place-items-center w-[18px] h-[18px] rounded-full text-white" style={{ background: MAGENTA }} aria-hidden>
      <Check className="w-3 h-3" strokeWidth={3.4} />
    </span>
    <span>{children}</span>
  </li>
);

const ITENS = [
  "Seu plano de 3 dias pronto no app",
  "Dinheiro, rotina, treino, saúde e metas num lugar só",
  "No iPhone, no Android e no computador",
];

/* ------------------------------------------------------------------ degrau 97 */
export function PaywallWeb({ onPagar, onRecusar, ocupado = false }: {
  onPagar: () => void;
  /** Voltar redondo ou "Agora não" */
  onRecusar: (via: "voltar" | "agora_nao") => void;
  ocupado?: boolean;
}) {
  const o = OFERTAS.a97;
  return (
    <div className="relative w-full flex-1 flex flex-col" data-testid="app-web-paywall" data-degrau="97">
      <div className="relative h-[clamp(150px,32dvh,300px)] shrink-0 -mx-5 -mt-4 overflow-hidden bg-[#f6f6f7]" data-testid="app-web-paywall-hero">
        <img src="/paywall-hero.jpg" alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover object-top select-none scale-[1.07] origin-top" />
        <div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-white via-white/85 to-transparent" aria-hidden />
        <Voltar onClick={() => onRecusar("voltar")} testid="app-web-paywall-voltar" />
      </div>

      <div className="max-w-sm w-full mx-auto flex flex-col">
        <h1 className="text-center text-[26px] font-black tracking-[-0.02em] leading-[1.12] text-[#16121c] -mt-1" data-testid="app-web-paywall-titulo">{PAYWALL_TITULO}</h1>
        <p className="mt-1.5 text-center text-[14px] leading-snug text-[#6b6670]">{PAYWALL_SUB}</p>

        <div className="mt-4 rounded-2xl overflow-hidden border-[2.5px] border-[#16121c] bg-white" data-testid="app-web-plano-97">
          <div className="text-center text-[12px] font-extrabold tracking-[0.1em] py-[6px] bg-[#16121c] text-white">MAIS ESCOLHIDO · 1 ANO DE ACESSO</div>
          <div className="flex items-center gap-3 px-3.5 py-3 text-[#16121c]">
            <span className="w-6 h-6 rounded-full grid place-items-center shrink-0 bg-[#16121c] text-white" aria-hidden><Check className="w-3.5 h-3.5" strokeWidth={3.5} /></span>
            <span className="flex-1 min-w-0">
              <b className="block text-[15.5px] font-bold leading-tight">Anual</b>
              <span className="block text-[12.5px] text-black/55 mt-0.5" data-testid="app-web-preco-97">R$ {o.preco} no Pix, uma vez só</span>
            </span>
            <span className="text-[14.5px] font-bold shrink-0" data-testid="app-web-por-mes-97">R$ {porMes(o.valor)}<span className="font-semibold text-black/55">/mês</span></span>
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {ITENS.map((t) => <Item key={t}>{t}</Item>)}
        </ul>

        <p className="mt-4 text-center text-[12px] leading-snug text-[#8a8490]" data-testid="app-web-paywall-legal">{PAYWALL_LEGAL}</p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-[#8a8490]"><ShieldCheck className="w-3.5 h-3.5" aria-hidden />{GARANTIA}</p>
      </div>

      <BotaoDoFunil
        texto={<><QrCode className="w-[18px] h-[18px]" strokeWidth={2.2} aria-hidden /> {BOTAO_PIX}</>}
        seta={false} onClick={onPagar} disabled={ocupado} testid="app-web-pagar-97"
        secundario={{ texto: AGORA_NAO, onClick: () => onRecusar("agora_nao"), disabled: ocupado, testid: "app-web-agora-nao-97" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ degraus 69 e 24 (os presentes) */
export function PresenteWeb({ degrau, onAceitar, onRecusar, ocupado = false }: {
  degrau: 69 | 24;
  onAceitar: () => void;
  onRecusar: (via: "voltar" | "agora_nao") => void;
  ocupado?: boolean;
}) {
  const anual = degrau === 69;
  const o = anual ? OFERTAS.a69 : OFERTAS.w25;
  const de = OFERTAS.a97;
  const desconto = Math.round((1 - o.valor / de.valor) * 100);
  return (
    <div className="relative w-full flex-1 flex flex-col pt-12" data-testid="app-web-presente" data-degrau={degrau}>
      {/* o Voltar no MESMO lugar do paywall (que sangra a foto até a borda: -mx-5 -mt-4) */}
      <div className="absolute top-0 left-0 right-0 -mx-5 -mt-4 h-0"><Voltar onClick={() => onRecusar("voltar")} testid="app-web-presente-voltar" /></div>

      <div className="max-w-sm w-full mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="grid place-items-center w-[84px] h-[84px] rounded-[26px] text-[44px] leading-none shadow-[0_18px_36px_-16px_rgba(210,45,128,.55)]"
          style={{ background: anual ? "#16121c" : "#fdf2f8" }}
          aria-hidden
        >
          {anual ? "🎁" : "🌱"}
        </motion.div>
        <p className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.14em]" style={{ color: MAGENTA }} data-testid="app-web-presente-selo">{anual ? D69_SELO : D24_SELO}</p>
        <h1 className="mt-1.5 text-[26px] font-black tracking-[-0.02em] leading-[1.12] text-[#16121c] text-balance" data-testid="app-web-presente-titulo">{anual ? D69_TITULO : D24_TITULO}</h1>
        <p className="mt-2 text-[14.5px] leading-snug text-[#6b6670] text-pretty">{anual ? D69_SUB : D24_SUB}</p>

        <div className="relative mt-5 w-full rounded-2xl border-[2.5px] border-[#16121c] bg-white px-4 pt-4 pb-3.5 text-left" data-testid={`app-web-plano-${degrau}`}>
          {anual && (
            <span className="absolute -top-[11px] right-4 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold uppercase tracking-[0.08em] text-white" style={{ background: MAGENTA }} data-testid="app-web-desconto">−{desconto}%</span>
          )}
          <p className="text-[15px] font-bold text-[#16121c]">{anual ? "Anual" : "Mensal"}</p>
          <p className="mt-0.5 flex items-baseline gap-2 flex-wrap">
            {anual && <span className="text-[16px] font-semibold text-[#a9a3af] line-through" data-testid="app-web-preco-de">R$ {de.preco}</span>}
            <span className="text-[32px] font-extrabold tracking-[-0.03em] leading-none text-[#16121c]" data-testid={`app-web-preco-${degrau}`}>R$ {o.preco}</span>
            <span className="text-[14px] text-[#6b6670]">{anual ? "por ano" : "por 30 dias"}</span>
          </p>
          <p className="mt-1 text-[13.5px] text-[#6b6670]">
            {anual
              ? <>equivale a <b className="text-[#16121c]">R$ {porMes(o.valor)}/mês</b> · 1 ano de acesso</>
              : <>Pagamento único no Pix · <b className="text-[#16121c]">30 dias de acesso</b></>}
          </p>
        </div>

        {anual ? (
          <p className="mt-3 text-[12px] leading-snug text-[#8a8490]" data-testid="app-web-presente-legal">{D69_LEGAL}</p>
        ) : (
          <p className="mt-3 w-full rounded-xl border border-[#f3d9a4] bg-[#fff8e6] px-3.5 py-2.5 text-left text-[13.5px] font-semibold leading-snug text-[#6b4a07]" data-testid="app-web-sem-renovacao">
            {MENSAL_SEM_RENOVACAO}
          </p>
        )}
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-[#8a8490]"><ShieldCheck className="w-3.5 h-3.5" aria-hidden />{GARANTIA}</p>
      </div>

      <BotaoDoFunil
        texto={<><QrCode className="w-[18px] h-[18px]" strokeWidth={2.2} aria-hidden /> {anual ? D69_BOTAO : D24_BOTAO}</>}
        seta={false} onClick={onAceitar} disabled={ocupado} testid={`app-web-aceitar-${degrau}`}
        secundario={{ texto: AGORA_NAO, onClick: () => onRecusar("agora_nao"), disabled: ocupado, testid: `app-web-agora-nao-${degrau}` }}
      />
    </div>
  );
}
