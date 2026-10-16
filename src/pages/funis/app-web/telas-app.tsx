import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { BotaoDoFunil } from "@/pages/funis/w/BotaoDoFunil";
import { COMPROMISSOS_POR_AREA, DEPOIS_DO_TESTE_POR_AREA, DIAS_POR_AREA, compromissoComoChip } from "@/pages/funis/w/compromissos";
import {
  BOTAO_PLANO, CADEADO_ROTULO, CADEADO_TEXTO, FUNIL_APP_WEB, LEMBRETES, LEMBRETES_SUB, PERGUNTA_PORTA, PORTAS, VARIANTE_APP, textoDoContrato,
} from "./conteudo";

/**
 * As telas do funil do app que moram DENTRO do ComecarW (porta, lembretes e o plano de 3 dias da 1.0.15), copiadas
 * pra web (/assinatura, 16/10). Mesmo desenho e mesmos textos; os eventos levam `funil: "app_web"`.
 * Diferenças da web, de propósito:
 *   · lembretes: na web não existe permissão de notificação do app — os dois botões só seguem (a tela conta COMO o
 *     app vai lembrar; quem ativa é o app, depois do download);
 *   · plano: o cadeado do app diz "quando começar o teste grátis" — aqui não tem teste: "quando você liberar o CORE".
 */
const TAG = { funil: FUNIL_APP_WEB, variante: VARIANTE_APP, web: true };

/* ------------------------------------------------------------------ a porta (pergunta 1) */
export function PortaApp({ onPickArea, onBack, totalPassos }: { onPickArea: (a: AreaKey, label: string) => void; onBack: () => void; totalPassos: number }) {
  useEffect(() => {
    trackEvent("funnel_view", { step: "porta_vista", ...TAG, visivel: typeof document !== "undefined" ? document.visibilityState : "?" });
    const t = window.setTimeout(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") trackEvent("funnel_view", { step: "porta_viva", ...TAG });
    }, 4000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto" data-testid="app-web-porta">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} aria-label="Voltar" className="-ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-accent rounded-full" initial={false}
            animate={{ width: `${(1 / totalPassos) * 100}%` }} transition={{ duration: 0.35, ease: "easeOut" }} />
        </div>
      </div>
      <h2 className="text-[27px] font-bold tracking-tight leading-[1.15] mb-7">{PERGUNTA_PORTA}</h2>
      <div className="space-y-2.5">
        {PORTAS.map((o) => (
          <button
            key={o.label}
            onClick={() => onPickArea(o.area, o.label)}
            data-testid={`app-web-porta-${o.label === "Tudo, sinceramente" ? "tudo" : o.area}`}
            className="group w-full flex items-center gap-3.5 rounded-2xl border-2 border-border bg-card p-3.5 text-left hover:border-accent hover:bg-accent/[0.04] active:scale-[0.99] transition-all"
          >
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-secondary text-2xl shrink-0">{o.emoji}</span>
            <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
            <span className="grid place-items-center w-6 h-6 rounded-full border-2 border-border group-hover:border-accent transition-colors shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ os lembretes (passo próprio, rodapé fixo) */
export function LembretesApp({ area, onDone }: { area: AreaKey; onDone: () => void }) {
  const [indo, setIndo] = useState(false);
  const conf = LEMBRETES[area] ?? LEMBRETES.dinheiro;
  const seguir = (quer: boolean) => {
    if (indo) return;
    setIndo(true);
    trackEvent("funnel_click", { cta: quer ? "notif_ativar" : "notif_pular", ...TAG, area });
    onDone();
  };
  return (
    <div className="w-full max-w-md mx-auto" data-testid="app-web-lembretes">
      <h2 className="text-[24px] font-bold tracking-tight leading-[1.15] mb-2">{conf.titulo}</h2>
      <p className="text-[13px] text-muted-foreground mb-4 leading-snug">{LEMBRETES_SUB}</p>
      <div className="space-y-2 mb-5">
        {conf.itens.map((i) => (
          <div key={i.t} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-secondary text-lg shrink-0">{i.emoji}</span>
            <span className="font-semibold text-[13.5px] leading-snug">{i.t}</span>
          </div>
        ))}
      </div>
      <BotaoDoFunil texto="Quero ser lembrado" seta={false} onClick={() => seguir(true)} disabled={indo} testid="notif-ativar"
        secundario={{ texto: "Agora não", onClick: () => seguir(false), disabled: indo, testid: "notif-pular" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ "Seu plano de 3 dias" (com o cadeado, como na 1.0.15) */
export function PlanoDe3DiasApp({ area, onDone }: { area: AreaKey; onDone: (marcados: number) => void }) {
  const itens = COMPROMISSOS_POR_AREA[area] ?? COMPROMISSOS_POR_AREA.dinheiro;
  const [marcados, setMarcados] = useState<boolean[]>(() => itens.map(() => true));
  const [indo, setIndo] = useState(false);
  const alternar = (i: number) => {
    setMarcados((m) => m.map((v, k) => (k === i ? !v : v)));
    trackEvent("funnel_click", { cta: marcados[i] ? "plano_3_dias_desmarcou" : "plano_3_dias_marcou", ...TAG, area, indice: i + 1 });
  };
  const fechado = () => {
    if (indo) return;
    setIndo(true);
    marcados.forEach((sim, i) => trackEvent("funnel_quiz_answer", { step: `compromisso_${i + 1}`, answer: sim ? "claro" : "nao", area, ...TAG, tela: "plano_3_dias" }));
    const n = marcados.filter(Boolean).length;
    trackEvent("funnel_click", { cta: n > 0 ? "contrato_assinou" : "contrato_pulou", ...TAG, tela: "plano_3_dias" });
    trackEvent("funnel_click", { cta: "plano_3_dias_fechado", ...TAG, area, marcados: n });
    trackEvent("funnel_click", { cta: "desbloquear_plano", ...TAG, area, marcados: n });
    onDone(n);
  };
  const dias = DIAS_POR_AREA[area] ?? DIAS_POR_AREA.dinheiro;
  const depois = DEPOIS_DO_TESTE_POR_AREA[area] ?? DEPOIS_DO_TESTE_POR_AREA.dinheiro;
  const info = AREAS[area] ?? AREAS.dinheiro;
  return (
    <div className="w-full flex-1 flex flex-col pt-2" data-testid="plano-3-dias" data-cadeado="">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Seu plano</p>
      <h1 className="text-[26px] font-black tracking-[-0.02em] leading-[1.1] mt-1">Seu plano de 3 dias</h1>

      <div className="mt-3.5 rounded-2xl border-2 border-[#16121c] bg-white p-3.5" data-testid="plano-3-dias-dias">
        <div className="flex items-center gap-2">
          <span className="text-[18px] leading-none" aria-hidden>{info.emoji}</span>
          <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#16121c]">{info.nome}</span>
        </div>
        <ol className="mt-2.5 space-y-2">
          {dias.map((t, i) => (
            <motion.li
              key={t}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.07 * i, duration: 0.25 }}
              className="grid grid-cols-[44px_1fr] gap-2.5 items-start"
            >
              <span className="mt-[1px] rounded-md bg-[#16121c] text-white text-[10.5px] font-extrabold tracking-wide text-center py-[3px]">DIA {i + 1}</span>
              <span className="text-[14px] font-semibold leading-snug text-[#16121c]">{t}</span>
            </motion.li>
          ))}
        </ol>
      </div>

      <div className="mt-3 space-y-1.5" role="group" aria-label="Compromissos">
        {itens.map((it, i) => {
          const on = marcados[i];
          return (
            <button
              key={it.p}
              type="button"
              role="checkbox"
              aria-checked={on}
              data-testid={`plano-3-dias-chip-${i + 1}`}
              data-marcado={on ? "" : undefined}
              onClick={() => alternar(i)}
              className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${on ? "border-[#16121c]/60 bg-white" : "border-border bg-card"}`}
            >
              <span className={`grid place-items-center w-5 h-5 rounded-md shrink-0 ${on ? "bg-[#16121c] text-white" : "border-2 border-border bg-white"}`} aria-hidden>
                {on && <Check className="w-3 h-3" strokeWidth={3.5} />}
              </span>
              <span className="text-[15px] leading-none shrink-0" aria-hidden>{it.emoji}</span>
              <span className={`font-semibold text-[13px] leading-snug flex-1 ${on ? "" : "text-muted-foreground line-through"}`}>{compromissoComoChip(it.p)}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 rounded-xl px-3 py-2 border border-black/10" style={{ background: "#FFF8D6" }} data-testid="plano-3-dias-contrato">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8a4b12" }}>Combinado comigo · </span>
        <span className="text-[13px] font-extrabold leading-snug text-[#16121c]">“{textoDoContrato(null)}”</span>
      </div>

      <div className="mt-3 relative rounded-2xl border border-border bg-card p-3.5 overflow-hidden" data-testid="plano-3-dias-cadeado">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{CADEADO_ROTULO}</div>
        <p className="text-[12px] text-muted-foreground mt-0.5">O que o CORE monta pra você nos próximos 30 dias</p>
        <ul className="mt-2 space-y-1.5 select-none" aria-hidden style={{ filter: "blur(4px)" }}>
          {depois.map((t) => (
            <li key={t} className="text-[13.5px] font-semibold text-[#16121c] leading-snug">{t}</li>
          ))}
        </ul>
        <div className="absolute inset-x-0 bottom-0 pt-8 pb-3 bg-gradient-to-t from-card via-card/95 to-transparent grid place-items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-border px-3 py-1.5 text-[11.5px] font-bold text-foreground shadow-sm">
            <Lock className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> {CADEADO_TEXTO}
          </span>
        </div>
      </div>

      {/* o botão no rodapé fixo padrão do funil (no app: o BotaoDoFunil que toca no botão da tela) */}
      <BotaoDoFunil
        texto={<><Lock className="w-4 h-4" strokeWidth={2.5} aria-hidden /> {BOTAO_PLANO}</>}
        seta={false} onClick={fechado} disabled={indo} testid="plano-3-dias-fechado"
      />
    </div>
  );
}
