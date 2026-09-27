import { useMemo, type CSSProperties } from "react";
import type { ConteudoDoCard } from "@/lib/retrospectiva";
import { SERIF, INTER, TextoFoil, tamanhoQueCabe, useFontesProntas } from "./prancheta";
import { Espiral, Etiqueta, Fita, Grade30, Lacre, P3, creme, fio, kicker, linho, relevo, rot, semanasDoMes, serif, vinheta } from "./pecas-planner";
import { linhasDoPerfil } from "./temas";

/**
 * O CARD FINAL (26/09, sistema de temas) — a página do planner como objeto,
 * "Setembro, fechado.": etiqueta com o nome, o perfil do mês em foil, 3
 * números, os dias do mês em foil e o lacre. É o card de TODOS os temas (na
 * revista e nos recortes, o card do próprio tema é a opção secundária).
 *
 * Dois formatos da mesma peça (medidas do componentes.js / d3.html):
 * "app" (354×630, na tela do card) e "stories" (760×1080, dentro da arte
 * 1080×1920 que o gerador fotografa). O foil do perfil e dos números é SVG:
 * `background-clip: text` não sai na foto do Safari.
 * Sem R$ por padrão; o texto da pessoa nunca entra (ver conteudoDoCard).
 */

type Formato = "app" | "stories";

const G = {
  app: {
    w: 354, h: 630, esq: 14, raio: "5px 18px 18px 5px", sombra: "0 22px 44px -20px rgba(0,0,0,.65)", inset: 1, trama: 3,
    espiral: { n: 9, passo: 66, topo: 24, w: 13, h: 24, caixa: 30 },
    fita: { dir: 44, topo: -4, h: 250, w: 14, bico: 9 },
    etiqueta: { esq: 40, topo: 34, w: 216, pad: "10px 14px 11px", raio: 5, moldura: 4, esp: 1, raioM: 3, rot: 9.5, nome: 30, nomeMt: 3, resumo: 10.5, resumoMt: 5 },
    perfil: { esq: 40, dir: 26, topo: 150, kicker: 9.5, tam: 52, mt: 6, sombra: "drop-shadow(0 2px 2px rgba(0,0,0,.6))" },
    numeros: { topo: 290, gap: 8, tam: 34, rot: 9.5, mt: 3 },
    grade: { topo: 372, fio: 1, kicker: 9, kickerMt: 10, mt: 8, gap: 4, largura: 226, check: 9 },
    lacre: { dir: 22, base: 14, tam: 86 },
    marca: { esq: 40, base: 16, tam: 17 },
    url: { esq: 40, base: 40, tam: 8.5 },
  },
  stories: {
    w: 760, h: 1080, esq: 34, raio: "10px 44px 44px 10px", sombra: "0 60px 90px -40px rgba(0,0,0,.6)", inset: 2, trama: 7,
    espiral: { n: 13, passo: 82, topo: 28, w: 32, h: 60, caixa: 70 },
    fita: { dir: 100, topo: -8, h: 400, w: 30, bico: 20 },
    etiqueta: { esq: 100, topo: 80, w: 430, pad: "24px 30px 26px", raio: 12, moldura: 10, esp: 2, raioM: 7, rot: 20, nome: 66, nomeMt: 6, resumo: 23, resumoMt: 12 },
    perfil: { esq: 100, dir: 60, topo: 300, kicker: 22, tam: 108, mt: 12, sombra: "drop-shadow(0 4px 4px rgba(0,0,0,.6))" },
    numeros: { topo: 560, gap: 16, tam: 76, rot: 21, mt: 8 },
    grade: { topo: 716, fio: 2, kicker: 20, kickerMt: 18, mt: 14, gap: 6, largura: 280, check: 18 },
    lacre: { dir: 70, base: 44, tam: 200 },
    marca: { esq: 100, base: 22, tam: 44 },
    url: { esq: 232, base: 34, tam: 20 },
  },
} as const;

export const MEDIDAS_DO_CARD = { app: { w: G.app.w, h: G.app.h }, stories: { w: G.stories.w, h: G.stories.h } };

/** A página do planner no tamanho de desenho (354×630 ou 760×1080). */
export const CardPlanner = ({ c, formato = "app", testId }: { c: ConteudoDoCard; formato?: Formato; testId?: string }) => {
  const g = G[formato];
  const fontes = useFontesProntas();
  const MES = c.mes.toUpperCase();
  const larguraUtil = g.w - g.perfil.esq - g.perfil.dir;
  const perfil = useMemo(() => {
    const linhas = linhasDoPerfil(c.perfil, g.perfil.tam, larguraUtil);
    return { linhas, tam: tamanhoQueCabe(linhas, { familia: "serif", italico: true }, larguraUtil, g.perfil.tam) };
    // `fontes`: remede quando a serifada chega
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.perfil, formato, fontes]);
  const colunas = 3;
  const larguraDaColuna = (larguraUtil - (colunas - 1) * g.numeros.gap) / colunas;
  // o mês de 6 semanas encolhe a grade pra caber na mesma altura (e não encostar no lacre)
  const semanas = semanasDoMes(c.ano, c.mesIdx);
  const celula5 = (g.grade.largura - 6 * g.grade.gap) / 7;
  const alturaMax = 5 * celula5 + 4 * g.grade.gap;
  const larguraDaGrade = semanas > 5 ? ((alturaMax - (semanas - 1) * g.grade.gap) / semanas) * 7 + 6 * g.grade.gap : g.grade.largura;
  const tamNome = c.nome && c.nome.length > 13 ? g.etiqueta.nome * 0.84 : g.etiqueta.nome;

  const caixa: CSSProperties = { position: "relative", width: g.w, height: g.h, fontFamily: INTER, WebkitFontSmoothing: "antialiased", color: P3.creme };
  return (
    <div style={caixa} data-testid={testId} data-card="planner">
      <div
        style={{
          position: "absolute", left: g.esq, top: 0, right: 0, bottom: 0, borderRadius: g.raio, ...linho(g.trama),
          boxShadow: `${g.sombra}, inset 0 0 0 ${g.inset}px rgba(255,255,255,.06)`,
        }}
      />
      <div style={{ ...vinheta, left: g.esq, borderRadius: g.raio }} />
      <Espiral n={g.espiral.n} passo={g.espiral.passo} topo={g.espiral.topo} esquerda={g.esq} w={g.espiral.w} h={g.espiral.h} caixa={g.espiral.caixa} />
      <Fita style={{ right: g.fita.dir, top: g.fita.topo, height: g.fita.h }} largura={g.fita.w} bico={g.fita.bico} />

      <Etiqueta
        style={{ left: g.etiqueta.esq, top: g.etiqueta.topo, width: g.etiqueta.w, padding: g.etiqueta.pad, borderRadius: g.etiqueta.raio, transform: "rotate(-1.2deg)" }}
        moldura={g.etiqueta.moldura}
        espessura={g.etiqueta.esp}
        raioMoldura={g.etiqueta.raioM}
      >
        <div style={rot(g.etiqueta.rot)}>{c.nome ? `O ${c.mes.toLowerCase()} de` : "Retrospectiva"}</div>
        <div style={{ ...serif, fontSize: tamNome, lineHeight: 1, marginTop: g.etiqueta.nomeMt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingBottom: 2 }}>
          {c.nome ?? `O seu ${c.mes.toLowerCase()}`}
        </div>
        <div style={{ fontSize: g.etiqueta.resumo, color: P3.tintaEtiqueta, marginTop: g.etiqueta.resumoMt, fontWeight: 500 }}>{c.resumo}</div>
      </Etiqueta>

      <div style={{ position: "absolute", left: g.perfil.esq, right: g.perfil.dir, top: g.perfil.topo }}>
        <div style={kicker(g.perfil.kicker)}>Perfil do mês</div>
        <div style={{ marginTop: g.perfil.mt }}>
          <TextoFoil
            linhas={perfil.linhas}
            tamanho={perfil.tam}
            fonte={{ familia: "serif", italico: true }}
            largura={larguraUtil}
            alturaDaLinha={0.92}
            baseline={0.78}
            sombra={g.perfil.sombra}
            pronto={fontes > 0}
            testId="perfil-do-card"
          />
        </div>
      </div>

      <div style={{ position: "absolute", left: g.perfil.esq, right: g.perfil.dir, top: g.numeros.topo, display: "grid", gridTemplateColumns: `repeat(${colunas}, 1fr)`, gap: g.numeros.gap }}>
        {c.numeros.slice(0, 3).map((n) => {
          const tam = tamanhoQueCabe([n.valor], { familia: "inter", peso: 900, espaco: -0.05 }, larguraDaColuna, g.numeros.tam);
          return (
            <div key={n.rotulo} style={{ minWidth: 0 }}>
              <div style={{ height: g.numeros.tam, display: "flex", alignItems: "flex-end" }}>
                <TextoFoil linhas={[n.valor]} tamanho={tam} fonte={{ familia: "inter", peso: 900, espaco: -0.05 }} largura={larguraDaColuna} baseline={0.76} pronto />
              </div>
              <div style={{ fontSize: g.numeros.rot, fontWeight: 800, letterSpacing: ".16em", color: creme(0.7), marginTop: g.numeros.mt, lineHeight: 1.15 }}>{n.rotulo}</div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: g.perfil.esq, right: g.perfil.dir, top: g.grade.topo }}>
        <div style={fio(g.grade.fio)} />
        <div style={{ ...kicker(g.grade.kicker), marginTop: g.grade.kickerMt }}>Os {c.tira.total} dias</div>
        <div style={{ marginTop: g.grade.mt }}>
          <Grade30 ano={c.ano} mesIdx={c.mesIdx} marcados={c.tira.marcados} primeiroDia={c.primeiroDia} largura={larguraDaGrade} gap={g.grade.gap} check={g.grade.check} />
        </div>
      </div>

      <Lacre
        texto={`${MES} · ${c.ano} · FECHADO · `}
        titulo={`${MES} · ${c.ano} · FECHADO`}
        tamanho={g.lacre.tam}
        style={{ right: g.lacre.dir, bottom: g.lacre.base, transform: "rotate(-8deg)" }}
      />
      <div aria-hidden style={{ ...relevo, position: "absolute", left: g.marca.esq, bottom: g.marca.base, fontSize: g.marca.tam, fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1 }}>core</div>
      <div style={{ position: "absolute", left: g.url.esq, bottom: g.url.base, fontSize: g.url.tam, fontWeight: 600, letterSpacing: ".08em", color: creme(0.45) }}>coreaplicativo.com.br</div>
    </div>
  );
};

/** A arte dos Stories (1080×1920): "Setembro, fechado." e a página em pé sobre a mesa rosada. */
export const StoryPlanner = ({ c }: { c: ConteudoDoCard }) => (
  <div
    data-stories="retrospectiva-planner"
    style={{ position: "relative", width: 1080, height: 1920, overflow: "hidden", background: "linear-gradient(180deg,#f3e6e9 0%,#ecdde3 100%)", fontFamily: INTER, WebkitFontSmoothing: "antialiased" }}
  >
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 40% at 50% 38%,rgba(255,255,255,.55),transparent 70%)" }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 268, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 84, lineHeight: 1, color: P3.grafite }}>
      {c.mes}, fechado.
    </div>
    <div style={{ position: "absolute", left: 160, top: 400 }}>
      <CardPlanner c={c} formato="stories" />
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 1516, textAlign: "center", fontSize: 24, fontWeight: 600, letterSpacing: ".22em", color: "#8c7a80" }}>
      CORE · ORGANIZE SUA VIDA
    </div>
  </div>
);
