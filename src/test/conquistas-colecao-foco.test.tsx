import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Badge } from "@/components/gamification/types";
import { ColecaoTela } from "@/components/conquistas/nova/camadas";
import type { ColecaoNova } from "@/components/conquistas/nova/use-conquistas-nova";

afterEach(cleanup);

const salario: Badge = { id: "first-income", name: "Primeiro Salário", description: "Registre sua primeira receita", category: "finance", icon: "", color: "", xp: 50, unlocked: true };
const colecao: ColecaoNova = { id: "finance", label: "Finanças", emoji: "💰", rota: "/financas", adesivos: [salario], abertos: 1, total: 1, frase: "coleção completa", proximo: null, pagina: 1 };
const estado = { colecoes: [colecao], abertos: 1, total: 1 };

describe("navegação da coleção de figurinhas", () => {
  it("mantém Tab no diálogo, fecha com Escape e devolve o foco a quem abriu", () => {
    const Tela = () => {
      const [aberta, setAberta] = useState(false);
      return <><button onClick={() => setAberta(true)}>Ver todas</button>{aberta && <ColecaoTela e={estado} inicial={null} onFechar={() => setAberta(false)} onAdesivo={() => {}} />}</>;
    };
    render(<Tela />);
    const abrir = screen.getByRole("button", { name: "Ver todas" });
    abrir.focus();
    fireEvent.click(abrir);
    const fechar = screen.getByRole("button", { name: "Fechar" });
    const figurinha = screen.getByRole("button", { name: "Primeiro Salário: conquistada" });
    expect(document.activeElement).toBe(fechar);
    fireEvent.keyDown(fechar, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(figurinha);
    fireEvent.keyDown(figurinha, { key: "Tab" });
    expect(document.activeElement).toBe(fechar);
    fireEvent.keyDown(fechar, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(abrir);
  });

  it("anuncia o módulo selecionado e preserva a consulta de raridade", () => {
    const selecionar = vi.fn();
    render(<ColecaoTela e={estado} inicial={null} onFechar={() => {}} onAdesivo={selecionar} />);
    const filtros = screen.getByRole("group", { name: "Filtrar por módulo" });
    fireEvent.click(within(filtros).getByRole("button", { name: /Finanças/ }));
    expect(within(filtros).getByRole("button", { name: /Finanças/, pressed: true })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por raridade" }), { target: { value: "lendario" } });
    expect(screen.getByRole("status").textContent).toContain("Nenhuma figurinha");
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por raridade" }), { target: { value: "todas" } });
    fireEvent.click(screen.getByRole("button", { name: "Primeiro Salário: conquistada" }));
    expect(selecionar).toHaveBeenCalledWith(salario);
  });
});
