import { beforeEach, describe, expect, it } from "vitest";
import { CHAVE_FESTAS_MOSTRADAS, gravarFestaMostrada, lerFestasMostradas } from "@/components/conquistas/Momentos";
import { purgeUserLocalCache } from "@/hooks/use-user-data";

describe("festas mostradas pertencem à pessoa que as conquistou", () => {
  beforeEach(() => localStorage.clear());

  it("trocar de conta não consome a conquista da outra pessoa e voltar mantém a primeira vista", () => {
    gravarFestaMostrada(["first-expense", "marco:7"], "ana");
    expect(lerFestasMostradas("joao")).toEqual([]);
    gravarFestaMostrada(["mes-20"], "joao");
    expect(lerFestasMostradas("ana")).toEqual(["first-expense", "marco:7"]);
    expect(lerFestasMostradas("joao")).toEqual(["mes-20"]);
  });

  it("a vassoura da reabertura preserva o cache por conta e a gravação é idempotente", () => {
    gravarFestaMostrada(["first-expense"], "ana");
    gravarFestaMostrada(["first-expense"], "ana");
    purgeUserLocalCache();
    expect(lerFestasMostradas("ana")).toEqual(["first-expense"]);
  });

  it("uma lista antiga sem dono não marca como vista uma conquista de outra conta", () => {
    localStorage.setItem(CHAVE_FESTAS_MOSTRADAS, JSON.stringify(["master", "first-expense"]));
    expect(lerFestasMostradas("nova-conta")).toEqual([]);
    gravarFestaMostrada(["wishlist"], "nova-conta");
    expect(lerFestasMostradas("nova-conta")).toEqual(["wishlist"]);
  });
});
