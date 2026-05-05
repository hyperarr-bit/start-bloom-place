import { useNavigate } from "react-router-dom";
import { WelcomeScreen } from "@/components/WelcomeScreen";

const Inicio = () => {
  const navigate = useNavigate();
  return (
    <WelcomeScreen
      onComplete={() => navigate("/auth?signup=1")}
      onLogin={() => navigate("/auth")}
    />
  );
};

export default Inicio;
