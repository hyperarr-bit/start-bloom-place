/**
 * CÓPIA DO MÊS — travas nascidas do relato de 01/09 ("fui replicar o mês
 * anterior e apagou o do mês passado").
 *
 * A investigação mostrou duas coisas, e cada bloco aqui trava uma:
 *  1. a cópia NÃO escreve nas chaves do mês de ORIGEM (a acusação) — ela lê
 *     de lá e grava só no destino;
 *  2. a porta `aplicar` ficou 25 dias declarada e desligada (nasceu em 08/08,
 *     o Index nunca a passou), então toda cópia caía em localStorage-só e a
 *     gravação seguinte da tela engolia o resultado. Agora o destino tem
 *     TRÊS degraus (aplicar → persistir → writeMonthData) e o teste garante
 *     que os dois primeiros são usados na ordem certa.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { copyToMonth } from "@/components/MonthTurnover";
import { getFinanceStorageKeys, getCurrentMonthName, getCurrentYear } from "@/components/finance/storage-keys";

const UID = "t1";
const k = (logical: string) => `u:${UID}:${logical}`;
const seed = (logical: string, v: unknown) => localStorage.setItem(k(logical), JSON.stringify(v));
const lido = (logical: string) => JSON.parse(localStorage.getItem(k(logical)) ?? "null");

// mês anterior REAL do calendário — o mesmo que o cartão usa
const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const atual = getCurrentMonthName();
const anterior = meses[(meses.indexOf(atual) + 11) % 12];
const origem = getFinanceStorageKeys(anterior, getCurrentYear());
const destino = getFinanceStorageKeys(atual, getCurrentYear());

const FIXOS_AGOSTO = [{ id: "f1", description: "Aluguel", category: "moradia", value: 2000, paymentMethod: "boleto" }];
const CONTAS_AGOSTO = [{ day: 5, color: "yellow", bills: [{ id: "b1", name: "Aluguel", paid: true, value: 2000 }] }];
const RECEITAS_AGOSTO = [{ id: "r1", description: "Salário", value: 5000, date: "2026-08-05" }];

const TUDO = { fixed: true, bills: true, incomes: true, categoryBudgets: false, notes: false };

beforeEach(() => {
  localStorage.clear();
  seed(origem.fixed, FIXOS_AGOSTO);
  seed(origem.dueDays, CONTAS_AGOSTO);
  seed(origem.incomes, RECEITAS_AGOSTO);
});

describe("copyToMonth — a acusação do relato", () => {
  it("NUNCA escreve nas chaves do mês de origem", () => {
    const antes = {
      fixed: localStorage.getItem(k(origem.fixed)),
      dueDays: localStorage.getItem(k(origem.dueDays)),
      incomes: localStorage.getItem(k(origem.incomes)),
    };
    copyToMonth(UID, anterior, atual, TUDO);
    expect(localStorage.getItem(k(origem.fixed))).toBe(antes.fixed);
    expect(localStorage.getItem(k(origem.dueDays))).toBe(antes.dueDays);
    expect(localStorage.getItem(k(origem.incomes))).toBe(antes.incomes);
  });

  it("copia com ids NOVOS e contas desmarcadas — a origem mantém os dela", () => {
    copyToMonth(UID, anterior, atual, TUDO);
    const fixos = lido(destino.fixed);
    expect(fixos).toHaveLength(1);
    expect(fixos[0].description).toBe("Aluguel");
    expect(fixos[0].id).not.toBe("f1");
    const contas = lido(destino.dueDays);
    expect(contas[0].bills[0].paid).toBe(false);      // ✓ de "pago" não viaja
    expect(lido(origem.dueDays)[0].bills[0].paid).toBe(true); // origem intacta
  });
});

describe("copyToMonth — os três degraus do destino", () => {
  it("1º degrau: quem tem dono em memória vai pelo `aplicar`, sem tocar o disco", () => {
    const recebido: Record<string, unknown> = {};
    copyToMonth(UID, anterior, atual, TUDO, (chave, valor) => { recebido[chave] = valor; return true; });
    expect(Object.keys(recebido).sort()).toEqual([destino.dueDays, destino.fixed, destino.incomes].sort());
    // aplicar aceitou ⇒ nada foi pro localStorage do destino
    expect(localStorage.getItem(k(destino.fixed))).toBeNull();
  });

  it("2º degrau: chave recusada pelo `aplicar` cai no `persistir` (local+servidor)", () => {
    const persistido: string[] = [];
    copyToMonth(
      UID, anterior, atual, TUDO,
      (chave, valor) => chave === destino.fixed,          // só os fixos têm dono
      (chave) => persistido.push(chave),
    );
    expect(persistido.sort()).toEqual([destino.dueDays, destino.incomes].sort());
  });

  it("3º degrau: sem porta nenhuma, o writeMonthData antigo segue valendo", () => {
    copyToMonth(UID, anterior, atual, TUDO);
    expect(lido(destino.fixed)).toHaveLength(1);
    expect(lido(destino.incomes)).toHaveLength(1);
  });

  it("origem vazia é no-op — não inventa chave nem apaga o que existe no destino", () => {
    localStorage.clear();
    seed(destino.fixed, [{ id: "s1", description: "Já era de setembro", value: 10, category: "outros", paymentMethod: "pix" }]);
    const chamadas: string[] = [];
    copyToMonth(UID, anterior, atual, TUDO, (chave) => { chamadas.push(chave); return true; });
    expect(chamadas).toHaveLength(0);
    expect(lido(destino.fixed)[0].id).toBe("s1");
  });
});
