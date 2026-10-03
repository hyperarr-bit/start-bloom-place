import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { EVENTO_DIA2, conteudoDoLembrete, diaDoUso, horaDoLembrete, lerDia2, registrarAbertura, rotuloDeMinutos, type ConteudoDia2 } from "@/lib/lembrete-dia2";
import { lerMissao } from "@/lib/missao-doses";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/sequencia";
import "./missao-doses.css";

/**
 * A PRÉ-FOLHA DA PERMISSÃO (03/10): "Quer que eu te lembre amanhã às 19h?"
 *
 * No iPhone, sem permissão nada aparece — e o pedido do sistema só pode ser
 * feito UMA vez com chance real. O momento certo é o de valor: logo depois do
 * 1º registro salvo no dia 1 (core:activation), com a hora que o lembrete vai
 * usar de verdade e um gostinho do texto. "Sim" → o pedido do sistema; "Agora
 * não" → nunca mais perguntamos (adiarPermissaoDia2).
 *
 * Quem passa pela comemoração da Missão em doses não vê esta folha: lá o
 * "Te lembro às 20h · Combinado" já faz este papel e pede a permissão. Por isso
 * ela espera 1,2 s e desiste se há passo da missão na tela ou outra camada de
 * guia/diálogo aberta — tenta de novo no próximo registro.
 */
export function PreFolhaLembrete() {
  const { user } = useAuth();
  const { get, loaded, isGuest } = useUserData();
  const [aberta, setAberta] = useState<{ hora: string; conteudo: ConteudoDia2 } | null>(null);
  const getRef = useRef(get);
  getRef.current = get;
  const criadoEm = user?.created_at ?? null;
  const uid = user?.id ?? null;

  useEffect(() => {
    if (!isNativeShell() || !loaded || isGuest || !uid) return;
    let timer: number | undefined;
    const aoRegistrar = (ev: Event) => {
      const chave = (ev as CustomEvent).detail?.key as string | undefined;
      if (chave && /last-seen/.test(chave)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void (async () => {
          const e = lerDia2() ?? registrarAbertura(new Date(), criadoEm);
          if (e.permissao) return;                                            // já perguntamos (ou ela adiou)
          const hoje = localDayKey();
          if (diaDoUso(e, hoje) > 2) return;                                   // o momento é o 1º dia (o 2º cobre quem começou de noite)
          if (horaDoLembrete(e) === "sem") return;
          if (document.documentElement.hasAttribute("data-missao-doses-faixa")) return; // a comemoração da missão vai pedir
          if (document.querySelector('[data-camada-guia], [role="dialog"], [role="alertdialog"]')) return;
          const { estadoPermissao } = await import("@/lib/notificacoes");
          if ((await estadoPermissao()) !== "prompt") return;
          const hora = horaDoLembrete(e);
          if (hora === "sem") return;
          const amanha = somarDias(hoje, 1);
          const [y, m, d] = amanha.split("-").map(Number);
          const conteudo = conteudoDoLembrete(getRef.current, { missao: lerMissao(), amanha: new Date(y, m - 1, d, Math.floor(hora / 60), hora % 60), hoje });
          setAberta({ hora: rotuloDeMinutos(hora), conteudo });
          trackEvent("lembrete_dia2_pre_folha", { acao: "view", hora: rotuloDeMinutos(hora), modulo: conteudo.modulo });
        })();
      }, 1200);
    };
    window.addEventListener("core:activation", aoRegistrar);
    return () => { window.clearTimeout(timer); window.removeEventListener("core:activation", aoRegistrar); };
  }, [loaded, isGuest, uid, criadoEm]);

  const fechar = () => setAberta(null);
  const sim = async () => {
    const { pedirPermissaoDia2 } = await import("@/lib/notificacoes");
    const r = await pedirPermissaoDia2("pre_folha").catch(() => "indisponivel" as const);
    trackEvent("lembrete_dia2_pre_folha", { acao: "sim", resultado: r });
    fechar();
    try { window.dispatchEvent(new Event(EVENTO_DIA2)); } catch { /* noop */ }
  };
  const agoraNao = async () => {
    const { adiarPermissaoDia2 } = await import("@/lib/notificacoes");
    adiarPermissaoDia2("pre_folha");
    trackEvent("lembrete_dia2_pre_folha", { acao: "agora_nao" });
    fechar();
  };

  // sem AnimatePresence de propósito: a folha some no toque (nada de saída animada segurando um diálogo)
  return createPortal(
    aberta ? <Folha hora={aberta.hora} conteudo={aberta.conteudo} aoSim={() => void sim()} aoAgoraNao={() => void agoraNao()} /> : null,
    document.body,
  );
}

/** A folha em si (exportada pro /dev e pros testes): grafite + magenta, papel do planner. */
export function Folha({ hora, conteudo, aoSim, aoAgoraNao }: { hora: string; conteudo: ConteudoDia2; aoSim: () => void; aoAgoraNao: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-[250] flex items-end justify-center" style={{ background: "rgba(15,12,20,.45)" }} data-camada-guia="pre-folha-lembrete" data-testid="pre-folha-lembrete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} role="dialog" aria-modal="true" aria-labelledby="pre-folha-titulo">
      <motion.div
        initial={{ y: 40 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="w-full max-w-[440px] rounded-t-3xl bg-white text-[#16121c] shadow-2xl px-5 pt-5"
        style={{ paddingBottom: "calc(var(--app-safe-bottom, 0px) + 20px)" }}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: "#16121c" }}><Bell className="w-5 h-5" /></span>
          <div className="min-w-0">
            <p id="pre-folha-titulo" className="text-[19px] font-black tracking-[-0.02em] leading-tight">Quer que eu te lembre amanhã às {hora}?</p>
            <p className="text-[13px] text-[#4f5a64] mt-1 leading-snug">Um aviso só por dia, na primeira semana, na hora em que você costuma abrir o CORE.</p>
          </div>
        </div>
        {/* o gostinho: a notificação como ela vai chegar */}
        <div className="mt-4 rounded-2xl border border-black/10 px-3.5 py-3 text-left" style={{ background: "#FFF8D6" }} data-testid="pre-folha-previa">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8a4b12" }}>Amanhã · {hora}</span>
          <span className="block text-[14.5px] font-extrabold leading-snug mt-0.5">{conteudo.title}</span>
          <span className="block text-[12.5px] text-[#4f5a64] leading-snug mt-0.5">{conteudo.body}</span>
        </div>
        <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="pre-folha-sim" onClick={aoSim}>Sim, me lembra às {hora}</button>
        <button type="button" className="md-link mt-1" data-testid="pre-folha-nao" onClick={aoAgoraNao}>Agora não</button>
      </motion.div>
    </motion.div>
  );
}
