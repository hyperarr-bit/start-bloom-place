/**
 * 14/10 (chamado: "toda vez que eu entro ou mudo de tela aparece o tutorial"). A vassoura do cache
 * por conta (purgeUserLocalCache) roda em toda abertura do app e levava as chaves "core-*" do
 * APARELHO: o "já vi" do tour da Home e dos cartões dos módulos voltava a zero a cada abertura.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { purgeUserLocalCache } from "@/hooks/use-user-data";
import { CHAVE_TOUR_FEITO, chaveCartoesVistos, marcarTourFeito, marcarCartoesVistos, tourFeitoNesteAparelho, cartoesVistosNesteAparelho } from "@/lib/tour-home";

describe("vassoura não leva o 'já vi' do aparelho", () => {
  beforeEach(() => localStorage.clear());

  it("tour da Home e cartões dos módulos sobrevivem à limpeza da abertura", () => {
    marcarTourFeito();
    marcarCartoesVistos("treino");
    marcarCartoesVistos("financas");
    purgeUserLocalCache();
    expect(tourFeitoNesteAparelho()).toBe(true);
    expect(cartoesVistosNesteAparelho("treino")).toBe(true);
    expect(cartoesVistosNesteAparelho("financas")).toBe(true);
    expect(localStorage.getItem(CHAVE_TOUR_FEITO)).not.toBeNull();
    expect(localStorage.getItem(chaveCartoesVistos("treino"))).not.toBeNull();
  });

  it("outras chaves do aparelho ficam; dado da conta continua saindo", () => {
    for (const k of ["core-dia1-braco", "core-device-id", "core-aviso-cobranca-notif"]) localStorage.setItem(k, "x");
    localStorage.setItem("finance-expenses", "[]");
    localStorage.setItem("core-dieta-log", "{}");
    purgeUserLocalCache();
    for (const k of ["core-dia1-braco", "core-device-id", "core-aviso-cobranca-notif"]) expect(localStorage.getItem(k)).toBe("x");
    expect(localStorage.getItem("finance-expenses")).toBeNull();
    expect(localStorage.getItem("core-dieta-log")).toBeNull();
  });
});
