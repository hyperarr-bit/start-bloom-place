/**
 * Barra de perfis PF/PJ — só existe pra quem JÁ TEM empresa cadastrada.
 *
 * 17/10 (1.0.16, dono: "quebra o design"): o link "Separar pessoa física e
 * empresa", que ficava no topo do MEU FINANCEIRO pra todo mundo, saiu. A
 * maioria esmagadora de quem usa Finanças não tem PJ — a entrada agora mora
 * em Ajustes de Finanças (o ⚙ no fim da fila de abas, AjustesFinancas). Sem
 * empresa, este componente não desenha nada; quando a pessoa escolhe a
 * entrada no menu, o Index pede `criarAgora` e o formulário de sempre abre
 * aqui no topo ([Pessoal] [+] · Nome da empresa · Criar) — criar pelo menu é
 * exatamente o que o link fazia. Com empresa, a barra é a de antes (chips, +,
 * gerenciar): quem usa PJ troca de perfil aqui todo dia.
 *
 * A lógica de dados fica em @/lib/finance-perfil; aqui é só a escolha.
 */
import { useLayoutEffect, useState } from "react";
import { Building2, Plus, Trash2, User, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { trackEvent } from "@/lib/analytics";
import { PERFIL_PESSOAL, PERFIL_TODOS, novoPerfil, type Perfil } from "@/lib/finance-perfil";

interface Props {
  perfis: Perfil[];
  setPerfis: (p: Perfil[]) => void;
  /** Chamado ANTES de tirar o perfil da lista: quem tem os lançamentos em
   *  memória devolve os dele pro Pessoal (Index). */
  onRemover?: (id: string) => void;
  ativo: string;
  setAtivo: (id: string) => void;
  /** Pedido do menu de Ajustes ("Separar as finanças da empresa (PJ)"): abre o
   *  formulário de criar. O componente avisa `aoAtenderPedido` na hora — o
   *  pedido não pode reabrir o formulário quando a aba remonta. */
  criarAgora?: boolean;
  aoAtenderPedido?: () => void;
}

export const SeletorDePerfil = ({ perfis, setPerfis, ativo, setAtivo, onRemover, criarAgora, aoAtenderPedido }: Props) => {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [gerindo, setGerindo] = useState(false);
  /** De onde veio o formulário aberto — só pro evento (sem nome de empresa). */
  const [origem, setOrigem] = useState<"barra" | "menu">("barra");

  /* Layout effect de propósito: o formulário entra no MESMO quadro do toque
     no menu (o autoFocus abre o teclado ainda dentro do gesto, no iPhone). */
  useLayoutEffect(() => {
    if (!criarAgora) return;
    setOrigem("menu");
    setCriando(true);
    aoAtenderPedido?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criarAgora]);

  const criar = () => {
    const r = novoPerfil(perfis, nome);
    if (!r) return;
    setPerfis(r.perfis);
    setAtivo(r.id);
    trackEvent("financas_pj_criada", { origem, empresas: r.perfis.length });
    setNome("");
    setCriando(false);
  };

  const remover = (id: string) => {
    onRemover?.(id);
    setPerfis(perfis.filter((p) => p.id !== id));
    // Some o perfil ativo? Volta pro pessoal — nunca deixar a tela num filtro
    // que não existe mais, senão a Finanças aparece vazia sem explicação.
    if (ativo === id) setAtivo(PERFIL_PESSOAL);
  };

  // Sem empresa e sem formulário aberto: nada no topo (a entrada é o menu ⚙).
  if (perfis.length === 0 && !criando) return null;

  const chip = (id: string, texto: string, icone: React.ReactNode) => (
    <button
      key={id}
      onClick={() => setAtivo(id)}
      aria-pressed={ativo === id}
      className={`h-8 px-3 rounded-full border text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
        ativo === id
          ? "bg-primary text-primary-foreground border-transparent"
          : "bg-card border-border text-muted-foreground hover:bg-muted/40"
      }`}
    >
      {icone}
      {texto}
    </button>
  );

  return (
    <div className="space-y-2" data-testid="seletor-de-perfil">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
        {chip(PERFIL_PESSOAL, "Pessoal", <User className="w-3 h-3" />)}
        {perfis.map((p) => chip(p.id, p.nome, <Building2 className="w-3 h-3" />))}
        {perfis.length > 0 && chip(PERFIL_TODOS, "Tudo junto", <span className="text-[10px]">Σ</span>)}
        <button
          onClick={() => { setOrigem("barra"); setCriando(true); }}
          aria-label="Adicionar empresa"
          className="h-8 w-8 shrink-0 rounded-full border border-dashed border-border text-muted-foreground flex items-center justify-center hover:text-foreground"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {criando && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            placeholder="Nome da empresa"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") criar(); if (e.key === "Escape") setCriando(false); }}
            className="h-8 text-xs flex-1"
          />
          <button onClick={criar} aria-label="Salvar empresa" className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Criar
          </button>
          <button onClick={() => { setCriando(false); setNome(""); }} aria-label="Cancelar" className="h-8 px-2 rounded-md border border-border text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {perfis.length > 0 && (
        <button
          onClick={() => setGerindo((g) => !g)}
          className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          {gerindo ? "Fechar" : "Gerenciar empresas"}
        </button>
      )}

      {gerindo && (
        <div className="space-y-1">
          {perfis.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-[11px] rounded-md bg-card border border-border/60 px-2 py-1.5">
              <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
              <Input
                value={p.nome}
                onChange={(e) => setPerfis(perfis.map((x) => x.id === p.id ? { ...x, nome: e.target.value } : x))}
                className="h-7 text-[11px] flex-1 border-0 shadow-none px-1 focus-visible:ring-0"
              />
              <button onClick={() => remover(p.id)} aria-label={`Apagar ${p.nome}`} className="text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {/* Apagar o perfil não apaga lançamento: sem etiqueta reconhecida,
              `perfilDe` devolve pessoal e o dinheiro reaparece no consolidado.
              É o comportamento seguro — o oposto seria sumir com o dado. */}
          <p className="text-[9.5px] text-muted-foreground">
            Apagar uma empresa não apaga os lançamentos dela — eles voltam para o Pessoal.
          </p>
        </div>
      )}
    </div>
  );
};
