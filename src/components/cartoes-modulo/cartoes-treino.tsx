import { useUserData } from "@/hooks/use-user-data";
import { Miniatura } from "./Miniatura";
import { CHAVE_VALOR, Caixa, MiniLinhas, MiniSemana, SemanaEmCartoes, quadrosMarcar, quadrosValor } from "./blocos";
import { abrirAba } from "./registro";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-blue-100 text-blue-900";
const BOTAO = "bg-blue-600";

const PLANOS: Array<{ nome: string; dias: string[] }> = [
  { nome: "Iniciante 3x", dias: ["Corpo todo", "Descanso", "Corpo todo", "Descanso", "Corpo todo", "Descanso", "Descanso"] },
  { nome: "ABC", dias: ["Pernas", "Peito + tríceps", "Costas + bíceps", "Pernas", "Peito + tríceps", "Costas + bíceps", "Descanso"] },
  { nome: "ABCD", dias: ["Pernas", "Peito", "Costas", "Ombro + abdômen", "Pernas", "Cardio", "Descanso"] },
];
const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

/** O PLANO: toca num modelo e a semana nasce pronta (o quadro troca o modelo aceso). */
const MiniPlano = () => {
  const { get } = useUserData();
  const i = get<number>(CHAVE_VALOR, 0);
  const plano = PLANOS[Math.min(i, PLANOS.length - 1)];
  return (
    <div className="p-3">
      <Caixa titulo="PLANO DA SEMANA" emoji="📋" cor={COR}>
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            {PLANOS.map((p, k) => <span key={p.nome} className={`h-8 px-3 rounded-full text-[11.5px] font-bold grid items-center ${k === i ? `${BOTAO} text-white` : "border border-border"}`}>{p.nome}</span>)}
          </div>
          <SemanaEmCartoes dias={plano.dias.map((t, k) => ({ dia: DIAS[k], texto: t }))} corCheio="border-blue-200 bg-blue-50 text-blue-900" />
        </div>
      </Caixa>
    </div>
  );
};

/** Os 5 cartões do TREINO (azul). Ordem: Plano (N), Hoje, Semana; Evolução, Recordes e Carga pra depois. */
const cartoesTreino = (): ConfigCartoes => ({
  moduleId: "treino",
  classe: "ct-treino",
  nome: "Treino",
  agora: {
    texto: "Escolhe um modelo pronto de treino.",
    botao: "Fazer agora",
    seletor: '[data-testid="plano-semana"], [data-spotlight="add-exercise"], [data-testid="plano-do-dia"]',
    antes: () => abrirAba("PLANO"),
    apoio: "Dois toques e a semana inteira fica montada — você só ajusta.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={190} intervalo={1500} quadros={quadrosValor([0, 1, 2], { x: "44%", y: "28%" })}>
        <MiniPlano />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "Hoje: marca cada série",
      texto: "O treino do dia já vem do plano — toca em cada exercício feito.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={190} intervalo={1200} quadros={quadrosMarcar([[], [0], [0, 1]], [{ x: "8%", y: "32%" }, { x: "8%", y: "32%" }, { x: "8%", y: "52%" }])}>
          <MiniLinhas titulo="HOJE · PERNAS" emoji="🏋️" cor={COR} corBotao={BOTAO} itens={["Agachamento · 3×12", "Leg press · 3×12", "Cadeira extensora · 3×15"]} subtitulos={{ "Agachamento · 3×12": "40 kg", "Leg press · 3×12": "120 kg", "Cadeira extensora · 3×15": "35 kg" }} />
        </Miniatura>
      ),
    },
    {
      titulo: "Semana: os dias feitos",
      texto: "Cada treino marcado vira um dia na semana — e na sua sequência.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={130} intervalo={1200} quadros={quadrosMarcar([[0, 2], [0, 2, 4]], [{ x: "48%", y: "48%" }, { x: "62%", y: "48%" }])}>
          <MiniSemana titulo="SEMANA" emoji="📅" cor={COR} corMarca={BOTAO} linhas={["Treinos"]} rodape="3 de 3 esta semana · meta batida" />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Evolução", "Recordes", "Carga por exercício"] },
});
export default cartoesTreino;
