import { Check } from "lucide-react";
import { PLANO_30_DIAS, SEMANAS_DO_KIT } from "@/lib/kit-primeiro-mes";
import { VALOR_PLANO30, type VersaoPlano30 } from "@/lib/presente";
import { PixIcone } from "@/pages/hoje/PixHoje";

/**
 * O DOWNSELL do "Agora não" do presente (21/10, mockups k-visual-dinheiro / k-curta-dinheiro): "Seu plano de 30 dias
 * pra organizar a vida" — o conteúdo do Kit Primeiro Mês (PLANO_30_DIAS), começando por Dinheiro. Só a área Dinheiro
 * existe por enquanto (as outras esperam o dono aprovar o conteúdo — src/lib/presente.ts AREAS_COM_PLANO30).
 */
const FIM_DO_PLANO30_DINHEIRO = ["Contas e vencimentos no lugar", "1 vazamento cortado e as dívidas em ordem", "A reserva começada"];
const DIAS = PLANO_30_DIAS.slice(0, 4);
const SEMANAS = SEMANAS_DO_KIT.map((s) => s.titulo);
const reais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export function OfertaPlano30({ versao, onSim, onNao }: { versao: VersaoPlano30; onSim: () => void; onNao: () => void }) {
  const topo = (
    <div className="pv-topo">
      <span className="pv-marca"><i />CORE</span>
      <span className="pv-ok"><Check size={14} strokeWidth={3.4} />CORE pra sempre · ativo</span>
    </div>
  );
  const area = <span className="pk-area" style={{ ["--pk-cor" as string]: "#92400e", ["--pk-cor-suave" as string]: "#fef3c7" }}>💰 Começando por Dinheiro</span>;
  if (versao === "curta") {
    return (
      <div className="pv-tela" data-testid="plano30" data-versao="curta">
        <div className="pv-col">
          {topo}
          <h1 className="pv-titulo pk-titulo" style={{ marginTop: 22 }}>30 dias pra organizar a <em>vida</em></h1>
          <p className="pv-sub">1 tarefa por dia · 💰 começando por Dinheiro</p>
          <div className="pk-trilho">
            {SEMANAS.map((s, i) => (
              <div className="pk-trilho-sem" key={s} data-on={i === 0 ? "" : undefined}>
                <b>{i + 1}</b>
                <span>{s}{i === 0 && <small>Dia 1: {DIAS[0].titulo.toLowerCase()}</small>}</span>
              </div>
            ))}
          </div>
          <div className="pk-preco">
            <div><b>No dia 30: contas e vencimentos no lugar</b><small>Pix, uma vez · aparece no app hoje</small></div>
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
    <div className="pv-tela" data-testid="plano30" data-versao="visual">
      <div className="pv-col">
        {topo}
        <h1 className="pv-titulo pk-titulo" style={{ marginTop: 20 }}>Seu plano de 30 dias pra organizar a <em>vida</em></h1>
        <div className="pk-centro">{area}</div>
        <div className="pk-folha">
          <div className="pk-folha-topo"><span className="pk-semana">Semana 1 · {SEMANAS[0]}</span><span className="pk-semana">2 min/dia</span></div>
          {DIAS.map((t, i) => (
            <div className="pk-dia" key={t.dia} data-feito={i === 0 ? "" : undefined} data-apaga={i === 3 ? "" : undefined}>
              <span className="pk-caixa">{i === 0 && <Check size={13} strokeWidth={3.6} />}</span>
              <span className="pk-dia-txt"><small>Dia {t.dia}</small><b>{t.titulo}</b></span>
            </div>
          ))}
          <div className="pk-mais">+ {PLANO_30_DIAS.length - DIAS.length} dias</div>
          <div className="pk-semanas">{SEMANAS.map((s, i) => <span key={s} data-on={i === 0 ? "" : undefined}>{s}</span>)}</div>
        </div>
        <div className="pk-fim">
          <p className="pk-fim-titulo">No dia 30</p>
          <ul>{FIM_DO_PLANO30_DINHEIRO.map((f) => <li key={f}><i><Check size={12} strokeWidth={3.6} /></i>{f}</li>)}</ul>
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
