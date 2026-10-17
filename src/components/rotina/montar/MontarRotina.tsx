/**
 * "ROTINA PRONTA EM 3 TOQUES" (1.0.16) — a tela. Régua, chave, horários e o que vira dado em lib/montar-rotina.
 *
 * 3 perguntas → "Montando sua rotina…" (~2 s) → a Rotina DE VERDADE já cheia, com o guia do 1º quadradinho:
 *   1. "Que horas você acorda?"           6h / 7h / 8h (1 toque = segue) / Outro (relógio do sistema)
 *   2. "O que não pode faltar no seu dia?" Beber água · Treinar · Estudar · Ler · Meditar · Trabalhar focado ·
 *                                          Dormir cedo (vários) — embaixo, o "Seu dia" se montando ao vivo
 *   3. "Quer um lembrete de manhã?"        Sim (pede a permissão do sistema, como o resto do app) / Agora não
 *   → "Montar minha rotina": grava hábitos + agenda + lembrete na ENTRADA do "Montando" (fechar o app na
 *   animação não perde nada) → a folha sai e o anel abraça o quadradinho de HOJE do 1º hábito, com o post-it
 *   "Sua rotina está pronta. Marca o primeiro quando fizer." Marcou = "Primeiro do dia ✓" (é o registro de
 *   verdade da Rotina: grade + log + heatmap = o dia na sequência; é o que a dose da missão conta).
 *   "Pular" discreto nas perguntas 1 e 2: começa do zero (nada gravado). Tudo o que nasce aqui se edita e se
 *   apaga na Rotina como qualquer outro hábito/célula — é ponto de partida.
 *
 * ── ONDE APARECE (dono, 17/10: "não quero que a pessoa clique em um módulo e apareça um quiz") ──
 *   SÓ na missão do teste — a dose 1 de quem escolheu Rotina como 1ª área. Entrar na Rotina por curiosidade
 *   não abre o quiz (o caminho do módulo existe, `useMontarRotinaNoModulo`, mas a constante
 *   MONTAR_ROTINA_NO_MODULO = false o mantém fechado). Quem cuida da missão liga — nada aqui mexe nela:
 *
 *     import { MontarRotina, deveMostrarMontarRotina, ATRIBUTO_NA_TELA as ATRIBUTO_MONTAR_ROTINA, type ResumoMontarRotina }
 *       from "@/components/rotina/montar/MontarRotina";
 *
 *     const { user } = useAuth(); const { get, isGuest } = useUserData();
 *     if (deveMostrarMontarRotina({ criadoEm: user?.created_at, get, isGuest }))   // chave + conta nova + Rotina vazia + não decidiu
 *       <MontarRotina origem="missao"
 *         onPronto={(r: ResumoMontarRotina) => … r.itens, r.primeiro, r.primeiroMarcado, r.lembrete …}   // dado já está na Rotina
 *         onPular={() => …} />                     // nada gravado: a dose segue pelo caminho de sempre ("criar" → "marcar")
 *     // senão (pulou/fez antes, ou a Rotina já tem dado): a dose segue direto.
 *
 *   Montar dentro da ROTA /rotina (o guia procura a tabela HÁBITOS DIÁRIOS da página de baixo). É uma folha
 *   fixa por cima de tudo (z 200) que começa abaixo da faixa da missão.
 *   · O 1º QUADRADINHO: por padrão a própria tela guia (`guiarPrimeiro`), e `onPronto` só chega depois do guia,
 *     com `primeiroMarcado`. A missão que preferir o anel DELA passa `guiarPrimeiro={false}`: `onPronto` chega
 *     logo depois do "Montando" e `quadradinhoDeHoje(indice)` acha o alvo (a frase do dono está em
 *     TEXTO_DO_GUIA). Marcar grava `rotina-habits-checked` — a chave que a dose já escuta. Criar os hábitos NÃO
 *     é marcar (a missão já trata `rotina-habits` como "criou", não como "fez").
 *   · Enquanto a folha OU o guia estiverem na tela: <html data-montar-rotina="missao|modulo"> (+
 *     data-montar-rotina-fase="folha|guia") — o anel e a festa da missão esperam ele sair.
 *   · No fim: `window` EVENTO_MONTAR_ROTINA_FIM (`detail: { resultado: "pronto" | "pulou", itens }`) — sai na
 *     DECISÃO (pronto = quando grava, na entrada do "Montando"; pulou = no toque).
 *   · Uma tela por vez: a de origem "modulo" cede pra da missão (`onCeder`), como a de Finanças.
 *
 * Fechou o app no meio (sem Pular nem Montar): volta com as respostas, no máximo 1 vez (1 vista por abertura).
 * Eventos: montar_rotina_view {origem, retomou} · _passo {n: 1 acordar | 2 itens | 3 lembrete | 4 pronto, origem}
 *          · _pronto {itens, lembrete, acordar: 6h|7h|8h|outro, origem (+ lembrete_pulado, reaproveitou)}
 *          · _pular {passo, origem} · _primeiro_marcado {origem, guiado, dias} · _guia {acao, achou_alvo, origem}
 *          · _permissao {concedida, origem} (só quando o "Sim" abriu o pedido do sistema).
 *          Nenhum dado pessoal: nem a hora exata, nem nome de hábito.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Bell, Calendar, Check, Clock } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { localDayKey, mesAtualExtenso } from "@/lib/utils";
import { marcarCartoesVistos } from "@/lib/tour-home";
import { armarLembreteDoTesteSePuder, estadoPermissao, pedirPermissao, type EstadoPermissao } from "@/lib/notificacoes";
import { DIAS_DA_ROTINA, marcadosDoDia, nomesDosHabitos } from "@/lib/rotina-habitos";
import { CHAVE_LEMBRETE_ROTINA_MANHA, horaDoLembreteDaManha, textoDaManha } from "@/lib/rotina-manha";
import { Anel } from "@/components/demo-guiada/pecas";
import {
  ATRIBUTO_FASE, CHAVE_MONTAR_ROTINA, EVENTO_MONTAR_ROTINA_ABERTA, EVENTO_MONTAR_ROTINA_FIM, EV_GUIA, EV_PASSO, EV_PERMISSAO, EV_PRIMEIRO,
  EV_PRONTO, EV_PULAR, EV_VIEW, ITENS_DA_ROTINA, OPCOES_ACORDAR, agendaParaGravar, carimbarPrimeiro, guardarRascunhoRotina,
  habitosParaGravar, horaDaAgenda, horaDaResposta, horaDe, horaFalada, horariosDosItens, inicioDaAgenda, itemDe, itensValidos, lerRascunhoRotina,
  linhasDoDia, marcarMontarRotinaDecidido, minutosDe, montarRotinaAbertoPelaMissao, normalizarHora, primeiroDoDia,
  reaproveitarDoOnboarding, registrarTelaAberta, registrarVistaMontarRotina,
  type ItemId, type OpcaoAcordar, type OrigemMontar, type PerguntaDoLembrete, type Resultado,
} from "@/lib/montar-rotina";
import "./montar-rotina.css";

export {
  deveMostrarMontarRotina, montarRotinaAbertoPelaMissao, EVENTO_MONTAR_ROTINA_FIM, ATRIBUTO_NA_TELA, ATRIBUTO_FASE,
} from "@/lib/montar-rotina";

/** O que a tela devolve no fim (sem o "pulou", que não tem resumo). `hora` = a hora de acordar, "HH:MM". */
export interface ResumoMontarRotina {
  itens: number;
  acordar: OpcaoAcordar;
  hora: string;
  lembrete: boolean;
  /** o 1º hábito do dia (a 1ª coluna da tabela) — o "primeiro" do guia */
  primeiro: { id: ItemId; nome: string; hora: string } | null;
  /** marcou um quadradinho de hoje durante o guia (com `guiarPrimeiro={false}`, sempre false) */
  primeiroMarcado: boolean;
}
export interface PropsMontarRotina {
  /** De onde abriu (vai nos eventos): a missão (o caminho de verdade) ou o módulo (desligado, MONTAR_ROTINA_NO_MODULO). */
  origem?: OrigemMontar;
  onPronto?: (r: ResumoMontarRotina) => void;
  onPular?: () => void;
  /** Só a do módulo: a missão abriu a dela — esta some (sem decidir nada). */
  onCeder?: () => void;
  /** A própria tela guia o 1º quadradinho (padrão). false = quem chamou guia (onPronto logo depois do "Montando"). */
  guiarPrimeiro?: boolean;
  /** Só testes/prints: a data "de hoje" (o cabeçalho). */
  agora?: Date;
  /** Só testes/prints: duração do "Montando…" em ms (padrão 2200; 0 = pula a espera). */
  esperaMs?: number;
}

/** A frase do dono, pra quem guiar com o anel próprio (`guiarPrimeiro={false}`). */
export const TEXTO_DO_GUIA = { titulo: "Sua rotina está pronta.", texto: "Marca o primeiro quando fizer." } as const;
/** Quanto o guia fica na tela sem ninguém tocar (depois sai sozinho). */
export const DURACAO_DO_GUIA_MS = 60_000;
/** Quanto o "Primeiro do dia ✓" fica antes do guia sair. */
export const FESTA_DO_PRIMEIRO_MS = 1800;

type Etapa = "acordar" | "itens" | "lembrete" | "montando";
type Fase = "folha" | "guia" | "fim";
const PASSO: Record<Exclude<Etapa, "montando">, number> = { acordar: 1, itens: 2, lembrete: 3 };

/**
 * O quadradinho (a célula) de HOJE do hábito `indice` na tabela HÁBITOS DIÁRIOS da página aberta, ou null.
 * Acha a tabela pelo botão "+ Hábito" do card (`[data-spotlight="add-habit"]`, o mesmo da missão) e a linha
 * pelo nome do dia ("QUINTA"), como a missão faz (demo-guiada/alvos `linhaDeHoje`).
 */
export function quadradinhoDeHoje(indice: number, agora: Date = new Date()): HTMLElement | null {
  const botao = document.querySelector('[data-spotlight="add-habit"]');
  let card: Element | null = botao;
  while (card && !card.querySelector("table")) card = card.parentElement;
  if (!card) return null;
  const hoje = DIAS_DA_ROTINA[(agora.getDay() + 6) % 7];
  const linha = Array.from(card.querySelectorAll("tbody tr")).find((tr) => (tr.querySelector("td")?.textContent ?? "").trim().toUpperCase() === hoje);
  const celula = linha?.children[1 + Math.max(0, indice)] as HTMLElement | undefined;
  // o tamanho quem confere é o anel ao medir (sem tamanho = "âncora invisível" → o post-it fica solto)
  return celula?.isConnected ? celula : null;
}

/**
 * O recorte do anel: do NOME do hábito (o cabeçalho da coluna) até o quadradinho de hoje — o nome fica legível
 * dentro do anel e o quadradinho de hoje é a ponta de baixo, colada no post-it. Sem cabeçalho, só a célula.
 */
export function recorteDaColuna(celula: Element): { top: number; left: number; width: number; height: number; bottom: number } {
  const r = celula.getBoundingClientRect();
  const linha = celula.parentElement;
  const tabela = celula.closest("table");
  const indice = linha ? Array.prototype.indexOf.call(linha.children, celula) : -1;
  const cab = indice >= 0 ? tabela?.querySelector("thead tr")?.children[indice] : null;
  const c = cab?.getBoundingClientRect();
  if (!c || c.width < 8 || c.top > r.top) return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom };
  return { top: c.top, left: Math.min(c.left, r.left), width: Math.max(c.right, r.right) - Math.min(c.left, r.left), height: r.bottom - c.top, bottom: r.bottom };
}

/** Algum hábito marcado HOJE (a mesma regra da tabela: grade desta semana, senão o log por data). */
const algumMarcadoHoje = (get: <T>(k: string, f: T) => T): boolean => {
  const nomes = nomesDosHabitos(get<unknown>("rotina-habits", []));
  if (!nomes.length) return false;
  const hoje = localDayKey();
  const checked = get<unknown>("rotina-habits-checked", {});
  const log = get<unknown>("rotina-habit-log", {});
  return marcadosDoDia({
    nomes,
    checked: (checked && typeof checked === "object" ? checked : {}) as Record<string, boolean[]>,
    semana: String(get<unknown>("rotina-habits-week", "") ?? ""),
    habitLog: (log && typeof log === "object" ? log : {}) as Record<string, string[]>,
    dia: hoje,
    hoje,
  }).some(Boolean);
};

export function MontarRotina({ origem = "modulo", onPronto, onPular, onCeder, guiarPrimeiro = true, agora, esperaMs = 2200 }: PropsMontarRotina) {
  const { get, set } = useUserData();
  const hoje = useMemo(() => agora ?? new Date(), [agora]);
  // fechou o app no meio: volta com o que já tinha respondido; senão, o que o onboarding já sabe
  const [rascunho] = useState(() => lerRascunhoRotina());
  const [onb] = useState(() => reaproveitarDoOnboarding({ get }));
  const [etapa, setEtapa] = useState<Etapa>(rascunho?.etapa ?? "acordar");
  const [opcao, setOpcao] = useState<OpcaoAcordar | null>(rascunho ? rascunho.opcao : onb.opcao);
  const [outro, setOutro] = useState<string>((rascunho ? rascunho.outro : onb.outro) ?? "");
  const [itens, setItens] = useState<ItemId[]>(rascunho ? rascunho.itens : onb.itens);
  const [lembrete, setLembrete] = useState<boolean | null>(rascunho?.lembrete ?? null);
  // a permissão de notificação: a 1ª leitura decide se a 3ª pergunta existe; a viva decide se o "Sim" pede
  const [permissao, setPermissao] = useState<EstadoPermissao | null>(null);
  const [permissaoInicial, setPermissaoInicial] = useState<EstadoPermissao | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const [negouAgora, setNegouAgora] = useState(false);
  const [fase, setFase] = useState<Fase>("folha");
  const [cedeu, setCedeu] = useState(() => origem === "modulo" && montarRotinaAbertoPelaMissao());
  const inicio = useRef(false);
  const resumoRef = useRef<ResumoMontarRotina | null>(null);
  const avancar = useRef<number | null>(null);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; if (avancar.current) window.clearTimeout(avancar.current); }, []);

  const acordar = horaDaResposta(opcao, outro);
  const pergunta: PerguntaDoLembrete = permissaoInicial === "denied" ? "negado" : onb.lembrete === "sem_aviso" ? "sem_aviso" : "perguntar";
  const comPergunta3 = pergunta === "perguntar";
  const total = comPergunta3 ? 3 : 2;
  const escolhidos = useMemo(() => itensValidos(itens), [itens]);
  const linhas = useMemo(() => (acordar ? linhasDoDia(acordar, escolhidos) : []), [acordar, escolhidos]);
  const horaDoAviso = acordar ? horaDoLembreteDaManha(acordar) : null;
  // o 1º aviso: hoje, se a hora dele ainda não passou; senão amanhã
  const avisoAindaHoje = !!horaDoAviso && minutosDe(horaDoAviso) > hoje.getHours() * 60 + hoje.getMinutes();
  const previaDoAviso = useMemo(
    () => (acordar ? textoDaManha(horariosDosItens(acordar, escolhidos).map(({ item }) => item.habito)) : null),
    [acordar, escolhidos],
  );
  const naTela = !cedeu && fase !== "fim";

  useEffect(() => {
    let ok = true;
    estadoPermissao().then((e) => { if (!ok) return; setPermissao(e); setPermissaoInicial((p) => p ?? e); }).catch(() => { /* sem plugin: pergunta */ });
    return () => { ok = false; };
  }, []);
  // a 3ª pergunta saiu (permissão negada no sistema): quem voltou do rascunho nela fica na 2ª, que vira a última
  useEffect(() => { if (!comPergunta3 && etapa === "lembrete") setEtapa("itens"); }, [comPergunta3, etapa]);

  // uma tela por vez: a do módulo cede pra da missão (abriu antes ou depois)
  useEffect(() => {
    if (origem !== "modulo") return;
    const aoAbrir = (e: Event) => { if ((e as CustomEvent<{ origem?: string }>).detail?.origem === "missao") setCedeu(true); };
    window.addEventListener(EVENTO_MONTAR_ROTINA_ABERTA, aoAbrir);
    return () => window.removeEventListener(EVENTO_MONTAR_ROTINA_ABERTA, aoAbrir);
  }, [origem]);
  useEffect(() => { if (cedeu) onCeder?.(); }, [cedeu]); // eslint-disable-line react-hooks/exhaustive-deps

  // na tela (folha ou guia): <html data-montar-rotina="missao|modulo"> + a fase
  useEffect(() => (naTela ? registrarTelaAberta(origem) : undefined), [origem, naTela]);
  useEffect(() => {
    if (!naTela) return;
    try { document.documentElement.setAttribute(ATRIBUTO_FASE, fase); } catch { /* sem document */ }
  }, [naTela, fase]);

  useEffect(() => {
    if (cedeu || inicio.current) return;
    const contar = () => {
      // a do módulo espera 1 volta: se a da missão montou junto (mesmo render), cede sem contar vista
      if (origem === "modulo" && montarRotinaAbertoPelaMissao()) { setCedeu(true); return; }
      inicio.current = true;
      registrarVistaMontarRotina();
      trackEvent(EV_VIEW, { origem, retomou: !!rascunho });
      trackEvent(EV_PASSO, { n: PASSO[etapa === "montando" ? "lembrete" : etapa], origem });
    };
    if (origem !== "modulo") { contar(); return; }
    const t = window.setTimeout(contar, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem, cedeu]);

  // o rascunho acompanha cada resposta (só até virar dado: "Montar" grava e decide)
  useEffect(() => {
    if (cedeu || fase !== "folha" || etapa === "montando") return;
    if (!opcao && !escolhidos.length && lembrete === null) return; // nada respondido: não há o que retomar
    guardarRascunhoRotina({ etapa, opcao, outro: normalizarHora(outro), itens: escolhidos, lembrete });
  }, [cedeu, fase, etapa, opcao, outro, escolhidos, lembrete]);

  const irPara = (e: Etapa) => {
    setEtapa(e);
    if (e === "itens" || e === "lembrete") trackEvent(EV_PASSO, { n: PASSO[e], origem });
  };

  const decidir = (r: Resultado, n: number) => {
    const marca = marcarMontarRotinaDecidido(r, origem);
    set(CHAVE_MONTAR_ROTINA, marca, { system: true });
    try { window.dispatchEvent(new CustomEvent(EVENTO_MONTAR_ROTINA_FIM, { detail: { resultado: r, itens: n } })); } catch { /* sem window */ }
  };

  const pular = () => {
    if (avancar.current) window.clearTimeout(avancar.current);
    trackEvent(EV_PULAR, { passo: PASSO[etapa === "montando" ? "lembrete" : etapa], origem });
    decidir("pulou", 0);
    setFase("fim");
    onPular?.();
  };

  /* ── 1ª pergunta ── */
  const escolherHora = (o: OpcaoAcordar) => {
    setOpcao(o);
    if (avancar.current) window.clearTimeout(avancar.current);
    if (o === "outro") return;
    // 1 toque = a resposta: segue sozinho (o chip marcado aparece antes)
    avancar.current = window.setTimeout(() => { if (vivo.current) irPara("itens"); }, 260);
  };

  /* ── 2ª pergunta ── */
  const alternar = (id: ItemId) => setItens((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  /* ── 3ª pergunta ── */
  const querLembrete = async () => {
    if (pedindo) return;
    setNegouAgora(false);
    // negada no sistema durante o fluxo (a 1ª leitura não era "negada"): o pedido não aparece mais
    if (permissao === "denied") { setLembrete(false); setNegouAgora(true); return; }
    if (permissao === "prompt") {
      setPedindo(true);
      let ok = false;
      try { ok = await pedirPermissao(); } catch { ok = false; }
      if (!vivo.current) return;
      setPedindo(false);
      setPermissao(ok ? "granted" : "denied");
      trackEvent(EV_PERMISSAO, { concedida: ok, origem });
      if (!ok) { setLembrete(false); setNegouAgora(true); return; }
      // quem esperava a permissão pra armar (o lembrete do dia 2, o aviso do teste) arma agora
      try { window.dispatchEvent(new Event("lembrete-dia2:reagendar")); } catch { /* noop */ }
      void armarLembreteDoTesteSePuder().catch(() => { /* nunca segura a tela */ });
    }
    setLembrete(true);
  };

  /** Grava na Rotina (as chaves de sempre) — na ENTRADA do "Montando". */
  const montar = () => {
    if (!acordar || !escolhidos.length) return;
    const escrever = (k: string, v: unknown) => {
      // estrutura = escrita de sistema: não é o dia anotado (o 1º quadradinho é); a Rotina aberta por baixo adota na hora
      set(k, v, { system: true });
      avisarEscritaDeFora(k, v);
    };
    escrever("rotina-habits", habitosParaGravar(acordar, escolhidos, get<unknown>("rotina-habits", [])));
    escrever("rotina-schedule", agendaParaGravar(acordar, escolhidos, get<unknown>("rotina-schedule", undefined)));
    const inicioAtual = get<unknown>("rotina-agenda-inicio", undefined);
    const inicioNovo = inicioAtual ? null : inicioDaAgenda(acordar);
    if (inicioNovo) escrever("rotina-agenda-inicio", inicioNovo);
    const comAviso = comPergunta3 && lembrete === true;
    if (comAviso) escrever(CHAVE_LEMBRETE_ROTINA_MANHA, { ligado: true, hora: horaDoLembreteDaManha(acordar) });
    // a tela substitui as boas-vindas da Rotina (cartões e "Dicas para começar")
    try { marcarCartoesVistos("rotina"); } catch { /* storage bloqueado */ }
    set("core-tip-seen-rotina", "true", { system: true });
    decidir("pronto", escolhidos.length);
    const primeiro = primeiroDoDia(acordar, escolhidos);
    const escolha = opcao ?? "outro";
    resumoRef.current = {
      itens: escolhidos.length, acordar: escolha, hora: acordar, lembrete: comAviso, primeiroMarcado: false,
      primeiro: primeiro ? { id: primeiro.item.id, nome: primeiro.item.habito, hora: horaDe(primeiro.min) } : null,
    };
    const reaproveitou = [
      ...(!rascunho && onb.opcao && onb.opcao === opcao ? ["acordar"] : []),
      ...(!rascunho && onb.itens.length ? ["itens"] : []),
    ];
    trackEvent(EV_PRONTO, {
      itens: escolhidos.length, lembrete: comAviso, acordar: escolha, origem,
      ...(comPergunta3 ? {} : { lembrete_pulado: pergunta }),
      ...(reaproveitou.length ? { reaproveitou } : {}),
    });
    setEtapa("montando");
  };

  const terminar = (marcou: boolean) => {
    setFase("fim");
    const r = resumoRef.current;
    if (r) onPronto?.({ ...r, primeiroMarcado: marcou });
  };

  useEffect(() => {
    if (etapa !== "montando") return;
    const t = window.setTimeout(() => {
      trackEvent(EV_PASSO, { n: 4, origem });
      if (guiarPrimeiro) setFase("guia");
      else terminar(false);
    }, Math.max(0, esperaMs));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, esperaMs]);

  if (!naTela) return null;
  if (fase === "guia") return <GuiaDoPrimeiro origem={origem} primeiro={resumoRef.current?.primeiro ?? null} onFim={terminar} />;

  const barra = (n: number) => (
    <div className="mrt-barra" aria-hidden>{Array.from({ length: total }, (_, i) => <i key={i} {...(i < n ? { "data-on": "" } : {})} />)}</div>
  );
  const voltar = (para: Etapa) => (
    <button type="button" className="mrt-voltar" onClick={() => setEtapa(para)}><ArrowLeft size={14} aria-hidden /><span>Voltar</span></button>
  );
  const nItens = escolhidos.length;

  return (
    <div className="mrt" role="dialog" aria-modal="true" aria-label="Vamos montar sua rotina" data-testid="montar-minha-rotina" data-etapa={etapa}>
      <header className="mrt-cab">
        <Calendar className="mrt-cab-icone" aria-hidden />
        <span className="mrt-cab-nome">ROTINA</span>
        <span className="mrt-cab-mes">{mesAtualExtenso(hoje)}</span>
      </header>
      <div className="mrt-corpo">
        {etapa === "acordar" && (
          <>
            {barra(1)}
            <div className="mrt-q">
              <div className="mrt-kicker">Vamos montar sua rotina · 1 de {total}</div>
              <h2>Que horas você acorda?</h2>
              <p>Seu dia começa daí. Dá pra mudar depois.</p>
            </div>
            <div className="mrt-chips" data-grade="">
              {OPCOES_ACORDAR.map((o) => (
                <button key={o.id} type="button" className="mrt-chip" data-hora="" {...(o.id === "outro" ? { "data-outro": "" } : {})}
                  aria-pressed={opcao === o.id} onClick={() => escolherHora(o.id)}>
                  {o.id === "outro" ? <><Clock size={18} aria-hidden /><span>Outro horário</span></> : o.rotulo}
                </button>
              ))}
            </div>
            {opcao === "outro" && (
              <div className="mrt-folha" data-testid="montar-rotina-outro">
                <div className="mrt-faixa">⏰ Que horas, então?</div>
                <label className="mrt-hora">
                  <input type="time" aria-label="Hora em que você acorda" value={outro} onChange={(e) => setOutro(e.target.value)} />
                  <small>Toca no relógio pra escolher.</small>
                </label>
              </div>
            )}
            <div className="mrt-rodape">
              <button type="button" className="mrt-cta" disabled={!acordar} onClick={() => irPara("itens")}>Continuar</button>
              <button type="button" className="mrt-pular" onClick={pular}>Pular</button>
            </div>
          </>
        )}

        {etapa === "itens" && (
          <>
            {barra(2)}
            <div className="mrt-q">
              <div className="mrt-kicker">2 de {total}{voltar("acordar")}</div>
              <h2>O que não pode faltar no seu dia?</h2>
              <p>Toca em quantos quiser. Cada um entra no seu dia já com um horário.</p>
            </div>
            <div className="mrt-chips">
              {ITENS_DA_ROTINA.map((i) => (
                <button key={i.id} type="button" className="mrt-chip" aria-pressed={escolhidos.includes(i.id)} onClick={() => alternar(i.id)}>
                  <span aria-hidden>{i.emoji}</span><span>{i.chip}</span>
                </button>
              ))}
            </div>
            {acordar && (
              <div className="mrt-folha" data-testid="montar-rotina-previa">
                <div className="mrt-faixa">📅 Seu dia <b>{nItens === 0 ? "" : nItens === 1 ? "1 hábito" : `${nItens} hábitos`}</b></div>
                {linhas.map((l) => (
                  <div key={l.min} className="mrt-linha">
                    <span className="mrt-linha-hora">{horaDaAgenda(l.min)}</span>
                    <span className="mrt-linha-texto">{l.texto}</span>
                    {l.soSemana && <span className="mrt-linha-dias">seg a sex</span>}
                  </div>
                ))}
                {nItens === 0 && (
                  <div className="mrt-linha" data-vazia="">
                    <span className="mrt-linha-hora" />
                    <span className="mrt-linha-texto">Toca nos itens acima e eles entram aqui, cada um no seu horário.</span>
                  </div>
                )}
              </div>
            )}
            <div className="mrt-rodape">
              <button type="button" className="mrt-cta" disabled={nItens === 0} onClick={() => (comPergunta3 ? irPara("lembrete") : montar())}>
                {nItens === 0 ? "Escolhe pelo menos um" : comPergunta3 ? "Continuar" : "Montar minha rotina"}
              </button>
              <button type="button" className="mrt-pular" onClick={pular}>Pular</button>
            </div>
          </>
        )}

        {etapa === "lembrete" && (
          <>
            {barra(3)}
            <div className="mrt-q">
              <div className="mrt-kicker">3 de 3{voltar("itens")}</div>
              <h2>Quer um lembrete de manhã?</h2>
              <p>Um aviso às {horaDoAviso ? horaFalada(minutosDe(horaDoAviso)) : "7h15"} com o que tem no seu dia. Só esse, uma vez por dia.</p>
            </div>
            {previaDoAviso && horaDoAviso && (
              /* o gostinho: o aviso como ele vai chegar (o mesmo texto que a notificação leva) */
              <div className="mrt-aviso" data-testid="montar-rotina-previa-aviso" aria-hidden>
                <span className="mrt-aviso-quando">{avisoAindaHoje ? "Hoje" : "Amanhã"} · <b>{horaFalada(minutosDe(horaDoAviso))}</b></span>
                <strong>{previaDoAviso.title}</strong>
                <span>{previaDoAviso.body}</span>
              </div>
            )}
            <div className="mrt-chips" data-grade="">
              <button type="button" className="mrt-chip" data-escolha="" aria-pressed={lembrete === true} disabled={pedindo} onClick={() => void querLembrete()}>
                <Bell size={18} aria-hidden /><span>Sim, quero</span>
              </button>
              <button type="button" className="mrt-chip" data-escolha="" aria-pressed={lembrete === false} disabled={pedindo}
                onClick={() => { setLembrete(false); setNegouAgora(false); }}>
                Agora não
              </button>
            </div>
            {lembrete === true && horaDoAviso && (
              <p className="mrt-nota" aria-live="polite"><Check size={16} strokeWidth={3} aria-hidden />Combinado: todo dia às {horaFalada(minutosDe(horaDoAviso))}. Dá pra desligar quando quiser.</p>
            )}
            {negouAgora && (
              <p className="mrt-nota" data-aviso="" aria-live="polite">Sem problema. As notificações do CORE estão desligadas neste celular — dá pra ligar depois nos ajustes do aparelho.</p>
            )}
            <div className="mrt-rodape">
              <button type="button" className="mrt-cta" disabled={lembrete === null || pedindo} onClick={montar}>Montar minha rotina</button>
            </div>
          </>
        )}

        {etapa === "montando" && acordar && (
          <div className="mrt-montando" aria-live="polite">
            <div className="mrt-orbe" aria-hidden><div><Calendar size={38} /></div></div>
            <h2>Montando sua rotina…</h2>
            <div className="mrt-passos">
              <div className="mrt-passo" style={{ animationDelay: "150ms" }}><i><Check size={13} strokeWidth={3} /></i>Seu dia começa às {horaFalada(minutosDe(acordar))}</div>
              <div className="mrt-passo" style={{ animationDelay: "600ms" }}><i><Check size={13} strokeWidth={3} /></i>
                {nItens === 1 ? "1 hábito com horário" : `${nItens} hábitos com horário`}
              </div>
              {resumoRef.current?.lembrete && horaDoAviso && (
                <div className="mrt-passo" style={{ animationDelay: "1050ms" }}><i><Check size={13} strokeWidth={3} /></i>Lembrete às {horaFalada(minutosDe(horaDoAviso))}</div>
              )}
              <div className="mrt-passo" data-esperando="" style={{ animationDelay: resumoRef.current?.lembrete ? "1500ms" : "1050ms" }}><i />Organizando sua semana</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "MARCA O PRIMEIRO" — depois do "Montando", em cima da Rotina de verdade: o anel (o da missão, `Anel`,
 * no modo `fixo`: segue o alvo, toque fora só clareia o escuro) abraça o quadradinho de HOJE do 1º hábito,
 * com o post-it do dono. O toque no quadradinho é o toque normal da Rotina — a grade, o log e o heatmap
 * gravam como sempre (o dia entra na sequência); aqui só se escuta. Marcou qualquer hábito HOJE =
 * "Primeiro do dia ✓" (1,8 s) e sai. "Entendi" sai sem marcar (marcar depois também conta: o vigia da
 * Rotina, useVigiaDoPrimeiroMarcado). Sem a tabela na tela (fail-open): o post-it fica solto no alto.
 */
function GuiaDoPrimeiro({ origem, primeiro, onFim }: {
  origem: OrigemMontar;
  primeiro: ResumoMontarRotina["primeiro"];
  onFim: (marcou: boolean) => void;
}) {
  const { get, set } = useUserData();
  const [alvo, setAlvo] = useState<Element | null>(null);
  const [procurando, setProcurando] = useState(true);
  const [feito, setFeito] = useState(false);
  const acabou = useRef(false);
  const achou = useRef(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const fim = (acao: "marcou" | "entendi" | "tempo" | "segundo_plano") => {
    if (acabou.current) return;
    acabou.current = true;
    trackEvent(EV_GUIA, { acao, achou_alvo: achou.current, origem });
    onFim(acao === "marcou");
  };

  // o alvo: a tabela redesenha logo depois da gravação (a Rotina adota o dado no microtask seguinte)
  useEffect(() => {
    const nomes = nomesDosHabitos(get<unknown>("rotina-habits", []));
    const indice = Math.max(0, primeiro ? nomes.findIndex((n) => n.toLowerCase() === primeiro.nome.toLowerCase()) : 0);
    let tentativas = 0;
    const tentar = () => {
      if (acabou.current) return;
      const el = quadradinhoDeHoje(indice);
      if (el) { achou.current = true; setAlvo(el); setProcurando(false); return; }
      if (++tentativas >= 14) { setProcurando(false); return; }
      timers.current.push(window.setTimeout(tentar, 150));
    };
    timers.current.push(window.setTimeout(tentar, 60));
    // sem anel (solto) não há o tempo do anel: o guia sai sozinho do mesmo jeito
    timers.current.push(window.setTimeout(() => fim("tempo"), DURACAO_DO_GUIA_MS + 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // marcou um quadradinho de hoje (pelo toque normal da Rotina)
  const marcou = algumMarcadoHoje(get);
  useEffect(() => {
    if (!marcou || feito || acabou.current) return;
    setFeito(true);
    const marca = carimbarPrimeiro(get);
    if (marca) {
      set(CHAVE_MONTAR_ROTINA, marca, { system: true });
      trackEvent(EV_PRIMEIRO, { origem, guiado: true, dias: 0 });
    }
    timers.current.push(window.setTimeout(() => fim("marcou"), FESTA_DO_PRIMEIRO_MS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcou]);

  const item = primeiro ? itemDe(primeiro.id) : null;
  const diaDeHoje = DIAS_DA_ROTINA[(new Date().getDay() + 6) % 7].toLowerCase();
  const postIt = (
    <div className="mrt-postit" data-testid="montar-rotina-postit" {...(feito ? { "data-feito": "" } : {})}>
      <span className="mrt-postit-fita" aria-hidden />
      <div className="mrt-postit-papel" role="status" aria-live="polite">
        {feito ? (
          <>
            <span className="mrt-postit-rotulo">Feito</span>
            <strong className="mrt-postit-titulo">Primeiro do dia ✓</strong>
            <span className="mrt-postit-texto">Cada dia com um quadradinho marcado conta na sua sequência.</span>
          </>
        ) : (
          <>
            <span className="mrt-postit-rotulo">Pronto</span>
            <strong className="mrt-postit-titulo">{TEXTO_DO_GUIA.titulo}</strong>
            <span className="mrt-postit-texto">{TEXTO_DO_GUIA.texto}</span>
            {primeiro && item && (
              <span className="mrt-postit-item"><span aria-hidden>{item.emoji}</span>{primeiro.nome}<em>· {horaFalada(minutosDe(primeiro.hora))}</em></span>
            )}
            {alvo && <span className="mrt-postit-dica">É o quadradinho de hoje, {diaDeHoje}.</span>}
            <div className="mrt-postit-acoes">
              <button type="button" className="mrt-postit-ok" onClick={() => fim("entendi")}>Entendi</button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (alvo) {
    return (
      <Anel
        fixo interativo abaixo alvo={alvo} recorte={recorteDaColuna} duracao={DURACAO_DO_GUIA_MS} testid="montar-rotina-anel"
        aoSair={(motivo) => {
          // a âncora sumiu (trocou de aba, a tabela redesenhou): o post-it fica, solto
          if (motivo === "ancora_invisivel") { setAlvo(null); return; }
          fim(motivo === "segundo_plano" ? "segundo_plano" : "tempo");
        }}
        balao={postIt}
      />
    );
  }
  if (procurando) return null;
  return createPortal(<div className="mrt-solto" data-testid="montar-rotina-solto"><div>{postIt}</div></div>, document.body);
}
