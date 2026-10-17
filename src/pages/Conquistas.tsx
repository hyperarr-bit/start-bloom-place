import { TelaConquistas } from "@/components/conquistas/TelaConquistas";
import { ConquistasNova } from "@/components/conquistas/nova/ConquistasNova";
import { conquistas2Ligada } from "@/lib/conquistas2";

// Conquistas refeita em 26/09 (capa do planner + sequência + adesivos) — ver components/conquistas.
// 16/10: a CONQUISTAS 2 (sequência + álbum como herói) atrás da chave `conquistas2` (lib/conquistas2.ts):
// ligada no app das lojas, desligada no site; a metadata do RevenueCat manda sem versão nova.
const Conquistas = () => (conquistas2Ligada() ? <ConquistasNova /> : <TelaConquistas />);

export default Conquistas;
