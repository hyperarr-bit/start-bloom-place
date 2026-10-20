import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { entrada, MOV, MOV_MS, saida, saidaCalmaDe, saidaCalmaDaTela } from "@/lib/movimento";
import { marcarIntroVista } from "@/lib/intro-modulo";
import { useAuth, useAuthOpcional } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { areaEscolhidaNoFunil } from "@/components/missao/MissaoDoTrial";
import { isNativeShell } from "@/lib/native-shell";
import { missaoWebConvidada } from "@/lib/missao-web";
import { EVENTO_DIA2, LEMBRETE_DO_PLANO, combinarHora } from "@/lib/lembrete-dia2";
import { agendarProximaDose, pedirPermissaoDia2 } from "@/lib/notificacoes";
import { bracoDia1, guardarForcaDia1Cheio, modoUmPorDia, type PlanoAmanha } from "@/lib/dia1-cheio";
import { pedirAvaliacaoPorMissao, type MotivoDaMissao } from "@/lib/avaliacao";
import { EVENTO_TOUR_HOME_FIM, deveMostrarTourHome, tourFeito, tourHomeLigado, tourSemMaisAberturas } from "@/lib/tour-home";
import {
  CHAVE_MISSAO_NA_CONTA, EVENTO_MISSAO_COMPLETA, EVENTO_MISSAO_DOSES, MISSAO_DOSES_APP, MODULOS, TOTAL_PASSOS_B, apagarMissao, aprofundarPendente, contaNova, conviteDoDiaDevido, diaDaMissao, dicaDoDiaDevida, donoDaConta, doseAbreHoje, dosesFeitas, ehBracoB, ehUmPorDia, eventoDaMissao, gravarMissao, guardarForcaDaUrl, iniciarMissao, lerMissao,
  definirDonoDaMissao, marcarComecar, missaoDaConta, semValor, missaoValida, precisaPlanoA, retomadaDoGasto,
  missaoCumprida, missaoDosesLigada, missaoDosesMandaNoApp, modulosPadrao, passoHomePendente, passoPendente, precisaPlanoAmanha, type DiaDaMissao, type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao,
} from "@/lib/missao-doses";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { BoasVindasDoses } from "./BoasVindasDoses";
import { LerScoreDoDia, PassoDoDia, type ViaDoPulo } from "./PassoDoDia";
import { CONHECER_MAIS } from "./encaixes";
import { EVENTO_FIM_TOUR, type FimDoTour } from "@/lib/conhecer-mais";
import { ConstruiuEm3Dias } from "./ConstruiuEm3Dias";
import { PlanoDeAmanha } from "./PlanoDeAmanha";
import { ConviteDoDia } from "./ConviteDoDia";
import { PlanoDeAmanhaA } from "./PlanoDeAmanhaA";
import { DicaDoDia } from "./DicaDoDia";
import { missaoAtual } from "@/lib/teste-gratis";
import "./missao-doses.css";

/**
 * A ORQUESTRA DA MISSÃO EM DOSES (02/10, web · 03/10, app) — montada no App ao
 * lado da MissaoDoTrial. Na web, com a chave desligada (e sem a força de QA)
 * devolve null antes de qualquer hook de dado: o site de hoje, byte a byte.
 *
 * NO APP DAS LOJAS (1.0.10): `MISSAO_DOSES_APP = "on"`. A orquestra monta pra
 * todo mundo, mas a missão só NASCE pra quem é novo (missaoDosesMandaNoApp:
 * conta < 48 h, sem Missão antiga em andamento) — pro cliente antigo é null,
 * nenhum evento, nada gravado. A hora combinada na comemoração vira a hora do
 * Lembrete do dia 2 (combinarHora) e é ali que a permissão de notificação é
 * pedida, uma vez (pedirPermissaoDia2) — "Te lembro às 20h" É a pré-folha.
 *
 * O que ela decide, pela rota:
 *   · /home sem boas-vindas vistas → D1 (+ D2 pela troca);
 *   · no módulo do passo pendente (e não pulado hoje) → o passo do dia;
 *   · missão cumprida e final não visto → "O que você construiu".
 *
 * 10/10 — DIA 1 CHEIO (chave DIA1_CHEIO, lib/dia1-cheio). Braço B, a missão do dia 1
 * tem 4 PASSOS: dose 1 → dose 2 → dose 3 (cada uma "Bora a próxima? 20 s" / "Agora
 * não" → notificação de +3 h) → "Arrumar sua Home" (o tour da Home, 5 toques, com
 * a faixa "Missão · 4 de 4" por cima) → a festa "Casa arrumada" fecha a missão
 * (`missao_completa`) → e SÓ ENTÃO a folha do plano de amanhã ("O CORE te avisa do
 * que importa… que horas te lembro amanhã?"), a última coisa do dia 1 — também
 * depois de um "Agora não" no meio das doses, ainda no contexto da missão. Dias 2
 * e 3 = "aprofundar"; "O que você construiu" só a partir do dia 3. Braço A = a
 * missão da 1.0.10 (só `variante: "A"` nos eventos). Quem pulou ("Explorar por
 * conta própria") vê só o tour, direto.
 */
/** 1,5 s depois da comemoração — a festa já está na tela, a caixinha vem por cima. */
export const ESPERA_AVALIACAO_MS = 1500;
const pedirNotaDepois = (motivo: MotivoDaMissao): void => {
  window.setTimeout(() => {
    try { void pedirAvaliacaoPorMissao(motivo).catch(() => false); } catch { /* a avaliação nunca derruba a missão */ }
  }, ESPERA_AVALIACAO_MS);
};
/**
 * 1.0.16 (4.8): define o DONO da missão pra sessão ANTES das rotas renderizarem (App monta isto antes do
 * <Routes>) — assim a Home, o tour e os Momentos já leem a missão filtrada pela conta logada no 1º render.
 */
export function DonoDaMissaoNaSessao() {
  const auth = useAuthOpcional();
  definirDonoDaMissao(auth?.user?.id);
  return null;
}

export function MissaoDosesNaWeb() {
  const { search } = useLocation();
  // a força de QA pelo link, em qualquer rota (o link do dono pode cair em qualquer página)
  guardarForcaDaUrl(search);
  guardarForcaDia1Cheio(search);
  const ligada = missaoDosesLigada();
  return ligada ? <><Ligada /><VeuDaMissao /></> : null;
}

/* ── 1.0.17 — A PASSAGEM CALMA ENTRE TELAS (dono 19/10: "o corte entre Finanças e a Home é brusco — deixa agradável e
   lento"). A comemoração já saiu descendo; aqui um véu da cor do app cobre a tela (280 ms), a rota troca por baixo,
   e o véu abre devagar (420 ms) — a Home "assenta" sem ninguém ver o corte. O que vem depois (a folha do plano de
   amanhã, a dica) já espera a tela ficar quieta por ≥ 1,2 s (o respiro). Com "reduzir movimento": fade de 150 ms. ── */
const EVENTO_VEU = "missao-doses:veu";
type PedidoDoVeu = { fase: "cobre" | "abre"; pronto?: () => void };
const pedirVeu = (p: PedidoDoVeu) => { try { window.dispatchEvent(new CustomEvent<PedidoDoVeu>(EVENTO_VEU, { detail: p })); } catch { p.pronto?.(); } };
/** Cobre a tela, troca (`trocar`) e abre de novo. Fail-open: sem o véu montado, a troca acontece em ≤ 600 ms. */
export function trocarComCalma(trocar: () => void): void {
  // 1.0.17 QA (dono: "nenhum corte seco"): no aparelho, cross-fade direto da tela de agora pra próxima — sem passar pelo
  // branco do véu. O véu fica pra "reduzir movimento" (e pros testes, onde a foto não existe).
  if (saidaCalmaDaTela(MOV_MS.calmo, 260)) { trocar(); return; }
  let feito = false;
  const seguir = () => {
    if (feito) return;
    feito = true;
    try { trocar(); } finally { window.setTimeout(() => pedirVeu({ fase: "abre" }), 40); }
  };
  pedirVeu({ fase: "cobre", pronto: seguir });
  window.setTimeout(seguir, MOV_MS.base + 320);
}
function VeuDaMissao() {
  const reduzir = !!useReducedMotion();
  const [fase, setFase] = useState<"cobre" | "abre" | null>(null);
  const pronto = useRef<(() => void) | null>(null);
  useEffect(() => {
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent<PedidoDoVeu>).detail;
      if (!d) return;
      if (d.fase === "cobre") { pronto.current = d.pronto ?? null; setFase("cobre"); return; }
      setFase((f) => (f ? "abre" : null));
    };
    window.addEventListener(EVENTO_VEU, ouvir);
    return () => window.removeEventListener(EVENTO_VEU, ouvir);
  }, []);
  useEffect(() => {
    if (fase === "cobre") {
      const t = window.setTimeout(() => { const p = pronto.current; pronto.current = null; p?.(); }, reduzir ? MOV_MS.rapido : MOV_MS.base);
      return () => window.clearTimeout(t);
    }
    if (fase === "abre") {
      const t = window.setTimeout(() => setFase(null), reduzir ? MOV_MS.rapido : MOV_MS.calmo);
      return () => window.clearTimeout(t);
    }
  }, [fase, reduzir]);
  if (!fase) return null;
  return (
    <motion.div className="fixed inset-0 z-[250] bg-background pointer-events-none" aria-hidden data-testid="missao-doses-veu" data-fase={fase} data-camada-guia="missao-doses-veu"
      initial={{ opacity: 0 }} animate={{ opacity: fase === "cobre" ? 1 : 0 }}
      transition={fase === "cobre" ? saida(reduzir, MOV.base) : entrada(reduzir, MOV.calmo)} />
  );
}

/**
 * A ÁREA DA MISSÃO (16/10, 1.0.16): a do funil do app (`core-funil-w-area`, que agora sobrevive ao
 * "liberando" — retomada.ts) → senão a da Porta do site, que viaja na conta (`user_metadata.porta.
 * respostas.area`; o localStorage do site não chega ao app) → senão null (= Finanças primeiro).
 */
export function areaDaMissao(userMetadata?: unknown): string | null {
  const local = areaEscolhidaNoFunil();
  if (local && local in AREAS) return local;
  try {
    const a = (userMetadata as { porta?: { respostas?: { area?: unknown } | null } | null } | null | undefined)?.porta?.respostas?.area;
    if (typeof a === "string" && a in AREAS) return a;
  } catch { /* metadata estranha */ }
  return local ?? null;
}

/**
 * 1.0.17 — o nome do "Tá dentro, Lucas.": o da conta (`core-user-name`, ou o `user-name` que o cadastro grava), senão o
 * dos metadados (full_name/name). Nunca o começo do e-mail. Vazio = "Tá dentro."
 */
export function nomeDaPessoa(daConta: unknown, userMetadata?: unknown): string {
  const ok = (v: unknown): string => (typeof v === "string" && v.trim() && !v.includes("@") ? v.trim() : "");
  const meta = (userMetadata ?? {}) as { full_name?: unknown; name?: unknown };
  return ok(daConta) || ok(meta.full_name) || ok(meta.name);
}

/** O CustomEvent da janela quando a missão fica completa (o tour da Home escuta). Mora em lib/missao-doses. */
export { EVENTO_MISSAO_COMPLETA };

/** Outra festa/folha na tela (adesivo dos Momentos, diálogo)? A folha do plano espera ela sair. */
const FESTA_NA_TELA = '[data-momento], [role="dialog"]:not([data-testid="plano-amanha"]), [role="alertdialog"], [data-camada-guia="tour-home"]';
const festaNaTela = (): boolean => { try { return !!document.querySelector(FESTA_NA_TELA); } catch { return false; } };

/** A faixa do 4º passo (B): "Missão · 4 de 4 · arrumar sua Home", por cima do tour da Home. */
function FaixaDoPasso4() {
  useEffect(() => {
    document.documentElement.setAttribute("data-missao-doses-faixa", "1");
    return () => { document.documentElement.removeAttribute("data-missao-doses-faixa"); };
  }, []);
  return (
    <div className="md-faixa" data-testid="missao-doses-faixa" data-fase="home" role="presentation">
      <span className="md-faixa-quadros" aria-label={`3 de ${TOTAL_PASSOS_B} feitos`} role="img">
        {Array.from({ length: TOTAL_PASSOS_B }, (_, i) => <Quadradinho key={i} marcado={i < 3} claro tam={14} />)}
      </span>
      <span className="md-faixa-titulo">Missão · {TOTAL_PASSOS_B} de {TOTAL_PASSOS_B} · <b>arrumar sua Home</b></span>
    </div>
  );
}

function Ligada() {
  const { user, isSubscribed } = useAuth();
  // 1.0.16 (4.8): a missão de OUTRA conta deste aparelho some pra todo mundo que lê (lerMissao filtra pelo dono)
  definirDonoDaMissao(user?.id);
  /* 10/10 (build 38, achado na prova da Porta no Simulador): no APP, conta nova SEM assinatura (entrou pelo
   * "Entrar" ou pelo link da Porta, antes de pagar) caía no gate do paywall com o "Tá dentro! Seus 3 dias
   * grátis começaram agora" piscando por cima — e a missão nascia antes do teste existir. A missão é do
   * teste/assinatura: no app ela só nasce e só aparece com acesso (isSubscribed; antes da 1ª resposta do
   * check-subscription é false, então nada pisca). A web segue como estava. */
  const semAcessoNoApp = isNativeShell() && !isSubscribed;
  const { loaded, get, set: gravarNaConta } = useUserData();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hoje = localDayKey();
  const [missaoBruta, setMissao] = useState<EstadoMissaoDoses | null>(() => lerMissao());
  // 1.0.16 (4.8): a missão do aparelho só vale pra conta DONA dela — outra conta no mesmo celular não herda
  const missao = missaoBruta && missaoDaConta(missaoBruta, user?.id) ? missaoBruta : null;
  const [verFim, setVerFim] = useState(false);
  const [passoAberto, setPassoAberto] = useState(0);
  /**
   * O passo EM CURSO fica montado até a comemoração ser dispensada (ou a pessoa
   * sair do módulo): no instante em que o dia é gravado, o "pendente" já é o
   * próximo módulo — sem isto a comemoração desmontava junto.
   */
  const [emCurso, setEmCurso] = useState<{ n: DiaDaMissao; modulo: ModuloDaMissao; chave: number; modo?: "aprofundar"; retomar?: boolean } | null>(null);
  useEffect(() => {
    if (emCurso && !pathname.startsWith(MODULOS[emCurso.modulo].rota)) setEmCurso(null);
  }, [pathname, emCurso]);
  const pendenteAgora = missao ? passoPendente(missao) : null;
  const aprofundar = missao && missao.boasVindas ? aprofundarPendente(missao, pathname, hoje) : null;
  type Passo = { n: DiaDaMissao; modulo: ModuloDaMissao; chave: number; modo?: "aprofundar"; retomar?: boolean };
  /* 1.0.16 (dono, 17/10): fechou o app DEPOIS do Montar e antes do 1º gasto → a dose volta no passo do gasto (chips
     prontos, nunca o Montar). Na 1ª abertura do app ela é levada pra Finanças; depois, entrar em Finanças retoma. */
  const retomada = missao?.boasVindas ? retomadaDoGasto(missao, hoje) : null;
  const levouPraRetomar = useRef(false);
  useEffect(() => {
    if (!retomada || !loaded || emCurso || levouPraRetomar.current) return;
    levouPraRetomar.current = true; // uma vez por abertura do app (sair de Finanças no meio não puxa de volta)
    // só de quem abriu o app na Home: um link/aviso que abriu outra tela manda (a retomada fica pra quando ela entrar
    // em Finanças)
    if (pathname === "/home" || pathname === "/") navigate(MODULOS.financas.rota);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!retomada, loaded]);
  // 1.0.16 (braço A, uma dose por dia): a dose de amanhã NÃO abre hoje, nem entrando no módulo dela (nem depois do 7º dia)
  const candidato: Passo | null = retomada && pathname.startsWith(MODULOS.financas.rota)
    ? { n: retomada.n, modulo: "financas", chave: passoAberto, retomar: true }
    /* 1.0.16 (regra do dono, 17/10: "quiz só se a pessoa escolher primeiro"): quem tocou "Explorar por conta própria"
       abre os módulos por CURIOSIDADE — nada de dose (nem o Montar) ao entrar neles; a introdução do módulo cuida da
       1ª visita. Sem braço (a missão da 1.0.10/1.0.15 que já estava rodando), como sempre foi. */
    : missao?.boasVindas && pendenteAgora && pathname.startsWith(MODULOS[pendenteAgora.modulo].rota) && missao.pulados?.[pendenteAgora.n] !== hoje && doseAbreHoje(missao, hoje) && !(missao.braco && missao.explorou)
    ? { n: pendenteAgora.n, modulo: pendenteAgora.modulo, chave: passoAberto }
    : aprofundar ? { n: aprofundar.n, modulo: aprofundar.modulo, chave: passoAberto, modo: "aprofundar" }
    : null;
  useEffect(() => {
    if (emCurso || !candidato) return;
    setEmCurso(candidato);
    if (candidato.retomar) {
      // conta a retomada (a 3ª abertura sem o gasto já é a Home de sempre)
      const m = lerMissao();
      if (m?.gastoGuiado) {
        const novo = { ...m, gastoGuiado: { ...m.gastoGuiado, retomadas: (m.gastoGuiado.retomadas ?? 0) + 1 } };
        gravarMissao(novo); setMissao(novo);
        trackEvent("missao_doses_retomada", eventoDaMissao({ dia: candidato.n, modulo: "financas", passo: "gasto_depois_do_montar", vez: novo.gastoGuiado.retomadas }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emCurso, candidato?.n, candidato?.modulo, candidato?.chave, candidato?.modo, candidato?.retomar]);

  useEffect(() => {
    const reler = () => setMissao(lerMissao());
    window.addEventListener(EVENTO_MISSAO_DOSES, reler);
    return () => window.removeEventListener(EVENTO_MISSAO_DOSES, reler);
  }, []);

  /* 1.0.16 (revisão tela a tela 17/10, #17) — "CONHECER MAIS" TOCADO NA FESTA: a festa fecha e o passeio do módulo
     abre ali mesmo. Quando ele acaba ("Sair"/"Terminar"), a pessoa volta pro caminho da missão — antes ela ficava no
     módulo, e no braço A o tour curto e o "Plano de amanhã" (onde ela escolhe a hora do lembrete do dia 2 e dá a
     permissão de aviso) só vinham na próxima volta à Home. Agora:
       · braço A (qualquer dia) e a 3ª dose do B → a Home: lá o tour curto, o plano, a dica do dia ou "O que você
         construiu" seguem a ordem de sempre (cada um espera a tela do outro sair — nunca duas folhas juntas);
       · B, doses 1 e 2 → a PRÓXIMA dose (a festa ia sozinha pra ela; o passeio só interrompeu a passagem).
     Só o passeio que ESTA festa abriu (mesmo módulo, origem "fim_dose"); saiu do módulo no meio → esquece. */
  const voltarDoPasseio = useRef<{ modulo: ModuloDaMissao; n: DiaDaMissao } | null>(null);
  const navegar = useRef(navigate);
  navegar.current = navigate;
  useEffect(() => {
    const v = voltarDoPasseio.current;
    if (v && !pathname.startsWith(MODULOS[v.modulo].rota)) voltarDoPasseio.current = null;
  }, [pathname]);
  useEffect(() => {
    const aoFimDoPasseio = (e: Event) => {
      const d = (e as CustomEvent<FimDoTour>).detail;
      const v = voltarDoPasseio.current;
      if (!v || !d || d.origem !== "fim_dose" || d.modulo !== v.modulo) return;
      voltarDoPasseio.current = null;
      try {
        const m = lerMissao();
        const hojeAgora = localDayKey();
        const prox = m ? passoPendente(m) : null;
        const proxima = m && prox && ehBracoB(m) && diaDaMissao(m, hojeAgora) === 1 && m.agoraNao?.dia !== hojeAgora ? prox : null;
        trackEvent("missao_doses_conhecer_mais_volta", eventoDaMissao({ dia: v.n, modulo: v.modulo, completo: !!d.completo, para: proxima ? proxima.modulo : "home" }));
        if (proxima) {
          setPassoAberto((x) => x + 1);
          navegar.current(MODULOS[proxima.modulo].rota);
        } else navegar.current("/home");
      } catch { /* nunca derruba a missão */ }
    };
    window.addEventListener(EVENTO_FIM_TOUR, aoFimDoPasseio);
    return () => window.removeEventListener(EVENTO_FIM_TOUR, aoFimDoPasseio);
  }, []);

  // nasce na 1ª entrada logada: a área da porta primeiro
  useEffect(() => {
    if (!user || !loaded || missao || semAcessoNoApp) return;
    // 1.0.16 (4.8): reinstalou / trocou de aparelho / a missão local é de outra conta → a CÓPIA DA CONTA volta
    // (boas-vindas, convites e doses feitas não se repetem)
    const copia = missaoValida(get<unknown>(CHAVE_MISSAO_NA_CONTA, null));
    if (copia && missaoDaConta(copia, user.id)) {
      const m = gravarMissao(copia);
      setMissao(m);
      trackEvent("missao_restaurada", eventoDaMissao({ doses: dosesFeitas(m), boas_vindas: m.boasVindas }));
      return;
    }
    // no app: só pra quem é novo nesta versão (a Missão antiga em andamento termina a dela). Uma missão local
    // de OUTRA conta não conta como "já nasceu aqui" (missaoDosesMandaNoApp diria sim por ela).
    if (isNativeShell()) {
      const local = lerMissao();
      const outraConta = !!local && !missaoDaConta(local, user.id);
      if (outraConta ? (MISSAO_DOSES_APP !== "on" || !!missaoAtual() || !contaNova(user.created_at)) : !missaoDosesMandaNoApp(user.created_at)) return;
    }
    const areaLida = areaEscolhidaNoFunil();
    const area = areaDaMissao(user.user_metadata);
    const modulos = modulosPadrao(area);
    // 10/10: o braço do teste "dia 1 cheio" (null com a chave desligada = a missão de hoje)
    // 1.0.16: com a metadata `missao_1_por_dia` = "ab"/"on", o sorteio é A (uma por dia) × B (dia 1 cheio)
    const braco = bracoDia1();
    let m = iniciarMissao(modulos, hoje, undefined, braco);
    // o dono só entra com o braço (build de loja): sem braço, o JSON é o de sempre, campo a campo
    if (braco) m = gravarMissao({ ...m, dono: donoDaConta(user.id) });
    setMissao(m);
    const portaArea = (() => { try { const a = (user.user_metadata as { porta?: { respostas?: { area?: unknown } } } | undefined)?.porta?.respostas?.area; return typeof a === "string" ? a : null; } catch { return null; } })();
    trackEvent("missao_doses_inicio", eventoDaMissao({
      modulos, area: area ?? null, area_lida: areaLida ?? null, area_respondida: portaArea,
      origem_area: areaLida && areaLida in AREAS ? "funil" : area ? "porta" : "padrao", ...(braco ? { missao_1_por_dia: modoUmPorDia() } : {}),
    }));
  }, [user, loaded, missao, hoje, semAcessoNoApp]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 1.0.16 (4.8): a cópia da missão na conta acompanha cada mudança (sobe pro user_data). Escrita de SISTEMA:
     mexer na missão (ver as boas-vindas, o convite) não é registro da pessoa — não conta dia na sequência. */
  const missaoJson = missao ? JSON.stringify(missao) : null;
  useEffect(() => {
    if (!loaded || !missao || !missao.dono) return;
    try {
      const atual = get<unknown>(CHAVE_MISSAO_NA_CONTA, null);
      if (JSON.stringify(atual ?? null) !== missaoJson) gravarNaConta(CHAVE_MISSAO_NA_CONTA, missao, { system: true });
    } catch { /* nunca derruba a missão */ }
  }, [loaded, missaoJson]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 1.0.16, braço A: quem tocou "Explorar por conta própria" ganha o tour curto na 1ª VOLTA à Home (desenho 8,
     7c) — não no mesmo segundo do "Explorar". Aqui só se marca que ela saiu da Home uma vez. */
  useEffect(() => {
    if (!missao || !ehUmPorDia(missao) || !missao.explorou || missao.saiuDaHome || pathname === "/home") return;
    const m = lerMissao();
    if (m && !m.saiuDaHome) { const novo = { ...m, saiuDaHome: true }; gravarMissao(novo); setMissao(novo); }
  }, [pathname, missao]);

  /* ── O 4º PASSO (B): o tour da Home. Quando ele termina (EVENTO_TOUR_HOME_FIM) a missão fecha:
     `missao_dose_concluida indice=4 modulo=home` + `missao_completa`. Se o tour não existe pra esta
     pessoa (chave desligada, ou já feito neste aparelho), o passo é dado como feito em silêncio. ── */
  const B = ehBracoB(missao);
  const homePendente = passoHomePendente(missao);
  useEffect(() => {
    if (!homePendente) return;
    const concluir = (via: "tour" | "sem_tour") => {
      const m = lerMissao();
      if (!m || m.homeTour) return;
      const novo = { ...m, homeTour: { dia: hoje, via }, completaEm: hoje };
      gravarMissao(novo); setMissao(novo);
      if (via === "tour") trackEvent("missao_dose_concluida", eventoDaMissao({ indice: 4, modulo: "home", dia_relogio: diaDaMissao(m, hoje) }));
      trackEvent("missao_completa", eventoDaMissao({ dia_relogio: diaDaMissao(m, hoje), modulos: m.modulos, home: via }));
      try { window.dispatchEvent(new CustomEvent(EVENTO_MISSAO_COMPLETA, { detail: { variante: m.braco } })); } catch { /* noop */ }
      if (via === "tour") pedirNotaDepois("missao_completa");
    };
    // (1.0.16) feito neste aparelho OU na conta (reinstalou): o tour não volta — o 4º passo fecha em silêncio
    if (!tourHomeLigado() || tourFeito(get) || tourSemMaisAberturas()) { concluir("sem_tour"); return; }
    const aoFim = () => concluir("tour");
    window.addEventListener(EVENTO_TOUR_HOME_FIM, aoFim);
    return () => window.removeEventListener(EVENTO_TOUR_HOME_FIM, aoFim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homePendente, hoje]);

  /* ── A folha do plano espera a festa "Casa arrumada" (ou qualquer outra festa) sair da tela.
     Depois do tour, a festa leva ~2 s pra entrar (os Momentos esperam a tela assentar): a folha segura
     até o "Casa arrumada" ter sido VISTO (conquistas-vistas) — ou 8 s, se a festa não vier. ── */
  const [festaAberta, setFestaAberta] = useState(() => festaNaTela());
  const [esperouFesta, setEsperouFesta] = useState(false);
  const planoDevendo = !!missao && B && precisaPlanoAmanha(missao, hoje);
  /* 1.0.16 (revisão pré-build, 17/10): o convite e a dica contam a vista quando APARECEM — e a tela que está aberta
     não pode sumir por causa da própria vista (a 2ª chance do convite contava "visto" e sumia no mesmo instante). O
     dia do convite / a dica NA TELA (vista já contada) ficam aqui até a decisão ou até ela sair da Home. */
  const [conviteNaTela, setConviteNaTela] = useState<string | null>(null);
  const [dicaNaTela, setDicaNaTela] = useState<2 | 3 | null>(null);
  useEffect(() => {
    if (pathname !== "/home") { setConviteNaTela(null); setDicaNaTela(null); } // voltar pra Home é outra aparição
  }, [pathname]);
  /* 1.0.16, braço A: reabriu num dia novo → o convite "Dia N da missão" na Home (1x por dia). Espera
     1,2 s (a Home assentar) e qualquer outra festa/folha sair da tela — nunca duas folhas juntas. */
  const conviteDevido = !!missao && pathname === "/home" && !emCurso && conviteDoDiaDevido(missao, hoje, conviteNaTela === hoje);
  const [conviteLivre, setConviteLivre] = useState(false);
  /* 1.0.16, braço A — a folha "Plano de amanhã" (dia 1): depois da dose, da comemoração e do tour curto */
  const tourPendente = (() => { try { return !tourFeito(get) && deveMostrarTourHome(user?.created_at); } catch { return false; } })();
  const planoADevido = !!missao && pathname === "/home" && !emCurso && precisaPlanoA(missao, hoje) && !tourPendente;
  const [planoALivre, setPlanoALivre] = useState(false);
  useEffect(() => {
    if (!planoADevido) { setPlanoALivre(false); return; }
    let estaveis = 0;
    const t = window.setInterval(() => {
      estaveis = festaNaTela() || document.querySelector('[data-camada-guia]:not([data-camada-guia="missao-doses-plano"])') ? 0 : estaveis + 1;
      if (estaveis >= 3) { setPlanoALivre(true); window.clearInterval(t); }
    }, 400);
    return () => window.clearInterval(t);
  }, [planoADevido]);
  /* 1.0.16, braço A — as dicas de 1 balão: dia 2 (score) e dia 3 (widgets), depois da dose do dia, na Home. O véu
     deixa o toque passar (ela sai sem o "Entendi"): cada aparição conta, e sem decisão a 2ª é a última */
  const diaDaDica = !missao || pathname !== "/home" || emCurso ? null : dicaDoDiaDevida(missao, hoje, dicaNaTela);
  const [dicaLivre, setDicaLivre] = useState(false);
  useEffect(() => {
    if (!diaDaDica) { setDicaLivre(false); return; }
    let estaveis = 0;
    const t = window.setInterval(() => {
      estaveis = festaNaTela() || document.querySelector('[data-camada-guia]:not([data-camada-guia="missao-dica"])') ? 0 : estaveis + 1;
      if (estaveis >= 3) { setDicaLivre(true); window.clearInterval(t); }
    }, 400);
    return () => window.clearInterval(t);
  }, [diaDaDica]);
  useEffect(() => {
    if (!conviteDevido) { setConviteLivre(false); return; }
    let estaveis = 0;
    const t = window.setInterval(() => {
      estaveis = festaNaTela() ? 0 : estaveis + 1;
      if (estaveis >= 3) { setConviteLivre(true); window.clearInterval(t); }
    }, 400);
    return () => window.clearInterval(t);
  }, [conviteDevido]);
  const casaVista = (() => {
    try { return ((get<{ adesivos?: string[] } | undefined>("conquistas-vistas", undefined)?.adesivos) ?? []).includes("casa-arrumada"); } catch { return false; }
  })();
  const segurarPeloCasa = planoDevendo && missao?.homeTour?.via === "tour" && !casaVista && !esperouFesta;
  useEffect(() => {
    if (!planoDevendo) { setEsperouFesta(false); return; }
    setFestaAberta(festaNaTela());
    const t = window.setInterval(() => setFestaAberta(festaNaTela()), 500);
    const limite = window.setTimeout(() => setEsperouFesta(true), 8000);
    return () => { window.clearInterval(t); window.clearTimeout(limite); };
  }, [planoDevendo]);

  // funil da missão na web (protótipo 18/10): a convidada do /missao vê a missão sem conta (a missão nasce no funil)
  if ((!user && !missaoWebConvidada()) || !missao || semAcessoNoApp) return null;

  const salvar = (m: EstadoMissaoDoses) => { gravarMissao(m); setMissao(m); };
  const areaNome = (() => {
    const a = areaDaMissao(user?.user_metadata);
    return a && a in AREAS ? AREAS[a as AreaKey].nome : null;
  })();
  const pendente = passoPendente(missao);
  const dia = diaDaMissao(missao, hoje);
  const noHome = pathname === "/home";

  /* D1/D2 */
  if (!missao.boasVindas) {
    if (!noHome) return null;
    const comModulos = (modulos: [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao]) => {
      const trocou = modulos.some((m, i) => m !== missao.modulos[i]);
      if (trocou) trackEvent("missao_doses_modulos", eventoDaMissao({ de: missao.modulos, para: modulos }));
      return { ...missao, modulos, boasVindas: true };
    };
    return (
      <>
      {/* braço A: o score do começo (o "começo X → hoje Y" do "O que você construiu" dizia "0"); o B e a missão
          antiga ficam byte a byte como estão */}
      {ehUmPorDia(missao) && missao.scoreNoInicio === undefined && (
        <LerScoreDoDia aoLer={(score) => { const m = lerMissao() ?? missao; if (m.scoreNoInicio === undefined) salvar({ ...m, scoreNoInicio: score }); }} />
      )}
      <BoasVindasDoses
        missao={missao}
        nome={nomeDaPessoa(get<unknown>("core-user-name", "") || get<unknown>("user-name", ""), user?.user_metadata)}
        areaNome={areaNome}
        hoje={hoje}
        braco={B ? "B" : ehUmPorDia(missao) ? "A" : null} /* B: "3 toques hoje"; A (1.0.16): "Tá dentro! + Seu plano de 3 dias", 1 tela */
        aoComecar={(modulos) => {
          // a rota troca embaixo (a Home some, o módulo entra): a cópia fica inteira até o módulo estar lá — sem a Home aparecendo
          saidaCalmaDe('[data-testid="missao-doses-boas-vindas"]', MOV_MS.base, 420);
          const m = comModulos(modulos);
          salvar(m);
          trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "comecar", modulos, ...(B ? { tela: 2 } : {}) }));
          marcarComecar(); // B12: quanto o módulo leva do "Começar" até a 1ª tela da dose
          navigate(MODULOS[modulos[0]].rota);
        }}
        aoExplorar={(modulos) => {
          saidaCalmaDe('[data-testid="missao-doses-boas-vindas"]');
          const m = { ...comModulos(modulos), explorou: true };
          salvar(m);
          trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "explorar", modulos, ...(B ? { tela: 2 } : {}) }));
          trackEvent("missao_pular", eventoDaMissao({ dia: 1, passo: "boas_vindas", segundos: 0, via: "link_boas_vindas" satisfies ViaDoPulo }));
        }}
      />
      </>
    );
  }

  /* BRAÇO B — a folha do plano de amanhã: a ÚLTIMA coisa do dia 1 (depois da festa "Casa arrumada", ou
     logo depois de um "Agora não" no meio das doses — ainda no contexto da missão, sem passo aberto). */
  if (planoDevendo && !emCurso && !festaAberta && !segurarPeloCasa) {
    return (
      <PlanoDeAmanha
        missao={missao}
        hoje={hoje}
        aoCombinar={(plano: PlanoAmanha, previa) => {
          saidaCalmaDe('[data-testid="plano-amanha"]');
          const m = lerMissao() ?? missao;
          salvar({ ...m, planoAmanha: plano });
          trackEvent("plano_amanha_definido", eventoDaMissao({ quando: plano.quando, gatilho: plano.gatilho ?? null, doses: dosesFeitas(m), titulo: previa.title }));
          pedirNotaDepois("plano_amanha_definido");
          // a hora do plano É a hora do Lembrete do dia 2 (a semana inteira); a permissão é pedida AQUI, ligada ao plano
          if (isNativeShell()) {
            combinarHora(LEMBRETE_DO_PLANO[plano.quando]);
            const reagendar = () => { try { window.dispatchEvent(new Event(EVENTO_DIA2)); } catch { /* noop */ } };
            Promise.resolve().then(() => pedirPermissaoDia2("missao")).catch(() => "indisponivel").finally(reagendar);
          }
          if (!noHome) navigate("/home");
        }}
        aoPular={() => {
          saidaCalmaDe('[data-testid="plano-amanha"]');
          const m = lerMissao() ?? missao;
          salvar({ ...m, planoAmanhaPulado: hoje });
          trackEvent("plano_amanha_pulou", eventoDaMissao({ doses: dosesFeitas(m) }));
          if (!noHome) navigate("/home");
        }}
      />
    );
  }

  /* 1.0.16, braço A — o convite do dia (reabriu num dia novo, a dose de hoje está liberada) */
  if (conviteDevido && conviteLivre) {
    const decidir = (acao: "foi" | "depois") => {
      saidaCalmaDe('[data-testid="missao-doses-convite"]', MOV_MS.base, acao === "foi" ? 420 : 0);
      const m = lerMissao() ?? missao;
      const p = passoPendente(m);
      salvar({ ...m, convites: { ...m.convites, [hoje]: acao } });
      trackEvent("missao_convite", eventoDaMissao({ acao: acao === "foi" ? "bora" : "depois", dia: p?.n ?? null, modulo: p?.modulo ?? null }));
      if (acao === "foi" && p) navigate(MODULOS[p.modulo].rota);
    };
    /* a folha ENTROU na tela (1x por aparição): conta a vista e manda o "visto". Gravar a missão avisa todo mundo
       (EVENTO_MISSAO_DOSES) e esta orquestra relê — a folha só continua porque a vista dela já está marcada como
       "na tela" (conviteNaTela) ANTES de a contagem subir. */
    const aoVer = () => {
      const m = lerMissao() ?? missao;
      const vez = (m.convitesVistos?.[hoje] ?? 0) + 1;
      setConviteNaTela(hoje);
      salvar({ ...m, convitesVistos: { ...m.convitesVistos, [hoje]: vez } });
      const p = passoPendente(m);
      trackEvent("missao_convite", eventoDaMissao({ acao: "visto", dia: p?.n ?? null, modulo: p?.modulo ?? null, vez }));
    };
    return <ConviteDoDia missao={missao} hoje={hoje} aoVer={aoVer} aoIr={() => decidir("foi")} aoDepois={() => decidir("depois")} />;
  }

  /* 1.0.16, braço A — o "Plano de amanhã" (a última coisa do dia 1) */
  if (planoADevido && planoALivre) {
    return (
      <PlanoDeAmanhaA
        missao={missao}
        aoCombinar={(l) => {
          saidaCalmaDe('[data-testid="plano-amanha-a"]');
          const m = lerMissao() ?? missao;
          salvar({ ...m, lembrete: l });
          trackEvent("missao_doses_lembrete", eventoDaMissao({ hora: l, origem: "plano_amanha" }));
          if (isNativeShell()) {
            combinarHora(l);
            const reagendar = () => { try { window.dispatchEvent(new Event(EVENTO_DIA2)); } catch { /* noop */ } };
            Promise.resolve().then(() => pedirPermissaoDia2("missao")).catch(() => "indisponivel").finally(reagendar);
          }
        }}
        aoSemLembrete={() => {
          saidaCalmaDe('[data-testid="plano-amanha-a"]');
          const m = lerMissao() ?? missao;
          salvar({ ...m, lembrete: "sem", planoAPulado: hoje });
          trackEvent("missao_doses_lembrete", eventoDaMissao({ hora: "sem", origem: "plano_amanha" }));
          if (isNativeShell()) { combinarHora("sem"); try { window.dispatchEvent(new Event(EVENTO_DIA2)); } catch { /* noop */ } }
        }}
      />
    );
  }

  /* 1.0.16, braço A — a dica de 1 balão do dia: a vista conta quando ela APARECE (como o convite); o "Entendi" fecha de vez */
  if (diaDaDica && dicaLivre) {
    const n = diaDaDica;
    return (
      <DicaDoDia
        dia={n}
        scoreAntes={missao.scoreAntes?.[n]}
        aoVer={() => {
          const m = lerMissao() ?? missao;
          const vez = (m.dicasVistas?.[n] ?? 0) + 1;
          setDicaNaTela(n); // antes de a contagem subir: a dica aberta não sai pela própria vista
          salvar({ ...m, dicasVistas: { ...m.dicasVistas, [n]: vez } });
          return vez;
        }}
        aoFechar={() => { saidaCalmaDe('[data-testid="missao-dica"]'); const m = lerMissao() ?? missao; setDicaNaTela(null); salvar({ ...m, dicas: { ...m.dicas, [n]: hoje } }); }}
      />
    );
  }

  /* D8 — no braço B só a partir do dia 3 (as 3 doses foram no dia 1; "em 3 dias" só faz sentido no 3º) */
  if (verFim || (missaoCumprida(missao) && !missao.fimVisto && noHome && (!B || dia >= 3))) {
    return (
      <ConstruiuEm3Dias
        missao={missao}
        aoContinuar={() => {
          saidaCalmaDe('[data-testid="missao-doses-fim"]', MOV_MS.base, noHome ? 0 : 420);
          salvar({ ...missao, fimVisto: true });
          setVerFim(false);
          trackEvent("missao_doses_fim_fechou", eventoDaMissao({}));
          if (!noHome) navigate("/home");
        }}
      />
    );
  }

  /* B, 4º passo: a faixa "Missão · 4 de 4" por cima do tour da Home */
  if (homePendente && noHome && !emCurso) return <FaixaDoPasso4 />;

  /* D3/D4/D7: o passo do dia, dentro do módulo dele */
  const passo: Passo | null = emCurso ?? candidato;
  // (1.0.16) a dose só monta com o dado da conta carregado: ela decide no mount o que a conta tem (Finanças vazia →
  // Montar; Rotina sem hábito → criar; Saúde sem meta → a meta no chip) — com o cache vazio decidiria errado
  if (loaded && passo && (passo.modo === "aprofundar" || !missao.feitos[passo.n] || emCurso || passo.retomar)) {
    const n = passo.n;
    const fechar = () => setEmCurso(null);
    const irParaProxima = () => {
      const m = lerMissao() ?? missao;
      const prox = passoPendente(m);
      setPassoAberto((x) => x + 1);
      fechar();
      if (prox) navigate(MODULOS[prox.modulo].rota);
      else navigate("/home");
    };
    return (
      <PassoDoDia
        key={`${n}-${passo.modulo}-${passo.chave}-${passo.modo ?? "dose"}`}
        missao={missao}
        n={n}
        modulo={passo.modulo}
        hoje={hoje}
        braco={B ? "B" : ehUmPorDia(missao) ? "A" : null}
        modo={passo.modo ?? "dose"}
        retomarGasto={!!passo.retomar}
        aoGastoGuiado={(estado) => {
          const m = lerMissao() ?? missao;
          if (estado === "pendente") {
            if (!m.braco) return; // sem braço (chave desligada) a missão é a 1.0.15, campo a campo
            salvar({ ...m, gastoGuiado: { n, dia: hoje, retomadas: m.gastoGuiado?.n === n && m.gastoGuiado.dia === hoje ? (m.gastoGuiado.retomadas ?? 0) : 0 } });
            return;
          }
          if (!m.gastoGuiado) return;
          const { gastoGuiado: _feito, ...sem } = m;
          salvar(sem);
        }}
        aoFeito={(rotulo, segundos) => {
          const m = lerMissao() ?? missao;
          if (passo.modo === "aprofundar") {
            const deHoje = m.aprofundados?.[hoje] ?? [];
            if (deHoje.includes(passo.modulo)) return;
            salvar({ ...m, aprofundados: { ...m.aprofundados, [hoje]: [...deHoje, passo.modulo] } });
            trackEvent("missao_aprofundar_feito", eventoDaMissao({ dia, modulo: passo.modulo, segundos, rotulo: semValor(rotulo) }));
            return;
          }
          if (m.feitos[n]) return;
          const feitos = { ...m.feitos, [n]: { dia: hoje, rotulo } };
          // 17/10 (regra do dono: tutorial é UMA vez por módulo): a dose feita É o tutorial daquele módulo — fica gravada
          // como intro VISTA ("dose", aparelho + conta), pra nunca repetir, nem reinstalando, nem no 2º aparelho. Não é
          // "feita": a lista de feitas é só pra missão virar continuação, e a retomada do 1º gasto (depois do Montar) lê ela.
          try { marcarIntroVista(passo.modulo, get, gravarNaConta, "dose"); } catch { /* storage bloqueado: a regra da missão ainda segura */ }
          const tresDoses = !!(feitos[1] && feitos[2] && feitos[3]);
          // A: 3 doses = missão completa. B: falta o 4º passo (a Home) — `completaEm` só depois dele.
          // (1.0.16: o adesivo NÃO é dado aqui — quem dá é o registro de Conquistas, pela regra do adesivo; a
          // comemoração só mostra o que abriu: adesivo-da-dose.tsx, evento `missao_adesivo_mostrado`)
          salvar({ ...m, feitos, ...(tresDoses && m.braco && !ehBracoB(m) ? { completaEm: hoje } : {}) });
          trackEvent("missao_doses_dia_feito", eventoDaMissao({ dia: n, dia_relogio: dia, modulo: passo.modulo, segundos, rotulo: semValor(rotulo) }));
          // 10/10 (DIA1_CHEIO): os eventos do teste, só com a chave ligada (eventoDaMissao põe `variante`)
          if (m.braco && eventoDaMissao().variante) {
            trackEvent("missao_dose_concluida", eventoDaMissao({ indice: n, modulo: passo.modulo, dia_relogio: dia, segundos }));
            if (tresDoses && !ehBracoB(m)) {
              trackEvent("missao_completa", eventoDaMissao({ dia_relogio: dia, modulos: m.modulos }));
              try { window.dispatchEvent(new CustomEvent(EVENTO_MISSAO_COMPLETA, { detail: { variante: m.braco } })); } catch { /* noop */ }
              pedirNotaDepois("missao_completa");
            }
          }
        }}
        aoPular={(via, passoPulado, segundos, extra) => {
          trackEvent("missao_pular", eventoDaMissao({ dia: n, passo: passoPulado, segundos, via, ...(passo.modo ? { modo: passo.modo } : {}), ...(extra ?? {}) }));
          // "Ainda não gastei nada hoje" (sem o Montar) = a dose fica pra depois, como o "Pular" (medido à parte pelo `via`)
          if (via === "faixa_20s" || via === "ainda_nao") {
            const m = lerMissao() ?? missao;
            if (passo.modo === "aprofundar") {
              const deHoje = m.aprofundados?.[hoje] ?? [];
              salvar({ ...m, aprofundados: { ...m.aprofundados, [hoje]: deHoje.includes(passo.modulo) ? deHoje : [...deHoje, passo.modulo] } });
            } else {
              salvar({ ...m, pulados: { ...m.pulados, [n]: hoje } });
            }
            fechar();
            navigate("/home");
          }
        }}
        aoCombinar={(lembrete: Lembrete) => {
          const m = lerMissao() ?? missao;
          salvar({ ...m, lembrete });
          trackEvent("missao_doses_lembrete", eventoDaMissao({ dia: n, hora: lembrete }));
          // 03/10: a hora combinada É a hora do Lembrete do dia 2 (uma notificação só, com o passo de
          // amanhã). No app, este é o momento de pedir a permissão — ela acabou de dizer "me lembra às 20h".
          if (isNativeShell()) {
            combinarHora(lembrete);
            const reagendar = () => { try { window.dispatchEvent(new Event(EVENTO_DIA2)); } catch { /* noop */ } };
            if (lembrete !== "sem") Promise.resolve().then(() => pedirPermissaoDia2("missao")).catch(() => "indisponivel").finally(reagendar);
            else reagendar();
          }
          if (ehUmPorDia(missao)) { trocarComCalma(() => { fechar(); navigate("/home"); }); return; }
          fechar();
          navigate("/home");
        }}
        aoAmanhaAgora={() => {
          trackEvent("missao_doses_amanha_agora", eventoDaMissao({ dia: n }));
          irParaProxima();
        }}
        aoVerFim={() => { fechar(); setVerFim(true); }}
        /* ── braço B ── */
        aoBoraProxima={(via) => {
          trackEvent("missao_bora_proxima", eventoDaMissao({ indice: n, via: via ?? "botao" }));
          irParaProxima();
        }}
        aoAgoraNao={() => {
          const m = lerMissao() ?? missao;
          salvar({ ...m, agoraNao: { dia: hoje, indice: n } });
          trackEvent("missao_agora_nao", eventoDaMissao({ indice: n }));
          // 1.0.16 (dono, 17/10): SEM a "próxima dose" em +3 h (900002) nos dois braços — no máximo 1 aviso de teste por
          // dia, e o do dia 2 já leva a dose. Só a missão SEM braço (a da 1.0.15 que ainda roda) arma, como sempre armou.
          const prox = passoPendente(m);
          if (prox && isNativeShell() && !m.braco) {
            const cfg = MODULOS[prox.modulo];
            void agendarProximaDose({ indice: prox.n, nome: cfg.nome, emoji: cfg.emoji, pedido: cfg.pedido, rota: cfg.rota })
              .then((r) => trackEvent("missao_proxima_dose_armada", eventoDaMissao(r.ok === true ? { ok: true, indice: prox.n, em: r.quando.toISOString() } : { ok: false, indice: prox.n, motivo: r.motivo })))
              .catch(() => { /* nunca derruba a missão */ });
          }
          fechar(); // a folha do plano de amanhã entra AQUI, ainda no módulo (precisaPlanoAmanha) — e leva pra Home
        }}
        aoFecharDia={() => {
          // 1.0.17: a festa já desceu; o véu cobre, a rota troca por baixo e abre devagar (nunca no mesmo tique)
          if (ehUmPorDia(missao)) { trocarComCalma(() => { fechar(); navigate("/home"); }); return; }
          fechar();
          navigate("/home"); // B: "Arrumar minha Home" → o tour é o 4º passo
        }}
        /* 1.0.16: "Conhecer mais do <módulo> (1 min)" — fecha a comemoração AQUI no módulo e abre o tour do outro ramo;
           quando o passeio acabar, a missão leva a pessoa de volta pro caminho dela (voltarDoPasseio, acima) */
        aoConhecerMais={CONHECER_MAIS.abrir ? () => {
          trackEvent("missao_doses_conhecer_mais", eventoDaMissao({ dia: n, modulo: passo.modulo }));
          fechar();
          voltarDoPasseio.current = { modulo: passo.modulo, n };
          try { CONHECER_MAIS.abrir?.(passo.modulo); } catch { voltarDoPasseio.current = null; /* o tour é de outro ramo: nunca derruba a missão */ }
        } : undefined}
        /* o quiz da 1ª dose (Rotina, Treino): apareceu (no máximo 2 vezes sem decidir) ou foi pulado (nunca mais) */
        aoSetup={(setup, acao) => {
          const m = lerMissao() ?? missao;
          if (acao === "pulou") salvar({ ...m, setupPulado: { ...m.setupPulado, [setup]: hoje } });
          else salvar({ ...m, setupVistas: { ...m.setupVistas, [setup]: (m.setupVistas?.[setup] ?? 0) + 1 } });
        }}
        /* ── braço A (1.0.16) ── */
        aoMostrarAdesivo={(ids) => {
          const m = lerMissao() ?? missao;
          const ja = m.adesivosMostrados ?? [];
          const novos = ids.filter((id) => !ja.includes(id));
          if (novos.length) salvar({ ...m, adesivosMostrados: [...ja, ...novos] });
        }}
        aoScoreAntes={(score) => {
          const m = lerMissao() ?? missao;
          if (m.scoreAntes?.[n] !== undefined) return;
          salvar({ ...m, scoreAntes: { ...m.scoreAntes, [n]: score } });
        }}
      />
    );
  }

  return null;
}

/** Pro QA: apaga a missão deste navegador (o card também oferece). */
export const recomecarMissaoDoses = (): void => apagarMissao();
