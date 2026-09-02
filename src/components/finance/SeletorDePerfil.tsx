/**
 * Barra de perfis PF/PJ. Nasce invisível: enquanto não existir nenhuma empresa
 * cadastrada, o único elemento é um link discreto — a pessoa que não tem PJ
 * (a maioria esmagadora dos 981 usuários de Finanças) não ganha uma barra de
 * filtro no topo do módulo que ela usa todo dia.
 *
 * A lógica de dados fica em @/lib/finance-perfil; aqui é só a escolha.
 */
import { useState } from "react";
import { Building2, Plus, Trash2, User, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PERFIL_PESSOAL, PERFIL_TODOS, type Perfil } from "@/lib/finance-perfil";

interface Props {
  perfis: Perfil[];
  setPerfis: (p: Perfil[]) => void;
  ativo: string;
  setAtivo: (id: string) => void;
}

const novoId = () => `pj${Date.now().toString(36)}`;

export const SeletorDePerfil = ({ perfis, setPerfis, ativo, setAtivo }: Props) => {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [gerindo, setGerindo] = useState(false);

  const criar = () => {
    const limpo = nome.trim();
    if (!limpo) return;
    const id = novoId();
    setPerfis([...perfis, { id, nome: limpo }]);
    setAtivo(id);
    setNome("");
    setCriando(false);
  };

  const remover = (id: string) => {
    setPerfis(perfis.filter((p) => p.id !== id));
    // Some o perfil ativo? Volta pro pessoal — nunca deixar a tela num filtro
    // que não existe mais, senão a Finanças aparece vazia sem explicação.
    if (ativo === id) setAtivo(PERFIL_PESSOAL);
  };

  if (perfis.length === 0 && !criando) {
    return (
      <button
        onClick={() => setCriando(true)}
        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
      >
        <Building2 className="w-3 h-3" />
        Separar pessoa física e empresa
      </button>
    );
  }

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
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
        {chip(PERFIL_PESSOAL, "Pessoal", <User className="w-3 h-3" />)}
        {perfis.map((p) => chip(p.id, p.nome, <Building2 className="w-3 h-3" />))}
        {perfis.length > 0 && chip(PERFIL_TODOS, "Tudo junto", <span className="text-[10px]">Σ</span>)}
        <button
          onClick={() => setCriando(true)}
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
