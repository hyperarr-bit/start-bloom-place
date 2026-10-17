import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, ChevronRight, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trackEvent } from "@/lib/analytics";
import { mesAtualExtenso } from "@/lib/utils";
import { isNativeShell } from "@/lib/native-shell";
import { diaDaMissao, missaoAtual, trialCartaoAtivo } from "@/lib/teste-gratis";
import { semanaDaSequencia, type DiaDaSemana, type EstadoDia } from "@/lib/sequencia-semana";
import { RARIDADE_LABEL, raridadeDe, type Badge } from "@/components/gamification/types";
import { AdesivoRaro } from "../adesivos-raridade";
import { Fogo } from "../Fogo";
import { varsDaFaixa } from "../CardSequencia";
import { AlbumTela } from "../AlbumTela";
import { paginaDaFigurinha } from "../album-paginas";
import { Previa } from "../SeletorDeArte";
import { StoriesAdesivo } from "../Stories";
import { compartilharAdesivo } from "../compartilhar-conquistas";
import type { Sequencia } from "../use-conquistas";
import { EVENTOS2, marcoDoAdesivo, quandoCurto, type ProximoPremio } from "./recompensas";
import { useConquistasNova, type ColecaoNova, type EstadoConquistasNova } from "./use-conquistas-nova";
import { AlbumHero } from "./AlbumHero";
import { CelebracaoMarco, ColecaoTela, DetalheSequencia, ToastAdesivo } from "./camadas";
import "../conquistas.css";
import "./conquistas-nova.css";

/**
 * CONQUISTAS 2 (16/10; atrás da chave `conquistas2`, lib/conquistas2.ts).
 * Direção B "Fogo & trilha" com o ÁLBUM como herói:
 *
 *  1. o cartão grafite da sequência: o número de dias no centro do ANEL DE 7
 *     ARCOS (a semana), recorde · protetores · dias anotados, a ação do dia;
 *  2. o ÁLBUM: a capa grande e tocável, "faltam N pra completar a página",
 *     o pacotinho com as figurinhas novas esperando pra ser COLADAS (toque →
 *     o peel), a vaga do prêmio de amanhã já marcada no álbum;
 *  3. a TRILHA dos marcos (2 → 3 → 7 → 14 → 30 → 100) e "AMANHÃ VOCÊ GANHA…";
 *  4. por módulo (chips, abrem o álbum na página) e "ver todos" (a grade, secundária).
 *
 * Fora: a capa do planner, as insígnias, o nível, a roseta e o seletor de
 * capas (os arquivos ficam; a chave da capa também). Emprestado da direção A:
 * os títulos das coleções em serifa e o papel pontilhado atrás do álbum.
 */

export type CamadaDev = "toast" | "marco" | "colecao" | "sequencia" | "album" | "pagina" | "colar" | null;

export interface PropsConquistasNova {
  /** Dia da missão do teste grátis (1..3) — por padrão vem do aparelho (missaoAtual). */
  testeDia?: 1 | 2 | 3 | null;
  /** Só no /dev: abre já com uma camada por cima. */
  camada?: CamadaDev;
  onVoltar?: () => void;
}

const mesCurto = (d = new Date()) => {
  const m = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
};
const ORIGENS = ["home", "menu", "celebracao", "toast", "missao"];
/** A capa "levanta" este tempo antes de o álbum abrir. */
export const LEVANTAR_MS = 260;

/** O dia da missão do teste grátis (1..3), só no app, com o teste e a missão valendo. */
export const diaDoTeste = (): 1 | 2 | 3 | null => {
  try {
    if (!isNativeShell() || !trialCartaoAtivo()) return null;
    const m = missaoAtual();
    return m ? diaDaMissao(m) : null;
  } catch { return null; }
};

/* ------------------------------------------------------------------ cabeçalho */

const Cabecalho = ({ seq, onVoltar }: { seq: Sequencia; onVoltar: () => void }) => (
  <header className="border-b border-border bg-card sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
      <button type="button" onClick={onVoltar} className="hover:bg-muted rounded-md p-1 transition-colors" aria-label="Voltar">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={20} semBrilho />
      <h1 className="text-base font-bold tracking-tight">CONQUISTAS</h1>
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          <span className="hidden min-[400px]:inline">{mesAtualExtenso()}</span>
          <span className="min-[400px]:hidden">{mesCurto()}</span>
        </span>
        <ThemeToggle />
      </div>
    </div>
  </header>
);

/* ------------------------------------------------------------------ o cartão da sequência (B) */

const AcaoDoDia = ({ seq, onAcao }: { seq: Sequencia; onAcao: (rota: string) => void }) => {
  const { hojeFeito, dias, acao } = seq;
  if (hojeFeito) {
    return (
      <p className="text-[12.5px] leading-relaxed text-white/80" data-testid="cn-garantido">
        <span className="font-bold inline-flex items-center gap-1" style={{ color: "#fde68a" }}>
          Hoje já tá garantido <Check className="w-4 h-4" strokeWidth={3} aria-hidden />
        </span>
        {` — ${dias} ${dias === 1 ? "dia seguido" : "dias seguidos"}.`}
      </p>
    );
  }
  return (
    <p className="text-[12.5px] leading-relaxed text-white/80" data-testid="cn-acao">
      {dias > 0 ? <>Hoje falta <b className="text-white">1 coisa</b> pra manter: </> : <>Anote <b className="text-white">1 coisa</b> hoje pra começar: </>}
      <button type="button" className="cn-b-acao" onClick={() => { trackEvent(EVENTOS2.acaoToque, { acao: acao.id, via: "principal" }); onAcao(acao.rota); }}>
        {acao.texto}
      </button>
    </p>
  );
};

const R = 86, C = 98, FOLGA = 10;
const TOTAL = 2 * Math.PI * R;
const ARCO = TOTAL / 7 - FOLGA;

const AnelSemana = ({ semana }: { semana: DiaDaSemana[] }) => (
  <svg viewBox="0 0 196 196" aria-hidden>
    {semana.map((d, i) => (
      <circle key={d.dia} className="cn-b-seg" data-estado={d.estado} cx={C} cy={C} r={R} strokeDasharray={`${ARCO} ${TOTAL - ARCO}`} strokeDashoffset={-(i * (ARCO + FOLGA) + FOLGA / 2)} />
    ))}
  </svg>
);

/** O arco de "hoje" tracejado precisa do próprio recorte: um arco só, tracejado, no lugar dele. */
const ArcoHoje = ({ indice }: { indice: number }) => {
  const ini = (i: number) => (i * (ARCO + FOLGA) + FOLGA / 2) / TOTAL * Math.PI * 2;
  const a0 = ini(indice), a1 = a0 + (ARCO / TOTAL) * Math.PI * 2;
  const p = (a: number) => `${(C + Math.cos(a) * R).toFixed(2)} ${(C + Math.sin(a) * R).toFixed(2)}`;
  return (
    <svg viewBox="0 0 196 196" aria-hidden>
      <path className="cn-b-seg" data-estado="hoje" d={`M ${p(a0)} A ${R} ${R} 0 0 1 ${p(a1)}`} />
    </svg>
  );
};

const CartaoSequencia = ({ e, onDetalhe, onAcao }: { e: EstadoConquistasNova; onDetalhe: () => void; onAcao: (rota: string) => void }) => {
  const { seq } = e;
  const semana = useMemo(() => semanaDaSequencia(seq.lista, seq.usados, seq.hoje), [seq.lista, seq.usados, seq.hoje]);
  const hojeIdx = semana.findIndex((d) => d.estado === "hoje");
  const semHoje = semana.map((d) => (d.estado === "hoje" ? { ...d, estado: "futuro" as EstadoDia } : d));
  return (
    <section className="cn-b-hero px-4 pt-5 pb-4" style={varsDaFaixa(seq.faixa)} aria-label="Sequência" data-testid="cn-hero">
      <button type="button" onClick={onDetalhe} className="relative block w-full text-center" data-testid="cn-abrir-sequencia">
        <div className="cn-b-anel">
          <AnelSemana semana={semHoje} />
          {hojeIdx >= 0 && <ArcoHoje indice={hojeIdx} />}
          <div className="cn-b-centro">
            <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={52} viva={seq.dias > 0} />
            <span className="cn-b-num">{seq.dias}</span>
            <span className="cn-b-rot">{seq.dias === 1 ? "DIA SEGUIDO" : "DIAS SEGUIDOS"}</span>
          </div>
        </div>
      </button>
      <div className="cn-b-letras mt-3 px-3">
        {semana.map((d) => <span key={d.dia} className="cn-b-letra" data-estado={d.estado}><i /> {d.rotulo.charAt(0)}</span>)}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
        <span className="cn-b-stat"><b>{seq.recorde}</b><span>recorde</span></span>
        <span className="cn-b-stat"><b className="inline-flex items-center gap-1"><Shield className="w-3.5 h-3.5" aria-hidden /> {seq.saldo} de 2</b><span>protetores</span></span>
        <span className="cn-b-stat"><b>{seq.lista.length}</b><span>dias anotados</span></span>
      </div>
      <div className="mt-3"><AcaoDoDia seq={seq} onAcao={onAcao} /></div>
    </section>
  );
};

/* ------------------------------------------------------------------ a trilha + amanhã você ganha */

const TextoDoPremio = ({ premio, testeDia }: { premio: ProximoPremio; testeDia: 1 | 2 | 3 | null }) => {
  const b = premio.adesivo;
  const r = b ? raridadeDe(b) : null;
  return (
    <>
      <span className="cn-caps block" style={{ color: "hsl(var(--accent))" }}>{premio.titulo}</span>
      <span className="block text-[16px] font-extrabold leading-tight mt-0.5">
        {b ? b.name : "+1 protetor"}
        {b && premio.daProtetor && <span className="text-muted-foreground font-bold text-[12px]"> + 1 protetor</span>}
      </span>
      <span className="block text-[11.5px] text-muted-foreground leading-[1.35] mt-0.5" data-testid="cn-amanha-instrucao">
        {r && r !== "comum" ? `adesivo ${RARIDADE_LABEL[r].toLowerCase()} · ` : ""}
        {premio.instrucao}
        {testeDia && premio.marco === 3 ? " · é o 3º dia da sua missão" : ""}
      </span>
    </>
  );
};

const Trilha = ({ e, onAdesivo, testeDia }: { e: EstadoConquistasNova; onAdesivo: (b: Badge) => void; testeDia: 1 | 2 | 3 | null }) => {
  const { premio, trilha, seq } = e;
  const trilhoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = trilhoRef.current;
    const alvo = t?.querySelector<HTMLElement>("[data-proximo]");
    if (!t || !alvo) return;
    t.scrollLeft = Math.max(0, alvo.offsetLeft - t.clientWidth / 2 + alvo.clientWidth / 2);
  }, [premio.marco]);
  return (
    <section className="cn-card" aria-label="Próximos prêmios" data-testid="cn-amanha" style={varsDaFaixa(seq.faixa)}>
      <div className="h-11 px-4 flex items-center gap-2 border-b border-border">
        <h2 className="text-[13px] font-extrabold tracking-wide">TRILHA DA SEQUÊNCIA</h2>
        <span className="ml-auto text-[11px] font-bold text-muted-foreground whitespace-nowrap">{trilha.filter((b) => b.unlocked).length} de {trilha.length} marcos</span>
      </div>
      <div className="cn-trilha" ref={trilhoRef}>
        {trilha.map((b) => {
          const m = marcoDoAdesivo(b.id)!;
          const proximo = m === premio.marco;
          return (
            <button key={b.id} type="button" className="cn-trilha-no" data-feito={b.unlocked ? "" : undefined} data-proximo={proximo ? "" : undefined} data-trancado={!b.unlocked ? "" : undefined} onClick={() => onAdesivo(b)} aria-label={`${m} dias: ${b.name}`}>
              <span className="cn-trilha-disco"><AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={proximo ? 50 : 38} trancado={!b.unlocked} /></span>
              <span className="cn-trilha-quando">{proximo ? quandoCurto(premio) : b.unlocked ? "colado" : `${m} dias`}</span>
              <span className="cn-trilha-nome">{b.name}</span>
            </button>
          );
        })}
      </div>
      <div className="px-4 pb-3.5 pt-1 flex items-start gap-3 border-t border-dashed border-border">
        <span className="flex-1 min-w-0 pt-2"><TextoDoPremio premio={premio} testeDia={testeDia} /></span>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ por módulo (secundário) */

const PorModulo = ({ e, onColecao, onTodos }: { e: EstadoConquistasNova; onColecao: (c: ColecaoNova) => void; onTodos: () => void }) => (
  <section className="cn-card" aria-labelledby="cn-titulo-modulos" data-testid="cn-colecao">
    <div className="h-11 px-4 flex items-center gap-2">
      <h2 id="cn-titulo-modulos" className="text-[13px] font-extrabold tracking-wide">PÁGINAS DO ÁLBUM</h2>
      <span className="ml-auto text-[12.5px] font-bold tabular-nums">{e.abertos} de {e.total}</span>
    </div>
    <div className="cn-modulos px-3 pb-3">
      {e.colecoes.filter((c) => c.id !== "geral").map((c) => (
        <button key={c.id} type="button" className="cn-modulo" data-completa={c.abertos >= c.total ? "" : undefined} onClick={() => onColecao(c)} data-testid={`cn-colecao-${c.id}`}>
          <span className="text-[15px] leading-none" aria-hidden>{c.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="cn-serif block text-[16px] leading-none truncate">{c.label}</span>
            <span className="block text-[10px] font-bold text-muted-foreground mt-0.5 tabular-nums truncate">{c.abertos}/{c.total}{c.total - c.abertos <= 3 && c.total > c.abertos ? <span style={{ color: "hsl(var(--accent))" }}> · faltam {c.total - c.abertos}</span> : c.abertos >= c.total ? " · completa" : ""}</span>
          </span>
          <span className="cn-barra w-9 shrink-0"><i style={{ width: `${Math.round((c.abertos / Math.max(1, c.total)) * 100)}%` }} /></span>
        </button>
      ))}
    </div>
    <button type="button" onClick={onTodos} className="w-full h-10 text-[12px] font-bold text-muted-foreground inline-flex items-center justify-center gap-1 border-t border-border" data-testid="cn-ver-todos">
      <span>Ver todos os adesivos</span> <ChevronRight className="w-3.5 h-3.5" aria-hidden />
    </button>
  </section>
);

/* ------------------------------------------------------------------ a tela */

type EstadoDoAlbum = { aberto: boolean; pagina: number; via: "capa" | "pacotinho" | "toast" | "missao" | "vaga" | "colecao" };

export const ConquistasNova = ({ testeDia: testeDiaProp, camada = null, onVoltar }: PropsConquistasNova) => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduzir = useReducedMotion();
  const e = useConquistasNova();
  const testeDia = testeDiaProp !== undefined ? testeDiaProp : diaDoTeste();
  const [detalhe, setDetalhe] = useState(camada === "sequencia");
  const [colecao, setColecao] = useState<{ aberta: boolean; de: ColecaoNova | null }>({ aberta: camada === "colecao", de: null });
  const [album, setAlbum] = useState<EstadoDoAlbum>({ aberto: false, pagina: 0, via: "capa" });
  const [levantando, setLevantando] = useState(false);
  const [previa, setPrevia] = useState<Badge | null>(null);
  const [toastDev, setToastDev] = useState(camada === "toast");
  const [festaDev, setFestaDev] = useState(camada === "marco");
  const abriuEm = useRef(Date.now());
  const estado = location.state as { origem?: string; album?: string } | null;

  useEffect(() => {
    const origem = estado?.origem;
    trackEvent(EVENTOS2.abrir, { origem: origem && ORIGENS.includes(origem) ? origem : camada ? "dev" : "outro", dias: e.seq.dias, teste_dia: testeDia });
    trackEvent(EVENTOS2.amanhaVisto, { marco: e.premio.marco, quando: e.premio.quando });
    const t = abriuEm.current;
    return () => { trackEvent(EVENTOS2.tempo, { ms: Date.now() - t }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Abre o álbum de verdade: a capa levanta 260 ms e o livro entra (com movimento reduzido, direto). */
  const abrirAlbum = useCallback((via: EstadoDoAlbum["via"], pagina = 0) => {
    trackEvent(EVENTOS2.albumAbrir, { origem: via, pagina, novas: e.pendentes.length });
    if (reduzir || via !== "capa") { setAlbum({ aberto: true, pagina, via }); return; }
    setLevantando(true);
    setTimeout(() => { setLevantando(false); setAlbum({ aberto: true, pagina, via }); }, LEVANTAR_MS);
  }, [e.pendentes.length, reduzir]);

  // veio do toast (ou da missão): abre o álbum na página da figurinha nova — uma vez por chegada
  const chegada = estado?.album ?? null;
  const chegadaTratada = useRef<string | null>(null);
  useEffect(() => {
    if (!chegada || !e.registroPronto || chegadaTratada.current === chegada) return;
    chegadaTratada.current = chegada;
    abrirAlbum(estado?.origem === "missao" ? "missao" : "toast", paginaDaFigurinha(e.paginas, chegada));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chegada, e.registroPronto]);

  // só no /dev: já com o álbum aberto (capa, página com vagas, figurinha pra colar)
  useEffect(() => {
    if (camada === "album") setAlbum({ aberto: true, pagina: 0, via: "capa" });
    if (camada === "pagina") setAlbum({ aberto: true, pagina: e.paginaMaisPerto?.indice ?? 1, via: "colecao" });
    if (camada === "colar") setAlbum({ aberto: true, pagina: e.paginaDasNovas, via: "pacotinho" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camada]);

  const voltar = () => (onVoltar ? onVoltar() : navigate("/home"));
  const irPara = (rota: string) => navigate(rota);
  const abrirDetalhe = () => { trackEvent(EVENTOS2.sequenciaAbrir, { dias: e.seq.dias }); setDetalhe(true); };
  const abrirTodos = () => { trackEvent(EVENTOS2.colecaoAbrir, { colecao: "todas" }); setColecao({ aberta: true, de: null }); };
  /** Toque num adesivo fora do álbum: abre o álbum na página dele. */
  const tocarAdesivo = (b: Badge, via: EstadoDoAlbum["via"] = "vaga") => {
    trackEvent(EVENTOS2.adesivoToque, { id: b.id, aberto: b.unlocked, colecao: b.category });
    setDetalhe(false);
    setColecao({ aberta: false, de: null });
    abrirAlbum(via, paginaDaFigurinha(e.paginas, b.id));
  };
  const colar = (b: Badge) => {
    e.colar(b.id);
    trackEvent(EVENTOS2.figurinhaColar, { id: b.id, raridade: raridadeDe(b), restantes: Math.max(0, e.pendentes.length - 1) });
  };
  const compartilharMarco = async (b: Badge) => {
    await compartilharAdesivo({ id: b.id, titulo: b.name, descricao: b.description, raridade: raridadeDe(b), nome: e.nome, membroDesde: e.membroDesde });
  };

  const adesivoToast = e.folha.find((b) => b.unlocked && raridadeDe(b) === "comum") ?? e.folha[0];
  const adesivoMarco = e.adesivos.find((b) => b.id === "sequencia-7") ?? e.adesivos[0];
  const pendentesIds = useMemo(() => e.pendentes.map((b) => b.id), [e.pendentes]);

  const missao: ReactNode = testeDia ? (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1" data-testid="cn-missao">
      <span className="cn-pill cn-pill-acento">Missão · dia {testeDia} de 3</span>
      <span className="text-[11.5px] text-muted-foreground min-w-0">
        {e.pendentes.length > 0
          ? <button type="button" className="font-bold text-foreground underline-offset-2 underline" onClick={() => abrirAlbum("missao", e.paginaDasNovas)} data-testid="cn-missao-album">Seu adesivo está esperando no álbum ›</button>
          : testeDia === 3 ? "Último dia: anote 1 coisa e cola o adesivo raro." : testeDia === 2 ? "Voltou! Anote 1 coisa hoje e amanhã vem o raro." : "Anote 1 coisa hoje; amanhã já tem adesivo."}
      </span>
    </div>
  ) : null;

  return (
    <div className="cn min-h-screen bg-background" data-testid="conquistas-nova">
      <Cabecalho seq={e.seq} onVoltar={voltar} />
      <main className="cn-main min-h-[calc(100vh-57px)]">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-10 space-y-3.5">
          {missao}
          <CartaoSequencia e={e} onDetalhe={abrirDetalhe} onAcao={irPara} />
          <AlbumHero e={e} levantando={levantando} onAbrir={() => abrirAlbum("capa", 0)} onPacotinho={() => abrirAlbum("pacotinho", e.paginaDasNovas)} />
          <Trilha e={e} onAdesivo={(b) => tocarAdesivo(b)} testeDia={testeDia} />
          <PorModulo e={e} onColecao={(c) => { trackEvent(EVENTOS2.colecaoAbrir, { colecao: c.id }); abrirAlbum("colecao", c.pagina); }} onTodos={abrirTodos} />
        </div>
      </main>

      <DetalheSequencia e={e} aberto={detalhe} onFechar={() => setDetalhe(false)} onAdesivo={(b) => tocarAdesivo(b)} />
      {colecao.aberta && <ColecaoTela e={e} inicial={colecao.de} onFechar={() => setColecao({ aberta: false, de: null })} onAdesivo={(b) => tocarAdesivo(b, "colecao")} />}

      <AnimatePresence>
        {album.aberto && (
          <AlbumTela
            key="album"
            aberto={album.aberto}
            paginas={e.paginas}
            adesivos={e.adesivos}
            desbloqueadas={e.desbloqueadas}
            novas={[]}
            pendentes={pendentesIds}
            onColar={colar}
            destaques={e.destaques}
            maisRaros={e.paginas[0].vagas}
            abertos={e.abertos}
            total={e.total}
            porRaridade={e.porRaridade}
            nome={e.nome}
            ano={e.ano}
            diasDeSequencia={e.seq.dias}
            paginaInicial={album.pagina}
            via={album.via}
            onFechar={() => setAlbum((a) => ({ ...a, aberto: false }))}
            onCompartilharFigurinha={(b) => setPrevia(b)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previa && (
          <Previa
            key={previa.id}
            titulo={previa.name}
            elemento={<StoriesAdesivo id={previa.id} titulo={previa.name} descricao={previa.description} raridade={raridadeDe(previa)} nome={e.nome} membroDesde={e.membroDesde} />}
            onPostar={() => compartilharAdesivo({ id: previa.id, titulo: previa.name, descricao: previa.description, raridade: raridadeDe(previa), nome: e.nome, membroDesde: e.membroDesde })}
            onFechar={() => setPrevia(null)}
          />
        )}
      </AnimatePresence>

      {/* só no /dev: o toast e a festa do marco como ficam (no app quem monta é MomentosConquistas) */}
      {toastDev && adesivoToast && <ToastAdesivo badge={adesivoToast} colecao={e.colecoes.find((c) => c.id === adesivoToast.category)?.label} suave={!!testeDia} onToque={() => { setToastDev(false); abrirAlbum("toast", paginaDaFigurinha(e.paginas, adesivoToast.id)); }} />}
      {festaDev && adesivoMarco && <CelebracaoMarco badge={adesivoMarco} dias={7} seq={e.seq} onContinuar={() => setFestaDev(false)} onCompartilhar={() => compartilharMarco(adesivoMarco)} />}
    </div>
  );
};
