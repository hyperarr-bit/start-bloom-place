import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import type { AreaKey } from "@/lib/funnel";
import {
  COPIES_PRESENTE, COPY_PRESENTE, OFERTA_PLANO30, OFERTA_PRESENTE, VALOR_PLANO30, VALOR_PRESENTE, VALOR_VITALICIO_CHEIO, VERSAO_PLANO30,
  depoisDoAgoraNao, gravarEstadoPresente, lerEstadoPresente, linkDoPresente, mensagemDoPresente, nomeLimpo, urlWhatsApp,
  type CopyPresente, type EstadoPresente, type PixDoFluxo, type VersaoPlano30,
} from "@/lib/presente";
import { PixHoje, type PixSalvo } from "@/pages/hoje/PixHoje";
import type { OfertaHoje } from "@/pages/hoje/conteudo";
import { ConfetePresente, IconeZap, IlustraPresente } from "./IlustraPresente";
import { OfertaPlano30 } from "./OfertaPlano30";
import { areaDoPlano } from "@/lib/plano-30-areas";
import { copiarTexto, gravarNomeDoPresente, meuPresente } from "./api";
import "@/pages/hoje/funil-hoje.css";
import "./presente.css";

/**
 * O UPSELL DE PRESENTE na tela (21/10) — o mesmo componente no /inicio (por cima do "Pagamento confirmado" do
 * PixCheckout) e no /hoje (etapa "presente", antes do pós-compra com as lojas). Mockups aprovados em
 * scratchpad/presente/mockups (a1/a2 oferta, b Pix, c cartão; downsell k-visual/k-curta).
 *
 *   oferta → "Quero presentear" → Pix R$ 14,90 (PixHoje, oferta pv149) → pago → cartão (nome + WhatsApp + Copiar link)
 *          → "Continuar" → fim
 *   oferta → "Agora não" → (área Dinheiro) plano de 30 dias R$ 9,90 (pk99) → "Quero meu plano" → Pix → fim
 *                                                                          → "Não, obrigado" → fim
 * O estado fica no navegador (localStorage + heap) por compra: quem vai pro app do banco e volta cai na mesma tela.
 *
 * `so30Dias` (21/10, chave central OFERTAS_POS_COMPRA = "2027"): o "Agora não" do 2027 cai AQUI direto no plano de 30
 * dias (sem a oferta do presente) — os eventos levam `via: "u2027"`.
 *
 * Eventos (todos com `origem` + os ids do funil): presente_oferta_view · presente_quero · presente_agora_nao ·
 * presente_pix_gerado · presente_pago · presente_link_copiado · presente_whatsapp · plano30_view · plano30_quero ·
 * plano30_nao · plano30_pix_gerado · plano30_pago. (O PixHoje manda os dele também: hoje_pix_gerado etc.)
 */
export type FimDoPresente = { pedido: string | null; codigo: string | null; plano30: string | null };

export function FluxoPresente({ origem, compra, valorPago, area, nomeSugerido = null, ids, onFim, copy = COPY_PRESENTE, versaoPlano30 = VERSAO_PLANO30, so30Dias = false }: {
  origem: "inicio" | "hoje";
  /** o pedido do vitalício que abriu o fluxo (1 fluxo por compra) */
  compra: string;
  valorPago: number;
  area: AreaKey | null;
  nomeSugerido?: string | null;
  ids?: () => Record<string, unknown>;
  onFim: (r: FimDoPresente) => void;
  copy?: CopyPresente;
  versaoPlano30?: VersaoPlano30;
  /** só o downsell do plano de 30 dias (depois do "Agora não" do 2027): nunca mostra a oferta do presente */
  so30Dias?: boolean;
}) {
  const [e, setE] = useState<EstadoPresente>(() => {
    const x = lerEstadoPresente(compra);
    return so30Dias && (x.etapa === "oferta" || x.etapa === "pix" || x.etapa === "cartao") ? { ...x, etapa: "plano30", pix: null } : x;
  });
  /** a área do plano de 30 dias (a do quiz; sem área = "tudo") */
  const areaPlano = areaDoPlano(area);
  const set = useCallback((f: (x: EstadoPresente) => EstadoPresente) => {
    setE((x) => { const n = f(x); gravarEstadoPresente(n); return n; });
  }, []);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const base = useCallback((): Record<string, unknown> => ({ origem, ...(so30Dias ? { via: "u2027" } : {}), ...(idsRef.current?.() ?? {}) }), [origem, so30Dias]);
  const evento = (nome: string, extra: Record<string, unknown> = {}) => trackEvent(nome, { ...extra, ...base() });

  /* vistas (1 por chegada na tela) */
  useEffect(() => {
    if (e.etapa === "oferta") evento("presente_oferta_view", { copy });
    if (e.etapa === "plano30") evento("plano30_view", { area: areaPlano, versao: versaoPlano30 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.etapa]);

  /* fim → devolve pro funil (uma vez) */
  const terminou = useRef(false);
  useEffect(() => {
    if (e.etapa !== "fim" || terminou.current) return;
    terminou.current = true;
    onFim({ pedido: e.pedido, codigo: e.codigo, plano30: e.plano30 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.etapa]);

  const pixDe = (oferta: string): PixSalvo | null => (e.pix && e.pix.oferta === oferta ? (e.pix as unknown as PixSalvo) : null);
  const onPix = (oferta: "pv149" | "pk99") => (p: PixSalvo | null) => {
    if (p && p.orderId !== e.pix?.orderId) evento(oferta === OFERTA_PRESENTE ? "presente_pix_gerado" : "plano30_pix_gerado", { order_id: p.orderId, valor: oferta === OFERTA_PRESENTE ? VALOR_PRESENTE : VALOR_PLANO30 });
    set((x) => ({ ...x, pix: p as unknown as PixDoFluxo | null }));
  };

  if (e.etapa === "oferta") {
    const c = COPIES_PRESENTE[copy];
    return (
      <div className="pv-tela" data-testid="presente-oferta" data-copy={copy}>
        <div className="pv-col">
          <div className="pv-topo">
            <span className="pv-marca"><i />CORE</span>
            <span className="pv-ok" data-testid="presente-confirmado"><Check size={14} strokeWidth={3.4} />Pagamento confirmado · {reais(valorPago)}</span>
          </div>
          <div className="pv-cena"><IlustraPresente size={168} /></div>
          <h1 className="pv-titulo">{c.titulo} <em>{c.destaque}</em>{c.emoji ? ` ${c.emoji}` : ""}</h1>
          <p className="pv-sub">{c.sub} <b>{reais(VALOR_PRESENTE)}</b></p>
          <div className="pv-oferta">
            <div className="pv-oferta-linha">
              <span className="pv-oferta-ico" aria-hidden>💛</span>
              <span className="pv-oferta-nome"><b>CORE pra sempre</b><small>de presente · com conta própria</small></span>
              <span className="pv-preco"><s>{reais(VALOR_VITALICIO_CHEIO)}</s><strong data-testid="presente-preco">{reais(VALOR_PRESENTE)}</strong></span>
            </div>
            <div className="pv-chips"><span>✨ 16 áreas</span><span>♾️ pra sempre</span><span>📱 celular e PC</span></div>
          </div>
          <div className="pv-como"><div><b>1</b>Você paga o Pix</div><div><b>2</b>Manda o link</div><div><b>3</b>Abre e cria a conta</div></div>
        </div>
        <div className="pv-rodape">
          <button type="button" className="pv-cta" data-testid="presente-quero"
            onClick={() => { evento("presente_quero", { copy }); set((x) => ({ ...x, etapa: "pix" })); }}>🎁 Quero presentear</button>
          <button type="button" className="pv-nao" data-testid="presente-agora-nao"
            onClick={() => { evento("presente_agora_nao", { copy }); set((x) => ({ ...x, pix: null, etapa: depoisDoAgoraNao(area) })); }}>Agora não</button>
        </div>
      </div>
    );
  }

  if (e.etapa === "pix" || e.etapa === "plano30pix") {
    const presente = e.etapa === "pix";
    const oferta = (presente ? OFERTA_PRESENTE : OFERTA_PLANO30) as OfertaHoje;
    return (
      <PixHoje key={oferta} oferta={oferta} valor={presente ? VALOR_PRESENTE : VALOR_PLANO30}
        rotulo={presente ? "CORE pra sempre · de presente" : "Plano de 30 dias pra organizar a vida"}
        faixa={<div className="pv-pix-cabeca">{presente ? "🎁 Presente pra alguém especial" : "🗓️ Seu plano de 30 dias"}</div>}
        pix={pixDe(oferta)} onPix={onPix(oferta as "pv149" | "pk99")} ids={base} extraNoPedido={presente ? null : { area: areaPlano }}
        onVoltar={() => set((x) => ({ ...x, etapa: presente ? "oferta" : "plano30" }))}
        onPago={(p) => {
          if (presente) {
            evento("presente_pago", { order_id: p.orderId, valor: VALOR_PRESENTE });
            set((x) => ({ ...x, pix: null, pedido: p.orderId, etapa: "cartao" }));
          } else {
            evento("plano30_pago", { order_id: p.orderId, valor: VALOR_PLANO30, area: areaPlano });
            set((x) => ({ ...x, pix: null, plano30: p.orderId, etapa: "fim" }));
          }
        }} />
    );
  }

  if (e.etapa === "cartao") {
    return <TelaCartao estado={e} nomeSugerido={nomeSugerido} evento={evento}
      onCodigo={(codigo, de) => set((x) => ({ ...x, codigo, de: x.de ?? de }))}
      onNome={(de) => set((x) => ({ ...x, de }))}
      onContinuar={() => set((x) => ({ ...x, etapa: "fim" }))} />;
  }

  if (e.etapa === "plano30") {
    return <OfertaPlano30 area={areaPlano} versao={versaoPlano30}
      onSim={() => { evento("plano30_quero", { area: areaPlano, versao: versaoPlano30 }); set((x) => ({ ...x, etapa: "plano30pix" })); }}
      onNao={() => { evento("plano30_nao", { area: areaPlano, versao: versaoPlano30 }); set((x) => ({ ...x, etapa: "fim" })); }} />;
  }

  return <div className="pv-tela" data-testid="presente-fim" />;
}

const reais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

/* ───────────────────────── o cartão (presente pago) ───────────────────────── */

function TelaCartao({ estado, nomeSugerido, evento, onCodigo, onNome, onContinuar }: {
  estado: EstadoPresente; nomeSugerido: string | null;
  evento: (nome: string, extra?: Record<string, unknown>) => void;
  onCodigo: (codigo: string, de: string | null) => void; onNome: (de: string) => void; onContinuar: () => void;
}) {
  const [nome, setNome] = useState(() => estado.de ?? nomeSugerido ?? "");
  const [copiado, setCopiado] = useState(false);
  const [semCodigo, setSemCodigo] = useState(false);
  const salvo = useRef<string | null>(estado.de);
  const pedido = estado.pedido ?? "";

  /* o código do pedido pago (o check já criou; tenta algumas vezes se a rede piscar) */
  useEffect(() => {
    if (estado.codigo || !pedido) return;
    let vivo = true;
    let tentativa = 0;
    const buscar = async () => {
      const m = await meuPresente(pedido);
      if (!vivo) return;
      if (m) { onCodigo(m.codigo, m.de); if (m.de && !nome) setNome(m.de); return; }
      if (++tentativa < 6) window.setTimeout(() => { void buscar(); }, 2000);
      else setSemCodigo(true);
    };
    void buscar();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, estado.codigo]);

  /** grava o nome do cartão (no servidor, pra página de quem ganhou) — só se mudou */
  const salvarNome = async () => {
    const limpo = nome.trim();
    if (!pedido || limpo === (salvo.current ?? "")) return;
    salvo.current = limpo;
    onNome(limpo);
    await gravarNomeDoPresente(pedido, limpo);
  };
  useEffect(() => {
    const t = window.setTimeout(() => { void salvarNome(); }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome]);

  const codigo = estado.codigo;
  const msg = codigo ? mensagemDoPresente(codigo, nome.trim() || null) : "";
  const quem = nome.trim();

  return (
    <div className="pv-tela" data-testid="presente-cartao" style={{ position: "relative" }}>
      <ConfetePresente />
      <div className="pv-col">
        <div className="pv-topo">
          <span className="pv-marca"><i />CORE</span>
          <span className="pv-ok"><Check size={14} strokeWidth={3.4} />Presente pago · {reais(VALOR_PRESENTE)}</span>
        </div>
        <h1 className="pv-titulo" style={{ marginTop: 18 }}>Agora é só <em>mandar</em> 💌</h1>
        <p className="pv-sub">O link vale pra 1 pessoa: abre, cria a conta e pronto</p>
        <div className="pv-cartao">
          <span className="pv-fita" />
          <div className="pv-cartao-topo"><span className="pv-marca"><i />CORE</span><span className="pv-selo">PRA SEMPRE</span></div>
          <div className="pv-cartao-meio">
            <IlustraPresente size={78} />
            <p className="pv-cartao-de" data-testid="presente-cartao-de">{quem ? <><b>{quem}</b> te deu</> : "Você ganhou"} o CORE pra sempre 💛</p>
          </div>
          <div className="pv-picote" />
          <div className="pv-cartao-link" data-testid="presente-link">
            {codigo ? <>coreaplicativo.com.br/presente/<b>{codigo}</b></> : semCodigo ? "O link também chega no seu e-mail" : "Preparando o seu link…"}
          </div>
        </div>
        <div className="pv-campo">
          <label htmlFor="pv-nome">Seu nome no cartão</label>
          <input id="pv-nome" value={nome} placeholder="Como você quer assinar" autoComplete="given-name" data-testid="presente-nome"
            onChange={(ev) => setNome(nomeLimpo(ev.target.value))} onBlur={() => { void salvarNome(); }} />
        </div>
      </div>
      <div className="pv-rodape">
        <a className="pv-cta" data-zap="" href={codigo ? urlWhatsApp(msg) : undefined} target="_blank" rel="noopener noreferrer"
          aria-disabled={!codigo} data-testid="presente-whatsapp" style={{ background: "#1faa59", opacity: codigo ? 1 : 0.5 }}
          onClick={(ev) => {
            if (!codigo) { ev.preventDefault(); return; }
            void salvarNome();
            evento("presente_whatsapp", { com_nome: !!quem });
          }}>
          <IconeZap />Enviar no WhatsApp
        </a>
        <button type="button" className="pv-sec" data-ok={copiado ? "" : undefined} disabled={!codigo} data-testid="presente-copiar"
          onClick={async () => {
            if (!codigo) return;
            void salvarNome();
            const ok = await copiarTexto(linkDoPresente(codigo));
            setCopiado(true);
            evento("presente_link_copiado", { ok });
          }}>
          {/* o texto em <span>: um <svg> sozinho como elemento faria a regra de área de toque do index.css (margem −8 px) pegar */}
          {copiado ? <><Check size={18} strokeWidth={3} /><span>Link copiado</span></> : <><Copy size={18} strokeWidth={2.4} /><span>Copiar link</span></>}
        </button>
        <button type="button" className="pv-nao" onClick={() => { void salvarNome(); onContinuar(); }} data-testid="presente-continuar">Continuar</button>
      </div>
    </div>
  );
}

