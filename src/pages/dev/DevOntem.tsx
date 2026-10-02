import { useSearchParams } from "react-router-dom";
import Home from "@/pages/Home";
import Rotina from "@/pages/Rotina";
import Carreira from "@/pages/Carreira";
import Treino from "@/pages/Treino";
import Beleza from "@/pages/Beleza";
import Conquistas from "@/pages/Conquistas";

/**
 * /dev/ontem — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de
 * `import.meta.env.DEV`; some do build). Mostra a tela de verdade dentro dos
 * provedores REAIS (modo visitante: os dados vêm do localStorage `guest:*`, nada
 * vai pro servidor) — pra fotografar "Ficou de ontem" e "Esqueceu de marcar?"
 * (02/10) com a sequência de verdade se recompondo. Quem monta o cenário é o
 * script de prints, gravando as chaves antes de abrir.
 *   ?tela=home | rotina | carreira | treino | beleza | conquistas   (padrão: home)
 */
const DevOntem = () => {
  const [params] = useSearchParams();
  switch (params.get("tela")) {
    case "rotina": return <Rotina />;
    case "carreira": return <Carreira />;
    case "treino": return <Treino />;
    case "beleza": return <Beleza />;
    case "conquistas": return <Conquistas />;
    default: return <Home />;
  }
};

export default DevOntem;
