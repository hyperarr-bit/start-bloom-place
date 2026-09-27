import type { CSSProperties, ReactNode } from "react";
import { nomeDaCapa, type RetroMes } from "@/lib/retrospectiva";
import { CountUp, foilCss, tamanhoQueCabe, useMedidas } from "./prancheta";
import {
  Abas, Cadeado, CarimboOuro, CarimboTreino, CheckDourado, Etiqueta, FundoPlanner, Grade30, Lacre, P3, Pauta, RadioDourado, Tag, Trilho,
  creme, fio, heroi, kicker, relevo, rot, semanasDoMes, serif, type Aba,
} from "./pecas-planner";
import { fechadoEm, linhaDoMeuMes } from "./temas";
import {
  abasDaRetro, contagemDoHumor, diaDoInicio, diasDaCapaCurta, horas, fraseDoFecho, legendaDoSono, partesDoSentir,
} from "./paginas-comuns";
import type { Base, Moldura, PaginaPronta, Pele, PropsDinheiro, PropsFato, PropsFecho, PropsFoco } from "./pele";
import { FOIL } from "./prancheta";

/**
 * TEMA PADRÃO — "Páginas de dentro" (26/09): cada página da retrospectiva é
 * uma página do planner — linho grafite, espiral dourada, abas de índice,
 * número-herói em foil, etiqueta de papel, lacre. Medidas do d3.html do
 * designer (430×932); `m(932, 760)` aperta a página em tela mais baixa.
 */

const MOLDURA: Moldura = {
  barraOn: "#e6c15c",
  barraOff: "rgba(243,238,228,.2)",
  topo: "rgba(243,238,228,.55)",
  esquerda: 40,
  chip: { fg: "#e6c15c", bg: "rgba(0,0,0,.25)", borda: "rgba(230,193,92,.45)" },
};

const pagina = (conteudo: ReactNode, fita?: number): PaginaPronta => ({
  fundoCor: P3.mesa,
  fundo: <FundoPlanner fita={fita} />,
  moldura: MOLDURA,
  conteudo: <div style={{ position: "absolute", inset: 0, color: P3.creme }}>{conteudo}</div>,
});

const abs = (s: CSSProperties): CSSProperties => ({ position: "absolute", ...s });

/** "core" em baixo-relevo. */
const Marca = ({ style }: { style: CSSProperties }) => (
  <div aria-hidden style={{ ...relevo, ...abs(style), fontSize: 19, fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1 }}>core</div>
);

/** Tamanho do número-herói: 2 dígitos no desenho; 3+ encolhe pra caber na coluna. */
const tamanhoDoHeroi = (n: number | string, base: number) => {
  const d = String(n).length;
  return d <= 2 ? base : d === 3 ? base * 0.72 : base * 0.56;
};

/** Kicker + fio + número em foil + o que ele conta + a linha de apoio (topo das páginas). */
const BlocoHeroi = ({ rotuloKicker, valor, texto, rotulo, sub, direita = 56 }: {
  rotuloKicker: string; valor?: number; texto?: string; rotulo: ReactNode; sub?: ReactNode; direita?: number;
}) => {
  const { m, t, fs } = useMedidas();
  const base = t(224, 176);
  return (
    <div style={abs({ left: 48, right: direita, top: m(98, 84) })}>
      <div style={kicker(fs(10.5))}>{rotuloKicker}</div>
      <div style={{ ...fio(), marginTop: 8 }} />
      <div
        style={{
          ...heroi, ...foilCss, fontSize: tamanhoDoHeroi(valor ?? texto ?? "", base), marginTop: m(14, 10), marginLeft: -8, paddingRight: 8,
          whiteSpace: "nowrap",
        }}
      >
        {valor !== undefined ? <CountUp to={valor} /> : texto}
      </div>
      <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-.02em", marginTop: 8, lineHeight: 1.2 }}>{rotulo}</div>
      {sub && <div style={{ fontSize: fs(13), color: creme(0.58), marginTop: 5, fontWeight: 500, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );
};

const AbasDaPagina = ({ p, atual }: { p: Base; atual: string }) => {
  const { m } = useMedidas();
  const abas: Aba[] = abasDaRetro(p.paginas, p.proximo.nome);
  return <Abas abas={abas} atual={atual} top={m(112, 98)} altura={m(72, 60)} />;
};

/** A etiqueta da capa: "O setembro de / Ana Beatriz / fechado em 30/09 · 21 dias anotados". */
const EtiquetaDaCapa = ({ retro, nome, linha }: { retro: RetroMes; nome: string | null; linha: string }) => {
  const { m, fs } = useMedidas();
  const nc = nomeDaCapa(nome);
  const mes = retro.mes.toLowerCase();
  return (
    <Etiqueta style={{ left: 50, top: m(96, 80), width: 280, padding: "12px 16px 13px", transform: "rotate(-1.2deg)" }}>
      <div style={rot(fs(9.5))}>{nc ? `O ${mes} de` : "Retrospectiva"}</div>
      <div style={{ ...serif, fontSize: nc && nc.length > 13 ? 31 : 36, lineHeight: 1, marginTop: 3, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingBottom: 2 }}>
        {nc ?? `O seu ${mes}`}
      </div>
      <div style={{ fontSize: fs(11.5), color: P3.tintaEtiqueta, marginTop: 6, fontWeight: 500 }}>{linha}</div>
    </Etiqueta>
  );
};

const Virar = () => {
  const { fs } = useMedidas();
  return <div style={abs({ left: 0, right: 0, bottom: 34, textAlign: "center", fontSize: fs(13), fontWeight: 600, color: creme(0.5) })}>toque pra virar a página →</div>;
};

/* ============================================================== capa */

const Capa = ({ retro, nome }: Base) => {
  const { m, t, fs, H } = useMedidas();
  const a = retro.atividade;
  const MES = retro.mes.toUpperCase();
  const tamMes = t(retro.mes.length > 8 ? 88 : 96, 80);
  // a grade ocupa o que sobra entre o título e o lacre (mês de 6 semanas encolhe)
  const topoDaGrade = m(420, 332);
  const lacre = t(104, 88);
  const topoDoLacre = H - m(194, 164);
  const inicioDasCelulas = topoDaGrade + 1 + 12 + 14 + 12 + 17;
  const semanas = semanasDoMes(retro.ano, retro.mesIdx);
  const alturaLivre = topoDoLacre - 10 - inicioDasCelulas;
  const celula = Math.max(22, Math.min(43, (alturaLivre - (semanas - 1) * 6) / semanas));
  return (
    <>
      <EtiquetaDaCapa retro={retro} nome={nome} linha={`${fechadoEm(retro)} · ${a.diasComRegistro} ${a.diasComRegistro === 1 ? "dia anotado" : "dias anotados"}`} />
      <div style={abs({ left: 48, top: m(236, 190) })}>
        <div style={{ ...serif, ...foilCss, fontSize: tamMes, lineHeight: 0.95, letterSpacing: "-.01em", filter: "drop-shadow(0 3px 3px rgba(0,0,0,.6))", paddingRight: 10 }}>{retro.mes}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
          <span style={{ ...relevo, fontSize: 30, fontWeight: 900, letterSpacing: ".06em" }}>{retro.ano}</span>
          <span style={{ ...serif, fontSize: 17, color: creme(0.6) }}>o mês, página por página.</span>
        </div>
      </div>
      <div style={abs({ left: 48, right: 44, top: topoDaGrade })}>
        <div style={fio()} />
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 12 }}>
          <span style={kicker(fs(10.5))}>Os {retro.base.diasDoMes} dias</span>
          <span style={{ marginLeft: "auto", fontSize: fs(11), fontWeight: 700, color: creme(0.6) }}>{a.diasComRegistro} com algo anotado</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <Grade30 ano={retro.ano} mesIdx={retro.mesIdx} marcados={a.dias} primeiroDia={retro.base.primeiroDia} largura={celula * 7 + 36} gap={6} check={Math.round(celula * 0.35)} cabecalho fs={fs} />
        </div>
      </div>
      <Lacre texto={`${MES} · ${retro.ano} · FECHADO · `} titulo={`${MES} · ${retro.ano} · FECHADO`} tamanho={lacre} style={{ right: 52, top: topoDoLacre, transform: "rotate(-8deg)" }} />
      <Marca style={{ left: 50, bottom: 66 }} />
      <Virar />
    </>
  );
};

/* ======================================================== capa curta */

const CapaCurta = ({ retro, nome }: Base) => {
  const { m, t, fs } = useMedidas();
  const a = retro.atividade;
  const { dias, de, ate } = diasDaCapaCurta(retro);
  const colunas = Math.min(7, Math.max(1, dias.length));
  const celula = Math.min(42.5, (326 - (colunas - 1) * 6) / colunas);
  return (
    <>
      <EtiquetaDaCapa retro={retro} nome={nome} linha={`começou dia ${diaDoInicio(a.primeiroDia ?? 1)}`} />
      <div style={abs({ left: 48, right: 56, top: m(246, 200) })}>
        <div style={kicker(fs(10.5))}>Seus primeiros</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ ...heroi, ...foilCss, fontSize: t(190, 150), marginLeft: -6, paddingRight: 6 }}>
            <CountUp to={a.diasComRegistro} />
          </span>
          <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-.02em" }}>{a.diasComRegistro === 1 ? "dia" : "dias"}</span>
        </div>
        <div style={{ ...serif, fontSize: 22, color: creme(0.75), marginTop: 8 }}>Já tem história pra contar.</div>
      </div>
      <div style={abs({ left: 48, right: 56, top: m(520, 424) })}>
        <div style={fio()} />
        <div style={{ ...kicker(fs(10.5)), marginTop: 12 }}>De {de} a {ate} de {retro.mes.toLowerCase()}</div>
        <div style={{ marginTop: 12 }}>
          <Grade30 ano={retro.ano} mesIdx={retro.mesIdx} marcados={a.dias} primeiroDia={retro.base.primeiroDia} largura={celula * colunas + (colunas - 1) * 6} gap={6} check={Math.round(celula * 0.3)} dias={dias} />
        </div>
      </div>
      <Marca style={{ left: 50, bottom: 66 }} />
      <Virar />
    </>
  );
};

/* =========================================================== meu mês */

const MeuMes = (p: Base) => {
  const { m, fs } = useMedidas();
  const { retro } = p;
  const mm = retro.meuMes!;
  const base = retro.base;
  const sub = base.primeiroDia > 1 ? `de ${base.dias} desde que você começou o mês` : `dos ${base.diasDoMes} dias de ${retro.mes.toLowerCase()}`;
  const MM = String(retro.mesIdx + 1).padStart(2, "0");
  const linhas = [
    mm.sequencia && { k: "Melhor sequência", v: `${mm.sequencia.dias} dias`, s: `de ${mm.sequencia.de} a ${mm.sequencia.ate}/${MM}` },
    mm.diaForte && { k: "Dia mais forte", v: mm.diaForte.nome, s: `${mm.diaForte.feitos} de ${mm.diaForte.total} ${mm.diaForte.plural}` },
    mm.habitoCampeao && { k: "Hábito campeão", v: mm.habitoCampeao.nome, s: `${mm.habitoCampeao.dias} dias` },
  ].filter(Boolean) as { k: string; v: string; s: string }[];
  const tagTopo = m(380, 322);
  return (
    <>
      <AbasDaPagina p={p} atual="meu-mes" />
      <BlocoHeroi rotuloKicker="Meu mês" valor={mm.diasAnotados} rotulo={mm.diasAnotados === 1 ? "dia com a vida anotada" : "dias com a vida anotada"} sub={sub} />
      {mm.aMaisQueAnterior && (
        <>
          <svg aria-hidden style={abs({ left: 328, top: tagTopo - 54, width: 60, height: 70, overflow: "visible", zIndex: 2 })}>
            <path d="M54,4 C44,26 30,42 12,62" fill="none" stroke="#e9d8b8" strokeWidth="1.6" />
            <circle cx="54" cy="4" r="2.5" fill="#e6c15c" />
          </svg>
          <Tag style={{ right: 64, top: tagTopo, transform: "rotate(-5deg)", transformOrigin: "right center", zIndex: 3 }}>
            <span data-testid="tag-a-mais" style={{ fontSize: 14, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>+{mm.aMaisQueAnterior.dias} {mm.aMaisQueAnterior.dias === 1 ? "dia" : "dias"}</span>
            <span style={{ fontSize: fs(11), color: P3.tintaEtiqueta, fontWeight: 600 }}>que em {mm.aMaisQueAnterior.mes}</span>
          </Tag>
        </>
      )}
      {linhas.length > 0 && <Pauta linhas={linhas} fs={fs} pad={[m(11, 8), m(12, 9)]} style={abs({ left: 48, right: 56, top: m(496, 404) })} />}
      <div style={{ ...fio(), ...abs({ left: 48, right: 56, top: m(712, 590) }) }} />
      <div style={{ ...serif, ...abs({ left: 48, right: 56, top: m(730, 604) }), fontSize: 20, lineHeight: 1.2, color: creme(0.78) }}>{linhaDoMeuMes(retro)}</div>
      <Marca style={{ right: 56, bottom: 30 }} />
    </>
  );
};

/* ================================================= valores (dinheiro) */

/** O que aparece quando a pessoa toca pra ver os R$ — só dentro do app. */
export const TextoDosValores = ({ retro, proximo }: { retro: RetroMes; proximo: string }) => {
  const f = retro.financas!;
  const m = retro.mes.toLowerCase();
  const reais = (v: number) => `R$ ${Math.round(Number(v) || 0).toLocaleString("pt-BR")}`;
  return f.temRenda ? (
    <>
      <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Entrou {reais(f.income)} · saiu {reais(f.outflow)}</p>
      <p style={{ fontSize: 13, marginTop: 4, marginBottom: 0, lineHeight: 1.35, opacity: 0.75 }}>
        {f.balance >= 0 ? `Sobraram ${reais(f.balance)} em ${m}.` : `Saiu ${reais(Math.abs(f.balance))} a mais do que entrou — ${proximo.toLowerCase()} é página nova.`}
      </p>
    </>
  ) : (
    <>
      <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Saiu {reais(f.outflow)} em {m}.</p>
      <p style={{ fontSize: 13, marginTop: 4, marginBottom: 0, lineHeight: 1.35, opacity: 0.75 }}>Anote também o que entra, e a próxima retrospectiva fecha a conta do mês.</p>
    </>
  );
};

/** "🔒 Os valores em R$ ficam só com você. Tocar pra ver" — o botão que revela (e esconde). */
export const BotaoDosValores = ({ revelado, onRevelar, cor, fs, style }: {
  revelado: boolean; onRevelar: () => void; cor: string; fs: (n: number) => number; style?: CSSProperties;
}) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onRevelar(); }}
    style={{ background: "none", border: 0, padding: "4px 0", color: cor, fontSize: fs(12), fontWeight: 600, textAlign: "center", fontFamily: "inherit", ...style }}
  >
    {revelado ? (
      <span>Só você está vendo. <u>Esconder</u></span>
    ) : (
      <>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Cadeado />Os valores em R$ ficam só com você.</span>
        <u style={{ marginLeft: 8 }}>Tocar pra ver</u>
      </>
    )}
  </button>
);

const Dinheiro = (p: PropsDinheiro) => {
  const { m, fs } = useMedidas();
  const { retro, revelado, onRevelar } = p;
  const f = retro.financas!;
  const base = retro.base;
  const comGasto = new Set(f.diasComGasto);
  const diasDaBase = Array.from({ length: base.dias }, (_, i) => base.primeiroDia + i);
  const reais = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
  return (
    <>
      <AbasDaPagina p={p} atual="dinheiro" />
      {f.gastosAnotados > 0 ? (
        <BlocoHeroi rotuloKicker="Dinheiro" valor={f.gastosAnotados} rotulo={f.gastosAnotados === 1 ? "gasto anotado" : "gastos anotados"} sub="Cada um deles é uma decisão que você viu acontecer." />
      ) : (
        <BlocoHeroi rotuloKicker="Dinheiro" valor={f.txCount} rotulo="lançamentos no mês" sub="Tudo o que saiu, anotado num lugar só." />
      )}
      {f.topCategories.length > 0 && (
        <div style={abs({ left: 48, right: 56, top: m(470, 372) })}>
          <div style={kicker(fs(10.5))}>Pra onde foi</div>
          <div style={{ marginTop: 10, display: "grid", gap: m(11, 8) }}>
            {f.topCategories.map((c, i) => (
              <div key={c.label}>
                <div style={{ display: "flex", fontSize: 14, fontWeight: 700, gap: 8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                  <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {revelado && <span style={{ fontWeight: 600, color: creme(0.6) }}>{reais(c.value)} · </span>}
                    <span style={{ ...foilCss, fontWeight: 900 }}>{Math.round(c.pct)}%</span>
                  </span>
                </div>
                <Trilho pct={c.pct} style={{ marginTop: 5 }} atraso={0.3 + i * 0.2} />
              </div>
            ))}
          </div>
        </div>
      )}
      {f.diasSemGasto !== null && (
        <Etiqueta style={{ left: 50, right: 58, top: m(672, 522), padding: "12px 16px 14px", transform: "rotate(-1deg)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{f.diasSemGasto}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{f.diasSemGasto === 1 ? "dia sem gastar nada" : "dias sem gastar nada"}</span>
            <span style={{ marginLeft: "auto", fontSize: fs(11), color: P3.tintaEtiqueta, fontWeight: 600 }}>de {base.dias}</span>
          </div>
          <div aria-hidden style={{ display: "grid", gridTemplateColumns: `repeat(${diasDaBase.length}, 1fr)`, gap: diasDaBase.length > 26 ? 2 : 3, marginTop: 10 }}>
            {diasDaBase.map((d) => (
              <i key={d} style={{ display: "block", height: 16, borderRadius: 2, ...(comGasto.has(d) ? { background: "rgba(43,43,47,.10)" } : { background: FOIL, boxShadow: "inset 0 0 0 1px rgba(90,60,0,.35)" }) }} />
            ))}
          </div>
        </Etiqueta>
      )}
      <div style={abs({ left: 48, right: 56, bottom: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 })}>
        {revelado && (
          <Etiqueta testId="valores-revelados" style={{ position: "relative", alignSelf: "stretch", padding: "12px 16px 13px", transform: "rotate(-.6deg)" }}>
            <TextoDosValores retro={retro} proximo={p.proximo.nome} />
          </Etiqueta>
        )}
        <BotaoDosValores revelado={revelado} onRevelar={onRevelar} cor={creme(0.55)} fs={fs} />
      </div>
    </>
  );
};

/* ============================================================== corpo */

const Corpo = (p: Base) => {
  const { m, fs } = useMedidas();
  const c = p.retro.corpo!;
  const heroiDe = c.treinos > 0 ? "treinos" : c.agua ? "agua" : "sono";
  const cartaoDeAgua = c.agua && heroiDe !== "agua" ? c.agua : null;
  const cartaoDeSono = c.sono && heroiDe !== "sono" ? c.sono : null;
  const linhas = [
    cartaoDeAgua && {
      k: "Água na meta",
      v: `${cartaoDeAgua.diasNaMeta} ${cartaoDeAgua.diasNaMeta === 1 ? "dia" : "dias"}`,
      s: (
        <div aria-hidden style={{ display: "grid", gridTemplateColumns: `repeat(${Math.ceil(cartaoDeAgua.dias.length / 2)}, 1fr)`, gap: 3, width: 130 }}>
          {cartaoDeAgua.dias.map((d) => (
            <i key={d.dia} style={{ display: "block", height: 8, borderRadius: 2, background: d.naMeta ? FOIL : "rgba(255,255,255,.12)" }} />
          ))}
        </div>
      ),
    },
    cartaoDeSono && { k: "Sono médio", v: horas(cartaoDeSono.mediaMin), s: legendaDoSono(cartaoDeSono) },
  ].filter(Boolean) as { k: string; v: string; s: ReactNode }[];
  const sub = c.meta
    ? `${c.meta.semanas} ${c.meta.semanas === 1 ? "semana batendo" : "semanas batendo"} a meta de ${c.meta.porSemana} por semana.`
    : `Média de ${c.porSemana.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} por semana.`;
  return (
    <>
      <AbasDaPagina p={p} atual="corpo" />
      {heroiDe === "treinos" ? (
        <BlocoHeroi rotuloKicker="Corpo" valor={c.treinos} rotulo={c.treinos === 1 ? "treino no mês" : "treinos no mês"} sub={sub} />
      ) : heroiDe === "agua" ? (
        <BlocoHeroi rotuloKicker="Corpo" valor={c.agua!.diasNaMeta} rotulo="dias na meta de água" sub={`A meta é de ${c.agua!.meta} copos por dia.`} />
      ) : (
        <BlocoHeroi rotuloKicker="Corpo" texto={horas(c.sono!.mediaMin)} rotulo="de sono por noite" sub={legendaDoSono(c.sono!)} />
      )}
      <div style={abs({ left: 48, right: 56, top: m(462, 366), display: "flex", flexDirection: "column" })}>
        {c.grupos.length > 0 && (
          <div>
            <div style={kicker(fs(10.5))}>O que você treinou</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }}>
              {c.grupos.slice(0, 4).map((g) => <CarimboTreino key={g.grupo} grupo={g.grupo} n={g.dias} rotulo={g.rotulo} fs={fs} />)}
            </div>
          </div>
        )}
        {linhas.length > 0 && <Pauta linhas={linhas} fs={fs} pad={[m(11, 8), m(12, 9)]} style={{ marginTop: c.grupos.length ? m(12, 6) : 0 }} />}
        {c.recorde && (
          <div style={{ marginTop: m(46, 16), marginLeft: 8, transform: "rotate(-5deg)", transformOrigin: "left center" }}>
            <CarimboOuro>
              Novo recorde · {c.recorde.exercicio} {c.recorde.carga > 0 ? `${c.recorde.carga.toLocaleString("pt-BR")} kg` : `${c.recorde.reps} reps`}
            </CarimboOuro>
          </div>
        )}
      </div>
      <Marca style={{ right: 56, bottom: 30 }} />
    </>
  );
};

/* ================================================== como você estava */

const NIVEIS_DO_HUMOR: [string, number][] = [["ótimo", 1], ["bem", 0.78], ["ok", 0.55], ["mal", 0.36]];
const OPACIDADE_DO_HUMOR: Record<number, number> = { 5: 1, 4: 0.78, 3: 0.55, 2: 0.36, 1: 0.22 };

const Humor = (p: Base) => {
  const { m, t, fs } = useMedidas();
  const { retro } = p;
  const s = retro.sentir!;
  const MM = String(retro.mesIdx + 1).padStart(2, "0");
  const nota = new Map(s.porDia.map((n) => [n.dia, n.nota]));
  const { bons, total } = contagemDoHumor(s.porDia);
  const partes = partesDoSentir(s);
  const escreveu = !!s.frase || s.diasDeDiario > 0 || s.gratidoes > 0;
  const palavra = s.palavra ? `${s.palavra}.` : null;
  const tamPalavra = palavra ? tamanhoQueCabe([palavra], { familia: "serif", italico: true }, 326, t(120, 96)) : 0;
  const temGrafico = s.porDia.length > 0;
  return (
    <>
      <AbasDaPagina p={p} atual="humor" />
      <div style={abs({ left: 48, right: 56, top: m(98, 84) })}>
        <div style={kicker(fs(10.5))}>Como você estava</div>
        <div style={{ ...fio(), marginTop: 8 }} />
        {palavra ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 600, color: creme(0.75), marginTop: m(22, 16) }}>Na maior parte dos dias, você esteve</div>
            <div style={{ ...serif, ...foilCss, fontSize: tamPalavra, lineHeight: 0.9, marginTop: 2, filter: "drop-shadow(0 3px 3px rgba(0,0,0,.6))", paddingRight: 12, paddingBottom: 4 }}>{palavra}</div>
            <div style={{ fontSize: fs(13), color: creme(0.58), marginTop: 8, fontWeight: 500 }}>
              {s.pesado ? "Registrar como você estava já é um jeito de se cuidar." : bons > 0 ? `${bons} de ${total} ${total === 1 ? "dia" : "dias"} bem ou melhor` : `${total} ${total === 1 ? "dia" : "dias"} com o humor anotado`}
            </div>
          </>
        ) : (
          <>
            <div style={{ ...heroi, ...foilCss, fontSize: t(160, 128), marginTop: m(14, 10), marginLeft: -6, paddingRight: 8 }}>
              <CountUp to={s.diasDeDiario || s.gratidoes} />
            </div>
            <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-.02em", marginTop: 8 }}>
              {s.diasDeDiario > 0 ? (s.diasDeDiario === 1 ? "dia de diário" : "dias de diário") : s.gratidoes === 1 ? "coisa pela qual você agradeceu" : "coisas pelas quais você agradeceu"}
            </div>
          </>
        )}
      </div>
      {temGrafico && (
        <div style={abs({ left: 48, right: 56, top: m(392, 318) })}>
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", rowGap: 6 }}>
            <span style={{ ...kicker(fs(10.5)), whiteSpace: "nowrap" }}>Seu humor, dia a dia</span>
            <span aria-hidden style={{ marginLeft: "auto", display: "flex", gap: 8, fontSize: fs(9.5), fontWeight: 700, color: creme(0.6) }}>
              {NIVEIS_DO_HUMOR.map(([n, a]) => (
                <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <i style={{ width: 8, height: 8, borderRadius: 2, background: FOIL, opacity: a }} />{n}
                </span>
              ))}
            </span>
          </div>
          <div aria-hidden style={{ display: "flex", alignItems: "flex-end", gap: retro.base.diasDoMes > 30 ? 3 : 4, height: m(92, 70), marginTop: 12 }}>
            {Array.from({ length: retro.base.diasDoMes }, (_, i) => {
              const n = nota.get(i + 1);
              const nivel = n ? Math.min(5, Math.max(1, Math.round(n))) : 0;
              return (
                <i
                  key={i}
                  style={{
                    flex: 1, display: "block", borderRadius: "3px 3px 1px 1px", boxSizing: "border-box",
                    ...(nivel ? { height: `${nivel * 20}%`, background: FOIL, opacity: OPACIDADE_DO_HUMOR[nivel] } : { height: "20%", border: "1px dotted rgba(255,255,255,.3)" }),
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", fontSize: fs(10.5), fontWeight: 700, color: creme(0.5), marginTop: 6 }}>
            <span>1/{MM}</span><span style={{ marginLeft: "auto" }}>{retro.base.diasDoMes}/{MM}</span>
          </div>
        </div>
      )}
      <div style={abs({ left: 48, right: 56, top: temGrafico ? m(566, 460) : m(420, 340), display: "flex", flexDirection: "column", gap: m(34, 20) })}>
        {s.frase && (
          <Etiqueta testId="frase-da-pessoa" style={{ position: "relative", marginLeft: 2, marginRight: -2, padding: "14px 18px 16px", transform: "rotate(-1deg)" }}>
            <div style={rot(fs(9.5))}>{s.frase.quando ? `Você escreveu · ${s.frase.quando}` : `Você escreveu sobre ${retro.mes.toLowerCase()}`}</div>
            <div style={{ ...serif, fontSize: 21, lineHeight: 1.2, marginTop: 6 }}>“{s.frase.texto}”</div>
          </Etiqueta>
        )}
        {(partes.length > 0 || escreveu) && (
          <div style={{ fontSize: fs(12), color: creme(0.55), lineHeight: 1.5 }}>
            {partes.length > 0 && <div>{partes.join(" · ")}</div>}
            {escreveu && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Cadeado />O que você escreve nunca vai pro card.</span>}
          </div>
        )}
      </div>
      <Marca style={{ right: 56, bottom: 30 }} />
    </>
  );
};

/* ============================================================== foco */

const Foco = (p: PropsFoco) => {
  const { m, t, fs } = useMedidas();
  const { opcoes, escolha, texto, salvo } = p;
  const proximo = p.proximo.nome.toLowerCase();
  const foco = (texto.trim() || escolha || "").trim();
  return (
    <>
      <AbasDaPagina p={p} atual="foco" />
      <div style={abs({ left: 48, right: 56, top: m(98, 84) })}>
        <div style={kicker(fs(10.5))}>Foco de {proximo}</div>
        <div style={{ ...fio(), marginTop: 8 }} />
        <div style={{ ...serif, ...foilCss, fontSize: t(58, 48), lineHeight: 0.95, marginTop: m(20, 14), filter: "drop-shadow(0 3px 3px rgba(0,0,0,.6))", paddingBottom: 6 }}>
          Escolha 1 foco<br />pro mês.
        </div>
        <div style={{ fontSize: fs(13.5), color: creme(0.65), marginTop: m(12, 8), fontWeight: 500, lineHeight: 1.4 }}>
          Uma coisa só, a partir do que você já faz. Fica anotado na sua Rotina, na aba Mês.
        </div>
      </div>
      {salvo ? (
        <div style={abs({ left: 50, right: 58, top: m(334, 280) })}>
          <Etiqueta testId="foco-salvo" style={{ position: "relative", padding: "16px 18px 18px", transform: "rotate(-1deg)" }}>
            <div style={{ ...rot(fs(9.5)), display: "flex", alignItems: "center", gap: 6 }}>Anotado <CheckDourado tam={12} /></div>
            <div style={{ ...serif, fontSize: 24, lineHeight: 1.15, marginTop: 6 }}>“{salvo}”</div>
          </Etiqueta>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); p.onFechar(); }}
            style={{ marginTop: m(40, 28), width: "100%", height: 48, borderRadius: 12, background: P3.papel, color: P3.grafite, fontSize: 14, fontWeight: 800, border: 0, boxShadow: "0 8px 16px -8px rgba(0,0,0,.8)", fontFamily: "inherit" }}
          >
            Fechar a retrospectiva
          </button>
        </div>
      ) : (
        <>
          <div style={abs({ left: 50, right: 58, top: m(334, 272), display: "grid", gap: m(12, 8) })}>
            {opcoes.map((o) => {
              const on = !texto.trim() && escolha === o.texto;
              return (
                <button
                  key={o.texto}
                  type="button"
                  aria-pressed={on}
                  onClick={(e) => { e.stopPropagation(); p.onEscolha(o.texto); }}
                  style={{
                    position: "relative", textAlign: "left", background: P3.papel, borderRadius: 6, color: P3.grafite, border: 0, fontFamily: "inherit",
                    padding: `${m(12, 9)}px 14px ${m(12, 9)}px 50px`,
                    boxShadow: on ? `0 0 0 2px ${P3.ouroTxt}, 0 10px 18px -10px rgba(0,0,0,.85)` : "0 10px 18px -10px rgba(0,0,0,.85)",
                  }}
                >
                  <i aria-hidden style={{ position: "absolute", inset: 4, border: "1px solid rgba(43,43,47,.18)", borderRadius: 4, pointerEvents: "none" }} />
                  <RadioDourado on={on} />
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.01em" }}>{o.texto}</div>
                  {o.contexto && <div style={{ fontSize: fs(11.5), color: P3.tintaEtiqueta, marginTop: 2 }}>{o.contexto}</div>}
                </button>
              );
            })}
            <div style={{ position: "relative", background: P3.papel, borderRadius: 6, color: P3.grafite, padding: `${m(12, 9)}px 14px`, boxShadow: "0 10px 18px -10px rgba(0,0,0,.85)" }}>
              <i aria-hidden style={{ position: "absolute", inset: 4, border: "1px solid rgba(43,43,47,.18)", borderRadius: 4, pointerEvents: "none" }} />
              <div style={rot(fs(9.5))}>Ou escreva o seu</div>
              <input
                value={texto}
                onChange={(e) => p.onTexto(e.target.value.slice(0, 80))}
                onClick={(e) => e.stopPropagation()}
                placeholder={`Em ${proximo} eu vou…`}
                aria-label="Seu foco pro mês"
                style={{ position: "relative", display: "block", width: "100%", marginTop: 8, border: 0, borderBottom: "1.5px dotted rgba(43,43,47,.35)", background: "transparent", padding: "0 0 4px", fontSize: 15, color: P3.grafite, outline: "none", fontFamily: "inherit" }}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!foco}
            onClick={(e) => { e.stopPropagation(); p.onSalvar(); }}
            style={{
              ...abs({ left: 50, right: 58, top: m(708, 588) }), height: 48, borderRadius: 12, background: FOIL, color: "#3a2604", fontSize: 14, fontWeight: 800, border: 0,
              boxShadow: "0 8px 16px -8px rgba(0,0,0,.8)", opacity: foco ? 1 : 0.45, transition: "opacity .2s", fontFamily: "inherit",
            }}
          >
            Guardar foco
          </button>
          <div style={abs({ left: 50, right: 58, top: m(770, 648), textAlign: "center", fontSize: fs(12), color: creme(0.5) })}>Você pode trocar o foco quando quiser.</div>
        </>
      )}
      <Marca style={{ right: 56, bottom: 30 }} />
    </>
  );
};

/* ================================================ versão curta: o fato */

const Fato = (p: PropsFato) => {
  const { m, fs } = useMedidas();
  const { fato } = p;
  return (
    <>
      <BlocoHeroi rotuloKicker="1 fato de verdade" valor={fato.valor} rotulo={fato.rotulo} sub={fato.sub} />
      <Etiqueta style={{ left: 50, right: 58, top: m(500, 402), padding: "14px 18px 16px", transform: "rotate(-1deg)" }}>
        <div style={rot(fs(9.5))}>Por que isso importa</div>
        <div style={{ ...serif, fontSize: 21, lineHeight: 1.2, marginTop: 6 }}>{fato.porque}</div>
      </Etiqueta>
      {fato.dinheiro && (
        <div style={abs({ left: 48, right: 56, bottom: 34, textAlign: "center", fontSize: fs(12), fontWeight: 600, color: creme(0.55) })}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Cadeado />Os valores em R$ ficam só com você.</span>
        </div>
      )}
      <Marca style={{ right: 56, bottom: 66 }} />
    </>
  );
};

/* ============================================== versão curta: o fecho */

const Fecho = (p: PropsFecho) => {
  const { m, t, fs } = useMedidas();
  const proximo = p.proximo.nome;
  return (
    <>
      <div style={abs({ left: 48, right: 70, top: m(250, 186) })}>
        <div style={{ ...serif, ...foilCss, fontSize: t(78, 64), lineHeight: 0.95, letterSpacing: "-.01em", filter: "drop-shadow(0 3px 3px rgba(0,0,0,.6))", paddingBottom: 6 }}>
          Cada registro conta.
        </div>
        {p.recente && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 14 }}>
            <span style={{ ...relevo, fontSize: 30, fontWeight: 900, letterSpacing: ".06em" }}>{proximo.toUpperCase()}</span>
          </div>
        )}
        <div style={{ ...serif, fontSize: 20, color: creme(0.7), marginTop: m(22, 16), lineHeight: 1.25 }}>{fraseDoFecho(p.recente, proximo)}</div>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); p.onFechar(); }}
        style={{ ...abs({ left: 50, right: 58, top: m(640, 520) }), height: 48, borderRadius: 12, background: P3.papel, color: P3.grafite, fontSize: 14, fontWeight: 800, border: 0, boxShadow: "0 8px 16px -8px rgba(0,0,0,.8)", fontFamily: "inherit" }}
      >
        Voltar pro planner
      </button>
      {p.podeFocar && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); p.onFocar(); }}
          style={{ ...abs({ left: 50, right: 58, top: m(702, 580) }), background: "none", border: 0, textAlign: "center", fontSize: fs(12.5), color: creme(0.55), padding: "4px 0", fontFamily: "inherit" }}
        >
          Escolher 1 foco pra {proximo.toLowerCase()} →
        </button>
      )}
      <Marca style={{ left: 50, bottom: 66 }} />
    </>
  );
};

/* ============================================================== a pele */

export const PELE_PAGINAS: Pele = {
  capa: (p) => pagina(<Capa {...p} />, 360),
  capaCurta: (p) => pagina(<CapaCurta {...p} />, 300),
  meuMes: (p) => pagina(<MeuMes {...p} />),
  dinheiro: (p) => pagina(<Dinheiro {...p} />),
  corpo: (p) => pagina(<Corpo {...p} />),
  humor: (p) => pagina(<Humor {...p} />),
  foco: (p) => pagina(<Foco {...p} />),
  fato: (p) => pagina(<Fato {...p} />),
  fecho: (p) => pagina(<Fecho {...p} />, 420),
  card: {
    fundoCor: "#ebe4d8",
    fundo: <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #f4efe6, #ebe4d8)" }} />,
    moldura: { barraOn: "#2f3036", barraOff: "rgba(47,48,54,.16)", topo: "rgba(47,48,54,.6)", esquerda: 14, chip: { fg: "#2f3036", bg: "rgba(255,255,255,.7)", borda: "rgba(47,48,54,.2)" } },
    linha: { bg: "#fff", fg: "#2f3036", sombra: "inset 0 0 0 1px rgba(0,0,0,.08)", trilhoOff: "#d6d0c5" },
    salvar: { bg: "#fff", fg: "#2f3036", borda: "1px solid rgba(47,48,54,.3)" },
    postar: { bg: "#262626", fg: "#fff" },
    proxima: "rgba(47,48,54,.6)",
    seg: { bg: "rgba(0,0,0,.08)", fg: "#262626", onBg: "#262626", onFg: "#fff" },
  },
  folha: { bg: "#1f1f24", fg: "#f3eee4", acento: "#e6c15c" },
};
