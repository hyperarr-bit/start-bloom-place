import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { areaEscolhidaNoFunil } from "@/components/missao/MissaoDoTrial";
import { isNativeShell } from "@/lib/native-shell";
import { EVENTO_DIA2, combinarHora } from "@/lib/lembrete-dia2";
import { pedirPermissaoDia2 } from "@/lib/notificacoes";
import {
  EVENTO_MISSAO_DOSES, MODULOS, apagarMissao, diaDaMissao, eventoDaMissao, gravarMissao, guardarForcaDaUrl, iniciarMissao, lerMissao,
  missaoCumprida, missaoDosesLigada, missaoDosesMandaNoApp, modulosPadrao, passoPendente, type DiaDaMissao, type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao,
} from "@/lib/missao-doses";
import { BoasVindasDoses } from "./BoasVindasDoses";
import { PassoDoDia, type ViaDoPulo } from "./PassoDoDia";
import { ConstruiuEm3Dias } from "./ConstruiuEm3Dias";

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
 * O card "SEU DIA" mora na Home (CardSeuDia) e lê o mesmo estado.
 */
export function MissaoDosesNaWeb() {
  const { search } = useLocation();
  // a força de QA pelo link, em qualquer rota (o link do dono pode cair em qualquer página)
  guardarForcaDaUrl(search);
  const ligada = missaoDosesLigada();
  return ligada ? <Ligada /> : null;
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
  const [emCurso, setEmCurso] = useState<{ n: DiaDaMissao; modulo: ModuloDaMissao; chave: number } | null>(null);
  useEffect(() => {
    if (emCurso && !pathname.startsWith(MODULOS[emCurso.modulo].rota)) setEmCurso(null);
  }, [pathname, emCurso]);
  const pendenteAgora = missao ? passoPendente(missao) : null;
  const candidato = missao?.boasVindas && pendenteAgora && pathname.startsWith(MODULOS[pendenteAgora.modulo].rota) && missao.pulados?.[pendenteAgora.n] !== hoje
    ? { n: pendenteAgora.n, modulo: pendenteAgora.modulo, chave: passoAberto }
    : null;
  useEffect(() => {
    if (!emCurso && candidato) setEmCurso(candidato);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emCurso, candidato?.n, candidato?.modulo, candidato?.chave]);

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
    const m = iniciarMissao(modulos, hoje);
    setMissao(m);
    trackEvent("missao_doses_inicio", eventoDaMissao({ modulos, area: area ?? null }));
  }, [user, loaded, missao, hoje]);

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
        aoComecar={(modulos) => {
          const m = comModulos(modulos);
          salvar(m);
          trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "comecar", modulos }));
          navigate(MODULOS[modulos[0]].rota);
        }}
        aoExplorar={(modulos) => {
          const m = { ...comModulos(modulos), explorou: true };
          salvar(m);
          trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "explorar", modulos }));
          trackEvent("missao_pular", eventoDaMissao({ dia: 1, passo: "boas_vindas", segundos: 0, via: "link_boas_vindas" satisfies ViaDoPulo }));
        }}
      />
    );
  }

  /* D8 */
  if (verFim || (missaoCumprida(missao) && !missao.fimVisto && noHome)) {
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

  /* D3/D4/D7: o passo do dia, dentro do módulo dele */
  const passo = emCurso ?? candidato;
  if (passo && (missao.feitos[passo.n] ? emCurso : true)) {
    const n = passo.n;
    const fechar = () => setEmCurso(null);
    return (
      <PassoDoDia
        key={`${n}-${passo.modulo}-${passo.chave}`}
        missao={missao}
        n={n}
        modulo={passo.modulo}
        hoje={hoje}
        aoFeito={(rotulo, segundos) => {
          const m = lerMissao() ?? missao;
          if (m.feitos[n]) return;
          salvar({ ...m, feitos: { ...m.feitos, [n]: { dia: hoje, rotulo } } });
          trackEvent("missao_doses_dia_feito", eventoDaMissao({ dia: n, dia_relogio: dia, modulo: passo.modulo, segundos, rotulo }));
        }}
        aoPular={(via, passoPulado, segundos) => {
          trackEvent("missao_pular", eventoDaMissao({ dia: n, passo: passoPulado, segundos, via }));
          if (via === "faixa_20s") {
            const m = lerMissao() ?? missao;
            salvar({ ...m, pulados: { ...m.pulados, [n]: hoje } });
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
          const m = lerMissao() ?? missao;
          const prox = passoPendente(m);
          setPassoAberto((x) => x + 1);
          fechar();
          if (prox) navigate(MODULOS[prox.modulo].rota);
          else navigate("/home");
        }}
        aoVerFim={() => { fechar(); setVerFim(true); }}
      />
    );
  }

  return null;
}

/** Pro QA: apaga a missão deste navegador (o card também oferece). */
export const recomecarMissaoDoses = (): void => apagarMissao();
