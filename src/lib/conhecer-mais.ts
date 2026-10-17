/**
 * CONHECER MAIS DO MÓDULO (17/10) — o passeio OPCIONAL de 1 minuto pelas coisas mais usadas que a intro
 * curta não mostra: 3–5 "olhas" (anel + 1 frase natural cada), "Próxima"/"Sair" sempre à vista, nenhuma
 * ação obrigatória; se a parada mora em outra aba, a troca é feita por ela. Finanças, Rotina, Saúde e Treino (17/10).
 *
 * REGRAS DO DONO (17/10):
 *   · nunca automático: a oferta é um controle SECUNDÁRIO (ghost) em cima do "Pronto" do fim da intro,
 *     com o que é e quanto dura ("Ver mais 4 coisas úteis de Finanças · Meu Mês, contas fixas… · 1 min");
 *   · saída clara em toda parada: "Sair" escrito, "2 de 4", "Próxima" (a última: "Terminar");
 *   · sem FOMO: nada de "não perca", bolinha vermelha, selo — tom neutro e útil;
 *   · dose certa: ofertado no fim da intro; se não aceitou, UM lembrete depois (um aviso inline
 *     dispensável na 3ª abertura do módulo) e nunca mais sozinho; acesso permanente pelo botão de
 *     dicas no cabeçalho do módulo (AcessoConhecerMais);
 *   · feito uma vez: a oferta não volta (aparelho + conta).
 *
 * As paradas vêm do uso real (card_interact/card_view, 30 dias, e uso_abas_set2026): Finanças › Meu Mês
 * 48%, Custos fixos (✓ paga) 63%, Total por cartão 45%, Dívidas 41%, Desafio da semana 40% · Rotina ›
 * Rotina semanal, Meu mês, Foco (204 pessoas) · Saúde › Log médico (202), remédios com horário, Evolução,
 * Sono. Cada parada ACHA o card pelo título que está na tela (ou pela âncora data-*), e some sem drama
 * quando o card não existe naquela conta.
 *
 * PONTO DE LIGAÇÃO (missão em doses): a missão pode oferecer o mesmo link no fim de uma dose chamando
 * `abrirConhecerMais(modulo, "fim_dose")` — o ConhecerMaisHost (montado pela IntroDoModulo, que vive nos
 * 3 módulos) escuta o evento e abre o passeio; `ofertaDoTour(modulo)` dá o rótulo e a linha da oferta.
 *
 * Eventos: conhecer_mais_oferta {modulo, origem} · conhecer_mais_abrir {modulo, origem} ·
 * conhecer_mais_parada {modulo, n} · conhecer_mais_sair {modulo, n} · conhecer_mais_fim {modulo, completo}.
 */
import type { Leitor, Escritor } from "@/lib/intro-modulo";

export type ModuloComTour = "financas" | "rotina" | "saude" | "treino";
export type OrigemDoTour = "fim_tutorial" | "lembrete" | "menu" | "fim_dose";

export interface ParadaDoTour {
  id: string;
  /** a aba onde o card mora (pelo rótulo; a parada troca sozinha) */
  aba?: string;
  /** o nome curto da parada — vai na linha da oferta ("Meu Mês, contas fixas…") */
  nome: string;
  titulo: string;
  /** UMA frase natural: o que é e pra que serve */
  texto: string;
  achar: () => Element | null;
}
export interface TourDoModulo { modulo: ModuloComTour; nome: string; paradas: ParadaDoTour[] }

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
};

/** O card cujo TÍTULO (em caixa alta na tela, ou pela CSS) casa com a regex — o mesmo que a pessoa lê. */
const cardPorTitulo = (re: RegExp): Element | null => {
  try {
    for (const el of Array.from(document.querySelectorAll("h2, h3, h4, span, p"))) {
      const t = (el.textContent ?? "").trim();
      if (t.length < 3 || t.length > 60 || !re.test(t)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 6) continue;
      return el.closest("[data-missao], [data-spotlight], section, .rounded-2xl, .rounded-xl, .rounded-lg") ?? el;
    }
  } catch { /* sem DOM */ }
  return null;
};
const porAncora = (seletor: string) => (): Element | null => { try { return document.querySelector(seletor); } catch { return null; } };

export const TOURS: Record<ModuloComTour, TourDoModulo> = {
  financas: {
    modulo: "financas", nome: "Finanças",
    paradas: [
      { id: "meu-mes", aba: "MEU FINANCEIRO", nome: "Meu Mês", titulo: "Meu Mês", texto: "É o calendário do mês: cada dia mostra o que entrou e o que saiu. Toca num dia pra ver só ele.", achar: porAncora('[data-missao="meu-mes"]') },
      { id: "custos-fixos", aba: "MEU FINANCEIRO", nome: "contas fixas", titulo: "Custos fixos", texto: "As contas de todo mês ficam aqui. O ✓ marca como paga neste mês — e o Meu Mês já acompanha.", achar: () => cardPorTitulo(/^CUSTOS FIXOS$/i) },
      { id: "cartao", aba: "MEU FINANCEIRO", nome: "cartão", titulo: "Total por cartão no mês", texto: "Quanto já foi em cada cartão este mês, pra fatura não pegar você de surpresa.", achar: () => cardPorTitulo(/TOTAL POR CART[ÃA]O/i) },
      { id: "dividas", aba: "MEU FINANCEIRO", nome: "dívidas", titulo: "Dívidas e empréstimos", texto: "O que você deve, com parcela e prazo, num lugar só — dá pra ver quando acaba.", achar: () => cardPorTitulo(/^D[ÍI]VIDAS E EMPR[ÉE]STIMOS$/i) },
      { id: "desafio", aba: "DASHBOARD", nome: "desafio da semana", titulo: "Desafio da semana", texto: "Uma meta pequena pra semana, tipo 3 dias sem gastar. Escolhe uma e o app acompanha.", achar: () => cardPorTitulo(/^DESAFIO DA SEMANA$/i) },
    ],
  },
  rotina: {
    modulo: "rotina", nome: "Rotina",
    paradas: [
      { id: "rotina-semanal", aba: "MINHA SEMANA", nome: "rotina semanal", titulo: "Rotina semanal", texto: "Os horários da sua semana, dia a dia. O que é fixo (trabalho, academia, aula) entra aqui uma vez só.", achar: porAncora('[data-spotlight="weekly-schedule"]') },
      { id: "meu-mes", aba: "MEU MÊS", nome: "meu mês", titulo: "Meu mês", texto: "O calendário com os seus compromissos. O que você marca aqui aparece na Home no dia.", achar: () => cardPorTitulo(/^(PR[ÓO]XIMOS COMPROMISSOS|[A-ZÇ]+ \d{4})$/i) },
      { id: "foco", aba: "FOCO", nome: "foco", titulo: "Foco", texto: "Um timer de 25 minutos pra trabalhar sem distração. Dá pra ligar um som quando termina.", achar: () => cardPorTitulo(/^POMODORO/i) },
    ],
  },
  saude: {
    modulo: "saude", nome: "Saúde",
    paradas: [
      { id: "log-medico", aba: "LOG MÉDICO", nome: "log médico", titulo: "Log médico", texto: "Consultas, exames e documentos, com uma pasta por médico. O app avisa da consulta na véspera.", achar: () => cardPorTitulo(/^(Consultas|Marcar Consulta)$/i) },
      { id: "remedios", aba: "HOJE", nome: "remédios", titulo: "Vitaminas e remédios", texto: "Põe o remédio com o horário e marca quando tomar. No celular, o app lembra na hora.", achar: () => cardPorTitulo(/^Vitaminas e Rem[ée]dios$/i) },
      { id: "evolucao", aba: "EVOLUÇÃO", nome: "evolução", titulo: "Evolução", texto: "Peso e medidas ao longo do tempo, num gráfico só. Anota uma vez por semana e vê a linha andar.", achar: () => cardPorTitulo(/^Progresso de Medidas$/i) ?? cardPorTitulo(/^Fotos de Progresso$/i) },
      { id: "sono", aba: "HOJE", nome: "sono", titulo: "Sono", texto: "Quantas horas você dormiu. Junto com a água, conta como foi o seu dia.", achar: () => cardPorTitulo(/^Sono$/i) },
    ],
  },
  /* 17/10 (dono: "Treino podia ter um tutorial tipo Rotina, mais completo"): a intro monta o treino de hoje; o resto do
   * módulo — o plano da semana, a constância e os recordes — fica no passeio opcional. */
  treino: {
    modulo: "treino", nome: "Treino",
    paradas: [
      { id: "plano", aba: "PLANO", nome: "plano da semana", titulo: "Meu plano da semana", texto: "Os 7 dias com os grupos de cada um. Toca num dia pra montar ou trocar os exercícios.", achar: porAncora('[data-testid="plano-semana"]') },
      { id: "modelos", aba: "PLANO", nome: "modelos prontos", titulo: "Modelos prontos", texto: "Um toque monta a semana inteira com 5 exercícios por dia. Séries, repetições e carga você ajusta depois.", achar: porAncora('[data-testid="modelos-prontos"]') },
      { id: "semana", aba: "SEMANA", nome: "constância", titulo: "Semana", texto: "Quantos treinos você fez na semana e a sua sequência. A meta é sua: 3, 4 ou 5 por semana.", achar: porAncora('[data-testid="treino-semana"]') },
      { id: "recordes", aba: "EVOLUÇÃO", nome: "recordes", titulo: "Recordes do mês", texto: "A maior carga de cada exercício, anotada sozinha quando você marca as séries.", achar: porAncora('[data-testid="recordes-do-mes"]') },
    ],
  },
};
export const temTour = (modulo: string): modulo is ModuloComTour => modulo in TOURS;

/** Quantas letras da lista de paradas cabem numa linha só da linha pequena do botão (375 px, 11 px): entra nome por nome; o resto vira "…". */
const LETRAS_DA_LINHA = 32;
/** O rótulo e a linha da oferta (secundária, sem FOMO; dono 17/10 — rótulo numa linha só, a linha pequena dentro do botão):
 *  "Ver mais 5 dicas de Finanças" · "Meu Mês, contas fixas, cartão… · 1 min". */
export function ofertaDoTour(modulo: string): { titulo: string; linha: string } | null {
  if (!temTour(modulo)) return null;
  const t = TOURS[modulo];
  const nomes = t.paradas.map((p) => p.nome);
  const cabem: string[] = [];
  for (const n of nomes) { if (cabem.length && [...cabem, n].join(", ").length > LETRAS_DA_LINHA) break; cabem.push(n); }
  const lista = cabem.length < nomes.length ? `${cabem.join(", ")}…`
    : cabem.length > 1 ? `${cabem.slice(0, -1).join(", ")} e ${cabem[cabem.length - 1]}` : cabem[0];
  const capital = lista.charAt(0).toUpperCase() + lista.slice(1);
  return { titulo: `Ver mais ${t.paradas.length} dicas de ${t.nome}`, linha: `${capital} · 1\u00a0min` };
}

/* ───── marcas (aparelho + conta) ───── */
export const chaveTourFeito = (modulo: string) => `core-conhecer-feito-${modulo}`;
export const chaveLembreteVisto = (modulo: string) => `core-conhecer-lembrete-${modulo}`;
export const chaveAberturas = (modulo: string) => `core-conhecer-aberturas-${modulo}`;
/** 17/10: o passeio do módulo já foi ABERTO neste aparelho (qualquer origem) — a lâmpada do cabeçalho some depois disso. */
export const chaveTourAberto = (modulo: string) => `core-conhecer-aberto-${modulo}`;
/** Na CONTA: a lista de módulos cujo passeio foi feito (vale pro 2º aparelho). */
export const CHAVE_TOURS_FEITOS_CONTA = "core-conhecer-feitos";
/** A 3ª abertura do módulo ganha o lembrete (uma vez). */
export const ABERTURA_DO_LEMBRETE = 3;

export const tourFeito = (modulo: string, get?: Leitor): boolean => {
  if (ls.get(chaveTourFeito(modulo))) return true;
  if (!get) return false;
  const lista = get<unknown>(CHAVE_TOURS_FEITOS_CONTA, []);
  return Array.isArray(lista) && lista.includes(modulo);
};
export const marcarTourFeito = (modulo: string, get?: Leitor, set?: Escritor): void => {
  ls.set(chaveTourFeito(modulo), new Date().toISOString());
  if (!get || !set) return;
  const lista = get<unknown>(CHAVE_TOURS_FEITOS_CONTA, []);
  const arr = Array.isArray(lista) ? (lista as string[]) : [];
  if (!arr.includes(modulo)) set(CHAVE_TOURS_FEITOS_CONTA, [...arr, modulo]);
};
export const tourAberto = (modulo: string): boolean => !!ls.get(chaveTourAberto(modulo));
export const marcarTourAberto = (modulo: string): void => ls.set(chaveTourAberto(modulo), new Date().toISOString());
/**
 * A LÂMPADA DO CABEÇALHO (dono, 17/10: "Dicas podia sair quando usado"): a regra mais simples — aparece até a pessoa
 * USAR o passeio uma vez (abriu, por qualquer caminho: o fim da intro, o lembrete, a própria lâmpada, a missão) ou
 * até ele constar como feito na conta (2º aparelho). Depois disso, some; o lembrete da 3ª abertura continua valendo
 * enquanto o passeio não foi feito, e a oferta no fim da intro também.
 */
export const lampadaVisivel = (modulo: string, get?: Leitor): boolean => temTour(modulo) && !tourAberto(modulo) && !tourFeito(modulo, get);
/** Conta mais uma abertura do módulo neste aparelho e devolve o total. */
export const registrarAbertura = (modulo: string): number => {
  const n = (Number(ls.get(chaveAberturas(modulo))) || 0) + 1;
  ls.set(chaveAberturas(modulo), String(n));
  return n;
};
export const lembreteVisto = (modulo: string): boolean => !!ls.get(chaveLembreteVisto(modulo));
export const marcarLembreteVisto = (modulo: string): void => ls.set(chaveLembreteVisto(modulo), new Date().toISOString());
/** O lembrete é devido nesta abertura? Só na 3ª, só uma vez, só se o passeio não foi feito. */
export const lembreteDevido = (modulo: string, aberturas: number, get?: Leitor): boolean =>
  temTour(modulo) && aberturas === ABERTURA_DO_LEMBRETE && !lembreteVisto(modulo) && !tourFeito(modulo, get);

/* ───── abrir de qualquer lugar ───── */
export const EVENTO_ABRIR_TOUR = "conhecer-mais:abrir";
export interface PedidoDeTour { modulo: ModuloComTour; origem: OrigemDoTour }
/**
 * O passeio ACABOU ("Sair" na faixa ou no balão, "Terminar", ou as paradas acabaram) — a window recebe este evento
 * com quem abriu (`origem`). Quem abriu pelo fim de uma dose (a missão, "fim_dose") devolve a pessoa pro caminho dela
 * (17/10, revisão tela a tela #17: tocar "Conhecer mais" na festa do dia 1 deixava a pessoa em Finanças sem o tour
 * curto e sem o "Plano de amanhã" naquela sessão).
 */
export const EVENTO_FIM_TOUR = "conhecer-mais:fim";
export interface FimDoTour { modulo: ModuloComTour; origem: OrigemDoTour; completo: boolean }
/**
 * Abre o passeio do módulo — pelo fim da intro, pelo lembrete, pelo botão de dicas ou pela missão (fim de uma dose).
 * Dispara um evento na window que o ConhecerMaisHost (montado nos 3 módulos) escuta. Devolve false se o módulo não tem passeio.
 */
export function abrirConhecerMais(modulo: string, origem: OrigemDoTour): boolean {
  if (!temTour(modulo)) return false;
  try { window.dispatchEvent(new CustomEvent<PedidoDeTour>(EVENTO_ABRIR_TOUR, { detail: { modulo, origem } })); } catch { return false; }
  return true;
}
