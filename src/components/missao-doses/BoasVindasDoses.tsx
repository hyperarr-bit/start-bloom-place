import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { Confete } from "@/components/demo-guiada/pecas";
import { trackEvent } from "@/lib/analytics";
import { emSegundos, MODULOS, ORDEM_MODULOS, diaDaSemanaDoPasso, eventoDaMissao, type DiaDaMissao, type EstadoMissaoDoses, type ModuloDaMissao } from "@/lib/missao-doses";
import { EVENTO_TRIAL_CARTAO, diasDoTesteDaLoja } from "@/lib/teste-da-loja";
import { entrada, MOV, MOV_MS, saidaCalmaDe } from "@/lib/movimento";

/** O resumo curto de cada dose na tela 2 do B ("Um gasto, um hábito, um copo d'água"). */
const RESUMO_DA_DOSE: Partial<Record<ModuloDaMissao, string>> = {
  financas: "um gasto", rotina: "um hábito", saude: "um copo d'água", treino: "um exercício", dieta: "uma refeição", desenvolvimento: "uma meta",
  hiperfoco: "um pensamento", estudos: "uma matéria", carreira: "uma tarefa", biblioteca: "um livro", casa: "um item da compra", beleza: "um passo da rotina",
  viagens: "um destino", relacionamentos: "uma pessoa", pet: "o seu pet", detox: "um hábito de detox",
};
import "./missao-doses.css";

type Tres = [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao];

/**
 * "Seus 3 dias grátis começaram" só pra quem está num teste da loja de verdade (revisão pré-build, 17/10): todo mundo
 * que entra na missão via esta tela — também quem pagou no site, assinou o mensal (cobra hoje) ou entrou com o código
 * de 7 dias da App Store. Com teste: os dias dele; sem teste: o acesso, sem número.
 */
export function fraseDoAcesso(diasDeTeste: number | null): string {
  if (!diasDeTeste) return "Seu acesso começou";
  return diasDeTeste === 1 ? "Seu 1 dia grátis começou" : `Seus ${diasDeTeste} dias grátis começaram`;
}
/** 1.0.17 (dono 20/10, a frase dele quase literal): o "Tá dentro" diz que começa um TUTORIAL. */
export const FRASE_DO_TUTORIAL = "Pra você tirar o melhor do CORE, preparamos um tutorial especial pra você.";
/** O que cada dia do plano entrega, em uma linha (o "SEU PLANO DE 3 DIAS" do braço A). Finanças, Rotina e Saúde são as do
 *  mockup aprovado; as outras vêm dos títulos do "olha" de cada módulo (MODULOS[m].olhar). */
export const ENTREGA_DO_MODULO: Record<ModuloDaMissao, string> = {
  financas: "Quanto dá pra gastar por dia", rotina: "Seu primeiro hábito", saude: "Sua meta de água",
  treino: "Seu treino da semana", dieta: "Seu dia na dieta", desenvolvimento: "Sua meta com plano", hiperfoco: "A mente no papel",
  estudos: "Sua grade de estudos", carreira: "Seu dia de trabalho", biblioteca: "Sua estante", casa: "Sua lista da casa",
  beleza: "Sua rotina de beleza", viagens: "Sua lista de destinos", relacionamentos: "As pessoas que importam", pet: "A agenda do pet",
  detox: "Menos tela, mais presença",
};
/** 1.0.17: a sequência da entrada do braço A (segundos) — a tela, depois o ✓, o texto e por último o confete. */
export const ATRASO_DO_CHECK_S = 0.35;
export const ATRASO_DO_TEXTO_S = 0.6;
export const ATRASO_DO_CONFETE_S = 0.95;
/** "Lucas Andrade" → "Lucas"; nunca o começo de um e-mail (a saudação da 1.0.16 caía nele). */
export function primeiroNome(nome: string | null | undefined): string {
  const t = String(nome ?? "").trim();
  if (!t || t.includes("@")) return "";
  const p = t.split(/\s+/)[0] ?? "";
  return p.length > 20 ? "" : p.charAt(0).toUpperCase() + p.slice(1);
}
/** A troca dos módulos (pura): tocar num escolhido tira (a vaga fica aberta, nada volta sozinho); tocar num novo ocupa a
 *  vaga — com 3 já escolhidos, entra no lugar do último. */
export function alternarModulo(atual: readonly ModuloDaMissao[], m: ModuloDaMissao): ModuloDaMissao[] {
  if (atual.includes(m)) return atual.filter((x) => x !== m);
  if (atual.length < 3) return [...atual, m];
  return [atual[0], atual[1], m];
}
const lerDiasDoTeste = (): number | null => { try { return diasDoTesteDaLoja(); } catch { return null; } };
/** Os dias do teste da loja, relidos quando o boot confirma o teste DEPOIS da 1ª tela (revenuecat.conferirTrialCartao). */
function useDiasDoTesteDaLoja(): number | null {
  const [dias, setDias] = useState(lerDiasDoTeste);
  useEffect(() => {
    const reler = () => setDias(lerDiasDoTeste());
    window.addEventListener(EVENTO_TRIAL_CARTAO, reler);
    return () => window.removeEventListener(EVENTO_TRIAL_CARTAO, reler);
  }, []);
  return dias;
}

/**
 * O RODAPÉ COLADO (10/10, regra do dono pro funil inteiro): o botão principal fica
 * grudado embaixo, na MESMA altura e posição das outras telas — pílula preta de
 * 56 px, margem lateral de 24, por cima da safe-area — e a ação secundária é um
 * link de texto logo ACIMA dele. Fora do fluxo que rola: o conteúdo rola, o
 * botão não sai do lugar. Vale pros dois braços (é só posição).
 */
function RodapeColado({ children, tema = false }: { children: ReactNode; tema?: boolean }) {
  return (
    <div className={`shrink-0 px-6 pt-3 backdrop-blur-sm ${tema ? "bg-background/95" : "bg-white/95"}`} style={{ paddingBottom: "calc(var(--app-safe-bottom, 0px) + 24px)" }} data-testid="missao-doses-rodape">
      <div className="max-w-[420px] mx-auto">{children}</div>
    </div>
  );
}

/**
 * BOAS-VINDAS DA MISSÃO EM DOSES (D1) + a escolha dos 3 módulos (D2).
 * Deixa MUITO claro (pedido do dono) que os 3 módulos são SÓ pra missão: o
 * app continua com os 16. A área da porta vem primeiro, e dá pra trocar.
 * Saída sem atrito: "Explorar por conta própria" — a missão continua no card.
 *
 * 10/10 — BRAÇO B (chave DIA1_CHEIO, `braco="B"`): as 3 doses são de HOJE, então a
 * copy muda — "3 toques hoje, uns 20 segundos cada", Dose 1/2/3 (a 1ª acesa, as
 * outras "depois"), barra "0 de 3 hoje", "Começar a dose 1 · 20 s". Sem `braco`
 * (chave desligada, braço A) a tela é a de hoje, byte a byte — só a POSIÇÃO do
 * botão principal e do link mudou (RodapeColado), nos dois braços.
 */
export function BoasVindasDoses({ missao, nome, areaNome, hoje, aoComecar, aoExplorar, braco = null }: {
  missao: EstadoMissaoDoses;
  nome: string;
  /** o nome da área escolhida na porta (ex.: "Dinheiro"), se houver */
  areaNome: string | null;
  hoje: string;
  aoComecar: (modulos: Tres) => void;
  aoExplorar: (modulos: Tres) => void;
  /** "B" = dia 1 cheio (3 doses hoje); null = a missão de hoje (1 por dia) */
  braco?: "A" | "B" | null;
}) {
  const [tela, setTela] = useState<"boas" | "escolha">("boas");
  /* 1.0.17 QA (dono: "nenhum corte seco"): Tá dentro ⇄ "Escolha 3 módulos" trocavam num quadro. Agora a tela que sai some
     devagar por cima (cópia visual, MOV_MS.base) e a que entra já está parada embaixo — uma coisa se mexe por vez. Na volta
     da escolha o Tá dentro NÃO refaz a entrada (✓ → texto → confete): ele já foi visto. */
  const jaEntrou = useRef(false);
  const trocarDeTela = (para: "boas" | "escolha") => {
    saidaCalmaDe(para === "escolha" ? '[data-testid="missao-doses-boas-vindas"]' : '[data-testid="missao-doses-escolha"]', MOV_MS.base + 40);
    if (para === "escolha") jaEntrou.current = true;
    setTela(para);
  };
  /** braço B: 1 = "Tá dentro!", 2 = as doses (a escolha dos 3 volta pra 2) */
  const [telaB, setTelaB] = useState<1 | 2>(1);
  useEffect(() => {
    if (braco === "B") trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "view", tela: telaB }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telaB]);
  /* 1.0.16 (revisão pré-build): o braço A (uma tela só) também diz que VIU — 1 por montagem, ou seja, por abertura em
     que a tela apareceu (voltar da escolha dos módulos não conta de novo). O funil A×B precisa do "viu" e o alarme de
     telas que voltam (telas-repetidas) só enxerga a tela repetida com ele. O braço vem do eventoDaMissao. */
  useEffect(() => {
    if (braco === "A") trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "view", tela: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const reduzir = !!useReducedMotion();
  const diasDeTeste = useDiasDoTesteDaLoja();
  const acesso = fraseDoAcesso(diasDeTeste); // "Seus 3 dias grátis começaram" / "Seu acesso começou"
  const [modulos, setModulos] = useState<Tres>(missao.modulos);
  const [t0] = useState(() => Date.now());
  const B = braco === "B";

  /* "Trocar" (1.0.17, bug da 1.0.16: tirar Finanças/Rotina/Saúde não tirava — a reposição era o 1º padrão que faltava,
     o mesmo que acabou de sair; e todo toque novo trocava o 3º — uma pessoa tocou 57 vezes). Agora a escolha tem a lista
     DELA (`escolhidos`): tirar deixa a vaga aberta (pode ficar com 2 enquanto escolhe), o próximo toque ocupa a vaga, e só
     com 3 já escolhidos o novo entra no lugar do último. "Pronto" só com 3. */
  const [escolhidos, setEscolhidos] = useState<ModuloDaMissao[]>(missao.modulos);
  const alternar = (m: ModuloDaMissao) => setEscolhidos((atual) => alternarModulo(atual, m));

  const linhas = ([1, 2, 3] as DiaDaMissao[]).map((n) => {
    const cfg = MODULOS[modulos[n - 1]];
    const quando = B ? `Dose ${n}` : n === 1 ? "Hoje" : n === 2 ? "Amanhã" : diaDaSemanaDoPasso(n, missao, hoje);
    return { n, cfg, quando };
  });
  // a pílula da linha: A = Hoje / Dia N; B = Agora / depois
  const pill = (n: DiaDaMissao) => (B ? (n === 1 ? "Agora" : "depois") : n === 1 ? "Hoje" : `Dia ${n}`);

  if (tela === "escolha") {
    const linhasDaEscolha = ([1, 2, 3] as DiaDaMissao[]).map((n) => ({
      n, cfg: escolhidos[n - 1] ? MODULOS[escolhidos[n - 1]] : null,
      quando: B ? `Dose ${n}` : n === 1 ? "Hoje" : n === 2 ? "Amanhã" : diaDaSemanaDoPasso(n, missao, hoje),
    }));
    return (
      <div className="fixed inset-0 z-[240] flex flex-col bg-background text-foreground" data-camada-guia="missao-doses-escolha" data-testid="missao-doses-escolha" style={{ paddingTop: "var(--app-safe-top)" }}>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[420px] mx-auto flex flex-col px-5 pt-6 pb-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{B ? "Sua missão de hoje" : "Seu plano"}</p>
            <h1 className="text-[26px] font-black tracking-[-0.03em] leading-[1.1] mt-1">{B ? "Escolhe 3 módulos — 3 doses hoje" : "Escolha 3 módulos"}</h1>
            <p className="text-[14px] text-muted-foreground mt-2 leading-snug">
              {B ? <><b className="text-foreground">Os outros 13 continuam liberados.</b> Isso só decide onde a gente te guia hoje — o app inteiro é seu desde já.</> : "Um por dia. Os outros continuam abertos."}
            </p>
            <div className="grid grid-cols-4 gap-3 mt-5" role="group" aria-label="Módulos da missão">
              {ORDEM_MODULOS.map((m) => {
                const cfg = MODULOS[m];
                const pos = escolhidos.indexOf(m);
                return (
                  <button key={m} type="button" className="md-tile" style={{ background: cfg.cor }} data-marcado={pos >= 0 ? "" : undefined} data-modulo={m} data-testid={`missao-doses-tile-${m}`} onClick={() => alternar(m)} aria-pressed={pos >= 0}>
                    {pos >= 0 && <span className="md-tile-n" aria-label={`${pos + 1}º`}>{pos + 1}</span>}
                    <span className="md-tile-emoji" aria-hidden>{cfg.emoji}</span>
                    <span>{cfg.nome}</span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-2xl border border-border bg-card mt-5 divide-y divide-border" data-testid="missao-doses-escolha-lista">
              {linhasDaEscolha.map(({ n, cfg, quando }) => (
                <div key={n} className="md-linha" data-vaga={cfg ? undefined : ""}>
                  <span className="w-6 h-6 rounded-md grid place-items-center text-[12px] font-extrabold text-white shrink-0" style={{ background: "#16121c" }}>{n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="md-linha-rotulo">{quando}</span>
                    <span className="md-linha-texto">{cfg ? <>{cfg.emoji} {cfg.nome} · {cfg.pedido.toLowerCase()}</> : <span className="text-muted-foreground">Toque num módulo</span>}</span>
                  </span>
                  <span className="md-pill" data-tom={n === 1 ? "hoje" : "dia"}>{pill(n)}</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground text-center mt-3">{B ? "Toca num módulo pra trocar. O 1º é a dose 1." : "O primeiro é o de hoje."}</p>
          </div>
        </div>
        <RodapeColado>
          <button type="button" className="md-botao md-botao-56" data-testid="missao-doses-pronto" disabled={escolhidos.length !== 3}
            onClick={() => { if (escolhidos.length !== 3) return; setModulos(escolhidos as Tres); trocarDeTela("boas"); setTelaB(2); }}>
            {B ? <>Pronto, começar <ArrowRight className="w-4 h-4" /></> : "Pronto"}
          </button>
        </RodapeColado>
      </div>
    );
  }

  /* ── BRAÇO B (10/10, dono: "muita informação, copy muito IA") — DUAS telas curtas ──
     1) a comemoração por ter entrado; 2) as 3 doses, só o essencial. Nada de barra, "4 passos", "13 módulos". */
  if (B && telaB === 1) {
    return (
      <div className="fixed inset-0 z-[240] flex flex-col text-[#16121c]" data-camada-guia="missao-doses-boas-vindas" data-testid="missao-doses-boas-vindas" data-braco="B" data-tela="1" style={{ background: "linear-gradient(180deg,#eaf5fd 0%,#ffffff 55%)", paddingTop: "var(--app-safe-top)" }}>
        <Confete />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[420px] mx-auto flex flex-col items-center px-6 pt-[18vh] text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 17, delay: 0.1 }} className="w-20 h-20 rounded-full bg-emerald-500 grid place-items-center mb-5 shadow-[0_16px_32px_-10px_rgba(16,185,129,.55)]">
              <Check className="w-10 h-10 text-white" strokeWidth={3.5} />
            </motion.div>
            <h1 className="text-[32px] font-black tracking-[-0.03em] leading-[1.05]">Tá dentro! 🎉</h1>
            <p className="text-[16px] text-[#4f5a64] mt-3 leading-snug" data-testid="missao-doses-subtitulo">{acesso} agora. Dá pra usar tudo.</p>
          </div>
        </div>
        <RodapeColado>
          <button type="button" className="md-botao md-botao-56" data-testid="missao-doses-vamos-la" onClick={() => { trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "vamos_la", tela: 1 })); setTelaB(2); }}>
            Vamos lá <ArrowRight className="w-4 h-4" />
          </button>
        </RodapeColado>
      </div>
    );
  }
  if (B) {
    const dose = (m: ModuloDaMissao) => {
      const cfg = MODULOS[m];
      const pedido = m === "rotina" ? "cria 1 hábito e marca" : cfg.pedido.charAt(0).toLowerCase() + cfg.pedido.slice(1);
      return `${cfg.emoji} ${cfg.nome} · ${pedido}`;
    };
    const resumo = modulos.map((m) => RESUMO_DA_DOSE[m] ?? MODULOS[m].toque).join(", ");
    return (
      <div className="fixed inset-0 z-[240] flex flex-col text-[#16121c]" data-camada-guia="missao-doses-boas-vindas" data-testid="missao-doses-boas-vindas" data-braco="B" data-tela="2" style={{ background: "linear-gradient(180deg,#eaf5fd 0%,#ffffff 55%)", paddingTop: "var(--app-safe-top)" }}>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[420px] mx-auto flex flex-col px-6 pt-[10vh]">
            <h1 className="text-[30px] font-black tracking-[-0.03em] leading-[1.08]">Hoje é só 3 toques.</h1>
            <p className="text-[15.5px] text-[#4f5a64] mt-2.5 leading-snug" data-testid="missao-doses-subtitulo">{resumo.charAt(0).toUpperCase() + resumo.slice(1)}. Uns 20 segundos cada.</p>
            <div className="mt-6 flex items-baseline justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#4f5a64]">Hoje</span>
              <button type="button" className="text-[12px] font-bold" style={{ color: "hsl(var(--accent))" }} data-testid="missao-doses-trocar" onClick={() => { setEscolhidos(modulos); trocarDeTela("escolha"); }}>Trocar os 3</button>
            </div>
            <div className="mt-2 rounded-2xl bg-white border border-black/[0.06] shadow-[0_18px_40px_-20px_rgba(20,60,110,.3)] divide-y divide-black/[0.06]" data-testid="missao-doses-linhas">
              {modulos.map((m, i) => (
                <div key={m} className="md-linha" data-testid={`missao-doses-linha-${i + 1}`}>
                  <Quadradinho marcado={false} tam={18} />
                  <span className="md-linha-texto">{dose(m)}</span>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] text-[#4f5a64] mt-3" data-testid="missao-doses-depois">Depois a gente arruma sua Home junto.</p>
          </div>
        </div>
        {/* dono 10/10: o link fica ABAIXO do botão (como a welcome) — link em cima do botão "não faz sentido" */}
        <RodapeColado>
          <button type="button" className="md-botao md-botao-56" data-testid="missao-doses-comecar" onClick={() => aoComecar(modulos)}>
            Começar <ArrowRight className="w-4 h-4" />
          </button>
          <button type="button" className="md-link mt-1" data-testid="missao-doses-explorar" onClick={() => aoExplorar(modulos)} data-segundos={Math.round((Date.now() - t0) / 1000)}>
            Explorar por conta própria
          </button>
        </RodapeColado>
      </div>
    );
  }

  /* ── BRAÇO A ("uma dose por dia") — 1.0.17, dono 20/10 (mockup a1 aprovado): a pessoa tem que ENTENDER que começa um
     tutorial. "Tá dentro, Lucas 💛" / "Seus 3 dias grátis começaram" (sem ponto final: dono 20/10) / a frase dele ("Pra você tirar o melhor do CORE,
     preparamos um tutorial especial pra você.") / SEU PLANO DE 3 DIAS — os 3 módulos com o que cada um entrega (HOJE ·
     AMANHÃ · o dia da semana), sem "Trocar" (6–14% mexiam) / [Começar meu tutorial] e o link "Prefiro explorar sozinho".
     Uma coisa entra por vez: a tela (fundo opaco já no 1º quadro) → o ✓ → o texto → o confete (depois do ✓, nunca junto). ── */
  if (braco === "A") {
    const quandoA = (n: DiaDaMissao) => (n === 1 ? "Hoje" : n === 2 ? "Amanhã" : diaDaSemanaDoPasso(n, missao, hoje));
    const parado = reduzir || jaEntrou.current;
    const primeiro = primeiroNome(nome);
    return (
      <motion.div className="md-tema md-fundo-boas fixed inset-0 z-[240] flex flex-col text-foreground" data-camada-guia="missao-doses-boas-vindas" data-testid="missao-doses-boas-vindas" data-braco="A" style={{ paddingTop: "var(--app-safe-top)" }}
        /* QA 20/10 (gravação no Simulador, 30 fps): com a TELA entrando em fade de 0, a Home que monta por baixo aparecia
           apagada por ~0,1–0,2 s logo depois do cadastro (a "piscada" da 1.0.16, mais fraca). O fundo agora nasce opaco;
           a sequência calma continua nos filhos (✓ → texto → confete) — o cadastro já saiu em branco, então não há corte. */
        initial={false}>
        {!jaEntrou.current && <Confete atraso={reduzir ? 0 : ATRASO_DO_CONFETE_S} />}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[420px] mx-auto flex flex-col px-6 pt-[9vh] pb-4">
            <motion.div initial={parado ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={entrada(reduzir, MOV.calmo, ATRASO_DO_CHECK_S)} data-testid="missao-doses-check"
              className="w-14 h-14 rounded-full bg-emerald-500 grid place-items-center mb-5 shadow-[0_16px_32px_-10px_rgba(16,185,129,.55)]">
              <Check className="w-7 h-7 text-white" strokeWidth={3.5} />
            </motion.div>
            <motion.div initial={parado ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={entrada(reduzir, MOV.calmo, ATRASO_DO_TEXTO_S)}>
              <h1 className="text-[32px] font-black tracking-[-0.03em] leading-[1.08]" data-testid="missao-doses-titulo">{primeiro ? `Tá dentro, ${primeiro}` : "Tá dentro"} <span aria-hidden>💛</span></h1>
              {/* dono 19/10: "Seus 3 dias grátis começaram" só com teste da loja de verdade (fraseDoAcesso); sem teste,
                  "Seu acesso começou". 1.0.17 (dono: ponto final em título é "sério demais"): sem ponto no título e aqui */}
              <p className="text-[17px] font-semibold text-foreground/80 mt-2 leading-snug" data-testid="missao-doses-subtitulo">{acesso}</p>
              <p className="text-[15px] text-muted-foreground mt-1 leading-snug" data-testid="missao-doses-tutorial">{FRASE_DO_TUTORIAL}</p>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground mt-7">Seu plano de 3 dias</p>
              <div className="mt-2 rounded-2xl bg-card border border-border/60 divide-y divide-border/60 overflow-hidden" data-testid="missao-doses-linhas">
                {linhas.map(({ n, cfg }) => (
                  <div key={n} className="md-linha md-linha-plano" data-hoje={n === 1 ? "" : undefined} data-testid={`missao-doses-linha-${n}`}>
                    <span className="md-plano-icone" style={{ background: cfg.cor }} aria-hidden>{cfg.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="md-plano-nome">{cfg.nome}</span>
                      <span className="md-plano-entrega" data-testid={`missao-doses-entrega-${n}`}>{ENTREGA_DO_MODULO[cfg.modulo]}</span>
                    </span>
                    <span className="md-pill" data-tom={n === 1 ? "hoje" : "dia"} data-testid={`missao-doses-quando-${n}`}>{quandoA(n)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
        <motion.div initial={parado ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={entrada(reduzir, MOV.calmo, ATRASO_DO_TEXTO_S)}>
          <RodapeColado tema>
            <button type="button" className="md-botao md-botao-56" data-testid="missao-doses-comecar" onClick={() => aoComecar(modulos)}>
              Começar meu tutorial
            </button>
            <button type="button" className="md-link mt-1" data-testid="missao-doses-explorar" onClick={() => aoExplorar(modulos)} data-segundos={Math.round((Date.now() - t0) / 1000)}>
              Prefiro explorar sozinho
            </button>
          </RodapeColado>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="fixed inset-0 z-[240] flex flex-col text-[#16121c]" data-camada-guia="missao-doses-boas-vindas" data-testid="missao-doses-boas-vindas" data-braco={braco ?? undefined} style={{ background: "linear-gradient(180deg,#eaf5fd 0%,#ffffff 55%)", paddingTop: "var(--app-safe-top)" }}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[420px] mx-auto flex flex-col px-5 pt-8 pb-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 17, delay: 0.1 }} className="w-14 h-14 rounded-full bg-emerald-500 grid place-items-center mx-auto mb-3 shadow-[0_16px_32px_-10px_rgba(16,185,129,.55)]">
            <Check className="w-7 h-7 text-white" strokeWidth={3.5} />
          </motion.div>
          <h1 className="text-[26px] font-black tracking-[-0.03em] leading-[1.1] text-center">Seu CORE tá pronto{nome ? `, ${nome}` : ""}.</h1>
          <p className="text-[13.5px] text-[#4f5a64] text-center mt-2 mb-5 leading-snug">
            Os <b className="text-[#16121c]">16 módulos</b> já estão liberados. A missão abaixo é só um jeito de começar: <b className="text-[#16121c]">1 toque por dia</b>, 3 dias, uns 40 segundos cada.
          </p>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 24 }} className="rounded-2xl bg-white overflow-hidden shadow-[0_24px_48px_-18px_rgba(20,60,110,.35)] border border-black/[0.06]">
            <div className="md-secao" data-cor="grafite">
              <span className="inline-flex items-center gap-2"><Quadradinho marcado={false} claro tam={14} /> Sua missão dos 3 dias</span>
              <b>1 toque por dia</b>
            </div>
            <div className="px-4 pt-3.5">
              <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: "25%" }} transition={{ duration: 0.8, delay: 0.5 }} />
              </div>
              <p className="text-[11px] text-[#4f5a64] font-semibold mt-1.5" data-testid="missao-doses-barra">Conta criada ✓ · 3 toques e a missão está cumprida</p>
            </div>
            <div className="mx-4 mt-3 rounded-xl border border-black/10 overflow-hidden divide-y divide-black/10" data-testid="missao-doses-linhas">
              {linhas.map(({ n, cfg, quando }) => (
                <div key={n} className="md-linha" data-hoje={n === 1 ? "" : undefined} data-testid={`missao-doses-linha-${n}`}>
                  <Quadradinho marcado={false} tam={18} />
                  <span className="min-w-0 flex-1">
                    <span className="md-linha-rotulo">{quando} · {cfg.emoji} {cfg.nome}</span>
                    <span className="md-linha-texto">{cfg.pedido}{n === 1 ? ` · ${emSegundos(10)}` : ""}</span>
                  </span>
                  <span className="md-pill" data-tom={n === 1 ? "hoje" : "dia"}>{pill(n)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 pt-3 pb-4">
              <p className="text-[12.5px] text-[#4f5a64] leading-snug">
                {areaNome ? <>Você escolheu <b className="text-[#16121c]">{areaNome}</b> na porta — ela vem primeiro. </> : null}
                Só esses 3 entram na missão; <b className="text-[#16121c]">os outros 13 seguem abertos</b>.
              </p>
              <button type="button" className="mt-1.5 text-[13.5px] font-bold" style={{ color: "hsl(var(--accent))" }} data-testid="missao-doses-trocar" onClick={() => { setEscolhidos(modulos); trocarDeTela("escolha"); }}>
                Trocar os 3 módulos →
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <RodapeColado>
        <button type="button" className="md-link mb-1" data-testid="missao-doses-explorar" onClick={() => aoExplorar(modulos)} data-segundos={Math.round((Date.now() - t0) / 1000)}>
          Explorar por conta própria
        </button>
        <button type="button" className="md-botao md-botao-56" data-testid="missao-doses-comecar" onClick={() => aoComecar(modulos)}>
          {B ? `Começar a dose 1 · ${emSegundos(20)}` : "Fazer o toque de hoje"} <ArrowRight className="w-4 h-4" />
        </button>
      </RodapeColado>
    </div>
  );
}
