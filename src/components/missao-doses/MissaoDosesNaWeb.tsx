import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { areaEscolhidaNoFunil } from "@/components/missao/MissaoDoTrial";
import { isNativeShell } from "@/lib/native-shell";
import { EVENTO_DIA2, LEMBRETE_DO_PLANO, combinarHora } from "@/lib/lembrete-dia2";
import { agendarProximaDose, pedirPermissaoDia2 } from "@/lib/notificacoes";
import { bracoDia1, guardarForcaDia1Cheio, modoUmPorDia, type PlanoAmanha } from "@/lib/dia1-cheio";
import { pedirAvaliacaoPorMissao, type MotivoDaMissao } from "@/lib/avaliacao";
import { EVENTO_TOUR_HOME_FIM, tourFeitoNesteAparelho, tourHomeLigado } from "@/lib/tour-home";
import {
  CHAVE_MISSAO_NA_CONTA, EVENTO_MISSAO_COMPLETA, EVENTO_MISSAO_DOSES, MISSAO_DOSES_APP, MODULOS, TOTAL_PASSOS_B, apagarMissao, aprofundarPendente, contaNova, conviteDoDiaDevido, diaDaMissao, donoDaConta, doseAbreHoje, dosesFeitas, ehBracoB, ehUmPorDia, eventoDaMissao, gravarMissao, guardarForcaDaUrl, iniciarMissao, lerMissao,
  missaoDaConta, missaoValida, precisaPlanoA, sequenciaDaMissao,
  missaoCumprida, missaoDosesLigada, missaoDosesMandaNoApp, modulosPadrao, passoHomePendente, passoPendente, precisaPlanoAmanha, type DiaDaMissao, type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao,
} from "@/lib/missao-doses";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { BoasVindasDoses } from "./BoasVindasDoses";
import { PassoDoDia, type ViaDoPulo } from "./PassoDoDia";
import { ConstruiuEm3Dias } from "./ConstruiuEm3Dias";
import { PlanoDeAmanha } from "./PlanoDeAmanha";
import { ConviteDoDia } from "./ConviteDoDia";
import { PlanoDeAmanhaA } from "./PlanoDeAmanhaA";
import { DicaDoDia } from "./DicaDoDia";
import { adesivoDaDose } from "./PassoDoDia";
import { missaoAtual } from "@/lib/teste-gratis";
import { deveMostrarTourHome } from "@/lib/tour-home";
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
export function MissaoDosesNaWeb() {
  const { search } = useLocation();
  // a força de QA pelo link, em qualquer rota (o link do dono pode cair em qualquer página)
  guardarForcaDaUrl(search);
  guardarForcaDia1Cheio(search);
  const ligada = missaoDosesLigada();
  return ligada ? <Ligada /> : null;
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
  const [emCurso, setEmCurso] = useState<{ n: DiaDaMissao; modulo: ModuloDaMissao; chave: number; modo?: "aprofundar" } | null>(null);
  useEffect(() => {
    if (emCurso && !pathname.startsWith(MODULOS[emCurso.modulo].rota)) setEmCurso(null);
  }, [pathname, emCurso]);
  const pendenteAgora = missao ? passoPendente(missao) : null;
  const aprofundar = missao && missao.boasVindas ? aprofundarPendente(missao, pathname, hoje) : null;
  type Passo = { n: DiaDaMissao; modulo: ModuloDaMissao; chave: number; modo?: "aprofundar" };
  // 1.0.16 (braço A, uma dose por dia): a dose de amanhã NÃO abre hoje, nem entrando no módulo dela (nem depois do 7º dia)
  const candidato: Passo | null = missao?.boasVindas && pendenteAgora && pathname.startsWith(MODULOS[pendenteAgora.modulo].rota) && missao.pulados?.[pendenteAgora.n] !== hoje && doseAbreHoje(missao, hoje)
    ? { n: pendenteAgora.n, modulo: pendenteAgora.modulo, chave: passoAberto }
    : aprofundar ? { n: aprofundar.n, modulo: aprofundar.modulo, chave: passoAberto, modo: "aprofundar" }
    : null;
  useEffect(() => {
    if (!emCurso && candidato) setEmCurso(candidato);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emCurso, candidato?.n, candidato?.modulo, candidato?.chave, candidato?.modo]);

  useEffect(() => {
    const reler = () => setMissao(lerMissao());
    window.addEventListener(EVENTO_MISSAO_DOSES, reler);
    return () => window.removeEventListener(EVENTO_MISSAO_DOSES, reler);
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

  /* 1.0.16 (4.8): a cópia da missão na conta acompanha cada mudança (sobe pro user_data) */
  const missaoJson = missao ? JSON.stringify(missao) : null;
  useEffect(() => {
    if (!loaded || !missao || !missao.dono) return;
    try {
      const atual = get<unknown>(CHAVE_MISSAO_NA_CONTA, null);
      if (JSON.stringify(atual ?? null) !== missaoJson) gravarNaConta(CHAVE_MISSAO_NA_CONTA, missao);
    } catch { /* nunca derruba a missão */ }
  }, [loaded, missaoJson]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!tourHomeLigado() || tourFeitoNesteAparelho()) { concluir("sem_tour"); return; }
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
  /* 1.0.16, braço A: reabriu num dia novo → o convite "Dia N da missão" na Home (1x por dia). Espera
     1,2 s (a Home assentar) e qualquer outra festa/folha sair da tela — nunca duas folhas juntas. */
  const conviteDevido = !!missao && pathname === "/home" && !emCurso && conviteDoDiaDevido(missao, hoje);
  const [conviteLivre, setConviteLivre] = useState(false);
  /* 1.0.16, braço A — a folha "Plano de amanhã" (dia 1): depois da dose, da comemoração e do tour curto */
  const tourPendente = (() => { try { return deveMostrarTourHome(user?.created_at); } catch { return false; } })();
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
  /* 1.0.16, braço A — as dicas de 1 balão: dia 2 (score) e dia 3 (widgets), depois da dose do dia, na Home */
  const diaDaDica = (() => {
    if (!missao || !ehUmPorDia(missao) || pathname !== "/home" || emCurso || missao.explorou) return null;
    const d = ([2, 3] as const).find((n) => missao.feitos[n]?.dia === hoje && !missao.dicas?.[n]);
    if (!d) return null;
    if (d === 3 && !missao.fimVisto) return null; // dia 3: depois de "O que você construiu"
    return d;
  })();
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

  if (!user || !missao || semAcessoNoApp) return null;

  const salvar = (m: EstadoMissaoDoses) => { gravarMissao(m); setMissao(m); };
  const areaNome = (() => {
    const a = areaDaMissao(user.user_metadata);
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
      <BoasVindasDoses
        missao={missao}
        nome=""
        areaNome={areaNome}
        hoje={hoje}
        braco={B ? "B" : ehUmPorDia(missao) ? "A" : null} /* B: "3 toques hoje"; A (1.0.16): "Tá dentro! + Seu plano de 3 dias", 1 tela */
        aoComecar={(modulos) => {
          const m = comModulos(modulos);
          salvar(m);
          trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "comecar", modulos, ...(B ? { tela: 2 } : {}) }));
          navigate(MODULOS[modulos[0]].rota);
        }}
        aoExplorar={(modulos) => {
          const m = { ...comModulos(modulos), explorou: true };
          salvar(m);
          trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "explorar", modulos, ...(B ? { tela: 2 } : {}) }));
          trackEvent("missao_pular", eventoDaMissao({ dia: 1, passo: "boas_vindas", segundos: 0, via: "link_boas_vindas" satisfies ViaDoPulo }));
        }}
      />
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
      const m = lerMissao() ?? missao;
      const p = passoPendente(m);
      salvar({ ...m, convites: { ...m.convites, [hoje]: acao } });
      trackEvent("missao_convite", eventoDaMissao({ acao: acao === "foi" ? "bora" : "depois", dia: p?.n ?? null, modulo: p?.modulo ?? null }));
      if (acao === "foi" && p) navigate(MODULOS[p.modulo].rota);
    };
    const aoVer = () => {
      const m = lerMissao() ?? missao;
      gravarMissao({ ...m, convitesVistos: { ...m.convitesVistos, [hoje]: (m.convitesVistos?.[hoje] ?? 0) + 1 } }); // sem setMissao: o convite fica na tela
      const p = passoPendente(m);
      trackEvent("missao_convite", eventoDaMissao({ acao: "visto", dia: p?.n ?? null, modulo: p?.modulo ?? null }));
    };
    return <ConviteDoDia missao={missao} hoje={hoje} aoVer={aoVer} aoIr={() => decidir("foi")} aoDepois={() => decidir("depois")} />;
  }

  /* 1.0.16, braço A — o "Plano de amanhã" (a última coisa do dia 1) */
  if (planoADevido && planoALivre) {
    return (
      <PlanoDeAmanhaA
        missao={missao}
        aoCombinar={(l) => {
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
          const m = lerMissao() ?? missao;
          salvar({ ...m, lembrete: "sem", planoAPulado: hoje });
          trackEvent("missao_doses_lembrete", eventoDaMissao({ hora: "sem", origem: "plano_amanha" }));
          if (isNativeShell()) { combinarHora("sem"); try { window.dispatchEvent(new Event(EVENTO_DIA2)); } catch { /* noop */ } }
        }}
      />
    );
  }

  /* 1.0.16, braço A — a dica de 1 balão do dia */
  if (diaDaDica && dicaLivre) {
    return <DicaDoDia dia={diaDaDica} aoFechar={() => { const m = lerMissao() ?? missao; salvar({ ...m, dicas: { ...m.dicas, [diaDaDica]: hoje } }); }} />;
  }

  /* D8 — no braço B só a partir do dia 3 (as 3 doses foram no dia 1; "em 3 dias" só faz sentido no 3º) */
  if (verFim || (missaoCumprida(missao) && !missao.fimVisto && noHome && (!B || dia >= 3))) {
    return (
      <ConstruiuEm3Dias
        missao={missao}
        aoContinuar={() => {
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
  if (passo && (passo.modo === "aprofundar" || !missao.feitos[passo.n] || emCurso)) {
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
        aoFeito={(rotulo, segundos) => {
          const m = lerMissao() ?? missao;
          if (passo.modo === "aprofundar") {
            const deHoje = m.aprofundados?.[hoje] ?? [];
            if (deHoje.includes(passo.modulo)) return;
            salvar({ ...m, aprofundados: { ...m.aprofundados, [hoje]: [...deHoje, passo.modulo] } });
            trackEvent("missao_aprofundar_feito", eventoDaMissao({ dia, modulo: passo.modulo, segundos, rotulo }));
            return;
          }
          if (m.feitos[n]) return;
          const feitos = { ...m.feitos, [n]: { dia: hoje, rotulo } };
          const tresDoses = !!(feitos[1] && feitos[2] && feitos[3]);
          // A: 3 doses = missão completa. B: falta o 4º passo (a Home) — `completaEm` só depois dele.
          // 1.0.16, braço A: o adesivo do dia (só dado/evento; a tela de Conquistas mora em outro lugar)
          let adesivos = m.adesivos;
          if (ehUmPorDia(m)) {
            const seguidos = sequenciaDaMissao({ ...m, feitos }, hoje);
            const ad = adesivoDaDose(n, seguidos);
            if (!(m.adesivos ?? []).includes(ad.id)) {
              adesivos = [...(m.adesivos ?? []), ad.id];
              trackEvent("adesivo_desbloqueado", eventoDaMissao({ id: ad.id, origem: `missao_dia_${n}` }));
            }
            if (seguidos >= 2) trackEvent("sequencia_marco", eventoDaMissao({ dias: seguidos, origem: "missao" }));
          }
          salvar({ ...m, feitos, ...(adesivos ? { adesivos } : {}), ...(tresDoses && m.braco && !ehBracoB(m) ? { completaEm: hoje } : {}) });
          trackEvent("missao_doses_dia_feito", eventoDaMissao({ dia: n, dia_relogio: dia, modulo: passo.modulo, segundos, rotulo }));
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
        aoPular={(via, passoPulado, segundos) => {
          trackEvent("missao_pular", eventoDaMissao({ dia: n, passo: passoPulado, segundos, via, ...(passo.modo ? { modo: passo.modo } : {}) }));
          if (via === "faixa_20s") {
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
          fechar();
          navigate("/home");
        }}
        aoAmanhaAgora={() => {
          trackEvent("missao_doses_amanha_agora", eventoDaMissao({ dia: n }));
          irParaProxima();
        }}
        aoVerFim={() => { fechar(); setVerFim(true); }}
        /* ── braço B ── */
        aoBoraProxima={() => {
          trackEvent("missao_bora_proxima", eventoDaMissao({ indice: n }));
          irParaProxima();
        }}
        aoAgoraNao={() => {
          const m = lerMissao() ?? missao;
          salvar({ ...m, agoraNao: { dia: hoje, indice: n } });
          trackEvent("missao_agora_nao", eventoDaMissao({ indice: n }));
          // a próxima dose volta em 3 h, na faixa da missão (não pede permissão; sem ela, fica só o Lembrete do dia 2)
          const prox = passoPendente(m);
          if (prox && isNativeShell()) {
            const cfg = MODULOS[prox.modulo];
            void agendarProximaDose({ indice: prox.n, nome: cfg.nome, emoji: cfg.emoji, pedido: cfg.pedido, rota: cfg.rota })
              .then((r) => trackEvent("missao_proxima_dose_armada", eventoDaMissao(r.ok === true ? { ok: true, indice: prox.n, em: r.quando.toISOString() } : { ok: false, indice: prox.n, motivo: r.motivo })))
              .catch(() => { /* nunca derruba a missão */ });
          }
          fechar(); // a folha do plano de amanhã entra AQUI, ainda no módulo (precisaPlanoAmanha) — e leva pra Home
        }}
        aoFecharDia={() => {
          fechar();
          navigate("/home"); // B: "Arrumar minha Home" → o tour é o 4º passo
        }}
      />
    );
  }

  return null;
}

/** Pro QA: apaga a missão deste navegador (o card também oferece). */
export const recomecarMissaoDoses = (): void => apagarMissao();
