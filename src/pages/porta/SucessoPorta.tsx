import { motion } from "framer-motion";
import { Check, Mail } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppleIcon } from "./ContaPorta";
import { BotaoCard, MAGENTA, TituloCard } from "./telas";
import { PRINT_TELA_INICIAL } from "./conteudo";

/**
 * PASSO 6 DA PORTA — SUCESSO, no mesmo card (v5, 12/10; o "Conta criada / Agora é só entrar" da Dinzo).
 * Substitui o com×sem, o plano, o "Último passo" e a tela 7 antiga.
 *
 *   · um ✓ grande (círculo magenta que "pula") com confete leve — o CORE não tem mascote;
 *   · CONTA CRIADA · "Agora é só entrar" · "Baixe o CORE e toque em Entrar — sua conta já está te esperando.";
 *   · celular: botão preto da loja (/baixar, 302 pra loja do aparelho) + faixa verde "Enviamos um link de acesso
 *     no seu e-mail" (só se o e-mail com o código saiu) + "Abrindo a App Store…" enquanto a loja vai abrir
 *     sozinha (o pai conta; 1x por sessão; qualquer toque cancela);
 *   · computador: o QR do /baixar no lugar do botão (sem abrir loja sozinho);
 *   · voltou da loja (aba visível de novo): com código, "Abrir o CORE" (core://entrar?h=…) vira o principal e a
 *     loja vira link; sem código, a loja continua e o texto diz pra abrir o app e tocar em Entrar;
 *   · embaixo, pequeno: "No app, toque em “Entrar” — não em “Começar”." com o mini print da tela inicial.
 * "3 dias grátis" NÃO aparece aqui (já foi dito na conta, só no iPhone). Nunca preço.
 */
export type Plataforma = "ios" | "android" | "web";

export const TITULO_SUCESSO = "Agora é só entrar";
/** (o espaço antes do travessão é inquebrável: a linha de baixo nunca começa com "—") */
export const TEXTO_SUCESSO = "Baixe o CORE e toque em Entrar\u00a0— sua conta já está te esperando.";
export const AVISO_EMAIL = "Enviamos um link de acesso no seu e-mail";
export const DICA_ENTRAR = "No app, toque em “Entrar”\u00a0— não em “Começar”.";

/** a 2ª linha da dica: o botão do jeito que a conta foi criada (na tela de entrar do app) */
const DEPOIS: Record<string, string> = {
  apple: "Depois, “Continuar com a Apple”.",
  google: "Depois, “Continuar com Google”.",
  senha: "Depois, seu e-mail e a senha que você criou.",
};

const CONFETE = [
  { x: -78, y: -46, c: MAGENTA, r: 20 }, { x: -60, y: 8, c: "#f0a500", r: -30 }, { x: -86, y: -8, c: "#3f9b5b", r: 45 },
  { x: -40, y: -64, c: "#7c5cff", r: 10 }, { x: 44, y: -62, c: "#f0a500", r: -15 }, { x: 80, y: -40, c: MAGENTA, r: 35 },
  { x: 64, y: 10, c: "#3f9b5b", r: -40 }, { x: 88, y: -6, c: "#7c5cff", r: 60 }, { x: -20, y: -74, c: "#3f9b5b", r: 0 },
  { x: 22, y: -76, c: MAGENTA, r: 25 }, { x: -70, y: 34, c: "#7c5cff", r: -20 }, { x: 72, y: 36, c: "#f0a500", r: 50 },
];

export function SeloConta() {
  return (
    <div className="relative mx-auto w-[150px] h-[104px] grid place-items-center" aria-hidden data-testid="porta-sucesso-check">
      {CONFETE.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 w-[7px] h-[10px] rounded-[2px]"
          style={{ background: p.c, marginLeft: -3.5, marginTop: -5 }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.4 }}
          animate={{ x: p.x, y: p.y, opacity: [0, 1, 1, 0.85], rotate: p.r * 3, scale: 1 }}
          transition={{ delay: 0.28 + (i % 4) * 0.03, duration: 0.9, ease: "easeOut" }}
        />
      ))}
      <motion.div
        className="relative grid place-items-center w-[72px] h-[72px] rounded-full text-white shadow-[0_12px_26px_-10px_rgba(210,45,128,.65)]"
        style={{ background: MAGENTA }}
        initial={{ scale: 0.4, y: 10, opacity: 0 }}
        animate={{ scale: [0.4, 1.12, 0.96, 1], y: [10, -10, 0, 0], opacity: 1 }}
        transition={{ duration: 0.7, times: [0, 0.45, 0.75, 1], ease: "easeOut" }}
      >
        <Check className="w-9 h-9" strokeWidth={3.2} />
      </motion.div>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="16" height="17" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
    <path d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
  </svg>
);

/** o botão preto da loja, no formato do selo da Apple/Google ("Baixar na" pequeno em cima) */
export function BotaoLoja({ android, href, onClick, testid = "porta-loja" }: { android: boolean; href: string; onClick: () => void; testid?: string }) {
  return (
    <a
      href={href} onClick={onClick} data-testid={testid}
      className="mt-5 inline-flex items-center justify-center gap-2.5 h-[58px] min-w-[232px] px-7 rounded-[13px] bg-black text-white no-underline active:scale-[.985] transition-transform"
    >
      {android ? <PlayIcon /> : <span className="scale-[1.35]"><AppleIcon /></span>}
      <span className="flex flex-col items-start leading-none text-left">
        <span className="text-[11px] font-medium opacity-80">{android ? "Baixar no" : "Baixar na"}</span>
        <span className="text-[19px] font-semibold tracking-[-0.01em] mt-[3px]">{android ? "Google Play" : "App Store"}</span>
      </span>
    </a>
  );
}

export function SucessoPorta({ plataforma, metodo, voltou, abrindo, emailEnviado, abrirApp, hrefLoja, qrUrl, onLoja, onAbrirApp }: {
  plataforma: Plataforma;
  metodo: string;
  voltou: boolean;
  /** a loja vai abrir sozinha (contagem rodando) */
  abrindo: boolean;
  /** o e-mail com o código do "abrir logado" saiu */
  emailEnviado: boolean;
  /** core://entrar?h=<código> — null sem código (ou fora do iPhone) */
  abrirApp: string | null;
  hrefLoja: (loja: "ios" | "android" | null) => string;
  qrUrl: string;
  onLoja: (loja: "ios" | "android") => void;
  onAbrirApp: (onde: "principal") => void;
}) {
  const android = plataforma === "android";
  const web = plataforma === "web";
  const loja = android ? "Google Play" : "App Store";
  const lojaId = android ? "android" : "ios";
  const depois = DEPOIS[metodo] ?? null;

  return (
    <div className="pt-2 text-center" data-testid="porta-sucesso" data-plataforma={plataforma} data-voltou={voltou ? "" : undefined}>
      <SeloConta />
      <p className="mt-3 text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: MAGENTA }} data-testid="porta-sucesso-selo">Conta criada</p>
      <TituloCard testid="porta-sucesso-titulo" className="mt-1.5 text-[26px]">{TITULO_SUCESSO}</TituloCard>
      <p className="mt-2 text-[15.5px] leading-[1.45] text-[#6b6670] text-pretty" data-testid="porta-sucesso-texto">
        {web
          ? "Aponte a câmera do celular pro código, baixe o CORE e toque em Entrar\u00a0— sua conta já está te esperando."
          : voltou && !abrirApp
            ? "Já baixou? Abra o CORE e toque em Entrar\u00a0— sua conta já está te esperando."
            : TEXTO_SUCESSO}
      </p>

      {web ? (
        <div className="mx-auto mt-5 w-fit rounded-[14px] border border-[#ebe8ee] bg-white p-3" data-testid="porta-qr">
          <QRCodeSVG value={qrUrl} size={148} level="M" />
        </div>
      ) : voltou && abrirApp ? (
        <>
          <BotaoCard texto="Abrir o CORE" href={abrirApp} onClick={() => onAbrirApp("principal")} testid="porta-abrir-app" className="mt-5" />
          <a href={hrefLoja(null)} onClick={() => onLoja(lojaId)} className="mt-2 flex items-center justify-center h-10 text-[14px] text-[#6b6670] no-underline" data-testid="porta-loja" data-secundario="">
            <span>Ainda não baixou? <b className="text-[#16121c]">{loja}</b></span>
          </a>
        </>
      ) : (
        <BotaoLoja android={android} href={hrefLoja(null)} onClick={() => onLoja(lojaId)} />
      )}

      {emailEnviado && !web && (
        <p className="mx-auto mt-4 flex w-fit max-w-full items-center justify-center gap-2.5 rounded-[14px] bg-[#e8f5ec] px-4 py-2.5 text-left text-[13.5px] font-semibold leading-snug text-[#1f6b3a]" data-testid="porta-sucesso-email">
          <Mail className="w-4 h-4 shrink-0" strokeWidth={2.2} aria-hidden /><span className="text-balance">{AVISO_EMAIL}</span>
        </p>
      )}

      {abrindo && !web && (
        <p className="mt-3.5 text-[14px] text-[#8a8490]" data-testid="porta-sucesso-abrindo" aria-live="polite">Abrindo a {loja}…</p>
      )}

      <div className="mt-5 pt-4 border-t border-[#efedf1] flex items-center gap-3 text-left" data-testid="porta-sucesso-dica">
        <div className="w-[46px] shrink-0 rounded-[9px] border-[2.5px] border-[#16121c] bg-[#16121c] overflow-hidden">
          <img src={PRINT_TELA_INICIAL[android ? "android" : "ios"]} alt="" width={390} height={844} loading="lazy" className="block w-full h-auto rounded-[6px]" data-testid="porta-sucesso-print" />
        </div>
        <p className="text-[13.5px] leading-snug text-[#4f4a55]">
          <span className="block font-semibold text-[#16121c]">{DICA_ENTRAR}</span>
          {depois && <span className="block mt-0.5" data-testid="porta-sucesso-depois">{depois}</span>}
        </p>
      </div>
    </div>
  );
}
