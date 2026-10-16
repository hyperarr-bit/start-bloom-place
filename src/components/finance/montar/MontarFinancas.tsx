/**
 * "VAMOS MONTAR SUAS FINANÇAS" (1.0.16) — a tela. Régua, chave e contas em lib/montar-financas.
 *
 * 3 toques até o número da pessoa: renda do mês → contas fixas → "Você pode gastar R$ X por dia"
 * (entre o 2º e o 3º, ~2 s de "Montando suas finanças…"). O que ela responde vira dado REAL do
 * módulo (`finance-incomes` + `finance-fixed-expenses`, gravado na entrada do "Montando" — fechar
 * o app na animação não perde nada) e o número é o mesmo do card "QUANTO POSSO GASTAR HOJE" do
 * Dashboard. "Pular" em toda tela de pergunta.
 *
 * ── ONDE APARECE ────────────────────────────────────────────────────────────────────────────
 *  (a) Sozinha, na 1ª abertura de Finanças de uma conta nova sem dado nenhum (pages/Index.tsx,
 *      hook `useMontarFinancasNoModulo` abaixo). Termina na aba MEU FINANCEIRO, já cheia.
 *  (b) PELA MISSÃO — integração (quem cuida da missão em doses liga; nada aqui mexe nela):
 *
 *        import { MontarFinancas, deveMostrarMontarFinancas, EVENTO_MONTAR_FINANCAS_FIM, ATRIBUTO_NA_TELA }
 *          from "@/components/finance/montar/MontarFinancas";
 *
 *        // jeito 1 — não fazer nada: o passo de Finanças leva a /financas e a tela abre sozinha
 *        // (conta nova, Finanças vazia). Antes de procurar o "+ Novo gasto"
 *        // ('[data-spotlight="add-expense"]'), esperar `document.documentElement.hasAttribute(ATRIBUTO_NA_TELA)`
 *        // ficar falso, ou ouvir `window` EVENTO_MONTAR_FINANCAS_FIM
 *        // (`detail: { resultado: "pronto" | "pulou", contas }`).
 *
 *        // jeito 2 — abrir de onde a missão estiver (folha fixa por cima de tudo, z 200, abaixo da faixa):
 *        const { user } = useAuth(); const { get, isGuest } = useUserData();
 *        if (deveMostrarMontarFinancas({ criadoEm: user?.created_at, get, isGuest }))
 *          <MontarFinancas origem="missao" onPronto={(r) => …r.contas, r.porDia…} onPular={() => …} />
 *
 *      Depois do "pronto", o próximo toque natural é o 1º gasto (o painel já está cheio).
 *
 * Eventos: montar_financas_view {origem} · montar_financas_passo {n: 1 renda | 2 contas | 3 resultado, origem}
 *          · montar_financas_pronto {contas, faixa, sem_folga, origem} · montar_financas_pular {passo, origem}.
 *          Nunca valor em reais.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, DollarSign, Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { reais } from "@/lib/dinheiro";
import { marcarCartoesVistos } from "@/lib/tour-home";
import {
  ATRIBUTO_NA_TELA, CHAVE_MONTAR_FINANCAS, CONTAS_SUGERIDAS, EVENTO_MONTAR_FINANCAS_FIM, EV_PASSO, EV_PRONTO, EV_PULAR, EV_VIEW,
  FAIXAS_DE_RENDA, calcularMontar, contaNovaParaMontar, deveMostrarMontarFinancas, guardarForcaMontarDaUrl, itensParaGravar,
  marcarMontarDecidido, montarFinancasLigado, montarJaDecidido, registrarVistaMontar, reaisDigitados,
  type ContaEscolhida, type Resultado,
} from "@/lib/montar-financas";
import "./montar-financas.css";

export { deveMostrarMontarFinancas, EVENTO_MONTAR_FINANCAS_FIM, ATRIBUTO_NA_TELA } from "@/lib/montar-financas";

export interface ResumoMontar { contas: number; porDia: number; semFolga: boolean }
export interface PropsMontarFinancas {
  /** De onde abriu (vai nos eventos): a 1ª abertura do módulo ou o passo da missão. */
  origem?: "modulo" | "missao";
  onPronto?: (r: ResumoMontar) => void;
  onPular?: () => void;
  /** Só testes/prints: a data "de hoje" (o número depende dos dias que faltam no mês). */
  agora?: Date;
  /** Só testes/prints: duração do "Montando…" em ms (padrão 2200; 0 = pula a espera). */
  esperaMs?: number;
}

type Etapa = "renda" | "contas" | "montando" | "pronto";
const PASSO_DA_ETAPA: Record<Etapa, number> = { renda: 1, contas: 2, montando: 2, pronto: 3 };

const mesCurto = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(/\.?\s*de\s*/i, " ").replace(".", "");

export function MontarFinancas({ origem = "modulo", onPronto, onPular, agora, esperaMs = 2200 }: PropsMontarFinancas) {
  const { get, set } = useUserData();
  const hoje = useMemo(() => agora ?? new Date(), [agora]);
  const [etapa, setEtapa] = useState<Etapa>("renda");
  const [faixa, setFaixa] = useState<string | null>(null);
  const [renda, setRenda] = useState(0);
  const [contas, setContas] = useState<ContaEscolhida[]>([]);
  const outras = useRef(0);
  const inicio = useRef(false);
  const resultado = useMemo(() => calcularMontar(renda, contas, hoje), [renda, contas, hoje]);

  // a tela está aberta: trava a rolagem do fundo e avisa quem espera (missão/anel)
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute(ATRIBUTO_NA_TELA, "");
    return () => html.removeAttribute(ATRIBUTO_NA_TELA);
  }, []);

  useEffect(() => {
    if (inicio.current) return;
    inicio.current = true;
    registrarVistaMontar();
    trackEvent(EV_VIEW, { origem });
    trackEvent(EV_PASSO, { n: 1, origem });
  }, [origem]);

  const irPara = (e: Etapa) => {
    setEtapa(e);
    if (e === "contas" || e === "pronto") trackEvent(EV_PASSO, { n: PASSO_DA_ETAPA[e], origem });
  };

  const decidir = (r: Resultado, nContas = 0) => {
    const marca = marcarMontarDecidido(r);
    set(CHAVE_MONTAR_FINANCAS, marca, { system: true });
    try { window.dispatchEvent(new CustomEvent(EVENTO_MONTAR_FINANCAS_FIM, { detail: { resultado: r, contas: nContas } })); } catch { /* sem window */ }
  };

  const pular = () => {
    trackEvent(EV_PULAR, { passo: PASSO_DA_ETAPA[etapa], origem });
    decidir("pulou");
    onPular?.();
  };

  /** Grava no módulo (as chaves de sempre) — na ENTRADA do "Montando". */
  const gravar = () => {
    const { receita, fixos } = itensParaGravar(renda, contas, hoje);
    const juntar = (chave: string, novos: unknown[]) => {
      if (!novos.length) return;
      const atuais = get<unknown[]>(chave, []);
      const lista = [...(Array.isArray(atuais) ? atuais : []), ...novos];
      set(chave, lista);
      avisarEscritaDeFora(chave, lista); // Finanças aberta por baixo adota na hora (não regrava por cima)
    };
    juntar("finance-incomes", receita);
    juntar("finance-fixed-expenses", fixos);
    decidir("pronto", fixos.length);
    trackEvent(EV_PRONTO, { contas: fixos.length, faixa: faixa ?? "digitou", sem_folga: resultado.semFolga, origem });
  };

  const montar = () => {
    gravar();
    irPara("montando");
  };
  useEffect(() => {
    if (etapa !== "montando") return;
    const t = window.setTimeout(() => irPara("pronto"), Math.max(0, esperaMs));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, esperaMs]);

  /* ── contas ── */
  const marcada = (id: string) => contas.some((c) => c.id === id);
  const alternar = (id: string) => {
    if (marcada(id)) { setContas(contas.filter((c) => c.id !== id)); return; }
    const s = CONTAS_SUGERIDAS.find((c) => c.id === id);
    if (s) setContas([...contas, { id: s.id, nome: s.nome, emoji: s.emoji, valor: s.valor, categoria: s.categoria }]);
  };
  const novaOutra = () => {
    outras.current += 1;
    setContas([...contas, { id: `outra-${outras.current}`, nome: "", emoji: "📌", valor: 0, categoria: "outros" }]);
  };
  const mudar = (id: string, campo: Partial<ContaEscolhida>) => setContas(contas.map((c) => (c.id === id ? { ...c, ...campo } : c)));
  const totalContas = contas.reduce((s, c) => s + (c.nome.trim() ? c.valor : 0), 0);
  const nValidas = resultado.contas;

  const cabecalho = (
    <header className="mf-cab">
      <DollarSign className="mf-cab-icone" aria-hidden />
      <span className="mf-cab-nome">FINANÇAS</span>
      <span className="mf-cab-mes">{mesCurto(hoje)}</span>
    </header>
  );

  return (
    <div className="mf" role="dialog" aria-modal="true" aria-label="Vamos montar suas finanças" data-testid="montar-financas" data-etapa={etapa}>
      {cabecalho}
      <div className="mf-corpo">
        {etapa === "renda" && (
          <>
            <div className="mf-barra" aria-hidden><i data-on="" /><i /></div>
            <div className="mf-q">
              <div className="mf-kicker">Vamos montar suas finanças · 1 de 2</div>
              <h2>Quanto entra por mês, mais ou menos?</h2>
              <p>Só pra calcular quanto dá pra gastar por dia. Dá pra mudar depois.</p>
            </div>
            <div className="mf-chips" data-grade="">
              {FAIXAS_DE_RENDA.map((f) => (
                <button key={f.id} type="button" className="mf-chip" aria-pressed={faixa === f.id}
                  onClick={() => { setFaixa(f.id); setRenda(f.valor); }}>
                  {f.rotulo}
                </button>
              ))}
            </div>
            <div className="mf-folha">
              <div className="mf-faixa">💰 Renda do mês</div>
              <div className="mf-renda">
                <label>
                  <small>R$</small>
                  <input
                    aria-label="Renda do mês em reais"
                    inputMode="numeric" enterKeyHint="done" placeholder="0"
                    value={renda ? reais(renda) : ""}
                    onChange={(e) => { setRenda(reaisDigitados(e.target.value)); setFaixa(null); }}
                  />
                </label>
                <p>{faixa ? "Um valor de partida — ajusta pro número certo se quiser." : "Salário, freela, pensão… o que entra no mês."}</p>
              </div>
            </div>
            <div className="mf-rodape">
              <button type="button" className="mf-cta" disabled={renda <= 0} onClick={() => irPara("contas")}>Continuar</button>
              <button type="button" className="mf-pular" onClick={pular}>Pular</button>
            </div>
          </>
        )}

        {etapa === "contas" && (
          <>
            <div className="mf-barra" aria-hidden><i data-on="" /><i data-on="" /></div>
            <div className="mf-q">
              <div className="mf-kicker">2 de 2
                <button type="button" className="mf-voltar" onClick={() => setEtapa("renda")}><ArrowLeft size={14} aria-hidden /><span>Voltar</span></button>
              </div>
              <h2>Quais contas chegam todo mês?</h2>
              <p>Toca nas que você tem. Cada uma já vem com um valor típico, que você ajusta.</p>
            </div>
            {/* chip = escolher (só o nome, cabe tudo na tela); o valor típico já entra na tabela, pra ajustar */}
            <div className="mf-chips" data-compacto="">
              {CONTAS_SUGERIDAS.map((c) => (
                <button key={c.id} type="button" className="mf-chip" aria-pressed={marcada(c.id)} onClick={() => alternar(c.id)}>
                  {c.emoji} {c.nome}
                </button>
              ))}
              <button type="button" className="mf-chip" data-outra="" onClick={novaOutra}><Plus size={16} aria-hidden /><span>Outra</span></button>
            </div>
            {contas.length > 0 && (
              <div className="mf-folha" data-testid="montar-contas">
                <div className="mf-faixa">📋 Contas fixas do mês <b>{contas.length}</b></div>
                {contas.map((c) => (
                  <div key={c.id} className="mf-linha">
                    <span className="mf-linha-emoji" aria-hidden>{c.emoji}</span>
                    {c.id.startsWith("outra-") ? (
                      <input className="mf-linha-nome" aria-label="Nome da conta" placeholder="Nome da conta" autoFocus
                        value={c.nome} maxLength={40} onChange={(e) => mudar(c.id, { nome: e.target.value })} />
                    ) : (
                      <span className="mf-linha-nome">{c.nome}</span>
                    )}
                    <label className="mf-valor">
                      <small>R$</small>
                      <input aria-label={`Valor de ${c.nome || "outra conta"}`} inputMode="numeric" enterKeyHint="done" placeholder="0"
                        value={c.valor ? reais(c.valor) : ""} onChange={(e) => mudar(c.id, { valor: reaisDigitados(e.target.value) })} />
                    </label>
                    <button type="button" className="mf-tirar" aria-label={`Tirar ${c.nome || "outra conta"}`}
                      onClick={() => setContas(contas.filter((x) => x.id !== c.id))}><X size={16} aria-hidden /></button>
                  </div>
                ))}
                <div className="mf-total"><span>Total por mês</span>R$ {reais(totalContas)}</div>
              </div>
            )}
            <div className="mf-rodape">
              <button type="button" className="mf-cta" onClick={montar}>
                {nValidas > 0 ? "Ver quanto posso gastar" : "Não tenho conta fixa"}
              </button>
              <button type="button" className="mf-pular" onClick={pular}>Pular</button>
            </div>
          </>
        )}

        {etapa === "montando" && (
          <div className="mf-montando" aria-live="polite">
            <div className="mf-orbe" aria-hidden><div><DollarSign size={38} /></div></div>
            <h2>Montando suas finanças…</h2>
            <div className="mf-passos">
              <div className="mf-passo" style={{ animationDelay: "150ms" }}><i><Check size={13} strokeWidth={3} /></i>Renda de R$ {reais(renda)} no mês</div>
              <div className="mf-passo" style={{ animationDelay: "650ms" }}><i><Check size={13} strokeWidth={3} /></i>
                {nValidas === 0 ? "Sem contas fixas por enquanto" : nValidas === 1 ? "1 conta fixa anotada" : `${nValidas} contas fixas anotadas`}
              </div>
              <div className="mf-passo" data-esperando="" style={{ animationDelay: "1150ms" }}><i />Calculando quanto dá por dia</div>
            </div>
          </div>
        )}

        {etapa === "pronto" && (
          <>
            <div className="mf-pronto" data-testid="montar-pronto">
              <div className="mf-grande">
                <small>VOCÊ PODE GASTAR HOJE</small>
                <strong data-testid="montar-por-dia">R$ {reais(resultado.porDia)}<em>por dia</em></strong>
                <p>
                  {resultado.semFolga
                    ? "Suas contas fixas já levam a renda do mês inteira. Nas suas Finanças dá pra ver onde apertar."
                    : resultado.dias === 1
                      ? "Hoje é o último dia do mês — já tirando as contas fixas."
                      : `até o fim do mês (${resultado.dias} dias, contando hoje), já tirando as contas fixas.`}
                </p>
              </div>
              <div className="mf-folha">
                <div className="mf-faixa">🧾 A conta do seu mês</div>
                <div className="mf-conta"><span>Entra no mês</span>R$ {reais(resultado.renda)}</div>
                <div className="mf-conta"><span>Contas fixas ({resultado.contas})</span>− R$ {reais(resultado.fixos)}</div>
                <div className="mf-conta" data-total=""><span>Livre pro mês</span>R$ {reais(Math.max(0, resultado.livre))}</div>
                {!resultado.semFolga && resultado.dias > 1 && (
                  <div className="mf-conta"><span>÷ {resultado.dias} dias</span>R$ {reais(resultado.porDia)} por dia</div>
                )}
              </div>
              <p className="mf-salvo"><i><Check size={15} strokeWidth={3} /></i>Já está tudo nas suas Finanças. Dá pra mudar quando quiser.</p>
            </div>
            <div className="mf-rodape">
              <button type="button" className="mf-cta" onClick={() => onPronto?.({ contas: resultado.contas, porDia: resultado.porDia, semFolga: resultado.semFolga })}>
                Ver minhas Finanças
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A régua no módulo (pages/Index.tsx): decide UMA vez, quando o dado da conta carregou, e
 * segura a decisão (gravar a renda no meio do fluxo não pode fechar a tela).
 *   · "nao"       → Finanças de sempre (cliente antigo nem chega a "decidindo");
 *   · "decidindo" → conta nova esperando o dado da conta (o módulo mostra a tela em branco);
 *   · "mostrar"   → a tela de montar.
 */
export function useMontarFinancasNoModulo(isPreview: boolean) {
  const { user } = useAuth();
  const { get, set, loaded, isGuest } = useUserData();
  const criadoEm = (user as { created_at?: string } | null)?.created_at;
  // `?montar-financas=recomecar` (QA, navegador): lido UMA vez por montagem
  const recomecou = useRef<boolean | null>(null);
  if (recomecou.current === null) recomecou.current = guardarForcaMontarDaUrl();
  const candidato = () => !isPreview && !isGuest && montarFinancasLigado() && contaNovaParaMontar(criadoEm) && !montarJaDecidido();
  const decidir = (): "mostrar" | "nao" => {
    const getSemMarca = recomecou.current ? (<T,>(k: string, f: T): T => (k === CHAVE_MONTAR_FINANCAS ? f : get(k, f))) : get;
    return deveMostrarMontarFinancas({ criadoEm, get: getSemMarca, isGuest, isPreview }) ? "mostrar" : "nao";
  };
  const [estado, setEstado] = useState<"decidindo" | "mostrar" | "nao">(() => {
    if (!candidato()) return "nao";
    return loaded ? decidir() : "decidindo";
  });
  useEffect(() => {
    if (recomecou.current) set(CHAVE_MONTAR_FINANCAS, null, { system: true }); // a marca da conta também sai
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (estado !== "decidindo" || !loaded) return;
    setEstado(decidir());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, estado]);
  return {
    estado,
    /** Terminou: os cartões de boas-vindas de Finanças não aparecem mais (a tela os substitui). */
    aoPronto: () => { marcarCartoesVistos("financas"); setEstado("nao"); },
    /** Pulou: Finanças de sempre (com os cartões, se a chave deles estiver ligada). */
    aoPular: () => setEstado("nao"),
  };
}
