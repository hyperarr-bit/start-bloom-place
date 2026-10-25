import { CelebracaoFigurinha } from "./CelebracaoFigurinha";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LinkRetrospectiva } from "@/components/conquistas/LinkRetrospectiva";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { diaCurtoPtBR } from "@/lib/utils";
import { diaDaMissao, missaoAtual, trialCartaoAtivo } from "@/lib/teste-gratis";
import { diaDaMissao as diaDaMissaoDoses, lerMissao as lerMissaoDoses } from "@/lib/missao-doses";
import { semanaDaSequencia } from "@/lib/sequencia-semana";
import { raridadeDe, type Badge } from "@/components/gamification/types";
import "./conquistas-editorial.css";

import { useUserData } from "@/hooks/use-user-data";
import { CHAVE_CAPA_PESSOAL, lerCapaPessoal, figurinhasDaCapa, type CapaPessoal } from "../capa-pessoal";
import { PersonalizarCapa } from "../PersonalizarCapa";
import { Adesivo } from "../adesivos-arte";
import "./conquistas-pessoal.css";
import { AlbumTela, DetalheFigurinha, numeroDaFigurinha } from "../AlbumTela";
import { paginaDaFigurinha } from "../album-paginas";
import { CompartilharFigurinha } from "../CompartilharFigurinha";
import type { Sequencia } from "../use-conquistas";
import { EVENTOS2, contagem, fraseCompactaDoPremio, fraseDoPremio } from "./recompensas";
import { useConquistasNova, type ColecaoNova, type EstadoConquistasNova } from "./use-conquistas-nova";
import { AlbumHero } from "./AlbumHero";
import { FogoDaSequencia } from "./FogoDaSequencia";
import { fogoDoCaderno } from "./fogo-caderno";
import { varsDaFaixa } from "../CardSequencia";
import { CelebracaoMarco, ColecaoTela, DetalheSequencia, ToastAdesivo } from "./camadas";
import "../conquistas.css";
import "./conquistas-nova.css";
import "./conquistas-caderno.css";

/** Álbum, sequência e coleção com foco nas artes de caderno.
 * Dados, critérios de desbloqueio e telemetria continuam nos hooks existentes. */

export type CamadaDev = "toast" | "festa" | "marco" | "colecao" | "sequencia" | "album" | "pagina" | "colar" | null;

export interface PropsConquistasNova {
  /** Dia da missão do teste grátis (1..3) — por padrão vem do aparelho (missaoAtual). */
  testeDia?: 1 | 2 | 3 | null;
  /** Só no /dev: abre já com uma camada por cima. */
  camada?: CamadaDev;
  prototipoSequencia?: boolean;
  figurinhaFesta?: string;
  primeiraFesta?: boolean;
  onVoltar?: () => void;
}

const ORIGENS = ["home", "menu", "celebracao", "toast", "missao"];
/** A capa "levanta" este tempo antes de o álbum abrir. */
export const LEVANTAR_MS = 260;

/** O dia da missão do teste grátis (1..3), só no app, com o teste e a missão valendo. */
export const diaDoTeste = (): 1 | 2 | 3 | null => {
  try {
    if (!isNativeShell() || !trialCartaoAtivo()) return null;
    const m = missaoAtual();
    if (m) return diaDaMissao(m);
    // 1.0.16: quem é novo tem a missão em doses (lib/missao-doses), não a antiga — o dia do calendário do teste
    const nova = lerMissaoDoses();
    if (!nova || nova.explorou) return null;
    const d = diaDaMissaoDoses(nova);
    return d >= 1 && d <= 3 ? (d as 1 | 2 | 3) : null;
  } catch { return null; }
};

/* ------------------------------------------------------------------ cabeçalho */

const Cabecalho = ({ onVoltar }: { onVoltar: () => void }) => (
  <header className="cn-cabecalho">
    <div>
      <button type="button" onClick={onVoltar} aria-label="Voltar"><ArrowLeft /></button>
      <h1>Conquistas</h1>
      <ThemeToggle />
    </div>
  </header>
);

/* ------------------------------------------------------------------ o cartão da sequência (B) */

/** "anote o gasto de hoje" → "anote o gasto": o chip já começa com "Hoje:". */
export const semHojeNoFim = (t: string) => t.replace(/\s+(de\s+)?hoje\b\.?$/i, "");

/**
 * A ação do dia num chip só — "Hoje: marque um hábito" (dono 17/10: menos
 * palavras, o olho vai pro número e pro álbum); feito → "Hoje garantido ✓".
 * A frase inteira fica no aria-label.
 */
const AcaoDoDia = ({ seq, onAcao }: { seq: Sequencia; onAcao: (rota: string) => void }) => {
  const { hojeFeito, dias, acao } = seq;
  if (hojeFeito) {
    return (
      <p className="cn-seq-feito" data-testid="cn-garantido" aria-label={`Hoje já está garantido — ${dias} ${dias === 1 ? "dia seguido" : "dias seguidos"}`}>
        <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /> Hoje garantido
      </p>
    );
  }
  return (
    <button
      type="button"
      className="cn-acao cn-acao-chip"
      data-testid="cn-acao"
      aria-label={`Anota 1 coisa hoje pra ${dias > 0 ? "não perder a sequência" : "começar"}: ${acao.texto}`}
      onClick={() => { trackEvent(EVENTOS2.acaoToque, { acao: acao.id, via: "principal" }); onAcao(acao.rota); }}
    >
      <CalendarDays aria-hidden /><span>{/hábito/.test(acao.texto) ? "Marcar um hábito" : semHojeNoFim(acao.texto).replace(/^./, (c) => c.toUpperCase())}</span>
    </button>
  );
};

const CartaoSequencia = ({ e, onDetalhe, onAcao }: { e: EstadoConquistasNova; onDetalhe: () => void; onAcao: (rota: string) => void }) => {
  const { seq, premio } = e;
  const fogo = fogoDoCaderno(seq.dias);
  const semana = useMemo(() => semanaDaSequencia(seq.lista, seq.usados, seq.hoje), [seq.lista, seq.usados, seq.hoje]);
  return (
    <section className="cn-card cn-seq" aria-label="Sequência" data-testid="cn-hero" data-faixa={seq.dias > 0 ? fogo.id : "apagado"} style={varsDaFaixa(fogo)}>
      <button type="button" className="cn-seq-cab" onClick={onDetalhe} data-testid="cn-abrir-sequencia" aria-label="Ver detalhes da sequência" aria-describedby="cn-seq-proximo">
        <FogoDaSequencia dias={seq.dias} />
        <span className="cn-seq-textos"><span className="cn-seq-dias"><b className="cn-seq-num">{seq.dias}</b> {seq.dias === 1 ? "dia seguido" : "dias seguidos"}</span>
          <span id="cn-seq-proximo" className="cn-seq-evolucao" data-testid="cn-amanha-frase" aria-label={`${fraseDoPremio(premio)}. ${premio.instrucao}`}>{fraseCompactaDoPremio(premio)}</span>
          <span className="cn-seq-resumo sr-only" data-testid="cn-seq-resumo" aria-label={`Recorde ${contagem(seq.recorde, "dia", "dias")} · ${seq.saldo} de 2 protetores · ${contagem(seq.lista.length, "dia anotado", "dias anotados")}`}>
            Recorde: {contagem(seq.recorde, "dia", "dias")} <i>·</i> <Shield aria-hidden/> {seq.saldo} {seq.saldo === 1 ? "protetor" : "protetores"}
          </span>
        </span><ChevronRight className="cn-seq-seta" aria-hidden/>
      </button>
      <div className="cn-seq-semana" role="list" aria-label="Semana" data-testid="cn-seq-semana">
        {semana.map((d) => <span key={d.dia} className="cn-b-letra" data-estado={d.estado} role="listitem" aria-label={`${d.rotulo}: ${d.estado}`}><i>{(d.estado === "feito" || (d.estado === "hoje" && seq.hojeFeito)) ? <Check aria-hidden/> : d.estado === "gelo" ? <Shield aria-hidden/> : null}</i><span>{d.dia === seq.hoje ? "Hoje" : d.rotulo.charAt(0)}</span></span>)}
      </div>
      <AcaoDoDia seq={seq} onAcao={onAcao}/>

    </section>
  );
};

const PreviaColecao = ({ e, onTodos, onAdesivo }: { e: EstadoConquistasNova; onTodos: () => void; onAdesivo: (b: Badge) => void }) => {
  const ganhas = e.folha.filter(b => b.unlocked).slice(0,3);
  if (!ganhas.length) return <button type="button" className="cn-explorar" onClick={onTodos} data-testid="cn-ver-todos">Conhecer as figurinhas do álbum <ChevronRight size={16}/></button>;
  return <section className="cn-colecao-previa" aria-labelledby="cn-colecao-titulo">
    <div className="cn-colecao-cab"><h2 id="cn-colecao-titulo">Sua coleção</h2><button type="button" onClick={onTodos} data-testid="cn-ver-todos">Ver todas <ChevronRight aria-hidden/></button></div>
    <div className="cn-colecao-mini-grade">{ganhas.map(b => <button type="button" className="cn-colecao-mini" key={b.id} onClick={() => onAdesivo(b)} aria-label={`${b.name}: conquistada`}><span className="cn-colecao-mini-arte"><Adesivo id={b.id} tamanho={108}/><span className="cn-colecao-estado"><Check aria-hidden/></span></span><span>{b.name}</span></button>)}</div>
  </section>;
};

/* ------------------------------------------------------------------ a tela */

type EstadoDoAlbum = { aberto: boolean; pagina: number; via: "capa" | "pacotinho" | "toast" | "missao" | "vaga" | "colecao" };

/** Inspeção independente: mantém a coleção montada, sem abrir o livro. */
const FigurinhaEmFoco = ({ e, b, onFechar, onPostar, onIr, onUsarNaCapa }: { e: EstadoConquistasNova; b: Badge; onFechar: () => void; onPostar: (b: Badge) => void; onIr: (caminho: string) => void; onUsarNaCapa: (b:Badge)=>void }) => {
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escapar = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onFechar(); }
    };
    window.addEventListener("keydown", escapar);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", escapar);
    };
  }, [onFechar]);
  return <div className="cn-figurinha-em-foco" data-testid="cn-figurinha-em-foco">
    <DetalheFigurinha b={b} n={numeroDaFigurinha(e.adesivos, b.id)} desbloqueadoEm={e.desbloqueadas[b.id]} porRaridade={e.porRaridade} diasDeSequencia={e.seq.dias} onFechar={onFechar} onPostar={onPostar} onIr={onIr} onUsarNaCapa={onUsarNaCapa} />
  </div>;
};

export const ConquistasNova = ({ testeDia: testeDiaProp, camada = null, prototipoSequencia = false, figurinhaFesta = "mes-20", primeiraFesta = false, onVoltar }: PropsConquistasNova) => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduzir = useReducedMotion();
  const e = useConquistasNova();
  const { get, set } = useUserData();
  const capaCru = get<unknown>(CHAVE_CAPA_PESSOAL, null);
  const capa = lerCapaPessoal(capaCru);
  const figurinhasCapa = figurinhasDaCapa(capa,e.adesivos,e.desbloqueadas,e.pendentes.map(b=>b.id));
  const [editor, setEditor] = useState<CapaPessoal | null>(null);
  const [primeiraColada, setPrimeiraColada] = useState(false);
  const testeDia = testeDiaProp !== undefined ? testeDiaProp : diaDoTeste();
  const mostrarSequencia = !testeDia || e.abertos > 0;
  const premioVisto = useRef(false);
  const [detalhe, setDetalhe] = useState(camada === "sequencia");
  const [colecao, setColecao] = useState<{ aberta: boolean; de: ColecaoNova | null }>({ aberta: camada === "colecao", de: null });
  const [album, setAlbum] = useState<EstadoDoAlbum>({ aberto: false, pagina: 0, via: "capa" });
  const [levantando, setLevantando] = useState(false);
  const [previa, setPrevia] = useState<Badge | null>(null);
  const [figurinhaEmFoco, setFigurinhaEmFoco] = useState<Badge | null>(null);
  const fecharFigurinha = useCallback(() => setFigurinhaEmFoco(null), []);
  const [toastDev, setToastDev] = useState(camada === "toast");
  const [festaFigurinhaDev, setFestaFigurinhaDev] = useState(camada === "festa");
  const [festaDev, setFestaDev] = useState(camada === "marco");
  const abriuEm = useRef(Date.now());
  const estado = location.state as { origem?: string; album?: string; colar?: boolean } | null;
  /* 1.0.19 (prints do dono 26/10): a página pinta o fundo do app — faixa do relógio, o resto da casca e o respiro da
     barra de vidro (body.com-barra-vidro) — com o papel da tela, sem faixa branca em cima nem embaixo (conquistas-caderno.css). */
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.add("cn-fundo-da-tela");
    return () => raiz.classList.remove("cn-fundo-da-tela");
  }, []);

  useEffect(() => {
    const origem = estado?.origem;
    trackEvent(EVENTOS2.abrir, { origem: origem && ORIGENS.includes(origem) ? origem : camada ? "dev" : "outro", dias: e.seq.dias, teste_dia: testeDia });
    const t = abriuEm.current;
    return () => { trackEvent(EVENTOS2.tempo, { ms: Date.now() - t }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mostrarSequencia || premioVisto.current) return;
    premioVisto.current = true;
    trackEvent(EVENTOS2.amanhaVisto, { marco: e.premio.marco, quando: e.premio.quando });
  }, [mostrarSequencia, e.premio.marco, e.premio.quando]);

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
    abrirAlbum(estado?.colar ? "pacotinho" : estado?.origem === "missao" ? "missao" : "toast", paginaDaFigurinha(e.paginas, chegada));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chegada, e.registroPronto]);

  // só no /dev: já com o álbum aberto (capa, página com vagas, figurinha pra colar)
  useEffect(() => {
    if (camada === "album") setAlbum({ aberto: true, pagina: 0, via: "capa" });
    if (camada === "pagina") setAlbum({ aberto: true, pagina: prototipoSequencia ? 1 : e.paginaMaisPerto?.indice ?? 1, via: "colecao" });
    if (camada === "colar") setAlbum({ aberto: true, pagina: e.paginaDasNovas, via: "pacotinho" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camada]);

  const voltar = () => (onVoltar ? onVoltar() : navigate("/home"));
  const irPara = (rota: string) => navigate(rota);
  const abrirDetalhe = () => { trackEvent(EVENTOS2.sequenciaAbrir, { dias: e.seq.dias }); setDetalhe(true); };
  const abrirTodos = () => { trackEvent(EVENTOS2.colecaoAbrir, { colecao: "todas" }); setColecao({ aberta: true, de: null }); };
  /** Toque na coleção ou prévia: amplia só a figurinha. */
  const tocarAdesivo = (b: Badge) => {
    trackEvent(EVENTOS2.adesivoToque, { id: b.id, aberto: b.unlocked, colecao: b.category });
    setDetalhe(false);
    setFigurinhaEmFoco(b);
  };
  const usarNaCapa = (b: Badge) => {
    if (!b.unlocked) return;
    fecharFigurinha(); setColecao({aberta:false,de:null}); setAlbum(a=>({...a,aberto:false}));
    setEditor({...capa,figurinhas:[b.id,...figurinhasCapa.filter(x=>x.id!==b.id).map(x=>x.id)].slice(0,3)});
  };
  const salvarCapa = (nova:CapaPessoal) => {
    const segura = lerCapaPessoal(nova);
    if (segura.figurinhas) segura.figurinhas = segura.figurinhas.filter(id=>e.adesivos.some(b=>b.id===id && b.unlocked));
    set(CHAVE_CAPA_PESSOAL, segura, {system:true});
    trackEvent("album_capa_personalizar", {cor:segura.cor,quantidade:segura.figurinhas?.length ?? null,automatica:segura.figurinhas===null});
    setEditor(null); setPrimeiraColada(false);
    requestAnimationFrame(()=>document.querySelector<HTMLElement>(".cn-album-pessoal")?.scrollIntoView?.({behavior:reduzir?"auto":"smooth",block:"start"}));
  };
  const primeiraColagemMedida = useRef(false);
  const colar = (b: Badge) => {
    if (e.coladas===0 && !primeiraColagemMedida.current) { primeiraColagemMedida.current=true; setPrimeiraColada(true); trackEvent("album_primeira_colagem", {id:b.id,teste_dia:testeDia}); }
    e.colar(b.id);
    trackEvent(EVENTOS2.figurinhaColar, { id: b.id, raridade: raridadeDe(b), restantes: Math.max(0, e.pendentes.length - 1) });
  };
  const compartilharMarco = (b: Badge) => { setFestaDev(false); setPrevia(b); };

  const adesivoToast = e.pendentes.find(b => raridadeDe(b) === "comum") ?? e.folha.find((b) => b.unlocked && raridadeDe(b) === "comum") ?? e.folha[0];
  const adesivoFesta = e.adesivos.find(b => b.id === figurinhaFesta) ?? e.adesivos.find(b => raridadeDe(b) === "epico");
  const adesivoMarco = e.adesivos.find((b) => b.id === "sequencia-7") ?? e.adesivos[0];
  const pendentesIds = useMemo(() => e.pendentes.map((b) => b.id), [e.pendentes]);

  // o chip da missão (dono 17/10: curto) — o adesivo de hoje/amanhã já está na trilha, então sem frase repetida aqui
  const n = e.pendentes.length;
  const missao: ReactNode = testeDia ? (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1" data-testid="cn-missao">
      <span className="cn-pill cn-pill-acento">Missão · dia {testeDia} de 3</span>
      {n > 0 && (
        <button type="button" className="text-[11.5px] font-bold text-foreground underline underline-offset-2" onClick={() => abrirAlbum("missao", e.paginaDasNovas)} data-testid="cn-missao-album" aria-label={`${n} ${n === 1 ? "adesivo novo" : "adesivos novos"} pra colar — abrir o álbum`}>
          {n === 1 ? "1 adesivo novo pra colar ›" : `${n} adesivos novos pra colar ›`}
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="cn min-h-screen bg-background" data-testid="conquistas-nova">
      <Cabecalho onVoltar={voltar} />
      <main className="cn-main min-h-[calc(100vh-57px)]">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-10 space-y-3.5">
          {missao}
          <AlbumHero e={e} levantando={levantando} capa={figurinhasCapa} cor={capa.cor} emMissao={!!testeDia} primeiraColada={primeiraColada && !capaCru} onPersonalizar={()=>setEditor(capa)} onComecar={()=>irPara(testeDia ? "/home" : e.seq.acao.rota)} onAbrir={() => abrirAlbum("capa", 0)} onPacotinho={() => abrirAlbum("pacotinho", e.paginaDasNovas)} />
          {mostrarSequencia && <CartaoSequencia e={e} onDetalhe={abrirDetalhe} onAcao={irPara} />}
          <PreviaColecao e={e} onTodos={abrirTodos} onAdesivo={(b) => tocarAdesivo(b)} />
          <LinkRetrospectiva />
          {!!e.arquivados?.length && <details className="cn-memorias"><summary>Memórias da coleção · {e.arquivados.length}</summary><p>Suas conquistas de outras edições. O XP e a data continuam com você.</p><div>{e.arquivados.map(b => <figure key={b.id}><figcaption>{b.name}<small>{diaCurtoPtBR(e.desbloqueadas[b.id])}</small></figcaption></figure>)}</div></details>}
        </div>
      </main>

      <DetalheSequencia e={e} aberto={detalhe} onFechar={() => setDetalhe(false)} onAdesivo={(b) => tocarAdesivo(b)} />
      {colecao.aberta && <ColecaoTela e={e} inicial={colecao.de} onFechar={() => setColecao({ aberta: false, de: null })} onAdesivo={tocarAdesivo} />}

      <AnimatePresence>
        {figurinhaEmFoco && <FigurinhaEmFoco key={figurinhaEmFoco.id} e={e} b={figurinhaEmFoco} onUsarNaCapa={usarNaCapa} onFechar={fecharFigurinha} onPostar={(b) => { fecharFigurinha(); setPrevia(b); }} onIr={(rota) => { fecharFigurinha(); setColecao({ aberta: false, de: null }); irPara(rota); }} />}
      </AnimatePresence>

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
            rodapeFaltam
            editorial
            figurinhasCapa={figurinhasCapa}
            corCapa={capa.cor}
            onUsarNaCapa={usarNaCapa}
            maisRaros={e.paginas[0].vagas}
            abertos={e.coladas}
            total={e.total}
            porRaridade={e.porRaridadeColada}
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
          <CompartilharFigurinha key={previa.id} badge={previa} onFechar={()=>setPrevia(null)}/>
        )}
      </AnimatePresence>

      {editor && <PersonalizarCapa inicial={editor} adesivos={e.adesivos} datas={e.desbloqueadas} pendentes={pendentesIds} nome={e.nome} ano={e.ano} onSalvar={salvarCapa} onFechar={()=>setEditor(null)}/>}

      {/* só no /dev: o toast e a festa do marco como ficam (no app quem monta é MomentosConquistas) */}
      {toastDev && adesivoToast && <ToastAdesivo badge={adesivoToast} colecao={e.colecoes.find((c) => c.id === adesivoToast.category)?.label} suave={!!testeDia} onFechar={() => setToastDev(false)} onToque={() => { setToastDev(false); abrirAlbum("pacotinho", paginaDaFigurinha(e.paginas, adesivoToast.id)); }} />}
      {festaFigurinhaDev && adesivoFesta && <CelebracaoFigurinha badge={adesivoFesta} primeira={primeiraFesta} onFechar={() => setFestaFigurinhaDev(false)} onColar={() => { setFestaFigurinhaDev(false); abrirAlbum("pacotinho", paginaDaFigurinha(e.paginas, adesivoFesta.id)); }} />}
      {festaDev && adesivoMarco && <CelebracaoMarco badge={adesivoMarco} dias={7} seq={e.seq} onContinuar={() => setFestaDev(false)} onColar={() => { setFestaDev(false); abrirAlbum("pacotinho", paginaDaFigurinha(e.paginas, adesivoMarco.id)); }} onCompartilhar={() => compartilharMarco(adesivoMarco)} />}
    </div>
  );
};
