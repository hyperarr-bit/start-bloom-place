import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { SelosDasLojas } from "@/components/site/SelosDasLojas";
import { EVENTO_MISSAO_WEB, lerMissaoWeb, type EstadoMissaoWeb } from "@/lib/missao-web";
import "./baixar-app-popup.css";

/**
 * "BAIXE O APP PRA RECEBER OS LEMBRETES" (dono, 18/10) — na WEB do funil da missão, toda pergunta de lembrete/notificação
 * do tutorial ("Quer um lembrete de manhã?" do Montar Rotina, "Que horas te lembro?" do Plano de amanhã, o "Te lembro
 * às" da festa do dia 2) vira este pop-up. Honesto: o navegador não manda notificação; o app manda.
 *   · os selos oficiais (App Store / Google Play, pelo /baixar — o clique conta lá e no `loja_click`);
 *   · já tem e-mail (pagou e salvou): "Entre com este e-mail: …"; antes de pagar: "depois é só entrar com a sua conta";
 *   · "Agora não" segue o tutorial sem travar (quem chama decide o que "seguir" quer dizer ali).
 * Mesma cara do resto do funil: branco, Inter, grafite, sem o ponto rosa.
 */
export function BaixarAppPopup({ contexto, onAgoraNao, depoisDaOferta = false, antes }: {
  contexto: "rotina" | "plano_amanha" | "festa_dia2";
  onAgoraNao: () => void;
  /** só aparece depois que ela pagou e tocou "Continuar minha missão" (o plano de amanhã monta por baixo da oferta) */
  depoisDaOferta?: boolean;
  /** 1.0.17: uma linha de fechamento em cima do título (o "Dia 1 feito 💛" do plano de amanhã na web) */
  antes?: string;
}) {
  // o estado do funil muda com o pop-up já montado (o e-mail entra depois de pagar): relê a cada mudança
  const [web, setWeb] = useState<EstadoMissaoWeb | null>(() => lerMissaoWeb());
  useEffect(() => {
    const reler = () => setWeb(lerMissaoWeb());
    window.addEventListener(EVENTO_MISSAO_WEB, reler);
    return () => window.removeEventListener(EVENTO_MISSAO_WEB, reler);
  }, []);
  const email = web?.email ?? null;
  const visivel = !depoisDaOferta || !!web?.continuou;
  useEffect(() => {
    if (!visivel) return;
    trackEvent("missao_web_lembrete_popup", { acao: "view", contexto, com_email: !!email, missao_session_id: lerMissaoWeb()?.sessao ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);
  if (!visivel) return null;
  return createPortal(
    <div className="bap-fundo" role="dialog" aria-modal="true" aria-labelledby="bap-titulo" data-testid="baixar-app-popup" data-contexto={contexto} data-camada-guia="missao-lembrete-app">
      <div className="bap-folha">
        <div className="bap-icone" aria-hidden><Bell size={24} strokeWidth={2.4} /></div>
        {antes && <p className="bap-antes" data-testid="baixar-app-antes" style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{antes}</p>}
        <h2 id="bap-titulo">Baixe o app pra receber os lembretes</h2>
        <p>O navegador não manda notificação. No app do CORE, o lembrete chega na hora que você escolher.</p>
        <SelosDasLojas onde={`missao_lembrete_${contexto}`} prefixo="web" altura={46} className="bap-selos" />
        {email ? (
          <div className="bap-email" data-testid="baixar-app-email">
            <span>Entre com este e-mail:</span>
            <b>{email}</b>
          </div>
        ) : (
          <p className="bap-depois" data-testid="baixar-app-depois">Depois é só entrar com a sua conta.</p>
        )}
        <button type="button" className="bap-agora-nao" data-testid="baixar-app-agora-nao" onClick={() => {
          trackEvent("missao_web_lembrete_popup", { acao: "agora_nao", contexto, com_email: !!email, missao_session_id: lerMissaoWeb()?.sessao ?? null });
          onAgoraNao();
        }}>Agora não</button>
      </div>
    </div>,
    document.body,
  );
}
