import { useState } from "react";

export const Calculator = () => {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) { setDisplay(digit); setWaitingForOperand(false); }
    else { setDisplay(display === "0" ? digit : display + digit); }
  };

  const inputDecimal = () => {
    if (waitingForOperand) { setDisplay("0."); setWaitingForOperand(false); }
    else if (!display.includes(".")) { setDisplay(display + "."); }
  };

  const clear = () => { setDisplay("0"); setPreviousValue(null); setOperation(null); setWaitingForOperand(false); };

  const performOperation = (nextOp: string) => {
    const val = parseFloat(display);
    if (previousValue === null) setPreviousValue(val);
    else if (operation) {
      const result = calc(previousValue, val, operation);
      setDisplay(String(result));
      setPreviousValue(result);
    }
    setWaitingForOperand(true);
    setOperation(nextOp);
  };

  const calc = (a: number, b: number, op: string) => {
    switch (op) { case "+": return a + b; case "-": return a - b; case "*": return a * b; case "/": return b !== 0 ? a / b : 0; default: return b; }
  };

  const equals = () => {
    if (!operation || previousValue === null) return;
    const result = calc(previousValue, parseFloat(display), operation);
    setDisplay(String(result));
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  };

  const btnNum = "w-10 h-9 rounded text-sm font-medium bg-card border border-border hover:bg-muted transition-colors";
  const btnOp = "w-10 h-9 rounded text-sm font-medium bg-muted border border-border hover:bg-muted/80 transition-colors";
  const btnClear = "w-10 h-9 rounded text-sm font-bold bg-foreground text-background border border-border hover:opacity-90 transition-colors";

  return (
    <div className="bg-card rounded-lg border border-border p-3 animate-fade-in w-full max-w-[280px] lg:w-fit">
      <div className="bg-foreground text-background rounded px-3 py-2 mb-3 text-right">
        <span className="text-lg font-mono">{parseFloat(display).toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: "(", action: () => {}, cls: btnOp },
          { label: ")", action: () => {}, cls: btnOp },
          { label: "AC", action: clear, cls: btnClear },
          { label: "×", action: () => performOperation("*"), cls: btnOp },
          { label: "x^", action: () => {}, cls: btnOp },
          { label: "7", action: () => inputDigit("7"), cls: btnNum },
          { label: "8", action: () => inputDigit("8"), cls: btnNum },
          { label: "9", action: () => inputDigit("9"), cls: btnNum },
          { label: "%", action: () => setDisplay(String(parseFloat(display) / 100)), cls: btnOp },
          { label: "4", action: () => inputDigit("4"), cls: btnNum },
          { label: "5", action: () => inputDigit("5"), cls: btnNum },
          { label: "6", action: () => inputDigit("6"), cls: btnNum },
          { label: "√", action: () => setDisplay(String(Math.sqrt(parseFloat(display)))), cls: btnOp },
          { label: "1", action: () => inputDigit("1"), cls: btnNum },
          { label: "2", action: () => inputDigit("2"), cls: btnNum },
          { label: "3", action: () => inputDigit("3"), cls: btnNum },
          { label: "·", action: inputDecimal, cls: btnNum },
          { label: "−", action: () => performOperation("-"), cls: btnOp },
          { label: "0", action: () => inputDigit("0"), cls: btnNum },
          { label: "=", action: equals, cls: btnOp },
          { label: "+", action: () => performOperation("+"), cls: btnOp },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} className={btn.cls}>{btn.label}</button>
        ))}
      </div>
    </div>
  );
};
