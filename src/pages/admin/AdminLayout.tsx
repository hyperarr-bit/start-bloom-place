import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { checkIsAdmin } from "@/lib/admin";
import {
  LayoutDashboard, BarChart3, TrendingUp, TrendingDown,
  Users, Filter, LogOut, Shield, Target, Mail, Sparkles, ShieldCheck, GitCompare
} from "lucide-react";

export const ADMIN_EMAIL = "jv20101958@gmail.com";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/admin/analytics", label: "Analytics", Icon: BarChart3 },
  { to: "/admin/conversao", label: "Conversão", Icon: TrendingUp },
  { to: "/admin/ativacao", label: "Ativação", Icon: Target },
  { to: "/admin/onboarding", label: "Onboarding", Icon: Sparkles },
  { to: "/admin/emails", label: "E-mails", Icon: Mail },
  { to: "/admin/churn", label: "Churn", Icon: TrendingDown },
  { to: "/admin/retention", label: "Retention", Icon: ShieldCheck },
  { to: "/admin/usuarios", label: "Usuários", Icon: Users },
  { to: "/admin/funil", label: "Funil", Icon: Filter },
  { to: "/admin/tutorial-compare", label: "Tutorial A/B", Icon: GitCompare },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/admin", { replace: true }); return; }
    if (user.email !== ADMIN_EMAIL) { setAllowed(false); navigate("/admin", { replace: true }); return; }
    checkIsAdmin(user.id).then(ok => {
      setAllowed(ok);
      if (!ok) navigate("/admin", { replace: true });
    });
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin", { replace: true });
  };

  if (loading || allowed === null) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">Verificando…</div>;
  }
  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      <aside className="md:w-60 md:min-h-screen md:border-r border-zinc-800 bg-zinc-900/50">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-widest uppercase">Admin</span>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 gap-1">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors ${
                  isActive ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors mt-auto md:mt-4"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
