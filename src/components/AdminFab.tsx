import { useNavigate, useLocation } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin } from "@/lib/admin";

export const AdminFab = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading || !user || !isAdmin(user.id, user.email)) return null;
  if (location.pathname === "/admin/analytics") return null;

  return (
    <motion.button
      onClick={() => navigate("/admin/analytics")}
      className="fixed bottom-20 right-4 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.9 }}
      aria-label="Admin Analytics"
    >
      <BarChart3 className="w-5 h-5" />
    </motion.button>
  );
};
