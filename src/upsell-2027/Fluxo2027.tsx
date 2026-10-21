import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { SelosDasLojas } from "@/components/site/SelosDasLojas";
import {
  ITENS_2027, MESES_CURTOS, OFERTA_2027, PILULAS_2027, VALOR_2027, VERSAO_OFERTA_2027,
  gravarEstado2027, lerEstado2027, reais2027, type Estado2027, type PixDoFluxo2027, type VersaoOferta2027,
} from "@/lib/upsell-2027";
import { PixHoje, type PixSalvo } from "@/pages/hoje/PixHoje";
import type { OfertaHoje } from "@/pages/hoje/conteudo";
import { Confete2027, IlustraPlanner } from "./IlustraPlanner";
import "@/pages/hoje/funil-hoje.css";
import "./u2027.css";

/**
 * O UPSELL "SEU 2027 JÁ ORGANIZADO" na tela (21/10) — o mesmo componente no /inicio (por cima do "Pagamento
 * confirmado" do PixCheckout) e no /hoje (etapa "u2027", antes do pós-compra com as lojas). Mockups em
 * scratchpad/upsell-2027/mockups (a1 visual / a2 curta, b Pix, c pronto).
 *
 *   oferta → "Quero meu 2027 organizado" → Pix R$ 19,90 (PixHoje, oferta u2027) → pago → "Pronto, seu 2027 tá no seu
 *   CORE" (o que veio + onde fica + lojas) → "Continuar" → fim
 *   oferta → "Agora não" → fim
 * O estado fica no navegador (localStorage + heap) por compra: quem vai pro app do banco e volta cai na mesma tela.
 *
 * Eventos (todos com `origem` + `versao` + os ids do funil): u2027_oferta_view · u2027_quero · u2027_nao ·
 * u2027_pix_gerado · u2027_pago · u2027_continuar. (O PixHoje manda os dele também: hoje_pix_gerado etc.)
 */
export type Fim2027 = { pedido: string | null };

export function Fluxo2027({ origem, compra, valorPago, ids, onFim, versao = VERSAO_OFERTA_2027 }: {
  origem: "inicio" | "hoje";
  /** o pedido do vitalício que abriu o fluxo (1 fluxo por compra) */
  compra: string;
  valorPago: number;
  ids?: () => Record<string, unknown>;
  onFim: (r: Fim2027) => void;
  versao?: VersaoOferta2027;
}) {
  const [e, setE] = useState<Estado2027>(() => lerEstado2027(compra));
  const set = useCallback((f: (x: Estado2027) => Estado2027) => {
    setE((x) => { const n = f(x); gravarEstado2027(n); return n; });
  }, []);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const base = useCallback((): Record<string, unknown> => ({ origem, versao, ...(idsRef.current?.() ?? {}) }), [origem, versao]);
  const evento = (nome: string, extra: Record<string, unknown> = {}) => trackEvent(nome, { ...extra, ...base() });

  useEffect(() => {
    if (e.etapa === "oferta") evento("u2027_oferta_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.etapa]);

  /* fim → devolve pro funil (uma vez) */
  const terminou = useRef(false);
  useEffect(() => {
    if (e.etapa !== "fim" || terminou.current) return;
    terminou.current = true;
    onFim({ pedido: e.pedido });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.etapa]);

  if (e.etapa === "oferta") {
    const rodape = (
      <div className="u27-rodape">
        <button type="button" className="u27-cta" data-testid="u2027-quero"
          onClick={() => { evento("u2027_quero"); set((x) => ({ ...x, etapa: "pix" })); }}><span>Quero meu 2027 organizado</span></button>
        <button type="button" className="u27-nao" data-testid="u2027-nao"
          onClick={() => { evento("u2027_nao"); set((x) => ({ ...x, pix: null, etapa: "fim" })); }}>Agora não</button>
        {versao === "curta" && <p className="u27-miuda">Aparece no app e no site, na hora</p>}
      </div>
    );
    const topo = (
      <div className="u27-topo">
        <span className="u27-marca"><i />CORE</span>
        <span className="u27-ok" data-testid="u2027-confirmado"><Check size={14} strokeWidth={3.4} />Pagamento confirmado · {reais2027(valorPago)}</span>
      </div>
    );
    if (versao === "curta") {
      return (
        <div className="u27-tela" data-testid="u2027-oferta" data-versao="curta">
          <div className="u27-col">
            {topo}
            <h1 className="u27-titulo" style={{ marginTop: 34 }}>Seu 2027 já <em>organizado</em></h1>
            <p className="u27-sub">Tudo montado no seu CORE hoje. Uma vez só.</p>
            <div className="u27-lista"><ul>
              {ITENS_2027.map((it) => (
                <li key={it.titulo}><i aria-hidden>{it.emoji}</i><span><b>{it.titulo}</b><small>{it.sub}</small></span>{it.bonus && <em data-bonus="">BÔNUS</em>}</li>
              ))}
            </ul></div>
            <div className="u27-preco-linha"><strong data-testid="u2027-preco">{reais2027(VALOR_2027)}</strong><small>uma vez só</small></div>
          </div>
          {rodape}
        </div>
      );
    }
    return (
      <div className="u27-tela" data-testid="u2027-oferta" data-versao="visual">
        <div className="u27-col">
          {topo}
          <div className="u27-cena"><IlustraPlanner size={140} /></div>
          <h1 className="u27-titulo">Seu 2027 já <em>organizado</em></h1>
          <p className="u27-sub">Montado no seu CORE hoje, por <b data-testid="u2027-preco">{reais2027(VALOR_2027)}</b></p>
          <div className="u27-folha">
            <div className="u27-folha-topo"><b>PLANNER 2027</b><small>revisão no dia 1 de cada mês</small></div>
            <div className="u27-meses">{MESES_CURTOS.map((m, i) => <span key={m} data-on={i === 0 ? "" : undefined}><i />{m}</span>)}</div>
          </div>
          <div className="u27-chips">{PILULAS_2027.map((p) => <span key={p}>{p}</span>)}</div>
        </div>
        {rodape}
      </div>
    );
  }

  if (e.etapa === "pix") {
    const oferta = OFERTA_2027 as OfertaHoje;
    return (
      <PixHoje key={oferta} oferta={oferta} valor={VALOR_2027} rotulo="Seu 2027 no CORE · uma vez só"
        faixa={<div className="u27-pix-cabeca">🗓️ Seu 2027 já organizado</div>}
        pix={e.pix && e.pix.oferta === oferta ? (e.pix as unknown as PixSalvo) : null}
        onPix={(p) => {
          if (p && p.orderId !== e.pix?.orderId) evento("u2027_pix_gerado", { order_id: p.orderId, valor: VALOR_2027 });
          set((x) => ({ ...x, pix: p as unknown as PixDoFluxo2027 | null }));
        }}
        ids={base}
        onVoltar={() => set((x) => ({ ...x, etapa: "oferta" }))}
        onPago={(p) => {
          evento("u2027_pago", { order_id: p.orderId, valor: VALOR_2027 });
          set((x) => ({ ...x, pix: null, pedido: p.orderId, etapa: "pronto" }));
        }} />
    );
  }

  if (e.etapa === "pronto") {
    return (
      <div className="u27-tela" data-testid="u2027-pronto" style={{ position: "relative" }}>
        <Confete2027 />
        <div className="u27-col">
          <div className="u27-topo">
            <span className="u27-marca"><i />CORE</span>
            <span className="u27-ok"><Check size={14} strokeWidth={3.4} />Pago · {reais2027(VALOR_2027)}</span>
          </div>
          <div className="u27-cena"><IlustraPlanner size={124} /></div>
          <h1 className="u27-titulo">Pronto, seu 2027 tá no seu <em>CORE</em></h1>
          <div className="u27-entregue"><ul>
            <li><i><Check size={13} strokeWidth={3.4} /></i>Planejar 2027 (5 minutos)</li>
            <li><i><Check size={13} strokeWidth={3.4} /></i>12 revisões do mês</li>
            <li><i><Check size={13} strokeWidth={3.4} /></i>Cofrinho das 52 semanas</li>
            <li><i><Check size={13} strokeWidth={3.4} /></i>Planner 2027 em PDF</li>
          </ul></div>
          <div className="u27-onde" data-testid="u2027-onde">No app e no site: <b>Dev. Pessoal → Seu 2027</b>.<br />Entre com o mesmo e-mail da compra.</div>
          <SelosDasLojas onde="u2027_pronto" prefixo="web" altura={40} className="justify-center mt-3" />
        </div>
        <div className="u27-rodape">
          <button type="button" className="u27-cta" data-testid="u2027-continuar"
            onClick={() => { evento("u2027_continuar"); set((x) => ({ ...x, etapa: "fim" })); }}><span>Continuar</span></button>
        </div>
      </div>
    );
  }

  return <div className="u27-tela" data-testid="u2027-fim" />;
}
