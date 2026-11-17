import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { EVENTO_NOVO_INDIQUE, TEXTO_ENTRADA_INDIQUE, gravarMarcaNovo, lerMarcaNovo, seloNovoNaLinha } from "@/lib/indique-entrada";
import { useIndiqueElegivel } from "./use-indique-elegivel";
import { consumirDestaqueIndique } from "./destaque";
import { COMISSAO_POR_AMIGA_CENTS, reaisBr } from "../../../supabase/functions/_shared/indique";

/**
 * A ENTRADA FIXA DO INDIQUE E GANHE (17/11) — "💗 Indique e ganhe · R$ 33,95 por amiga, sem limite", uma linha discreta e PERMANENTE na página
 * Você do SITE, logo abaixo do presente. Só o site (iPhone e Android da loja nunca). Chave INDIQUE_ENTRADA (src/lib/indique-entrada.ts, "off").
 * 17/11 (subida): pra QUALQUER cliente pagante logado (use-indique-elegivel). Selo "Novo" até o 1º toque (lib/indique-entrada); chegando pelo
 * balão "Novo" (AvisoNovoIndique) a linha ganha um anel rosa por 2,4 s.
 * O toque pede o painel (função afiliados, indique_conta, com o login) e abre /indique/<token>.
 * Eventos: indique_entrada_view {estilo} · indique_entrada_toque {estilo, novo}.
 */
export function EntradaIndique({ estilo, ligadaTeste, novoTeste }: { estilo: "classico" | "e" | "menu"; ligadaTeste?: boolean; novoTeste?: boolean }) {
  const { elegivel, uid } = useIndiqueElegivel(ligadaTeste);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, setVersao] = useState(0);
  const [destaque, setDestaque] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const conta = uid ?? (ligadaTeste ? "dev" : null);

  useEffect(() => {
    const reler = () => setVersao((v) => v + 1);
    window.addEventListener(EVENTO_NOVO_INDIQUE, reler);
    return () => window.removeEventListener(EVENTO_NOVO_INDIQUE, reler);
  }, []);

  const mostrar = elegivel && !!conta;
  useEffect(() => {
    if (!mostrar || !conta) return;
    trackEvent("indique_entrada_view", { estilo });
    // ela viu a linha: o pontinho da aba some (o selo "Novo" fica até o toque)
    const m = lerMarcaNovo(conta);
    if (m && !m.voce && !novoTeste) gravarMarcaNovo(conta, { voce: Date.now() });
    if (consumirDestaqueIndique()) {
      setDestaque(true);
      try { ref.current?.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* noop */ }
      const t = window.setTimeout(() => setDestaque(false), 2400);
      return () => window.clearTimeout(t);
    }
  }, [mostrar, conta, estilo, novoTeste]);
  if (!mostrar || !conta) return null;
  const novo = novoTeste ?? seloNovoNaLinha(lerMarcaNovo(conta));

  const abrir = async () => {
    if (abrindo) return;
    setAbrindo(true); setErro(null);
    trackEvent("indique_entrada_toque", { estilo, novo });
    gravarMarcaNovo(conta, { aberto: true });
    const { data } = await supabase.functions.invoke("afiliados", { body: { action: "indique_conta" } }).catch(() => ({ data: null }));
    setAbrindo(false);
    const d = (data ?? {}) as { ok?: boolean; painel?: string; motivo?: string };
    if (d.ok === true && typeof d.painel === "string") {
      // críticas 17/11: carregamento NOVO da página (não navigate do React) — o pixel da Meta já carregado no app manda PageView com
      // a URL a cada troca de rota, e a URL do painel tem o token (a senha). Na página nova, o index.html não carrega pixel nenhum.
      try { window.location.assign(new URL(d.painel).pathname); } catch { setErro("Não abriu agora. Toque pra tentar de novo."); }
      return;
    }
    setErro(d.motivo === "sem_compra" ? "Vale pra quem já assina o CORE." : "Não abriu agora. Toque pra tentar de novo.");
  };

  const linha = (
    <button type="button" onClick={() => { void abrir(); }} disabled={abrindo} data-testid="entrada-indique" data-estilo={estilo}
      className="w-full min-h-[52px] flex items-center gap-3 px-4 text-left disabled:opacity-60">
      <span className="text-[18px] leading-none shrink-0" aria-hidden>💗</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium">
          {TEXTO_ENTRADA_INDIQUE}
          {novo && <span className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] leading-none px-1.5 py-[3px] rounded-full text-white" style={{ background: "hsl(330 65% 50%)" }} data-testid="entrada-indique-novo">Novo</span>}
        </span>
        <span className="block text-[12px] leading-snug text-muted-foreground">{erro ?? (abrindo ? "Abrindo seu link…" : `${reaisBr(COMISSAO_POR_AMIGA_CENTS)} por amiga, sem limite`)}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" aria-hidden />
    </button>
  );
  const anel = destaque ? { boxShadow: "0 0 0 3px hsl(330 65% 50% / 0.35)", transition: "box-shadow .3s" } : { transition: "box-shadow .6s" };
  if (estilo === "e") return <div ref={ref} className="hn-card mt-3 overflow-hidden" style={anel} data-destaque={destaque ? "" : undefined}>{linha}</div>;
  return <div ref={ref} style={anel} className="rounded-2xl" data-destaque={destaque ? "" : undefined}><section className={`bg-card rounded-2xl border ${estilo === "menu" ? "border-border/70" : "border-border/60"} overflow-hidden`}>{linha}</section></div>;
}
