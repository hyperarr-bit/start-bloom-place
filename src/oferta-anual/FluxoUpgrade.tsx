import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import {
  OFERTA_DOWN_VITALICIO, OFERTA_UP_VITALICIO, VALOR_ANUAL_REAIS, VALOR_DOWN_REAIS, VALOR_UP_REAIS,
  aoAceitar, aoPagar, aoRecusar, aoVoltarDoPix, gravarEstadoUpgrade, landingDaOferta, lerEstadoUpgrade, marcarEtapaOferta,
  resultadoDoUpgrade, type EstadoUpgrade, type ResultadoUpgrade,
} from "@/lib/oferta-anual";
import { PixHoje, PixIcone, type PixSalvo } from "@/pages/hoje/PixHoje";
import { preco } from "@/pages/hoje/conteudo";
import { Etiqueta, GraficoPraSempre } from "@/pages/hoje/UpsellAnimado";
import "@/pages/hoje/funil-hoje.css";
import "./oferta-anual.css";

/**
 * O UPGRADE PRO VITALÍCIO da oferta "anual" do /inicio (26/10) — por cima do "Pagamento confirmado" do PixCheckout,
 * logo depois do Pix do anual (R$ 27,90) cair. Regras em src/lib/oferta-anual.ts (estado puro, testado):
 *
 *   up   "Troque seu ano pelo VITALÍCIO" + R$ 47,90 → Quero → Pix (PixHoje, OFB_up47) → pago → fim "vitalicio"
 *        X ou "Não, obrigado" → down (UMA vez)
 *   down "Vitalício por + R$ 27,90" → Quero → Pix (OFB_down27) → pago → fim "vitalicio"
 *        X ou "Não, obrigado" → fim "anual" (o acesso de 1 ano + as lojas, na tela de baixo)
 *
 * O estado fica no navegador por compra (quem vai pro app do banco e volta cai na mesma tela). O Purchase de cada
 * cobrança sai com o valor real: CAPI no servidor (event_id = id do QR) + o pixel pelo firePixPurchaseOnce do PixHoje.
 * Eventos: oferta_upgrade {acao: vista|aceitou|recusou|pago, oferta, via: botao|x} + oferta_etapa (1 por aparelho).
 */
export function FluxoUpgrade({ compra, valorPago = VALOR_ANUAL_REAIS, onFim }: {
  /** o pedido do anual que abriu o fluxo (1 fluxo por compra) */
  compra: string;
  valorPago?: number;
  onFim: (r: ResultadoUpgrade) => void;
}) {
  const [e, setE] = useState<EstadoUpgrade>(() => lerEstadoUpgrade(compra));
  const set = useCallback((f: (x: EstadoUpgrade) => EstadoUpgrade) => {
    setE((x) => { const n = f(x); gravarEstadoUpgrade(n); return n; });
  }, []);
  const ids = useCallback((): Record<string, unknown> => ({ variante: "anual", landing: landingDaOferta(), compra }), [compra]);
  const evento = (acao: string, extra: Record<string, unknown> = {}) => trackEvent("oferta_upgrade", { acao, ...ids(), ...extra });

  /* vista de cada oferta (1 por chegada) + a etapa única por aparelho */
  useEffect(() => {
    if (e.etapa === "up") { evento("vista", { oferta: OFERTA_UP_VITALICIO }); marcarEtapaOferta("up_visto"); }
    if (e.etapa === "down") { evento("vista", { oferta: OFERTA_DOWN_VITALICIO }); marcarEtapaOferta("down_visto"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.etapa]);

  /* fim → devolve pro checkout (uma vez) */
  const terminou = useRef(false);
  useEffect(() => {
    if (e.etapa !== "fim" || terminou.current) return;
    terminou.current = true;
    onFim(resultadoDoUpgrade(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.etapa]);

  const ofertaAqui = e.etapa === "down" || e.etapa === "down_pix" ? OFERTA_DOWN_VITALICIO : OFERTA_UP_VITALICIO;
  const recusar = (via: "botao" | "x") => { evento("recusou", { oferta: ofertaAqui, via, etapa: e.etapa }); set(aoRecusar); };
  const aceitar = () => { evento("aceitou", { oferta: ofertaAqui }); set(aoAceitar); };

  // o X fica nas OFERTAS (no Pix tem o "Voltar" do PixHoje, que volta pra oferta — e o X cobriria a marca do topo)
  const fechar = e.etapa === "up" || e.etapa === "down" ? (
    <button type="button" className="ofa-x" aria-label="Fechar" data-testid={`ofa-${e.etapa}-x`} onClick={() => recusar("x")}>
      <X size={18} strokeWidth={2.4} />
    </button>
  ) : null;

  const confirmado = (
    <div className="ofa-confirmado" data-testid="ofa-confirmado">
      <Check size={14} strokeWidth={3.4} />Pagamento confirmado · {preco(valorPago)} · 1 ano liberado
    </div>
  );

  if (e.etapa === "up") {
    return (
      <div className="fn-tela" data-testid="ofa-up">
        {fechar}
        <div className="fn-topo"><span className="fn-marca"><i />CORE</span></div>
        {confirmado}
        <div className="fn-up">
          <div className="fn-kicker ua-entra">Só agora, antes de entrar</div>
          <h1 className="ua-entra">Troque seu ano pelo CORE <em className="ofa-em">vitalício</em></h1>
          <GraficoPraSempre plano="anual" contas={{
            entrada: VALOR_ANUAL_REAIS, porAno: VALOR_ANUAL_REAIS, upgrade: VALOR_UP_REAIS,
            nota: `* renovando = se você renovar todo ano pelo preço de hoje (${preco(VALOR_ANUAL_REAIS)}). Nada renova sozinho.`,
          }} />
          <div className="ua-preco ua-entra" style={{ animationDelay: "2.4s" }}>
            <div><b>CORE Vitalício</b><small>upgrade do seu anual · Pix</small></div>
            <strong data-testid="ofa-up-preco">+ {preco(VALOR_UP_REAIS)}</strong>
          </div>
          <p className="ua-entra ua-texto" style={{ animationDelay: "2.5s" }}>
            Você já tem 1 ano. Com mais {preco(VALOR_UP_REAIS)}, o CORE fica <b>seu pra sempre</b>: nunca mais renova, nunca mais paga.
          </p>
          <ul className="fn-inclui ua-entra" style={{ animationDelay: "2.6s", marginLeft: 0, marginRight: 0 }}>
            {["Acesso vitalício às 16 áreas", "Tudo que o CORE ganhar daqui pra frente", "No iPhone, no Android e no computador"].map((t) => (
              <li key={t}><Check size={17} strokeWidth={2.8} /><span>{t}</span></li>
            ))}
          </ul>
        </div>
        <div className="fn-rodape">
          <button type="button" className="fn-cta" onClick={aceitar} data-testid="ofa-up-sim"><PixIcone /><span>Quero o vitalício · + {preco(VALOR_UP_REAIS)}</span></button>
          <button type="button" className="fn-link" onClick={() => recusar("botao")} data-testid="ofa-up-nao"><u>Não, obrigado</u></button>
        </div>
      </div>
    );
  }

  if (e.etapa === "down") {
    return (
      <div className="fn-tela" data-testid="ofa-down">
        {fechar}
        <div className="fn-topo"><span className="fn-marca"><i />CORE</span></div>
        <div className="fn-up">
          <div className="fn-kicker ua-entra">Última chance · só nesta tela</div>
          <h1 className="ua-entra">Vitalício por + {preco(VALOR_DOWN_REAIS)}</h1>
        </div>
        <Etiqueta de={VALOR_UP_REAIS} por={VALOR_DOWN_REAIS} nome="CORE Vitalício" />
        <div className="fn-up" style={{ paddingTop: 14 }}>
          <p className="ua-entra" style={{ animationDelay: "1.9s" }}>
            Em vez de + {preco(VALOR_UP_REAIS)}, o mesmo vitalício por + {preco(VALOR_DOWN_REAIS)}. Esta oferta <b>não aparece de novo</b> depois desta tela.
          </p>
          <ul className="fn-inclui ua-entra" style={{ animationDelay: "2s", marginLeft: 0, marginRight: 0 }}>
            {["Seu ano vira pra sempre", "Nunca mais renova, nunca mais paga"].map((t) => (
              <li key={t}><Check size={17} strokeWidth={2.8} /><span>{t}</span></li>
            ))}
          </ul>
        </div>
        <div className="fn-rodape">
          <button type="button" className="fn-cta" onClick={aceitar} data-testid="ofa-down-sim"><PixIcone /><span>Quero por + {preco(VALOR_DOWN_REAIS)}</span></button>
          <button type="button" className="fn-link" onClick={() => recusar("botao")} data-testid="ofa-down-nao"><u>Não, obrigado — fico com 1 ano</u></button>
        </div>
      </div>
    );
  }

  if (e.etapa === "up_pix" || e.etapa === "down_pix") {
    const oferta = e.etapa === "down_pix" ? OFERTA_DOWN_VITALICIO : OFERTA_UP_VITALICIO;
    const valor = e.etapa === "down_pix" ? VALOR_DOWN_REAIS : VALOR_UP_REAIS;
    return (
      <>
        <PixHoje key={oferta} oferta={oferta} valor={valor} rotulo="CORE Vitalício · upgrade do seu anual"
          faixa={<div className="ofa-faixa">♾️ Seu ano vira <b>pra sempre</b></div>}
          pix={e.pix && (e.pix as PixSalvo).oferta === oferta ? (e.pix as PixSalvo) : null}
          onPix={(p) => {
            if (p && p.orderId !== (e.pix as PixSalvo | null)?.orderId) evento("pix_gerado", { oferta, order_id: p.orderId, valor });
            set((x) => ({ ...x, pix: p }));
          }}
          ids={ids}
          onVoltar={() => set(aoVoltarDoPix)}
          onPago={(p) => {
            evento("pago", { oferta, order_id: p.orderId, valor });
            marcarEtapaOferta(oferta === OFERTA_DOWN_VITALICIO ? "down_pago" : "up_pago", { offer: oferta, order_id: p.orderId, valor });
            set((x) => aoPagar(x, p.orderId));
          }} />
      </>
    );
  }

  return <div className="fn-tela" data-testid="ofa-fim" />;
}
