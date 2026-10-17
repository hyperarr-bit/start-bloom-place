import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, ChevronRight, Shield, Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MesDoCabecalho } from "@/components/MesDoCabecalho";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { diaDaMissao, missaoAtual, trialCartaoAtivo } from "@/lib/teste-gratis";
import { diaDaMissao as diaDaMissaoDoses, lerMissao as lerMissaoDoses } from "@/lib/missao-doses";
import { semanaDaSequencia } from "@/lib/sequencia-semana";
import { raridadeDe, type Badge } from "@/components/gamification/types";
import { AdesivoRaro } from "../adesivos-raridade";
import { Fogo } from "../Fogo";
import { varsDaFaixa } from "../CardSequencia";
import { AlbumTela } from "../AlbumTela";
import { paginaDaFigurinha } from "../album-paginas";
import { Previa } from "../SeletorDeArte";
import { StoriesAdesivo } from "../Stories";
import { compartilharAdesivo } from "../compartilhar-conquistas";
import type { Sequencia } from "../use-conquistas";
import { EVENTOS2, contagem, fraseDoPremio, marcoDoAdesivo, quandoCurto } from "./recompensas";
import { useConquistasNova, type ColecaoNova, type EstadoConquistasNova } from "./use-conquistas-nova";
import { AlbumHero } from "./AlbumHero";
import { CelebracaoMarco, ColecaoTela, DetalheSequencia, ToastAdesivo } from "./camadas";
import "../conquistas.css";
import "./conquistas-nova.css";

/**
 * CONQUISTAS 2 (16/10; atrás da chave `conquistas2`, lib/conquistas2.ts).
 * Direção B "Fogo & trilha" com o ÁLBUM como herói:
 *
 *  1. o cartão da SEQUÊNCIA na linguagem dos cards do app (faixa colorida com
 *     o título em caixa alta, superfície clara, tokens do escuro — dono 16/10:
 *     o grafite com brilho "parecia fora do app"): o número de dias no centro
 *     do ANEL DE 7 ARCOS (a semana), recorde · protetores · dias anotados, a ação do dia;
 *  2. o ÁLBUM: a capa grande e tocável, "faltam N figurinhas na página das raras",
 *     o pacotinho com as figurinhas novas pra COLAR (toque → o peel), a vaga do
 *     próximo adesivo já marcada no álbum — o álbum é o de hoje, POR RARIDADE;
 *  3. a TRILHA dos marcos (2 → 3 → 7 → 14 → 30 → 100) e "Faltam 2 dias pro adesivo de 14 dias 🔥";
 *  4. as páginas do álbum (Lendárias · Épicas · Raras · Comuns, abrem o álbum na página)
 *     e "ver todos" (a grade por módulo, secundária).
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
  <header className="border-b border-border bg-card sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
      <button type="button" onClick={onVoltar} className="hover:bg-muted rounded-md p-1 transition-colors" aria-label="Voltar">
        <ArrowLeft className="w-5 h-5" />
      </button>
      {/* o troféu de sempre (dono 17/10: o fogo no cabeçalho não) — o mesmo da TelaConquistas, claro e escuro */}
      <Trophy className="w-5 h-5 text-amber-500" aria-hidden />
      <h1 className="text-base font-bold tracking-tight">CONQUISTAS</h1>
      <div className="flex items-center gap-2 ml-auto pl-3 shrink-0">
        <MesDoCabecalho />
        <ThemeToggle />
      </div>
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
      Hoje: {semHojeNoFim(acao.texto)}
    </button>
  );
};

/**
 * O cartão da SEQUÊNCIA, COMPACTO (dono 17/10: o anel grande empurrava o álbum
 * pra fora da tela): uma linha com o fogo + o número grande + "dias seguidos"
 * à esquerda e os 7 pontos da semana (S T Q Q S S D) à direita; embaixo,
 * "Recorde 12 · 🛡 1 protetor" (dono 17/10: sem "de 2" e sem "dias anotados" —
 * o detalhe tem tudo); e a ação do dia num chip. O anel
 * de 7 arcos foi pro detalhe da sequência (camadas.tsx). A faixa do cabeçalho
 * é a dos cards do app ("🔥 SEQUÊNCIA"), sem o nome da faixa do fogo.
 */
const CartaoSequencia = ({ e, onDetalhe, onAcao }: { e: EstadoConquistasNova; onDetalhe: () => void; onAcao: (rota: string) => void }) => {
  const { seq } = e;
  const semana = useMemo(() => semanaDaSequencia(seq.lista, seq.usados, seq.hoje), [seq.lista, seq.usados, seq.hoje]);
  return (
    <section className="cn-card cn-seq" style={varsDaFaixa(seq.faixa)} aria-label="Sequência" data-testid="cn-hero" data-faixa={seq.faixa.id}>
      <button type="button" className="cn-seq-cab w-full" onClick={onDetalhe} data-testid="cn-abrir-sequencia">
        <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={18} semBrilho />
        SEQUÊNCIA
        <span className="ml-auto inline-flex items-center gap-0.5 text-[10.5px] font-bold tracking-normal normal-case opacity-90">detalhes <ChevronRight className="w-3.5 h-3.5" aria-hidden /></span>
      </button>
      <div className="px-4 pt-3 pb-3.5">
        <div className="cn-seq-linha">
          <Fogo dias={seq.dias} faixa={seq.dias > 0 ? seq.faixa : undefined} tamanho={36} viva={seq.dias > 0} />
          <span className="cn-seq-dias">
            <b className="cn-seq-num">{seq.dias}</b>
            <span className="cn-seq-rot">{seq.dias === 1 ? "dia seguido" : "dias seguidos"}</span>
          </span>
          <span className="cn-seq-semana" role="list" aria-label="Semana" data-testid="cn-seq-semana">
            {semana.map((d) => <span key={d.dia} className="cn-b-letra" data-estado={d.estado} role="listitem" aria-label={`${d.rotulo}: ${d.estado}`}><i /> {d.rotulo.charAt(0)}</span>)}
          </span>
        </div>
        <p className="cn-seq-resumo" data-testid="cn-seq-resumo" aria-label={`Recorde ${contagem(seq.recorde, "dia", "dias")} · ${seq.saldo} de 2 protetores · ${contagem(seq.lista.length, "dia anotado", "dias anotados")}`}>
          Recorde {seq.recorde} · <Shield className="inline w-3 h-3 -mt-0.5" aria-hidden /> {seq.saldo} {seq.saldo === 1 ? "protetor" : "protetores"}
        </p>
        <div className="mt-2.5"><AcaoDoDia seq={seq} onAcao={onAcao} /></div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ a trilha + amanhã você ganha */

/** "Voltei" · "3 dias" · "7 dias" … — o rótulo curto do marco na trilha (o nome inteiro, "3 Dias Seguidos", fica no aria-label). */
const rotuloDoMarco = (b: Badge, m: number) => (m === 2 ? b.name : `${m} dias`);

/**
 * A TRILHA dos marcos (2 → 3 → 7 → 14 → 30 → 100). Enxuta (dono 17/10): sem o
 * contador "3 de 6", sem "COLADO"/"30 DIAS" embaixo (a cor já diz), só o "EM 2
 * DIAS" no próximo, e embaixo só "Faltam 2 dias pro adesivo de 14 dias 🔥" — a
 * explicação ("adesivo raro + 1 protetor · vale qualquer anotação…") vai pro aria-label.
 */
const Trilha = ({ e, onAdesivo }: { e: EstadoConquistasNova; onAdesivo: (b: Badge) => void }) => {
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
        <h2 className="text-[13px] font-extrabold tracking-wide">ADESIVOS DA SEQUÊNCIA</h2>
      </div>
      <div className="cn-trilha" ref={trilhoRef}>
        {trilha.map((b) => {
          const m = marcoDoAdesivo(b.id)!;
          const proximo = m === premio.marco;
          return (
            <button key={b.id} type="button" className="cn-trilha-no" data-feito={b.unlocked ? "" : undefined} data-proximo={proximo ? "" : undefined} data-trancado={!b.unlocked ? "" : undefined} onClick={() => onAdesivo(b)} aria-label={`${b.name} (${m} dias seguidos): ${b.unlocked ? "colado" : proximo ? quandoCurto(premio).toLowerCase() : (m - seq.dias <= 1 ? "falta 1 dia" : `faltam ${m - seq.dias} dias`)}`}>
              <span className="cn-trilha-disco"><AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={proximo ? 50 : 38} trancado={!b.unlocked} /></span>
              {/* só o próximo tem o "quando"; os outros guardam o espaço (os nomes ficam alinhados) */}
              <span className="cn-trilha-quando" aria-hidden={!proximo}>{proximo ? quandoCurto(premio) : "\u00a0"}</span>
              <span className="cn-trilha-nome">{rotuloDoMarco(b, m)}</span>
            </button>
          );
        })}
      </div>
      <p className="px-4 pb-3.5 pt-3 border-t border-dashed border-border text-[15px] font-extrabold leading-tight" data-testid="cn-amanha-frase" aria-label={`${fraseDoPremio(premio)}. ${premio.adesivo && premio.daProtetor ? "E mais 1 protetor. " : ""}${premio.instrucao}`}>
        {fraseDoPremio(premio)}
      </p>
    </section>
  );
};

/* ------------------------------------------------------------------ ver todos (secundário) */

/** (dono 17/10) sem os chips das páginas na tela principal — o álbum tem as próprias abas; fica só o link discreto da grade. */
const VerTodos = ({ onTodos }: { onTodos: () => void }) => (
  <button type="button" onClick={onTodos} className="cn-ver-todos" data-testid="cn-ver-todos">
    <span>Ver todos os adesivos</span> <ChevronRight className="w-3.5 h-3.5" aria-hidden />
  </button>
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
          <CartaoSequencia e={e} onDetalhe={abrirDetalhe} onAcao={irPara} />
          <AlbumHero e={e} levantando={levantando} onAbrir={() => abrirAlbum("capa", 0)} onPacotinho={() => abrirAlbum("pacotinho", e.paginaDasNovas)} />
          <Trilha e={e} onAdesivo={(b) => tocarAdesivo(b)} />
          <VerTodos onTodos={abrirTodos} />
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
            rodapeFaltam
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
