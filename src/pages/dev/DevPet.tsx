import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/pet";
import Pet from "@/pages/Pet";
import Home from "@/pages/Home";

/**
 * /dev/pet — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro
 * de `import.meta.env.DEV`; some do build). O Pet de verdade com dados de
 * exemplo — nada vai pro servidor, não precisa de conta.
 *
 * Os dados ficam no localStorage DESTE navegador ("dev-pet-dados"), pra dar
 * pra testar o ciclo inteiro: abrir → usar → sair → REABRIR (recarregar).
 *   ?vazio=1   · primeira vez (sem pet nenhum: começo pronto)
 *   ?antigo=1  · só o formato do app ANTIGO (pet-list/pet-health/rotina de sempre)
 *   ?tela=home · a Home com o widget "Pet de hoje"
 *   ?reset=1   · apaga o que foi gravado e começa das sementes
 * Fotos: /dev-fotos/<nome>.jpg (o script dos prints serve as imagens; sem
 * elas o RG mostra o emoji da espécie). Tema escuro/paleta vêm do próprio app.
 */

const GUARDA = "dev-pet-dados";

const sementes = (hoje: string, modo: "cheio" | "vazio" | "antigo"): Record<string, unknown> => {
  const d = (n: number) => somarDias(hoje, n);
  const base: Record<string, unknown> = { "core-user-name": "Ana Beatriz", "core-home-widgets-v2": [{ id: "pet", size: "large" }] };
  if (modo === "vazio") return { ...base, "core-home-widgets-v2": [] };
  if (modo === "antigo") {
    // exatamente como o app antigo gravava (5 abas, texto livre, tipos vaccine/deworming/visit)
    return {
      ...base,
      "pet-list": [
        { id: "1727000000000", name: "Thor", species: "cachorro", breed: "Golden", weight: "28 kg", birthday: "2021-04-15" },
        { id: "1727000000001", name: "Mia", species: "gata", breed: "", weight: "4,2", birthday: "" },
      ],
      "pet-health": [
        { id: "h1", petId: "1727000000000", type: "vaccine", name: "V10", date: d(-340), nextDate: d(25) },
        { id: "h2", petId: "1727000000000", type: "deworming", name: "Drontal", date: d(-95), nextDate: d(-5) },
        { id: "h3", petId: "1727000000000", type: "deworming", name: "Bravecto", date: d(-80), nextDate: d(4) },
        { id: "h4", petId: "1727000000001", type: "visit", name: "Check-up anual", date: d(-20), nextDate: d(345) },
      ],
      [`pet-routine-${hoje}`]: { "1727000000000": { food: true, walk: true, bath: false } },
      "pet-expenses": [
        { id: "g1", petId: "1727000000000", category: "Ração", description: "Ração 15 kg", value: 189.9, date: d(-2) },
        { id: "g2", petId: "1727000000001", category: "Adestramento", description: "", value: 120, date: d(-1) },
      ],
      "pet-expense-categories": ["Adestramento"],
      "pet-diary": [{ id: "e1", petName: "Thor", date: new Date(Date.now() - 86400e3).toISOString(), text: "Passeio longo no parque, cansou gostoso.", mood: "😊" }],
    };
  }
  return {
    ...base,
    "pet-list": [
      { id: "p-caramelo", name: "Caramelo", species: "Cachorro", breed: "Vira-lata", weight: "18,4", birthday: "2023-07-20", sexo: "macho", castrado: true, porte: "medio", chip: "986000012345678", vetNome: "Dra. Paula", vetTelefone: "(11) 98877-6655", photoUrl: "/dev-fotos/caramelo.jpg", criadoEm: "2026-09-01T12:00:00.000Z" },
      { id: "p-frida", name: "Frida", species: "Gato", breed: "SRD", weight: "4,1", birthday: "2021-02-10", sexo: "femea", castrado: true, photoUrl: "/dev-fotos/frida.jpg", criadoEm: "2026-09-01T12:05:00.000Z" },
    ],
    "pet-routine-tasks-p-caramelo": [
      { id: "food", label: "Comida · manhã", emoji: "🥣", hora: "08:00" },
      { id: "walk", label: "Passeio", emoji: "🦮" },
      { id: "water", label: "Água fresca", emoji: "💧" },
      { id: "food-noite", label: "Comida · noite", emoji: "🥣", hora: "19:00" },
    ],
    "pet-routine-tasks-p-frida": [
      { id: "food", label: "Comida · manhã", emoji: "🥣", hora: "08:00" },
      { id: "water", label: "Água fresca", emoji: "💧" },
      { id: "areia", label: "Limpar a areia", emoji: "🧹" },
      { id: "food-noite", label: "Comida · noite", emoji: "🥣", hora: "19:00" },
    ],
    [`pet-routine-${hoje}`]: { "p-caramelo": { food: true, walk: true }, "p-frida": { food: true } },
    "pet-cuidados": [
      { id: "c-v10", petId: "p-caramelo", tipo: "vacina", nome: "V10", intervaloDias: 365, criadoEm: "2026-09-01T12:00:00.000Z" },
      { id: "c-raiva", petId: "p-caramelo", tipo: "vacina", nome: "Antirrábica", intervaloDias: 365, criadoEm: "2026-09-01T12:00:00.000Z" },
      { id: "c-verm", petId: "p-caramelo", tipo: "vermifugo", nome: "Vermífugo", intervaloDias: 90, criadoEm: "2026-09-01T12:00:00.000Z" },
      { id: "c-pulga", petId: "p-caramelo", tipo: "antipulgas", nome: "NexGard", intervaloDias: 30, criadoEm: "2026-09-01T12:00:00.000Z" },
      { id: "c-check", petId: "p-caramelo", tipo: "consulta", nome: "Check-up", intervaloDias: 365, criadoEm: "2026-09-01T12:00:00.000Z" },
      { id: "c-apoquel", petId: "p-caramelo", tipo: "remedio", nome: "Apoquel", dose: "1 comp.", horarios: ["20:00"], ate: d(6), criadoEm: "2026-09-20T12:00:00.000Z" },
      { id: "c-banho", petId: "p-caramelo", tipo: "banho", nome: "Banho e tosa", intervaloDias: 15, criadoEm: "2026-09-01T12:00:00.000Z" },
      { id: "c-v4", petId: "p-frida", tipo: "vacina", nome: "V4", intervaloDias: 365, criadoEm: "2026-09-01T12:05:00.000Z" },
      { id: "c-verm-f", petId: "p-frida", tipo: "vermifugo", nome: "Vermífugo", intervaloDias: 90, criadoEm: "2026-09-01T12:05:00.000Z" },
      { id: "c-pulga-f", petId: "p-frida", tipo: "antipulgas", nome: "Antipulgas e carrapatos", intervaloDias: 30, sugerido: true, criadoEm: "2026-09-01T12:05:00.000Z" },
    ],
    "pet-health": [
      { id: "r1", petId: "p-caramelo", type: "vaccine", name: "V10", date: d(-565), nextDate: d(-200), cuidadoId: "c-v10" },
      { id: "r2", petId: "p-caramelo", type: "vaccine", name: "V10", date: d(-200), nextDate: d(165), cuidadoId: "c-v10", obs: "Lote 2231 · Clínica Bicho Feliz" },
      { id: "r3", petId: "p-caramelo", type: "vaccine", name: "Antirrábica", date: d(-200), nextDate: d(165), cuidadoId: "c-raiva" },
      { id: "r4", petId: "p-caramelo", type: "deworming", name: "Vermífugo", date: d(-85), nextDate: d(5), cuidadoId: "c-verm" },
      { id: "r5", petId: "p-caramelo", type: "antipulgas", name: "NexGard", date: d(-32), nextDate: d(-2), cuidadoId: "c-pulga" },
      { id: "r6", petId: "p-caramelo", type: "visit", name: "Check-up", date: d(-150), nextDate: d(215), cuidadoId: "c-check" },
      { id: "r7", petId: "p-caramelo", type: "banho", name: "Banho e tosa", date: d(-9), nextDate: d(6), cuidadoId: "c-banho" },
      { id: "r8", petId: "p-frida", type: "vaccine", name: "V4", date: d(-120), nextDate: d(245), cuidadoId: "c-v4" },
      { id: "r9", petId: "p-frida", type: "deworming", name: "Vermífugo", date: d(-60), nextDate: d(30), cuidadoId: "c-verm-f" },
    ],
    "pet-pesos": {
      "p-caramelo": [
        { dia: d(-240), kg: 16.2 }, { dia: d(-180), kg: 17.1 }, { dia: d(-120), kg: 17.6 }, { dia: d(-60), kg: 18.0 }, { dia: d(-5), kg: 18.4 },
      ],
      "p-frida": [{ dia: d(-40), kg: 4.3 }, { dia: d(-3), kg: 4.1 }],
    },
    "pet-expenses": [
      { id: "g1", petId: "p-caramelo", category: "Ração", description: "Ração Premier 15 kg", value: 219.9, date: d(-3) },
      { id: "g2", petId: "p-caramelo", category: "Banho/Tosa", description: "Banho e tosa", value: 85, date: d(-9) },
      { id: "g3", petId: "p-frida", category: "Ração", description: "Sachês (caixa)", value: 64.5, date: d(-6) },
      { id: "g4", petId: "p-caramelo", category: "Medicamento", description: "Apoquel 5,4 mg", value: 142, date: d(-8) },
      { id: "g5", petId: "p-frida", category: "Outro", description: "Areia 12 kg", value: 39.9, date: d(-2) },
    ],
    "pet-diary": [
      { id: "e2", petName: "Frida", date: new Date(Date.now() - 3 * 3600e3).toISOString(), text: "Descobriu a caixa da ração nova e dormiu dentro dela a tarde toda.", mood: "😴", photoUrl: "/dev-fotos/frida.jpg" },
      { id: "e1", petName: "Caramelo", date: new Date(Date.now() - 26 * 3600e3).toISOString(), text: "Primeiro passeio longo depois da alergia. Voltou feliz e cheio de carrapicho.", mood: "😍", photoUrl: "/dev-fotos/caramelo.jpg" },
    ],
  };
};

const lerGuardado = (): Record<string, unknown> | null => {
  try { const t = localStorage.getItem(GUARDA); return t ? JSON.parse(t) : null; } catch { return null; }
};

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children: ReactNode }) => {
  const [dados, setDados] = useState(inicial);
  const atual = useRef(dados);
  atual.current = dados;
  // `get` muda de identidade quando os dados mudam: os useMemo dos hooks recalculam
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => {
    const novo = { ...d, [k]: v };
    try { localStorage.setItem(GUARDA, JSON.stringify(novo)); } catch { /* cheio: segue só na memória */ }
    return novo;
  }), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: true, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

const DevPet = () => {
  const [params] = useSearchParams();
  const hoje = localDayKey();
  const modo = params.get("vazio") === "1" ? "vazio" : params.get("antigo") === "1" ? "antigo" : "cheio";
  const inicial = useMemo(() => {
    if (params.get("reset") === "1") { try { localStorage.removeItem(GUARDA); } catch { /* noop */ } }
    const guardado = params.get("reset") === "1" ? null : lerGuardado();
    const s = guardado ?? sementes(hoje, modo);
    if (!guardado) { try { localStorage.setItem(GUARDA, JSON.stringify(s)); } catch { /* noop */ } }
    return s;
  }, [hoje, modo, params]);
  return (
    <Provedor inicial={inicial}>
      {params.get("tela") === "home" ? <Home /> : <Pet />}
    </Provedor>
  );
};

export default DevPet;
