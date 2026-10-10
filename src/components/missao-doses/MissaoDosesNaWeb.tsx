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
import { bracoDia1, guardarForcaDia1Cheio, type PlanoAmanha } from "@/lib/dia1-cheio";
import { pedirAvaliacaoPorMissao, type MotivoDaMissao } from "@/lib/avaliacao";
import { EVENTO_TOUR_HOME_FIM, tourFeitoNesteAparelho, tourHomeLigado } from "@/lib/tour-home";
import {
  EVENTO_MISSAO_COMPLETA, EVENTO_MISSAO_DOSES, MODULOS, TOTAL_PASSOS_B, apagarMissao, aprofundarPendente, diaDaMissao, dosesFeitas, ehBracoB, eventoDaMissao, gravarMissao, guardarForcaDaUrl, iniciarMissao, lerMissao,
  missaoCumprida, missaoDosesLigada, missaoDosesMandaNoApp, modulosPadrao, passoHomePendente, passoPendente, precisaPlanoAmanha, type DiaDaMissao, type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao,
} from "@/lib/missao-doses";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { BoasVindasDoses } from "./BoasVindasDoses";
import { PassoDoDia, type ViaDoPulo } from "./PassoDoDia";
import { ConstruiuEm3Dias } from "./ConstruiuEm3Dias";
import { PlanoDeAmanha } from "./PlanoDeAmanha";
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
  const { user } = useAuth();
  const { loaded } = useUserData();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hoje = localDayKey();
  const [missao, setMissao] = useState<EstadoMissaoDoses | null>(() => lerMissao());
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
  const candidato: Passo | null = missao?.boasVindas && pendenteAgora && pathname.startsWith(MODULOS[pendenteAgora.modulo].rota) && missao.pulados?.[pendenteAgora.n] !== hoje
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
    if (!user || !loaded || missao) return;
    // no app: só pra quem é novo nesta versão (a Missão antiga em andamento termina a dela)
    if (isNativeShell() && !missaoDosesMandaNoApp(user.created_at)) return;
    const area = areaEscolhidaNoFunil();
    const modulos = modulosPadrao(area);
    // 10/10: o braço do teste "dia 1 cheio" (null com a chave desligada = a missão de hoje)
    const braco = bracoDia1();
    const m = iniciarMissao(modulos, hoje, undefined, braco);
    setMissao(m);
    trackEvent("missao_doses_inicio", eventoDaMissao({ modulos, area: area ?? null }));
  }, [user, loaded, missao, hoje]);

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
  const { get } = useUserData();
  const [festaAberta, setFestaAberta] = useState(() => festaNaTela());
  const [esperouFesta, setEsperouFesta] = useState(false);
  const planoDevendo = !!missao && B && precisaPlanoAmanha(missao, hoje);
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

  if (!user || !missao) return null;

  const salvar = (m: EstadoMissaoDoses) => { gravarMissao(m); setMissao(m); };
  const areaNome = (() => {
    const a = areaEscolhidaNoFunil();
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
        braco={B ? "B" : null} /* 10/10: no braço B a copy é "3 toques hoje + arrumar sua Home"; A = a tela de hoje */
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
        braco={B ? "B" : missao.braco === "A" ? "A" : null}
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
          salvar({ ...m, feitos, ...(tresDoses && m.braco && !ehBracoB(m) ? { completaEm: hoje } : {}) });
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
