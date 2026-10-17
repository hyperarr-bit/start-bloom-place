import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { Confete } from "@/components/demo-guiada/pecas";
import { trackEvent } from "@/lib/analytics";
import { DOSE_CURTA, MODULOS, MODULO_DA_AREA, ORDEM_MODULOS, diaDaSemanaDoPasso, eventoDaMissao, type DiaDaMissao, type EstadoMissaoDoses, type ModuloDaMissao } from "@/lib/missao-doses";
import { AREAS, type AreaKey } from "@/lib/funnel";

/** O resumo curto de cada dose na tela 2 do B ("Um gasto, um hábito, um copo d'água"). */
const RESUMO_DA_DOSE: Partial<Record<ModuloDaMissao, string>> = {
  financas: "um gasto", rotina: "um hábito", saude: "um copo d'água", treino: "um exercício", dieta: "uma refeição", desenvolvimento: "uma meta",
  hiperfoco: "um pensamento", estudos: "uma matéria", carreira: "uma tarefa", biblioteca: "um livro", casa: "um item da compra", beleza: "um passo da rotina",
  viagens: "um destino", relacionamentos: "uma pessoa", pet: "o seu pet", detox: "um hábito de detox",
};
import "./missao-doses.css";

/** "pelas Finanças", "pela Rotina", "pelo Treino" — o artigo certo de cada módulo da 1ª dose. */
const PELO_MODULO: Partial<Record<ModuloDaMissao, string>> = {
  financas: "pelas Finanças", rotina: "pela Rotina", treino: "pelo Treino", saude: "pela Saúde", desenvolvimento: "pelas Metas", dieta: "pela Dieta",
};

type Tres = [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao];

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
  /** braço B: 1 = "Tá dentro!", 2 = as doses (a escolha dos 3 volta pra 2) */
  const [telaB, setTelaB] = useState<1 | 2>(1);
  useEffect(() => {
    if (braco === "B") trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "view", tela: telaB }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telaB]);
  const [modulos, setModulos] = useState<Tres>(missao.modulos);
  const [t0] = useState(() => Date.now());
  const B = braco === "B";

  const alternar = (m: ModuloDaMissao) => {
    setModulos((atual) => {
      const i = atual.indexOf(m);
      if (i >= 0) {
        // tirar o escolhido: os de trás sobem; o 3º vira o primeiro padrão que não está na lista
        const resto = atual.filter((x) => x !== m);
        const reposicao = ORDEM_MODULOS.find((x) => !resto.includes(x))!;
        return [...resto, reposicao] as Tres;
      }
      // já tem 3: o novo entra no lugar do último
      return [atual[0], atual[1], m] as Tres;
    });
  };

  const linhas = ([1, 2, 3] as DiaDaMissao[]).map((n) => {
    const cfg = MODULOS[modulos[n - 1]];
    const quando = B ? `Dose ${n}` : n === 1 ? "Hoje" : n === 2 ? "Amanhã" : diaDaSemanaDoPasso(n, missao, hoje);
    return { n, cfg, quando };
  });
  // a pílula da linha: A = Hoje / Dia N; B = Agora / depois
  const pill = (n: DiaDaMissao) => (B ? (n === 1 ? "Agora" : "depois") : n === 1 ? "Hoje" : `Dia ${n}`);

  if (tela === "escolha") {
    return (
      <div className="fixed inset-0 z-[240] flex flex-col bg-background text-foreground" data-camada-guia="missao-doses-escolha" data-testid="missao-doses-escolha" style={{ paddingTop: "var(--app-safe-top)" }}>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[420px] mx-auto flex flex-col px-5 pt-6 pb-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{B ? "Sua missão de hoje" : "Sua missão dos 3 dias"}</p>
            <h1 className="text-[26px] font-black tracking-[-0.03em] leading-[1.1] mt-1">{B ? "Escolhe 3 módulos — 3 doses hoje" : "Escolhe 3 módulos — um por dia"}</h1>
            <p className="text-[14px] text-muted-foreground mt-2 leading-snug">
              <b className="text-foreground">Os outros 13 continuam liberados.</b> {B ? "Isso só decide onde a gente te guia hoje — o app inteiro é seu desde já." : "Isso só decide onde a gente te guia nos 3 dias — o app inteiro é seu desde já."}
            </p>
            <div className="grid grid-cols-4 gap-3 mt-5" role="group" aria-label="Módulos da missão">
              {ORDEM_MODULOS.map((m) => {
                const cfg = MODULOS[m];
                const pos = modulos.indexOf(m);
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
              {linhas.map(({ n, cfg, quando }) => (
                <div key={n} className="md-linha">
                  <span className="w-6 h-6 rounded-md grid place-items-center text-[12px] font-extrabold text-white shrink-0" style={{ background: "#16121c" }}>{n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="md-linha-rotulo">{quando}</span>
                    <span className="md-linha-texto">{cfg.emoji} {cfg.nome} · {cfg.pedido.toLowerCase()}</span>
                  </span>
                  <span className="md-pill" data-tom={n === 1 ? "hoje" : "dia"}>{pill(n)}</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground text-center mt-3">{B ? "Toca num módulo pra trocar. O 1º é a dose 1." : "Toca num módulo pra trocar. O 1º é o de hoje."}</p>
          </div>
        </div>
        <RodapeColado>
          <button type="button" className="md-botao md-botao-56" data-testid="missao-doses-pronto" onClick={() => { setTela("boas"); setTelaB(2); }}>
            Pronto, começar <ArrowRight className="w-4 h-4" />
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
            <p className="text-[16px] text-[#4f5a64] mt-3 leading-snug" data-testid="missao-doses-subtitulo">Seus 3 dias grátis começaram agora. Dá pra usar tudo.</p>
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
              <button type="button" className="text-[12px] font-bold" style={{ color: "hsl(var(--accent))" }} data-testid="missao-doses-trocar" onClick={() => setTela("escolha")}>Trocar os 3</button>
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

  /* ── 1.0.16, BRAÇO A ("uma dose por dia", desenho 8 seção 4.2): UMA tela, tela cheia, 1x ──
     "Tá dentro! 🎉" + "Seu plano de 3 dias" (Hoje · Amanhã · Dia 3, com o tempo de cada dose) + "Começar (30 s)",
     e os links "Explorar por conta própria" e "Trocar os módulos". */
  if (braco === "A") {
    const quandoA = (n: DiaDaMissao) => (n === 1 ? "Hoje" : n === 2 ? "Amanhã" : "Dia 3");
    const seg1 = DOSE_CURTA[modulos[0]].seg;
    // "A gente começa pelas Finanças, que foi o que você escolheu." — só se a 1ª dose ainda é a da área escolhida
    const areaDaPorta = areaNome ? (Object.keys(AREAS) as AreaKey[]).find((k) => AREAS[k].nome === areaNome) : undefined;
    const comecaPelaArea = !!areaDaPorta && MODULO_DA_AREA[areaDaPorta] === modulos[0];
    return (
      <div className="md-tema md-fundo-boas fixed inset-0 z-[240] flex flex-col text-foreground" data-camada-guia="missao-doses-boas-vindas" data-testid="missao-doses-boas-vindas" data-braco="A" style={{ paddingTop: "var(--app-safe-top)" }}>
        <Confete />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[420px] mx-auto flex flex-col px-6 pt-[8vh] pb-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 17, delay: 0.1 }} className="w-16 h-16 rounded-full bg-emerald-500 grid place-items-center mb-4 shadow-[0_16px_32px_-10px_rgba(16,185,129,.55)]">
              <Check className="w-8 h-8 text-white" strokeWidth={3.5} />
            </motion.div>
            <h1 className="text-[32px] font-black tracking-[-0.03em] leading-[1.05]">Tá dentro! 🎉</h1>
            <p className="text-[15.5px] text-muted-foreground mt-2.5 leading-snug" data-testid="missao-doses-subtitulo">Seus 3 dias grátis começaram. Os 16 módulos já estão abertos.</p>
            <div className="mt-7 flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Seu plano de 3 dias</p>
              <button type="button" className="text-[13px] font-bold min-h-9 px-1 -mr-1" style={{ color: "hsl(var(--accent))" }} data-testid="missao-doses-trocar" onClick={() => { trackEvent("missao_doses_boas_vindas", eventoDaMissao({ acao: "trocar" })); setTela("escolha"); }}>
                Trocar
              </button>
            </div>
            <div className="mt-1 rounded-2xl bg-card border border-border/60 shadow-[0_18px_40px_-20px_rgba(20,60,110,.3)] divide-y divide-border/60 overflow-hidden" data-testid="missao-doses-linhas">
              {linhas.map(({ n, cfg }) => (
                <div key={n} className="md-linha" data-hoje={n === 1 ? "" : undefined} data-testid={`missao-doses-linha-${n}`}>
                  <Quadradinho marcado={false} tam={18} />
                  <span className="md-linha-texto"><b>{quandoA(n)}</b> · {cfg.emoji} {cfg.nome} · {DOSE_CURTA[cfg.modulo].texto}</span>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] text-muted-foreground mt-3 leading-snug" data-testid="missao-doses-boas-vindas-nota">
              {comecaPelaArea ? <>A gente começa {PELO_MODULO[modulos[0]] ?? `por ${MODULOS[modulos[0]].nome}`}, que foi o que você escolheu. </> : null}
              Um passo por dia. O resto do app fica livre pra você mexer quando quiser.
            </p>
          </div>
        </div>
        <RodapeColado tema>
          <button type="button" className="md-botao md-botao-56" data-testid="missao-doses-comecar" onClick={() => aoComecar(modulos)}>
            Começar ({seg1} s) <ArrowRight className="w-4 h-4" />
          </button>
          <button type="button" className="md-link mt-1" data-testid="missao-doses-explorar" onClick={() => aoExplorar(modulos)} data-segundos={Math.round((Date.now() - t0) / 1000)}>
            Explorar por conta própria
          </button>
        </RodapeColado>
      </div>
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
                    <span className="md-linha-texto">{cfg.pedido}{n === 1 ? " · 10 s" : ""}</span>
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
              <button type="button" className="mt-1.5 text-[13.5px] font-bold" style={{ color: "hsl(var(--accent))" }} data-testid="missao-doses-trocar" onClick={() => setTela("escolha")}>
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
          {B ? "Começar a dose 1 · 20 s" : "Fazer o toque de hoje"} <ArrowRight className="w-4 h-4" />
        </button>
      </RodapeColado>
    </div>
  );
}
