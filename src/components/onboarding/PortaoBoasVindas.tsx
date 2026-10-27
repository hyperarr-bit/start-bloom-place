import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { BoasVindasPago, boasVindasPagoJaVista, marcarBoasVindasPagoVista } from "./BoasVindasPago";
import { TelaParabens } from "./TelaParabens";
import { fluxoEnxutoLigado } from "@/lib/fluxo-enxuto";
import { modo1012 } from "@/lib/modo-1012";
import { trackEvent } from "@/lib/analytics";

/**
 * Decide QUEM vê a tela de boas-vindas pós-compra (27/07).
 *
 * Fica no nível do app, não dentro de uma rota, porque a pessoa pode cair em
 * /financas, /rotina ou na área que escolheu no funil — depende do caminho.
 * Prender a celebração a uma rota específica seria voltar ao problema.
 *
 * Três condições, e cada uma tem motivo:
 *  - app da loja: na web o fluxo de compra é outro (Pix, vitalício).
 *  - assinante: obviamente.
 *  - conta com menos de 48h: é o que separa "acabou de comprar" de "cliente
 *    de três meses abrindo o app". Sem isso, todo mundo levaria um "tá
 *    dentro!" do nada, que é pior do que não ter.
 *
 * A chave de "já viu" mora no próprio BoasVindasPago — aqui é só o portão.
 */
export const PortaoBoasVindas = () => {
  const { user, isSubscribed, subLoaded } = useAuth();
  const { get } = useUserData();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  /* 1.0.21 — FLUXO ENXUTO (QA no Simulador 27/10): este portão é montado no App inteiro e, com a missão mandando, o
   * BoasVindasPago "pulado" chamava o onComecar → navigate("/home") NO MESMO SEGUNDO em que a conta nascia — tirando a
   * pessoa do /app antes do pós-compra do cadastro (LiberandoIOS) aparecer. No enxuto: no /app quem cuida é o cadastro
   * (TelaParabens); fora dele (conta que assinou por outro caminho: o gate do app, a Porta), a TelaParabens aparece 1x
   * aqui (a mesma marca de "já viu" do BoasVindasPago), e o "Entrar" vai pra Home. */
  const [enxuto] = useState(() => fluxoEnxutoLigado());
  // relido a cada render: a Parabéns do cadastro grava a marca e logo em seguida a rota sai do /app (QA 27/10: lida só
  // na montagem, a 2ª Parabéns aparecia na Home)
  const [vistoAqui, setVisto] = useState(false);
  const visto = vistoAqui || boasVindasPagoJaVista();
  const contaNovaAqui = !!user?.created_at && Date.now() - new Date(user.created_at).getTime() < 48 * 3600e3;
  const parabensAqui = enxuto && !visto && isNativeShell() && subLoaded && isSubscribed && !!user && contaNovaAqui && !pathname.startsWith("/app");
  useEffect(() => { if (parabensAqui && !modo1012()) trackEvent("parabens_view", { funil: "abertura" }); }, [parabensAqui]);

  if (enxuto) {
    if (!parabensAqui) return null;
    /* 1.0.21 MODO 1.0.12: fora do /app (assinou pelo gate/Porta) a boas-vindas é a da 1.0.12, 1x, e "Começar" → Home */
    if (modo1012()) {
      return (
        <BoasVindasPago
          imediato
          nuncaPula
          nome={get<string>("core-user-name", "") || get<string>("user-name", "")}
          onComecar={() => { marcarBoasVindasPagoVista(); setVisto(true); navigate("/home"); }}
        />
      );
    }
    return (
      <TelaParabens
        nome={get<string>("core-user-name", "") || get<string>("user-name", "")}
        onEntrar={() => { trackEvent("parabens_entrar", { funil: "abertura" }); marcarBoasVindasPagoVista(); setVisto(true); navigate("/home"); }}
      />
    );
  }

  if (!isNativeShell() || !subLoaded || !isSubscribed || !user) return null;

  const contaNova = !!user.created_at && Date.now() - new Date(user.created_at).getTime() < 48 * 3600e3;
  if (!contaNova) return null;

  // "user-name" é a chave que o CADASTRO DO FUNIL grava (ComecarRadar); a
  // "core-user-name" é a do hub. Ler só a segunda deixava justamente quem veio
  // do funil — todo mundo, no app — sem nome na celebração.
  const nome = get<string>("core-user-name", "") || get<string>("user-name", "") || (user.email?.split("@")[0] ?? "");

  return (
    <BoasVindasPago
      nome={nome}
      // Vai pro HUB e não pro módulo: é lá que mora o "Por onde você quer
      // começar?". Assim a estreia é celebração → escolha → tour, em vez de
      // despejar a pessoa dentro de uma planilha zerada.
      onComecar={() => navigate("/home")}
    />
  );
};
