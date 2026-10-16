import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { CATEGORIAS_PADRAO_MERCADO, type CategoriaMercado } from "@/lib/mercado";
import type { EstadoVazioConfig } from "@/lib/intro-modulo";
import { abrirAba } from "@/components/cartoes-modulo/registro";
import "./intro-modulo.css";

/**
 * ESTADO VAZIO COM CAPTURA REAL (protótipo 16/10) — o padrão pros módulos que NÃO levam a
 * intro guiada: um card inline no topo do módulo (onde o "Dicas para começar" ficava), com
 *   · a faixa de planner (caixa alta, cor do módulo) e "Ver tudo" pra fechar;
 *   · uma captura REAL do módulo em uso (vídeo de ~6 s, mudo, em loop, gravado do app;
 *     poster estático porque o Modo Pouca Energia do iPhone bloqueia autoplay);
 *   · 1 frase e UMA ação de 1 toque que já deixa o módulo com conteúdo de verdade.
 * Protótipo: Casa › Mercado ("Começar com 3 itens" põe leite, pão e café na lista real).
 *
 * Eventos: modulo_intro_vista {modulo, formato:"vazio"} · modulo_intro_acao {modulo} ·
 * modulo_intro_pulou {modulo, fase:"vazio"} · modulo_intro_concluida {modulo}.
 */
const ITENS_DE_CASA: Array<{ cat: string; text: string }> = [
  { cat: "3", text: "Leite" }, // Laticínios
  { cat: "5", text: "Pão" }, // Padaria
  { cat: "4", text: "Café" }, // Mercearia
];

export function EstadoVazio({ config, aoTerminar }: { config: EstadoVazioConfig; aoTerminar: (como: "feita" | "pulada") => void }) {
  const { get, set } = useUserData();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    trackEvent("modulo_intro_vista", { modulo: config.moduleId, formato: "vazio" });
    // autoplay negado (Pouca Energia): fica o poster; o 1º toque na mídia tenta de novo
    try { video.current?.play().catch(() => { /* fica o poster */ }); } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agir = () => {
    trackEvent("modulo_intro_acao", { modulo: config.moduleId });
    if (config.moduleId === "casa") {
      const atual = get<unknown>("casa-grocery-categories", CATEGORIAS_PADRAO_MERCADO);
      const cats: CategoriaMercado[] = Array.isArray(atual) && atual.length ? (atual as CategoriaMercado[]) : CATEGORIAS_PADRAO_MERCADO;
      const agora = Date.now();
      const proximo = cats.map((c) => {
        const novos = ITENS_DE_CASA.filter((i) => i.cat === c.id && !c.items.some((x) => x.text.toLowerCase() === i.text.toLowerCase()));
        return novos.length ? { ...c, items: [...c.items, ...novos.map((i, k) => ({ id: `${agora + k}-${i.cat}`, text: i.text, done: false }))] } : c;
      });
      set("casa-grocery-categories", proximo);
      avisarEscritaDeFora("casa-grocery-categories", proximo);
      if (config.aba) abrirAba(config.aba);
    }
    trackEvent("modulo_intro_concluida", { modulo: config.moduleId });
    aoTerminar("feita");
  };

  return (
    <section className="im-vazio mb-4" data-testid="intro-modulo-vazio" data-modulo={config.moduleId} aria-label={`Primeira vez: ${config.nome}`}>
      <div className="im-vazio-faixa" style={{ background: config.cor.faixa, color: config.cor.tinta }}>
        <span>Primeira vez · {config.nome}</span>
        <button type="button" className="im-vazio-fechar" data-testid="intro-modulo-ver-tudo" onClick={() => { trackEvent("modulo_intro_pulou", { modulo: config.moduleId, fase: "vazio" }); aoTerminar("pulada"); }}>Ver tudo</button>
      </div>
      <div className="im-vazio-corpo">
        <button type="button" className="im-vazio-midia" aria-label={config.midia.legenda} onClick={() => { try { video.current?.play().catch(() => { /* noop */ }); } catch { /* noop */ } }}>
          <video ref={video} src={config.midia.video} poster={config.midia.poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" />
          <span className="im-vazio-legenda">{config.midia.legenda}</span>
        </button>
        <div>
          <h3 className="im-vazio-titulo">{config.titulo}</h3>
          <p className="im-vazio-texto">{config.texto}</p>
          <button type="button" className="im-vazio-acao" style={{ background: config.cor.acento }} data-testid="intro-modulo-acao" onClick={agir}>
            <Plus className="w-4 h-4" strokeWidth={3} /> {config.acao.rotulo}
          </button>
          <p className="im-vazio-detalhe">{config.acao.detalhe}</p>
        </div>
      </div>
    </section>
  );
}
