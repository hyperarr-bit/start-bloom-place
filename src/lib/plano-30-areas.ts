/**
 * OS PLANOS DE 30 DIAS POR ÁREA (21/10) — o MESMO motor do Kit Primeiro Mês (src/lib/kit-primeiro-mes.ts: 1 tarefa
 * por dia, 4 semanas, progresso em `core-kit-primeiro-mes-feitos`), estendido de forma ADITIVA pras áreas da porta
 * do /inicio. Nada do kit original muda: a área Dinheiro É o PLANO_30_DIAS de lá (mesmas tarefas, mesmos destinos);
 * conta sem `area` na compra = Dinheiro (todo kit vendido até hoje).
 *
 * A compra (downsell do presente, oferta pk99) grava `area` em `core-kit-primeiro-mes` = { comprado, em, pedido,
 * origem, area }. Dinheiro: a aba "KIT 30 DIAS" de Finanças (como sempre). As outras áreas: a página /plano-30 (e o
 * item "Plano de 30 dias" no menu da conta) — o destino de cada tarefa abre o módulo de verdade (rota + aba que o
 * módulo já aceita na URL), então a intro do módulo roda na 1ª abertura como em qualquer outra entrada.
 *
 * Regras do conteúdo (dono, 21/10): tarefas de 2–3 minutos, copy calma, nada que o app não faça; cada destino é uma
 * tela que EXISTE (conferido no código: Rotina ?aba=semana|mes|diario|revisao|foco; Saúde ?aba=hoje|evolucao|log;
 * Treino ?aba=hoje|plano|semana|evolucao; Desenvolvimento ?tab=metas|diario|humor|respiracao|gratidao|carta|desafios;
 * Dieta e Casa sem aba na URL (abrem no Cardápio e nos Cômodos); Finanças ?aba= (lido pelo Index desde 21/10)).
 * Testado em src/test/plano-30-areas.test.tsx.
 */
import { PLANO_30_DIAS, SEMANAS_DO_KIT, kitLiberado, type DestinoDoKit } from "@/lib/kit-primeiro-mes";

export type AreaDoPlano = "dinheiro" | "rotina" | "corpo" | "saude" | "metas" | "tudo";
export const AREAS_DO_PLANO: readonly AreaDoPlano[] = ["dinheiro", "rotina", "corpo", "saude", "metas", "tudo"];

/** Pra onde a tarefa leva: a rota do módulo + a aba que ele já lê da URL (sem aba = a aba de entrada do módulo). */
export interface DestinoDoPlano { modulo: "/financas" | "/rotina" | "/saude" | "/treino" | "/dieta" | "/casa" | "/desenvolvimento"; aba?: string; rotulo: string }
export interface TarefaDoPlano { dia: number; titulo: string; como: string; destino: DestinoDoPlano }
export interface PlanoDaArea {
  area: AreaDoPlano;
  /** o nome curto da área ("Rotina") — vai no selo "Começando por …" */
  nome: string;
  emoji: string;
  /** o nome do plano na aba/página */
  titulo: string;
  semanas: { semana: number; titulo: string; dias: readonly [number, number] }[];
  tarefas: TarefaDoPlano[];
  /** o que muda no dia 30 (3 linhas) */
  fim: string[];
}

/** Os parâmetros de aba que cada módulo lê (Desenvolvimento usa `tab`). */
const PARAM_DA_ABA: Record<DestinoDoPlano["modulo"], string | null> = {
  "/financas": "aba", "/rotina": "aba", "/saude": "aba", "/treino": "aba", "/desenvolvimento": "tab", "/dieta": null, "/casa": null,
};
/** As abas que cada módulo aceita na URL (o teste confere com o código dos módulos). */
export const ABAS_NA_URL: Record<DestinoDoPlano["modulo"], readonly string[]> = {
  "/financas": ["dashboard", "financeiro", "investimentos", "itens", "viagem", "simuladores", "limites", "relatorios", "saude"],
  "/rotina": ["semana", "mes", "diario", "revisao", "foco"],
  "/saude": ["hoje", "evolucao", "log"],
  "/treino": ["hoje", "plano", "semana", "evolucao"],
  "/desenvolvimento": ["sobre", "metas", "diario", "humor", "respiracao", "gratidao", "carta", "desafios"],
  "/dieta": [],
  "/casa": [],
};
export const urlDoDestino = (d: DestinoDoPlano): string => {
  const p = PARAM_DA_ABA[d.modulo];
  return p && d.aba ? `${d.modulo}?${p}=${encodeURIComponent(d.aba)}` : d.modulo;
};

/* ───────────────────────── destinos ───────────────────────── */

const fin = (aba: string, rotulo: string): DestinoDoPlano => ({ modulo: "/financas", aba, rotulo });
const R = {
  habitos: { modulo: "/rotina", aba: "semana", rotulo: "Abrir hábitos" },
  tarefas: { modulo: "/rotina", aba: "semana", rotulo: "Abrir tarefas" },
  agenda: { modulo: "/rotina", aba: "semana", rotulo: "Abrir a semana" },
  mes: { modulo: "/rotina", aba: "mes", rotulo: "Abrir o Meu Mês" },
  diario: { modulo: "/rotina", aba: "diario", rotulo: "Abrir o diário" },
  revisao: { modulo: "/rotina", aba: "revisao", rotulo: "Abrir a revisão" },
  foco: { modulo: "/rotina", aba: "foco", rotulo: "Abrir o foco" },
} as const satisfies Record<string, DestinoDoPlano>;
const S = {
  agua: { modulo: "/saude", aba: "hoje", rotulo: "Abrir água" },
  sono: { modulo: "/saude", aba: "hoje", rotulo: "Abrir sono" },
  remedios: { modulo: "/saude", aba: "hoje", rotulo: "Abrir remédios" },
  hoje: { modulo: "/saude", aba: "hoje", rotulo: "Abrir Saúde" },
  evolucao: { modulo: "/saude", aba: "evolucao", rotulo: "Abrir evolução" },
  log: { modulo: "/saude", aba: "log", rotulo: "Abrir log médico" },
} as const satisfies Record<string, DestinoDoPlano>;
const T = {
  plano: { modulo: "/treino", aba: "plano", rotulo: "Abrir o plano" },
  hoje: { modulo: "/treino", aba: "hoje", rotulo: "Abrir o treino de hoje" },
  semana: { modulo: "/treino", aba: "semana", rotulo: "Abrir a semana" },
  evolucao: { modulo: "/treino", aba: "evolucao", rotulo: "Abrir evolução" },
} as const satisfies Record<string, DestinoDoPlano>;
const DIETA: DestinoDoPlano = { modulo: "/dieta", rotulo: "Abrir o cardápio" };
const CASA: DestinoDoPlano = { modulo: "/casa", rotulo: "Abrir os cômodos" };
const D = {
  metas: { modulo: "/desenvolvimento", aba: "metas", rotulo: "Abrir metas" },
  diario: { modulo: "/desenvolvimento", aba: "diario", rotulo: "Abrir o diário" },
  humor: { modulo: "/desenvolvimento", aba: "humor", rotulo: "Abrir humor" },
  respiracao: { modulo: "/desenvolvimento", aba: "respiracao", rotulo: "Abrir respiração" },
  gratidao: { modulo: "/desenvolvimento", aba: "gratidao", rotulo: "Abrir gratidão" },
  carta: { modulo: "/desenvolvimento", aba: "carta", rotulo: "Abrir a carta" },
  desafios: { modulo: "/desenvolvimento", aba: "desafios", rotulo: "Abrir 30 dias" },
} as const satisfies Record<string, DestinoDoPlano>;

const t = (dia: number, titulo: string, como: string, destino: DestinoDoPlano): TarefaDoPlano => ({ dia, titulo, como, destino });
const semanas = (titulos: [string, string, string, string]) =>
  titulos.map((titulo, i) => ({ semana: i + 1, titulo, dias: [[1, 7], [8, 14], [15, 21], [22, 30]][i] as unknown as readonly [number, number] }));

/* ───────────────────────── Dinheiro = o kit de sempre ───────────────────────── */

/** O destino do kit (aba de Finanças) vira rota + aba; o rótulo é o mesmo. */
export const destinoDoKitComoPlano = (d: DestinoDoKit): DestinoDoPlano => fin(d.aba, d.rotulo);
const DINHEIRO: PlanoDaArea = {
  area: "dinheiro", nome: "Dinheiro", emoji: "💰", titulo: "Kit Primeiro Mês Organizado",
  semanas: SEMANAS_DO_KIT.map((s) => ({ semana: s.semana, titulo: s.titulo, dias: s.dias })),
  tarefas: PLANO_30_DIAS.map((x) => ({ dia: x.dia, titulo: x.titulo, como: x.como, destino: destinoDoKitComoPlano(x.destino) })),
  fim: ["Contas e vencimentos no lugar", "1 vazamento cortado e as dívidas em ordem", "A reserva começada"],
};

/* ───────────────────────── Rotina ───────────────────────── */

const ROTINA: PlanoDaArea = {
  area: "rotina", nome: "Rotina", emoji: "📅", titulo: "Plano de 30 dias · Rotina",
  semanas: semanas(["Enxergar a semana", "Tirar o peso da cabeça", "Firmar os hábitos", "Planejar o próximo mês"]),
  tarefas: [
    t(1, "Escolha 2 hábitos pequenos", "Beber água, ler 5 páginas, alongar. Coloque os dois em Hábitos.", R.habitos),
    t(2, "Marque os hábitos de hoje", "Fez? Toque no quadradinho. Não fez? Amanhã tem de novo.", R.habitos),
    t(3, "Passe as tarefas da cabeça pro CORE", "Tudo o que está ocupando a sua cabeça vira uma tarefa de hoje.", R.tarefas),
    t(4, "Coloque os horários fixos na semana", "Trabalho, aula, academia: o que se repete toda semana.", R.agenda),
    t(5, "Marque os hábitos de hoje", "Leva 10 segundos. A sequência começa aqui.", R.habitos),
    t(6, "Escreva 3 linhas no diário", "Como foi o dia, sem caprichar.", R.diario),
    t(7, "Revisão da semana", "O que funcionou e o que ficou pra trás. Sem cobrança.", R.revisao),
    t(8, "Escolha as 3 tarefas mais importantes", "Só três. O resto pode esperar.", R.tarefas),
    t(9, "Marque os hábitos de hoje", "Um quadradinho de cada vez.", R.habitos),
    t(10, "Faça 1 bloco de foco", "25 minutos numa coisa só. O cronômetro conta pra você.", R.foco),
    t(11, "Tire da lista o que não vai fazer", "Apagar também é organizar.", R.tarefas),
    t(12, "Coloque as datas do mês no Meu Mês", "Aniversários, consultas, entregas.", R.mes),
    t(13, "Marque os hábitos de hoje", "Já virou costume? Ótimo.", R.habitos),
    t(14, "Revisão da semana", "Compare com a semana passada.", R.revisao),
    t(15, "Ajuste os hábitos", "Ficou pesado? Troque por uma versão menor.", R.habitos),
    t(16, "Anote como você dormiu", "Horas de sono de ontem, na semana.", R.agenda),
    t(17, "Faça 1 bloco de foco", "A tarefa que você mais anda adiando.", R.foco),
    t(18, "Marque os hábitos de hoje", "Mesmo que seja só um.", R.habitos),
    t(19, "Escreva o que te deu energia", "Uma ou duas linhas no diário.", R.diario),
    t(20, "Deixe 1 tarefa pronta pra amanhã", "Você acorda já sabendo por onde começar.", R.tarefas),
    t(21, "Revisão da semana", "Quantos dias de hábito? Olhe sem julgar.", R.revisao),
    t(22, "Escolha 1 meta pro mês que vem", "Uma só, pequena e clara.", R.mes),
    t(23, "Coloque os compromissos do mês que vem", "O que já está marcado vai pro Meu Mês.", R.mes),
    t(24, "Marque os hábitos de hoje", "Falta pouco pro mês fechar.", R.habitos),
    t(25, "Escolha o hábito que continua", "O que mais fez diferença fica.", R.habitos),
    t(26, "Faça 1 bloco de foco", "25 minutos, uma tarefa.", R.foco),
    t(27, "Escreva 1 coisa que mudou", "No diário, do seu jeito.", R.diario),
    t(28, "Marque os hábitos de hoje", "Quase lá.", R.habitos),
    t(29, "Revisão do mês", "Veja a semana e o mapa dos hábitos.", R.revisao),
    t(30, "Feche o mês com 2 linhas", "1 coisa que funcionou e 1 que vai mudar.", R.diario),
  ],
  fim: ["2 hábitos que já andam sozinhos", "A cabeça leve: tudo anotado", "O próximo mês planejado"],
};

/* ───────────────────────── Corpo (treino + dieta) ───────────────────────── */

const CORPO: PlanoDaArea = {
  area: "corpo", nome: "Treino e dieta", emoji: "💪", titulo: "Plano de 30 dias · Corpo",
  semanas: semanas(["Montar o plano", "Pegar o ritmo", "Comer melhor", "Ver a evolução"]),
  tarefas: [
    t(1, "Escolha um treino pronto", "Nos modelos do Plano. 2 ou 3 dias por semana já é ótimo.", T.plano),
    t(2, "Acerte os dias do treino", "Cada treino num dia que cabe na sua semana.", T.plano),
    t(3, "Faça o treino de hoje e marque", "Do jeito que der. Marcar já conta.", T.hoje),
    t(4, "Anote o seu peso de hoje", "É o ponto de partida, sem julgamento.", S.evolucao),
    t(5, "Veja a sua semana de treinos", "Quais dias já foram e quais faltam.", T.semana),
    t(6, "Faça o treino de hoje e marque", "Um treino de cada vez.", T.hoje),
    t(7, "Revisão da semana", "Quantos treinos saíram? Ajuste o plano se precisar.", T.semana),
    t(8, "Monte o cardápio de amanhã", "Café, almoço e jantar. Simples.", DIETA),
    t(9, "Faça o treino de hoje e marque", "Já está virando ritmo.", T.hoje),
    t(10, "Monte o café da manhã da semana", "Repetir é permitido.", DIETA),
    t(11, "Faça o treino de hoje e marque", "Anote a carga que usou.", T.hoje),
    t(12, "Monte o almoço da semana", "O que você já gosta de comer.", DIETA),
    t(13, "Beba e marque a água do dia", "Copo por copo.", S.agua),
    t(14, "Revisão da semana", "Treinos e refeições: o que deu certo?", T.semana),
    t(15, "Suba um pouco a carga", "Só no exercício que ficou fácil.", T.hoje),
    t(16, "Faça o treino de hoje e marque", "Metade do caminho.", T.hoje),
    t(17, "Monte o jantar da semana", "Algo rápido pros dias corridos.", DIETA),
    t(18, "Faça o treino de hoje e marque", "Mesmo que seja mais curto.", T.hoje),
    t(19, "Beba e marque a água do dia", "Deixe uma garrafa por perto.", S.agua),
    t(20, "Faça o treino de hoje e marque", "Você já fez mais de 10.", T.hoje),
    t(21, "Revisão da semana", "Veja a semana inteira de treinos.", T.semana),
    t(22, "Anote o seu peso de novo", "Só pra comparar com o dia 4.", S.evolucao),
    t(23, "Faça o treino de hoje e marque", "Reta final.", T.hoje),
    t(24, "Veja a evolução dos treinos", "As cargas e a frequência do mês.", T.evolucao),
    t(25, "Ajuste o cardápio", "Troque o que não funcionou.", DIETA),
    t(26, "Faça o treino de hoje e marque", "Mais um.", T.hoje),
    t(27, "Veja o que subiu de carga", "No gráfico da evolução.", T.evolucao),
    t(28, "Faça o treino de hoje e marque", "Quase lá.", T.hoje),
    t(29, "Monte o plano do mês que vem", "Mantenha o que deu certo.", T.plano),
    t(30, "Feche o mês com 2 linhas", "1 coisa que funcionou e 1 que vai mudar.", D.diario),
  ],
  fim: ["Treinos marcados toda semana", "Um cardápio que cabe na sua rotina", "A evolução no gráfico"],
};

/* ───────────────────────── Saúde ───────────────────────── */

const SAUDE: PlanoDaArea = {
  area: "saude", nome: "Saúde", emoji: "❤️", titulo: "Plano de 30 dias · Saúde",
  semanas: semanas(["Água e sono", "Remédios e vitaminas", "Consultas e exames", "O seu ritmo"]),
  tarefas: [
    t(1, "Defina a sua meta de água", "Quantos copos por dia. Comece pelo que é possível.", S.agua),
    t(2, "Anote como você dormiu", "Horas de sono da noite passada.", S.sono),
    t(3, "Beba e marque a água do dia", "Copo por copo.", S.agua),
    t(4, "Anote o sono de novo", "Repare no horário que você deitou.", S.sono),
    t(5, "Calcule o seu IMC", "Peso e altura. É só um número de partida.", S.hoje),
    t(6, "Beba e marque a água do dia", "Uma garrafa por perto ajuda.", S.agua),
    t(7, "Revisão da semana", "Água e sono: quantos dias deram certo?", S.hoje),
    t(8, "Cadastre os seus remédios", "Nome, dose e horário. O CORE lembra.", S.remedios),
    t(9, "Cadastre as vitaminas", "As que você toma ou quer começar.", S.remedios),
    t(10, "Marque os remédios de hoje", "Tomou? Um toque.", S.remedios),
    t(11, "Preencha o cartão SOS", "Tipo sanguíneo, alergias e um contato de emergência.", S.hoje),
    t(12, "Marque os remédios de hoje", "Já está virando hábito.", S.remedios),
    t(13, "Anote o sono", "Dormiu melhor ou pior que na semana 1?", S.sono),
    t(14, "Revisão da semana", "Algum remédio esquecido? Ajuste o horário.", S.remedios),
    t(15, "Registre a última consulta", "Médico, data e o que foi dito.", S.log),
    t(16, "Anote os exames que você já fez", "Por médico, com a data.", S.log),
    t(17, "Marque o próximo check-up", "O CORE avisa antes do dia.", S.log),
    t(18, "Beba e marque a água do dia", "Metade do caminho.", S.agua),
    t(19, "Registre o seu peso", "Só pra acompanhar.", S.evolucao),
    t(20, "Marque os remédios de hoje", "Um toque.", S.remedios),
    t(21, "Revisão da semana", "Consultas e exames no lugar?", S.log),
    t(22, "Beba e marque a água do dia", "Reta final.", S.agua),
    t(23, "Anote o sono", "Compare com o começo do mês.", S.sono),
    t(24, "Confira o estoque dos remédios", "O que está acabando entra na lista.", S.remedios),
    t(25, "Registre o seu peso de novo", "Compare com o dia 19.", S.evolucao),
    t(26, "Beba e marque a água do dia", "Mais um.", S.agua),
    t(27, "Marque as consultas do mês que vem", "As que estão pendentes.", S.log),
    t(28, "Marque os remédios de hoje", "Quase lá.", S.remedios),
    t(29, "Revisão do mês", "Água, sono e remédios: o que ficou mais fácil?", S.evolucao),
    t(30, "Feche o mês com 2 linhas", "1 coisa que funcionou e 1 que vai mudar.", D.diario),
  ],
  fim: ["Água e sono no ritmo", "Nenhum remédio esquecido", "Exames e consultas em dia"],
};

/* ───────────────────────── Metas ───────────────────────── */

const METAS: PlanoDaArea = {
  area: "metas", nome: "Metas", emoji: "🎯", titulo: "Plano de 30 dias · Metas",
  semanas: semanas(["Escolher a meta", "Quebrar em etapas", "Um pouco todo dia", "Olhar pra trás"]),
  tarefas: [
    t(1, "Escreva 1 meta pros próximos 90 dias", "Uma só. Clara o bastante pra saber quando chegou.", D.metas),
    t(2, "Escreva por que essa meta importa", "Uma frase nas notas da meta. É o que te puxa nos dias difíceis.", D.metas),
    t(3, "Quebre a meta em 3 etapas", "Do primeiro passo ao último.", D.metas),
    t(4, "Escreva 3 linhas no diário", "Como você está começando.", D.diario),
    t(5, "Marque o seu humor de hoje", "Um toque.", D.humor),
    t(6, "Escreva 3 gratidões", "Pequenas valem.", D.gratidao),
    t(7, "Revisão da semana", "Quanto a meta andou? Atualize a etapa.", D.metas),
    t(8, "Faça a 1ª etapa e marque", "Ou só um pedaço, se for grande.", D.metas),
    t(9, "Marque o seu humor", "Repare no que mudou.", D.humor),
    t(10, "Faça 1 minuto de respiração", "Antes de começar algo difícil.", D.respiracao),
    t(11, "Escreva o que travou", "No diário. Travar faz parte.", D.diario),
    t(12, "Atualize a meta", "Marque o que já foi feito.", D.metas),
    t(13, "Escreva 3 gratidões", "Uma delas sobre você.", D.gratidao),
    t(14, "Revisão da semana", "A meta ainda faz sentido? Ajuste se precisar.", D.metas),
    t(15, "Comece um desafio de 30 dias", "Um hábito que ajuda a sua meta.", D.desafios),
    t(16, "Marque o desafio de hoje", "Um toque.", D.desafios),
    t(17, "Marque o seu humor", "Metade do caminho.", D.humor),
    t(18, "Escreva no diário", "O que você aprendeu esta semana.", D.diario),
    t(19, "Faça 1 minuto de respiração", "Pra fechar o dia mais leve.", D.respiracao),
    t(20, "Atualize a meta", "Mais uma etapa?", D.metas),
    t(21, "Revisão da semana", "Veja o que já andou.", D.metas),
    t(22, "Escreva uma carta pra você daqui a 1 ano", "O que você espera ter feito.", D.carta),
    t(23, "Marque o desafio de hoje", "Reta final.", D.desafios),
    t(24, "Escreva 3 gratidões", "Sobre o mês.", D.gratidao),
    t(25, "Atualize a meta", "O que falta pros 90 dias?", D.metas),
    t(26, "Marque o seu humor", "Compare com o começo.", D.humor),
    t(27, "Veja como o humor andou no mês", "Sem julgar, só olhar.", D.humor),
    t(28, "Marque o desafio de hoje", "Quase lá.", D.desafios),
    t(29, "Revisão do mês", "Etapas feitas e o próximo passo.", D.metas),
    t(30, "Feche o mês com 2 linhas", "1 coisa que funcionou e 1 que vai mudar.", D.diario),
  ],
  fim: ["1 meta clara, com prazo", "Etapas andando toda semana", "30 dias de diário e humor"],
};

/* ───────────────────────── Tudo — "30 dias pra vida entrar nos eixos" ───────────────────────── */

const TUDO: PlanoDaArea = {
  area: "tudo", nome: "Tudo", emoji: "✨", titulo: "30 dias pra vida entrar nos eixos",
  semanas: semanas(["Dinheiro", "Rotina", "Casa e corpo", "Metas"]),
  tarefas: [
    t(1, "Liste as contas do mês", "Aluguel, luz, água, internet. Nome, valor e dia que vence.", fin("financeiro", "Abrir contas fixas")),
    t(2, "Anote os gastos de hoje", "Antes de dormir, 1 minuto.", fin("financeiro", "Anotar gastos")),
    t(3, "Defina o seu \"pode gastar por dia\"", "Coloque o que entra no mês. O Painel faz a conta.", fin("financeiro", "Abrir receitas")),
    t(4, "Veja pra onde foi o dinheiro", "No Painel, a categoria que mais pesou.", fin("dashboard", "Abrir o Painel")),
    t(5, "Marque os vencimentos no Meu Mês", "O CORE avisa antes de vencer.", fin("financeiro", "Abrir o Meu Mês")),
    t(6, "Anote os gastos de hoje", "Já virou hábito?", fin("financeiro", "Anotar gastos")),
    t(7, "Revisão da semana", "Quanto do mês já foi e quanto sobra por dia.", fin("dashboard", "Abrir o Painel")),
    t(8, "Escolha 2 hábitos pequenos", "Beber água, ler 5 páginas, alongar.", R.habitos),
    t(9, "Marque os hábitos de hoje", "Um toque em cada.", R.habitos),
    t(10, "Passe as tarefas da cabeça pro CORE", "Tudo vira uma tarefa de hoje.", R.tarefas),
    t(11, "Coloque os horários fixos na semana", "O que se repete toda semana.", R.agenda),
    t(12, "Marque os hábitos de hoje", "Mesmo que seja só um.", R.habitos),
    t(13, "Escreva 3 linhas no diário", "Como foi o dia, sem caprichar.", R.diario),
    t(14, "Revisão da semana", "O que funcionou e o que ficou pra trás.", R.revisao),
    t(15, "Coloque 1 tarefa em cada cômodo", "Uma coisa simples de limpar ou arrumar.", CASA),
    t(16, "Defina a sua meta de água", "Quantos copos por dia.", S.agua),
    t(17, "Escolha um treino pronto", "Nos modelos do Plano. 2 dias por semana já é ótimo.", T.plano),
    t(18, "Faça o treino de hoje e marque", "Do jeito que der.", T.hoje),
    t(19, "Monte o cardápio de amanhã", "Simples, com o que você gosta.", DIETA),
    t(20, "Marque uma tarefa da casa como feita", "Um cômodo de cada vez.", CASA),
    t(21, "Revisão da semana", "Casa, água e treino: o que entrou na rotina?", R.revisao),
    t(22, "Escreva 1 meta pros próximos 90 dias", "Uma só, clara.", D.metas),
    t(23, "Quebre a meta em 3 etapas", "Do primeiro passo ao último.", D.metas),
    t(24, "Marque o seu humor de hoje", "Um toque.", D.humor),
    t(25, "Escolha 1 meta pro mês que vem", "No Meu Mês da Rotina.", R.mes),
    t(26, "Monte os limites do mês que vem", "Um teto pra categoria que mais pesou.", fin("limites", "Abrir limites")),
    t(27, "Escreva 3 gratidões", "Pequenas valem.", D.gratidao),
    t(28, "Atualize a meta", "Marque a etapa que andou.", D.metas),
    t(29, "Revisão do mês", "Nos Relatórios, o total de cada categoria.", fin("relatorios", "Abrir relatórios")),
    t(30, "Feche o mês com 2 linhas", "1 coisa que funcionou e 1 que vai mudar.", D.diario),
  ],
  fim: ["Dinheiro, rotina e casa no lugar", "Hábitos que já andam sozinhos", "1 meta clara pro próximo mês"],
};

export const PLANOS_30: Record<AreaDoPlano, PlanoDaArea> = { dinheiro: DINHEIRO, rotina: ROTINA, corpo: CORPO, saude: SAUDE, metas: METAS, tudo: TUDO };

/** A área do quiz da porta do /inicio (core-funnel-area) → o plano. Sem área (ou "tudo") → Tudo. */
export const areaDoPlano = (a: string | null | undefined): AreaDoPlano =>
  a && (AREAS_DO_PLANO as readonly string[]).includes(a) ? (a as AreaDoPlano) : "tudo";

/** A área da compra gravada em `core-kit-primeiro-mes` (sem `area` = Dinheiro: todo kit vendido antes de 21/10). */
export const areaDoKit = (v: unknown): AreaDoPlano => {
  if (!kitLiberado(v)) return "dinheiro";
  const a = (v as { area?: unknown }).area;
  return typeof a === "string" && (AREAS_DO_PLANO as readonly string[]).includes(a) ? (a as AreaDoPlano) : "dinheiro";
};

export const planoDaArea = (a: AreaDoPlano): PlanoDaArea => PLANOS_30[a];
export const tarefaDoDia = (p: PlanoDaArea, dia: number): TarefaDoPlano => p.tarefas[Math.min(Math.max(dia, 1), p.tarefas.length) - 1];
