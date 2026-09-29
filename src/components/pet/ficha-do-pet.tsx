/**
 * FICHA DO PET (29/09) — editar o RG: foto, nome, espécie, raça, sexo,
 * castrado, nascimento (ou fase da vida), porte, microchip, alergias e o
 * veterinário. Guarda o id (os registros de saúde, gastos e rotina apontam
 * pra ele) e todo campo que já existia no item.
 */
import { useEffect, useState } from "react";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import { localDayKey } from "@/lib/utils";
import { avisarApagado } from "@/lib/desfazer";
import { especieDe, type FaixaEtaria, type Pet, type Porte, type Sexo } from "@/lib/pet";
import { BotaoPet, Chip, FolhaPet, FotoDoPet, RotuloCampo, campoClasse } from "./kit";
import type { UsePet } from "./use-pet";

export const FichaDoPet = ({ pet, dados, aberta, onFechar }: { pet: Pet; dados: UsePet; aberta: boolean; onFechar: () => void }) => {
  const { salvarPet, apagarPet, get, set } = dados;
  const [r, setR] = useState<Pet>(pet);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => { if (aberta) { setR(pet); setConfirmar(false); } }, [aberta, pet.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const muda = (m: Partial<Pet>) => setR((x) => ({ ...x, ...m }));
  const ehCao = especieDe(r.species) === "cao";

  const salvar = () => {
    const nome = r.name.trim();
    if (!nome) return;
    // o diário guarda o NOME do pet (não o id): renomear leva os momentos junto
    if (nome !== pet.name) {
      const diario = get<unknown>("pet-diary", []);
      if (Array.isArray(diario) && diario.some((e) => (e as { petName?: string })?.petName === pet.name)) {
        set("pet-diary", diario.map((e) => ((e as { petName?: string })?.petName === pet.name ? { ...(e as object), petName: nome } : e)));
      }
    }
    salvarPet({
      ...r,
      name: nome,
      species: r.species.trim(),
      breed: r.breed.trim(),
      chip: r.chip?.trim() || undefined,
      alergias: r.alergias?.trim() || undefined,
      vetNome: r.vetNome?.trim() || undefined,
      vetTelefone: r.vetTelefone?.trim() || undefined,
      obs: r.obs?.trim() || undefined,
      faixa: r.birthday ? undefined : r.faixa,
      porte: ehCao ? r.porte : undefined,
    });
    onFechar();
  };

  const apagar = () => {
    const lista = get<unknown>("pet-list", []);
    const antes = Array.isArray(lista) ? [...lista] : [];
    apagarPet(pet.id);
    onFechar();
    // registros de saúde, gastos e diário ficam guardados (apontam pro id): Desfazer traz tudo de volta
    avisarApagado(`${pet.name} saiu do app`, () => set("pet-list", antes));
  };

  return (
    <FolhaPet aberta={aberta} onFechar={onFechar} titulo={`RG de ${pet.name}`} testId="ficha-do-pet">
      <div className="flex items-center gap-3">
        <FotoDoPet pet={{ ...r, photoUrl: r.photoUrl }} className="w-16 h-20 rounded-[10px] shrink-0" emojiClass="text-3xl" />
        <PhotoPicker value={undefined} onChange={(url) => muda({ photoUrl: url })} onClear={() => muda({ photoUrl: undefined })} label={r.photoUrl ? "Trocar a foto" : "Pôr uma foto"} className="min-h-[44px] text-[13px] font-semibold" />
        {r.photoUrl && (
          <button type="button" onClick={() => muda({ photoUrl: undefined })} className="ml-auto min-h-[44px] px-2 text-[12.5px] font-semibold text-muted-foreground hover:text-destructive">Tirar</button>
        )}
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <RotuloCampo htmlFor="rg-nome">Nome</RotuloCampo>
          <input id="rg-nome" value={r.name} onChange={(e) => muda({ name: e.target.value })} className={campoClasse} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <RotuloCampo htmlFor="rg-especie">Espécie</RotuloCampo>
            <input id="rg-especie" list="rg-especies" value={r.species} onChange={(e) => muda({ species: e.target.value })} className={campoClasse} />
            <datalist id="rg-especies">{["Cachorro", "Gato", "Coelho", "Calopsita", "Hamster", "Peixe", "Tartaruga"].map((x) => <option key={x} value={x} />)}</datalist>
          </div>
          <div>
            <RotuloCampo htmlFor="rg-raca">Raça</RotuloCampo>
            <input id="rg-raca" value={r.breed} onChange={(e) => muda({ breed: e.target.value })} placeholder="SRD, Golden…" className={campoClasse} />
          </div>
        </div>
        <div>
          <RotuloCampo>Sexo</RotuloCampo>
          <div className="flex gap-1.5">
            {(["macho", "femea"] as Sexo[]).map((s) => (
              <Chip key={s} ativo={r.sexo === s} onClick={() => muda({ sexo: r.sexo === s ? undefined : s })} className="flex-1">{s === "macho" ? "Macho" : "Fêmea"}</Chip>
            ))}
          </div>
        </div>
        <div>
          <RotuloCampo>{r.sexo === "femea" ? "Castrada" : "Castrado"}</RotuloCampo>
          <div className="flex gap-1.5">
            <Chip ativo={r.castrado === true} onClick={() => muda({ castrado: r.castrado === true ? undefined : true })} className="flex-1">Sim</Chip>
            <Chip ativo={r.castrado === false} onClick={() => muda({ castrado: r.castrado === false ? undefined : false })} className="flex-1">Não</Chip>
          </div>
        </div>
        <div>
          <RotuloCampo htmlFor="rg-nasc">Nascimento</RotuloCampo>
          <input id="rg-nasc" type="date" max={localDayKey()} value={r.birthday} onChange={(e) => muda({ birthday: e.target.value })} className={campoClasse} />
          <label className="mt-1.5 flex items-center gap-2 min-h-[36px] text-[12.5px] text-muted-foreground">
            <input type="checkbox" checked={!!r.nascimentoAprox} onChange={(e) => muda({ nascimentoAprox: e.target.checked || undefined })} className="w-4 h-4 accent-[hsl(var(--accent))]" />
            A data é aproximada (adotado já crescido)
          </label>
          {!r.birthday && (
            <div className="flex gap-1.5 mt-1">
              {(["filhote", "adulto", "idoso"] as FaixaEtaria[]).map((f) => (
                <Chip key={f} ativo={r.faixa === f} onClick={() => muda({ faixa: f })} className="flex-1 min-h-[40px] text-[12.5px]">{f === "filhote" ? "Filhote" : f === "adulto" ? "Adulto" : "Idoso"}</Chip>
              ))}
            </div>
          )}
        </div>
        {ehCao && (
          <div>
            <RotuloCampo>Porte</RotuloCampo>
            <div className="flex gap-1.5">
              {([["pequeno", "Pequeno"], ["medio", "Médio"], ["grande", "Grande"]] as [Porte, string][]).map(([p, rot]) => (
                <Chip key={p} ativo={r.porte === p} onClick={() => muda({ porte: r.porte === p ? undefined : p })} className="flex-1">{rot}</Chip>
              ))}
            </div>
          </div>
        )}
        <div>
          <RotuloCampo htmlFor="rg-chip">Microchip</RotuloCampo>
          <input id="rg-chip" inputMode="numeric" value={r.chip ?? ""} onChange={(e) => muda({ chip: e.target.value })} placeholder="Número de 15 dígitos" className={`${campoClasse} tabular-nums`} />
        </div>
        <div>
          <RotuloCampo htmlFor="rg-alergias">Alergias e cuidados especiais</RotuloCampo>
          <input id="rg-alergias" value={r.alergias ?? ""} onChange={(e) => muda({ alergias: e.target.value })} placeholder="Ex.: frango, dipirona" className={campoClasse} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <RotuloCampo htmlFor="rg-vet">Veterinário</RotuloCampo>
            <input id="rg-vet" value={r.vetNome ?? ""} onChange={(e) => muda({ vetNome: e.target.value })} placeholder="Dra. Paula" className={campoClasse} />
          </div>
          <div>
            <RotuloCampo htmlFor="rg-tel">Telefone</RotuloCampo>
            <input id="rg-tel" type="tel" inputMode="tel" value={r.vetTelefone ?? ""} onChange={(e) => muda({ vetTelefone: e.target.value })} placeholder="(11) 9…" className={campoClasse} />
          </div>
        </div>
        <div>
          <RotuloCampo htmlFor="rg-obs">Observações</RotuloCampo>
          <textarea id="rg-obs" rows={2} value={r.obs ?? ""} onChange={(e) => muda({ obs: e.target.value })} placeholder="Plano de saúde, pet sitter, comportamento…" className={`${campoClasse} h-auto py-2.5 leading-snug`} />
        </div>
      </div>

      <BotaoPet className="mt-4 w-full" onClick={salvar} disabled={!r.name.trim()} data-testid="rg-salvar">Salvar o RG</BotaoPet>
      {!confirmar ? (
        <BotaoPet variante="fantasma" className="mt-2 w-full text-muted-foreground" onClick={() => setConfirmar(true)}>Apagar {pet.name}</BotaoPet>
      ) : (
        <div className="mt-2 rounded-xl border border-destructive/40 p-3">
          <p className="text-[13px] text-foreground">Apagar {pet.name}? A carteirinha, os gastos e o diário ficam guardados, mas somem da tela.</p>
          <div className="mt-2 flex gap-2">
            <BotaoPet variante="perigo" className="flex-1" onClick={apagar}>Apagar</BotaoPet>
            <BotaoPet variante="secundario" className="flex-1" onClick={() => setConfirmar(false)}>Voltar</BotaoPet>
          </div>
        </div>
      )}
    </FolhaPet>
  );
};
