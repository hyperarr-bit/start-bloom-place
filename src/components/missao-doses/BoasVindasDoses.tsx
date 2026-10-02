import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { MODULOS, ORDEM_MODULOS, diaDaSemanaDoPasso, type DiaDaMissao, type EstadoMissaoDoses, type ModuloDaMissao } from "@/lib/missao-doses";
import "./missao-doses.css";

type Tres = [ModuloDaMissao, ModuloDaMissao, ModuloDaMissao];

/**
 * BOAS-VINDAS DA MISSÃO EM DOSES (D1) + a escolha dos 3 módulos (D2).
 * Deixa MUITO claro (pedido do dono) que os 3 módulos são SÓ pra missão: o
 * app continua com os 16. A área da porta vem primeiro, e dá pra trocar.
 * Saída sem atrito: "Explorar por conta própria" — a missão continua no card.
 */
export function BoasVindasDoses({ missao, nome, areaNome, hoje, aoComecar, aoExplorar }: {
  missao: EstadoMissaoDoses;
  nome: string;
  /** o nome da área escolhida na porta (ex.: "Dinheiro"), se houver */
  areaNome: string | null;
  hoje: string;
  aoComecar: (modulos: Tres) => void;
  aoExplorar: (modulos: Tres) => void;
}) {
  const [tela, setTela] = useState<"boas" | "escolha">("boas");
  const [modulos, setModulos] = useState<Tres>(missao.modulos);
  const [t0] = useState(() => Date.now());

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
    const quando = n === 1 ? "Hoje" : n === 2 ? "Amanhã" : diaDaSemanaDoPasso(n, missao, hoje);
    return { n, cfg, quando };
  });

  if (tela === "escolha") {
    return (
      <div className="fixed inset-0 z-[240] overflow-y-auto bg-background text-foreground" data-camada-guia="missao-doses-escolha" data-testid="missao-doses-escolha" style={{ paddingTop: "var(--app-safe-top)" }}>
        <div className="min-h-full max-w-[420px] mx-auto flex flex-col px-5 pt-6 pb-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Sua missão dos 3 dias</p>
          <h1 className="text-[26px] font-black tracking-[-0.03em] leading-[1.1] mt-1">Escolhe 3 módulos — um por dia</h1>
          <p className="text-[14px] text-muted-foreground mt-2 leading-snug">
            <b className="text-foreground">Os outros 13 continuam liberados.</b> Isso só decide onde a gente te guia nos 3 dias — o app inteiro é seu desde já.
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
                <span className="md-pill" data-tom={n === 1 ? "hoje" : "dia"}>{n === 1 ? "Hoje" : `Dia ${n}`}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-muted-foreground text-center mt-3">Toca num módulo pra trocar. O 1º é o de hoje.</p>
          <div className="mt-auto pt-6">
            <button type="button" className="md-botao" data-testid="missao-doses-pronto" onClick={() => setTela("boas")}>
              Pronto, começar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[240] overflow-y-auto" data-camada-guia="missao-doses-boas-vindas" data-testid="missao-doses-boas-vindas" style={{ background: "linear-gradient(180deg,#eaf5fd 0%,#ffffff 55%)", paddingTop: "var(--app-safe-top)" }}>
      <div className="min-h-full max-w-[420px] mx-auto flex flex-col px-5 pt-8 pb-7 text-[#16121c]">
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
            <p className="text-[11px] text-[#4f5a64] font-semibold mt-1.5">Conta criada ✓ · 3 toques e a missão está cumprida</p>
          </div>
          <div className="mx-4 mt-3 rounded-xl border border-black/10 overflow-hidden divide-y divide-black/10" data-testid="missao-doses-linhas">
            {linhas.map(({ n, cfg, quando }) => (
              <div key={n} className="md-linha" data-hoje={n === 1 ? "" : undefined} data-testid={`missao-doses-linha-${n}`}>
                <Quadradinho marcado={false} tam={18} />
                <span className="min-w-0 flex-1">
                  <span className="md-linha-rotulo">{quando} · {cfg.emoji} {cfg.nome}</span>
                  <span className="md-linha-texto">{cfg.pedido}{n === 1 ? " · 10 s" : ""}</span>
                </span>
                <span className="md-pill" data-tom={n === 1 ? "hoje" : "dia"}>{n === 1 ? "Hoje" : `Dia ${n}`}</span>
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

        <div className="mt-auto pt-6">
          <button type="button" className="md-botao" data-testid="missao-doses-comecar" onClick={() => aoComecar(modulos)}>
            Fazer o toque de hoje <ArrowRight className="w-4 h-4" />
          </button>
          <button type="button" className="md-link mt-2" data-testid="missao-doses-explorar" onClick={() => aoExplorar(modulos)} data-segundos={Math.round((Date.now() - t0) / 1000)}>
            Explorar por conta própria
          </button>
        </div>
      </div>
    </div>
  );
}
