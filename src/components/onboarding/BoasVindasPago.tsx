import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { AREAS, getFunnelArea } from "@/lib/funnel";

/** Marca de DISPOSITIVO — de propósito fora do useUserData.
 *
 *  A versão anterior gravava com `set()`, que salva no localStorage na hora
 *  mas manda pro servidor com atraso. Como logo depois vinha um
 *  `location.href`, o envio morria no meio: no recarregamento o servidor
 *  respondia "nunca viu" e sobrescrevia o local. Resultado — a tela aparecia
 *  DE NOVO depois de tocar em Começar (bug do dono, 29/07).
 *
 *  Chave de dispositivo resolve sem depender de rede. Ela começa com "core-",
 *  então PRECISA estar nas duas listas de exceção das varreduras de cache
 *  (use-user-data e use-auth) — senão some no primeiro logout.
 */
const CHAVE_DISPOSITIVO = "core-boas-vindas-visto";

/** A cor da marca. Cravada porque esta tela não herda as variáveis claras do
 *  paywall e o `primary` do tema é grafite. */
const MAGENTA = "hsl(330 65% 50%)";

const jaViu = () => {
  try { return localStorage.getItem(CHAVE_DISPOSITIVO) === "1"; } catch { return false; }
};
const marcarVisto = () => {
  try { localStorage.setItem(CHAVE_DISPOSITIVO, "1"); } catch { /* noop */ }
};

/** Confete: 22 pedaços, uma vez só, e acabou. Nada de laço infinito — o que
 *  fica animando pra sempre é o que faz aparelho simples errar o repaint. */
const CORES = ["#C42A73", "#F2B705", "#3BA55C", "#4C6FFF", "#F2711C", "#8B5CF6"];
const CONFETE = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: (i / 22) * 100 + (i % 3) * 4 - 6,
  atraso: (i % 7) * 0.06,
  giro: i % 2 ? 220 : -260,
  cor: CORES[i % CORES.length],
  largura: i % 3 === 0 ? 10 : 6,
  altura: i % 4 === 0 ? 6 : 12,
}));

/**
 * A TELA DOS 10 SEGUNDOS DEPOIS DE ASSINAR (27/07, refeita em 29/07).
 *
 * O que ela conserta, no relato original do dono: "quando eu assinei foi pro
 * meu financeiro de novo sem nenhuma apresentação decente, só tacou lá". É o
 * pior momento pra deixar alguém sozinho — acabou de pagar, está no pico de
 * expectativa, e o app responde com uma planilha zerada.
 *
 * REFEITA porque a primeira versão levou três críticas do dono, todas certas:
 *
 *  1. "aparece 2 vezes" — bug de persistência, explicado em CHAVE_DISPOSITIVO.
 *
 *  2. "por que você fez ele preto, tem que ser algo animado" — fundo quase
 *     preto num momento de comemoração é contrassenso; parecia tela de erro.
 *     Agora é claro, com confete e o selo se desenhando.
 *
 *  3. "a copy tá parecendo muito IA" — e estava: "Tá dentro. Bora organizar."
 *     seguido de três marcadores com emoji é a assinatura de texto gerado.
 *     Sumiu a lista. Ficou uma frase que usa a ÁREA QUE A PESSOA ESCOLHEU no
 *     funil — a mesma régua que ele já tinha imposto pro resto: se a tela não
 *     mostra nada computado das respostas dela, não está pronta.
 */
export const BoasVindasPago = ({ nome, onComecar, imediato }: {
  nome?: string;
  onComecar: () => void;
  /** Compra recém-confirmada: mostra na hora, sem consultar nada. */
  imediato?: boolean;
}) => {
  const { loaded } = useUserData();
  const [visivel, setVisivel] = useState(!!imediato);

  useEffect(() => {
    if (imediato) { trackEvent("boas_vindas_pago_visto", { origem: "compra" }); return; }
    if (!loaded || jaViu()) return;
    setVisivel(true);
    trackEvent("boas_vindas_pago_visto", { origem: "abertura" });
  }, [loaded, imediato]);

  const area = useMemo(() => {
    const a = getFunnelArea();
    return a ? AREAS[a] : null;
  }, []);

  const seguir = () => {
    marcarVisto();
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
          className="fixed inset-0 z-[300] overflow-hidden flex flex-col justify-center px-7
                     pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+var(--app-safe-bottom,0px))]"
          style={{ background: "linear-gradient(180deg,#FFFFFF 0%,#FFF7FB 58%,#FDEEF5 100%)" }}
        >
          {/* confete caindo atrás do conteúdo */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            {CONFETE.map((c) => (
              <motion.span
                key={c.id}
                className="absolute rounded-[2px]"
                style={{ left: `${c.x}%`, top: -24, width: c.largura, height: c.altura, background: c.cor }}
                initial={{ y: -40, opacity: 0, rotate: 0 }}
                animate={{ y: "108vh", opacity: [0, 1, 1, 0], rotate: c.giro }}
                transition={{ duration: 2.6 + (c.id % 5) * 0.35, delay: c.atraso, ease: "easeIn" }}
              />
            ))}
          </div>

          {/* selo: o anel cresce e o certo se desenha dentro */}
          <div className="relative mx-auto mb-9">
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: "hsl(330 65% 50% / 0.18)" }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.9, 1.6], opacity: [0, 0.9, 0] }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            />
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 210, damping: 14 }}
              // MAGENTA cravado, não bg-primary: no tema do app o primary é
              // grafite, e o selo saía PRETO — exatamente a crítica do dono
              // ("por que você fez ele preto"). Comemoração pede cor.
              style={{ background: MAGENTA, boxShadow: "0 16px 44px -14px hsl(330 65% 50% / 0.6)" }}
              className="relative grid place-items-center w-[86px] h-[86px] rounded-full text-white"
            >
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.34, type: "spring", stiffness: 320, damping: 15 }}
              >
                <Check className="w-11 h-11" strokeWidth={3} />
              </motion.span>
            </motion.div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.45 }}
            className="relative text-center text-[36px] font-black leading-[1.05] tracking-tight text-foreground"
          >
            {primeiroNome ? `Pronto, ${primeiroNome}.` : "Pronto."}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.46, duration: 0.45 }}
            className="relative mt-4 text-center text-[17px] leading-relaxed text-muted-foreground max-w-[300px] mx-auto"
          >
            {area
              ? <>O CORE inteiro é seu. Vamos começar por <strong className="text-foreground font-semibold">{area.nome}</strong>, como você pediu.</>
              : <>O CORE inteiro é seu. Vamos começar pelo que mais pesa hoje.</>}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="relative mt-11 max-w-[330px] w-full mx-auto"
          >
            <Button
              onClick={seguir}
              size="lg"
              style={{ background: MAGENTA }}
              className="w-full h-14 text-base font-bold rounded-2xl text-white hover:opacity-90"
            >
              Começar
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
