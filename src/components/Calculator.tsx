import { useState } from "react";

/**
 * CALCULADORA (26/09, varredura). "(", ")" e "x^" não faziam nada e não
 * existia tecla de dividir. Em vez de enxertar parênteses numa calculadora de
 * execução imediata (que não tem como guardar "(2+3)×4" sem virar um parser
 * de expressão), as teclas mortas viraram teclas que funcionam, nas MESMAS
 * posições: "(" → ÷, ")" → ⌫ (apaga o último dígito) e "x^" → xʸ (potência,
 * como + − × ÷: "2 xʸ 10 =" dá 1.024). Conta impossível (÷ 0, √ de negativo)
 * mostra "Erro" em vez de um 0 que parecia resultado.
 */

export type Operacao = "+" | "-" | "*" | "/" | "^";

/** Resultado de `a op b`; NaN quando não existe (÷ 0). Limpa o ruído de ponto
 *  flutuante (0,1 + 0,2 = 0,3, não 0,30000000000000004). */
export const calcular = (a: number, b: number, op: Operacao): number => {
  let r: number;
  switch (op) {
    case "+": r = a + b; break;
    case "-": r = a - b; break;
    case "*": r = a * b; break;
    case "/": r = b === 0 ? NaN : a / b; break;
    case "^": r = Math.pow(a, b); break;
    default: r = b;
  }
  return Number.isFinite(r) ? Number(r.toPrecision(12)) : NaN;
};

/** O visor em pt-BR a partir do texto digitado: "1234.5" → "1.234,5". Mantém
 *  o que está sendo digitado ("0," e "0,0" não somem enquanto se digita). */
export const formatarVisor = (texto: string): string => {
  if (texto === "Erro" || !Number.isFinite(Number(texto))) return "Erro";
  const negativo = texto.startsWith("-");
  const [inteiro, decimal] = texto.replace("-", "").split(".");
  const n = Number(inteiro || "0");
  // número grande demais pra agrupar em milhar: cai no formato do número inteiro
  const inteiroFmt = Number.isSafeInteger(n) ? n.toLocaleString("pt-BR") : Number(texto).toLocaleString("pt-BR", { maximumFractionDigits: 8 });
  if (!Number.isSafeInteger(n)) return inteiroFmt;
  return `${negativo ? "-" : ""}${inteiroFmt}${decimal !== undefined ? `,${decimal}` : ""}`;
};

/** Número → texto do visor, sem notação científica pros casos comuns. */
const paraVisor = (n: number) => (Number.isFinite(n) ? String(n) : "Erro");

export const Calculator = () => {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operacao | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const erro = display === "Erro";

  const inputDigit = (digit: string) => {
    if (waitingForOperand || erro) { setDisplay(digit); setWaitingForOperand(false); }
    else { setDisplay(display === "0" ? digit : display + digit); }
  };

  const inputDecimal = () => {
    if (waitingForOperand || erro) { setDisplay("0."); setWaitingForOperand(false); }
    else if (!display.includes(".")) { setDisplay(display + "."); }
  };

  const clear = () => { setDisplay("0"); setPreviousValue(null); setOperation(null); setWaitingForOperand(false); };

  const apagarUltimo = () => {
    if (waitingForOperand || erro) return; // resultado não se edita dígito a dígito
    const menor = display.slice(0, -1);
    setDisplay(menor === "" || menor === "-" ? "0" : menor);
  };

  const mostrarResultado = (r: number) => {
    setDisplay(paraVisor(r));
    if (!Number.isFinite(r)) { setPreviousValue(null); setOperation(null); }
  };

  const performOperation = (nextOp: Operacao) => {
    if (erro) return;
    const val = parseFloat(display);
    // trocar de ideia (5 + ×) só troca a operação — antes fazia 5 + 5
    if (waitingForOperand && operation) { setOperation(nextOp); return; }
    if (previousValue === null) setPreviousValue(val);
    else if (operation) {
      const result = calcular(previousValue, val, operation);
      mostrarResultado(result);
      if (!Number.isFinite(result)) { setWaitingForOperand(true); return; }
      setPreviousValue(result);
    }
    setWaitingForOperand(true);
    setOperation(nextOp);
  };

  const equals = () => {
    if (!operation || previousValue === null || erro) return;
    const result = calcular(previousValue, parseFloat(display), operation);
    mostrarResultado(result);
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  };

  const unario = (f: (x: number) => number) => {
    if (erro) return;
    const r = f(parseFloat(display));
    setDisplay(Number.isFinite(r) ? paraVisor(Number(r.toPrecision(12))) : "Erro");
    setWaitingForOperand(true);
  };

  const btnNum = "calc-key w-10 h-9 rounded text-sm font-medium bg-card border border-border hover:bg-muted transition-colors";
  const btnOp = "calc-key w-10 h-9 rounded text-sm font-medium bg-muted border border-border hover:bg-muted/80 transition-colors";
  const btnClear = "calc-key calc-key-action w-10 h-9 rounded text-sm font-bold bg-foreground text-background border border-border hover:opacity-90 transition-colors";

  return (
    <div className="calc-shell bg-card rounded-lg border border-border p-3 animate-fade-in w-full max-w-[280px] lg:w-fit">
      <div className="calc-display bg-foreground text-background rounded px-3 py-2 mb-3 text-right">
        <span className="text-lg font-mono" data-testid="visor-calculadora">{formatarVisor(display)}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: "÷", nome: "Dividir", action: () => performOperation("/"), cls: btnOp },
          { label: "⌫", nome: "Apagar último dígito", action: apagarUltimo, cls: btnOp },
          { label: "AC", nome: "Limpar", action: clear, cls: btnClear },
          { label: "×", nome: "Multiplicar", action: () => performOperation("*"), cls: btnOp },
          { label: "xʸ", nome: "Potência", action: () => performOperation("^"), cls: btnOp },
          { label: "7", action: () => inputDigit("7"), cls: btnNum },
          { label: "8", action: () => inputDigit("8"), cls: btnNum },
          { label: "9", action: () => inputDigit("9"), cls: btnNum },
          { label: "%", nome: "Porcentagem", action: () => unario((x) => x / 100), cls: btnOp },
          { label: "4", action: () => inputDigit("4"), cls: btnNum },
          { label: "5", action: () => inputDigit("5"), cls: btnNum },
          { label: "6", action: () => inputDigit("6"), cls: btnNum },
          { label: "√", nome: "Raiz quadrada", action: () => unario((x) => (x < 0 ? NaN : Math.sqrt(x))), cls: btnOp },
          { label: "1", action: () => inputDigit("1"), cls: btnNum },
          { label: "2", action: () => inputDigit("2"), cls: btnNum },
          { label: "3", action: () => inputDigit("3"), cls: btnNum },
          { label: "·", nome: "Vírgula", action: inputDecimal, cls: btnNum },
          { label: "−", nome: "Subtrair", action: () => performOperation("-"), cls: btnOp },
          { label: "0", action: () => inputDigit("0"), cls: btnNum },
          { label: "=", nome: "Igual", action: equals, cls: btnOp + " calc-key-action" },
          { label: "+", nome: "Somar", action: () => performOperation("+"), cls: btnOp },
        ].map((btn, i) => (
          <button key={i} type="button" onClick={btn.action} aria-label={btn.nome} className={btn.cls}>{btn.label}</button>
        ))}
      </div>
    </div>
  );
};
