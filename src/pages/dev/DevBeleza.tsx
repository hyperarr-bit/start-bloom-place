import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { gerarRotina, guardarNaBancada, passoDigitado, type PassoDaRotina, type ProdutoDaBancada, type ProdutoDoCatalogo } from "@/lib/beleza-rotina";
import { CHAVE_LEMBRETE_SKINCARE, lerDadosDoSkincare, planejarSkincare } from "@/lib/beleza-lembrete";
import { BASES_LEMBRETES } from "@/lib/notificacoes";
import { quandoDoAviso } from "@/components/beleza/lembrete-skincare";
import catalogo from "@/data/produtos-beleza.json";
import Home from "@/pages/Home";
import Beleza from "@/pages/Beleza";

/**
 * /dev/beleza — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de
 * `import.meta.env.DEV`; some do build). A Beleza e a Home de verdade com uma
 * rotina de exemplo em memória — nada vai pro servidor, não precisa de conta.
 * Pra fotografar o protótipo de 28/09 (rotina pronta em 3 toques + skincare de
 * hoje + lembrete) antes de ir pro ar.
 *   (padrão)       · a Beleza com a rotina da Ana (pele oleosa, acne, avançado)
 *   ?tela=home     · a Home com o card "Skincare de hoje"
 *   ?tela=vazia    · a Beleza sem rotina (as 3 perguntas)
 *   ?tela=antiga   · rotina ANTIGA (do tempo do ciclo de 4 dias): tudo todo dia + a oferta "Alternar"
 *   ?tela=labios   · a rotina da Ana + um passo digitado "Protetor labial" (acha os produtos de lábios)
 *   ?tela=avisos   · o que o celular recebe (o plano do lembrete, com o texto de cada dia)
 * O tema escuro vem do próprio app (localStorage "core-theme-mode").
 */

const LISTA = catalogo as unknown as ProdutoDoCatalogo[];
const produto = (id: string) => {
  const p = LISTA.find((x) => x.id === id);
  if (!p) throw new Error(`produto ${id} não está na lista`);
  return p;
};
const diaMenos = (hoje: string, n: number) => {
  const d = parseLocalDay(hoje);
  d.setDate(d.getDate() - n);
  return localDayKey(d);
};

const seeds = (hoje: string, tela: string): Record<string, unknown> => {
  const base: Record<string, unknown> = {
    "core-user-name": "Ana Beatriz",
    "spotlight-done-beleza": "true",
  };
  if (tela === "vazia") return base;
  if (tela === "antiga") {
    // como uma conta real do app antigo: nomes digitados à mão, flags, checks por índice, sem dias
    const ontem = diaMenos(hoje, 1);
    return {
      ...base,
      "skincare-am-steps": [{ name: "Gel de limpeza" }, { name: "Vitamina C" }, { name: "Protetor solar", isSunscreen: true }],
      "skincare-pm-steps": [{ name: "Demaquilante" }, { name: "Retinol", isAcid: true }, { name: "Ácido glicólico", isAcid: true }, { name: "Hidratante" }],
      "skincare-morning-checked": { [hoje]: [0, 1], [ontem]: [0, 1, 2] },
      "skincare-night-checked": { [ontem]: [0, 3] },
      "skincare-cycle-start": "2026-09-10",
    };
  }

  // a rotina que as 3 respostas da Ana geram (o gerador de verdade)
  const { manha, noite } = gerarRotina({ pele: "oleosa", objetivo: "acne", nivel: "avancado" });
  // os produtos dela, da lista curada (cada passo aponta pra um item da Bancada)
  let bancada: ProdutoDaBancada[] = [];
  const guardar = (id: string, idBancada: string, abertoEm?: string) => {
    const r = guardarNaBancada(bancada, produto(id), idBancada);
    bancada = r.bancada.map((x) => (x.id === r.id && abertoEm ? { ...x, opened: true, openedDate: abertoEm } : x));
    return r.id;
  };
  const limpeza = guardar("la-roche-posay-gel-de-limpeza-facial-effaclar-concentrado", "b1", "2026-07-20");
  const niacinamida = guardar("principia-serum-niacinamida-nc-10-10-niacinamida-e-1-zinco", "b2", "2026-08-02");
  const hidratante = guardar("neutrogena-hidratante-facial-hydro-boost-water-gel", "b3");
  const protetor = guardar("isdin-fusion-water-fps-60", "b4", "2026-08-10");
  const salicilico = guardar("sallve-super-acido-salicilico-2", "b5", "2026-09-01");
  const retinol = guardar("principia-serum-retinol-0-3-rn-0-3-retinol-vitamina-e-e-bisabolol", "b6", "2026-04-05");
  const comProduto = (lista: PassoDaRotina[], ids: (string | null)[]) => lista.map((p, i) => (ids[i] ? { ...p, produtoId: ids[i] as string } : p));
  // manhã: limpeza, niacinamida, hidratante, protetor · noite: limpeza, ácido salicílico, retinol, hidratante (sem produto: mostra o "+ escolher")
  const am = [
    ...comProduto(manha, [limpeza, niacinamida, hidratante, protetor]),
    ...(tela === "labios" ? [passoDigitado("Protetor labial", "manha")] : []),
  ];
  const pm = comProduto(noite, [limpeza, salicilico, retinol, null]);

  const ontem = diaMenos(hoje, 1);
  const feitosManha: Record<string, number[]> = { [hoje]: [0, 1], [ontem]: [0, 1, 2, 3] };
  const feitosNoite: Record<string, number[]> = { [ontem]: [0] };
  for (let k = 2; k <= 6; k++) { feitosManha[diaMenos(hoje, k)] = [0, 1, 2, 3]; feitosNoite[diaMenos(hoje, k)] = [0, 1, 2, 3]; }

  return {
    ...base,
    "core-home-widgets-v2": [{ id: "skincare", size: "large" }],
    "skincare-am-steps": am,
    "skincare-pm-steps": pm,
    "skincare-morning-checked": feitosManha,
    "skincare-night-checked": feitosNoite,
    "skincare-daily-checkin": { [hoje]: "oleosa" },
    "skincare-perfil": { pele: "oleosa", objetivo: "acne", nivel: "avancado" },
    "beauty-products": bancada,
    [CHAVE_LEMBRETE_SKINCARE]: { manha: { ligado: true, hora: "07:30" }, noite: { ligado: true, hora: "21:30" } },
  };
};

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children: ReactNode }) => {
  const [dados, setDados] = useState(inicial);
  const atual = useRef(dados);
  atual.current = dados;
  // `get` muda de identidade quando os dados mudam: quem lê do store re-renderiza junto
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => ({ ...d, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: true, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

/** O que o celular recebe nos próximos dias — o MESMO planejamento que vai pro agendador. */
const Avisos = ({ dados }: { dados: Record<string, unknown> }) => {
  const get = <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
  const avisos = planejarSkincare(lerDadosDoSkincare(get), BASES_LEMBRETES.beleza).slice(0, 7);
  return (
    <div className="min-h-dvh bg-neutral-800 px-4 py-6 space-y-2.5">
      <p className="text-[11px] font-extrabold tracking-[.14em] text-neutral-300 px-1">O QUE O CELULAR RECEBE · PRÓXIMOS DIAS</p>
      {avisos.map((a) => (
        <div key={a.id} className="rounded-2xl bg-neutral-100 px-3.5 py-3 shadow">
          <div className="flex items-center gap-1.5 text-[11.5px] text-neutral-500">
            <span className="w-4 h-4 rounded-full bg-neutral-900 text-[8px] font-black text-white grid place-items-center">C</span>
            CORE · {quandoDoAviso(a.quando)}
          </div>
          <p className="mt-1 text-[14px] font-bold text-neutral-900">{a.title}</p>
          <p className="text-[13px] text-neutral-700 leading-snug">{a.body}</p>
        </div>
      ))}
      <p className="text-[11px] text-neutral-400 px-1 pt-1">ids {avisos[0]?.id}…{avisos[avisos.length - 1]?.id} (faixa própria da Beleza, 1700000+)</p>
    </div>
  );
};

const DevBeleza = () => {
  const [params] = useSearchParams();
  const hoje = localDayKey();
  const tela = params.get("tela") ?? "beleza";
  const inicial = useMemo(() => seeds(hoje, tela), [hoje, tela]);
  if (tela === "avisos") return <Avisos dados={inicial} />;
  return <Provedor inicial={inicial}>{tela === "home" ? <Home /> : <Beleza />}</Provedor>;
};

export default DevBeleza;
