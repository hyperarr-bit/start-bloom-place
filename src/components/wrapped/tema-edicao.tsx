import { useMemo, type CSSProperties, type ReactNode } from "react";
import { nomeDaCapa, type ConteudoDoCard } from "@/lib/retrospectiva";
import { CountUp, INTER, SERIF, tamanhoQueCabe, useFontesProntas, useMedidas } from "./prancheta";
import { Cadeado, Picto } from "./pecas-planner";
import { COR_DO_DIA_NA_REVISTA, emDuasLinhas, linhaDoMeuMes, numeroDaEdicao, paginasPorExtenso } from "./temas";
import {
  contagemDoHumor, diaDoInicio, diasDaCapaCurta, fraseDoFecho, horas, legendaDoSono, numeroDaPagina, partesDoSentir, sumarioDaRetro,
} from "./paginas-comuns";
import { BotaoDosValores, TextoDosValores } from "./tema-paginas";
import type { Base, Moldura, PaginaPronta, Pele, PropsDinheiro, PropsFato, PropsFecho, PropsFoco } from "./pele";

/**
 * TEMA "Edição de setembro" (26/09) — a revista do mês: cor chapada por
 * página, tipografia enorme, sumário na capa; o card do tema é a capa da
 * revista. Medidas do d1.html do designer.
 */

const E = {
  grafite: "#1b1b20",
  creme: "#f6f1e7",
  magenta: "#d22d80",
  magentaClaro: "#ec5aa0",
  indigo: "#4f46e5",
  ambar: "#f5b626",
  azul: "#2f6df6",
  rosa: "#ef5b8e",
} as const;

const ESCURA: Moldura = {
  barraOn: E.creme, barraOff: "rgba(246,241,231,.22)", topo: "rgba(246,241,231,.62)", esquerda: 14,
  chip: { fg: E.creme, bg: "rgba(255,255,255,.08)", borda: "rgba(246,241,231,.35)" },
};
const CLARA: Moldura = {
  barraOn: E.grafite, barraOff: "rgba(27,27,32,.18)", topo: "rgba(27,27,32,.62)", esquerda: 14,
  chip: { fg: E.grafite, bg: "rgba(255,255,255,.35)", borda: "rgba(27,27,32,.25)" },
};

const pagina = (cor: string, conteudo: ReactNode, clara = false): PaginaPronta => ({
  fundoCor: cor,
  moldura: clara ? CLARA : ESCURA,
  conteudo: <div style={{ position: "absolute", inset: 0, color: clara ? E.grafite : E.creme }}>{conteudo}</div>,
});

const abs = (s: CSSProperties): CSSProperties => ({ position: "absolute", ...s });
const serif: CSSProperties = { fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 };
const kicker = (fs: number): CSSProperties => ({ fontSize: fs, fontWeight: 800, letterSpacing: ".2em", textTransform: "uppercase" });
const heroi: CSSProperties = { fontWeight: 900, letterSpacing: "-.065em", lineHeight: 0.82, fontVariantNumeric: "tabular-nums" };
const COLUNA = { left: 28, right: 28 } as const;

const tamanhoDoHeroi = (n: number | string, base: number) => {
  const d = String(n).length;
  return d <= 2 ? base : d === 3 ? base * 0.7 : base * 0.54;
};

/** Kicker "02 · Meu mês" + número gigante + o que ele conta (serifada) + apoio. */
const BlocoHeroi = ({ k, valor, texto, rotulo, sub }: { k: string; valor?: number; texto?: string; rotulo: ReactNode; sub?: ReactNode }) => {
  const { m, t, fs } = useMedidas();
  return (
    <div style={abs({ ...COLUNA, top: m(96, 84) })}>
      <div style={{ ...kicker(fs(11)), opacity: 0.75 }}>{k}</div>
      <div style={{ ...heroi, fontSize: tamanhoDoHeroi(valor ?? texto ?? "", t(250, 190)), marginTop: 6, marginLeft: -10, whiteSpace: "nowrap" }}>
        {valor !== undefined ? <CountUp to={valor} /> : texto}
      </div>
      <div style={{ ...serif, fontSize: 36, lineHeight: 1, marginTop: 8 }}>{rotulo}</div>
      {sub && <div style={{ fontSize: fs(14), fontWeight: 500, opacity: 0.78, marginTop: 8, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );
};

/** Lista editorial: rótulo, valor, lado direito; fio por cima de cada linha. */
const Lista = ({ linhas, clara, style }: { linhas: { k: string; v: ReactNode; s?: ReactNode }[]; clara?: boolean; style?: CSSProperties }) => {
  const { m, fs } = useMedidas();
  return (
    <div style={style}>
      {linhas.map((l) => (
        <div key={l.k} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "end", columnGap: 10, padding: `${m(12, 9)}px 0 ${m(13, 10)}px`, borderTop: `1px solid ${clara ? "rgba(27,27,32,.28)" : "rgba(255,255,255,.28)"}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: fs(10.5), fontWeight: 800, letterSpacing: ".18em", opacity: 0.72 }}>{l.k}</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.05, marginTop: 3, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.v}</div>
          </div>
          {l.s != null && <div style={{ fontSize: fs(13), fontWeight: 500, opacity: 0.78, textAlign: "right" }}>{l.s}</div>}
        </div>
      ))}
    </div>
  );
};

/** Sumário da capa: número magenta, título com a linha pontilhada, valor. */
const Sumario = ({ itens }: { itens: { n: string; t: string; v: string }[] }) => {
  const { m, fs } = useMedidas();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", alignItems: "baseline", columnGap: 10, rowGap: m(13, 9), marginTop: m(14, 10) }}>
      {itens.map((i) => (
        <div key={i.n} style={{ display: "contents" }}>
          <span style={{ fontSize: fs(12), fontWeight: 800, color: E.magentaClaro, fontVariantNumeric: "tabular-nums" }}>{i.n}</span>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{ whiteSpace: "nowrap" }}>{i.t}</span>
            <span aria-hidden style={{ flex: 1, borderBottom: "1.5px dotted rgba(246,241,231,.35)", transform: "translateY(-4px)", minWidth: 8 }} />
          </span>
          <span style={{ fontSize: fs(13), fontWeight: 600, opacity: 0.72, whiteSpace: "nowrap" }}>{i.v}</span>
        </div>
      ))}
    </div>
  );
};

const Virar = ({ clara }: { clara?: boolean }) => {
  const { fs } = useMedidas();
  return <div style={abs({ left: 0, right: 0, bottom: 34, textAlign: "center", fontSize: fs(13), fontWeight: 600, color: clara ? "rgba(27,27,32,.6)" : "rgba(246,241,231,.6)" })}>toque pra virar a página →</div>;
};

const Regra = () => <div style={{ height: 2, background: E.magenta }} />;

/* ============================================================== capa */

const Capa = (p: Base) => {
  const { m, t, fs } = useMedidas();
  const { retro } = p;
  const nc = nomeDaCapa(p.nome);
  const palavras = nc ? nc.split(" ") : [retro.mes];
  // nome comprido ("Maximiliano") encolhe até caber na coluna (374 de 430)
  const tamNome = tamanhoQueCabe(palavras, { familia: "inter", peso: 900, espaco: -0.05 }, 374, t(84, 70));
  const MM = String(retro.mesIdx + 1).padStart(2, "0");
  const ativos = new Set(retro.atividade.dias);
  return (
    <>
      <div style={abs({ ...COLUNA, top: m(100, 86) })}>
        <div style={{ ...kicker(fs(11)), color: E.magentaClaro }}>Edição nº {numeroDaEdicao(retro.mesIdx)} · {retro.mes} de {retro.ano}</div>
        <div style={{ fontSize: 17, fontWeight: 600, opacity: 0.75, marginTop: m(22, 16) }}>{nc ? `O ${retro.mes.toLowerCase()} de` : "O seu"}</div>
        <div style={{ ...heroi, fontSize: tamNome, letterSpacing: "-.05em", lineHeight: 0.9, marginTop: 4 }}>
          {palavras.map((x, i) => <span key={i} style={{ display: "block" }}>{x}</span>)}
        </div>
        <div style={{ ...serif, fontSize: t(24, 21), lineHeight: 1.15, opacity: 0.9, marginTop: m(22, 14), maxWidth: 330 }}>
          {paginasPorExtenso(p.paginas.length)} pra um mês que valeu a pena anotar.
        </div>
        <div aria-hidden style={{ display: "grid", gridTemplateColumns: `repeat(${retro.base.diasDoMes}, 1fr)`, gap: retro.base.diasDoMes > 30 ? 2 : 3, marginTop: m(26, 18) }}>
          {Array.from({ length: retro.base.diasDoMes }, (_, i) => (
            <i key={i} style={{ display: "block", height: 16, borderRadius: 2, background: ativos.has(i + 1) ? E.magenta : "rgba(246,241,231,.14)" }} />
          ))}
        </div>
        <div style={{ display: "flex", fontSize: fs(10), fontWeight: 700, letterSpacing: ".12em", opacity: 0.5, marginTop: 6 }}>
          <span>1/{MM}</span><span style={{ marginLeft: "auto" }}>{retro.base.diasDoMes}/{MM} · FECHADO</span>
        </div>
      </div>
      <div style={abs({ ...COLUNA, top: m(506, 404) })}>
        <Regra />
        <div style={{ ...kicker(fs(11)), marginTop: m(14, 10), opacity: 0.7 }}>Nesta edição</div>
        <Sumario itens={sumarioDaRetro(retro, p.paginas, p.proximo.nome)} />
      </div>
      <Virar />
    </>
  );
};

const CapaCurta = (p: Base) => {
  const { m, t, fs } = useMedidas();
  const { retro } = p;
  const nc = nomeDaCapa(p.nome);
  const a = retro.atividade;
  const { dias } = diasDaCapaCurta(retro);
  const feitos = new Set(a.dias);
  const cols = Math.min(5, dias.length);
  const inicio = diaDoInicio(a.primeiroDia ?? 1);
  return (
    <>
      <div style={abs({ ...COLUNA, top: m(100, 86) })}>
        <div style={{ ...kicker(fs(11)), color: E.magentaClaro }}>Edição nº {numeroDaEdicao(retro.mesIdx)} · {retro.mes} de {retro.ano}</div>
        <div style={{ fontSize: 17, fontWeight: 600, opacity: 0.75, marginTop: m(22, 16) }}>Seus primeiros</div>
        <div style={{ ...heroi, fontSize: t(84, 72), letterSpacing: "-.05em", lineHeight: 0.9, marginTop: 4 }}>
          <CountUp to={a.diasComRegistro} /> {a.diasComRegistro === 1 ? "dia" : "dias"}
        </div>
        <div style={{ ...serif, fontSize: t(24, 21), lineHeight: 1.15, opacity: 0.9, marginTop: m(22, 14), maxWidth: 330 }}>
          {nc ? `${nc} começou dia ${inicio}.` : `Você começou dia ${inicio}.`} Já tem história pra contar.
        </div>
        <div aria-hidden style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 64px)`, gap: 8, marginTop: m(30, 18) }}>
          {dias.map((d) => (
            <i key={d} style={{ display: "grid", placeItems: "center", height: 64, borderRadius: 6, fontStyle: "normal", fontWeight: 900, fontSize: 22, background: feitos.has(d) ? E.magenta : "rgba(246,241,231,.14)", color: feitos.has(d) ? E.creme : "rgba(246,241,231,.45)" }}>{d}</i>
          ))}
        </div>
        <div style={{ fontSize: fs(10), fontWeight: 700, letterSpacing: ".12em", opacity: 0.5, marginTop: 8 }}>
          {a.diasComRegistro} DE {retro.base.dias} DIAS COM ALGO ANOTADO
        </div>
      </div>
      <div style={abs({ ...COLUNA, top: m(520, 436) })}>
        <Regra />
        <div style={{ ...kicker(fs(11)), marginTop: m(14, 10), opacity: 0.7 }}>Nesta edição curta</div>
        <Sumario
          itens={[
            { n: "02", t: "1 fato de verdade", v: "o seu número" },
            { n: "03", t: "Cada registro conta", v: p.recente ? `até ${p.proximo.nome.toLowerCase()}` : "sempre" },
          ]}
        />
      </div>
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
  const cor = mm.diaForte ? COR_DO_DIA_NA_REVISTA[mm.diaForte.dia] : null;
  const clara = !!cor?.clara;
  return (
    <>
      <BlocoHeroi k={`${numeroDaPagina(p.paginas, "meu-mes")} · Meu mês`} valor={mm.diasAnotados} rotulo={mm.diasAnotados === 1 ? "dia com a vida anotada" : "dias com a vida anotada"} sub={sub} />
      {linhas.length > 0 && <Lista linhas={linhas} clara={clara} style={abs({ ...COLUNA, top: m(452, 356) })} />}
      <div style={abs({ ...COLUNA, top: m(690, 548), borderTop: `1px solid ${clara ? "rgba(27,27,32,.28)" : "rgba(255,255,255,.28)"}`, paddingTop: 14 })}>
        <div style={{ ...kicker(fs(10.5)), opacity: 0.72 }}>{mm.aMaisQueAnterior ? `Contra ${mm.aMaisQueAnterior.mes}` : "O mês numa linha"}</div>
        <div style={{ ...serif, fontSize: 32, lineHeight: 1.05, marginTop: 6 }}>
          {mm.aMaisQueAnterior && (
            <b style={{ fontFamily: INTER, fontWeight: 900, fontStyle: "normal", letterSpacing: "-.03em" }}>
              +{mm.aMaisQueAnterior.dias} {mm.aMaisQueAnterior.dias === 1 ? "dia" : "dias"}
            </b>
          )}
          {mm.aMaisQueAnterior ? " anotados. " : ""}{linhaDoMeuMes(retro)}
        </div>
      </div>
      {cor && mm.diaForte && (
        <div style={abs({ ...COLUNA, bottom: 34, fontSize: fs(11.5), fontWeight: 500, opacity: 0.62, lineHeight: 1.35 })}>
          * Esta página é {cor.nome} porque {cor.artigo === "o" ? "o seu" : "a sua"} {mm.diaForte.nome.toLowerCase()} foi. A cor do dia mais forte manda na página.
        </div>
      )}
    </>
  );
};

/* ============================================================ dinheiro */

const RESTO = ["#1b1b20", "rgba(27,27,32,.68)", "rgba(27,27,32,.42)", "rgba(27,27,32,.14)"];

const Dinheiro = (p: PropsDinheiro) => {
  const { m, fs } = useMedidas();
  const { retro, revelado } = p;
  const f = retro.financas!;
  const base = retro.base;
  const MM = String(retro.mesIdx + 1).padStart(2, "0");
  const comGasto = new Set(f.diasComGasto);
  const soma = f.topCategories.reduce((s, c) => s + c.pct, 0);
  // o "Resto" também ganha o valor quando a pessoa revela (o que saiu menos as 3 da frente)
  const resto = Math.max(0, f.outflow - f.topCategories.reduce((x, c) => x + c.value, 0));
  const fatias = [...f.topCategories.map((c) => ({ label: c.label, pct: c.pct, value: c.value })), ...(soma < 99.5 ? [{ label: "Resto", pct: 100 - soma, value: resto }] : [])];
  const reais = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
  return (
    <>
      {f.gastosAnotados > 0 ? (
        <BlocoHeroi k={`${numeroDaPagina(p.paginas, "dinheiro")} · Dinheiro`} valor={f.gastosAnotados} rotulo={f.gastosAnotados === 1 ? "gasto anotado" : "gastos anotados"} sub="Cada um deles é uma decisão que você viu acontecer." />
      ) : (
        <BlocoHeroi k={`${numeroDaPagina(p.paginas, "dinheiro")} · Dinheiro`} valor={f.txCount} rotulo="lançamentos no mês" sub="Tudo o que saiu, anotado num lugar só." />
      )}
      {f.topCategories.length > 0 && (
        <div style={abs({ ...COLUNA, top: m(452, 360) })}>
          <div style={{ ...kicker(fs(11)), opacity: 0.7 }}>Pra onde foi</div>
          <div style={{ display: "flex", height: 46, borderRadius: 6, overflow: "hidden", marginTop: 10 }}>
            {fatias.map((c, i) => <i key={c.label} style={{ display: "block", height: "100%", width: `${c.pct}%`, background: RESTO[i] ?? RESTO[3] }} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginTop: 14, fontSize: fs(13.5), fontWeight: 700 }}>
            {fatias.map((c, i) => (
              <span key={c.label} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 6, verticalAlign: -1, background: RESTO[i] ?? RESTO[3] }} />
                {c.label} <span style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>{revelado ? reais(c.value) : `${Math.round(c.pct)}%`}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {f.diasSemGasto !== null && (
        <div style={abs({ ...COLUNA, top: m(600, 492), borderTop: "1px solid rgba(27,27,32,.28)", paddingTop: 14 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: "-.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{f.diasSemGasto}</span>
            <span style={{ ...serif, fontSize: 26, lineHeight: 1 }}>{f.diasSemGasto === 1 ? "dia sem gastar nada" : "dias sem gastar nada"}</span>
          </div>
          <div aria-hidden style={{ display: "grid", gridTemplateColumns: `repeat(${base.dias}, 1fr)`, gap: base.dias > 26 ? 2 : 3, marginTop: 12 }}>
            {Array.from({ length: base.dias }, (_, i) => base.primeiroDia + i).map((d) => (
              <i key={d} style={{ display: "block", height: 22, borderRadius: 3, background: comGasto.has(d) ? "rgba(27,27,32,.14)" : E.grafite }} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: fs(10.5), fontWeight: 700, opacity: 0.6, marginTop: 6 }}>
            <span>{base.primeiroDia}/{MM}</span><span style={{ marginLeft: "auto" }}>{base.ultimoDia}/{MM}</span>
          </div>
        </div>
      )}
      <div style={abs({ left: 28, right: 28, bottom: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 })}>
        {revelado && (
          <div data-testid="valores-revelados" style={{ alignSelf: "stretch", background: "rgba(27,27,32,.1)", borderRadius: 10, padding: "12px 16px" }}>
            <TextoDosValores retro={retro} proximo={p.proximo.nome} />
          </div>
        )}
        <BotaoDosValores revelado={revelado} onRevelar={p.onRevelar} cor="rgba(27,27,32,.72)" fs={fs} style={{ fontSize: fs(12.5) }} />
      </div>
    </>
  );
};

/* ============================================================== corpo */

const Corpo = (p: Base) => {
  const { m, fs } = useMedidas();
  const c = p.retro.corpo!;
  const heroiDe = c.treinos > 0 ? "treinos" : c.agua ? "agua" : "sono";
  const agua = c.agua && heroiDe !== "agua" ? c.agua : null;
  const sono = c.sono && heroiDe !== "sono" ? c.sono : null;
  const k = `${numeroDaPagina(p.paginas, "corpo")} · Corpo`;
  const sub = c.meta
    ? `${c.meta.semanas} ${c.meta.semanas === 1 ? "semana batendo" : "semanas batendo"} a meta de ${c.meta.porSemana} por semana.`
    : `Média de ${c.porSemana.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} por semana.`;
  const linhas = [
    agua && {
      k: "Água na meta", v: `${agua.diasNaMeta} ${agua.diasNaMeta === 1 ? "dia" : "dias"}`,
      s: (
        <div aria-hidden style={{ display: "grid", gridTemplateColumns: `repeat(${Math.ceil(agua.dias.length / 2)}, 1fr)`, gap: 3, width: 130 }}>
          {agua.dias.map((d) => <i key={d.dia} style={{ display: "block", height: 8, borderRadius: 2, background: d.naMeta ? E.creme : "rgba(246,241,231,.22)" }} />)}
        </div>
      ),
    },
    sono && { k: "Sono médio", v: horas(sono.mediaMin), s: legendaDoSono(sono) },
  ].filter(Boolean) as { k: string; v: string; s: ReactNode }[];
  return (
    <>
      {heroiDe === "treinos" ? (
        <BlocoHeroi k={k} valor={c.treinos} rotulo={c.treinos === 1 ? "treino no mês" : "treinos no mês"} sub={sub} />
      ) : heroiDe === "agua" ? (
        <BlocoHeroi k={k} valor={c.agua!.diasNaMeta} rotulo="dias na meta de água" sub={`A meta é de ${c.agua!.meta} copos por dia.`} />
      ) : (
        <BlocoHeroi k={k} texto={horas(c.sono!.mediaMin)} rotulo="de sono por noite" sub={legendaDoSono(c.sono!)} />
      )}
      <div style={abs({ ...COLUNA, top: m(452, 360), display: "flex", flexDirection: "column" })}>
        {c.grupos.length > 0 && (
          <div>
            <div style={{ ...kicker(fs(11)), opacity: 0.75 }}>O que você treinou</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12, textAlign: "center" }}>
              {c.grupos.slice(0, 4).map((g) => (
                <div key={g.grupo} style={{ minWidth: 0 }}>
                  <div style={{ width: 54, height: 54, borderRadius: "50%", boxShadow: "inset 0 0 0 1.5px rgba(246,241,231,.6)", display: "grid", placeItems: "center", margin: "0 auto", color: E.creme }}>
                    <Picto grupo={g.grupo} tam={30} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.04em", marginTop: 8, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{g.dias}</div>
                  <div style={{ fontSize: fs(10.5), fontWeight: 800, letterSpacing: g.rotulo.length > 8 ? ".06em" : ".14em", opacity: 0.75, marginTop: 3, textTransform: "uppercase", whiteSpace: "nowrap" }}>{g.rotulo}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {linhas.length > 0 && <Lista linhas={linhas} style={{ marginTop: c.grupos.length ? m(43, 12) : 0 }} />}
        {c.recorde && (
          <div style={{ marginTop: m(40, 16), marginLeft: 6, transform: "rotate(-4deg)", transformOrigin: "left center" }}>
            <span style={{ display: "inline-block", padding: "9px 14px", border: "2px solid currentColor", borderRadius: 6, fontSize: 12.5, fontWeight: 900, letterSpacing: ".16em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              Novo recorde · {c.recorde.exercicio} {c.recorde.carga > 0 ? `${c.recorde.carga.toLocaleString("pt-BR")} kg` : `${c.recorde.reps} reps`}
            </span>
          </div>
        )}
      </div>
    </>
  );
};

/* ================================================== como você estava */

const OPACIDADE: Record<number, number> = { 5: 1, 4: 0.78, 3: 0.56, 2: 0.38, 1: 0.24 };

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
  const tam = palavra ? tamanhoQueCabe([palavra], { familia: "inter", peso: 900, espaco: -0.05 }, 374, t(128, 104)) : 0;
  const k = `${numeroDaPagina(p.paginas, "humor")} · Como você estava`;
  return (
    <>
      {palavra ? (
        <div style={abs({ ...COLUNA, top: m(96, 84) })}>
          <div style={{ ...kicker(fs(11)), opacity: 0.7 }}>{k}</div>
          <div style={{ fontSize: 17, fontWeight: 600, opacity: 0.8, marginTop: m(22, 14) }}>Na maior parte dos dias, você esteve</div>
          <div style={{ ...heroi, fontSize: tam, letterSpacing: "-.05em", lineHeight: 0.85, marginTop: 2, whiteSpace: "nowrap" }}>{palavra}</div>
          <div style={{ fontSize: fs(14), fontWeight: 500, opacity: 0.78, marginTop: m(14, 10) }}>
            {s.pesado ? "Registrar como você estava já é um jeito de se cuidar." : bons > 0 ? `${bons} de ${total} ${total === 1 ? "dia" : "dias"} bem ou melhor` : `${total} ${total === 1 ? "dia" : "dias"} com o humor anotado`}
          </div>
        </div>
      ) : (
        <BlocoHeroi k={k} valor={s.diasDeDiario || s.gratidoes} rotulo={s.diasDeDiario > 0 ? (s.diasDeDiario === 1 ? "dia de diário" : "dias de diário") : "coisas pelas quais você agradeceu"} />
      )}
      {s.porDia.length > 0 && (
        <div style={abs({ ...COLUNA, top: m(376, 296) })}>
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", rowGap: 6 }}>
            <span style={{ ...kicker(fs(11)), opacity: 0.7, whiteSpace: "nowrap" }}>Seu humor, dia a dia</span>
            <span aria-hidden style={{ marginLeft: "auto", display: "flex", gap: 8, fontSize: fs(9.5), fontWeight: 700, opacity: 0.75 }}>
              {[["ótimo", 5], ["bem", 4], ["ok", 3], ["mal", 2]].map(([n, v]) => (
                <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: E.grafite, opacity: OPACIDADE[v as number] }} />{n}</span>
              ))}
            </span>
          </div>
          <div aria-hidden style={{ display: "flex", alignItems: "flex-end", gap: retro.base.diasDoMes > 30 ? 3 : 4, height: m(110, 80), marginTop: 12 }}>
            {Array.from({ length: retro.base.diasDoMes }, (_, i) => {
              const n = nota.get(i + 1);
              const nivel = n ? Math.min(5, Math.max(1, Math.round(n))) : 0;
              return (
                <i key={i} style={{ flex: 1, display: "block", borderRadius: "3px 3px 1px 1px", boxSizing: "border-box", ...(nivel ? { height: `${nivel * 20}%`, background: E.grafite, opacity: OPACIDADE[nivel] } : { height: "20%", border: "1px dotted rgba(27,27,32,.4)" }) }} />
              );
            })}
          </div>
          <div style={{ display: "flex", fontSize: fs(10.5), fontWeight: 700, opacity: 0.6, marginTop: 6 }}><span>1/{MM}</span><span style={{ marginLeft: "auto" }}>{retro.base.diasDoMes}/{MM}</span></div>
        </div>
      )}
      {s.frase && (
        <div data-testid="frase-da-pessoa" style={abs({ ...COLUNA, top: s.porDia.length ? m(582, 470) : m(420, 350), borderTop: "1px solid rgba(27,27,32,.28)", paddingTop: 14 })}>
          <div style={{ ...kicker(fs(10.5)), opacity: 0.7 }}>{s.frase.quando ? `Você escreveu · ${s.frase.quando}` : `Você escreveu sobre ${retro.mes.toLowerCase()}`}</div>
          <div style={{ ...serif, fontSize: t(30, 26), lineHeight: 1.08, marginTop: 8 }}>“{s.frase.texto}”</div>
        </div>
      )}
      {(partes.length > 0 || escreveu) && (
        <div style={abs({ ...COLUNA, bottom: 34, fontSize: fs(12), fontWeight: 600, opacity: 0.7, lineHeight: 1.5 })}>
          {partes.length > 0 && <div>{partes.join(" · ")}</div>}
          {escreveu && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Cadeado />O que você escreve nunca vai pro card.</span>}
        </div>
      )}
    </>
  );
};

/* ============================================================== foco */

const Foco = (p: PropsFoco) => {
  const { m, t, fs } = useMedidas();
  const { opcoes, escolha, texto, salvo } = p;
  const proximo = p.proximo.nome.toLowerCase();
  const foco = (texto.trim() || escolha || "").trim();
  const radio = (on: boolean): CSSProperties => ({
    position: "absolute", left: 0, top: 17, width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center",
    ...(on ? { background: E.magenta } : { boxShadow: "inset 0 0 0 1.5px rgba(246,241,231,.6)" }),
  });
  return (
    <>
      <div style={abs({ ...COLUNA, top: m(96, 84) })}>
        <div style={{ ...kicker(fs(11)), color: E.magentaClaro }}>{numeroDaPagina(p.paginas, "foco")} · Foco de {proximo}</div>
        <div style={{ ...serif, fontSize: t(54, 46), lineHeight: 0.98, marginTop: m(18, 12) }}>Escolha 1 foco<br />pro mês.</div>
        <div style={{ fontSize: fs(14), fontWeight: 500, opacity: 0.72, marginTop: m(14, 10), lineHeight: 1.4 }}>Uma coisa só, a partir do que você já faz. Fica anotado na sua Rotina, na aba Mês.</div>
      </div>
      {salvo ? (
        <div data-testid="foco-salvo" style={abs({ ...COLUNA, top: m(322, 270), borderTop: "1px solid rgba(246,241,231,.28)", paddingTop: 16 })}>
          <div style={{ ...kicker(fs(10.5)), color: E.magentaClaro }}>Anotado</div>
          <div style={{ ...serif, fontSize: 30, lineHeight: 1.1, marginTop: 8 }}>“{salvo}”</div>
          <button type="button" onClick={(e) => { e.stopPropagation(); p.onFechar(); }} style={{ marginTop: m(40, 26), width: "100%", height: 48, borderRadius: 12, background: E.creme, color: E.grafite, fontSize: 14, fontWeight: 800, border: 0, fontFamily: "inherit" }}>
            Fechar a retrospectiva
          </button>
        </div>
      ) : (
        <>
          <div style={abs({ ...COLUNA, top: m(322, 262) })}>
            {opcoes.map((o) => {
              const on = !texto.trim() && escolha === o.texto;
              return (
                <button
                  key={o.texto}
                  type="button"
                  aria-pressed={on}
                  onClick={(e) => { e.stopPropagation(); p.onEscolha(o.texto); }}
                  style={{ position: "relative", display: "block", width: "100%", textAlign: "left", background: "none", border: 0, borderTop: "1px solid rgba(246,241,231,.28)", padding: `${m(14, 10)}px 0 ${m(14, 10)}px 36px`, color: "inherit", fontFamily: "inherit" }}
                >
                  <i aria-hidden style={radio(on)}>
                    {on && <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
                  </i>
                  <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.01em" }}>{o.texto}</div>
                  {o.contexto && <div style={{ fontSize: fs(12.5), opacity: 0.65, marginTop: 2 }}>{o.contexto}</div>}
                </button>
              );
            })}
            <div style={{ borderTop: "1px solid rgba(246,241,231,.28)", borderBottom: "1px solid rgba(246,241,231,.28)", padding: `${m(14, 10)}px 0` }}>
              <div style={{ ...kicker(fs(10)), opacity: 0.7 }}>Ou escreva o seu</div>
              <input
                value={texto}
                onChange={(e) => p.onTexto(e.target.value.slice(0, 80))}
                onClick={(e) => e.stopPropagation()}
                placeholder={`Em ${proximo} eu vou…`}
                aria-label="Seu foco pro mês"
                style={{ display: "block", width: "100%", marginTop: 8, border: 0, background: "transparent", padding: "0 0 2px", fontSize: 16, color: E.creme, outline: "none", fontFamily: "inherit" }}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!foco}
            onClick={(e) => { e.stopPropagation(); p.onSalvar(); }}
            style={{ ...abs({ ...COLUNA, top: m(700, 584) }), height: 48, borderRadius: 12, background: E.magenta, color: "#fff", fontSize: 14, fontWeight: 800, border: 0, opacity: foco ? 1 : 0.45, fontFamily: "inherit" }}
          >
            Guardar foco
          </button>
          <div style={abs({ ...COLUNA, top: m(762, 644), textAlign: "center", fontSize: fs(12), opacity: 0.55 })}>Você pode trocar o foco quando quiser.</div>
        </>
      )}
    </>
  );
};

/* ================================================ versão curta: o fato */

const Fato = (p: PropsFato) => {
  const { m, t, fs } = useMedidas();
  const { fato } = p;
  return (
    <>
      <BlocoHeroi k="02 · 1 fato de verdade" valor={fato.valor} rotulo={fato.rotulo} sub={fato.sub} />
      <div style={abs({ ...COLUNA, top: m(520, 420), borderTop: "1px solid rgba(255,255,255,.28)", paddingTop: 14 })}>
        <div style={{ ...kicker(fs(10.5)), opacity: 0.72 }}>Por que isso importa</div>
        <div style={{ ...serif, fontSize: t(32, 28), lineHeight: 1.05, marginTop: 6 }}>{fato.porque}</div>
      </div>
      {fato.dinheiro && (
        <div style={abs({ left: 0, right: 0, bottom: 34, textAlign: "center", fontSize: fs(12.5), fontWeight: 600, opacity: 0.72 })}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Cadeado />Os valores em R$ ficam só com você.</span>
        </div>
      )}
    </>
  );
};

/* ============================================== versão curta: o fecho */

const Fecho = (p: PropsFecho) => {
  const { m, t, fs } = useMedidas();
  const proximo = p.proximo.nome;
  return (
    <>
      <div style={abs({ ...COLUNA, top: m(250, 186) })}>
        <div style={{ ...kicker(fs(11)), opacity: 0.85 }}>03 · {p.recente ? proximo : "Até a próxima"}</div>
        <div style={{ ...serif, fontSize: t(72, 60), lineHeight: 0.95, marginTop: 16 }}>Cada registro conta.</div>
        <div style={{ fontSize: fs(15), fontWeight: 500, opacity: 0.9, marginTop: m(22, 16), lineHeight: 1.45, maxWidth: 320 }}>{fraseDoFecho(p.recente, proximo)}</div>
      </div>
      <button type="button" onClick={(e) => { e.stopPropagation(); p.onFechar(); }} style={{ ...abs({ ...COLUNA, top: m(640, 520) }), height: 48, borderRadius: 12, background: E.creme, color: E.grafite, fontSize: 14, fontWeight: 800, border: 0, fontFamily: "inherit" }}>
        Voltar pro planner
      </button>
      {p.podeFocar && (
        <button type="button" onClick={(e) => { e.stopPropagation(); p.onFocar(); }} style={{ ...abs({ ...COLUNA, top: m(702, 580) }), background: "none", border: 0, textAlign: "center", fontSize: fs(12.5), opacity: 0.85, color: "inherit", padding: "4px 0", fontFamily: "inherit" }}>
          Escolher 1 foco pra {proximo.toLowerCase()} →
        </button>
      )}
    </>
  );
};

/* ================================================ o card: capa da revista */

/** Código de barras determinístico (a mesma sequência sempre). */
const CodigoDeBarras = ({ n, escala = 1 }: { n: number; escala?: number }) => {
  const barras = useMemo(() => {
    let s = 7;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    return Array.from({ length: n }, () => ({ w: (1 + Math.floor(r() * 3)) * escala, o: r() > 0.15 ? 1 : 0.55 }));
  }, [n, escala]);
  return (
    <div aria-hidden style={{ display: "flex", alignItems: "flex-end", gap: 2, height: "100%" }}>
      {barras.map((b, i) => <i key={i} style={{ display: "block", width: b.w, height: "100%", background: "currentColor", opacity: b.o }} />)}
    </div>
  );
};

const GR = {
  app: {
    w: 354, h: 630, raio: 6, moldura: 12, molduraW: 1.5, lado: 26,
    masthead: { topo: 24, tam: 92, linha: 9.5, linhaMt: 10, fioMt: 8, fio: 1 },
    bloco: { topo: 176, kicker: 9.5, perfil: 50, perfilMt: 8, frase: 17, fraseMt: 12 },
    linhas: { topo: 376, dir: 110, n: 26, l: 12, pad: 8, fio: 1, max: 4 },
    barras: { dir: 26, base: 24, w: 70, h: 34, n: 34, escala: 1 },
    vertical: { dir: 22, topo: 376, w: 200, tam: 9.5 },
    url: { tam: 9 },
  },
  stories: {
    w: 1080, h: 1920, raio: 0, moldura: 36, molduraW: 3, lado: 92,
    masthead: { topo: 262, tam: 236, linha: 24, linhaMt: 26, fioMt: 20, fio: 3 },
    bloco: { topo: 610, kicker: 26, perfil: 142, perfilMt: 22, frase: 46, fraseMt: 30 },
    linhas: { topo: 1120, dir: 428, n: 66, l: 28, pad: 20, fio: 2, max: 3 },
    barras: { dir: 92, base: 408, w: 200, h: 92, n: 44, escala: 2.2 },
    vertical: { dir: 78, topo: 1330, w: 720, tam: 26 },
    url: { tam: 22 },
  },
} as const;

/** A capa da revista do mês (o card próprio do tema; 354×630 no app, 1080×1920 nos Stories). */
export const CardRevista = ({ c, formato = "app", testId }: { c: ConteudoDoCard; formato?: "app" | "stories"; testId?: string }) => {
  const g = GR[formato];
  const fontes = useFontesProntas();
  const largura = g.w - 2 * g.lado;
  const perfil = useMemo(() => {
    const linhas = emDuasLinhas(c.perfil);
    return { linhas, tam: tamanhoQueCabe(linhas, { familia: "inter", peso: 900, espaco: -0.045 }, largura, g.bloco.perfil) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.perfil, formato, fontes]);
  const frase = c.frase.includes(", ") ? [c.frase.slice(0, c.frase.indexOf(", ") + 1), c.frase.slice(c.frase.indexOf(", ") + 2)] : [c.frase];
  const MES = c.mes.toUpperCase();
  const edicao = c.nome ? `Edição de ${c.nome}` : `Edição de ${c.mes.toLowerCase()}`;
  return (
    <div
      data-testid={testId}
      data-card="revista"
      style={{ position: "relative", width: g.w, height: g.h, overflow: "hidden", background: E.magenta, color: E.creme, borderRadius: g.raio, fontFamily: INTER, WebkitFontSmoothing: "antialiased" }}
    >
      <div aria-hidden style={{ position: "absolute", inset: g.moldura, border: `${g.molduraW}px solid rgba(246,241,231,.45)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: g.lado, right: g.lado, top: g.masthead.topo }}>
        <div style={{ fontSize: g.masthead.tam, fontWeight: 900, letterSpacing: "-.06em", lineHeight: 0.8 }}>CORE</div>
        <div style={{ display: "flex", fontSize: g.masthead.linha, fontWeight: 800, letterSpacing: formato === "app" ? ".2em" : ".22em", marginTop: g.masthead.linhaMt, opacity: 0.9 }}>
          <span>Nº {numeroDaEdicao(c.mesIdx)} · {MES} DE {c.ano}</span><span style={{ marginLeft: "auto" }}>RETROSPECTIVA</span>
        </div>
        <div style={{ height: g.masthead.fio, background: "rgba(246,241,231,.45)", marginTop: g.masthead.fioMt }} />
      </div>
      <div style={{ position: "absolute", left: g.lado, right: g.lado, top: g.bloco.topo }}>
        <div style={{ fontSize: g.bloco.kicker, fontWeight: 800, letterSpacing: ".2em", textTransform: "uppercase", opacity: 0.9 }}>{c.abertura}</div>
        <div style={{ fontSize: perfil.tam, fontWeight: 900, letterSpacing: "-.045em", lineHeight: formato === "app" ? 0.9 : 0.88, marginTop: g.bloco.perfilMt }}>
          {perfil.linhas.map((l, i) => <span key={i} style={{ display: "block" }}>{l}</span>)}
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: g.bloco.frase, lineHeight: formato === "app" ? 1.2 : 1.15, marginTop: g.bloco.fraseMt, opacity: 0.95 }}>
          {frase.map((l, i) => <span key={i} style={{ display: "block" }}>{l}</span>)}
        </div>
      </div>
      <div style={{ position: "absolute", left: g.lado, right: g.linhas.dir, top: g.linhas.topo }}>
        {c.linhas.slice(0, g.linhas.max).map((l) => (
          <div key={l.rotulo} style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "baseline", columnGap: formato === "app" ? 10 : 18, padding: `${g.linhas.pad}px 0`, borderTop: `${g.linhas.fio}px solid rgba(246,241,231,.35)` }}>
            <span style={{ fontSize: l.valor.length > 6 ? g.linhas.n * 0.78 : g.linhas.n, fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{l.valor}</span>
            <span style={{ fontSize: g.linhas.l, fontWeight: 600, opacity: 0.9, lineHeight: 1.2 }}>{l.rotulo}</span>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", right: g.barras.dir, bottom: g.barras.base, width: g.barras.w, height: g.barras.h }}>
        <CodigoDeBarras n={g.barras.n} escala={g.barras.escala} />
      </div>
      <div
        style={{
          position: "absolute", right: g.vertical.dir, top: g.vertical.topo, width: g.vertical.w, transform: "rotate(90deg)", transformOrigin: "right top",
          fontSize: g.vertical.tam, fontWeight: 800, letterSpacing: ".2em", textTransform: "uppercase", opacity: 0.9, whiteSpace: "nowrap", textAlign: "right",
        }}
      >
        {formato === "app" ? `${edicao} · ${c.ano}` : `${edicao} · ${c.mes.toLowerCase()} de ${c.ano}`}
      </div>
      <div
        style={formato === "app"
          ? { position: "absolute", left: g.lado, bottom: 22, fontSize: g.url.tam, fontWeight: 600, letterSpacing: ".08em", opacity: 0.85 }
          : { position: "absolute", right: g.lado, top: 1524, fontSize: g.url.tam, fontWeight: 600, letterSpacing: ".08em", opacity: 0.9, textAlign: "right" }}
      >
        coreaplicativo.com.br
      </div>
    </div>
  );
};

export const StoryRevista = ({ c }: { c: ConteudoDoCard }) => <CardRevista c={c} formato="stories" />;

/* ============================================================== a pele */

const cor = (clara: boolean, conteudo: ReactNode, bg: string) => pagina(bg, conteudo, clara);

export const PELE_EDICAO: Pele = {
  capa: (p) => cor(false, <Capa {...p} />, E.grafite),
  capaCurta: (p) => cor(false, <CapaCurta {...p} />, E.grafite),
  meuMes: (p) => {
    const d = p.retro.meuMes?.diaForte;
    const c = d ? COR_DO_DIA_NA_REVISTA[d.dia] : null;
    return cor(!!c?.clara, <MeuMes {...p} />, c?.cor ?? E.indigo);
  },
  dinheiro: (p) => cor(true, <Dinheiro {...p} />, E.ambar),
  corpo: (p) => cor(false, <Corpo {...p} />, E.azul),
  humor: (p) => cor(true, <Humor {...p} />, E.rosa),
  foco: (p) => cor(false, <Foco {...p} />, E.grafite),
  fato: (p) => cor(false, <Fato {...p} />, E.indigo),
  fecho: (p) => cor(false, <Fecho {...p} />, E.magenta),
  card: {
    fundoCor: E.grafite,
    moldura: ESCURA,
    linha: { bg: "rgba(246,241,231,.08)", fg: E.creme, trilhoOff: "rgba(246,241,231,.25)" },
    salvar: { bg: "transparent", fg: E.creme, borda: "1.5px solid rgba(246,241,231,.4)" },
    postar: { bg: E.creme, fg: E.grafite },
    proxima: "rgba(246,241,231,.6)",
    seg: { bg: "rgba(246,241,231,.12)", fg: E.creme, onBg: E.creme, onFg: E.grafite },
  },
  folha: { bg: "#26262c", fg: E.creme, acento: E.magentaClaro },
};
