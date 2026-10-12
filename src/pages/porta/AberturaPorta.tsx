import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { OpcoesPorta } from "./telas";
import { ABERTURA_TUDO, OPCOES_AREA, PERGUNTA_AREA, PERGUNTA_DOR, SELO_ABERTURA, TITULO_ABERTURA, rotaDe, type EscolhaPorta, type Opcao } from "./conteudo";

/** O ícone do app (o mesmo do manifest/PWA e da App Store: public/icon-192.png, 5 KB). Não é desenho novo. */
export const LOGO_PORTA = "/icon-192.png";

/**
 * TELA 1 DA PORTA (v3, dono 11/10: "quero algo mais rápido; tirar a tela do mockup e unir").
 *
 * Abertura + área + dor numa tela só. No iPhone, só 28% passavam da welcome com vídeo (o "Começar" era
 * uma tela a mais antes da 1ª pergunta). Agora a 1ª coisa na tela já é a pergunta:
 *   · "Organize sua vida em 3 dias." + a prova social (real: +1000 pessoas);
 *   · as 6 áreas (as mesmas de antes; "Tudo" = dinheiro);
 *   · tocou numa área → a pergunta da DOR daquela área aparece logo abaixo (rolagem suave até ela);
 *     trocar a área troca a pergunta;
 *   · tocou numa resposta → avança. Sem botão "Continuar".
 *   · "Já tem conta? Entrar" discreto no fim.
 *
 * v4 (12/10): no iPhone só 31% passavam desta tela. Em cima do título, o ícone do CORE (o da App Store, pra a
 * pessoa saber que é um app e reconhecer depois na loja) e o selo "Grátis · 3 perguntas · 30 segundos" (o
 * esforço e o custo ditos antes de pedir o 1º toque). O resto igual.
 */
export function AberturaPorta({ escolha, onArea, onDor, onEntrar }: {
  /** a área já escolhida (voltou da tela 2, ou o estado salvo) */
  escolha: EscolhaPorta | null;
  onArea: (area: EscolhaPorta) => void;
  onDor: (o: Opcao) => void;
  onEntrar: () => void;
}) {
  const [area, setArea] = useState<EscolhaPorta | null>(escolha);
  const [dor, setDor] = useState<string | null>(null);
  const indo = useRef(false);
  const tocouArea = useRef(false);
  const perguntaRef = useRef<HTMLElement | null>(null);

  /* a pergunta aparece logo abaixo: rola suave até ela (só depois de um toque; voltar pra cá não rola) */
  useEffect(() => {
    if (!area || !tocouArea.current) return;
    const t = window.setTimeout(() => {
      try { perguntaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch { /* jsdom */ }
    }, 60);
    return () => window.clearTimeout(t);
  }, [area]);

  const escolherArea = (o: Opcao) => {
    if (indo.current) return;
    tocouArea.current = true;
    const id = o.id as EscolhaPorta;
    if (id !== area) setDor(null);
    setArea(id);
    onArea(id);
  };
  const escolherDor = (o: Opcao) => {
    if (indo.current) return;
    indo.current = true;
    setDor(o.id);
    // o toque aparece (preenchido) antes de avançar, como no Cal AI
    window.setTimeout(() => onDor(o), 170);
  };

  const rota = rotaDe(area);
  const q = PERGUNTA_DOR[rota];

  return (
    <div className="flex-1 flex flex-col pb-4" data-testid="porta-abertura" data-area={area ?? undefined}>
      <div className="flex items-center gap-2.5 mb-4" data-testid="porta-abertura-topo">
        <img
          src={LOGO_PORTA} alt="CORE" width={34} height={34} decoding="async"
          className="w-[34px] h-[34px] rounded-[9px] border border-[#ebe7ef] shadow-[0_1px_2px_rgba(22,18,28,.06)]"
          data-testid="porta-logo"
        />
        <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-[#f4f1f6] text-[12.5px] font-bold text-[#4f5a64]" data-testid="porta-selo">
          {SELO_ABERTURA}
        </span>
      </div>
      <motion.h1
        className="text-[34px] font-black tracking-[-0.035em] leading-[1.04] text-balance"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        data-testid="porta-abertura-titulo"
      >
        {TITULO_ABERTURA}
      </motion.h1>
      <motion.p className="mt-2.5 text-[13.5px] text-[#7d8691]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.35 }} data-testid="porta-prova">
        <span className="text-[#f0a500] tracking-[0.06em]" aria-hidden>★★★★★</span> <b className="text-[#16121c]">+1000 pessoas</b> organizando a vida
      </motion.p>

      <section className="mt-7" aria-labelledby="porta-area-titulo" data-testid="porta-area">
        <h2 id="porta-area-titulo" className="text-[17px] font-extrabold tracking-[-0.01em] text-[#16121c]">{PERGUNTA_AREA}</h2>
        {area ? (
          /* com a área escolhida, a lista vira pílulas: a área marcada continua à vista, a pergunta cabe logo abaixo,
             e trocar é 1 toque */
          <div className="mt-3 flex flex-wrap gap-2" role="list" data-testid="porta-area-pilulas">
            {OPCOES_AREA.map((o) => {
              const on = o.id === area;
              return (
                <button
                  key={o.id} type="button" role="listitem" aria-pressed={on} onClick={() => escolherArea(o)}
                  data-testid={`porta-area-${o.id}`} data-on={on ? "" : undefined}
                  className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full border-2 text-[14.5px] font-bold transition-colors ${on ? "border-[#16121c] bg-[#16121c] text-white" : "border-[#ebe7ef] bg-white text-[#16121c] active:bg-[#f7f5fa]"}`}
                >
                  <span aria-hidden className="text-[16px] leading-none">{o.emoji}</span>{o.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-3">
            <OpcoesPorta opcoes={OPCOES_AREA} sel={area} onToque={escolherArea} prefixo="porta-area-" compacta atraso={0.03} />
          </div>
        )}
      </section>

      {area && (
        <motion.section
          key={area}
          ref={perguntaRef}
          className="mt-7 pt-1"
          style={{ scrollMarginTop: 16 }}
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}
          aria-labelledby="porta-pergunta"
          data-testid="porta-dor"
        >
          {area === "tudo" && <p className="text-[13px] text-[#5b6570] leading-snug mb-3 rounded-xl px-3 py-2" style={{ background: "#FFF8D6" }} data-testid="porta-abertura-tudo">{ABERTURA_TUDO}</p>}
          <h2 id="porta-pergunta" className="text-[24px] font-black tracking-[-0.025em] leading-[1.12] text-balance" data-testid="porta-pergunta">{q.q}</h2>
          <div className="mt-4">
            <OpcoesPorta opcoes={q.opts} sel={dor} onToque={escolherDor} compacta />
          </div>
        </motion.section>
      )}

      <div className="mt-auto pt-6 flex justify-center">
        <button type="button" onClick={onEntrar} className="h-11 px-4 text-[14px] text-[#4f5a64]" data-testid="porta-entrar">
          Já tem conta? <b className="text-[#16121c]">Entrar</b>
        </button>
      </div>
    </div>
  );
}
