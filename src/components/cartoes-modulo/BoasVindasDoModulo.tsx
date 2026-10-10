import { useLocation } from "react-router-dom";
import { ModuleTip } from "@/components/ModuleTip";
import { cartoesLigados, guardarForcasDaUrl } from "@/lib/tour-home";
import { CartoesDoModulo } from "./CartoesDoModulo";

/**
 * A BOAS-VINDAS DO MÓDULO, UMA PORTA SÓ (1.0.14): com a chave `CARTOES_MODULO`
 * ligada, o módulo abre com os 3 cartões em popup (CartoesDoModulo, carregados pelo
 * registro); desligada, é o ModuleTip "Dicas para começar" de sempre — byte a byte,
 * com as mesmas dicas. Nunca na demo (/preview). Pet, que não tinha dica nenhuma,
 * passa a ter só os cartões (sem `tips`, a reserva é nada).
 */
export const BoasVindasDoModulo = ({ moduleId, tips, icon }: { moduleId: string; tips?: string[]; icon?: string }) => {
  const { pathname } = useLocation();
  guardarForcasDaUrl(); // a força do link (`?cartoes=on`) tem que estar guardada ANTES de perguntar se está ligado
  const comCartoes = !pathname.startsWith("/preview") && cartoesLigados();
  if (comCartoes) return <CartoesDoModulo moduleId={moduleId} />;
  if (!tips?.length) return null;
  return <ModuleTip moduleId={moduleId} tips={tips} icon={icon} />;
};
