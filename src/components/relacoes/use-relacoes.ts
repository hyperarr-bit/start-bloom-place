import { useMemo, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { avisarApagado } from "@/lib/desfazer";
import { trackEvent } from "@/lib/analytics";
import {
  CHAVE_DATAS, CHAVE_EVENTOS, CHAVE_MOMENTOS, CHAVE_PESSOAS, CHAVE_PRESENTES, datasDoAno, datasValidas,
  ehDaPessoa, eventosValidos, momentosValidos, novoId, pessoasPraFalar, pessoasValidas, presentesValidos, proximoStatus,
  type Circulo, type DataEspecial, type Evento, type Momento, type Pessoa, type Presente, type TipoMomento,
} from "@/lib/relacoes";

/**
 * Dados e ações de Relações. LÊ pelo `get` do useUserData (store ao vivo —
 * a Home e o módulo veem a mesma coisa) e ESCREVE sempre em cima da lista
 * CRUA: o que a tela não conhece (campo de um app mais novo, item torto) é
 * preservado. Abrir o módulo nunca grava nada.
 */

type Bruto = Record<string, unknown>;
const cru = (v: unknown): Bruto[] => (Array.isArray(v) ? (v as Bruto[]) : []);

export type CamposPessoa = {
  name: string;
  relation: string;
  birthday: string;
  semAno: boolean;
  notes: string;
  circulo?: Circulo;
};

export function useRelacoes() {
  const { get, set } = useUserData();
  // o "Desfazer" chega segundos depois: tem que ler a lista DE AGORA, não a do render em que apagou
  const getRef = useRef(get);
  getRef.current = get;
  /** Leitura pras AÇÕES: o store do render mais recente (o toque no "Desfazer" e a volta do
   *  WhatsApp chegam com o render antigo na mão — ler dele desfazia errado). */
  const ler = <T,>(k: string, f: T): T => getRef.current<T>(k, f);
  const brutoPessoas = get<unknown>(CHAVE_PESSOAS, []);
  const brutoDatas = get<unknown>(CHAVE_DATAS, []);
  const brutoMomentos = get<unknown>(CHAVE_MOMENTOS, []);
  const brutoPresentes = get<unknown>(CHAVE_PRESENTES, []);
  const brutoEventos = get<unknown>(CHAVE_EVENTOS, []);
  const hoje = localDayKey();

  const pessoas = useMemo(() => pessoasValidas(brutoPessoas), [brutoPessoas]);
  const datas = useMemo(() => datasValidas(brutoDatas), [brutoDatas]);
  const momentos = useMemo(() => momentosValidos(brutoMomentos), [brutoMomentos]);
  const presentes = useMemo(() => presentesValidos(brutoPresentes), [brutoPresentes]);
  const eventos = useMemo(() => eventosValidos(brutoEventos), [brutoEventos]);
  // `hoje` entra na dependência: virou o dia com o app aberto, as contas refazem
  const itensDoAno = useMemo(() => datasDoAno(pessoas, datas, new Date()), [pessoas, datas, hoje]); // eslint-disable-line react-hooks/exhaustive-deps
  const praFalar = useMemo(() => pessoasPraFalar(pessoas, momentos, new Date()), [pessoas, momentos, hoje]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -------------------------------------------------- pessoas */

  const adicionarPessoa = (c: CamposPessoa, origem: "comeco" | "form" = "form"): string => {
    const id = novoId();
    const nova: Bruto = {
      id,
      name: c.name.trim(),
      relation: c.relation.trim(),
      birthday: c.birthday,
      notes: c.notes.trim(),
      ...(c.semAno && c.birthday ? { semAno: true } : {}),
      ...(c.circulo ? { circulo: c.circulo } : {}),
    };
    set(CHAVE_PESSOAS, [...cru(ler<unknown>(CHAVE_PESSOAS, [])), nova]);
    trackEvent("relacoes_acao", { acao: "pessoa", origem, com_data: !!c.birthday });
    return id;
  };

  /** Edita preservando o id e qualquer campo que a tela não conhece. Renomear leva junto
   *  os presentes, momentos e datas que apontavam pelo NOME antigo (dado antigo, sem id). */
  const editarPessoa = (id: string, c: Partial<CamposPessoa> & { cadencia?: number; cadenciaDesde?: string }) => {
    const lista = cru(ler<unknown>(CHAVE_PESSOAS, []));
    const antes = pessoas.find((p) => p.id === id);
    set(CHAVE_PESSOAS, lista.map((p) => {
      if (String(p.id) !== id) return p;
      const novo: Bruto = { ...p };
      if (c.name !== undefined) novo.name = c.name.trim();
      if (c.relation !== undefined) novo.relation = c.relation.trim();
      if (c.birthday !== undefined) novo.birthday = c.birthday;
      if (c.notes !== undefined) novo.notes = c.notes;
      if (c.semAno !== undefined) { if (c.semAno && (c.birthday ?? p.birthday)) novo.semAno = true; else delete novo.semAno; }
      if (c.circulo !== undefined) novo.circulo = c.circulo;
      if (c.cadencia !== undefined) {
        if (c.cadencia > 0) { novo.cadencia = c.cadencia; novo.cadenciaDesde = c.cadenciaDesde ?? localDayKey(); }
        else { delete novo.cadencia; delete novo.cadenciaDesde; }
      }
      return novo;
    }));
    const nomeNovo = c.name?.trim();
    if (antes && nomeNovo && nomeNovo !== antes.name) {
      const religar = (chave: string) => {
        const itens = cru(ler<unknown>(chave, []));
        let mudou = false;
        const novos = itens.map((x) => {
          if (x.pessoaId || !ehDaPessoa(antes, { person: String(x.person ?? "") })) return x;
          mudou = true;
          return { ...x, person: nomeNovo, pessoaId: id };
        });
        if (mudou) set(chave, novos);
      };
      [CHAVE_PRESENTES, CHAVE_MOMENTOS, CHAVE_DATAS].forEach(religar);
    }
  };

  const apagarPessoa = (id: string) => {
    const lista = cru(ler<unknown>(CHAVE_PESSOAS, []));
    const alvo = lista.find((p) => String(p.id) === id);
    if (!alvo) return;
    set(CHAVE_PESSOAS, lista.filter((p) => String(p.id) !== id));
    avisarApagado(`${String(alvo.name)} saiu da lista`, () => {
      const atual = cru(getRef.current<unknown>(CHAVE_PESSOAS, []));
      if (!atual.some((p) => String(p.id) === id)) set(CHAVE_PESSOAS, [...atual, alvo]);
    });
  };

  const definirCadencia = (id: string, dias: number) => {
    editarPessoa(id, { cadencia: dias });
    trackEvent("relacoes_acao", { acao: "cadencia", dias });
  };

  /* -------------------------------------------------- conversas e momentos */

  const conversaDeHoje = (p: Pessoa): Momento | undefined =>
    momentos.find((m) => m.tipo === "conversa" && m.date === hoje && ehDaPessoa(p, m));

  /** A conversa de hoje com a pessoa, na lista crua de AGORA. */
  const conversaDeHojeAgora = (p: Pessoa) => {
    const lista = cru(ler<unknown>(CHAVE_MOMENTOS, []));
    const dia = localDayKey();
    return { lista, ja: lista.find((m) => m.tipo === "conversa" && m.date === dia && ehDaPessoa(p, { pessoaId: m.pessoaId as string | undefined, person: String(m.person ?? "") })) };
  };

  /** "Falei hoje": marca (cria a conversa de hoje e devolve o id) ou desmarca (tira e devolve null). */
  const alternarConversaDeHoje = (p: Pessoa, descricao = "Conversamos"): string | null => {
    const { lista, ja } = conversaDeHojeAgora(p);
    if (ja) {
      set(CHAVE_MOMENTOS, lista.filter((m) => m !== ja));
      return null;
    }
    const id = novoId();
    set(CHAVE_MOMENTOS, [{ id, date: localDayKey(), person: p.name, pessoaId: p.id, description: descricao, tipo: "conversa" }, ...lista]);
    trackEvent("relacoes_acao", { acao: "conversa" });
    return id;
  };

  /** Tira um momento pelo id, sem aviso (o Desfazer do "Falei hoje"). */
  const removerMomento = (id: string) => {
    const lista = cru(ler<unknown>(CHAVE_MOMENTOS, []));
    if (lista.some((m) => String(m.id) === id)) set(CHAVE_MOMENTOS, lista.filter((m) => String(m.id) !== id));
  };

  /** Registra que a mensagem foi mandada (o sistema confirmou o compartilhamento). */
  const registrarMensagem = (p: Pessoa, descricao: string) => {
    const { lista, ja } = conversaDeHojeAgora(p);
    if (ja) return;
    set(CHAVE_MOMENTOS, [{ id: novoId(), date: localDayKey(), person: p.name, pessoaId: p.id, description: descricao, tipo: "conversa" }, ...lista]);
  };

  const adicionarMomento = (m: { date: string; pessoa?: Pessoa; person: string; description: string; tipo: TipoMomento }) => {
    const lista = cru(ler<unknown>(CHAVE_MOMENTOS, []));
    const novo: Bruto = {
      id: novoId(),
      date: m.date,
      person: m.pessoa?.name ?? m.person.trim(),
      description: m.description.trim(),
      ...(m.pessoa ? { pessoaId: m.pessoa.id } : {}),
      ...(m.tipo !== "momento" ? { tipo: m.tipo } : {}),
    };
    set(CHAVE_MOMENTOS, [novo, ...lista]);
    trackEvent("relacoes_acao", { acao: "momento", tipo: m.tipo });
  };

  const apagarMomento = (id: string) => apagarComDesfazer(CHAVE_MOMENTOS, id, "Momento apagado");

  /* -------------------------------------------------- presentes */

  const adicionarPresente = (g: { pessoa?: Pessoa; person: string; idea: string; link: string; preco: number | null }) => {
    const lista = cru(ler<unknown>(CHAVE_PRESENTES, []));
    const novo: Bruto = {
      id: novoId(),
      person: g.pessoa?.name ?? g.person.trim(),
      idea: g.idea.trim(),
      link: g.link.trim(),
      status: "idea",
      ...(g.pessoa ? { pessoaId: g.pessoa.id } : {}),
      ...(g.preco ? { preco: g.preco } : {}),
    };
    set(CHAVE_PRESENTES, [...lista, novo]);
    trackEvent("relacoes_acao", { acao: "presente", com_preco: !!g.preco });
  };

  const ciclarPresente = (id: string) => {
    const lista = cru(ler<unknown>(CHAVE_PRESENTES, []));
    set(CHAVE_PRESENTES, lista.map((g) => {
      if (String(g.id) !== id) return g;
      const atual = (g.status === "bought" || g.status === "delivered" ? g.status : "idea") as Presente["status"];
      return { ...g, status: proximoStatus(atual) };
    }));
  };

  const apagarPresente = (id: string) => apagarComDesfazer(CHAVE_PRESENTES, id, "Ideia de presente apagada");

  /* -------------------------------------------------- datas especiais */

  const adicionarData = (d: { title: string; date: string; type: DataEspecial["type"]; pessoa?: Pessoa; person: string }) => {
    const lista = cru(ler<unknown>(CHAVE_DATAS, []));
    set(CHAVE_DATAS, [...lista, {
      id: novoId(), title: d.title.trim(), person: d.pessoa?.name ?? d.person.trim(), date: d.date, type: d.type,
      ...(d.pessoa ? { pessoaId: d.pessoa.id } : {}),
    }]);
    trackEvent("relacoes_acao", { acao: "data", tipo: d.type });
  };

  const apagarData = (id: string) => apagarComDesfazer(CHAVE_DATAS, id, "Data apagada");

  /* -------------------------------------------------- eventos */

  const adicionarEvento = (e: { name: string; date: string; location: string }) => {
    const lista = cru(ler<unknown>(CHAVE_EVENTOS, []));
    set(CHAVE_EVENTOS, [...lista, { id: novoId(), name: e.name.trim(), date: e.date, location: e.location.trim(), rsvp: "maybe", tasks: [] }]);
    trackEvent("relacoes_acao", { acao: "evento" });
  };

  const mexerNoEvento = (id: string, fn: (e: Bruto) => Bruto) => {
    const lista = cru(ler<unknown>(CHAVE_EVENTOS, []));
    set(CHAVE_EVENTOS, lista.map((e) => (String(e.id) === id ? fn(e) : e)));
  };

  const ciclarRsvp = (id: string) => mexerNoEvento(id, (e) => {
    const ordem: Evento["rsvp"][] = ["confirmed", "maybe", "declined"];
    const atual = (ordem.includes(e.rsvp as Evento["rsvp"]) ? e.rsvp : "maybe") as Evento["rsvp"];
    return { ...e, rsvp: ordem[(ordem.indexOf(atual) + 1) % ordem.length] };
  });

  const adicionarTarefa = (id: string, texto: string) => mexerNoEvento(id, (e) => ({
    ...e, tasks: [...cru(e.tasks), { id: novoId(), text: texto.trim(), done: false }],
  }));

  const alternarTarefa = (id: string, tarefaId: string) => mexerNoEvento(id, (e) => ({
    ...e, tasks: cru(e.tasks).map((t) => (String(t.id) === tarefaId ? { ...t, done: t.done !== true } : t)),
  }));

  const apagarEvento = (id: string) => apagarComDesfazer(CHAVE_EVENTOS, id, "Evento apagado");

  /* -------------------------------------------------- apagar com desfazer */

  function apagarComDesfazer(chave: string, id: string, texto: string) {
    const lista = cru(ler<unknown>(chave, []));
    const i = lista.findIndex((x) => String(x.id) === id);
    if (i < 0) return;
    const alvo = lista[i];
    set(chave, lista.filter((x) => String(x.id) !== id));
    avisarApagado(texto, () => {
      const atual = cru(getRef.current<unknown>(chave, []));
      if (atual.some((x) => String(x.id) === id)) return;
      const volta = [...atual];
      volta.splice(Math.min(i, volta.length), 0, alvo);
      set(chave, volta);
    });
  }

  return {
    hoje, pessoas, datas, momentos, presentes, eventos, itensDoAno, praFalar,
    adicionarPessoa, editarPessoa, apagarPessoa, definirCadencia,
    conversaDeHoje, alternarConversaDeHoje, removerMomento, registrarMensagem, adicionarMomento, apagarMomento,
    adicionarPresente, ciclarPresente, apagarPresente,
    adicionarData, apagarData,
    adicionarEvento, ciclarRsvp, adicionarTarefa, alternarTarefa, apagarEvento,
  };
}

export type Relacoes = ReturnType<typeof useRelacoes>;
export type { Pessoa, Presente, Momento, DataEspecial, Evento };
