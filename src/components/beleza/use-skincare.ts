import { useCallback } from "react";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { avisarApagado } from "@/lib/desfazer";
import {
  CHAVE_DICAS, CHAVE_FEITOS, CHAVE_PASSOS, CHAVE_PERFIL, alternarDia, gerarRotina, guardarNaBancada, passoDigitado, passoValido, ritmoDoPasso,
  type CategoriaDoCatalogo, type PassoDaRotina, type PerfilDaPele, type Periodo, type ProdutoDaBancada, type ProdutoDoCatalogo,
} from "@/lib/beleza-rotina";
import { CHAVE_LEMBRETE_SKINCARE, LEMBRETE_PADRAO, lerLembreteSkincare, type LembreteDoPeriodo, type LembreteSkincare } from "@/lib/beleza-lembrete";
import { inserirEm, marcadosAposInserir, marcadosAposRemover } from "./utils";
import { useChaveDaBeleza } from "./estado-compartilhado";
import { useMarcarOntem } from "@/hooks/use-marcar-ontem";

/** "2026-09-27" a partir de "2026-09-28" (dia LOCAL). */
export const diaAnterior = (dia: string): string => {
  const d = parseLocalDay(dia);
  d.setDate(d.getDate() - 1);
  return localDayKey(d);
};

type Feitos = Record<string, number[]>;
const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const doDia = (mapa: Feitos, dia: string): number[] => (Array.isArray(mapa?.[dia]) ? mapa[dia] : []);

/**
 * A rotina de pele inteira, lida e gravada DIRETO no store (useChaveDaBeleza),
 * sem cópia: o card da Home, a tabela da Rotina, o Espelho do dia e a Bancada
 * mostram as mesmas chaves e se enxergam na hora (a lição de 26/09 — duas
 * cópias da mesma chave não se veem).
 *
 * Formato das chaves: o de sempre. Passo continua `{ name, isSunscreen?, isAcid? }`
 * com campos opcionais novos; check continua o índice no array INTEIRO.
 */
export function useSkincare() {
  const hoje = localDayKey();
  const ontem = diaAnterior(hoje);
  const anteontem = diaAnterior(ontem);
  const marcarOutroDia = useMarcarOntem();
  const [manha, setManha] = useChaveDaBeleza<PassoDaRotina[]>(CHAVE_PASSOS.manha, []);
  const [noite, setNoite] = useChaveDaBeleza<PassoDaRotina[]>(CHAVE_PASSOS.noite, []);
  const [feitosManha, setFeitosManha] = useChaveDaBeleza<Feitos>(CHAVE_FEITOS.manha, {});
  const [feitosNoite, setFeitosNoite] = useChaveDaBeleza<Feitos>(CHAVE_FEITOS.noite, {});
  const [checkins] = useChaveDaBeleza<Record<string, string>>("skincare-daily-checkin", {});
  const [bancada, setBancada] = useChaveDaBeleza<ProdutoDaBancada[]>("beauty-products", []);
  const [evitar] = useChaveDaBeleza<string[]>("skincare-triggers", []);
  const [lembreteBruto, setLembreteBruto] = useChaveDaBeleza<LembreteSkincare>(CHAVE_LEMBRETE_SKINCARE, LEMBRETE_PADRAO);
  const [perfilBruto, setPerfil] = useChaveDaBeleza<Partial<PerfilDaPele>>(CHAVE_PERFIL, {});
  const [dicasBruto, setDicas] = useChaveDaBeleza<{ alternarDispensado?: boolean }>(CHAVE_DICAS, {});

  const passos = { manha: lista<PassoDaRotina>(manha), noite: lista<PassoDaRotina>(noite) };
  const setPassos = { manha: setManha, noite: setNoite };
  const feitos = { manha: feitosManha, noite: feitosNoite };
  const setFeitos = { manha: setFeitosManha, noite: setFeitosNoite };
  const lembrete = lerLembreteSkincare(lembreteBruto);
  const perfil = perfilBruto && typeof perfilBruto === "object" ? perfilBruto : {};
  const vazia = !passos.manha.some(passoValido) && !passos.noite.some(passoValido);

  const feitosDoDia = (periodo: Periodo, dia: string): number[] => doDia(feitos[periodo], dia);

  /**
   * Marca/desmarca um passo NUM dia (hoje, ontem ou anteontem — 02/10, "quero voltar
   * no dia 28/09 e marcar a rotina da noite que esqueci") — o índice é o do array
   * inteiro. Marcar ontem/anteontem anota ESSE dia na sequência, não hoje.
   */
  const alternar = (periodo: Periodo, i: number, dia: string = hoje) => {
    const marcando = !doDia(feitos[periodo], dia).includes(i);
    marcarOutroDia("beleza", dia, marcando, () =>
      setFeitos[periodo]((prev) => {
        const atual = [...doDia(prev, dia)];
        const pos = atual.indexOf(i);
        if (pos >= 0) atual.splice(pos, 1);
        else atual.push(i);
        return { ...prev, [dia]: atual };
      }));
  };

  /** O produto do passo na Bancada. Acabou e já tem outro igual? Segue o novo (repôs pela lista de compras). */
  const produtoDe = (p: PassoDaRotina | null | undefined): ProdutoDaBancada | null => {
    if (!p?.produtoId) return null;
    const b = lista<ProdutoDaBancada>(bancada);
    const x = b.find((y) => y?.id === p.produtoId);
    if (!x) return null;
    if (!x.finished) return x;
    return b.find((y) => y && !y.finished && ((x.catalogoId && y.catalogoId === x.catalogoId) || (y.name === x.name && y.brand === x.brand))) ?? x;
  };

  const mudarPasso = (periodo: Periodo, i: number, muda: (p: PassoDaRotina) => PassoDaRotina) =>
    setPassos[periodo]((prev) => lista<PassoDaRotina>(prev).map((p, j) => (j === i && passoValido(p) ? muda(p) : p)));

  const adicionarPasso = (periodo: Periodo, nome: string) => {
    if (!nome.trim()) return;
    setPassos[periodo]((prev) => [...lista<PassoDaRotina>(prev), passoDigitado(nome, periodo)]);
  };

  /**
   * Tira o passo e oferece Desfazer (como sempre foi). Os checks de HOJE, ONTEM e
   * ANTEONTEM andam junto com os índices (dá pra marcar ontem desde 28/09, e
   * anteontem desde 02/10); dias mais antigos só contam pra sequência e ficam
   * como estão.
   */
  const removerPasso = (periodo: Periodo, i: number) => {
    const passo = passos[periodo][i];
    if (!passo) return;
    const dias = [hoje, ontem, anteontem];
    const antes = Object.fromEntries(dias.map((d) => [d, feitosDoDia(periodo, d).includes(i)]));
    const tinha = Object.fromEntries(dias.map((d) => [d, d in (feitos[periodo] ?? {})]));
    setPassos[periodo]((prev) => lista<PassoDaRotina>(prev).filter((_, j) => j !== i));
    setFeitos[periodo]((prev) => {
      const n = { ...prev };
      for (const d of dias) if (tinha[d]) n[d] = marcadosAposRemover(doDia(prev, d), i);
      return n;
    });
    avisarApagado(`"${passo.name}" saiu da rotina`, () => {
      let pos = i;
      setPassos[periodo]((prev) => { pos = Math.min(i, lista(prev).length); return inserirEm(lista<PassoDaRotina>(prev), pos, passo); });
      setFeitos[periodo]((prev) => {
        const n = { ...prev };
        for (const d of dias) if (tinha[d]) n[d] = marcadosAposInserir(doDia(prev, d), pos, antes[d]);
        return n;
      });
    });
  };

  const alternarDiaDoPasso = (periodo: Periodo, i: number, dia: number): boolean => {
    const p = passos[periodo][i];
    if (!p) return false;
    const novo = alternarDia(p, dia);
    if (novo === p) return false; // o último dia não sai
    mudarPasso(periodo, i, () => novo);
    return true;
  };

  const renomear = (periodo: Periodo, i: number, nome: string) => {
    const n = nome.trim();
    if (!n) return;
    mudarPasso(periodo, i, (p) => ({ ...p, name: n }));
  };

  /** Produto da lista (ou digitado) vira item da Bancada e fica ligado ao passo. */
  const escolherProduto = (
    periodo: Periodo,
    i: number,
    escolhido: ProdutoDoCatalogo | { marca: string; nome: string; categoria?: CategoriaDoCatalogo },
  ) => {
    const p = passos[periodo][i];
    if (!p) return;
    const { bancada: nova, id } = guardarNaBancada(lista<ProdutoDaBancada>(bancada), escolhido, crypto.randomUUID(), ritmoDoPasso(p) === "todo dia" ? "Diário" : ritmoDoPasso(p));
    if (nova !== bancada) setBancada(nova);
    mudarPasso(periodo, i, (x) => ({ ...x, produtoId: id }));
  };

  const tirarProduto = (periodo: Periodo, i: number) =>
    mudarPasso(periodo, i, (p) => {
      const { produtoId: _p, ...resto } = p;
      return resto;
    });

  /** "Abri hoje": a validade depois de aberto (PAO) começa a contar — é o que a Bancada avisa. */
  const abrirHoje = (produtoId: string) =>
    setBancada((prev) => lista<ProdutoDaBancada>(prev).map((x) => (x?.id === produtoId ? { ...x, opened: true, openedDate: hoje } : x)));

  /**
   * As 3 respostas viram a rotina. Troca uma rotina que já existia? Os checks de
   * HOJE apontavam pros passos velhos — saem (e voltam no Desfazer). Dias
   * passados ficam: só contam pra sequência.
   */
  const gerar = (novo: PerfilDaPele) => {
    const antes = { manha: passos.manha, noite: passos.noite, perfil, feitosHoje: { manha: feitosDoDia("manha", hoje), noite: feitosDoDia("noite", hoje) } };
    const trocou = !vazia;
    const r = gerarRotina(novo, lista<string>(evitar));
    setManha(r.manha);
    setNoite(r.noite);
    setPerfil({ ...novo });
    if (trocou) {
      for (const periodo of ["manha", "noite"] as const) {
        if (hoje in (feitos[periodo] ?? {})) setFeitos[periodo]((prev) => ({ ...prev, [hoje]: [] }));
      }
      avisarApagado("Rotina trocada pela nova", () => {
        setManha(antes.manha);
        setNoite(antes.noite);
        setPerfil(antes.perfil);
        setFeitosManha((prev) => ({ ...prev, [hoje]: antes.feitosHoje.manha }));
        setFeitosNoite((prev) => ({ ...prev, [hoje]: antes.feitosHoje.noite }));
      });
    }
    return r;
  };

  /**
   * "Alternar" (sem o ciclo de 4 dias, 28/09): grava `dias` SÓ nos passos
   * sugeridos (campo opcional; nome, ordem e checks ficam), com Desfazer.
   */
  const aplicarDias = (periodo: Periodo, mudancas: { i: number; dias: number[] }[]) => {
    if (!mudancas.length) return;
    const antes = passos[periodo];
    setPassos[periodo]((prev) =>
      lista<PassoDaRotina>(prev).map((p, j) => {
        const m = mudancas.find((x) => x.i === j);
        return m && passoValido(p) ? { ...p, dias: [...m.dias] } : p;
      }));
    avisarApagado("Ativos em dias alternados", () => setPassos[periodo](() => antes));
  };

  /** "Agora não" no post-it do Alternar: não volta a oferecer. */
  const dispensarAlternar = () => setDicas((d) => ({ ...(d && typeof d === "object" ? d : {}), alternarDispensado: true }));

  const mudarLembrete = useCallback(
    (periodo: Periodo, muda: Partial<LembreteDoPeriodo>): LembreteSkincare => {
      const atual = lerLembreteSkincare(lembreteBruto);
      const novo = { ...atual, [periodo]: { ...atual[periodo], ...muda } };
      setLembreteBruto(novo);
      return novo;
    },
    [lembreteBruto, setLembreteBruto],
  );

  const ligarLembretes = (): LembreteSkincare => {
    const atual = lerLembreteSkincare(lembreteBruto);
    const novo = { manha: { ...atual.manha, ligado: true }, noite: { ...atual.noite, ligado: true } };
    setLembreteBruto(novo);
    return novo;
  };

  return {
    hoje, ontem, anteontem, passos, feitos, feitosDoDia, checkins, bancada: lista<ProdutoDaBancada>(bancada), evitar: lista<string>(evitar),
    lembrete, perfil, vazia, alternarDispensado: dicasBruto?.alternarDispensado === true,
    alternar, produtoDe, adicionarPasso, removerPasso, alternarDiaDoPasso, renomear, escolherProduto, tirarProduto, abrirHoje,
    gerar, mudarLembrete, ligarLembretes, aplicarDias, dispensarAlternar,
  };
}

export type Skincare = ReturnType<typeof useSkincare>;
