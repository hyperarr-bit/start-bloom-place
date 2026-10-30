import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { useEscolhaDaHome } from "@/hooks/use-escolha-da-home";
import { trackEvent } from "@/lib/analytics";
import { momentoRuimRecente } from "@/lib/momento-ruim";
import { localDayKey } from "@/lib/utils";
import {
  CHAVE_HOME_CONVITE, ESPERA_CONVITE_MS, deveConvidarHomeNova, escolhaConhecida, marcarConviteNoAparelho, type EscolhaDaHome,
} from "@/lib/home-nova";
import { Alca, CLASSE_FUNDO_FOLHA, DEPOIS_DA_SAIDA_MS, FaixaDoRelogioSobFolha, propsDaFolha, useFolhaArrastavel } from "./e/folha-arrasto";

/**
 * 1.0.22 (dono 28/10) — A ESCOLHA DA HOME na tela (lib/home-nova › ESCOLHA DA HOME):
 *   · ConviteHomeNova — a folha de baixo "Tem uma Home nova", 1x por conta, na Home CLÁSSICA (nunca um card no topo);
 *   · PainelEscolhaDaHome — "Nova / Clássica" lado a lado, a sub-tela do menu da conta e de Você (sempre à mão);
 *   · MiniaturaHomeNova / MiniaturaHomeClassica — desenhos das duas Homes (sem dado nenhum de conta, claro/escuro).
 */

/* ------------------------------------------------------------------ miniaturas */

const TINTAS = ["#F5B301", "#22c55e", "#4F8BFF", "#d22d80"];

/** A Home nova em miniatura: saudação + fogo, o card do dia com o anel, as bolinhas, a grade de 4 e a barra de vidro com o "+". */
export function MiniaturaHomeNova({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden data-testid="miniatura-home-nova" className={`relative w-[112px] h-[200px] rounded-[22px] border border-border bg-background overflow-hidden shadow-sm ${className}`}>
      <div className="px-2.5 pt-3.5 flex items-center justify-between">
        <span className="block h-[7px] w-12 rounded-full bg-foreground/80" />
        <span className="flex items-center gap-0.5 h-[12px] px-1.5 rounded-full bg-muted"><span className="w-[6px] h-[6px] rounded-full bg-orange-400" /><span className="w-[8px] h-[3px] rounded-full bg-foreground/40" /></span>
      </div>
      <div className="mx-2 mt-2.5 rounded-[12px] bg-card border border-border/60 p-2">
        <div className="flex items-center gap-2">
          <svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="11" fill="none" strokeWidth="4" className="stroke-muted" /><circle cx="15" cy="15" r="11" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray="69" strokeDashoffset="24" transform="rotate(-90 15 15)" className="stroke-foreground" /></svg>
          <span className="flex-1 space-y-1"><span className="block h-[6px] w-9 rounded-full bg-foreground/70" /><span className="block h-[4px] w-12 rounded-full bg-muted-foreground/30" /></span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {TINTAS.slice(0, 3).map((c) => <span key={c} className="block h-[16px] rounded-[5px]" style={{ background: `${c}22` }} />)}
        </div>
      </div>
      <div className="flex justify-center gap-1 mt-1.5"><span className="w-[5px] h-[3px] rounded-full bg-foreground/70" /><span className="w-[3px] h-[3px] rounded-full bg-muted-foreground/30" /><span className="w-[3px] h-[3px] rounded-full bg-muted-foreground/30" /></div>
      <div className="mx-2 mt-2 grid grid-cols-2 gap-1.5">
        {TINTAS.map((c) => (
          <span key={c} className="flex flex-col gap-1 rounded-[9px] p-1.5" style={{ background: `${c}1f` }}>
            <span className="w-[10px] h-[10px] rounded-[4px]" style={{ background: c }} />
            <span className="h-[3px] w-6 rounded-full bg-foreground/40" />
          </span>
        ))}
      </div>
      <div className="absolute left-2 right-2 bottom-2 h-[22px] rounded-full bg-card/90 border border-border/70 flex items-center justify-between pl-3 pr-1">
        <span className="flex gap-2.5"><span className="w-[6px] h-[6px] rounded-full bg-foreground/80" /><span className="w-[6px] h-[6px] rounded-full bg-muted-foreground/40" /><span className="w-[6px] h-[6px] rounded-full bg-muted-foreground/40" /></span>
        <span className="w-[16px] h-[16px] rounded-full bg-foreground text-background grid place-items-center text-[11px] leading-none font-bold">+</span>
      </div>
    </div>
  );
}

/** A Home clássica em miniatura: cabeçalho, o anel do score, as ações rápidas, widgets e a lista. */
export function MiniaturaHomeClassica({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden data-testid="miniatura-home-classica" className={`relative w-[112px] h-[200px] rounded-[22px] border border-border bg-background overflow-hidden shadow-sm ${className}`}>
      <div className="h-[30px] border-b border-border bg-card px-2.5 flex items-end pb-1.5 justify-between">
        <span className="block h-[6px] w-12 rounded-full bg-foreground/70" />
        <span className="w-[12px] h-[12px] rounded-full bg-muted" />
      </div>
      <div className="mx-2 mt-2 rounded-[10px] bg-card border border-border/60 py-2 grid place-items-center">
        <svg width="34" height="34" viewBox="0 0 30 30"><circle cx="15" cy="15" r="11" fill="none" strokeWidth="3.5" className="stroke-muted" /><circle cx="15" cy="15" r="11" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="69" strokeDashoffset="30" transform="rotate(-90 15 15)" className="stroke-primary" /></svg>
      </div>
      <div className="mx-2 mt-2 flex gap-1">
        {TINTAS.map((c) => <span key={c} className="flex-1 h-[18px] rounded-[6px] bg-card border border-border/60 grid place-items-center"><span className="w-[6px] h-[6px] rounded-full" style={{ background: c }} /></span>)}
      </div>
      <div className="mx-2 mt-2 grid grid-cols-2 gap-1">
        <span className="h-[26px] rounded-[7px] bg-card border border-border/60" />
        <span className="h-[26px] rounded-[7px] bg-card border border-border/60" />
      </div>
      <div className="mx-2 mt-2 space-y-1">
        {[0, 1, 2].map((i) => <span key={i} className="flex items-center gap-1"><span className="w-[6px] h-[6px] rounded-full border border-muted-foreground/40" /><span className="h-[4px] flex-1 rounded-full bg-muted-foreground/25" /></span>)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ o painel "Nova / Clássica" */

/**
 * As duas Homes lado a lado, a atual marcada. Tocar na outra chama `onEscolher` — quem monta decide QUANDO gravar (o menu
 * da conta fecha a folha primeiro e só depois troca: a Home nunca muda por baixo de uma folha aberta).
 */
export function PainelEscolhaDaHome({ atual, onEscolher }: { atual: EscolhaDaHome; onEscolher: (para: EscolhaDaHome) => void }) {
  const opcao = (id: EscolhaDaHome, titulo: string, sub: string) => {
    const marcada = atual === id;
    return (
      <button
        type="button"
        onClick={() => { if (!marcada) onEscolher(id); }}
        aria-pressed={marcada}
        data-testid={`home-escolha-${id}`}
        data-track={`home-escolha:${id}`}
        className={`flex-1 min-w-0 flex flex-col items-center gap-2 rounded-2xl border p-3 pb-3.5 text-center transition-colors ${marcada ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/30"}`}
      >
        {id === "nova" ? <MiniaturaHomeNova /> : <MiniaturaHomeClassica />}
        <span className="flex items-center gap-1.5 text-[15px] font-bold">
          {marcada && <Check className="w-4 h-4" strokeWidth={2.6} aria-hidden />}{titulo}
        </span>
        <span className="text-[12px] leading-snug text-muted-foreground">{sub}</span>
      </button>
    );
  };
  return (
    <div data-testid="home-escolha-painel">
      <div className="flex gap-3">
        {opcao("nova", "Nova", "Seu dia num carrossel, módulos em grade e o +")}
        {opcao("classica", "Clássica", "A Home de sempre")}
      </div>
      <p className="mt-3 text-[12.5px] text-muted-foreground text-center">Trocar não apaga nada: as duas usam os mesmos dados.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ o convite (1x por conta) */

/** Alguma camada já está na tela? (o mesmo critério da festa das conquistas — components/conquistas/Momentos — sem importar ela) */
export const telaOcupadaParaConvite = (): boolean => {
  if (typeof document === "undefined") return true;
  const el = document.activeElement as HTMLElement | null;
  if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return true;
  const raiz = document.documentElement;
  return !!document.querySelector('[role="dialog"]:not([data-convite-home]), [role="alertdialog"], [data-camada-guia], [data-momento], [data-testid="celebracao-100"], [data-aviso-menu-novo], [data-vaul-drawer][data-state="open"], [data-daily-nudge]')
    || raiz.hasAttribute("data-missao-doses-faixa") || raiz.dataset.missaoDose === "1";
};

/** Uma vez por abertura do app, no máximo (a marca na conta/aparelho cobre as próximas). */
let conviteNestaAbertura = false;
/** Só testes. */
export const _zerarConviteNestaAbertura = (): void => { conviteNestaAbertura = false; };
/** Quantas vezes o convite olha a tela de novo (a cada ESPERA_CONVITE_MS) antes de desistir nesta abertura. */
const TENTATIVAS_CONVITE = 20;

/**
 * "Tem uma Home nova" — a folha de baixo da Home CLÁSSICA (pages/Home monta só lá). Regras de quando aparece em
 * deveConvidarHomeNova (lib/home-nova); aqui, a pilha: espera a Home assentar (ESPERA_CONVITE_MS) e só abre com a tela
 * livre (nenhuma folha, festa, aviso de cobrança, guia da missão ou campo com teclado); ocupada, olha de novo depois.
 * `bloqueado`: a Home tem outra coisa pra mostrar (o tour, o modo de editar widgets).
 * Gravado na hora em que APARECE (conta + aparelho): fechar o app com a folha na tela não a repete.
 */
export function ConviteHomeNova({ bloqueado = false, ligada = false }: { bloqueado?: boolean; ligada?: boolean }) {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const uid = user?.id ?? null;
  const { get, set, loaded, contaCompleta, isGuest } = useUserData();
  const { escolher } = useEscolhaDaHome();
  const [aberta, setAberta] = useState(false);
  const semMovimento = useReducedMotion();

  const conviteNaConta = get<unknown>(CHAVE_HOME_CONVITE, null);
  const pode = !conviteNestaAbertura && deveConvidarHomeNova({
    userId: uid, contaCarregada: loaded && contaCompleta !== false, convidado: isGuest, ligada,
    escolha: escolhaConhecida(uid), conviteNaConta, criadoEm: user?.created_at ?? null, momentoRuim: momentoRuimRecente(),
    diaDeHoje: localDayKey(), diaDaConta: user?.created_at ? localDayKey(new Date(user.created_at)) : null,
  });

  const setRef = useRef(set);
  setRef.current = set;
  useEffect(() => {
    if (!pode || bloqueado || aberta || !uid) return;
    let tentativas = 0;
    let t: ReturnType<typeof setTimeout>;
    const tentar = () => {
      if (conviteNestaAbertura) return;
      if (telaOcupadaParaConvite()) { if (++tentativas < TENTATIVAS_CONVITE) t = setTimeout(tentar, ESPERA_CONVITE_MS); return; }
      conviteNestaAbertura = true;
      marcarConviteNoAparelho(uid);
      setRef.current(CHAVE_HOME_CONVITE, { em: new Date().toISOString(), resposta: "visto" }, { system: true });
      trackEvent("home_escolha_convite_visto", {});
      setAberta(true);
    };
    t = setTimeout(tentar, ESPERA_CONVITE_MS);
    return () => clearTimeout(t);
  }, [pode, bloqueado, aberta, uid]);

  const responder = (resposta: "experimentar" | "agora-nao" | "fechou") => {
    setAberta(false);
    set(CHAVE_HOME_CONVITE, { em: new Date().toISOString(), resposta }, { system: true });
    trackEvent("home_escolha_convite_resposta", { resposta });
    // a Home só troca DEPOIS de a folha descer inteira (nada muda por baixo de uma folha aberta)
    if (resposta === "experimentar") window.setTimeout(() => { escolher("nova", "convite"); try { window.scrollTo(0, 0); } catch { /* noop */ } }, DEPOIS_DA_SAIDA_MS);
  };
  const arrasto = useFolhaArrastavel(() => responder("fechou"), !!semMovimento);

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <FaixaDoRelogioSobFolha />
          <motion.button type="button" aria-label="Fechar" onClick={() => responder("fechou")} className={CLASSE_FUNDO_FOLHA} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.2 }} />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Tem uma Home nova" data-convite-home="" data-testid="home-convite"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card px-5 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+18px)] text-center"
            style={{ y: arrasto.y }} {...arrasto.folha}
            {...propsDaFolha(!!semMovimento)}
          >
            <Alca arrasto={arrasto} className="mb-1" />
            <div className="flex justify-center gap-3 mt-1">
              <MiniaturaHomeNova />
            </div>
            <h3 className="mt-4 text-[21px] font-bold tracking-tight">Tem uma Home nova</h3>
            <p className="mt-1.5 text-[14.5px] leading-snug text-muted-foreground">Seu dia num carrossel, módulos em grade e o + pra anotar rápido.<br />Dá pra voltar quando quiser em Você.</p>
            <button type="button" onClick={() => responder("experimentar")} data-testid="home-convite-experimentar" data-track="home-convite:experimentar"
              className="w-full h-12 mt-5 rounded-2xl bg-foreground text-background text-[15px] font-bold">Experimentar</button>
            <button type="button" onClick={() => responder("agora-nao")} data-testid="home-convite-agora-nao" data-track="home-convite:agora-nao"
              className="w-full h-11 mt-1.5 rounded-2xl text-[14.5px] font-semibold text-muted-foreground">Agora não</button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
