import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, LoaderCircle, Printer, Share } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";
import { A4_PX, folhasDoPlanner, resumoDoPlanner, type DadosDoPlanner, type EstiloPlanner } from "@/lib/planner-2027";
import { garantirCssDoPlanner, imprimirPlannerNoSite, salvarPlannerNoAparelho } from "@/lib/planner-2027-baixar";

const ESCALA = 0.25;

/** Uma folha em miniatura: o MESMO HTML que vai pra impressão / PNG, só reduzido. */
export function FolhaMini({ html, estilo, escala = ESCALA, rotulo }: { html: string; estilo: EstiloPlanner; escala?: number; rotulo: string }) {
  return (
    <div role="img" aria-label={rotulo} className="shrink-0 overflow-hidden rounded-[10px] bg-white shadow-[0_6px_22px_-8px_rgba(0,0,0,.28)] ring-1 ring-black/5 snap-start"
      style={{ width: A4_PX.largura * escala, height: A4_PX.altura * escala }}>
      <div style={{ width: A4_PX.largura, height: A4_PX.altura, transform: `scale(${escala})`, transformOrigin: "0 0" }}
        className={`pl pl-${estilo} pointer-events-none select-none`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

const ROTULOS = ["Capa", "Meu ano", "Calendário", "Metas", "Dinheiro", "Rotina", "Cofrinho", "Revisões", "16 áreas", "16 áreas", "16 áreas", "16 áreas"];

/**
 * A FOLHA "SEU PLANNER 2027" (versão B, 31/10): a prévia das 12 folhas com os dados dela, o que entrou do CORE e o
 * botão que funciona onde ela está — site: imprimir/PDF; app do iPhone: as folhas em PNG pela folha nativa.
 * Quem planejou pouco vê um convite curto pra planejar (não bloqueia: o planner sai com linhas pra escrever).
 */
export function PlannerB({ dados, estilo, onVoltar, onPlanejar }: { dados: DadosDoPlanner; estilo: EstiloPlanner; onVoltar: () => void; onPlanejar: () => void }) {
  const nativo = isNativeShell();
  const folhas = useMemo(() => folhasDoPlanner(dados, estilo), [dados, estilo]);
  const r = resumoDoPlanner(dados);
  const [feitas, setFeitas] = useState<number | null>(null);
  const ocupado = useRef(false);

  useEffect(() => { garantirCssDoPlanner(estilo); }, [estilo]);
  useEffect(() => {
    trackEvent("plano2027_planner_view", { estilo, nativo, metas: r.metas, datas: r.datas, habitos: r.habitos, contas: r.contas, pouco: r.pouco });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itens: { ok: boolean; texto: string }[] = [
    { ok: r.metas > 0, texto: r.metas ? `${r.metas === 1 ? "1 meta" : `${r.metas} metas`} de 2027` : "Metas: linhas pra escrever" },
    { ok: r.dinheiro, texto: r.dinheiro ? "Gastar e guardar por mês" : "Dinheiro: linhas pra escrever" },
    { ok: r.datas > 0, texto: r.datas ? `${r.datas === 1 ? "1 data marcada" : `${r.datas} datas marcadas`} no calendário` : "Calendário pra marcar" },
    { ok: r.habitos > 0, texto: r.habitos ? `${r.habitos === 1 ? "1 hábito" : `${r.habitos} hábitos`} da sua Rotina` : "Hábitos: linhas pra escrever" },
    { ok: r.contas > 0, texto: r.contas ? `${r.contas === 1 ? "1 conta fixa" : `${r.contas} contas fixas`} do Finanças` : "Contas fixas: linhas pra escrever" },
  ];

  const baixar = async () => {
    if (ocupado.current) return;
    trackEvent("plano2027_pdf", { nativo, versao: "b", estilo, pouco: r.pouco });
    if (!nativo) {
      if (!imprimirPlannerNoSite(dados, estilo)) toast.error("O navegador bloqueou a janela. Libere pop-ups e tente de novo.");
      return;
    }
    ocupado.current = true;
    setFeitas(0);
    try {
      const res = await salvarPlannerNoAparelho(dados, estilo, (n) => setFeitas(n));
      trackEvent("plano2027_pdf_resultado", { resultado: res, estilo });
      if (res === "failed") toast.error("Não deu pra preparar as folhas. Tenta de novo.");
    } catch {
      toast.error("Não deu pra preparar as folhas. Tenta de novo.");
    } finally {
      ocupado.current = false;
      setFeitas(null);
    }
  };

  return (
    <div className="space-y-4 pb-6" data-testid="planner-b" data-estilo={estilo}>
      <button type="button" onClick={onVoltar} className="text-[12px] font-bold text-muted-foreground inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4" /><span>Seu 2027</span></button>
      <div>
        <h2 className="text-[24px] leading-tight font-black tracking-tight">Seu planner 2027</h2>
        <p className="text-[13.5px] text-muted-foreground mt-1">12 folhas A4, montadas com o que você tem no CORE.</p>
      </div>

      <div className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none]" data-testid="planner-b-previa">
        {folhas.map((h, i) => <FolhaMini key={i} html={h} estilo={estilo} rotulo={`Folha ${i + 1}: ${ROTULOS[i]}`} />)}
      </div>

      {r.pouco && (
        <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-4" data-testid="planner-b-planejar">
          <p className="text-[13.5px] font-bold leading-snug">Planeje o 2027 e ele sai com as suas metas.</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">5 minutos. Ou imprima assim e escreva à mão.</p>
          <button type="button" onClick={() => { trackEvent("plano2027_aberto", { via: "planner_b" }); onPlanejar(); }}
            className="mt-3 h-10 px-4 rounded-full bg-foreground text-background text-[13px] font-extrabold inline-flex items-center gap-1.5">
            <span>Planejar 2027</span><ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div>
        <div>
          <button type="button" onClick={() => void baixar()} disabled={feitas !== null} data-testid="planner-b-baixar"
            className="w-full h-12 rounded-full bg-foreground text-background text-[14.5px] font-extrabold inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-80">
            {feitas !== null
              ? <><LoaderCircle className="w-4 h-4 animate-spin" /><span>Preparando {feitas} de {folhas.length}…</span></>
              : nativo ? <><Share className="w-4 h-4" /><span>Salvar ou imprimir</span></> : <><Printer className="w-4 h-4" /><span>Imprimir ou salvar em PDF</span></>}
          </button>
          <p className="text-[11.5px] text-muted-foreground text-center mt-1.5">{nativo ? "Abre a folha do iPhone: Imprimir, Salvar imagens ou Arquivos." : "Na impressão, escolha “Salvar como PDF” pra guardar."}</p>
        </div>
      </div>
      <ul className="bg-card rounded-xl border border-border p-3 space-y-2" data-testid="planner-b-itens">
        {itens.map((it) => (
          <li key={it.texto} className="flex items-center gap-2.5 text-[13px]">
            <span className={`grid place-items-center w-5 h-5 rounded-full shrink-0 ${it.ok ? "bg-emerald-500 text-white" : "border-2 border-border"}`}>{it.ok && <Check className="w-3 h-3" strokeWidth={3.2} />}</span>
            <span className={it.ok ? "font-semibold" : "text-muted-foreground"}>{it.texto}</span>
          </li>
        ))}
      </ul>

    </div>
  );
}
