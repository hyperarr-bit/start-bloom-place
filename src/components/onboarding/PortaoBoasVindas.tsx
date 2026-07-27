import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { BoasVindasPago } from "./BoasVindasPago";

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
