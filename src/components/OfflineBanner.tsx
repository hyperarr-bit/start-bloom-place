import { useContext } from "react";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { UserDataContext } from "@/hooks/use-user-data";

/*
 * 16/10 — CONTA SEM CHEGAR DO SERVIDOR. Abrir o app sem rede (ou com a leitura demorando)
 * deixava a Home e os módulos VAZIOS, com cara de dado apagado — e a escrita feita ali
 * apagava de verdade quando a rede voltava. Agora o use-user-data segura as escritas até a
 * conta chegar, e esta faixa explica o que está acontecendo, sem travar nada: some sozinha
 * quando a conta chega (a leitura tenta de novo quando a rede volta).
 *
 * A faixa fica ABAIXO da área segura do topo (o guarda do notch cobre o top-0) e acima da
 * tela em branco da Home enquanto carrega (z-[100]).
 *
 * 17/10 (revisão): "Sem conexão" só quando o aparelho está MESMO sem rede; com rede e o
 * servidor falhando (5xx, relógio torto fazendo o token parecer vencido) a faixa diz que está
 * tentando de novo.
 *
 * Revisão 2 (17/10): leitura no ar dentro do prazo ("lenta") NÃO tem botão — nada corta o que
 * está chegando (conta pesada em rede fraca leva minutos), e um botão que não faz nada só
 * confunde. O "Tentar de novo" aparece quando ele faz algo: a última leitura falhou ("sem") ou a
 * do ar passou do prazo e segue carregando ("demorando" — o botão troca por uma nova).
 */
export const OfflineBanner = () => {
  const { isOnline, pendingCount } = useOfflineQueue();
  const dados = useContext(UserDataContext);
  const conta = dados?.semConexao ?? null;
  const tentarDeNovo = conta === "lenta" ? undefined : dados?.tentarDeNovo;

  return (
    <AnimatePresence>
      {conta ? (
        <motion.div
          key="conta-sem-conexao"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          style={{ top: "var(--app-safe-top, 0px)" }}
          className="fixed left-0 right-0 z-[101] bg-warning text-warning-foreground py-2 px-4 flex items-center justify-center gap-2 text-xs font-medium"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            {/* 17/10 (teste no Android 132): com o aparelho SEM rede a 1ª leitura às vezes fica no ar em vez
                de falhar — dizer "lenta" ali confunde; sem rede é "Sem conexão" em qualquer estado */}
            {!isOnline
              ? "Sem conexão — seus dados aparecem quando a internet voltar."
              : conta !== "sem"
                ? "Conexão lenta — ainda carregando…"
                : "Não conseguimos carregar seus dados agora — tentando de novo…"}
          </span>
          {tentarDeNovo && (
            <button
              type="button"
              onClick={() => tentarDeNovo()}
              className="ml-1 shrink-0 underline underline-offset-2 font-semibold min-h-[32px] px-1"
            >
              Tentar de novo
            </button>
          )}
        </motion.div>
      ) : !isOnline ? (
        <motion.div
          key="modo-offline"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          style={{ top: "var(--app-safe-top, 0px)" }}
          className="fixed left-0 right-0 z-[101] bg-warning text-warning-foreground py-2 px-4 flex items-center justify-center gap-2 text-xs font-medium"
        >
          <WifiOff className="w-3.5 h-3.5" />
          Modo offline {pendingCount > 0 && `— ${pendingCount} alteração(ões) pendente(s)`}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
