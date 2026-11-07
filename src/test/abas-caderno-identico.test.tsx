/**
 * CHAVE DESLIGADA = O APP DE HOJE, BYTE A BYTE (07/11, spec trial-abas/SPEC.md §5.3).
 *
 * O caderno com sumário (lib/abas-caderno) mora atrás das chaves `abas_enxutas` (padrão "on" = braço hoje) e
 * `abas_visual` (padrão "hoje") — e a medição nova atrás de `abas_medicao` (padrão "off"). Com as três no padrão, a
 * fileira, a folha "Organizar abas" e os eventos têm de sair IGUAIS aos do main de antes do caderno (commit c66dd323).
 *
 * A foto do main está em src/test/fixtures/fileira-abas-main.json, gerada com ESTE arquivo rodando sobre o código de
 * antes do caderno (`GERAR_FOTO_FILEIRA=1 npx vitest run src/test/abas-caderno-identico.test.tsx`). Não regerar
 * depois de mexer na fileira: a foto é a régua. Se a fileira de hoje mudar de propósito (pedido do dono), regerar
 * a partir do main novo e dizer isso no commit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(),
  markActivation: () => Promise.resolve(),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useAbasOcultas, type AbaOcultavel } from "@/hooks/use-abas-ocultas";
import { AbasOcultaveis } from "@/components/ui/abas-ocultaveis";
import { _zerarTodasAsAbas } from "@/lib/abas-ocultas";
import { CHAVE_ORIGEM_CONTA, _zerarHomeNova } from "@/lib/home-nova";

const FOTO = resolve(__dirname, "fixtures/fileira-abas-main.json");
const GERAR = process.env.GERAR_FOTO_FILEIRA === "1";

const FIN: AbaOcultavel[] = [
  { id: "dashboard", label: "DASHBOARD", icon: "📊" },
  { id: "financeiro", label: "MEU FINANCEIRO", icon: "💰", spotlight: "financeiro" },
  { id: "investimentos", label: "INVESTIMENTOS", icon: "📈" },
  { id: "itens", label: "DESEJOS", icon: "❤️" },
  { id: "simuladores", label: "SIMULADORES", icon: "🧮" },
  { id: "limites", label: "LIMITES", icon: "🎯" },
  { id: "relatorios", label: "RELATÓRIOS", icon: "📋" },
  { id: "saude", label: "SAÚDE FINANCEIRA", icon: "💚" },
];
const ROT: AbaOcultavel[] = [
  { id: "semana", label: "MINHA SEMANA", icon: "📅" },
  { id: "mes", label: "MEU MÊS", icon: "📆" },
  { id: "diario", label: "DIÁRIO", icon: "📝" },
  { id: "revisao", label: "REVISÃO", icon: "⭐" },
  { id: "foco", label: "FOCO", icon: "🧠" },
];
const BEL: AbaOcultavel[] = [
  { id: "routine", label: "SKINCARE", icon: "✨" },
  { id: "hair", label: "CABELO", icon: "💇‍♀️" },
  { id: "shelf", label: "MEUS PRODUTOS", icon: "🧴" },
  { id: "care", label: "CUIDADOS", icon: "💅" },
];

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const escritas: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { escritas.push(key); dados[key] = JSON.parse(JSON.stringify(value)); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  };
  return { dados, valor, escritas };
};
const Com = ({ store, children }: { store: ReturnType<typeof criarStore>; children: ReactNode }) => (
  <UserDataContext.Provider value={store.valor}>{children}</UserDataContext.Provider>
);
const Pagina = ({ modulo, abas: lista, inicial }: { modulo: string; abas: AbaOcultavel[]; inicial: string }) => {
  const [ativa, setAtiva] = useState(inicial);
  const abas = useAbasOcultas(modulo, lista);
  return <AbasOcultaveis abas={abas} ativa={ativa} onTrocar={setAtiva} className="max-w-7xl mx-auto px-4 pb-2" />;
};

const NOVA = { [CHAVE_ORIGEM_CONTA]: { tipo: "nova" } };
const ANTIGA = { [CHAVE_ORIGEM_CONTA]: { tipo: "antiga" } };

/** Os cenários: o que a conta nova e a antiga veem hoje, com e sem coisa gravada, link pra aba oculta, folha aberta. */
const CENARIOS: Array<{ nome: string; modulo: string; abas: AbaOcultavel[]; inicial: string; dados: Record<string, unknown>; acao?: "ver-todas" | "folha" | "trocar" }> = [
  { nome: "financas-nova", modulo: "financas", abas: FIN, inicial: "financeiro", dados: NOVA },
  { nome: "financas-nova-link-oculta", modulo: "financas", abas: FIN, inicial: "investimentos", dados: NOVA },
  { nome: "financas-nova-ver-todas", modulo: "financas", abas: FIN, inicial: "financeiro", dados: NOVA, acao: "ver-todas" },
  { nome: "financas-nova-folha", modulo: "financas", abas: FIN, inicial: "financeiro", dados: NOVA, acao: "folha" },
  { nome: "financas-nova-trocar", modulo: "financas", abas: FIN, inicial: "financeiro", dados: NOVA, acao: "trocar" },
  { nome: "financas-antiga", modulo: "financas", abas: FIN, inicial: "financeiro", dados: ANTIGA },
  { nome: "financas-antiga-uma-oculta", modulo: "financas", abas: FIN, inicial: "financeiro", dados: { ...ANTIGA, "abas-ocultas:financas": ["limites"] } },
  { nome: "financas-antiga-folha", modulo: "financas", abas: FIN, inicial: "financeiro", dados: ANTIGA, acao: "folha" },
  { nome: "financas-nova-ja-mostrou-todas", modulo: "financas", abas: FIN, inicial: "financeiro", dados: { ...NOVA, "abas-ocultas:financas": [] } },
  { nome: "rotina-nova", modulo: "rotina", abas: ROT, inicial: "semana", dados: NOVA },
  { nome: "rotina-nova-folha", modulo: "rotina", abas: ROT, inicial: "semana", dados: NOVA, acao: "folha" },
  { nome: "beleza-nova", modulo: "beleza", abas: BEL, inicial: "routine", dados: NOVA },
  { nome: "beleza-antiga", modulo: "beleza", abas: BEL, inicial: "care", dados: ANTIGA },
];

type Foto = { html: string; corpo: string; eventos: Array<[string, Record<string, unknown>]>; escritas: string[] };

async function fotografar(c: (typeof CENARIOS)[number]): Promise<Foto> {
  const store = criarStore(c.dados);
  const { container } = render(<Com store={store}><Pagina modulo={c.modulo} abas={c.abas} inicial={c.inicial} /></Com>);
  if (c.acao === "ver-todas") fireEvent.click(container.querySelector('[data-testid="abas-mostrar-todas"]')!);
  if (c.acao === "folha") fireEvent.click(container.querySelector('[data-testid="abas-organizar"]')!);
  if (c.acao === "trocar") fireEvent.click(container.querySelector('[data-spotlight="tab-dashboard"]')!);
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  const dialogo = document.querySelector('[data-testid="abas-organizar-folha"]');
  // a folha anima (framer-motion): o estilo inline muda a cada quadro — a foto compara a estrutura e o texto
  const semEstilo = (s: string) => s.replace(/ style="[^"]*"/g, "");
  return { html: container.innerHTML, corpo: dialogo ? semEstilo(dialogo.innerHTML) : "", eventos: eventos.splice(0), escritas: store.escritas };
}

beforeEach(() => {
  eventos.length = 0;
  localStorage.clear();
  _zerarTodasAsAbas(); _zerarHomeNova();
});
afterEach(() => cleanup());

describe("chave desligada: a fileira é a do main", () => {
  it("as fotos de todos os cenários batem com a do main de antes do caderno", async () => {
    const atual: Record<string, Foto> = {};
    for (const c of CENARIOS) {
      atual[c.nome] = await fotografar(c);
      cleanup();
      localStorage.clear(); _zerarTodasAsAbas(); _zerarHomeNova();
    }
    if (GERAR) {
      writeFileSync(FOTO, JSON.stringify({ gerada_em: new Date().toISOString(), base: "c66dd323", cenarios: atual }, null, 1));
      return;
    }
    expect(existsSync(FOTO), "a foto do main tem de existir").toBe(true);
    const main = JSON.parse(readFileSync(FOTO, "utf8")) as { cenarios: Record<string, Foto> };
    expect(Object.keys(atual)).toEqual(Object.keys(main.cenarios));
    for (const nome of Object.keys(main.cenarios)) {
      expect(atual[nome].html, `${nome}: fileira`).toBe(main.cenarios[nome].html);
      expect(atual[nome].corpo, `${nome}: folha`).toBe(main.cenarios[nome].corpo);
      expect(atual[nome].eventos, `${nome}: eventos`).toEqual(main.cenarios[nome].eventos);
      expect(atual[nome].escritas, `${nome}: o que foi gravado`).toEqual(main.cenarios[nome].escritas);
    }
  });
});
