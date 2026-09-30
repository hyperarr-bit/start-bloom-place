import { useRef } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { MODELOS_OI, MODELOS_PARABENS, type Pessoa } from "@/lib/relacoes";
import { useNavegacaoRelacoes } from "./contexto";
import { compartilharTexto } from "./compartilhar-texto";
import { FaixaDaFolha } from "./kit";
import { focarNaFolha, FOLHA } from "./kit-estilos";

export type AlvoDaMensagem = { pessoa: Pessoa; tipo: "parabens" | "oi" };

/**
 * Escolher a mensagem antes de mandar (29/09): três modelos prontos, em cartas.
 * Tocar num deles abre a folha do sistema (WhatsApp, na prática) com o texto;
 * quando o sistema confirma o envio, a conversa de hoje fica anotada sozinha
 * — é o "última vez que vocês se falaram" do manter contato, sem esforço.
 */
export function FolhaMensagem({ alvo, onFechar }: { alvo: AlvoDaMensagem | null; onFechar: () => void }) {
  const { rel } = useNavegacaoRelacoes();
  const ultimo = useRef<AlvoDaMensagem | null>(null);
  if (alvo) ultimo.current = alvo;
  const a = alvo ?? ultimo.current;
  const modelos = a?.tipo === "parabens" ? MODELOS_PARABENS : MODELOS_OI;

  const mandar = async (texto: string, id: string) => {
    if (!a) return;
    const r = await compartilharTexto(texto, `${a.tipo}-${id}`);
    if (r === "shared") {
      rel.registrarMensagem(a.pessoa, a.tipo === "parabens" ? "Mandei os parabéns 🎂" : "Mandei um oi 💬");
      toast.success(a.tipo === "parabens" ? "Parabéns enviados" : `Oi mandado pra ${a.pessoa.name}`);
      onFechar();
    } else if (r === "link") {
      onFechar();
    }
  };

  return (
    <Sheet open={!!alvo} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" semFechar className={FOLHA} onOpenAutoFocus={focarNaFolha} data-testid="folha-mensagem">
        <SheetTitle className="sr-only">{a?.tipo === "parabens" ? "Mandar parabéns" : "Mandar um oi"}</SheetTitle>
        <SheetDescription className="sr-only">Escolha uma mensagem pronta. Dá pra editar antes de mandar.</SheetDescription>
        {a && (
          <>
            <FaixaDaFolha
              titulo={a.tipo === "parabens" ? `🎉 Parabéns pra ${a.pessoa.name}` : `💬 Um oi pra ${a.pessoa.name}`}
              sub="Escolha uma — no WhatsApp ainda dá pra mudar o que quiser."
              onFechar={onFechar}
            />
            <div className="overflow-y-auto px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3">
              {modelos.map((m) => {
                const texto = m.texto(a.pessoa.name);
                return (
                  <button key={m.id} type="button" onClick={() => void mandar(texto, m.id)} className="rl-cartao border block w-full p-3.5 text-left" aria-label={`Mandar: ${m.rotulo}`}>
                    <span className="rl-mini block text-[hsl(var(--rl-tinta))]">{m.rotulo}</span>
                    <span className="rl-serif mt-1 block text-[19px] leading-snug">“{texto}”</span>
                    <span className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[hsl(var(--rl-lacre))]">
                      <MessageCircle className="w-3.5 h-3.5" /> Mandar esta
                    </span>
                  </button>
                );
              })}
              <p className="text-center text-[11.5px] text-muted-foreground">A gente não guarda o telefone de ninguém: quem escolhe o contato é você.</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
