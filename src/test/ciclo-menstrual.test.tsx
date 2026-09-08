/**
 * CICLO MENSTRUAL — a DM de 07/09 de uma CLIENTE PAGANTE, virada em trava:
 *
 *   "Ciclo menstrual não está alterando os dias também."
 *
 * O bug passou porque os testes que existiam (pedidos-de-clientes.test.tsx)
 * cobriam as FUNÇÕES puras — média, fase, contagem de dias — e todas estavam
 * certas. O que estava quebrado era o caminho entre o dedo dela e essas
 * funções: um campo controlado que aplicava Math.min/Math.max a cada tecla
 * (digitar 30 era impossível: "3" virava 15, "283" virava 60) e uma previsão
 * que ignorava o número configurado assim que havia 2 ciclos registrados.
 *
 * Por isso aqui o teste RENDERIZA a tela e digita. É o tipo de prova que
 * faltava — nenhuma asserção sobre função pura teria pego isto.
 *
 * Ciclo completo (regra da casa, 19/07): onde a feature é de UI, o teste
 * abre → usa → SAI → REABRE.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import {
  CicloMenstrual, dataDeDiaValida, diasDeFluxo, limitarNumero, somarDias,
  LIMITE_CICLO, type EstadoCiclo,
} from "@/components/saude/CicloMenstrual";
import { localDayKey, parseLocalDay } from "@/lib/utils";

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};

const renderComStore = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>);

const CHAVE = "core-saude-ciclo";
const salvo = (store: ReturnType<typeof criarStore>) => store.dados[CHAVE] as EstadoCiclo;

/* Datas relativas a HOJE: a tela recusa data no futuro, e um teste com data
   fixa vira uma bomba-relógio que explode meses depois sem ninguém entender. */
const hoje = localDayKey();
const dia = (n: number) => somarDias(hoje, n);
/** Como a data aparece na tela (mesmo formatador do componente). */
const naTela = (chave: string) =>
  parseLocalDay(chave).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

const estadoCom = (extra: Partial<EstadoCiclo> = {}): EstadoCiclo => ({
  ligado: true, duracaoCiclo: 28, duracaoRegra: 5, ciclos: [{ inicio: dia(-10) }], ...extra,
});

const abrirAjustes = () => fireEvent.click(screen.getByRole("button", { name: /Ajustes/i }));
const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement;

/* ============================================================
 * 1. "não está alterando os dias" — digitar tem que funcionar
 * ============================================================ */
describe("Ciclo: os campos de número se deixam digitar", () => {
  it("digitar 30 sobre 28: o campo mostra 30 e 30 é o que fica salvo", () => {
    const store = criarStore({ [CHAVE]: estadoCom() });
    renderComStore(<CicloMenstrual />, store);
    abrirAjustes();

    const duracao = campo("Duração do ciclo");
    expect(duracao.value).toBe("28");

    // É assim que se troca 28 por 30 num celular: apaga e escreve.
    fireEvent.change(duracao, { target: { value: "2" } });
    expect(duracao.value).toBe("2");            // antes o campo pulava pra 15 na hora
    expect(salvo(store).duracaoCiclo).toBe(28); // e nada de meio-caminho vai pro disco
    fireEvent.change(duracao, { target: { value: "" } });
    expect(duracao.value).toBe("");
    fireEvent.change(duracao, { target: { value: "3" } });
    expect(duracao.value).toBe("3");
    fireEvent.change(duracao, { target: { value: "30" } });

    expect(duracao.value).toBe("30");
    expect(salvo(store).duracaoCiclo).toBe(30);

    fireEvent.blur(duracao);
    expect(duracao.value).toBe("30"); // fora do foco mostra o que está salvo
    expect(salvo(store).duracaoCiclo).toBe(30);
  });

  it("os números que eram impossíveis (26, 30, 32, 45) entram todos", () => {
    for (const alvo of ["26", "30", "32", "45"]) {
      const store = criarStore({ [CHAVE]: estadoCom() });
      const tela = renderComStore(<CicloMenstrual />, store);
      abrirAjustes();
      const duracao = campo("Duração do ciclo");
      fireEvent.change(duracao, { target: { value: "" } });
      for (let i = 1; i <= alvo.length; i++) {
        fireEvent.change(duracao, { target: { value: alvo.slice(0, i) } });
      }
      fireEvent.blur(duracao);
      expect(duracao.value).toBe(alvo);
      expect(salvo(store).duracaoCiclo).toBe(Number(alvo));
      tela.unmount();
    }
  });

  it("apagar tudo e desistir MANTÉM o valor de antes — apagar não é pedir reset", () => {
    const store = criarStore({ [CHAVE]: estadoCom({ duracaoCiclo: 31 }) });
    renderComStore(<CicloMenstrual />, store);
    abrirAjustes();

    const duracao = campo("Duração do ciclo");
    fireEvent.change(duracao, { target: { value: "" } });
    fireEvent.blur(duracao);

    expect(duracao.value).toBe("31");
    expect(salvo(store).duracaoCiclo).toBe(31);
  });

  it("o limite entra no BLUR, não a cada tecla — e nunca sobra NaN, 0 ou vazio", () => {
    const store = criarStore({ [CHAVE]: estadoCom() });
    renderComStore(<CicloMenstrual />, store);
    abrirAjustes();
    const duracao = campo("Duração do ciclo");

    fireEvent.change(duracao, { target: { value: "283" } });
    expect(duracao.value).toBe("283"); // enquanto digita, o texto é dela
    fireEvent.blur(duracao);
    expect(duracao.value).toBe("60");
    expect(salvo(store).duracaoCiclo).toBe(60);

    fireEvent.change(duracao, { target: { value: "9" } });
    fireEvent.blur(duracao);
    expect(salvo(store).duracaoCiclo).toBe(15);

    expect(Number.isFinite(salvo(store).duracaoCiclo)).toBe(true);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("dias de fluxo também: digitar 7 funciona (antes só a setinha andava)", () => {
    const store = criarStore({ [CHAVE]: estadoCom() });
    renderComStore(<CicloMenstrual />, store);
    abrirAjustes();

    const fluxo = campo("Dias de fluxo");
    fireEvent.change(fluxo, { target: { value: "" } });
    fireEvent.change(fluxo, { target: { value: "7" } });
    fireEvent.blur(fluxo);

    expect(fluxo.value).toBe("7");
    expect(salvo(store).duracaoRegra).toBe(7);
  });

  it("digita 30, SAI da tela e REABRE: continua 30", () => {
    const store = criarStore({ [CHAVE]: estadoCom() });
    const tela = renderComStore(<CicloMenstrual />, store);
    abrirAjustes();
    fireEvent.change(campo("Duração do ciclo"), { target: { value: "30" } });

    tela.unmount();
    renderComStore(<CicloMenstrual />, store);
    abrirAjustes();

    expect(campo("Duração do ciclo").value).toBe("30");
    expect(screen.getByText(/^30 dias/)).toBeInTheDocument();
  });
});

/* ============================================================
 * 2. O número configurado é o que MANDA na previsão
 * ============================================================ */
describe("Ciclo: a duração configurada manda, a média é oferta", () => {
  // Três registros espaçados de 31 dias → média dela = 31.
  const comHistorico = (duracaoCiclo: number) =>
    estadoCom({ duracaoCiclo, ciclos: [{ inicio: dia(-72) }, { inicio: dia(-41) }, { inicio: dia(-10) }] });

  it("com 2+ ciclos registrados a previsão continua saindo da duração configurada", () => {
    const store = criarStore({ [CHAVE]: comHistorico(26) });
    renderComStore(<CicloMenstrual />, store);

    // "Seu ciclo" mostra o que ela configurou, não a média de 31.
    expect(screen.getByText(/^26 dias/)).toBeInTheDocument();
    // Próxima = último início + 26 (com a média mandando seriam 31).
    expect(screen.getByText(naTela(somarDias(dia(-10), 26)))).toBeInTheDocument();
    expect(screen.queryByText(naTela(somarDias(dia(-10), 31)))).not.toBeInTheDocument();
    // Ovulação = início + 26 - 14.
    expect(screen.getByText(naTela(somarDias(dia(-10), 12)))).toBeInTheDocument();
    // E a média aparece como informação, com o convite pra adotar.
    expect(screen.getByText(/sua média: 31 dias/)).toBeInTheDocument();
  });

  it("mexer na duração muda 'Próxima' na hora — a queixa, ponta a ponta", () => {
    const store = criarStore({ [CHAVE]: comHistorico(28) });
    renderComStore(<CicloMenstrual />, store);
    abrirAjustes();

    fireEvent.change(campo("Duração do ciclo"), { target: { value: "35" } });
    expect(screen.getByText(/^35 dias/)).toBeInTheDocument();
    expect(screen.getByText(naTela(somarDias(dia(-10), 35)))).toBeInTheDocument();

    fireEvent.change(campo("Duração do ciclo"), { target: { value: "" } });
    fireEvent.change(campo("Duração do ciclo"), { target: { value: "24" } });
    expect(screen.getByText(naTela(somarDias(dia(-10), 24)))).toBeInTheDocument();
  });

  it("'usar minha média' adota os 31 dias — em um toque, e só se ela pedir", () => {
    const store = criarStore({ [CHAVE]: comHistorico(26) });
    renderComStore(<CicloMenstrual />, store);

    fireEvent.click(screen.getByRole("button", { name: /usar minha média/i }));

    expect(salvo(store).duracaoCiclo).toBe(31);
    expect(screen.getByText(/^31 dias/)).toBeInTheDocument();
    expect(screen.getByText(/bate com sua média de 2 ciclos/i)).toBeInTheDocument();
  });

  it("sem histórico não inventa média nem oferece adotar nada", () => {
    const store = criarStore({ [CHAVE]: estadoCom({ duracaoCiclo: 30 }) });
    renderComStore(<CicloMenstrual />, store);
    expect(screen.getByText(/^30 dias/)).toBeInTheDocument();
    expect(screen.queryByText(/sua média/i)).not.toBeInTheDocument();
  });
});

/* ============================================================
 * 3. Registrar que recusa TEM que dizer por quê
 * ============================================================ */
describe("Ciclo: aviso quando o registro é recusado", () => {
  const registrar = (data: string) => {
    fireEvent.change(campo("Começou a menstruar em"), { target: { value: data } });
    fireEvent.click(screen.getByRole("button", { name: /Registrar/i }));
  };

  it("data repetida avisa na tela em vez de simplesmente não fazer nada", () => {
    const store = criarStore({ [CHAVE]: estadoCom({ ciclos: [{ inicio: dia(-10) }] }) });
    renderComStore(<CicloMenstrual />, store);

    registrar(dia(-10));

    expect(screen.getByRole("alert")).toHaveTextContent(/já registrou/i);
    expect(salvo(store).ciclos).toHaveLength(1); // e não duplicou
  });

  it("data no futuro avisa", () => {
    const store = criarStore({ [CHAVE]: estadoCom() });
    renderComStore(<CicloMenstrual />, store);

    registrar(dia(3));

    expect(screen.getByRole("alert")).toHaveTextContent(/ainda não chegou/i);
    expect(salvo(store).ciclos).toHaveLength(1); // o de sempre, sem o do futuro
  });

  it("o aviso some quando ela corrige a data, e o registro entra", () => {
    const store = criarStore({ [CHAVE]: estadoCom({ ciclos: [{ inicio: dia(-10) }] }) });
    renderComStore(<CicloMenstrual />, store);

    registrar(dia(-10));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    registrar(dia(-40));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(salvo(store).ciclos.map(c => c.inicio)).toEqual([dia(-10), dia(-40)]);
  });

  it("data que não existe no calendário é recusada (31/02 não é dia)", () => {
    // Pela função pura: o <input type=date> do jsdom já limpa texto inválido,
    // então a recusa do 31/02 só dá pra provar aqui — mas é a mesma checagem
    // que a tela usa antes de gravar.
    expect(dataDeDiaValida("2026-02-31")).toBe(false);
    expect(dataDeDiaValida("2026-13-01")).toBe(false);
    expect(dataDeDiaValida("")).toBe(false);
    expect(dataDeDiaValida("2026-02-28")).toBe(true);
  });
});

/* ============================================================
 * 4. Corrigir a data de um registro (antes só dava apagando)
 * ============================================================ */
describe("Ciclo: editar um registro já feito", () => {
  const abrirLapis = (chave: string) =>
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Editar registro de ${naTela(chave)}`, "i") }));

  it("o lápis corrige a data sem apagar o registro", () => {
    const store = criarStore({ [CHAVE]: estadoCom({ ciclos: [{ inicio: dia(-10) }] }) });
    renderComStore(<CicloMenstrual />, store);

    abrirLapis(dia(-10));
    fireEvent.change(campo("Começou em"), { target: { value: dia(-12) } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    expect(salvo(store).ciclos).toEqual([{ inicio: dia(-12) }]);
    expect(screen.getByText(naTela(dia(-12)))).toBeInTheDocument();
    expect(screen.queryByText(naTela(dia(-10)))).not.toBeInTheDocument();
  });

  it("editar para uma data que já existe avisa e não come o outro registro", () => {
    const store = criarStore({ [CHAVE]: estadoCom({ ciclos: [{ inicio: dia(-40) }, { inicio: dia(-10) }] }) });
    renderComStore(<CicloMenstrual />, store);

    abrirLapis(dia(-10));
    fireEvent.change(campo("Começou em"), { target: { value: dia(-40) } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(/já registrou/i);
    expect(salvo(store).ciclos.map(c => c.inicio)).toEqual([dia(-40), dia(-10)]);
  });

  it("Cancelar não muda nada", () => {
    const antes = estadoCom({ ciclos: [{ inicio: dia(-10) }] });
    const store = criarStore({ [CHAVE]: antes });
    renderComStore(<CicloMenstrual />, store);

    abrirLapis(dia(-10));
    fireEvent.change(campo("Começou em"), { target: { value: dia(-12) } });
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(store.dados[CHAVE]).toBe(antes); // mesmíssimo objeto: nada foi gravado
    expect(screen.getByText(naTela(dia(-10)))).toBeInTheDocument();
  });

  it("corrigir a data corrige a previsão junto", () => {
    const store = criarStore({ [CHAVE]: estadoCom({ duracaoCiclo: 28, ciclos: [{ inicio: dia(-10) }] }) });
    renderComStore(<CicloMenstrual />, store);

    abrirLapis(dia(-10));
    fireEvent.change(campo("Começou em"), { target: { value: dia(-6) } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    expect(screen.getByText(naTela(somarDias(dia(-6), 28)))).toBeInTheDocument();
  });
});

/* ============================================================
 * 5. `fim` deixou de ser campo morto
 * ============================================================ */
describe("Ciclo: fim do fluxo", () => {
  it("informar o fim manda na fase daquele ciclo; sem ele, vale o padrão", () => {
    // Ciclo começou há 5 dias → hoje é o dia 6. Com o padrão de 5 dias de
    // fluxo, hoje já é folicular.
    const store = criarStore({ [CHAVE]: estadoCom({ ciclos: [{ inicio: dia(-5) }] }) });
    renderComStore(<CicloMenstrual />, store);
    expect(screen.getByText(/Fase folicular/i)).toBeInTheDocument();

    // Ela diz que o fluxo foi até hoje (6 dias): hoje é menstrual, não folicular.
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Editar registro de ${naTela(dia(-5))}`, "i") }));
    fireEvent.change(campo("Fim do fluxo"), { target: { value: hoje } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    expect(salvo(store).ciclos[0]).toEqual({ inicio: dia(-5), fim: hoje });
    expect(screen.getByText(/Fase menstrual/i)).toBeInTheDocument();
    expect(screen.getByText(/6d de fluxo/)).toBeInTheDocument();
  });

  it("fim antes do começo é recusado com aviso", () => {
    const antes = estadoCom({ ciclos: [{ inicio: dia(-5) }] });
    const store = criarStore({ [CHAVE]: antes });
    renderComStore(<CicloMenstrual />, store);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Editar registro de ${naTela(dia(-5))}`, "i") }));
    fireEvent.change(campo("Fim do fluxo"), { target: { value: dia(-9) } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(/depois do começo/i);
    expect(store.dados[CHAVE]).toBe(antes); // recusou = não gravou nada
  });

  it("apagar o fim volta o ciclo pro padrão, sem deixar lixo no registro", () => {
    const store = criarStore({ [CHAVE]: estadoCom({ ciclos: [{ inicio: dia(-5), fim: hoje }] }) });
    renderComStore(<CicloMenstrual />, store);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Editar registro de ${naTela(dia(-5))}`, "i") }));
    fireEvent.change(campo("Fim do fluxo"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    expect(salvo(store).ciclos[0]).toEqual({ inicio: dia(-5) });
    expect("fim" in salvo(store).ciclos[0]).toBe(false);
  });

  it("diasDeFluxo: o registro manda, o padrão cobre o resto e o absurdo é ignorado", () => {
    expect(diasDeFluxo(undefined, 5)).toBe(5);
    expect(diasDeFluxo({ inicio: "2026-09-01" }, 5)).toBe(5);
    expect(diasDeFluxo({ inicio: "2026-09-01", fim: "2026-09-07" }, 5)).toBe(7);
    expect(diasDeFluxo({ inicio: "2026-09-01", fim: "2026-08-25" }, 5)).toBe(5); // fim antes do início
    expect(diasDeFluxo({ inicio: "2026-09-01", fim: "2026-10-30" }, 5)).toBe(5); // 60 dias de fluxo, não
  });
});

/* ============================================================
 * 6. Retrocompatibilidade — dado já salvo continua abrindo
 * ============================================================ */
describe("Ciclo: dados antigos de core-saude-ciclo", () => {
  it("estado do formato de 01/09 (sem `fim`) abre e prevê normalmente", () => {
    const antigo = { ligado: true, duracaoCiclo: 30, duracaoRegra: 5, ciclos: [{ inicio: dia(-40) }, { inicio: dia(-10) }] };
    const store = criarStore({ [CHAVE]: antigo });
    renderComStore(<CicloMenstrual />, store);

    expect(screen.getByText(/^30 dias/)).toBeInTheDocument();
    expect(screen.getByText(naTela(somarDias(dia(-10), 30)))).toBeInTheDocument();
    expect(store.dados[CHAVE]).toBe(antigo); // nada foi reescrito por baixo dela
  });

  it("número corrompido pelo clamp antigo é saneado na LEITURA, sem migração destrutiva", () => {
    const store = criarStore({ [CHAVE]: { ligado: true, duracaoCiclo: 0, duracaoRegra: 0, ciclos: [{ inicio: dia(-10) }] } });
    renderComStore(<CicloMenstrual />, store);

    expect(screen.getByText(/^28 dias/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect((store.dados[CHAVE] as EstadoCiclo).duracaoCiclo).toBe(0); // a chave não foi tocada
  });

  it("limitarNumero: lixo cai no padrão, número fora dos limites é aparado", () => {
    expect(limitarNumero(undefined, LIMITE_CICLO)).toBe(28);
    expect(limitarNumero("", LIMITE_CICLO)).toBe(28);
    expect(limitarNumero("abc", LIMITE_CICLO)).toBe(28);
    expect(limitarNumero(0, LIMITE_CICLO)).toBe(28);
    expect(limitarNumero(-4, LIMITE_CICLO)).toBe(28);
    expect(limitarNumero("30", LIMITE_CICLO)).toBe(30);
    expect(limitarNumero(9, LIMITE_CICLO)).toBe(15);
    expect(limitarNumero(283, LIMITE_CICLO)).toBe(60);
  });

  it("continua NASCENDO DESLIGADO — a Saúde é aberta por gente de todos os gêneros", () => {
    const store = criarStore();
    renderComStore(<CicloMenstrual />, store);
    expect(screen.getByText("Acompanhar meu ciclo")).toBeInTheDocument();
    expect(screen.queryByText("MEU CICLO")).not.toBeInTheDocument();
  });
});
