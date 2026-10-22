import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { modeloPara, montarTreino, type DiasPorSemana, type OndeTreina } from "@/lib/intro-modulo-acoes";
import { SELETOR_PRIMEIRA_SERIE_DE_HOJE } from "@/lib/intro-modulo";
import { abrirAba } from "@/components/cartoes-modulo/registro";
import { EscolhaRapida } from "@/components/ui/escolha-rapida";
import "./intro-modulo.css";

/** 1.0.17: os dias que ELA disse no "+ Outro" (stepper 1–7) → a faixa do modelo que casa. */
export const faixaDosDias = (n: number): DiasPorSemana => (n >= 5 ? "5-6" : n === 4 ? "4" : "2-3");

/**
 * ESCOLHER TREINO — as 2 perguntas que montam a semana (17/10). SÓ roda como a 1ª dose da missão na área
 * "corpo" (quem escolheu Treino no funil) — numa abertura por curiosidade o módulo mostra a tela vazia dele
 * ("Comece com um modelo pronto"), sem quiz (dono: "não quero que a pessoa clique em um módulo e apareça
 * um quiz"). Quem monta isto na tela é a missão (ramo da missão): `<EscolherTreino onPronto={...} />`
 * em cima do módulo Treino, com a conta ainda sem plano.
 *
 *   1. "Onde você treina?"       Academia · Em casa
 *   2. "Quantos dias por semana?" 2–3 · 4 · 5–6
 *   → o modelo EXISTENTE que casa (lib/intro-modulo-acoes.modeloPara: Full Body 3x / Upper-Lower / Push-Pull-
 *     Legs; "em casa" = Full Body com o aviso de trocar os exercícios), gravado pelo mesmo caminho do módulo
 *     (aplicarModelo → saude-workouts-v2 + treino-active-days), a aba HOJE aberta e o 1º exercício aceso por
 *     uns segundos pra ela marcar.
 * Enquanto está na tela marca `<html data-escolher-treino>`: o bloco "Comece com um modelo pronto" do módulo
 * some (intro-modulo.css) e volta quando o quiz sai — pra não ter duas escolhas de modelo na mesma tela.
 *
 * Eventos: modulo_intro_vista {modulo:"treino", formato:"escolha"} · modulo_intro_acao {modulo:"treino",
 * via:"escolha", onde, dias, modelo} · modulo_intro_concluida {modulo:"treino", via:"escolha"} ·
 * modulo_intro_pulou {modulo:"treino", fase:"escolha"}.
 */
export interface ResultadoDaEscolha { onde: OndeTreina; dias: DiasPorSemana; modelo: string }
export const TEMPOS_DA_ESCOLHA = { destaque: 3200, fechar: 700 };

const ONDE: Array<{ id: OndeTreina; emoji: string; rotulo: string }> = [
  { id: "academia", emoji: "🏋️", rotulo: "Academia" },
  { id: "casa", emoji: "🏠", rotulo: "Em casa" },
];
const DIAS: Array<{ id: DiasPorSemana; rotulo: string }> = [
  { id: "2-3", rotulo: "2 a 3 dias" },
  { id: "4", rotulo: "4 dias" },
  { id: "5-6", rotulo: "5 a 6 dias" },
];

/** Acende o 1º exercício de HOJE por uns segundos (o quadradinho de marcar) — o passo que vem depois do quiz.
 *  Num dia de descanso não há exercício: não acende nada (e nunca o "ontem/anteontem" do "Esqueceu?"). */
function acenderPrimeiroExercicio(): void {
  try {
    const alvo = document.querySelector<HTMLElement>(SELETOR_PRIMEIRA_SERIE_DE_HOJE); // 1.0.18: o mesmo seletor da intro do Treino
    if (!alvo) return;
    alvo.scrollIntoView?.({ behavior: "smooth", block: "center" });
    alvo.classList.add("im-destaque");
    window.setTimeout(() => alvo.classList.remove("im-destaque"), TEMPOS_DA_ESCOLHA.destaque);
  } catch { /* sem DOM */ }
}
const DIAS_SEMANA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const NOME_DO_DIA: Record<string, string> = { SEGUNDA: "segunda", TERÇA: "terça", QUARTA: "quarta", QUINTA: "quinta", SEXTA: "sexta", SÁBADO: "sábado", DOMINGO: "domingo" };
/** "O treino de hoje já está aberto…" ou, em dia de descanso no modelo, "o primeiro treino é segunda". */
function fraseDoPronto(diasAtivos: string[], hoje: Date = new Date()): string {
  const idx = (hoje.getDay() + 6) % 7;
  if (diasAtivos.includes(DIAS_SEMANA[idx])) return "O treino de hoje está aberto. Marque o 1º quando fizer.";
  for (let i = 1; i <= 7; i++) { const d = DIAS_SEMANA[(idx + i) % 7]; if (diasAtivos.includes(d)) return `Hoje é descanso. O 1º treino é ${NOME_DO_DIA[d]}.`; }
  return "A semana está montada.";
}

export function EscolherTreino({ onPronto, onPular }: { onPronto: (r: ResultadoDaEscolha) => void; onPular?: () => void }) {
  const { get, set } = useUserData();
  const [onde, setOnde] = useState<OndeTreina | null>(null);
  const [dias, setDias] = useState<DiasPorSemana | null>(null);
  const [pronto, setPronto] = useState<{ nome: string; aviso?: string; frase: string } | null>(null);

  useEffect(() => {
    trackEvent("modulo_intro_vista", { modulo: "treino", formato: "escolha" });
    document.documentElement.setAttribute("data-escolher-treino", "1");
    return () => document.documentElement.removeAttribute("data-escolher-treino");
  }, []);

  const escolherDias = (d: DiasPorSemana) => {
    if (!onde || pronto) return;
    setDias(d);
    const escolha = modeloPara(onde, d);
    const gravar = (k: string, v: unknown) => { set(k, v); avisarEscritaDeFora(k, v); };
    let modelo = escolha.nome, diasAtivos: string[] = [];
    try { ({ nome: modelo, diasAtivos } = montarTreino({ get, gravar }, escolha.nome)); } catch { /* o quiz nunca derruba o módulo */ }
    trackEvent("modulo_intro_acao", { modulo: "treino", via: "escolha", onde, dias: d, modelo });
    setPronto({ nome: modelo, aviso: escolha.aviso, frase: fraseDoPronto(diasAtivos) });
    abrirAba("HOJE");
    window.setTimeout(acenderPrimeiroExercicio, 120);
    trackEvent("modulo_intro_concluida", { modulo: "treino", via: "escolha" });
    window.setTimeout(() => onPronto({ onde, dias: d, modelo }), TEMPOS_DA_ESCOLHA.fechar);
  };

  return (
    <section className="im-vazio im-escolha mb-4" data-testid="escolher-treino" data-camada-guia="intro-modulo" style={{ ["--im-acento" as string]: "#2563eb" }} aria-label="Seu treino em 2 perguntas">
      <div className="im-vazio-faixa" style={{ background: "#DCEBFF", color: "#1e3a8a" }}>
        <span>Seu treino · 2 perguntas</span>
        {onPular && !pronto && <button type="button" className="im-vazio-fechar" data-testid="escolher-treino-pular" onClick={() => { trackEvent("modulo_intro_pulou", { modulo: "treino", fase: "escolha" }); onPular(); }}>Pular</button>}
      </div>
      <div className="im-escolha-corpo">
        {!pronto ? (
          <>
            <p className="im-vazio-pergunta" data-passo="1">Onde você treina?</p>
            <div className="im-vazio-chips" role="group" aria-label="Onde você treina?">
              {ONDE.map((o) => (
                <button key={o.id} type="button" className="im-vazio-chip" data-testid="escolher-onde" data-opcao={o.id} data-feito={onde === o.id ? "1" : undefined} aria-pressed={onde === o.id} onClick={() => setOnde(o.id)}>
                  <span aria-hidden="true">{o.emoji}</span> {o.rotulo}
                </button>
              ))}
            </div>
            <p className="im-vazio-pergunta" data-passo="2" data-esperando={onde ? undefined : "1"}>Quantos dias por semana?</p>
            <div className="im-vazio-chips" role="group" aria-label="Quantos dias por semana?">
              {DIAS.map((d) => (
                <button key={d.id} type="button" className="im-vazio-chip" data-testid="escolher-dias" data-opcao={d.id} data-feito={dias === d.id ? "1" : undefined} aria-pressed={dias === d.id} disabled={!onde} onClick={() => escolherDias(d.id)}>
                  {d.rotulo}
                </button>
              ))}
            </div>
            {/* 1.0.17: "+ Outro" — o número de dias dela num stepper (1 a 7) */}
            <div className="mt-2">
              <EscolhaRapida opcoes={[]} tom="montar" classeChip="im-vazio-chip" testid="escolher-dias-outro" desabilitado={!onde}
                numero={{ min: 1, max: 7, inicial: 3, formatar: (n) => (n === 1 ? "1 dia" : `${n} dias`), rotulo: "Outro" }}
                aoEscolher={(op) => escolherDias(faixaDosDias(op.valor ?? 3))} />
            </div>
          </>
        ) : (
          <div className="im-escolha-pronto" data-testid="escolher-treino-pronto">
            <span className="im-pronto-check"><Check className="w-4 h-4" strokeWidth={3} /></span>
            <div>
              <p className="im-vazio-pergunta">Semana montada: {pronto.nome}</p>
              <p className="im-vazio-detalhe">{pronto.aviso ? `${pronto.aviso} ${pronto.frase}` : pronto.frase}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
