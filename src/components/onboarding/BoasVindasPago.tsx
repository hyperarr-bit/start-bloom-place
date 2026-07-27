import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";

const CHAVE = "boas-vindas-pago-visto";

/**
 * A tela dos 10 segundos depois de assinar (27/07).
 *
 * O QUE ELA CONSERTA. Relato do dono: "quando eu assinei foi pro meu
 * financeiro de novo sem nenhuma apresentação decente, tipo o BitePal, só
 * tacou lá". É o pior momento possível pra deixar alguém sozinho: acabou de
 * pagar, está no pico de expectativa, e o app responde com uma planilha de
 * saldo zero.
 *
 * O QUE O BITEPAL FAZ (do vídeo que o dono mandou): entre o pagamento e o
 * produto existe uma respiração — confirma a escolha, dá um nome ao que vem,
 * e só então entrega a primeira ação. Nunca despeja a tela crua.
 *
 * AS DECISÕES AQUI:
 *  - Aparece UMA vez e some pra sempre (chave própria). Não é banner.
 *  - Não pede nada. Um botão só, que leva pro passo seguinte. Pedir dado ou
 *    escolha aqui é cobrar de novo de quem acabou de pagar.
 *  - O texto NÃO promete resultado ("você vai economizar X"). Promete o
 *    próximo passo, que é o que dá pra cumprir em 30 segundos.
 *  - Os três itens são o que ela ACABOU de comprar, escritos como posse
 *    ("seus 16 módulos"), não como funcionalidade.
 *
 * ONDE ELA APARECE (27/07 — correção do dono). Antes era só um overlay no
 * nível do app, e ele pegou o defeito no aparelho: "ainda NASCE dentro do
 * financas, você vê o financeiro por segundos e aí aparece a tela do 'tá
 * dentro'. E é estranho porque a home é hub, o app não nasce no financas".
 * Estava certo: a celebração morava no DESTINO, então o destino pintava
 * primeiro. Agora ela mora no MOMENTO DA COMPRA — sobe dentro da própria
 * folha de pagamento, antes de qualquer navegação (`imediato`), e a
 * navegação só acontece quando a pessoa toca em Começar. O overlay no nível
 * do app fica como rede de segurança (compra reconciliada depois, restore).
 */
export const BoasVindasPago = ({ nome, onComecar, imediato }: {
  nome?: string;
  onComecar: () => void;
  /** Compra recém-confirmada: mostra na hora, sem esperar carregar os dados
   *  nem consultar a chave de "já viu" (é impossível já ter visto). */
  imediato?: boolean;
}) => {
  const { get, set, loaded } = useUserData();
  const [visivel, setVisivel] = useState(!!imediato);

  useEffect(() => {
    if (imediato) { trackEvent("boas_vindas_pago_visto", { origem: "compra" }); return; }
    if (!loaded) return;
    if (get<string>(CHAVE, "") === "true") return;
    setVisivel(true);
    trackEvent("boas_vindas_pago_visto", { origem: "abertura" });
  }, [loaded, get, imediato]);

  const seguir = () => {
    set(CHAVE, "true");
    trackEvent("boas_vindas_pago_seguiu", {});
    setVisivel(false);
    onComecar();
  };

  const primeiroNome = (nome ?? "").trim().split(" ")[0];

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex flex-col justify-center px-6
                     pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,var(--app-safe-bottom))]"
          style={{ background: "linear-gradient(170deg, #0c0a09 0%, #1c1917 55%, #0c0a09 100%)" }}
        >
          {/* selo: a confirmação que ninguém dava */}
          <motion.div
            initial={{ scale: 0, rotate: -18 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 13 }}
            className="mx-auto grid place-items-center w-20 h-20 rounded-full bg-primary text-primary-foreground
                       shadow-[0_18px_50px_-12px_hsl(var(--primary)/0.7)]"
          >
            <Check className="w-10 h-10" strokeWidth={3} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
            className="mt-8 text-center text-[34px] font-black leading-[1.08] tracking-tight text-white"
          >
            {primeiroNome ? `Tá dentro, ${primeiroNome}.` : "Tá dentro."}
            <br />
            <span className="text-primary">Bora organizar.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-3 text-center text-[15px] leading-relaxed text-white/60 max-w-[300px] mx-auto"
          >
            Agora é seu. Vou te mostrar o primeiro passo — leva menos de um minuto.
          </motion.p>

          <div className="mt-9 space-y-2.5 max-w-[330px] w-full mx-auto">
            {[
              { emoji: "🧩", txt: "Seus 16 módulos, liberados" },
              { emoji: "☁️", txt: "Tudo salvo na sua conta, em qualquer aparelho" },
              { emoji: "🔔", txt: "Avisos de conta a vencer, se você quiser" },
            ].map((item, i) => (
              <motion.div
                key={item.txt}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65 + i * 0.12, duration: 0.4 }}
                className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3"
              >
                <span className="text-xl shrink-0">{item.emoji}</span>
                <span className="text-[14px] font-medium text-white/90">{item.txt}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05, duration: 0.4 }}
            className="mt-10 max-w-[330px] w-full mx-auto"
          >
            <Button onClick={seguir} size="lg" className="w-full h-14 text-base font-bold rounded-2xl">
              Começar
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
