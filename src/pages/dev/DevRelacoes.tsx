import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { BASES_LEMBRETES } from "@/lib/notificacoes";
import { lerDadosDasRelacoes, planejarRelacoes } from "@/lib/relacoes-lembrete";
import Home from "@/pages/Home";
import Relacionamentos from "@/pages/Relacionamentos";

/**
 * /dev/relacoes — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota
 * dentro de `import.meta.env.DEV`; some do build). Relações e a Home de
 * verdade com as pessoas da Ana em memória — nada vai pro servidor, não
 * precisa de conta. Pra fotografar a Onda 1 (29/09) antes de ir pro ar.
 *   (padrão)            · a Ana: 9 pessoas, presentes, momentos, datas de casal, eventos
 *   ?tela=vazia         · ninguém ainda (o "Quem você não pode esquecer?")
 *   ?tela=comeco        · começo pela metade (2 de 3)
 *   ?tela=hoje          · aniversário HOJE (o selo + "Mandar parabéns")
 *   ?tela=antiga        · dado do app ANTIGO (sem nenhum campo novo, data repetida, presente por nome)
 *   ?tela=home          · a Home com o widget de Relações
 *   ?tela=avisos-plano  · o texto dos avisos que o celular receberia (no dia + manter contato)
 *   &aba=agenda|presentes|momentos · abre a aba  ·  &ficha=<id> · abre a ficha  ·  &avisos=1 · a folha de avisos
 * O tema escuro/paleta vem do próprio app (localStorage core-theme-mode / core-theme-palette).
 */

const somar = (hoje: Date, dias: number) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
/** Aniversário que cai daqui a N dias, num ano de nascimento dado. */
const aniv = (hoje: Date, emDias: number, ano: number) => {
  const d = somar(hoje, emDias);
  return `${ano}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const diaHa = (hoje: Date, dias: number) => localDayKey(somar(hoje, -dias));

const seeds = (tela: string): Record<string, unknown> => {
  const hoje = new Date();
  const base: Record<string, unknown> = {
    "core-user-name": "Ana Beatriz",
    "spotlight-done-relacionamentos": "true",
    // a dica do módulo aparece pra quem entra a 1ª vez; nos prints ela esconderia o desenho (?dica=1 mostra)
    "core-tip-seen-relacionamentos": "true",
  };
  if (tela === "vazia") return base;
  if (tela === "comeco") {
    return {
      ...base,
      "rel-people": [
        { id: "p1", name: "Mãe", relation: "Mãe", birthday: aniv(hoje, 75, 1963), notes: "", circulo: "familia" },
        { id: "p2", name: "Ju", relation: "Melhor amiga", birthday: aniv(hoje, 3, 1997), notes: "", circulo: "amigos" },
      ],
    };
  }
  if (tela === "antiga") {
    // exatamente o que o app antigo gravava: sem circulo/semAno/cadencia/pessoaId/tipo/preco
    return {
      ...base,
      "rel-people": [
        { id: "1", name: "Mãe", relation: "Família", birthday: aniv(hoje, 40, 1965), notes: "Gosta de orquídea" },
        { id: "2", name: "Ana", relation: "Namorada", birthday: aniv(hoje, 150, 1998), notes: "Ama café coado" },
        { id: "3", name: "João", relation: "Amigo", birthday: aniv(hoje, 8, 1997), notes: "Aniversário sempre no bar do Zé" },
        { id: "5", name: "Dona Lúcia", relation: "Cliente", birthday: "", notes: "Sempre pergunta dos filhos" },
      ],
      "rel-dates": [
        { id: "1", title: "Aniversário da mãe", person: "Mãe", date: aniv(hoje, 40, 2025), type: "birthday" },
        { id: "2", title: "1 ano de namoro", person: "Ana", date: aniv(hoje, 20, 2025), type: "anniversary" },
      ],
      "rel-moments": [{ id: "1", date: diaHa(hoje, 2), person: "Ana", description: "Jantar surpresa em casa" }],
      "rel-gifts": [{ id: "1", person: "Ana", idea: "Moka italiana", link: "", status: "idea" }],
      "rel-events": [{ id: "1", name: "Churrasco do Pedro", date: localDayKey(somar(hoje, 5)), location: "Casa do Pedro", rsvp: "confirmed", tasks: [{ id: "1", text: "Levar carvão", done: false }] }],
    };
  }
  const ehHoje = tela === "hoje";
  return {
    ...base,
    "rel-people": [
      { id: "p-ju", name: "Ju", relation: "Melhor amiga", birthday: aniv(hoje, ehHoje ? 0 : 3, 1997), notes: "Ama Clarice Lispector e café gelado.\nTamanho M. Alérgica a camarão.", circulo: "amigos", cadencia: 14, cadenciaDesde: diaHa(hoje, 60) },
      { id: "p-vo", name: "Vó Cida", relation: "Avó", birthday: aniv(hoje, 16, 1946), notes: "Adora orquídea e novela das 9.", circulo: "familia", cadencia: 7, cadenciaDesde: diaHa(hoje, 30) },
      { id: "p-lucas", name: "Lucas", relation: "Afilhado", birthday: aniv(hoje, 25, 2019), notes: "Fase dos dinossauros.", circulo: "familia" },
      { id: "p-rafa", name: "Rafael", relation: "Namorado", birthday: aniv(hoje, 53, 1995), notes: "Café sem açúcar. Quer aprender a tocar violão.", circulo: "amor" },
      { id: "p-mae", name: "Mãe", relation: "Mãe", birthday: aniv(hoje, 75, 1963), notes: "", circulo: "familia", cadencia: 7, cadenciaDesde: diaHa(hoje, 20) },
      { id: "p-carol", name: "Carol", relation: "Amiga da faculdade", birthday: aniv(hoje, 150, 1996), notes: "Começou no emprego novo em agosto.", circulo: "amigos", cadencia: 14, cadenciaDesde: diaHa(hoje, 90) },
      { id: "p-pai", name: "Pai", relation: "Pai", birthday: aniv(hoje, 200, 1960), notes: "", circulo: "familia" },
      { id: "p-bete", name: "Tia Bete", relation: "Tia", birthday: aniv(hoje, 260, 2000), semAno: true, notes: "", circulo: "familia" },
      { id: "p-paula", name: "Paula", relation: "Chefe", birthday: "", notes: "Filhos: Teo e Manu.", circulo: "trabalho" },
    ],
    "rel-dates": [
      { id: "d-namoro", title: "Namoro com o Rafa", person: "Rafael", pessoaId: "p-rafa", date: aniv(hoje, 21, 2023), type: "anniversary" },
      { id: "d-casamento", title: "Casamento da Carol", person: "Carol", pessoaId: "p-carol", date: aniv(hoje, 230, 2025), type: "custom" },
    ],
    "rel-moments": [
      { id: "m1", date: diaHa(hoje, 2), person: "Mãe", pessoaId: "p-mae", description: "Almoço de domingo, fizemos a lasanha dela", tipo: "encontro" },
      { id: "m2", date: diaHa(hoje, 9), person: "Rafael", pessoaId: "p-rafa", description: "Jantar surpresa em casa" },
      { id: "m3", date: diaHa(hoje, 12), person: "Ju", pessoaId: "p-ju", description: "Conversamos sobre a viagem de dezembro", tipo: "conversa" },
      { id: "m4", date: diaHa(hoje, 36), person: "Carol", pessoaId: "p-carol", description: "Ela ia começar no emprego novo", tipo: "conversa" },
      { id: "m5", date: diaHa(hoje, 13), person: "Vó Cida", pessoaId: "p-vo", description: "Liguei, ela contou da novela", tipo: "conversa" },
    ],
    "rel-gifts": [
      { id: "g1", person: "Ju", pessoaId: "p-ju", idea: "A hora da estrela (capa dura)", link: "", status: "idea", preco: 59.9 },
      { id: "g2", person: "Ju", pessoaId: "p-ju", idea: "Vale de massagem", link: "", status: "bought", preco: 120 },
      { id: "g3", person: "Vó Cida", pessoaId: "p-vo", idea: "Porta-retrato com a foto da família", link: "", status: "idea" },
      { id: "g4", person: "Rafael", pessoaId: "p-rafa", idea: "Aula experimental de violão", link: "", status: "idea", preco: 90 },
    ],
    "rel-events": [
      { id: "e1", name: "Chá de bebê da Lu", date: localDayKey(somar(hoje, 12)), location: "Salão do prédio", rsvp: "confirmed", tasks: [{ id: "t1", text: "Comprar fralda tamanho M", done: true }, { id: "t2", text: "Levar o bolo de cenoura", done: false }] },
      { id: "e2", name: "Festa dos 80 da Vó", date: localDayKey(somar(hoje, 16)), location: "Sítio do tio Zé", rsvp: "maybe", tasks: [] },
    ],
    "core-home-widgets-v2": [{ id: "relacoes", size: "large" }],
  };
};

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children: ReactNode }) => {
  const [dados, setDados] = useState(inicial);
  const atual = useRef(dados);
  atual.current = dados;
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => {
    const novo = { ...d, [k]: v };
    atual.current = novo;
    return novo;
  }), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: true, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

/** O que o celular receberia (no dia + manter contato ligados): o plano de verdade, em texto. */
function PlanoDosAvisos({ dados }: { dados: Record<string, unknown> }) {
  const get = <T,>(k: string, f: T): T => (k === "rel-lembrete-prefs"
    ? ({ noDia: { ligado: true, hora: "09:00" }, contato: { ligado: true, hora: "19:30" } } as unknown as T)
    : k in dados ? (dados[k] as T) : f);
  const avisos = planejarRelacoes(lerDadosDasRelacoes(get), BASES_LEMBRETES.relacoes);
  return (
    <div className="p-4 space-y-2 font-mono text-[12px]">
      <p className="font-bold">{avisos.length} avisos (faixa {BASES_LEMBRETES.relacoes}+)</p>
      {avisos.map((a) => (
        <div key={a.id} className="border border-border rounded p-2">
          <p>#{a.id} · {a.quando.toLocaleString("pt-BR")}</p>
          <p className="font-bold">{a.title}</p>
          <p>{a.body}</p>
        </div>
      ))}
    </div>
  );
}

const DevRelacoes = () => {
  const [params] = useSearchParams();
  const tela = params.get("tela") ?? "";
  const comDica = params.get("dica") === "1";
  const inicial = useMemo(() => {
    const s = seeds(tela === "home" || tela === "avisos-plano" ? "" : tela);
    if (comDica) delete s["core-tip-seen-relacionamentos"];
    return s;
  }, [tela, comDica]);
  if (tela === "avisos-plano") return <PlanoDosAvisos dados={inicial} />;
  return (
    <Provedor inicial={inicial}>
      {tela === "home" ? <Home /> : <Relacionamentos />}
    </Provedor>
  );
};

export default DevRelacoes;
