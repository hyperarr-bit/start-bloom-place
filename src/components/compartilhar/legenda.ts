import { diasMarcadosNoMes } from "./calendario";
import { capitalizar, desdeMes, lerMesId, nomeDoMes, numeroBR, palavra, plural, UNIDADES } from "./textos";
import type { DadosCard } from "./tipos";

/**
 * A LEGENDA CURTA de um card ("18 treinos em setembro.") — a miniatura na
 * folha de postar. Sem React e sem os cards (é leve: a folha das Conquistas
 * usa isto mesmo com a chave desligada, sem baixar os cards).
 */
const NIVEL = { bronze: "Bronze", prata: "Prata", ouro: "Ouro", platina: "Platina", diamante: "Diamante" } as const;

export const legendaDoCard = (d: DadosCard): string => {
  switch (d.tipo) {
    case "treinos": {
      if (d.periodo === "total") {
        const n = new Set(d.dias).size;
        const ini = [...new Set(d.dias)].sort()[0] ?? d.hoje;
        const { mesIdx, ano } = lerMesId(ini.slice(0, 7));
        return `${plural(n, UNIDADES.treino)} ${desdeMes(mesIdx, ano, d.ano)}.`;
      }
      const n = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias).length;
      return `${plural(n, UNIDADES.treino)} em ${nomeDoMes(d.mesIdx)}.`;
    }
    case "azul": {
      const u = d.meses[d.meses.length - 1];
      return d.meses.length === 1 ? `${capitalizar(nomeDoMes(lerMesId(u?.mes ?? "1970-01").mesIdx))} fechou no azul.` : `${plural(d.meses.length, UNIDADES.mes)} seguidos no azul.`;
    }
    case "poupanca": return `Guardei ${Math.round(d.pct)}% do que ganhei em ${nomeDoMes(d.mesIdx)}.`;
    case "livros": return `${plural(d.livros.length, UNIDADES.livro)} ${d.livros.length === 1 ? "lido" : "lidos"} ${d.periodo === "mes" ? `em ${nomeDoMes(d.mesIdx)}` : `em ${d.ano}`}.`;
    case "sequencia": return `${plural(d.dias, UNIDADES.diaSeguido)}.`;
    case "agua": { const n = d.porDia.filter((f) => f >= 1).length; return `${plural(n, UNIDADES.dia)} na meta de água.`; }
    case "sono": { const n = d.horas.filter((h) => h != null && h >= d.meta).length; return `${plural(n, UNIDADES.noite)} com ${numeroBR(d.meta, 1)} h ou mais.`; }
    case "habitos": { const n = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias).length; return `${plural(n, UNIDADES.dia)} de ${d.habito.toLowerCase()}.`; }
    case "metas": return `${d.feitas}/${Math.max(d.total, d.feitas)} ${palavra(d.total, UNIDADES.meta)} do mês ${d.feitas === 1 ? "batida" : "batidas"}.`;
    case "insignia": return `${d.moduloNome} evoluiu: ${NIVEL[d.nivel]}.`;
    case "figurinha": return `${d.titulo}: ${d.descricao}.`;
    case "numero": return `${d.numero} ${d.rotulo}${d.sub ? ` ${d.sub}` : ""}.`;
  }
};
