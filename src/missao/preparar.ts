import { localDayKey } from "@/lib/utils";
import { MODULOS, gravarMissao, iniciarMissao, lerMissao, modulosPadrao } from "@/lib/missao-doses";
import { AREA_DO_APP, gravarMissaoWeb, lerMissaoWeb, ligarForcasDaMissao, type AreaMissaoWeb } from "@/lib/missao-web";

/** Liga o convidado da missão e devolve a rota do módulo da 1ª dose. Idempotente (voltar e tocar de novo não refaz). */
export function prepararMissao(area: AreaMissaoWeb, sessao: string): string {
  ligarForcasDaMissao();
  const areaApp = AREA_DO_APP[area];
  try { localStorage.setItem("core-funnel-area", areaApp); } catch { /* storage bloqueado: a missão cai em Finanças */ }
  const web = lerMissaoWeb();
  // a URL do anúncio, enquanto ainda é a do /missao (o source_url do Pix e da CAPI separa a venda deste funil)
  let landing: string | null = null;
  try { if (window.location.pathname.startsWith("/missao")) landing = window.location.href.slice(0, 300); } catch { /* noop */ }
  if (!web || web.area !== area) gravarMissaoWeb({ v: 1, area, em: Date.now(), sessao, pago: null, email: null, landing });
  else if (!web.landing && landing) gravarMissaoWeb({ ...web, landing });
  let m = lerMissao();
  if (!m || (!m.feitos[1] && m.modulos[0] !== modulosPadrao(areaApp)[0])) {
    m = iniciarMissao(modulosPadrao(areaApp), localDayKey(), undefined, "A");
  }
  if (!m.boasVindas) m = gravarMissao({ ...m, boasVindas: true }); // a tela 2 do funil É a boas-vindas
  return MODULOS[m.modulos[0]].rota;
}

