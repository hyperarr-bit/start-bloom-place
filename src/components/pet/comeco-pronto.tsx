/**
 * COMEÇO PRONTO (29/09) — o módulo nasce útil em 3 perguntas.
 *
 * Antes: tela vazia + formulário de texto livre (espécie digitada, peso,
 * raça). Desde 13/09, 9 em cada 10 pessoas que viram o Pet vazio nunca
 * cadastraram um bicho. Agora: QUEM É (cachorro, gato, outro) → NOME (e foto
 * e sexo, se quiser) → IDADE (data ou fase da vida; porte pro cachorro). Sai
 * daqui com o RG, a rotina do dia da espécie e a carteirinha com o básico da
 * idade — cada item pode ser desmarcado antes de criar.
 */
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import { CampoData } from "@/components/ui/campo-data";
import { localDayKey } from "@/lib/utils";
import { rotinaPadraoDe, type Especie, type FaixaEtaria, type Pet, type Porte, type Sexo } from "@/lib/pet";
import { TIPOS, cuidadosDasSugestoes, sugerirCuidados } from "@/lib/pet-cuidados";
import { trackEvent } from "@/lib/analytics";
import { BotaoPet, Chip, Pata, RotuloCampo, campoClasse } from "./kit";
import { novoPetId, type UsePet } from "./use-pet";

type Passo = 1 | 2 | 3 | 4;

/** Idoso = último quarto da vida (AAHA): cão médio/SRD ~9,5 anos, gato acima de 10 (AAHA/AAFP 2021). */
const FAIXA_TEXTO: Record<"cao" | "gato" | "outro", Record<FaixaEtaria, string>> = {
  cao: { filhote: "até 1 ano", adulto: "1 a 8 anos", idoso: "9 anos ou +" },
  gato: { filhote: "até 1 ano", adulto: "1 a 10 anos", idoso: "11 anos ou +" },
  outro: { filhote: "novinho", adulto: "já crescido", idoso: "mais velho" },
};

const ESPECIES: { id: "cao" | "gato" | "outro"; emoji: string; rotulo: string }[] = [
  { id: "cao", emoji: "🐶", rotulo: "Cachorro" },
  { id: "gato", emoji: "🐱", rotulo: "Gato" },
  { id: "outro", emoji: "🐾", rotulo: "Outro bicho" },
];

export const ComecoPronto = ({
  dados, onCriado, onCancelar, primeiro = false, noPrimeiroPasso,
}: { dados: UsePet; onCriado: (petId: string, nome: string) => void; onCancelar?: () => void; primeiro?: boolean; noPrimeiroPasso?: ReactNode }) => {
  const { salvarPet, salvarTarefas, salvarCuidados } = dados;
  const hoje = localDayKey();
  const [passo, setPasso] = useState<Passo>(1);
  const [especie, setEspecie] = useState<"cao" | "gato" | "outro" | null>(null);
  const [qual, setQual] = useState("");
  const [nome, setNome] = useState("");
  const [sexo, setSexo] = useState<Sexo | undefined>();
  const [foto, setFoto] = useState<string | undefined>();
  const [nascimento, setNascimento] = useState("");
  const [faixa, setFaixa] = useState<FaixaEtaria | undefined>();
  const [porte, setPorte] = useState<Porte | undefined>();
  const [desmarcados, setDesmarcados] = useState<Set<number>>(new Set());

  const species = especie === "cao" ? "Cachorro" : especie === "gato" ? "Gato" : qual.trim() || "Pet";
  const rascunho = { species, birthday: nascimento, faixa: nascimento ? undefined : faixa, porte };
  const sugestoes = useMemo(() => sugerirCuidados(rascunho, hoje), [species, nascimento, faixa, porte, hoje]); // eslint-disable-line react-hooks/exhaustive-deps
  const rotina = rotinaPadraoDe((especie === "outro" ? "outro" : especie ?? "outro") as Especie);

  const idadeOk = !!nascimento || !!faixa;
  const criar = () => {
    const id = novoPetId();
    const pet: Pet = {
      id, name: nome.trim(), species, breed: "", weight: "", birthday: nascimento,
      ...(foto ? { photoUrl: foto } : {}),
      ...(sexo ? { sexo } : {}),
      ...(especie === "cao" && porte ? { porte } : {}),
      ...(!nascimento && faixa ? { faixa } : {}),
      criadoEm: new Date().toISOString(),
    };
    salvarPet(pet);
    // a rotina da espécie vai GRAVADA: o app antigo mostra a mesma lista (e não a de 6 tarefas de sempre)
    salvarTarefas(id, rotina);
    const escolhidas = sugestoes.filter((_, i) => !desmarcados.has(i));
    if (escolhidas.length) salvarCuidados(cuidadosDasSugestoes(id, escolhidas));
    trackEvent("pet_comeco_pronto", { especie: especie ?? "outro", fase: nascimento ? "data" : faixa ?? "?", cuidados: escolhidas.length, foto: !!foto });
    onCriado(id, pet.name);
  };

  // função (não componente): recriar um componente a cada render remontaria o cabeçalho
  const cabeca = (titulo: string, sub?: string) => (
    <div className="flex items-start gap-1 mb-3">
      {(passo > 1 || onCancelar) && (
        <button
          type="button"
          onClick={() => (passo > 1 ? setPasso((p) => (p - 1) as Passo) : onCancelar?.())}
          aria-label={passo > 1 ? "Voltar ao passo anterior" : "Cancelar"}
          className="w-11 h-11 -ml-2.5 -mt-2 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{passo <= 3 ? `Passo ${passo} de 3` : "Pronto pra criar"}</p>
        <h2 className="text-[20px] font-extrabold tracking-tight leading-tight mt-0.5 text-foreground">{titulo}</h2>
        {sub && <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{sub}</p>}
      </div>
    </div>
  );

  return (
    <>
    <section className="rounded-2xl border border-border bg-card overflow-hidden" data-card="COMECO PRONTO" data-testid="comeco-pronto">
      <div className="relative flex items-center gap-1.5 px-3.5 h-8 bg-[hsl(var(--pet-faixa))] text-[hsl(var(--pet-mel-tinta))]">
        <Pata className="w-3.5 h-3.5" />
        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]">Novo RG do pet</span>
        <span className="ml-auto flex gap-1" aria-hidden="true">
          {[1, 2, 3].map((n) => <span key={n} className={`w-5 h-1.5 rounded-full ${passo >= n ? "bg-[hsl(var(--pet-mel-tinta))]" : "bg-[hsl(var(--pet-mel-tinta)/0.25)]"}`} />)}
        </span>
      </div>
      <div className="relative p-4">
        <span className="pet-guilhoche" aria-hidden="true" />
        <div className="relative">
          {passo === 1 && (
            <>
              {cabeca(primeiro ? "Quem é o seu pet?" : "Quem é o novo pet?", primeiro ? "Em 3 toques seu pet ganha RG, a rotina do dia e a carteirinha de vacinas da idade." : undefined)}
              <div className="grid grid-cols-3 gap-2" data-spotlight="pet-especie">
                {ESPECIES.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={especie === e.id}
                    onClick={() => { setEspecie(e.id); if (e.id !== "outro") setPasso(2); }}
                    className={`rounded-xl border min-h-[92px] flex flex-col items-center justify-center gap-1.5 transition-colors ${
                      especie === e.id ? "border-foreground bg-muted" : "border-border bg-card hover:bg-muted/60"
                    }`}
                    data-testid={`especie-${e.id}`}
                  >
                    <span className="text-[34px] leading-none" aria-hidden="true">{e.emoji}</span>
                    <span className="text-[13px] font-bold text-foreground">{e.rotulo}</span>
                  </button>
                ))}
              </div>
              {especie === "outro" && (
                <div className="mt-3 flex gap-2">
                  <input autoFocus value={qual} onChange={(e) => setQual(e.target.value)} placeholder="Qual? Coelho, calopsita, hamster…" className={campoClasse} aria-label="Qual bicho" />
                  <BotaoPet onClick={() => setPasso(2)} disabled={!qual.trim()}>Seguir</BotaoPet>
                </div>
              )}
            </>
          )}

          {passo === 2 && (
            <>
              {cabeca("Qual é o nome?")}
              <input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && nome.trim() && setPasso(3)}
                placeholder={especie === "gato" ? "Ex.: Frida" : especie === "cao" ? "Ex.: Caramelo" : "Nome"}
                className={`${campoClasse} h-12 text-[16px] font-semibold`}
                aria-label="Nome do pet"
                data-testid="pet-nome"
              />
              <div className="mt-3">
                <RotuloCampo>Sexo (opcional)</RotuloCampo>
                <div className="flex gap-1.5">
                  <Chip ativo={sexo === "macho"} onClick={() => setSexo(sexo === "macho" ? undefined : "macho")} className="flex-1">Macho</Chip>
                  <Chip ativo={sexo === "femea"} onClick={() => setSexo(sexo === "femea" ? undefined : "femea")} className="flex-1">Fêmea</Chip>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 min-h-[44px]">
                <PhotoPicker value={foto} onChange={setFoto} onClear={() => setFoto(undefined)} label="Pôr uma foto (opcional)" className="min-h-[44px] text-[13px]" />
              </div>
              <BotaoPet className="mt-4 w-full" onClick={() => setPasso(3)} disabled={!nome.trim()} data-testid="pet-seguir-2">Seguir</BotaoPet>
            </>
          )}

          {passo === 3 && (
            <>
              {cabeca(`Qual a idade de ${nome.trim()}?`, "É o que decide as vacinas e o vermífugo da carteirinha.")}
              <RotuloCampo htmlFor="pet-nascimento">Data de nascimento</RotuloCampo>
              <CampoData id="pet-nascimento" rotulo="Escolher a data" max={hoje} value={nascimento} onChange={(e) => { setNascimento(e.target.value); if (e.target.value) setFaixa(undefined); }} className={campoClasse} />
              <p className="text-[12px] text-muted-foreground my-2">Não sabe? Escolha a fase:</p>
              <div className="flex gap-1.5">
                {(["filhote", "adulto", "idoso"] as FaixaEtaria[]).map((f) => (
                  <Chip key={f} ativo={!nascimento && faixa === f} onClick={() => { setNascimento(""); setFaixa(f); }} className="flex-1 flex-col gap-0 py-1.5 leading-tight" data-testid={`faixa-${f}`}>
                    <span>{f === "filhote" ? "Filhote" : f === "adulto" ? "Adulto" : "Idoso"}</span>
                    <span className="text-[10.5px] font-medium opacity-70">{FAIXA_TEXTO[especie === "gato" ? "gato" : especie === "cao" ? "cao" : "outro"][f]}</span>
                  </Chip>
                ))}
              </div>
              {especie === "cao" && (
                <div className="mt-3">
                  <RotuloCampo>Porte (opcional)</RotuloCampo>
                  <div className="flex gap-1.5">
                    {([["pequeno", "Pequeno", "até 10 kg"], ["medio", "Médio", "10 a 25 kg"], ["grande", "Grande", "25 kg ou +"]] as [Porte, string, string][]).map(([p, r, s]) => (
                      <Chip key={p} ativo={porte === p} onClick={() => setPorte(porte === p ? undefined : p)} className="flex-1 flex-col gap-0 py-1.5 leading-tight">
                        <span>{r}</span><span className="text-[10.5px] font-medium opacity-70">{s}</span>
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              <BotaoPet className="mt-4 w-full" onClick={() => setPasso(4)} disabled={!idadeOk} data-testid="pet-seguir-3">Ver o que vem pronto</BotaoPet>
            </>
          )}

          {passo === 4 && (
            <>
              {cabeca(`O RG de ${nome.trim()} vem com:`)}
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1">Carteirinha</p>
              <ul className="rounded-xl border border-border bg-card overflow-hidden">
                {sugestoes.map((s, i) => {
                  const marcado = !desmarcados.has(i);
                  return (
                    <li key={s.nome} className={i ? "border-t border-border" : ""}>
                      <label className="flex items-start gap-3 px-3 py-2.5 min-h-[56px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => setDesmarcados((d) => { const n = new Set(d); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                          className="mt-0.5 w-5 h-5 shrink-0 rounded-[5px] accent-[hsl(var(--accent))]"
                          aria-label={s.nome}
                        />
                        <span className="min-w-0">
                          <span className="block text-[14px] font-semibold leading-tight text-foreground">
                            {s.nome} <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em]">· {TIPOS[s.tipo].etiqueta.toLowerCase()}</span>
                          </span>
                          <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{s.nota}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mt-3 mb-1">Rotina de todo dia</p>
              <p className="text-[13px] text-foreground leading-relaxed">{rotina.map((t) => `${t.emoji} ${t.label}`).join("  ·  ")}</p>
              <p className="text-[11.5px] text-muted-foreground mt-3 leading-snug">Orientação geral pra espécie e a idade. O calendário certo é o do veterinário — dá pra mudar tudo depois.</p>
              <BotaoPet className="mt-4 w-full" onClick={criar} data-testid="pet-criar">Criar o RG de {nome.trim()}</BotaoPet>
            </>
          )}
        </div>
      </div>
    </section>
    {passo === 1 && noPrimeiroPasso}
    </>
  );
};
