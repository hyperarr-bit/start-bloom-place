import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Instagram } from "lucide-react";
import { toast } from "sonner";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { pedirAvaliacaoSePuder } from "@/lib/avaliacao";
import { UserDataContext } from "@/hooks/use-user-data";
import {
  conteudoDoCard, fatoDaCurta, mesAnterior, mesSeguinte, opcoesDeFoco, type ConteudoDoCard, type RetroMes,
} from "@/lib/retrospectiva";
import { compartilharCard } from "./wrapped-share";
import { ALTURA_MINIMA, Camada, LARGURA_DA_PRANCHETA, PranchetaCtx, useMedidas, type Prancheta } from "./prancheta";
import { TopoEBarras } from "./moldura";
import { FolhaDeTema } from "./FolhaDeTema";
import { CardPlanner, StoryPlanner } from "./CardPlanner";
import { CardRevista, PELE_EDICAO, StoryRevista } from "./tema-edicao";
import { CardRecortes, PELE_RECORTES, StoryRecortes } from "./tema-recortes";
import { PELE_PAGINAS } from "./tema-paginas";
import { CHAVE_DO_TEMA, ROTULO_DO_ESTILO, TEMA_PADRAO, estiloDoTema, lerTema, type EstiloDoCard, type TemaDaRetro } from "./temas";
import type { Base, PaginaPronta, Pele, PeleDoCard } from "./pele";

// (26/09) O construtor e os tipos do bloco de finanças moram em
// lib/retrospectiva (a parte pura inteira mora lá); reexportados aqui pra quem
// já importava deste arquivo — os testes da virada e da varredura.
export { buildWrappedData } from "@/lib/retrospectiva";
export type { WrappedData, EgoMoment } from "@/lib/retrospectiva";

/**
 * A RETROSPECTIVA DO MÊS — o motor (26/09, sistema de temas aprovado pelo
 * dono: o "papel pontilhado" saiu, entraram 3 peles desenhadas pelo designer).
 *
 * Este arquivo decide QUAIS páginas existem e com que dado — a lógica não
 * mudou: capa → meu mês → dinheiro → corpo → como você estava → card → foco;
 * pouco dado = capa curta, 1 fato de verdade e o fecho. O TEMA (pele.ts)
 * só desenha cada página: "Páginas de dentro" (padrão), "Edição de
 * setembro" (revista) e "Recortes" (scrapbook). A escolha fica em
 * `retro-tema` (user_data) e se troca pelo chip "Tema" da capa e da tela do
 * card, numa folha com as 3 capas em miniatura.
 *
 * Regras que ficam de todas as rodadas: sem renda não existe saldo; R$ só na
 * página de dinheiro, e só se a pessoa tocar pra ver; nada de "rombo",
 * "faltou" nem perfil negativo; o que a pessoa escreve nunca vai pro card.
 * O card final é o do planner em todos os temas (na revista e nos recortes,
 * o card do tema é a opção "Estilo do card").
 *
 * Stories: toque à direita avança, à esquerda volta, SEGURAR pausa; as
 * páginas de leitura andam sozinhas, as que pedem ação (card, foco) esperam.
 * Tudo é desenhado numa prancheta de 430 unidades (a do designer) escalada
 * pra largura do aparelho — ver prancheta.tsx.
 */

const PELES: Record<TemaDaRetro, Pele> = { paginas: PELE_PAGINAS, edicao: PELE_EDICAO, recortes: PELE_RECORTES };

/** ms até a página virar sozinha (null = espera a pessoa). */
const AUTO: Record<string, number | null> = {
  capa: 7000, "meu-mes": 9000, dinheiro: 10000, corpo: 9000, humor: 10000, fato: 8000, card: null, foco: null, fecho: null,
};
/** As páginas que contam como "chegou ao fim" no wrapped_fechou. */
const TELAS_FINAIS = new Set(["card", "fecho"]);
/** Mais que isso segurando é "pausar", não "tocar". */
const TOQUE_MAXIMO_MS = 350;

interface Medidas { w: number; h: number; topo: number; base: number }

/** Tamanho da tela e as áreas seguras (notch, barra de gestos). */
const medir = (raiz: HTMLElement | null, sonda: HTMLElement | null): Medidas => {
  const w = raiz?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 430) || 430;
  const h = raiz?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 932) || 932;
  const cs = sonda ? getComputedStyle(sonda) : null;
  return { w, h, topo: parseFloat(cs?.paddingTop || "0") || 0, base: parseFloat(cs?.paddingBottom || "0") || 0 };
};

interface Props {
  retro: RetroMes;
  onClose: () => void;
  /** nome da pessoa ("O setembro de Ana") — sem nome, "O seu setembro" */
  nome?: string | null;
  /** relógio (testes) */
  agora?: Date;
}

export const MonthlyWrapped = ({ retro, onClose, nome = null, agora: agoraFixo }: Props) => {
  const agoraDaMontagem = useRef(new Date());
  const agora = agoraFixo ?? agoraDaMontagem.current;
  const userData = useContext(UserDataContext);

  /* ------------------------------------------------------------ o tema */
  const [temaSemStore, setTemaSemStore] = useState<TemaDaRetro>(TEMA_PADRAO);
  const tema: TemaDaRetro = userData ? lerTema(userData.get<unknown>(CHAVE_DO_TEMA, null)) : temaSemStore;
  const pele = PELES[tema];
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [estilo, setEstilo] = useState<EstiloDoCard>("planner");
  const estiloDoTemaAtual = estiloDoTema(tema);
  const card: EstiloDoCard = estilo !== "planner" && estilo === estiloDoTemaAtual ? estilo : "planner";

  const [idx, setIdx] = useState(0);
  const [segurando, setSegurando] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [paradoEm, setParadoEm] = useState<number | null>(null);
  const [revelado, setRevelado] = useState(false);
  const [valores, setValores] = useState(false);
  const [enviando, setEnviando] = useState<null | "salvar" | "stories">(null);
  // a 1ª opção de foco já vem marcada (como no desenho): um toque em "Guardar foco"
  const [escolha, setEscolha] = useState<string | null>(() => opcoesDeFoco(retro)[0]?.texto ?? null);
  const [textoDoFoco, setTextoDoFoco] = useState("");
  const [focoSalvo, setFocoSalvo] = useState<string | null>(null);

  /* MOMENTO DE VALOR (28/08): a retrospectiva é a função citada nominalmente
   * na avaliação 5★ do Rafael C. ("parece aqueles resumos de fim de ano, só
   * que da minha própria vida"). 12s = a pessoa passou das primeiras páginas
   * e está DENTRO da emoção — `forte` porque esse pico só existe 1× por mês.
   * Travas em pedirAvaliacaoSePuder. */
  useEffect(() => {
    const t = window.setTimeout(() => { void pedirAvaliacaoSePuder("retrospectiva", { forte: true }); }, 12000);
    return () => window.clearTimeout(t);
  }, []);

  // app em segundo plano: a página não vira sozinha enquanto ninguém olha
  useEffect(() => {
    const aoMudar = () => setOculto(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, []);

  /* ------------------------------------------------------- a prancheta */
  const raizRef = useRef<HTMLDivElement>(null);
  const sondaRef = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState<Medidas>(() => medir(null, null));
  useLayoutEffect(() => {
    const atualizar = () => setMedidas(medir(raizRef.current, sondaRef.current));
    atualizar();
    window.addEventListener("resize", atualizar);
    return () => window.removeEventListener("resize", atualizar);
  }, []);
  const util = Math.max(200, medidas.h - medidas.topo - medidas.base);
  const s = Math.max(0.3, Math.min(medidas.w / LARGURA_DA_PRANCHETA, util / ALTURA_MINIMA, 1.25));
  const prancheta: Prancheta = { s, H: util / s, cheia: medidas.h / s, miniatura: false };
  const x0 = (medidas.w - LARGURA_DA_PRANCHETA * s) / 2;

  /* --------------------------------------------------------- as páginas */
  const proximo = mesSeguinte(retro);
  // o foco só faz sentido pro mês que está começando (retrospectiva do mês que acabou de fechar)
  const recemFechado = (() => { const a = mesAnterior(agora); return a.ano === retro.ano && a.mesIdx === retro.mesIdx; })();
  const podeFocar = !!userData && recemFechado;
  const fato = useMemo(() => (retro.curta ? fatoDaCurta(retro) : null), [retro]);
  const opcoes = useMemo(() => opcoesDeFoco(retro), [retro]);

  const ids = useMemo(() => {
    const f = retro.financas;
    const t: string[] = ["capa"];
    if (retro.curta) {
      if (fato) t.push("fato");
      t.push("fecho");
    } else {
      if (retro.meuMes) t.push("meu-mes");
      if (f && (f.gastosAnotados > 0 || f.topCategories.length > 0)) t.push("dinheiro");
      if (retro.corpo) t.push("corpo");
      if (retro.sentir) t.push("humor");
      t.push("card");
    }
    if (podeFocar) t.push("foco");
    return t;
  }, [retro, fato, podeFocar]);

  // os dados podem mudar com a retrospectiva aberta (a carga do servidor
  // chegando): o índice nunca aponta pra fora da lista
  const atual = Math.min(idx, ids.length - 1);
  const atualRef = useRef(0);
  atualRef.current = atual;
  const idDaTela = ids[atual];
  // (26/09, desenho do designer) a versão curta tem 3 páginas na barra: o foco
  // é um extra que abre pelo link do fecho, e tocar depois do fecho fecha
  const nasBarras = retro.curta ? ids.filter((id) => id !== "foco") : ids;
  const atualNaBarra = Math.min(atual, nasBarras.length - 1);
  const pararAqui = () => setParadoEm(atualRef.current);

  /* ------------------------------------------------------------ eventos */
  const aberturaRef = useRef(Date.now());
  const vistasRef = useRef(new Set<string>());
  const telaRef = useRef(idDaTela);
  const mesRef = useRef(retro.mes);
  mesRef.current = retro.mes;
  useEffect(() => {
    telaRef.current = idDaTela;
    vistasRef.current.add(idDaTela);
    trackEvent("wrapped_tela", { month: mesRef.current, i: atual, id: idDaTela, curta: retro.curta });
    // só quando a PÁGINA muda — não a cada recálculo dos dados
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, idDaTela]);
  useEffect(() => {
    let enviado = false;
    // beacon: quem sai costuma estar fechando o app, e o insert normal morre junto
    const despedir = () => {
      if (enviado) return;
      enviado = true;
      trackEventBeacon("wrapped_fechou", {
        month: mesRef.current,
        tela: telaRef.current,
        segundos: Math.round((Date.now() - aberturaRef.current) / 1000),
        completou: [...vistasRef.current].some((x) => TELAS_FINAIS.has(x)),
      });
    };
    window.addEventListener("pagehide", despedir);
    return () => {
      window.removeEventListener("pagehide", despedir);
      despedir();
    };
  }, []);

  const trocarTema = (novo: TemaDaRetro) => {
    setFolhaAberta(false);
    if (novo === tema) return;
    if (userData) userData.set(CHAVE_DO_TEMA, novo);
    else setTemaSemStore(novo);
    setEstilo("planner");
    trackEvent("wrapped_tema", { month: retro.mes, tema: novo, de: tema });
  };

  const compartilhar = async (destino: "salvar" | "stories") => {
    if (enviando) return;
    setEnviando(destino);
    pararAqui();
    trackEvent("wrapped_share", { month: retro.mes, valores, destino, tema, card });
    const c = conteudoDoCard(retro, { valores, nome });
    const arte = card === "revista" ? <StoryRevista c={c} /> : card === "recortes" ? <StoryRecortes c={c} /> : <StoryPlanner c={c} />;
    const resultado = await compartilharCard(arte, retro.mes, destino);
    if (resultado === "downloaded") toast.success("Imagem salva! Agora é só postar 🎉");
    if (resultado === "sem-imagem") toast.error("Não consegui montar a imagem agora. Tenta de novo em instantes?");
    // no app sem o compartilhar nativo (versão antiga) não dá pra salvar: diz a verdade
    if (resultado === "failed") toast.error("Não consegui abrir o compartilhar. Atualize o CORE na loja e tente de novo.");
    setEnviando(null);
  };

  const salvarFoco = () => {
    const texto = (textoDoFoco.trim() || escolha || "").trim();
    if (!texto || !userData) return;
    const metas = userData.get<Record<string, { id: string; text: string; done: boolean }[]>>("month-goals", {}) ?? {};
    const doMes = Array.isArray(metas[proximo.id]) ? metas[proximo.id] : [];
    if (!doMes.some((g) => g?.text?.trim().toLowerCase() === texto.toLowerCase())) {
      userData.set("month-goals", { ...metas, [proximo.id]: [...doMes, { id: Date.now().toString(), text: texto, done: false }] });
    }
    trackEvent("wrapped_foco", { month: retro.mes, sugestao: !textoDoFoco.trim() });
    setFocoSalvo(texto);
  };

  /* -------------------------------------------------- navegação (stories) */
  const avancar = useCallback((dir: 1 | -1) => {
    const proxima = atual + dir;
    if (proxima < 0) return;
    if (proxima >= ids.length || (retro.curta && ids[proxima] === "foco")) { onClose(); return; }
    setParadoEm(null);
    setIdx(proxima);
  }, [atual, ids, retro.curta, onClose]);
  const irPara = (id: string) => {
    const i = ids.indexOf(id);
    if (i >= 0) { setParadoEm(null); setIdx(i); }
  };

  // teclado (web no PC): setas viram a página, Esc fecha
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      if (folhaAberta) { if (e.key === "Escape") setFolhaAberta(false); return; }
      if (e.key === "ArrowRight") avancar(1);
      else if (e.key === "ArrowLeft") avancar(-1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [avancar, onClose, folhaAberta]);

  // SEGURAR PAUSA: o dedo pousado para a página; soltar depois de um toque
  // longo só retoma (não vira a página).
  const pousouEm = useRef(0);
  const toqueLongo = useRef(false);
  const pousar = () => { pousouEm.current = Date.now(); setSegurando(true); };
  const soltar = () => {
    if (pousouEm.current && Date.now() - pousouEm.current > TOQUE_MAXIMO_MS) toqueLongo.current = true;
    pousouEm.current = 0;
    setSegurando(false);
  };
  const tocar = (dir: 1 | -1) => {
    if (toqueLongo.current) { toqueLongo.current = false; return; }
    avancar(dir);
  };
  const zona = (dir: 1 | -1) => ({
    onPointerDown: pousar,
    onPointerUp: soltar,
    onPointerCancel: soltar,
    onPointerLeave: () => { if (pousouEm.current) soltar(); },
    onClick: () => tocar(dir),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const pausado = segurando || oculto || folhaAberta || paradoEm === atual;

  /* -------------------------------------------------- a página da vez */
  const base: Base = { retro, nome, paginas: ids, proximo: { nome: proximo.nome, ano: proximo.ano }, recente: recemFechado };
  const conteudo = useMemo(() => conteudoDoCard(retro, { valores, nome }), [retro, valores, nome]);
  const montar = (id: string): PaginaPronta => {
    switch (id) {
      case "capa": return retro.curta ? pele.capaCurta(base) : pele.capa(base);
      case "meu-mes": return pele.meuMes(base);
      case "dinheiro":
        return pele.dinheiro({
          ...base, revelado,
          onRevelar: () => {
            pararAqui();
            if (!revelado) trackEvent("wrapped_valores", { month: retro.mes });
            setRevelado((x) => !x);
          },
        });
      case "corpo": return pele.corpo(base);
      case "humor": return pele.humor(base);
      case "fato": return pele.fato({ ...base, fato: fato! });
      case "fecho": return pele.fecho({ ...base, podeFocar, onFocar: () => irPara("foco"), onFechar: onClose });
      case "foco":
        return pele.foco({
          ...base, opcoes, escolha, texto: textoDoFoco, salvo: focoSalvo, onFechar: onClose, onSalvar: salvarFoco,
          onEscolha: (t) => { pararAqui(); setTextoDoFoco(""); setEscolha(t || null); },
          onTexto: (t) => { pararAqui(); setTextoDoFoco(t); },
        });
      default: {
        const p = pele.card;
        return {
          fundoCor: p.fundoCor,
          fundo: p.fundo,
          moldura: p.moldura,
          conteudo: (
            <TelaDoCard
              pele={p}
              c={conteudo}
              card={card}
              estilos={estiloDoTemaAtual ? ["planner", estiloDoTemaAtual] : null}
              onEstilo={(e) => { pararAqui(); setEstilo(e); }}
              temDinheiro={!!retro.financas}
              valores={valores}
              onValores={() => { pararAqui(); setValores((x) => !x); }}
              enviando={enviando}
              onCompartilhar={compartilhar}
              proximo={podeFocar ? proximo.nome.toLowerCase() : null}
            />
          ),
        };
      }
    }
  };
  const pagina = montar(idDaTela);

  return (
    <div
      ref={raizRef}
      className="fixed inset-0 z-[400] select-none overflow-hidden"
      style={{ background: pagina.fundoCor, transition: "background-color .25s", WebkitTouchCallout: "none", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", WebkitFontSmoothing: "antialiased" } as CSSProperties}
      data-testid="retrospectiva"
      data-tema={tema}
    >
      <style>{"@keyframes retro-barra{from{width:0}to{width:100%}}"}</style>
      {/* sonda das áreas seguras (notch em cima, barra de gestos embaixo) */}
      <div ref={sondaRef} aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", visibility: "hidden", pointerEvents: "none" }} />

      <PranchetaCtx.Provider value={prancheta}>
        {/* zonas de toque: esquerda volta, direita avança, segurar pausa */}
        <div className="absolute inset-y-0 left-0 w-1/3 z-[5]" {...zona(-1)} />
        <div className="absolute inset-y-0 right-0 w-2/3 z-[5]" {...zona(1)} />

        {/* a página — fundo sangrado + conteúdo na área segura; só botões/campos
            capturam o toque, o resto passa pra virar a página */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${atual}-${tema}`}
            data-tela={idDaTela}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-10 pointer-events-none [&_button]:pointer-events-auto [&_input]:pointer-events-auto"
          >
            {pagina.fundo && (
              <Camada x={x0} y={0} altura={prancheta.cheia} escala={s} style={{ overflow: "hidden" }}>{pagina.fundo}</Camada>
            )}
            <Camada x={x0} y={medidas.topo} altura={prancheta.H} escala={s}>{pagina.conteudo}</Camada>
          </motion.div>
        </AnimatePresence>

        {/* moldura: barras + "CORE · RETROSPECTIVA" + chip Tema (capa e card) + X */}
        <Camada x={x0} y={medidas.topo} altura={60} escala={s} style={{ zIndex: 30, pointerEvents: "none" }}>
          <TopoEBarras
            moldura={pagina.moldura}
            total={nasBarras.length}
            atual={atualNaBarra}
            animada={{ auto: AUTO[idDaTela] ?? null, pausado, onFim: () => avancar(1) }}
            // o chip mora na capa (desenho do designer) e na tela do card (regra do dono)
            chip={idDaTela === "capa" || idDaTela === "card"}
            onChip={() => { pararAqui(); setFolhaAberta(true); }}
            onFechar={onClose}
          />
        </Camada>

        {folhaAberta && (
          <div className="absolute inset-0 z-40" style={{ background: "rgba(0,0,0,.55)" }} onClick={() => setFolhaAberta(false)}>
            <div
              style={{ position: "absolute", left: x0, bottom: 0, width: LARGURA_DA_PRANCHETA, transform: `scale(${s})`, transformOrigin: "0 100%" }}
              onClick={(e) => e.stopPropagation()}
            >
              <FolhaDeTema
                tema={tema}
                peles={PELES}
                base={base}
                curta={retro.curta}
                total={nasBarras.length}
                folha={pele.folha}
                folgaBaixo={medidas.base / s}
                onEscolher={trocarTema}
                onFechar={() => setFolhaAberta(false)}
              />
            </div>
          </div>
        )}
      </PranchetaCtx.Provider>
    </div>
  );
};

/* ---------------------------------------------------------- tela do card */

const SOMBRA_DO_CARD: Record<EstiloDoCard, { sombra?: string; raio: number }> = {
  planner: { raio: 0 },
  revista: { sombra: "0 30px 60px -28px rgba(0,0,0,.9)", raio: 6 },
  recortes: { sombra: "0 26px 50px -24px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.06)", raio: 6 },
};

function TelaDoCard({ pele, c, card, estilos, onEstilo, temDinheiro, valores, onValores, enviando, onCompartilhar, proximo }: {
  pele: PeleDoCard;
  c: ConteudoDoCard;
  card: EstiloDoCard;
  /** o segmentado "Estilo do card" (revista e recortes); null no planner */
  estilos: EstiloDoCard[] | null;
  onEstilo: (e: EstiloDoCard) => void;
  temDinheiro: boolean;
  valores: boolean;
  onValores: () => void;
  enviando: null | "salvar" | "stories";
  onCompartilhar: (destino: "salvar" | "stories") => void;
  proximo: string | null;
}) {
  const { m, fs, H } = useMedidas();
  // medidas do mockup (430×932): o card em 70, os controles logo abaixo dele;
  // com o segmentado, o card vai a 0,952 (como o designer desenhou)
  const topo = m(70, 58);
  const controles = (estilos ? 52 : 0) + (temDinheiro ? 62 : 0) + 48 + (proximo ? 34 : 0);
  const folgaBaixo = estilos ? m(50, 16) : m(70, 18);
  const k = Math.max(0.5, Math.min(estilos ? 0.952 : 1, (H - topo - 16 - controles - folgaBaixo) / 630));
  const largura = 354 * k;
  let y = topo + 630 * k + 16;
  const linha = (altura: number, gap: number) => { const topoDaLinha = y; y += altura + gap; return topoDaLinha; };
  const yEstilo = estilos ? linha(40, 12) : 0;
  const yToggle = temDinheiro ? linha(48, 14) : 0;
  const yBotoes = linha(48, 18);
  const yProxima = y;
  const sombra = SOMBRA_DO_CARD[card];
  const arte: ReactNode = card === "revista"
    ? <CardRevista c={c} testId="card-da-retro" />
    : card === "recortes" ? <CardRecortes c={c} testId="card-da-retro" /> : <CardPlanner c={c} testId="card-da-retro" />;
  const lados: CSSProperties = { position: "absolute", left: 38, right: 38 };
  return (
    <>
      {/* a arte segura o toque: tocar no card não pode virar a página nem fechar */}
      <div
        style={{ position: "absolute", left: (430 - largura) / 2, top: topo, width: largura, height: 630 * k, pointerEvents: "auto", borderRadius: sombra.raio * k, boxShadow: sombra.sombra }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 354, height: 630, transform: `scale(${k})`, transformOrigin: "0 0" }}>{arte}</div>
      </div>
      {estilos && (
        <div style={{ ...lados, top: yEstilo, height: 40, display: "flex", alignItems: "center", color: pele.seg.fg }}>
          <span style={{ fontSize: fs(10.5), fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", opacity: 0.7 }}>Estilo do card</span>
          <span role="radiogroup" aria-label="Estilo do card" style={{ marginLeft: "auto", display: "flex", padding: 3, borderRadius: 10, background: pele.seg.bg }}>
            {estilos.map((e) => {
              const on = e === card;
              return (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={(ev) => { ev.stopPropagation(); onEstilo(e); }}
                  className="p-0"
                  style={{ padding: "6px 14px", borderRadius: 8, fontWeight: 700, fontSize: fs(12.5), border: 0, cursor: "pointer", fontFamily: "inherit", background: on ? pele.seg.onBg : "transparent", color: on ? pele.seg.onFg : pele.seg.fg, opacity: on ? 1 : 0.75 }}
                >
                  {ROTULO_DO_ESTILO[e]}
                </button>
              );
            })}
          </span>
        </div>
      )}
      {temDinheiro && (
        <button
          type="button"
          role="switch"
          aria-checked={valores}
          onClick={(e) => { e.stopPropagation(); onValores(); }}
          style={{ ...lados, top: yToggle, height: 48, display: "flex", alignItems: "center", padding: "0 16px", borderRadius: 12, fontSize: fs(13.5), fontWeight: 600, background: pele.linha.bg, color: pele.linha.fg, boxShadow: pele.linha.sombra, border: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
        >
          Mostrar valores em R$
          <span aria-hidden style={{ marginLeft: "auto", width: 44, height: 24, borderRadius: 999, position: "relative", background: valores ? "#10b981" : pele.linha.trilhoOff, transition: "background .2s" }}>
            <i style={{ position: "absolute", left: 2, top: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transform: valores ? "translateX(20px)" : undefined, transition: "transform .2s" }} />
          </span>
        </button>
      )}
      <div style={{ ...lados, top: yBotoes, display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 10 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCompartilhar("salvar"); }}
          disabled={!!enviando}
          style={{ height: 48, borderRadius: 12, fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: pele.salvar.bg, color: pele.salvar.fg, border: pele.salvar.borda, cursor: "pointer", fontFamily: "inherit" }}
        >
          {enviando === "salvar" && <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />}
          Salvar
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCompartilhar("stories"); }}
          disabled={!!enviando}
          style={{ height: 48, borderRadius: 12, fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: pele.postar.bg, color: pele.postar.fg, border: 0, cursor: "pointer", fontFamily: "inherit" }}
        >
          {enviando === "stories" ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <Instagram style={{ width: 18, height: 18 }} />}
          Postar nos Stories
        </button>
      </div>
      {proximo && (
        <p style={{ position: "absolute", left: 0, right: 0, top: yProxima, margin: 0, textAlign: "center", fontSize: fs(12.5), color: pele.proxima }}>Próxima: escolha 1 foco pra {proximo} →</p>
      )}
    </>
  );
}
