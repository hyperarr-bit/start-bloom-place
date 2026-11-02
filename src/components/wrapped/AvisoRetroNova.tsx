import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { construirRetroMes, type Leitor } from "@/lib/retrospectiva";
import { RETRO_OUTUBRO } from "@/lib/retro-outubro";
import {
  CHAVE_RETRO_AVISO, CHAVE_RETRO_NOVA_ABERTA, ESPERA_AVISO_RETRO_MS, deveMostrarAvisoRetro, janelaDoAvisoRetro, marcarAvisoRetroNoAparelho, marcarAvisoRetroNestaAbertura, _zerarMarcaAvisoRetroNestaAbertura } from "@/lib/retro-aviso";
import { conviteApareceuNestaAbertura, telaOcupadaParaConvite } from "@/components/home-nova/EscolhaDaHome";
import { Alca, CLASSE_FUNDO_FOLHA, FaixaDoRelogioSobFolha, propsDaFolha, useFolhaArrastavel } from "@/components/home-nova/e/folha-arrasto";

/**
 * "Sua retrospectiva de outubro ganhou cara nova" (01/11, dono) — a folha de baixo da Home (as duas Homes),
 * 1x por conta, pra toda conta com outubro que ainda não abriu a retrospectiva NOVA. Regras em lib/retro-aviso.
 *
 * A pilha (o mesmo critério do convite da Home nova, EscolhaDaHome): espera a Home assentar e só abre com a tela
 * livre (nenhuma folha, festa, guia da missão, convite, campo com teclado); ocupada, olha de novo depois. O convite
 * "Tem uma Home nova" tem a vez: se ele apareceu nesta abertura, o aviso fica pra próxima.
 * Gravado na hora em que APARECE (conta + aparelho): fechar o app com a folha na tela não a repete.
 *
 * Visual (o da retrospectiva nova, sem enfeite): a abertura do Codex em miniatura — "Seu outubro, do seu jeito." —
 * desenhada aqui mesmo (os cards de compartilhar são um pacote pesado que a Home não precisa baixar).
 */
const MES = "Outubro";
const ROTA = `/retrospectiva?mes=${encodeURIComponent(MES)}&origem=aviso`;
const TENTATIVAS = 20;
const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

let avisoNestaAbertura = false;
/** Só testes. */
export const _zerarAvisoRetroNestaAbertura = (): void => { avisoNestaAbertura = false; _zerarMarcaAvisoRetroNestaAbertura(); };

const telaOcupada = (): boolean =>
  telaOcupadaParaConvite() || (typeof document !== "undefined" && !!document.querySelector("[data-convite-home]"));

/** A abertura da retrospectiva nova em miniatura (um objeto: igual no claro e no escuro). */
const AberturaMiniatura = () => (
  <div
    aria-hidden
    data-testid="retro-aviso-abertura"
    className="relative w-full overflow-hidden text-left"
    style={{ height: 150, borderRadius: 18, background: "linear-gradient(172deg, #2c2b31 0%, #232228 55%, #1d1c21 100%)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)", fontFamily: INTER, WebkitFontSmoothing: "antialiased" }}
  >
    <div className="absolute flex items-center justify-between" style={{ left: 18, right: 18, top: 16, color: "#d6d0d8", fontSize: 10.5, letterSpacing: ".1em", fontWeight: 800 }}>
      <span>RETROSPECTIVA</span>
      <span style={{ letterSpacing: ".01em", fontWeight: 700 }}>OUT / 26</span>
    </div>
    <div className="absolute" style={{ left: 16, top: 46, fontSize: 31, fontWeight: 900, letterSpacing: "-0.032em", lineHeight: 1.15, whiteSpace: "nowrap" }}>
      <div style={{ color: "#fffdf8" }}>Seu outubro,</div>
      <div style={{ color: "#db2777" }}>do seu jeito.</div>
    </div>
  </div>
);

export function AvisoRetroNova({ bloqueado = false, agora: agoraFixo }: { bloqueado?: boolean; agora?: Date }) {
  const auth = useAuth();
  const uid = auth?.user?.id ?? null;
  const { get, set, loaded, contaCompleta, isGuest } = useUserData();
  const navigate = useNavigate();
  const semMovimento = useReducedMotion();
  const [aberta, setAberta] = useState(false);
  const agoraDaMontagem = useRef(new Date());
  const agora = agoraFixo ?? agoraDaMontagem.current;

  const novaAbertaNaConta = get<unknown>(CHAVE_RETRO_NOVA_ABERTA, null);
  const avisoNaConta = get<unknown>(CHAVE_RETRO_AVISO, null);
  const contaCarregada = loaded && contaCompleta !== false;
  const janela = janelaDoAvisoRetro(agora);
  // o cálculo do mês (o caro) só quando o resto já deixa
  const preliminar = !avisoNestaAbertura && deveMostrarAvisoRetro({ userId: uid, contaCarregada, convidado: isGuest, janela, temOutubro: true, novaAbertaNaConta, avisoNaConta });
  const temOutubro = useMemo(() => {
    if (!preliminar || !uid) return false;
    const ler: Leitor = (chave) => get<unknown>(chave, undefined);
    return construirRetroMes(RETRO_OUTUBRO.ano, RETRO_OUTUBRO.mesIdx, uid, undefined, { ler, agora }) !== null;
  }, [preliminar, uid, get, agora]);
  const pode = preliminar && temOutubro;

  const setRef = useRef(set);
  setRef.current = set;
  useEffect(() => {
    if (!pode || bloqueado || aberta || !uid) return;
    let tentativas = 0;
    let t: ReturnType<typeof setTimeout>;
    const tentar = () => {
      if (avisoNestaAbertura || conviteApareceuNestaAbertura()) return;
      if (telaOcupada()) { if (++tentativas < TENTATIVAS) t = setTimeout(tentar, ESPERA_AVISO_RETRO_MS); return; }
      avisoNestaAbertura = true;
      marcarAvisoRetroNestaAbertura(); // o convite da Home nova cede a vez nesta abertura
      marcarAvisoRetroNoAparelho(uid);
      setRef.current(CHAVE_RETRO_AVISO, { em: new Date().toISOString(), resposta: "visto" }, { system: true });
      trackEvent("retro_aviso_visto", { month: MES });
      setAberta(true);
    };
    t = setTimeout(tentar, ESPERA_AVISO_RETRO_MS);
    return () => clearTimeout(t);
  }, [pode, bloqueado, aberta, uid]);

  const responder = (resposta: "abrir" | "fechar") => {
    setAberta(false);
    set(CHAVE_RETRO_AVISO, { em: new Date().toISOString(), resposta }, { system: true });
    trackEvent(resposta === "abrir" ? "retro_aviso_abrir" : "retro_aviso_fechar", { month: MES });
    if (resposta === "abrir") navigate(ROTA);
  };
  const arrasto = useFolhaArrastavel(() => responder("fechar"), !!semMovimento);

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <FaixaDoRelogioSobFolha />
          <motion.button type="button" aria-label="Fechar" onClick={() => responder("fechar")} className={CLASSE_FUNDO_FOLHA} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.2 }} />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Sua retrospectiva de outubro ganhou cara nova" data-aviso-retro="" data-testid="retro-aviso"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card px-5 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+18px)] text-center"
            style={{ y: arrasto.y }} {...arrasto.folha}
            {...propsDaFolha(!!semMovimento)}
          >
            <Alca arrasto={arrasto} className="mb-1" />
            <AberturaMiniatura />
            <h3 className="mt-5 text-[21px] leading-tight font-bold tracking-tight">Sua retrospectiva de outubro ganhou cara nova</h3>
            <button type="button" onClick={() => responder("abrir")} data-testid="retro-aviso-ver" data-track="retro-aviso:ver"
              className="w-full h-12 mt-5 rounded-2xl bg-foreground text-background text-[15px] font-bold">Ver agora</button>
            <button type="button" onClick={() => responder("fechar")} data-testid="retro-aviso-agora-nao" data-track="retro-aviso:agora-nao"
              className="w-full h-11 mt-1.5 rounded-2xl text-[14.5px] font-semibold text-muted-foreground">Agora não</button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default AvisoRetroNova;
