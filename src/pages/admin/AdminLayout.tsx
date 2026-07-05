import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { checkIsAdmin } from "@/lib/admin";
import { Filter, Users, LogOut, ShieldCheck, Loader2, UserCircle, CreditCard } from "lucide-react";

export const ADMIN_EMAIL = "jv20101958@gmail.com";

const navItems = [
  { to: "/admin/funil", label: "Funil", Icon: Filter },
  { to: "/admin/usuarios", label: "Usuários", Icon: UserCircle },
  { to: "/admin/assinantes", label: "Assinantes", Icon: Users },
  { to: "/admin/pagantes", label: "Pagantes", Icon: CreditCard },
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
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 md:min-h-screen md:border-r border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground grid place-items-center text-[13px] font-extrabold tracking-tight">
            C
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-bold tracking-tight">CORE</div>
            <div className="text-[10px] text-muted-foreground">Admin</div>
          </div>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 gap-1">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
                  isActive ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground/70 hover:text-destructive hover:bg-destructive/5 transition-colors mt-auto md:mt-4"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </nav>
        <div className="hidden md:flex items-center gap-1.5 px-4 py-3 mt-auto text-[10px] text-muted-foreground/60">
          <ShieldCheck className="w-3 h-3" /> Área restrita
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
