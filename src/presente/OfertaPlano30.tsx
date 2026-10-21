import { Check } from "lucide-react";
import { VALOR_PLANO30, type VersaoPlano30 } from "@/lib/presente";
import { planoDaArea, type AreaDoPlano } from "@/lib/plano-30-areas";
import { PixIcone } from "@/pages/hoje/PixHoje";

/**
 * O DOWNSELL do "Agora não" do presente (21/10, mockups k-visual-* / k-curta-*): "Seu plano de 30 dias pra organizar
 * a vida", personalizado pela ÁREA do quiz (src/lib/plano-30-areas.ts): a folha de planner com os 4 primeiros dias
 * reais do plano (o dia 1 marcado), as 4 semanas, o "No dia 30" e o preço. Dinheiro = o Kit Primeiro Mês.
 */
const COR_DA_AREA: Record<AreaDoPlano, { cor: string; suave: string }> = {
  dinheiro: { cor: "#92400e", suave: "#fef3c7" },
  rotina: { cor: "#9d174d", suave: "#fce7f3" },
  corpo: { cor: "#5b21b6", suave: "#ede9fe" },
  saude: { cor: "#b91c1c", suave: "#fee2e2" },
  metas: { cor: "#1d4ed8", suave: "#dbeafe" },
  tudo: { cor: "#16121c", suave: "#ece8f0" },
};
const reais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function OfertaPlano30({ area, versao, onSim, onNao }: { area: AreaDoPlano; versao: VersaoPlano30; onSim: () => void; onNao: () => void }) {
  const plano = planoDaArea(area);
  const dias = plano.tarefas.slice(0, 4);
  const semanas = plano.semanas.map((s) => s.titulo);
  const comeco = area === "tudo" ? "Um pouco de tudo" : `Começando por ${plano.nome}`;
  const topo = (
    <div className="pv-topo">
      <span className="pv-marca"><i />CORE</span>
      <span className="pv-ok"><Check size={14} strokeWidth={3.4} /><span>CORE pra sempre · ativo</span></span>
    </div>
  );
  const chip = (
    <span className="pk-area" data-testid="plano30-area" style={{ ["--pk-cor" as string]: COR_DA_AREA[area].cor, ["--pk-cor-suave" as string]: COR_DA_AREA[area].suave }}>
      {plano.emoji} {comeco}
    </span>
  );
  if (versao === "curta") {
    return (
      <div className="pv-tela" data-testid="plano30" data-versao="curta" data-area={area}>
        <div className="pv-col">
          {topo}
          <h1 className="pv-titulo pk-titulo" style={{ marginTop: 22 }}>30 dias pra organizar a <em>vida</em></h1>
          <p className="pv-sub">1 tarefa por dia · {plano.emoji} {minuscula(comeco)}</p>
          <div className="pk-trilho">
            {semanas.map((s, i) => (
              <div className="pk-trilho-sem" key={s} data-on={i === 0 ? "" : undefined}>
                <b>{i + 1}</b>
                <span>{s}{i === 0 && <small>Dia 1: {minuscula(dias[0].titulo)}</small>}</span>
              </div>
            ))}
          </div>
          <div className="pk-preco">
            <div><b>No dia 30: {minuscula(plano.fim[0])}</b><small>Pix, uma vez · aparece no app hoje</small></div>
            <strong data-testid="plano30-preco">{reais(VALOR_PLANO30)}</strong>
          </div>
        </div>
        <div className="pv-rodape">
          <button type="button" className="pv-cta" onClick={onSim} data-testid="plano30-sim"><PixIcone /><span>Quero meu plano · {reais(VALOR_PLANO30)}</span></button>
          <button type="button" className="pv-nao" onClick={onNao} data-testid="plano30-nao">Não, obrigado</button>
        </div>
      </div>
    );
  }
  return (
    <div className="pv-tela" data-testid="plano30" data-versao="visual" data-area={area}>
      <div className="pv-col">
        {topo}
        <h1 className="pv-titulo pk-titulo" style={{ marginTop: 20 }}>Seu plano de 30 dias pra organizar a <em>vida</em></h1>
        <div className="pk-centro">{chip}</div>
        <div className="pk-folha">
          <div className="pk-folha-topo"><span className="pk-semana">Semana 1 · {semanas[0]}</span><span className="pk-semana">2 min/dia</span></div>
          {dias.map((t, i) => (
            <div className="pk-dia" key={t.dia} data-feito={i === 0 ? "" : undefined} data-apaga={i === 3 ? "" : undefined}>
              <span className="pk-caixa">{i === 0 && <Check size={13} strokeWidth={3.6} />}</span>
              <span className="pk-dia-txt"><small>Dia {t.dia}</small><b>{t.titulo}</b></span>
            </div>
          ))}
          <div className="pk-mais">+ {plano.tarefas.length - dias.length} dias</div>
          <div className="pk-semanas">{semanas.map((s, i) => <span key={s} data-on={i === 0 ? "" : undefined}>{s}</span>)}</div>
        </div>
        <div className="pk-fim">
          <p className="pk-fim-titulo">No dia 30</p>
          <ul>{plano.fim.map((f) => <li key={f}><i><Check size={12} strokeWidth={3.6} /></i>{f}</li>)}</ul>
        </div>
      </div>
      <div className="pv-rodape">
        <div className="pk-preco-linha"><strong data-testid="plano30-preco">{reais(VALOR_PLANO30)}</strong><small>Pix, uma vez · no app hoje</small></div>
        <button type="button" className="pv-cta" onClick={onSim} data-testid="plano30-sim"><PixIcone /><span>Quero meu plano</span></button>
        <button type="button" className="pv-nao" onClick={onNao} data-testid="plano30-nao">Não, obrigado</button>
      </div>
    </div>
  );
}
