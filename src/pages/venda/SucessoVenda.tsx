import { Mail } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { BotaoLoja, SeloConta, type Plataforma } from "@/pages/porta/SucessoPorta";
import { BotaoCard, MAGENTA, TituloCard } from "@/pages/porta/telas";
import { PRINT_TELA_INICIAL } from "@/pages/porta/conteudo";
import { DICA_CODIGO, DICA_ENTRAR_VENDA, PLANOS, SUCESSO_SELO, SUCESSO_TITULO, type PlanoVenda } from "./conteudo";

/**
 * SUCESSO DA VENDA (/assinar, 15/10) — no mesmo card, com a cara do sucesso da Porta (✓ magenta com confete):
 *   · PAGAMENTO CONFIRMADO · "Seu CORE está liberado" · "Baixe o app e entre com este e-mail:" + o e-mail;
 *   · celular: o botão preto da loja do aparelho (/baixar → 302); computador: o QR do /baixar;
 *   · iPhone com o código do porta-handoff (24 h, 1 uso): "Abrir o CORE" (core://entrar?h=…) abre o app JÁ LOGADO —
 *     aparece quando a pessoa volta da loja (aba visível de novo), como na Porta;
 *   · a dica: no app, "Entrar" (não "Começar") → "Entrar sem senha" com o código do e-mail (a conta da venda não
 *     tem senha);
 *   · `confirmado=false`: voltou da Cakto num navegador sem a sessão (o Instagram apaga o storage) — não dá pra
 *     conferir daqui; o texto diz pra entrar com o e-mail que usou no pagamento.
 */
export function SucessoVenda({ plataforma, email, plano, confirmado, jaAssinante = false, voltou, abrirApp, emailEnviado, fimDoAcesso, hrefLoja, qrUrl, onLoja, onAbrirApp, planoTexto }: {
  plataforma: Plataforma;
  email: string | null;
  plano: PlanoVenda;
  confirmado: boolean;
  /** 15/10: a conta já era assinante — nada foi cobrado agora */
  jaAssinante?: boolean;
  voltou: boolean;
  abrirApp: string | null;
  emailEnviado: boolean;
  /** dd/mm/aaaa do fim do acesso (check-subscription), quando houver */
  fimDoAcesso: string | null;
  hrefLoja: (loja: "ios" | "android" | null) => string;
  qrUrl: string;
  onLoja: (loja: "ios" | "android") => void;
  onAbrirApp: () => void;
  /** 16/10 (o funil do app na web): a linha do plano pronta ("Mensal · 30 dias, até … · sem renovação automática");
   *  sem ela, a do /assinar ("Plano anual · acesso até …") */
  planoTexto?: string | null;
}) {
  const android = plataforma === "android";
  const web = plataforma === "web";
  const loja = android ? "Google Play" : "App Store";
  const lojaId = android ? "android" : "ios";
  return (
    <div className="pt-2 text-center" data-testid="venda-sucesso" data-plataforma={plataforma} data-confirmado={confirmado ? "" : undefined}>
      <SeloConta />
      <p className="mt-3 text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: MAGENTA }} data-testid="venda-sucesso-selo">
        {jaAssinante ? "Você já é assinante" : confirmado ? SUCESSO_SELO : "Pagamento no cartão"}
      </p>
      <TituloCard testid="venda-sucesso-titulo" className="mt-1.5 text-[26px]">{jaAssinante ? "Seu CORE já está liberado" : confirmado ? SUCESSO_TITULO : "Agora é só entrar no app"}</TituloCard>
      {jaAssinante && (
        <p className="mt-1.5 text-[14px] text-[#6b6670]" data-testid="venda-sucesso-plano">
          Não precisa pagar de novo{fimDoAcesso ? <> · acesso até <b className="text-[#16121c]">{fimDoAcesso}</b></> : null}.
        </p>
      )}
      {confirmado && !jaAssinante && (
        <p className="mt-1.5 text-[14px] text-[#6b6670]" data-testid="venda-sucesso-plano">
          {planoTexto ?? <>Plano {PLANOS[plano].nome.toLowerCase()}{fimDoAcesso ? <> · acesso até <b className="text-[#16121c]">{fimDoAcesso}</b></> : null}</>}
        </p>
      )}
      <p className="mt-3 text-[15.5px] leading-[1.45] text-[#6b6670] text-pretty" data-testid="venda-sucesso-texto">
        {web ? "Aponte a câmera do celular pro código, baixe o CORE e entre com este e-mail:" : confirmado ? "Baixe o app e entre com este e-mail:" : "Baixe o app e entre com o e-mail que você usou no pagamento."}
      </p>
      {email && (
        <p className="mx-auto mt-2 w-fit max-w-full rounded-[12px] border border-[#e3e0e6] bg-[#faf9fb] px-4 py-2 text-[16px] font-bold text-[#16121c] break-all" data-testid="venda-sucesso-email">{email}</p>
      )}

      {web ? (
        <div className="mx-auto mt-5 w-fit rounded-[14px] border border-[#ebe8ee] bg-white p-3" data-testid="venda-qr">
          <QRCodeSVG value={qrUrl} size={148} level="M" />
        </div>
      ) : voltou && abrirApp ? (
        <>
          <BotaoCard texto="Abrir o CORE" href={abrirApp} onClick={onAbrirApp} testid="venda-abrir-app" className="mt-5" />
          <a href={hrefLoja(null)} onClick={() => onLoja(lojaId)} className="mt-2 flex items-center justify-center h-10 text-[14px] text-[#6b6670] no-underline" data-testid="venda-loja" data-secundario="">
            <span>Ainda não baixou? <b className="text-[#16121c]">{loja}</b></span>
          </a>
        </>
      ) : (
        <BotaoLoja android={android} href={hrefLoja(null)} onClick={() => onLoja(lojaId)} testid="venda-loja" />
      )}

      {emailEnviado && !web && (
        <p className="mx-auto mt-4 flex w-fit max-w-full items-center justify-center gap-2.5 rounded-[14px] bg-[#e8f5ec] px-4 py-2.5 text-left text-[13.5px] font-semibold leading-snug text-[#1f6b3a]" data-testid="venda-sucesso-aviso-email">
          <Mail className="w-4 h-4 shrink-0" strokeWidth={2.2} aria-hidden /><span className="text-balance">Mandamos um link de acesso pro seu e-mail</span>
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-[#efedf1] flex items-center gap-3 text-left" data-testid="venda-sucesso-dica">
        <div className="w-[46px] shrink-0 rounded-[9px] border-[2.5px] border-[#16121c] bg-[#16121c] overflow-hidden">
          <img src={PRINT_TELA_INICIAL[android ? "android" : "ios"]} alt="" width={390} height={844} loading="lazy" className="block w-full h-auto rounded-[6px]" />
        </div>
        <p className="text-[13.5px] leading-snug text-[#4f4a55]">
          <span className="block font-semibold text-[#16121c]">{DICA_ENTRAR_VENDA}</span>
          <span className="block mt-0.5">{DICA_CODIGO}</span>
        </p>
      </div>
    </div>
  );
}
