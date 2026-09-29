import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { BookOpen, Check, Droplets, Dumbbell, Flag, Flame, Moon, PiggyBank, Sparkles, Sprout, Star, type LucideIcon } from "lucide-react";
import { Adesivo } from "@/components/conquistas/adesivos-arte";
import { AnelRaridadeSvg } from "@/components/conquistas/adesivos-raridade";
import { AssinaturaCore, IconeCore, INTER, SERIF } from "./marca";
import { CalendarioDoMes, FaixaDeSemanas, Numero, Rotulo, type CoresDoCalendario } from "./pecas";
import { caminhoDaOnda } from "./onda";
import { LETRAS_DA_SEMANA, diasMarcadosNoMes, maiorCorrida } from "./calendario";
import { TEMAS, fundoDo, temaDaCor, type TemaDoCard } from "./temas";
import { FORMATOS, type DadosNumero, type DadosAgua, type DadosAzul, type DadosCard, type DadosFigurinha, type DadosHabitos, type DadosInsignia, type DadosLivros, type DadosMetas, type DadosPoupanca, type DadosSequencia, type DadosSono, type DadosTreinos, type Formato, type Livro, type NivelMoeda } from "./tipos";
import { capitalizar, desdeMes, diaDoMes, diasNoMes, lerMesId, mesAno, mesCurto, nomeDoMes, numeroBR, palavra, plural, porcento, reais, UNIDADES } from "./textos";

/**
 * OS CARDS DE COMPARTILHAR (29/09, direção A · PÔSTER — escolhida entre 3;
 * as outras duas ficam em /dev/compartilhar): um bloco de cor por assunto,
 * o NÚMERO gigante e a PROVA daquele assunto (o calendário dos treinos, a
 * água do saldo, as capas dos livros, as chamas da sequência…). A marca é o
 * ícone do app pequeno + o @, embaixo. Tudo em estilo inline e cor fixa: a
 * foto (html-to-image) não pode depender do tema do aparelho.
 *
 * Três formatos: stories (1080×1920, também o Status do WhatsApp), feed
 * (1080×1350) e adesivo (1080×1080 com fundo TRANSPARENTE — o cartão pra
 * pôr em cima da própria foto no Instagram).
 *
 * CAMADAS (o vídeo): o mesmo card renderizado com `camada` mostra só uma
 * parte, no MESMO lugar — "fundo" (cor, textura, cabeçalho), "apagado" (a
 * prova sem nada aceso), "aceso" (só o que acende), "textos" (rótulo,
 * estatísticas, assinatura). O número nunca entra numa camada: o vídeo
 * conta em cima dele (mede onde ele fica no "tudo").
 */

export type Camada = "tudo" | "fundo" | "apagado" | "aceso" | "textos";
const CamadaCtx = createContext<Camada>("tudo");
const useCamada = () => useContext(CamadaCtx);

/** Mostra os filhos só na camada `de` (e sempre no "tudo"). Sem `de`: só no "tudo". */
const Na = ({ de = [], children, style, bloco }: { de?: Camada | Camada[]; children: ReactNode; style?: CSSProperties; bloco?: string }) => {
  const c = useCamada();
  const ok = c === "tudo" || ([] as Camada[]).concat(de).includes(c);
  return <div data-bloco={bloco} style={{ ...style, visibility: ok ? undefined : "hidden" }}>{children}</div>;
};

const ICONES: Record<DadosCard["tipo"], LucideIcon> = {
  treinos: Dumbbell, azul: PiggyBank, poupanca: PiggyBank, livros: BookOpen, sequencia: Flame, agua: Droplets,
  sono: Moon, habitos: Sprout, metas: Flag, insignia: Sparkles, figurinha: Sparkles, numero: Star,
};

/* ------------------------------------------------------------------------- *
 * Moldura: fundo, textura, cabeçalho (chip + período), assinatura
 * ------------------------------------------------------------------------- */

const MARGEM = 84;
/** Onde começa e termina o conteúdo em cada formato (a zona segura dos Stories). */
const CAIXA = {
  stories: { topo: 250, conteudo: 356, fim: 1556, assinatura: 1596 },
  feed: { topo: 64, conteudo: 156, fim: 1196, assinatura: 1230 },
} as const;

const textura = (cor: string): CSSProperties => ({ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, ${cor} 1.6px, transparent 1.9px)`, backgroundSize: "44px 44px" });

interface PropsMoldura {
  tipo: DadosCard["tipo"];
  formato: "stories" | "feed";
  tema?: TemaDoCard;
  /** "SETEMBRO 2026" · "DESDE MARÇO" */
  periodo: string;
  /** O nome no chip (padrão: o do tema). */
  modulo?: string;
  children: ReactNode;
  /** Por trás do conteúdo e na camada "fundo" (água, raios). */
  cenario?: ReactNode;
  /** Por trás do conteúdo, fora de todas as camadas (o vídeo desenha: a água). */
  cenarioVivo?: ReactNode;
  /** A cor da assinatura quando ela fica em cima de outra coisa (a água). */
  tomAssinatura?: string;
  /** O ícone do assunto enorme e quase transparente atrás do número (padrão: sim). */
  marcaDagua?: boolean;
}

export const Moldura = ({ tipo, formato, tema = TEMAS[tipo], periodo, modulo, children, cenario, cenarioVivo, tomAssinatura, marcaDagua = true }: PropsMoldura) => {
  const c = useCamada();
  const { w, h } = FORMATOS[formato];
  const cx = CAIXA[formato];
  const Icone = ICONES[tipo];
  const claro = tema.tinta !== "#ffffff";
  const comFundo = c === "tudo" || c === "fundo";
  return (
    <div data-card={tipo} data-formato={formato} data-camada={c} style={{ position: "relative", width: w, height: h, overflow: "hidden", fontFamily: INTER, WebkitFontSmoothing: "antialiased", background: comFundo ? fundoDo(tema) : "transparent", color: tema.tinta }}>
      {comFundo && <div style={{ ...textura(claro ? "rgba(60,50,40,.10)" : "rgba(255,255,255,.07)") }} />}
      {comFundo && marcaDagua && (
        <div aria-hidden style={{ position: "absolute", right: -150, top: formato === "stories" ? 260 : 40, transform: "rotate(-14deg)", color: claro ? "rgba(31,31,36,.05)" : "rgba(255,255,255,.075)" }}>
          <Icone size={formato === "stories" ? 640 : 520} strokeWidth={1.4} />
        </div>
      )}
      {cenarioVivo && c === "tudo" && cenarioVivo}
      {cenario && <Na de="fundo">{cenario}</Na>}
      <Na de="fundo" bloco="cabecalho" style={{ position: "absolute", left: MARGEM, right: MARGEM, top: cx.topo, height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, height: 60, padding: "0 28px 0 22px", borderRadius: 999, background: claro ? "rgba(31,31,36,.07)" : "rgba(255,255,255,.16)", color: tema.tinta }}>
          <Icone size={30} strokeWidth={2.5} />
          <Rotulo cor={tema.tinta} tam={24}>{modulo ?? tema.modulo}</Rotulo>
        </div>
        <Rotulo cor={tema.suave} tam={24}>{periodo}</Rotulo>
      </Na>
      <div style={{ position: "absolute", left: MARGEM, right: MARGEM, top: cx.conteudo, height: cx.fim - cx.conteudo }}>{children}</div>
      <Na de="textos" bloco="assinatura" style={{ position: "absolute", left: MARGEM, top: cx.assinatura }}>
        <AssinaturaCore tom={tomAssinatura ?? tema.tinta} tamanho={formato === "feed" ? 54 : 58} />
      </Na>
    </div>
  );
};

/** Tamanho do número gigante conforme quantos caracteres ele tem. */
export const tamDoNumero = (texto: string, base: number) => {
  const n = texto.replace(/\s/g, "").length;
  return Math.round(base * (n <= 2 ? 1 : n === 3 ? 0.8 : n === 4 ? 0.64 : 0.52));
};

/** O número gigante + o rótulo embaixo (o bloco que abre quase todos os cards). */
const Heroi = ({ numero, rotulo, base, tema, sub }: { numero: string; rotulo: ReactNode; base: number; tema: TemaDoCard; sub?: ReactNode }) => (
  <div>
    <Na>
      <Numero tam={tamDoNumero(numero, base)} cor={tema.tinta} style={{ marginLeft: -10 }}>
        <span data-base="" style={{ display: "inline-block", width: 0, height: 0, verticalAlign: "baseline" }} />
        {numero}
      </Numero>
    </Na>
    <Na de="textos" bloco="rotulo" style={{ marginTop: base * 0.1, fontSize: base * 0.19, fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.02, color: tema.tinta }}>
      {rotulo}
      {sub && <div style={{ fontSize: base * 0.085, fontWeight: 700, letterSpacing: "-0.01em", color: tema.suave, marginTop: base * 0.04 }}>{sub}</div>}
    </Na>
  </div>
);

/** A linha de estatísticas (2 ou 3 números pequenos com legenda). */
const Estatisticas = ({ itens, tema, tam = 64 }: { itens: { valor: ReactNode; legenda: string }[]; tema: TemaDoCard; tam?: number }) => (
  <Na de="textos" bloco="estatisticas" style={{ display: "grid", gridTemplateColumns: `repeat(${itens.length}, 1fr)`, gap: 28 }}>
    {itens.map((it, i) => (
      <div key={i} style={{ minWidth: 0, borderTop: `3px solid ${tema.apagado}`, paddingTop: 22 }}>
        <div style={{ fontSize: tam, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: tema.tinta }}>{it.valor}</div>
        <div style={{ fontSize: Math.round(tam * 0.37), fontWeight: 700, color: tema.suave, marginTop: 10, lineHeight: 1.2 }}>{it.legenda}</div>
      </div>
    ))}
  </Na>
);

const coresDoCalendario = (tema: TemaDoCard): CoresDoCalendario => ({
  letras: tema.suave,
  feito: "#ffffff",
  feitoTexto: tema.destaque,
  vazio: tema.apagado,
  vazioTexto: "rgba(255,255,255,.78)",
  futuro: "rgba(255,255,255,.05)",
  futuroTexto: "rgba(255,255,255,.38)",
});

/** O calendário numa camada: "apagado" mostra tudo sem acender; "aceso" só as casas feitas. */
const CalendarioEmCamada = (p: Omit<Parameters<typeof CalendarioDoMes>[0], "so">) => {
  const c = useCamada();
  if (c === "fundo" || c === "textos") return <div style={{ visibility: "hidden" }}><CalendarioDoMes {...p} /></div>;
  return <CalendarioDoMes {...p} so={c === "apagado" ? "apagado" : c === "aceso" ? "aceso" : undefined} />;
};

/* ------------------------------------------------------------------------- *
 * TREINOS — o calendário do mês (ou a faixa de semanas desde o 1º treino)
 * ------------------------------------------------------------------------- */

export const CardTreinos = ({ d, formato }: { d: DadosTreinos; formato: "stories" | "feed" }) => {
  const tema = TEMAS.treinos;
  const stories = formato === "stories";
  if (d.periodo === "total") {
    const dias = [...new Set(d.dias)].sort();
    const inicio = dias[0] ?? d.hoje;
    const { mesIdx: mi, ano: ai } = lerMesId(inicio.slice(0, 7));
    const noMes = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias).length;
    return (
      <Moldura tipo="treinos" formato={formato} periodo={desdeMes(mi, ai, d.ano).toUpperCase()}>
        <Heroi numero={numeroBR(dias.length)} rotulo={<>{palavra(dias.length, UNIDADES.treino)} {desdeMes(mi, ai, d.ano)}</>} base={stories ? 430 : 330} tema={tema} />
        <Na de={["apagado", "aceso"]} bloco="prova" style={{ position: "absolute", left: 0, right: 0, top: stories ? 520 : 360 }}>
          <MesesEmLinhas inicio={inicio} hoje={d.hoje} feitos={new Set(dias)} largura={912} alturaMax={stories ? 700 : 420} tema={tema} />
        </Na>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <Estatisticas tema={tema} tam={stories ? 64 : 54} itens={[
            { valor: noMes, legenda: `${palavra(noMes, UNIDADES.treino)} em ${nomeDoMes(d.mesIdx)}` },
            { valor: d.semanasNaMeta ?? 0, legenda: `${palavra(d.semanasNaMeta ?? 0, UNIDADES.semana)} na meta` },
            { valor: d.recordes ?? 0, legenda: `${palavra(d.recordes ?? 0, UNIDADES.recorde)} ${(d.recordes ?? 0) === 1 ? "batido" : "batidos"}` },
          ]} />
        </div>
      </Moldura>
    );
  }
  const feitos = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias);
  const corrida = d.melhorSequencia ?? maiorCorrida(feitos);
  const linhas = Math.ceil((((new Date(d.ano, d.mesIdx, 1).getDay() + 6) % 7) + diasNoMes(d.ano, d.mesIdx)) / 7);
  return (
    <Moldura tipo="treinos" formato={formato} periodo={mesAno(d.mesIdx, d.ano)}>
      {stories ? (
        <>
          <Heroi numero={String(feitos.length)} rotulo={<>{palavra(feitos.length, UNIDADES.treino)} em {nomeDoMes(d.mesIdx)}</>} base={380} tema={tema} />
          <Na de={["apagado", "aceso"]} bloco="prova" style={{ position: "absolute", left: 0, right: 0, top: 468 }}>
            <CalendarioEmCamada ano={d.ano} mesIdx={d.mesIdx} feitos={new Set(feitos)} hoje={d.hoje} largura={912} alturaLinha={linhas > 5 ? 80 : 96} cores={coresDoCalendario(tema)} />
          </Na>
        </>
      ) : (
        <>
          <Heroi numero={String(feitos.length)} rotulo={<>{palavra(feitos.length, UNIDADES.treino)} em {nomeDoMes(d.mesIdx)}</>} base={290} tema={tema} />
          <Na de={["apagado", "aceso"]} bloco="prova" style={{ position: "absolute", left: 60, right: 60, top: 350 }}>
            <CalendarioEmCamada ano={d.ano} mesIdx={d.mesIdx} feitos={new Set(feitos)} hoje={d.hoje} largura={792} alturaLinha={linhas > 5 ? 58 : 66} cores={coresDoCalendario(tema)} />
          </Na>
        </>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Estatisticas tema={tema} tam={stories ? 64 : 58} itens={[
          { valor: corrida, legenda: palavra(corrida, UNIDADES.diaSeguido) },
          { valor: d.semanasNaMeta ?? 0, legenda: `${palavra(d.semanasNaMeta ?? 0, UNIDADES.semana)} na meta` },
          { valor: d.recordes ?? 0, legenda: `${palavra(d.recordes ?? 0, UNIDADES.recorde)} ${(d.recordes ?? 0) === 1 ? "batido" : "batidos"}` },
        ]} />
      </div>
    </Moldura>
  );
};

/**
 * OS MESES EM LINHAS (o total desde o 1º treino): uma linha por mês, um
 * quadradinho por dia (1–31), aceso nos dias de treino — o "ano em pixels".
 */
const MesesEmLinhas = ({ inicio, hoje, feitos, largura, alturaMax, tema }: { inicio: string; hoje: string; feitos: Set<string>; largura: number; alturaMax: number; tema: TemaDoCard }) => {
  const c = useCamada();
  const meses: { ano: number; mesIdx: number }[] = [];
  for (let { ano, mesIdx } = lerMesId(inicio.slice(0, 7)); `${ano}-${String(mesIdx + 1).padStart(2, "0")}` <= hoje.slice(0, 7); mesIdx === 11 ? (ano++, (mesIdx = 0)) : mesIdx++) meses.push({ ano, mesIdx });
  const ultimos = meses.slice(-12);
  const rotulo = 96;
  const passo = (largura - rotulo) / 31;
  const alto = Math.min(passo * 2.1, alturaMax / Math.max(1, ultimos.length));
  const lado = Math.min(passo * 0.8, alto * 0.8);
  return (
    <div data-meses="" style={{ width: largura }}>
      {ultimos.map(({ ano, mesIdx }) => (
        <div key={`${ano}-${mesIdx}`} style={{ display: "flex", alignItems: "center", height: alto }}>
          <div style={{ width: rotulo, fontSize: 26, fontWeight: 800, letterSpacing: ".1em", color: tema.suave, visibility: c === "aceso" ? "hidden" : undefined }}>{mesCurto(mesIdx)}</div>
          {Array.from({ length: diasNoMes(ano, mesIdx) }, (_, i) => {
            const dia = diaDoMes(ano, mesIdx, i + 1);
            const fora = dia < inicio || dia > hoje;
            const feito = !fora && feitos.has(dia);
            const pinta = feito && c !== "apagado";
            const visivel = c === "aceso" ? feito : true;
            return (
              <div key={i} style={{ width: passo, height: alto, display: "grid", placeItems: "center" }}>
                <div data-cel={dia} data-feito={feito ? "" : undefined} style={{ width: lado, height: pinta ? lado * 1.9 : lado, borderRadius: lado * 0.3, background: pinta ? "#ffffff" : fora ? "rgba(255,255,255,.05)" : tema.apagado, visibility: visivel ? undefined : "hidden" }} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const FaixaEmCamada = (p: Omit<Parameters<typeof FaixaDeSemanas>[0], "so">) => {
  const c = useCamada();
  if (c === "fundo" || c === "textos") return <div style={{ visibility: "hidden" }}><FaixaDeSemanas {...p} /></div>;
  return <FaixaDeSemanas {...p} so={c === "apagado" ? "apagado" : c === "aceso" ? "aceso" : undefined} />;
};

/* ------------------------------------------------------------------------- *
 * MÊS NO AZUL (e "guardei X%") — a água do saldo subindo
 * ------------------------------------------------------------------------- */

/** Onde a água para (y da superfície) em cada formato — o vídeo sobe até aqui. */
export const AGUA_FINAL = { stories: 862, feed: 560 } as const;
export const ONDA = { amplitude: 16, comprimento: 520, faseFinal: 0.9 } as const;
export const CORES_AGUA = { azul: ["#3b82f6", "#1e40af"], vermelho: ["#f87171", "#b91c1c"] } as const;

/** A água parada do card (a mesma forma que o vídeo desenha no último quadro). */
const AguaDoCard = ({ formato }: { formato: "stories" | "feed" }) => {
  const { w, h } = FORMATOS[formato];
  const superficie = AGUA_FINAL[formato];
  const d = caminhoDaOnda({ largura: w, altura: h, superficie, amplitude: ONDA.amplitude, comprimento: ONDA.comprimento, fase: ONDA.faseFinal });
  return (
    <svg data-agua="" width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden>
      <defs>
        <linearGradient id="agua-card" x1="0" y1={superficie} x2="0" y2={h} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={CORES_AGUA.azul[0]} />
          <stop offset="1" stopColor={CORES_AGUA.azul[1]} />
        </linearGradient>
      </defs>
      <path d={d} fill="url(#agua-card)" />
    </svg>
  );
};

/** As fichas dos meses no azul (JUN ✓ JUL ✓ AGO ✓), a prova da corrida. */
const FichasDosMeses = ({ meses }: { meses: { mes: string }[] }) => {
  const ultimos = meses.slice(-6);
  const antes = meses.length - ultimos.length;
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {antes > 0 && <div style={{ height: 64, padding: "0 22px", borderRadius: 18, border: "3px solid rgba(255,255,255,.5)", color: "#fff", fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center" }}>+{antes}</div>}
      {ultimos.map((m) => (
        <div key={m.mes} style={{ height: 64, padding: "0 22px 0 18px", borderRadius: 18, background: "#ffffff", color: "#1e40af", fontSize: 28, fontWeight: 900, letterSpacing: ".08em", display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={28} strokeWidth={3.6} /> {ultimos.length <= 2 ? nomeDoMes(lerMesId(m.mes).mesIdx).toUpperCase() : mesCurto(lerMesId(m.mes).mesIdx)}
        </div>
      ))}
    </div>
  );
};

export const CardAzul = ({ d, formato }: { d: DadosAzul; formato: "stories" | "feed" }) => {
  const tema = TEMAS.azul;
  const stories = formato === "stories";
  const ultimo = d.meses[d.meses.length - 1];
  const { mesIdx, ano } = lerMesId(ultimo?.mes ?? "1970-01");
  const n = d.meses.length;
  const superficie = AGUA_FINAL[formato];
  const topo = CAIXA[formato].conteudo;
  const emReais = reais(ultimo?.saldo, d.valoresLigados);
  const titulo = n === 1 ? <>{capitalizar(nomeDoMes(mesIdx))}<br />fechou</> : <>{plural(n, UNIDADES.mes)}<br />seguidos</>;
  return (
    <Moldura tipo="azul" formato={formato} periodo={mesAno(mesIdx, ano)} cenarioVivo={<AguaDoCard formato={formato} />} tomAssinatura="#ffffff">
      <Na de="textos" bloco="titulo" style={{ fontSize: stories ? 164 : 118, fontWeight: 900, letterSpacing: "-0.055em", lineHeight: 0.92, color: tema.tinta, marginTop: stories ? 40 : 10 }}>{titulo}</Na>
      <Na de="textos" bloco="rotulo" style={{ position: "absolute", left: -4, top: superficie - topo + (stories ? 72 : 50), color: "#ffffff", fontSize: stories ? 228 : 170, fontWeight: 900, letterSpacing: "-0.06em", lineHeight: 0.85 }}>no azul.</Na>
      <Na de="textos" bloco="prova" style={{ position: "absolute", left: 0, right: 0, top: superficie - topo + (stories ? 330 : 230) }}>
        <FichasDosMeses meses={d.meses} />
      </Na>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Estatisticas tema={{ ...tema, tinta: "#ffffff", suave: "rgba(255,255,255,.88)", apagado: "rgba(255,255,255,.28)" }} tam={stories ? 84 : 64} itens={[
          ...(ultimo?.pct != null ? [{ valor: <span data-contar={Math.round(ultimo.pct)} data-sufixo="%">{porcento(ultimo.pct)}</span>, legenda: "do que entrou, sobrou" }] : []),
          ...(emReais ? [{ valor: emReais, legenda: "sobraram no mês" }] : []),
          n === 1 ? { valor: "1º", legenda: "mês no azul" } : { valor: n, legenda: "meses seguidos no azul" },
        ].slice(0, 3)} />
      </div>
    </Moldura>
  );
};

export const CardPoupanca = ({ d, formato }: { d: DadosPoupanca; formato: "stories" | "feed" }) => {
  const tema = TEMAS.poupanca;
  const stories = formato === "stories";
  const superficie = AGUA_FINAL[formato];
  const topo = CAIXA[formato].conteudo;
  const emReais = reais(d.valor, d.valoresLigados);
  return (
    <Moldura tipo="poupanca" formato={formato} periodo={mesAno(d.mesIdx, d.ano)} cenarioVivo={<AguaDoCard formato={formato} />} tomAssinatura="#ffffff">
      <Na de="textos" bloco="titulo" style={{ fontSize: stories ? 120 : 96, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 0.95, color: tema.tinta, marginTop: stories ? 40 : 10 }}>
        Em {nomeDoMes(d.mesIdx)},<br />guardei
      </Na>
      <Na style={{ position: "absolute", left: -8, top: superficie - topo + (stories ? 70 : 44) }}>
        <Numero tam={stories ? 330 : 250} cor="#ffffff">
          <span data-base="" style={{ display: "inline-block", width: 0, height: 0, verticalAlign: "baseline" }} />
          {porcento(d.pct)}
        </Numero>
      </Na>
      <Na de="textos" bloco="rotulo" style={{ position: "absolute", left: 0, top: superficie - topo + (stories ? 380 : 290), color: "#fff", fontSize: stories ? 64 : 50, fontWeight: 900, letterSpacing: "-0.03em" }}>
        do que ganhei.
      </Na>
      <Na de={["apagado", "aceso"]} bloco="prova" style={{ position: "absolute", left: 0, right: 0, top: superficie - topo + (stories ? 500 : 370), display: "flex", gap: stories ? 16 : 12 }}>
        {Array.from({ length: 10 }, (_, i) => <Moeda key={i} indice={i} fracao={Math.max(0, Math.min(1, d.pct / 10 - i))} lado={stories ? 76 : 60} />)}
      </Na>
      <Na de="textos" bloco="legenda" style={{ position: "absolute", left: 0, top: superficie - topo + (stories ? 600 : 446), fontSize: stories ? 28 : 24, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>
        cada moeda = 10% do que entrou
      </Na>
      {emReais && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <Estatisticas tema={{ ...tema, tinta: "#ffffff", suave: "rgba(255,255,255,.88)", apagado: "rgba(255,255,255,.28)" }} tam={stories ? 84 : 64} itens={[{ valor: emReais, legenda: "guardados no mês" }]} />
        </div>
      )}
    </Moldura>
  );
};

/** Uma moeda do "guardei": cheia, pela metade (a fração) ou vazia. `data-cel` = o vídeo acende uma por uma. */
const Moeda = ({ indice, fracao, lado }: { indice: number; fracao: number; lado: number }) => {
  const c = useCamada();
  const cheia = c === "apagado" ? 0 : fracao;
  const visivel = c === "aceso" ? fracao > 0 : true;
  return (
    <div data-cel={indice + 1} data-feito={fracao > 0 ? "" : undefined} style={{ width: lado, height: lado, borderRadius: "50%", position: "relative", overflow: "hidden", background: c === "aceso" ? "transparent" : "rgba(255,255,255,.18)", boxShadow: c === "aceso" ? undefined : "inset 0 0 0 4px rgba(255,255,255,.35)", visibility: visivel ? undefined : "hidden" }}>
      {cheia > 0 && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${cheia * 100}%`, background: "linear-gradient(145deg,#fff7d6,#fbbf24 55%,#d97706)" }} />
      )}
      {cheia > 0 && <div style={{ position: "absolute", inset: lado * 0.18, borderRadius: "50%", boxShadow: "inset 0 0 0 3px rgba(146,64,14,.35)" }} />}
    </div>
  );
};

/* ------------------------------------------------------------------------- *
 * LIVROS — as capas
 * ------------------------------------------------------------------------- */

// Seis cores bem diferentes entre si (os dois marrons saíram: sumiam no terracota do card de Leitura).
const CORES_DE_CAPA = ["#1e3a8a", "#14532d", "#581c87", "#9f1239", "#0f766e", "#27272a"];
const hash = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const corDaCapa = (titulo: string) => CORES_DE_CAPA[hash(titulo) % CORES_DE_CAPA.length];

/** As cores do leque: cada livro na cor dele, sem repetir cor no leque enquanto sobrar cor
 *  (duas roxas coladas viravam uma capa só); com mais livros que cores, ao menos a vizinha é outra. */
export const coresDoLeque = (titulos: string[]): string[] => {
  const cores: string[] = [];
  titulos.forEach((t, i) => {
    let k = CORES_DE_CAPA.indexOf(corDaCapa(t));
    const ocupada = (c: string) => (cores.length < CORES_DE_CAPA.length ? cores.includes(c) : c === cores[i - 1]);
    for (let passo = 0; passo < CORES_DE_CAPA.length && ocupada(CORES_DE_CAPA[k]); passo++) k = (k + 1) % CORES_DE_CAPA.length;
    cores.push(CORES_DE_CAPA[k]);
  });
  return cores;
};

/** O pedaço da capa que fica embaixo da vizinha no leque (o texto da capa tipográfica foge dali). */
export interface Tapado { lado: "esquerda" | "direita"; px: number }

/** Título da capa tipográfica: a maior palavra cabe na largura livre ("Essencialismo" não passa da borda).
 *  A Instrument Serif itálica gasta ~0,39 em por letra; a conta usa 0,44 pra sobrar. */
export const fonteDoTituloDaCapa = (titulo: string, w: number, livre: number): number => {
  const maior = Math.max(1, ...titulo.split(/\s+/).map((p) => p.length));
  return Math.min(w * 0.16, livre / (maior * 0.44));
};

/** A capa: a imagem quando existe (e carregou); senão, uma capa tipográfica (cor fixa pelo título). */
export const CapaDoLivro = ({ livro, w, h, giro = 0, tapado, cor = corDaCapa(livro.titulo) }: { livro: Livro; w: number; h: number; giro?: number; tapado?: Tapado; cor?: string }) => {
  const folga = w * 0.1;
  const esq = folga + (tapado?.lado === "esquerda" ? tapado.px : 0);
  const dir = folga + (tapado?.lado === "direita" ? tapado.px : 0);
  const livre = Math.max(w * 0.4, w - esq - dir);
  return (
    <div data-capa="" style={{ width: w, height: h, borderRadius: 10, overflow: "hidden", transform: giro ? `rotate(${giro}deg)` : undefined, boxShadow: "0 30px 50px -20px rgba(0,0,0,.55), 0 4px 10px rgba(0,0,0,.25)", background: cor, position: "relative", flexShrink: 0 }}>
      {livro.capa ? (
        <img src={livro.capa} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <div data-capa-texto="" style={{ position: "absolute", inset: 0, padding: `${folga}px ${dir}px ${folga}px ${esq}px`, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff" }}>
          <div style={{ height: 4, width: Math.min(w * 0.3, livre), background: "rgba(255,255,255,.7)", borderRadius: 2 }} />
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: fonteDoTituloDaCapa(livro.titulo, w, livre), lineHeight: 1.02, overflowWrap: "break-word" }}>{livro.titulo}</div>
          <div style={{ fontFamily: INTER, fontSize: w * 0.07, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.85, overflowWrap: "break-word" }}>{livro.autor ?? ""}</div>
        </div>
      )}
      {/* a lombada: um brilho na borda esquerda */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: w * 0.06, background: "linear-gradient(90deg, rgba(0,0,0,.28), rgba(255,255,255,.12) 60%, rgba(0,0,0,0))" }} />
    </div>
  );
};

/**
 * O leque de capas (card e adesivo): a do meio por cima, as de fora giradas e
 * um pouco mais baixas. Cada capa fica em parte embaixo da vizinha de dentro —
 * a sobreposição mais o que o giro das duas empurra no canto (o de baixo, onde
 * mora o autor): sobrepõe + h/2 · |sen giro − sen giro da vizinha|. A capa
 * tipográfica afasta o texto desse lado (o "Itamar" perdia o "I", 29/09).
 */
export const posicoesDoLeque = (n: number, w: number, h: number, passo: number, sobrepoe: number) => {
  const meio = (n - 1) / 2;
  const giro = (i: number) => (i - meio) * passo;
  const z = (i: number) => 10 - Math.abs(Math.round(i - meio));
  const sen = (g: number) => Math.sin((g * Math.PI) / 180);
  const ov = w * sobrepoe;
  return Array.from({ length: n }, (_, i) => {
    const vizinha = i > 0 && z(i - 1) > z(i) ? i - 1 : i < n - 1 && z(i + 1) > z(i) ? i + 1 : null;
    const tapado: Tapado | undefined = vizinha == null ? undefined : {
      lado: vizinha < i ? "esquerda" : "direita",
      px: Math.ceil(ov + (h / 2) * Math.abs(sen(giro(i)) - sen(giro(vizinha))) + 6),
    };
    return { giro: giro(i), z: z(i), desce: Math.abs(i - meio), tapado };
  });
};

const LequeDeCapas = ({ livros, w, passo, desce, sobrepoe }: { livros: Livro[]; w: number; passo: number; desce: number; sobrepoe: number }) => {
  const h = Math.round(w * 1.5);
  const pos = posicoesDoLeque(livros.length, w, h, passo, sobrepoe);
  const cores = coresDoLeque(livros.map((l) => l.titulo));
  return (
    <>
      {livros.map((l, i) => (
        <div key={i} style={{ marginLeft: i ? -w * sobrepoe : 0, transform: `translateY(${pos[i].desce * desce}px)`, zIndex: pos[i].z }}>
          <CapaDoLivro livro={l} w={w} h={h} giro={pos[i].giro} tapado={pos[i].tapado} cor={cores[i]} />
        </div>
      ))}
    </>
  );
};

export const CardLivros = ({ d, formato }: { d: DadosLivros; formato: "stories" | "feed" }) => {
  const tema = TEMAS.livros;
  const stories = formato === "stories";
  const n = d.livros.length;
  const paginas = d.livros.reduce((s, l) => s + Math.max(0, l.paginas ?? 0), 0);
  const quando = d.periodo === "mes" ? `em ${nomeDoMes(d.mesIdx)}` : `em ${d.ano}`;
  const mostrar = d.livros.slice(0, 5);
  // 5 capas de 230 passavam da borda do Stories; 196 cabe com o giro das de fora
  const cw = stories ? (mostrar.length <= 3 ? 300 : mostrar.length === 4 ? 230 : 196) : 190;
  const ch = Math.round(cw * 1.5);
  return (
    <Moldura tipo="livros" formato={formato} periodo={d.periodo === "mes" ? mesAno(d.mesIdx, d.ano) : String(d.ano)}>
      <Heroi numero={String(n)} rotulo={<>{palavra(n, UNIDADES.livro)} {n === 1 ? "lido" : "lidos"} {quando}</>} base={stories ? 400 : 300} tema={tema} />
      <Na de="aceso" bloco="prova" style={{ position: "absolute", left: -20, right: -20, top: stories ? 500 : 330, height: ch + 80, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <LequeDeCapas livros={mostrar} w={cw} passo={5} desce={18} sobrepoe={0.08} />
      </Na>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Estatisticas tema={tema} tam={stories ? 64 : 54} itens={[
          ...(paginas > 0 ? [{ valor: numeroBR(paginas), legenda: palavra(paginas, UNIDADES.pagina) }] : []),
          ...(d.metaDoAno && d.noAno != null ? [{ valor: `${d.noAno}/${d.metaDoAno}`, legenda: `da meta de ${d.ano}` }] : []),
        ]} />
      </div>
    </Moldura>
  );
};

/* ------------------------------------------------------------------------- *
 * SEQUÊNCIA — as chamas dos últimos 28 dias
 * ------------------------------------------------------------------------- */

export const CardSequencia = ({ d, formato }: { d: DadosSequencia; formato: "stories" | "feed" }) => {
  const tema = TEMAS.sequencia;
  const stories = formato === "stories";
  const passo = stories ? 130 : 96;
  const lado = passo * (stories ? 0.78 : 0.72);
  const ult = d.ultimos.slice(-28);
  return (
    <Moldura tipo="sequencia" formato={formato} periodo={d.marco ? `MARCO DE ${d.marco} DIAS` : "AGORA"}>
      <Heroi numero={numeroBR(d.dias)} rotulo={<>{palavra(d.dias, UNIDADES.diaSeguido)}</>} sub="anotando no CORE, sem falhar" base={stories ? 420 : 320} tema={tema} />
      <Na de={["apagado", "aceso"]} bloco="prova" style={{ position: "absolute", left: stories ? 0 : 120, top: stories ? 560 : 440, display: "grid", gridTemplateColumns: `repeat(7, ${passo}px)`, rowGap: stories ? 8 : 2 }}>
        {ult.map((feito, i) => (
          <div key={i} style={{ width: passo, height: passo * (stories ? 0.86 : 0.76), display: "grid", placeItems: "center" }}>
            <DiscoDeChama feito={feito} lado={lado} tema={tema} indice={i} />
          </div>
        ))}
      </Na>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Estatisticas tema={tema} tam={stories ? 64 : 54} itens={[
          (d.recorde ?? d.dias) <= d.dias ? { valor: "★", legenda: "é o meu recorde" } : { valor: numeroBR(d.recorde ?? d.dias), legenda: `${palavra(d.recorde ?? d.dias, UNIDADES.dia)} é o meu recorde` },
          { valor: `${ult.filter(Boolean).length}/28`, legenda: "dos últimos 28 dias" },
        ]} />
      </div>
    </Moldura>
  );
};

const DiscoDeChama = ({ feito, lado, tema, indice }: { feito: boolean; lado: number; tema: TemaDoCard; indice: number }) => {
  const c = useCamada();
  const aceso = feito && c !== "apagado";
  const visivel = c === "aceso" ? feito : true;
  return (
    <div data-cel={indice + 1} data-feito={feito ? "" : undefined} style={{ width: lado, height: lado, borderRadius: "50%", background: aceso ? "#ffffff" : tema.apagado, display: "grid", placeItems: "center", color: aceso ? "#ea580c" : "rgba(255,255,255,.45)", visibility: visivel ? undefined : "hidden" }}>
      <Flame size={lado * 0.52} strokeWidth={2.4} fill={aceso ? "#fb923c" : "none"} />
    </div>
  );
};

/* ------------------------------------------------------------------------- *
 * ÁGUA — o mês em gotas (cada gota enche até a fração da meta)
 * ------------------------------------------------------------------------- */

const GOTA = "M50 4 C50 4 14 46 14 66 A36 36 0 0 0 86 66 C86 46 50 4 50 4 Z";

const Gota = ({ fracao, lado, cor, trilho, id }: { fracao: number; lado: number; cor: string; trilho: string; id: string }) => {
  const f = Math.max(0, Math.min(1, fracao));
  const y = 102 - f * 98;
  return (
    <svg width={lado} height={lado} viewBox="0 0 100 104" aria-hidden>
      <defs><clipPath id={`gota-${id}`}><path d={GOTA} /></clipPath></defs>
      <path d={GOTA} fill={trilho} />
      <rect x="0" y={y} width="100" height={104 - y} fill={cor} clipPath={`url(#gota-${id})`} />
    </svg>
  );
};

export const CardAgua = ({ d, formato }: { d: DadosAgua; formato: "stories" | "feed" }) => {
  const tema = TEMAS.agua;
  const stories = formato === "stories";
  const total = diasNoMes(d.ano, d.mesIdx);
  const naMeta = d.porDia.filter((f) => f >= 1).length;
  const passo = stories ? 912 / 7 : 700 / 7;
  const inicio = (new Date(d.ano, d.mesIdx, 1).getDay() + 6) % 7;
  const c = useCamada();
  return (
    <Moldura tipo="agua" formato={formato} periodo={mesAno(d.mesIdx, d.ano)}>
      <Heroi numero={String(naMeta)} rotulo={<>{palavra(naMeta, UNIDADES.dia)} na meta de água</>} sub={`em ${nomeDoMes(d.mesIdx)}`} base={stories ? 370 : 270} tema={tema} />
      <Na de={["apagado", "aceso"]} bloco="prova" style={{ position: "absolute", left: stories ? 0 : 106, top: stories ? 500 : 360, display: "grid", gridTemplateColumns: `repeat(7, ${passo}px)` }}>
        {LETRAS_DA_SEMANA.map((l, i) => (
          <div key={`l${i}`} style={{ width: passo, textAlign: "center", fontSize: passo * 0.26, fontWeight: 800, letterSpacing: ".08em", color: tema.suave, paddingBottom: passo * 0.08, visibility: c === "aceso" ? "hidden" : undefined }}>{l}</div>
        ))}
        {Array.from({ length: inicio }, (_, i) => <div key={`v${i}`} />)}
        {Array.from({ length: total }, (_, i) => {
          const dia = diaDoMes(d.ano, d.mesIdx, i + 1);
          const f = dia > d.hoje ? 0 : d.porDia[i] ?? 0;
          const cheia = c === "apagado" ? 0 : f;
          const visivel = c === "aceso" ? f > 0 : true;
          return (
            <div key={i} data-cel={i + 1} data-feito={f > 0 ? "" : undefined} style={{ width: passo, height: passo * 0.74, display: "grid", placeItems: "center", visibility: visivel ? undefined : "hidden" }}>
              <Gota fracao={cheia} lado={passo * 0.66} cor="#ffffff" trilho={c === "aceso" ? "transparent" : dia > d.hoje ? "rgba(255,255,255,.06)" : tema.apagado} id={`${formato}-${i}`} />
            </div>
          );
        })}
      </Na>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Estatisticas tema={tema} tam={stories ? 64 : 54} itens={[
          { valor: porcento((naMeta / Math.max(1, d.porDia.length)) * 100), legenda: "dos dias do mês" },
          { valor: `${numeroBR(Math.min(total, d.porDia.length))}`, legenda: `${palavra(d.porDia.length, UNIDADES.dia)} anotados` },
        ]} />
      </div>
    </Moldura>
  );
};

/* ------------------------------------------------------------------------- *
 * SONO — uma barra por noite, a linha da meta
 * ------------------------------------------------------------------------- */

export const CardSono = ({ d, formato }: { d: DadosSono; formato: "stories" | "feed" }) => {
  const tema = TEMAS.sono;
  const stories = formato === "stories";
  const noites = d.horas.filter((h): h is number => h != null && h > 0);
  const naMeta = noites.filter((h) => h >= d.meta).length;
  const media = noites.length ? noites.reduce((s, h) => s + h, 0) / noites.length : 0;
  const W = 912, H = stories ? 400 : 300;
  const min = 4, max = 10;
  const y = (h: number) => H - ((Math.max(min, Math.min(max, h)) - min) / (max - min)) * H;
  const passo = W / Math.max(28, d.horas.length);
  const c = useCamada();
  return (
    <Moldura tipo="sono" formato={formato} periodo={mesAno(d.mesIdx, d.ano)}>
      <Heroi numero={String(naMeta)} rotulo={<>{palavra(naMeta, UNIDADES.noite)} com {numeroBR(d.meta, 1)} h ou mais</>} sub={`em ${nomeDoMes(d.mesIdx)}`} base={stories ? 370 : 300} tema={tema} />
      <Na de={["apagado", "aceso"]} bloco="prova" style={{ position: "absolute", left: 0, top: stories ? 640 : 470, width: W, height: H }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ overflow: "visible" }}>
          {d.horas.map((h, i) => {
            if (h == null || h <= 0) return null;
            const bom = h >= d.meta;
            const mostra = c === "aceso" ? bom : true;
            const cor = bom && c !== "apagado" ? "#ffffff" : "rgba(255,255,255,.28)";
            return <rect key={i} data-cel={i + 1} data-feito={bom ? "" : undefined} x={i * passo + passo * 0.18} y={y(h)} width={passo * 0.64} height={H - y(h)} rx={passo * 0.32} fill={cor} visibility={mostra ? undefined : "hidden"} />;
          })}
          {c !== "aceso" && <line x1={0} x2={W} y1={y(d.meta)} y2={y(d.meta)} stroke="rgba(255,255,255,.75)" strokeWidth={3} strokeDasharray="10 10" />}
        </svg>
        {c !== "aceso" && <div style={{ position: "absolute", left: 0, top: -64, fontSize: 24, fontWeight: 800, letterSpacing: ".12em", color: "rgba(255,255,255,.9)", display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 40, borderTop: "3px dashed rgba(255,255,255,.8)" }} />META DE {numeroBR(d.meta, 1)} H</div>}
      </Na>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Estatisticas tema={tema} tam={stories ? 64 : 54} itens={[
          { valor: `${numeroBR(media, 1)} h`, legenda: "de sono, na média" },
          { valor: noites.length, legenda: `${palavra(noites.length, UNIDADES.noite)} anotadas` },
        ]} />
      </div>
    </Moldura>
  );
};

/* ------------------------------------------------------------------------- *
 * HÁBITO CAMPEÃO — o calendário do mês
 * ------------------------------------------------------------------------- */

export const CardHabitos = ({ d, formato }: { d: DadosHabitos; formato: "stories" | "feed" }) => {
  const tema = TEMAS.habitos;
  const stories = formato === "stories";
  const feitos = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias);
  const corrida = maiorCorrida(feitos);
  return (
    <Moldura tipo="habitos" formato={formato} periodo={mesAno(d.mesIdx, d.ano)}>
      <Heroi numero={String(feitos.length)} rotulo={<>{palavra(feitos.length, UNIDADES.dia)} de {d.habito.toLowerCase()}</>} sub={`em ${nomeDoMes(d.mesIdx)}`} base={stories ? 360 : 270} tema={tema} />
      <Na de={["apagado", "aceso"]} bloco="prova" style={{ position: "absolute", left: stories ? 0 : 60, right: stories ? 0 : 60, top: stories ? 520 : 350 }}>
        <CalendarioEmCamada ano={d.ano} mesIdx={d.mesIdx} feitos={new Set(feitos)} hoje={d.hoje} largura={stories ? 912 : 792} alturaLinha={stories ? 92 : 62} cores={coresDoCalendario(tema)} />
      </Na>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Estatisticas tema={tema} tam={stories ? 64 : 54} itens={[
          { valor: corrida, legenda: palavra(corrida, UNIDADES.diaSeguido) },
          { valor: porcento((feitos.length / Math.max(1, Number(d.hoje.slice(0, 7) === diaDoMes(d.ano, d.mesIdx, 1).slice(0, 7) ? Number(d.hoje.slice(8, 10)) : diasNoMes(d.ano, d.mesIdx)))) * 100), legenda: "dos dias do mês" },
        ]} />
      </div>
    </Moldura>
  );
};

/* ------------------------------------------------------------------------- *
 * METAS DO MÊS — os quadradinhos
 * ------------------------------------------------------------------------- */

const LARGURAS_DA_LINHA = [0.86, 0.62, 0.94, 0.5, 0.74, 0.68, 0.9, 0.56];

export const CardMetas = ({ d, formato }: { d: DadosMetas; formato: "stories" | "feed" }) => {
  const tema = TEMAS.metas;
  const stories = formato === "stories";
  const total = Math.max(d.total, d.feitas);
  const linhas = Array.from({ length: Math.min(total, stories ? 7 : 5) }, (_, i) => ({ feita: i < d.feitas, texto: d.mostrarTextos ? d.textos?.[i] : undefined }));
  const c = useCamada();
  const caixa = stories ? 78 : 60;
  return (
    <Moldura tipo="metas" formato={formato} periodo={mesAno(d.mesIdx, d.ano)}>
      <Heroi numero={`${d.feitas}/${total}`} rotulo={<>{palavra(total, UNIDADES.meta)} do mês {d.feitas === 1 ? "batida" : "batidas"}</>} sub={`em ${nomeDoMes(d.mesIdx)}`} base={stories ? 400 : 300} tema={tema} />
      <Na de={["apagado", "aceso"]} bloco="prova" style={{ position: "absolute", left: 0, right: 0, top: stories ? 560 : 400, display: "flex", flexDirection: "column", gap: stories ? 26 : 18 }}>
        {linhas.map((m, i) => {
          const marcada = m.feita && c !== "apagado";
          const mostra = c === "aceso" ? m.feita : true;
          return (
            <div key={i} data-cel={i + 1} data-feito={m.feita ? "" : undefined} style={{ display: "flex", alignItems: "center", gap: 26, height: caixa, visibility: mostra ? undefined : "hidden" }}>
              <div style={{ width: caixa, height: caixa, borderRadius: caixa * 0.26, border: marcada ? "none" : "6px solid rgba(255,255,255,.6)", background: marcada ? "#ffffff" : "transparent", display: "grid", placeItems: "center", color: tema.destaque, flexShrink: 0, boxSizing: "border-box" }}>
                {marcada && <Check size={caixa * 0.64} strokeWidth={3.8} />}
              </div>
              {m.texto ? (
                <span style={{ fontSize: stories ? 40 : 32, fontWeight: 800, color: "#fff", opacity: marcada ? 0.8 : 1, textDecoration: marcada ? "line-through" : undefined, textDecorationThickness: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.texto}</span>
              ) : (
                // o texto da meta é da pessoa: por padrão a linha vai TAPADA (dá pra ver que existe, não o que é)
                <div style={{ position: "relative", height: caixa * 0.34, width: `${LARGURAS_DA_LINHA[i % LARGURAS_DA_LINHA.length] * 78}%`, borderRadius: 999, background: marcada ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.18)" }}>
                  {marcada && <div style={{ position: "absolute", left: -10, right: -10, top: "50%", height: 5, marginTop: -2.5, borderRadius: 3, background: "#ffffff" }} />}
                </div>
              )}
            </div>
          );
        })}
      </Na>
    </Moldura>
  );
};

/* ------------------------------------------------------------------------- *
 * A INSÍGNIA QUE EVOLUIU — a moeda (vaga pra MoedaEstatica) nos raios
 * ------------------------------------------------------------------------- */

export const NIVEIS: Record<NivelMoeda, { nome: string; metal: [string, string, string] }> = {
  bronze: { nome: "Bronze", metal: ["#f3c6a0", "#c07a45", "#7a4524"] },
  prata: { nome: "Prata", metal: ["#f4f6f9", "#b9c2cd", "#6c7684"] },
  ouro: { nome: "Ouro", metal: ["#fff1b8", "#e3b341", "#9a6b12"] },
  platina: { nome: "Platina", metal: ["#f1f7fb", "#a9c3d6", "#5b7488"] },
  diamante: { nome: "Diamante", metal: ["#f2fbff", "#9fdcf5", "#3f86a8"] },
};

/** A VAGA da moeda: um disco de metal do nível com o ícone do módulo — até a MoedaEstatica chegar (ver o relatório). */
export const VagaDaMoeda = ({ nivel, cor, lado }: { nivel: NivelMoeda; cor: string; lado: number }) => {
  const [c1, c2, c3] = NIVEIS[nivel].metal;
  return (
    <div data-vaga-moeda="" style={{ width: lado, height: lado, borderRadius: "50%", background: `linear-gradient(145deg, ${c1}, ${c2} 45%, ${c3})`, display: "grid", placeItems: "center", boxShadow: "0 40px 70px -30px rgba(0,0,0,.6)" }}>
      <div style={{ width: lado * 0.8, height: lado * 0.8, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, ${cor}, #022c22)`, display: "grid", placeItems: "center", boxShadow: `inset 0 0 0 ${lado * 0.02}px ${c3}` }}>
        <PiggyBank size={lado * 0.34} color={c1} strokeWidth={2} />
      </div>
    </div>
  );
};

export const CardInsignia = ({ d, formato, moeda }: { d: DadosInsignia; formato: "stories" | "feed"; moeda?: ReactNode }) => {
  const tema = { ...TEMAS.insignia, modulo: d.moduloNome };
  const stories = formato === "stories";
  const lado = stories ? 700 : 460;
  const [c1, c2, c3] = NIVEIS[d.nivel].metal;
  const topoMoeda = stories ? 20 : 0;
  return (
    <Moldura
      tipo="insignia"
      formato={formato}
      tema={tema}
      marcaDagua={false}
      periodo="NOVO NÍVEL"
      cenario={
        <div style={{ position: "absolute", left: 540 - 900, top: CAIXA[formato].conteudo + topoMoeda + lado / 2 - 900, width: 1800, height: 1800, borderRadius: "50%", background: `repeating-conic-gradient(from 0deg, rgba(255,255,255,.10) 0deg 5deg, rgba(255,255,255,0) 5deg 15deg)`, WebkitMaskImage: "radial-gradient(closest-side, #000 20%, transparent 72%)", maskImage: "radial-gradient(closest-side, #000 20%, transparent 72%)" }} />
      }
    >
      <Na de={["aceso"]} bloco="prova" style={{ position: "absolute", left: (912 - lado) / 2, top: topoMoeda, width: lado, height: lado }}>
        {moeda ?? (d.imagem ? <img src={d.imagem} alt="" style={{ width: lado, height: lado, display: "block" }} /> : <VagaDaMoeda nivel={d.nivel} cor={d.cor} lado={lado} />)}
      </Na>
      <Na de="textos" bloco="rotulo" style={{ position: "absolute", left: 0, right: 0, top: topoMoeda + lado + (stories ? 50 : 24), textAlign: "center" }}>
        <Rotulo cor={c1} tam={stories ? 30 : 24} style={{ letterSpacing: ".22em" }}>{d.moduloNome} evoluiu</Rotulo>
        {d.de && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 18, marginTop: 26, fontSize: 28, fontWeight: 900, letterSpacing: ".14em" }}>
            <span style={{ padding: "12px 26px", borderRadius: 999, background: `linear-gradient(145deg, ${NIVEIS[d.de].metal[0]}, ${NIVEIS[d.de].metal[1]})`, color: "#1f1f24" }}>{NIVEIS[d.de].nome.toUpperCase()}</span>
            <span style={{ color: "rgba(255,255,255,.7)" }}>→</span>
            <span style={{ padding: "12px 26px", borderRadius: 999, background: `linear-gradient(145deg, ${c1}, ${c2})`, color: "#1f1f24" }}>{NIVEIS[d.nivel].nome.toUpperCase()}</span>
          </div>
        )}
      </Na>
      <Na de="textos" bloco="nivel" style={{ position: "absolute", left: 0, right: 0, top: topoMoeda + lado + (stories ? 190 : 150), textAlign: "center" }}>
        <div style={{ display: "inline-block", fontSize: stories ? 210 : 150, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 0.9, backgroundImage: `linear-gradient(180deg, ${c1} 10%, ${c2} 55%, ${c3} 100%)`, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: c2 }}>
          {NIVEIS[d.nivel].nome.toUpperCase()}
        </div>
      </Na>
      {d.feito && (
        <Na de="textos" bloco="estatisticas" style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", fontSize: stories ? 34 : 28, fontWeight: 700, color: "rgba(255,255,255,.88)" }}>
          {d.feito}
        </Na>
      )}
    </Moldura>
  );
};

/* ------------------------------------------------------------------------- *
 * A FIGURINHA LENDÁRIA — a arte da figurinha com o anel dourado
 * ------------------------------------------------------------------------- */

const NOME_RARIDADE = { comum: "comum", raro: "rara", epico: "épica", lendario: "lendária" } as const;

export const CardFigurinha = ({ d, formato }: { d: DadosFigurinha; formato: "stories" | "feed" }) => {
  const tema = TEMAS.figurinha;
  const stories = formato === "stories";
  const lado = stories ? 600 : 440;
  const brilha = d.raridade === "epico" || d.raridade === "lendario";
  return (
    <Moldura tipo="figurinha" formato={formato} marcaDagua={false} periodo={`✦ ${NOME_RARIDADE[d.raridade].toUpperCase()}`}
      cenario={<div style={{ position: "absolute", left: 540 - 700, top: CAIXA[formato].conteudo + lado / 2 - 700 + 30, width: 1400, height: 1400, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(255,255,255,.75), rgba(255,255,255,0))" }} />}
    >
      <Na de={["aceso"]} bloco="prova" style={{ position: "absolute", left: (912 - lado) / 2, top: 30, width: lado, height: lado }}>
        {brilha && <AnelRaridadeSvg raridade={d.raridade as "epico" | "lendario"} tamanho={lado} />}
        <div style={{ position: "absolute", inset: 0, transform: "rotate(-5deg)" }}><Adesivo id={d.id} tamanho={lado} bordaGrossa /></div>
      </Na>
      <Na de="textos" bloco="rotulo" style={{ position: "absolute", left: 0, right: 0, top: lado + (stories ? 110 : 60), textAlign: "center" }}>
        <div style={{ fontSize: stories ? 120 : 90, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 0.95, color: tema.tinta }}>{d.titulo}</div>
        <div style={{ fontSize: stories ? 40 : 32, fontWeight: 700, color: tema.suave, marginTop: 22 }}>{d.descricao}</div>
      </Na>
      {d.colecao && (
        <Na de="textos" bloco="estatisticas" style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center" }}>
          <span style={{ display: "inline-block", padding: "14px 30px", borderRadius: 999, background: "rgba(31,31,36,.1)", fontSize: 30, fontWeight: 800, letterSpacing: ".06em", color: tema.tinta }}>{d.colecao}</span>
        </Na>
      )}
    </Moldura>
  );
};

/* ------------------------------------------------------------------------- *
 * O CARD GERAL — o número de qualquer insígnia, na cor da área
 * ------------------------------------------------------------------------- */

export const CardNumero = ({ d, formato }: { d: DadosNumero; formato: "stories" | "feed" }) => {
  const tema = temaDaCor(d.cor, d.modulo);
  const stories = formato === "stories";
  return (
    <Moldura tipo="numero" formato={formato} tema={tema} periodo={d.periodo}>
      <div style={{ position: "absolute", left: 0, right: 0, top: stories ? 260 : 150 }}>
        <Heroi numero={d.numero} rotulo={d.rotulo} sub={d.sub} base={stories ? 460 : 340} tema={tema} />
      </div>
    </Moldura>
  );
};

/* ------------------------------------------------------------------------- *
 * O ADESIVO — o cartão branco com fundo transparente, pra pôr na própria foto
 * ------------------------------------------------------------------------- */

interface ResumoDoAdesivo { numero: string; rotulo: string; sub?: string; cor: string; Icone: LucideIcon; modulo: string; prova?: ReactNode }

/** O que vai no adesivo de cada tipo (o número, a frase e uma prova pequena). */
export const resumoDoAdesivo = (d: DadosCard): ResumoDoAdesivo => {
  const t = TEMAS[d.tipo];
  const base = { cor: t.destaque, Icone: ICONES[d.tipo], modulo: t.modulo };
  switch (d.tipo) {
    case "treinos": {
      if (d.periodo === "total") { const n = new Set(d.dias).size; const ini = [...new Set(d.dias)].sort()[0] ?? d.hoje; const { mesIdx, ano } = lerMesId(ini.slice(0, 7)); return { ...base, numero: numeroBR(n), rotulo: palavra(n, UNIDADES.treino), sub: desdeMes(mesIdx, ano, d.ano) }; }
      const f = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias);
      return { ...base, numero: String(f.length), rotulo: palavra(f.length, UNIDADES.treino), sub: `em ${nomeDoMes(d.mesIdx)}`, prova: <CalendarioDoMes ano={d.ano} mesIdx={d.mesIdx} feitos={new Set(f)} hoje={d.hoje} largura={560} alturaLinha={62} cores={{ letras: "#8a8175", feito: t.destaque, feitoTexto: "#fff", vazio: "rgba(31,31,36,.06)", vazioTexto: "#8a8175", futuro: "transparent", futuroTexto: "#c9c3b8" }} /> };
    }
    case "azul": { const u = d.meses[d.meses.length - 1]; const { mesIdx } = lerMesId(u?.mes ?? "1970-01"); return { ...base, cor: "#1d4ed8", numero: u?.pct != null ? porcento(u.pct) : String(d.meses.length), rotulo: "no azul", sub: u?.pct != null ? `sobrou em ${nomeDoMes(mesIdx)}` : `${palavra(d.meses.length, UNIDADES.mes)} seguidos` }; }
    case "poupanca": return { ...base, numero: porcento(d.pct), rotulo: "guardado", sub: `do que ganhei em ${nomeDoMes(d.mesIdx)}` };
    case "livros": return { ...base, numero: String(d.livros.length), rotulo: `${palavra(d.livros.length, UNIDADES.livro)} ${d.livros.length === 1 ? "lido" : "lidos"}`, sub: d.periodo === "mes" ? `em ${nomeDoMes(d.mesIdx)}` : `em ${d.ano}`, prova: <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start" }}><LequeDeCapas livros={d.livros.slice(0, 4)} w={130} passo={4} desce={6} sobrepoe={0.12} /></div> };
    case "sequencia": return { ...base, numero: numeroBR(d.dias), rotulo: palavra(d.dias, UNIDADES.diaSeguido), sub: "anotando no CORE" };
    case "agua": { const n = d.porDia.filter((f) => f >= 1).length; return { ...base, numero: String(n), rotulo: `${palavra(n, UNIDADES.dia)} na meta de água`, sub: `em ${nomeDoMes(d.mesIdx)}` }; }
    case "sono": { const n = d.horas.filter((h) => h != null && h >= d.meta).length; return { ...base, numero: String(n), rotulo: `${palavra(n, UNIDADES.noite)} com ${numeroBR(d.meta, 1)} h ou mais`, sub: `em ${nomeDoMes(d.mesIdx)}` }; }
    case "habitos": { const n = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias).length; return { ...base, numero: String(n), rotulo: `${palavra(n, UNIDADES.dia)} de ${d.habito.toLowerCase()}`, sub: `em ${nomeDoMes(d.mesIdx)}` }; }
    case "metas": return { ...base, numero: `${d.feitas}/${Math.max(d.total, d.feitas)}`, rotulo: `${palavra(d.total, UNIDADES.meta)} ${d.feitas === 1 ? "batida" : "batidas"}`, sub: `em ${nomeDoMes(d.mesIdx)}` };
    case "insignia": return { ...base, cor: NIVEIS[d.nivel].metal[2], modulo: d.moduloNome, numero: NIVEIS[d.nivel].nome, rotulo: `em ${d.moduloNome}`, sub: d.feito };
    case "figurinha": return { ...base, numero: d.titulo, rotulo: `figurinha ${NOME_RARIDADE[d.raridade]}`, sub: d.descricao };
    case "numero": return { ...base, cor: temaDaCor(d.cor, d.modulo).destaque, modulo: d.modulo, numero: d.numero, rotulo: d.rotulo, sub: d.sub };
  }
};

export const CardAdesivo = ({ d }: { d: DadosCard }) => {
  const r = resumoDoAdesivo(d);
  const { w, h } = FORMATOS.adesivo;
  const numeroEhTexto = /[a-zà-ú]/i.test(r.numero);
  return (
    <div data-card={d.tipo} data-formato="adesivo" style={{ position: "relative", width: w, height: h, fontFamily: INTER, WebkitFontSmoothing: "antialiased", display: "grid", placeItems: "center", background: "transparent" }}>
      <div style={{ width: 860, padding: "54px 60px 46px", borderRadius: 64, background: "#ffffff", boxShadow: "0 30px 60px -24px rgba(0,0,0,.45)", color: "#1f1f24", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: r.cor }}>
          <r.Icone size={34} strokeWidth={2.6} />
          <Rotulo cor={r.cor} tam={26}>{r.modulo}</Rotulo>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 18, flexWrap: "wrap" }}>
          <Numero tam={numeroEhTexto ? 150 : tamDoNumero(r.numero, 250)} cor={r.cor} style={{ marginLeft: -6 }}>{r.numero}</Numero>
          <div style={{ fontSize: 58, fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1 }}>{r.rotulo}</div>
        </div>
        {r.sub && <div style={{ fontSize: 34, fontWeight: 700, color: "#5f574d", marginTop: 14 }}>{r.sub}</div>}
        {r.prova && <div style={{ marginTop: 30, display: "flex", justifyContent: "center" }}>{r.prova}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 34 }}>
          <IconeCore tamanho={46} borda />
          <span style={{ fontSize: 26, fontWeight: 800, color: "#1f1f24" }}>CORE</span>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- *
 * O card de qualquer tipo, em qualquer formato
 * ------------------------------------------------------------------------- */

export interface PropsCard {
  dados: DadosCard;
  formato: Formato;
  camada?: Camada;
  /** A moeda de verdade (MoedaEstatica) quando a frente das insígnias entrar. */
  moeda?: ReactNode;
}

export const CardDeCompartilhar = ({ dados, formato, camada = "tudo", moeda }: PropsCard) => {
  if (formato === "adesivo") return <CardAdesivo d={dados} />;
  const f = formato;
  let el: ReactNode;
  switch (dados.tipo) {
    case "treinos": el = <CardTreinos d={dados} formato={f} />; break;
    case "azul": el = <CardAzul d={dados} formato={f} />; break;
    case "poupanca": el = <CardPoupanca d={dados} formato={f} />; break;
    case "livros": el = <CardLivros d={dados} formato={f} />; break;
    case "sequencia": el = <CardSequencia d={dados} formato={f} />; break;
    case "agua": el = <CardAgua d={dados} formato={f} />; break;
    case "sono": el = <CardSono d={dados} formato={f} />; break;
    case "habitos": el = <CardHabitos d={dados} formato={f} />; break;
    case "metas": el = <CardMetas d={dados} formato={f} />; break;
    case "insignia": el = <CardInsignia d={dados} formato={f} moeda={moeda} />; break;
    case "figurinha": el = <CardFigurinha d={dados} formato={f} />; break;
    case "numero": el = <CardNumero d={dados} formato={f} />; break;
  }
  return <CamadaCtx.Provider value={camada}>{el}</CamadaCtx.Provider>;
};
