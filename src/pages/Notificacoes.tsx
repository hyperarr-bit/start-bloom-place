import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useVoltarDaSubpagina } from "@/lib/volta-da-demo";
import { AlarmClock, Bell, BellOff, BookOpen, Cake, CalendarCheck, CalendarClock, ChevronDown, ChevronLeft, Droplets, Dumbbell, Flame, Gift, Heart, Home, Mail, PartyPopper, Pill, Receipt, Repeat, Salad, Sparkles, Sunrise, Wallet, Wrench, type LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUserData } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { isNativeShell } from "@/lib/native-shell";
import { abrirAjusteDeAlarmeExato, estadoAlarmeExato, estadoPermissao, listarAgendados, pedirPermissao, type EstadoAlarmeExato, type EstadoPermissao, type TipoDeLembrete } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs, rotuloHora, type PrefsNotificacoes } from "@/lib/prefs-notificacoes";
import { lerDia2 } from "@/lib/lembrete-dia2";
import { CHAVE_REMEDIOS_LIGADO, type Leitor } from "@/lib/reagendar";
import { CHAVE_AVISO_CONSULTAS } from "@/lib/consulta-avisos";
import { CHAVE_LEMBRETE_SKINCARE, algumLigado, lerLembreteSkincare } from "@/lib/beleza-lembrete";
import { CHAVE_LEMBRETE_CABELO, lembreteCabeloLigado, lerLembreteCabelo } from "@/lib/beleza-cabelo";
import { CHAVE_CUIDADOS, algumAvisoDeCuidado, cuidadosValidos } from "@/lib/beleza-cuidados";
import { CHAVE_LEMBRETE_VALIDADE, lerLembreteValidade } from "@/lib/beleza-produtos";
import { CHAVE_LEMBRETE_ROTINA_MANHA, lerLembreteRotinaManha } from "@/lib/rotina-manha";
import { trackEvent } from "@/lib/analytics";
import { CHAVE_LEMBRETE as CHAVE_LEMBRETE_PET } from "@/lib/pet";
import { algumLigadoPet, lerPrefsLembretePet, type PrefsLembretePet } from "@/lib/pet-avisos";
import { PawPrint } from "lucide-react";
import { CHAVE_LEMBRETE_RELACOES, lerLembreteRelacoes, type LembreteRelacoes } from "@/lib/relacoes-lembrete";
import { ESSENCIAIS, GRUPOS, IDS_LEMBRETES, itensDoGrupo, type GrupoLembretes, type IdLembrete } from "@/lib/lembretes-tela";
import { SUAVIDADE_HOME_NOVA } from "@/lib/home-nova";
import { FolhaLembrete, type ControleDeHora } from "@/components/notificacoes/FolhaLembrete";
import { TRACO, corDoModulo, tintaDoModulo } from "@/components/home-nova/e/paleta";
import { useFundoDaTelaE } from "@/components/home-nova/e/fundo-da-tela";
import "@/components/home-nova/home-nova.css";
import "@/components/home-nova/e/home-e.css";

/**
 * Central de notificações (27/07).
 *
 * A razão de existir está em `prefs-notificacoes.ts`: sem controle por tipo,
 * a única saída de quem se incomodou é desligar tudo no Android — e de lá o
 * app não volta. Aqui cada aviso tem chave própria.
 *
 * Três decisões que valem registrar:
 *  1. A tela mostra o que está REALMENTE agendado no sistema, não só o que os
 *     interruptores dizem. Uma central que promete e não entrega é pior que
 *     nenhuma — e foi assim que descobri, testando no aparelho, que nenhuma
 *     notificação estava sendo agendada de verdade.
 *  2. Sem permissão os interruptores não somem: ficam visíveis e o primeiro
 *     toque PEDE a permissão. Esconder faria a pessoa achar que o app não tem
 *     lembrete nenhum.
 *  3. (29/10, A6 aprovada pelo dono) A ARRUMAÇÃO mora em lib/lembretes-tela.ts: "N ligados" no topo,
 *     ESSENCIAIS pelo uso real (Remédios, Contas, Fechamento do dia, Compromissos) e o resto POR MÓDULO, em
 *     sanfona quando o módulo tem mais de 1 (os 3 de aniversário juntos em Relações). Cada linha tem 1 frase
 *     curta; o texto completo de antes, o estado do agendamento e o horário ficam na folha (toque na linha ou
 *     na pílula do horário). Chaves gravadas, padrões, reagendamento e eventos notif_pref: os de sempre.
 */

type ChaveLiga = "contas" | "retrospectiva" | "rotina" | "treino" | "leitura" | "dieta" | "aniversario" | "casa" | "compromissos" | "tarefas" | "limite" | "sequencia";

const Notificacoes = () => {
  // 30/07 (dono): na web/PWA não existe como ENTREGAR notificação local, e a
  // tela com interruptores "que valem no app" só gera ticket de suporte.
  // Fora do app da loja a rota nem abre. Antes de QUALQUER hook de propósito:
  // isNativeShell() é constante na sessão, então a contagem de hooks é
  // estável por ambiente. Reverter quando houver push web.
  if (!isNativeShell()) return <Navigate to="/home" replace />;
  const voltar = useVoltarDaSubpagina("/home");
  const { get, set } = useUserData();
  const [prefs, setPrefs] = usePersistedState<PrefsNotificacoes>(CHAVE_PREFS, lerPrefs(undefined));
  // remédios (07/09): chave própria, nasce ligado — ver CHAVE_REMEDIOS_LIGADO
  const remediosLigado = get<boolean>(CHAVE_REMEDIOS_LIGADO, true) !== false;
  // consultas (13/10): mesma regra dos remédios — chave própria, nasce ligado
  const consultasLigado = get<boolean>(CHAVE_AVISO_CONSULTAS, true) !== false;
  const [permissao, setPermissao] = useState<EstadoPermissao | null>(null);
  // 08/10: alarme exato do Android (ver `estadoAlarmeExato`). "indisponivel" no iPhone e no Android < 12.
  const [alarmeExato, setAlarmeExato] = useState<EstadoAlarmeExato>("indisponivel");
  const [agendados, setAgendados] = useState<Partial<Record<TipoDeLembrete, number>>>({});
  // 29/10 (A6): os grupos abertos na sanfona e o lembrete com a folha aberta
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  const [folha, setFolha] = useState<IdLembrete | null>(null);
  const alternarGrupo = (id: string) => setAbertos((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  useFundoDaTelaE(); // a faixa do relógio e a casca na cor da Home nova (como a aba Você)

  const p = lerPrefs(prefs);
  const permitido = permissao === "granted";
  const naLoja = isNativeShell();

  const atualizarEstado = async () => {
    setPermissao(await estadoPermissao());
    setAlarmeExato(await estadoAlarmeExato());
    const lista = await listarAgendados();
    const contagem: Partial<Record<TipoDeLembrete, number>> = {};
    lista.forEach((n) => { contagem[n.tipo] = (contagem[n.tipo] ?? 0) + 1; });
    setAgendados(contagem);
  };

  // 08/10: relê ao VOLTAR das configurações do sistema (liberar notificações ou
  // o alarme exato) — antes só lia no mount, e a tela seguia dizendo
  // "bloqueado" depois de a pessoa ter liberado.
  useEffect(() => {
    void atualizarEstado();
    const aoVoltar = () => { if (document.visibilityState === "visible") void atualizarEstado(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, []);

  /** Atalho pra tela "Alarmes e lembretes" do Android; ao voltar, relê tudo (quem liberou ganha o horário exato). */
  const liberarAlarmeExato = async () => {
    setAlarmeExato(await abrirAjusteDeAlarmeExato());
    await atualizarEstado();
  };

  /**
   * A preferência ao vivo, fora do ciclo de render.
   *
   * Sem isto, dois toques rápidos leem o MESMO estado antigo e o segundo
   * desfaz o primeiro — `{...pAntigo, treino:true}` sobrescreve o `rotina`
   * que acabou de ser ligado. Apareceu ligando os interruptores em sequência
   * no aparelho: dos quatro, só o último ficava ligado.
   */
  const prefsRef = useRef<PrefsNotificacoes>(p);
  useEffect(() => { prefsRef.current = lerPrefs(prefs); }, [prefs]);

  /** Fila: um reagendamento por vez, na ordem em que os toques chegaram. */
  const filaRef = useRef<Promise<unknown>>(Promise.resolve());

  /**
   * Aplica as prefs no agendador de verdade e relê o que ficou de pé.
   *
   * Reaproveita o MESMO caminho do `useLembretes` em vez de reimplementar o
   * agendamento aqui — duas fontes de verdade sobre "o que agendar" era como
   * a tela e o sistema acabariam discordando.
   */
  const aplicar = (mudanca: Partial<PrefsNotificacoes>) => {
    filaRef.current = filaRef.current.then(async () => {
      const novas = { ...prefsRef.current, ...mudanca };
      prefsRef.current = novas;
      setPrefs(novas);
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(get, novas);
      await atualizarEstado();
    });
    return filaRef.current;
  };

  /** Ligar sem permissão tem que PEDIR, não apenas mover o botão. */
  const alternar = async (campo: ChaveLiga, valor: boolean) => {
    trackEvent("notif_pref", { campo, valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return; // negou: não finge que ligou
    }
    await aplicar({ [campo]: valor });
  };

  /** O que está armado da 1ª semana — lido do estado do aparelho (core-dia2), que o agendador grava. */
  const rodapeDaPrimeiraSemana = (): string => {
    const u = lerDia2()?.ultimo;
    if (u?.quando && new Date(u.quando).getTime() > Date.now()) {
      const d = new Date(u.quando);
      return `1 aviso agendado · amanhã às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    if (u?.motivo === "fim_da_semana") return "A sua primeira semana já passou — este aviso parou sozinho";
    if (u?.motivo === "sem_aviso") return "Você escolheu \"sem aviso\" na missão";
    return "Arma na próxima abertura do app";
  };

  /** Primeira semana (03/10): a pref mora no notif-prefs, mas o agendador é outro
   *  (sincronizarLembreteDia2 / cancelarLembreteDia2), não o reagendarTudo. */
  const alternarPrimeiraSemana = async (valor: boolean) => {
    trackEvent("notif_pref", { campo: "primeiraSemana", valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return;
    }
    const novas = { ...prefsRef.current, primeiraSemana: valor };
    prefsRef.current = novas;
    setPrefs(novas);
    filaRef.current = filaRef.current.then(async () => {
      const n = await import("@/lib/notificacoes");
      if (valor) await n.sincronizarLembreteDia2(get, { ligado: true });
      else await n.cancelarLembreteDia2();
      await atualizarEstado();
    });
    await filaRef.current;
  };

  /** Remédios não passam pelo `aplicar` das prefs: a chave é outra, e o `get`
   *  deste render ainda não enxerga a escrita — o leitor sobreposto entrega o
   *  valor novo ao reagendador sem esperar o próximo render. */
  const alternarRemedios = async (valor: boolean) => {
    trackEvent("notif_pref", { campo: "remedios", valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return;
    }
    set(CHAVE_REMEDIOS_LIGADO, valor);
    const leitor: Leitor = (k, fb) => (k === CHAVE_REMEDIOS_LIGADO ? (valor as unknown as typeof fb) : get(k, fb));
    filaRef.current = filaRef.current.then(async () => {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(leitor, prefsRef.current);
      await atualizarEstado();
    });
    await filaRef.current;
  };

  /** Consultas (13/10): igual aos remédios — chave própria, leitor sobreposto. */
  const alternarConsultas = async (valor: boolean) => {
    trackEvent("notif_pref", { campo: "consultas", valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return;
    }
    set(CHAVE_AVISO_CONSULTAS, valor);
    const leitor: Leitor = (k, fb) => (k === CHAVE_AVISO_CONSULTAS ? (valor as unknown as typeof fb) : get(k, fb));
    filaRef.current = filaRef.current.then(async () => {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(leitor, prefsRef.current);
      await atualizarEstado();
    });
    await filaRef.current;
  };

  /** Pet (29/09): as prefs moram na chave própria (`pet-lembrete-prefs`), como os remédios —
   *  aqui um interruptor liga/desliga os dois (cuidados com data e remédio na hora). */
  const prefsPet = lerPrefsLembretePet(get<unknown>(CHAVE_LEMBRETE_PET, undefined));
  const petLigado = algumLigadoPet(prefsPet);
  const alternarPet = async (novas: PrefsLembretePet) => {
    trackEvent("notif_pref", { campo: "pet", valor: algumLigadoPet(novas) });
    if (algumLigadoPet(novas) && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return;
    }
    set(CHAVE_LEMBRETE_PET, novas);
    const leitor: Leitor = (k, fb) => (k === CHAVE_LEMBRETE_PET ? (novas as unknown as typeof fb) : get(k, fb));
    filaRef.current = filaRef.current.then(async () => {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(leitor, prefsRef.current);
      await atualizarEstado();
    });
    await filaRef.current;
  };

  /* Relações (29/09): "parabéns no dia" e "faz tempo que não falo com…" — chave própria
     (`rel-lembrete-prefs`), nascem desligados; o horário se escolhe em Relações → Avisos. */
  const relLembrete = lerLembreteRelacoes(get<unknown>(CHAVE_LEMBRETE_RELACOES, undefined));
  const alternarRelacoes = async (tipo: keyof LembreteRelacoes, valor: boolean) => {
    trackEvent("notif_pref", { campo: `rel_${tipo}`, valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return;
    }
    const novo: LembreteRelacoes = { ...relLembrete, [tipo]: { ...relLembrete[tipo], ligado: valor } };
    set(CHAVE_LEMBRETE_RELACOES, novo);
    const leitor: Leitor = (k, fb) => (k === CHAVE_LEMBRETE_RELACOES ? (novo as unknown as typeof fb) : get(k, fb));
    filaRef.current = filaRef.current.then(async () => {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(leitor, prefsRef.current);
      await atualizarEstado();
    });
    await filaRef.current;
  };

  /** Skincare (28/09): chave própria (horários de manhã e de noite escolhidos na
   *  Beleza). Aqui é o interruptor geral: liga/desliga os dois períodos. */
  const skincare = lerLembreteSkincare(get<unknown>(CHAVE_LEMBRETE_SKINCARE, undefined));
  const alternarSkincare = async (valor: boolean) => {
    trackEvent("notif_pref", { campo: "skincare", valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return;
    }
    const novo = { manha: { ...skincare.manha, ligado: valor }, noite: { ...skincare.noite, ligado: valor } };
    set(CHAVE_LEMBRETE_SKINCARE, novo);
    const leitor: Leitor = (k, fb) => (k === CHAVE_LEMBRETE_SKINCARE ? (novo as unknown as typeof fb) : get(k, fb));
    filaRef.current = filaRef.current.then(async () => {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(leitor, prefsRef.current);
      await atualizarEstado();
    });
    await filaRef.current;
  };

  /** Rotina de manhã (17/10, "Rotina pronta em 3 toques"): chave própria. Liga/desliga e muda a hora
   *  (nasce 15 min depois da hora de acordar respondida na Rotina; sem resposta, 07:15). */
  const rotinaManha = lerLembreteRotinaManha(get<unknown>(CHAVE_LEMBRETE_ROTINA_MANHA, undefined));
  const aplicarRotinaManha = async (mudanca: Partial<typeof rotinaManha>, campo: "rotina_manha" | "rotina_manha_hora") => {
    trackEvent("notif_pref", { campo, valor: campo === "rotina_manha" ? !!mudanca.ligado : true });
    if (mudanca.ligado && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return;
    }
    const novo = { ...rotinaManha, ...mudanca };
    set(CHAVE_LEMBRETE_ROTINA_MANHA, novo);
    const leitor: Leitor = (k, fb) => (k === CHAVE_LEMBRETE_ROTINA_MANHA ? (novo as unknown as typeof fb) : get(k, fb));
    filaRef.current = filaRef.current.then(async () => {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(leitor, prefsRef.current);
      await atualizarEstado();
    });
    await filaRef.current;
  };

  /** Cabelo (28/09, Onda 1 da Beleza): chave própria (dia de lavar + véspera). Aqui
   *  liga/desliga o aviso do DIA de lavar; a véspera e os horários mudam na Beleza. */
  const cabelo = lerLembreteCabelo(get<unknown>(CHAVE_LEMBRETE_CABELO, undefined));
  const alternarCabelo = async (valor: boolean) => {
    trackEvent("notif_pref", { campo: "cabelo", valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return;
    }
    const novo = { dia: { ...cabelo.dia, ligado: valor }, vespera: { ...cabelo.vespera, ligado: valor && cabelo.vespera.ligado } };
    set(CHAVE_LEMBRETE_CABELO, novo);
    const leitor: Leitor = (k, fb) => (k === CHAVE_LEMBRETE_CABELO ? (novo as unknown as typeof fb) : get(k, fb));
    filaRef.current = filaRef.current.then(async () => {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(leitor, prefsRef.current);
      await atualizarEstado();
    });
    await filaRef.current;
  };

  /** Cuidados com data (28/09, Onda 1): cada cuidado tem o seu aviso (na Beleza);
   *  aqui é o interruptor geral — liga ou desliga o de todos. */
  const cuidados = cuidadosValidos(get<unknown>(CHAVE_CUIDADOS, []));
  const alternarCuidados = async (valor: boolean) => {
    trackEvent("notif_pref", { campo: "cuidados", valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return;
    }
    const novo = cuidados.map((c) => ({ ...c, avisoLigado: valor }));
    set(CHAVE_CUIDADOS, novo);
    const leitor: Leitor = (k, fb) => (k === CHAVE_CUIDADOS ? (novo as unknown as typeof fb) : get(k, fb));
    filaRef.current = filaRef.current.then(async () => {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(leitor, prefsRef.current);
      await atualizarEstado();
    });
    await filaRef.current;
  };

  /** Validade dos produtos (28/09, Onda 1): 7 dias antes, às 09:00 (chave própria, nasce desligado). */
  const validade = lerLembreteValidade(get<unknown>(CHAVE_LEMBRETE_VALIDADE, undefined));
  const alternarValidade = async (valor: boolean) => {
    trackEvent("notif_pref", { campo: "validade", valor });
    if (valor && permissao === "prompt") {
      const ok = await pedirPermissao();
      setPermissao(ok ? "granted" : "denied");
      if (!ok) return;
    }
    const novo = { ...validade, ligado: valor };
    set(CHAVE_LEMBRETE_VALIDADE, novo);
    const leitor: Leitor = (k, fb) => (k === CHAVE_LEMBRETE_VALIDADE ? (novo as unknown as typeof fb) : get(k, fb));
    filaRef.current = filaRef.current.then(async () => {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(leitor, prefsRef.current);
      await atualizarEstado();
    });
    await filaRef.current;
  };

  const rodapeDe = (tipo: TipoDeLembrete, ligado: boolean, vazio: string) => {
    if (!ligado || !naLoja || !permitido) return undefined;
    const n = agendados[tipo] ?? 0;
    return n > 0 ? `${n} ${n === 1 ? "aviso agendado" : "avisos agendados"}` : vazio;
  };

  /* 29/10 (A6): cada lembrete com o MESMO interruptor/rodapé/horário de antes; o texto longo de antes vai pra folha
     (toque na linha ou na pílula). `curta` é a legenda de 1 linha da lista. */
  const L: Record<IdLembrete, DefLembrete> = {
    contas: {
      titulo: "Conta a vencer", curta: "Na véspera", Icone: Receipt, modulo: "financas",
      descricao: "Um aviso na véspera, com o nome das contas do dia. No máximo um por dia.",
      ligado: p.contas, onChange: (v) => void alternar("contas", v),
      rodape: rodapeDe("contas", p.contas, "Nenhuma conta em aberto pra avisar por enquanto"),
      hora: { tipo: "cheia", hora: p.horaContas, onHora: (h) => void aplicar({ horaContas: h }) },
    },
    retrospectiva: {
      titulo: "Retrospectiva do mês", curta: "Todo dia 1º", Icone: Sparkles, modulo: "core",
      descricao: "Todo dia 1º, seu mês anterior em números — pronto pra compartilhar.",
      ligado: p.retrospectiva, onChange: (v) => void alternar("retrospectiva", v),
      rodape: rodapeDe("retrospectiva", p.retrospectiva, "Agenda no próximo dia 1º"),
    },
    /* 03/10: o Lembrete do dia 2 / 1ª semana (lib/lembrete-dia2). Nasce ligado, vale 7 dias; a hora é a da abertura do
       app (ou a combinada na missão) — por isso não tem horário aqui. */
    primeiraSemana: {
      titulo: "Primeira semana", curta: "1 por dia, nos 7 primeiros dias", Icone: Sparkles, modulo: "core",
      descricao: "Nos 7 primeiros dias, 1 aviso por dia na hora em que você costuma abrir o CORE — com o que te espera hoje. Depois, para sozinho.",
      ligado: p.primeiraSemana, onChange: (v) => void alternarPrimeiraSemana(v),
      rodape: p.primeiraSemana && naLoja && permitido ? rodapeDaPrimeiraSemana() : undefined,
    },
    remedios: {
      titulo: "Remédios e vitaminas", curta: "Na hora de cada dose", Icone: Pill, modulo: "saude",
      descricao: "Na hora que você cadastrou em Saúde, item por item. Já marcou como tomado? O aviso de hoje não vem.",
      ligado: remediosLigado, onChange: (v) => void alternarRemedios(v),
      rodape: rodapeDe("saude", remediosLigado, "Cadastre um remédio com horário em Saúde"),
    },
    consultas: {
      titulo: "Consultas médicas", curta: "Na véspera e 2 h antes", Icone: CalendarClock, modulo: "saude",
      descricao: "Na véspera, às 19h, e 2 horas antes de cada consulta marcada em Saúde (sem horário, só na véspera).",
      ligado: consultasLigado, onChange: (v) => void alternarConsultas(v),
      rodape: rodapeDe("consulta", consultasLigado, "Marque uma consulta com data em Saúde"),
    },
    aniversario: {
      titulo: "Aniversário chegando", rotulo: "Na véspera", curta: "Pra não chegar de surpresa", Icone: Cake, modulo: "relacionamentos",
      descricao: "Na véspera do aniversário de quem está em Relações, na hora que você escolher.",
      ligado: p.aniversario, onChange: (v) => void alternar("aniversario", v),
      rodape: rodapeDe("aniversario", p.aniversario, "Cadastre alguém com data de aniversário em Relações"),
      hora: { tipo: "cheia", hora: p.horaAniversario, onHora: (h) => void aplicar({ horaAniversario: h }) },
    },
    rel_noDia: {
      titulo: "Parabéns no dia", rotulo: "No dia", curta: "Pra mandar os parabéns", Icone: PartyPopper, modulo: "relacionamentos",
      descricao: `No dia do aniversário de quem está em Relações, às ${relLembrete.noDia.hora}, pra mandar os parabéns. O horário muda em Relações → Avisos.`,
      ligado: relLembrete.noDia.ligado, onChange: (v) => void alternarRelacoes("noDia", v),
      rodape: rodapeDe("relacoes", relLembrete.noDia.ligado, "Cadastre alguém com data de aniversário em Relações"),
      hora: { tipo: "fixa", texto: relLembrete.noDia.hora },
    },
    rel_semana: {
      titulo: "Aniversário daqui a uma semana", rotulo: "1 semana antes", curta: "Com as ideias de presente", Icone: Gift, modulo: "relacionamentos",
      descricao: `Sete dias antes, às ${relLembrete.semana.hora}, com as ideias de presente que você guardou em Relações.`,
      ligado: relLembrete.semana.ligado, onChange: (v) => void alternarRelacoes("semana", v),
      rodape: rodapeDe("relacoes", relLembrete.semana.ligado && !relLembrete.noDia.ligado, "Cadastre alguém com data de aniversário em Relações"),
      hora: { tipo: "fixa", texto: relLembrete.semana.hora },
    },
    rel_contato: {
      titulo: "Pra mandar um oi", curta: "Pra quem você quer falar", Icone: Mail, modulo: "relacionamentos",
      descricao: "Pra quem tem “lembrar de falar” na ficha, em Relações. Se a conversa não for anotada, repete de 7 em 7 dias — nunca todo dia.",
      ligado: relLembrete.contato.ligado, onChange: (v) => void alternarRelacoes("contato", v),
      rodape: rodapeDe("relacoes", relLembrete.contato.ligado && !relLembrete.noDia.ligado && !relLembrete.semana.ligado, "Na ficha de alguém em Relações, escolha de quanto em quanto tempo lembrar"),
      hora: { tipo: "fixa", texto: relLembrete.contato.hora },
    },
    compromissos: {
      titulo: "Compromissos", curta: "Na antecedência de cada um", Icone: CalendarClock, modulo: "rotina",
      descricao: "Consulta, reunião, aula: na antecedência que você escolhe em cada compromisso (Rotina → Meu mês).",
      ligado: p.compromissos, onChange: (v) => void alternar("compromissos", v),
      rodape: rodapeDe("compromisso", p.compromissos, "Cadastre um compromisso com hora em Rotina → Meu mês"),
    },
    tarefas: {
      titulo: "Tarefas com horário", curta: "Na hora da tarefa", Icone: AlarmClock, modulo: "rotina",
      descricao: "Na hora que você pôs em cada tarefa de hoje, ou antes, se escolher. Marcou como feita? O aviso não vem.",
      ligado: p.tarefas, onChange: (v) => void alternar("tarefas", v),
      rodape: rodapeDe("tarefa", p.tarefas, "Ponha um horário numa tarefa de hoje (Home ou Rotina)"),
    },
    pet: {
      titulo: "Cuidados do pet", curta: "Vacina, vermífugo, remédio", Icone: PawPrint, modulo: "pet",
      descricao: "No dia da vacina, do vermífugo e do antipulgas (vacina, consulta e banho também antes — você escolhe no Pet), e o remédio do pet na hora de cada dose.",
      ligado: petLigado, onChange: (v) => void alternarPet({ ...prefsPet, cuidados: v, remedios: v }),
      rodape: rodapeDe("pet", petLigado, "Anote a última vacina ou vermífugo em Pet → Saúde"),
      hora: { tipo: "cheia", hora: prefsPet.hora, onHora: (h) => void alternarPet({ ...prefsPet, hora: h }) },
    },
    casa: {
      titulo: "Manutenção da casa", curta: "No dia em que vence", Icone: Wrench, modulo: "casa",
      descricao: "No dia em que uma manutenção de Casa vence, pela frequência que você definiu. O que já venceu avisa uma vez.",
      ligado: p.casa, onChange: (v) => void alternar("casa", v),
      rodape: rodapeDe("casa", p.casa, "Marque uma manutenção como feita em Casa pra ter um prazo"),
      hora: { tipo: "cheia", hora: p.horaCasa, onHora: (h) => void aplicar({ horaCasa: h }) },
    },
    limite: {
      titulo: "Limite do dia", curta: "Quanto dá pra gastar hoje", Icone: Wallet, modulo: "financas",
      descricao: "De manhã, um toque pra ver quanto você pode gastar hoje sem apertar o mês. Se você já abriu Finanças no dia, ele não vem.",
      ligado: p.limite, onChange: (v) => void alternar("limite", v),
      rodape: rodapeDe("limite", p.limite, "Lance uma receita ou um gasto em Finanças pra ter o que calcular"),
      hora: { tipo: "cheia", hora: p.horaLimite, onHora: (h) => void aplicar({ horaLimite: h }) },
    },
    sequencia: {
      titulo: "Sequência", curta: "Só se você não anotou nada", Icone: Flame, modulo: "core",
      descricao: "À noite, só se você ainda não anotou nada no dia — pra sua sequência de dias não cair. Anotou, ele não vem.",
      ligado: p.sequencia, onChange: (v) => void alternar("sequencia", v),
      rodape: rodapeDe("sequencia", p.sequencia, "Anote qualquer coisa hoje pra começar uma sequência"),
      hora: { tipo: "cheia", hora: p.horaSequencia, onHora: (h) => void aplicar({ horaSequencia: h }) },
    },
    skincare: {
      titulo: "Skincare", curta: "Manhã e noite", Icone: Droplets, modulo: "beleza",
      descricao: `De manhã (${skincare.manha.hora}) e à noite (${skincare.noite.hora}), com os passos do dia da sua rotina de pele. Os horários mudam na Beleza.`,
      ligado: algumLigado(skincare), onChange: (v) => void alternarSkincare(v),
      rodape: rodapeDe("beleza", algumLigado(skincare), "Monte sua rotina na Beleza pra ter o que lembrar"),
      hora: { tipo: "fixa", texto: `${skincare.manha.hora} · ${skincare.noite.hora}` },
    },
    cabelo: {
      titulo: "Cabelo", curta: "No dia de lavar", Icone: Sparkles, modulo: "beleza",
      descricao: `No dia de lavar (${cabelo.dia.hora}), com a etapa do cronograma: hidratação, nutrição ou reconstrução. A véspera e o horário mudam na Beleza.`,
      ligado: lembreteCabeloLigado(cabelo), onChange: (v) => void alternarCabelo(v),
      rodape: rodapeDe("cabelo", lembreteCabeloLigado(cabelo), "Monte seu cronograma na Beleza pra ter o que lembrar"),
      hora: { tipo: "fixa", texto: cabelo.dia.hora },
    },
    cuidados: {
      titulo: "Cuidados", curta: "Unha, sobrancelha, depilação", Icone: CalendarClock, modulo: "beleza",
      descricao: "Unha, sobrancelha, depilação: às 09:00, alguns dias antes da próxima vez. Com horário marcado, quem avisa é o compromisso. Os dias mudam em cada cuidado, na Beleza.",
      ligado: algumAvisoDeCuidado(cuidados), onChange: (v) => void alternarCuidados(v),
      rodape: rodapeDe("cuidados", algumAvisoDeCuidado(cuidados), "Marque a última vez de um cuidado na Beleza pra ter o que lembrar"),
      hora: { tipo: "fixa", texto: "09:00" },
    },
    validade: {
      titulo: "Validade dos produtos", curta: `${validade.diasAntes} dias antes de vencer`, Icone: AlarmClock, modulo: "beleza",
      descricao: `${validade.diasAntes} dias antes de um produto de MEUS PRODUTOS vencer (a data impressa ou a de depois de aberto, a que vier primeiro), às ${validade.hora}.`,
      ligado: validade.ligado, onChange: (v) => void alternarValidade(v),
      rodape: rodapeDe("validade", validade.ligado, "Cadastre a validade de um produto na Beleza pra ter o que lembrar"),
      hora: { tipo: "fixa", texto: validade.hora },
    },
    rotina_manha: {
      titulo: "Rotina de manhã", curta: "Os hábitos do dia", Icone: Sunrise, modulo: "rotina",
      descricao: `Todo dia às ${rotinaManha.hora}, com os hábitos do dia. O que você já marcou não entra no aviso.`,
      ligado: rotinaManha.ligado, onChange: (v) => void aplicarRotinaManha({ ligado: v }, "rotina_manha"),
      rodape: rodapeDe("rotinaManha", rotinaManha.ligado, "Crie um hábito na Rotina pra ter o que lembrar"),
      hora: { tipo: "minuto", hora: rotinaManha.hora, rotulo: "Horário do lembrete de manhã", onHora: (hhmm) => void aplicarRotinaManha({ hora: hhmm }, "rotina_manha_hora") },
    },
    rotina: {
      titulo: "Fechamento do dia", curta: "Pra marcar os hábitos", Icone: CalendarCheck, modulo: "rotina",
      descricao: "Um toque à noite pra marcar os hábitos. Se você já marcou, o aviso do dia não vem.",
      ligado: p.rotina, onChange: (v) => void alternar("rotina", v),
      rodape: rodapeDe("rotina", p.rotina, "Tudo marcado por hoje"),
      hora: { tipo: "cheia", hora: p.horaRotina, onHora: (h) => void aplicar({ horaRotina: h }) },
    },
    treino: {
      titulo: "Dia de treino", curta: "Com o treino do dia", Icone: Dumbbell, modulo: "treino",
      descricao: "Só nos dias que você marcou como treino, com o grupo muscular do dia.",
      ligado: p.treino, onChange: (v) => void alternar("treino", v),
      rodape: rodapeDe("treino", p.treino, "Marque seus dias de treino no módulo Treino"),
      hora: { tipo: "cheia", hora: p.horaTreino, onHora: (h) => void aplicar({ horaTreino: h }) },
    },
    leitura: {
      titulo: "Hora de ler", curta: "Segunda, quarta e sexta", Icone: BookOpen, modulo: "biblioteca",
      descricao: "Segunda, quarta e sexta — com quantas páginas faltam pro fim do livro.",
      ligado: p.leitura, onChange: (v) => void alternar("leitura", v),
      rodape: rodapeDe("leitura", p.leitura, "Marque um livro como 'lendo' na Biblioteca"),
      hora: { tipo: "cheia", hora: p.horaLeitura, onHora: (h) => void aplicar({ horaLeitura: h }) },
    },
    dieta: {
      titulo: "Diário da dieta", curta: "Pra fechar o dia", Icone: Salad, modulo: "dieta",
      descricao: "Um toque pra fechar o dia. Se você já preencheu, o aviso não vem.",
      ligado: p.dieta, onChange: (v) => void alternar("dieta", v),
      rodape: rodapeDe("dieta", p.dieta, "Diário de hoje já preenchido"),
      hora: { tipo: "cheia", hora: p.horaDieta, onHora: (h) => void aplicar({ horaDieta: h }) },
    },
  };

  const ligados = IDS_LEMBRETES.filter((id) => L[id].ligado).length;
  const def = folha ? L[folha] : null;

  return (
    <div className="hn he min-h-[100dvh]" data-testid="tela-lembretes" data-suave={SUAVIDADE_HOME_NOVA}>
      <main className="max-w-lg mx-auto px-4 pt-2 pb-[max(1.5rem,var(--app-safe-bottom))]">
        <header className="pt-1">
          <button onClick={voltar} aria-label="Voltar" className="h-9 -ml-1.5 pr-2 flex items-center rounded-lg active:bg-muted/60">
            <ChevronLeft className="w-6 h-6" strokeWidth={2} />
          </button>
          <h1 className="mt-1 text-[26px] leading-[1.15] font-bold tracking-[-0.025em]">Lembretes</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground" data-testid="lembretes-ligados">{ligados} {ligados === 1 ? "ligado" : "ligados"}</p>
        </header>

        {!naLoja && (
          <div className="hn-card mt-4 p-4">
            <p className="text-sm font-semibold">Disponível no aplicativo</p>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              Os lembretes chegam pelo app instalado no celular. Aqui no navegador
              você escolhe as preferências — elas valem assim que você abrir o app.
            </p>
          </div>
        )}

        {/* Só quem foi BLOQUEADO vê o aviso pesado. Quem nunca foi perguntado
            ("prompt") não vê nada — o próprio interruptor pede a permissão. */}
        {naLoja && permissao === "denied" && (
          <div className="mt-4 rounded-[20px] border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <BellOff className="w-4 h-4 shrink-0" /> Notificações bloqueadas
            </p>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
              O Android está bloqueando os avisos do CORE. Para liberar, vá em
              <strong className="text-foreground"> Configurações → Aplicativos → CORE → Notificações</strong> e
              ative. Depois volte aqui.
            </p>
          </div>
        )}

        {/* 08/10 (chamado S23 / Android 14: "o app não me recorda os lembretes"):
            no Android 14 o alarme EXATO nasce desligado pro app, e sem ele o
            sistema entrega o lembrete quando quiser — às vezes só quando a
            pessoa liga a tela. Só aparece com a permissão de avisos já dada e
            o alarme exato negado; o botão abre a tela do sistema. */}
        {naLoja && permitido && alarmeExato === "denied" && (
          <div className="mt-4 rounded-[20px] border border-amber-500/30 bg-amber-500/10 p-4" data-testid="alarme-exato-negado">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AlarmClock className="w-4 h-4 shrink-0" /> Lembretes podem atrasar
            </p>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
              O Android está entregando os avisos do CORE "quando der" — pode ser horas depois,
              ou só quando você ligar a tela. Pra chegarem na hora certa, libere
              <strong className="text-foreground"> Alarmes e lembretes</strong> pro CORE.
            </p>
            <button
              type="button"
              onClick={() => void liberarAlarmeExato()}
              className="mt-3 h-10 w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[.99] transition-transform"
            >
              Liberar na hora certa
            </button>
            <p className="mt-2 text-[11.5px] text-muted-foreground/80 leading-snug">
              Se mesmo assim nada chegar: Configurações → Bateria → o CORE não pode estar em "Suspenso".
            </p>
          </div>
        )}

        <h2 className="px-4 mt-6 mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Essenciais</h2>
        <ul className="hn-card overflow-hidden py-1" data-testid="lembretes-essenciais">
          {ESSENCIAIS.map((id, i) => (
            <LinhaLembrete key={id} id={id} d={L[id]} ultima={i === ESSENCIAIS.length - 1} onAbrir={() => setFolha(id)} />
          ))}
        </ul>

        <h2 className="px-4 mt-6 mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Por módulo</h2>
        <ul className="hn-card overflow-hidden py-1" data-testid="lembretes-por-modulo">
          {GRUPOS.map((g, i) => {
            const itens = itensDoGrupo(g);
            const ultima = i === GRUPOS.length - 1;
            if (itens.length === 1) {
              const id = itens[0];
              return <LinhaLembrete key={g.id} id={id} d={L[id]} ultima={ultima} onAbrir={() => setFolha(id)} grupo={g} />;
            }
            const n = itens.filter((id) => L[id].ligado).length;
            const aberto = abertos.has(g.id);
            return (
              <li key={g.id} data-testid={`grupo-${g.id}`} data-aberto={aberto ? "1" : undefined}>
                <button
                  type="button" aria-expanded={aberto} onClick={() => alternarGrupo(g.id)}
                  className="relative w-full min-h-[62px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-muted/50"
                >
                  <Disco modulo={g.id} Icone={ICONE_DO_GRUPO[g.id] ?? Bell} ativo={n > 0} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-semibold leading-tight truncate">{g.nome}</span>
                    <span className="block mt-0.5 text-[12.5px] text-muted-foreground truncate">{g.legenda}</span>
                  </span>
                  <span className={`shrink-0 text-[13px] ${n ? "font-semibold text-accent" : "text-muted-foreground"}`} data-testid={`grupo-${g.id}-conta`}>
                    {n ? `${n} de ${itens.length}` : "desligados"}
                  </span>
                  <ChevronDown className={`w-[18px] h-[18px] shrink-0 -ml-1 text-muted-foreground/55 transition-transform ${aberto ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden />
                  {!ultima && !aberto && <Fio esquerda={62} />}
                </button>
                {aberto && (
                  <div className="bg-foreground/[0.028] dark:bg-foreground/[0.035] border-y border-foreground/10">
                    {g.blocos.map((b) => (
                      <div key={b.titulo ?? "itens"}>
                        {b.titulo && <p className="px-[23px] pt-3 pb-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{b.titulo}</p>}
                        <ul>
                          {b.itens.map((id, j) => (
                            <LinhaLembrete key={id} id={id} d={L[id]} sub ultima={j === b.itens.length - 1} onAbrir={() => setFolha(id)} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-[11.5px] text-muted-foreground/80 text-center pt-5 px-6 leading-relaxed">
          O CORE não manda propaganda por notificação. Só o que você pediu pra lembrar.
        </p>
      </main>

      <FolhaLembrete
        aberta={!!def}
        onFechar={() => setFolha(null)}
        titulo={def?.titulo ?? ""}
        descricao={def?.descricao ?? ""}
        rodape={def?.rodape}
        icone={def ? <Disco modulo={def.modulo} Icone={def.Icone} ativo={def.ligado} tamanho={40} /> : null}
        controle={def?.hora}
      />
    </div>
  );
};

interface DefLembrete {
  titulo: string;
  /** o nome curto dentro do bloco (Aniversários: "Na véspera", "No dia", "1 semana antes") */
  rotulo?: string;
  curta: string;
  descricao: string;
  Icone: LucideIcon;
  modulo: string;
  ligado: boolean;
  onChange: (v: boolean) => void;
  rodape?: string;
  hora?: ControleDeHora;
}

const ICONE_DO_GRUPO: Record<string, LucideIcon> = {
  financas: Wallet, rotina: Repeat, saude: Pill, relacionamentos: Heart, treino: Dumbbell, biblioteca: BookOpen,
  dieta: Salad, casa: Home, beleza: Droplets, pet: PawPrint, core: Bell,
};

/** A cor do módulo (paleta da Home nova); "core" = o magenta da marca (--accent). */
const corDe = (modulo: string) => (modulo === "core" ? "hsl(var(--accent))" : corDoModulo(modulo));
const tintaDe = (modulo: string) => (modulo === "core" ? "hsl(var(--accent) / 0.12)" : tintaDoModulo(modulo));

const Disco = ({ modulo, Icone, ativo, tamanho = 36 }: { modulo: string; Icone: LucideIcon; ativo: boolean; tamanho?: number }) => (
  <span
    className="grid place-items-center rounded-full shrink-0"
    style={{ width: tamanho, height: tamanho, background: ativo ? tintaDe(modulo) : "hsl(var(--muted))", color: ativo ? corDe(modulo) : "hsl(var(--muted-foreground))" }}
    aria-hidden
  >
    <Icone style={{ width: tamanho / 2, height: tamanho / 2 }} strokeWidth={TRACO} />
  </span>
);

/** O fio entre linhas (meio ponto, começando depois do ícone, como o iOS). */
const Fio = ({ esquerda }: { esquerda: number }) => (
  <span className="pointer-events-none absolute right-0 bottom-0 h-px bg-foreground/[0.12] scale-y-50 origin-bottom" style={{ left: esquerda }} aria-hidden />
);

const textoDaPilula = (h?: ControleDeHora): string | null =>
  !h ? null : h.tipo === "cheia" ? rotuloHora(h.hora) : h.tipo === "minuto" ? h.hora : h.texto;

const LinhaLembrete = ({ id, d, ultima, onAbrir, sub, grupo }: {
  id: IdLembrete; d: DefLembrete; ultima: boolean; onAbrir: () => void;
  /** dentro da sanfona (ícone solto, recuado) */
  sub?: boolean;
  /** módulo de 1 lembrete só: a linha leva o nome do módulo e o lembrete embaixo */
  grupo?: GrupoLembretes;
}) => {
  const pilula = textoDaPilula(d.hora);
  const titulo = grupo ? grupo.nome : sub && d.rotulo ? d.rotulo : d.titulo;
  const legenda = grupo ? d.titulo : d.curta;
  return (
    <li className={`relative flex items-center gap-3 ${sub ? "min-h-[56px] pl-[23px] pr-3.5 py-2" : "min-h-[62px] px-3.5 py-2.5"}`} data-testid={`lembrete-${id}`} data-ligado={d.ligado ? "1" : "0"}>
      <button type="button" onClick={onAbrir} aria-label={`Detalhes: ${d.titulo}`} className="min-w-0 flex-1 flex items-center gap-3 text-left">
        {sub
          ? <d.Icone className="w-[18px] h-[18px] shrink-0" strokeWidth={TRACO} style={{ color: d.ligado ? corDe(d.modulo) : "hsl(var(--muted-foreground))" }} aria-hidden />
          : <Disco modulo={grupo ? grupo.id : d.modulo} Icone={grupo ? ICONE_DO_GRUPO[grupo.id] ?? d.Icone : d.Icone} ativo={d.ligado} />}
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold leading-tight truncate ${sub ? "text-[14.5px]" : "text-[15.5px]"}`}>{titulo}</span>
          <span className="block mt-0.5 text-[12.5px] text-muted-foreground truncate">{legenda}</span>
        </span>
      </button>
      {pilula && (
        <button
          type="button" onClick={onAbrir} aria-label={`Horário: ${d.titulo}, ${pilula}`}
          className={`shrink-0 h-[30px] px-2.5 rounded-full bg-muted text-[13px] font-semibold tabular-nums ${d.ligado ? "text-foreground" : "text-muted-foreground/70"}`}
        >
          {pilula}
        </button>
      )}
      <Switch checked={d.ligado} onCheckedChange={d.onChange} aria-label={d.titulo} />
      {!ultima && <Fio esquerda={sub ? 53 : 62} />}
    </li>
  );
};

export default Notificacoes;
