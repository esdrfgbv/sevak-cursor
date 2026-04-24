import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ListChecks, Users, Map as MapIcon, BarChart3, Radio, ShieldAlert, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { to: "/", label: "Command Center", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/volunteers", label: "Volunteers", icon: Users },
  { to: "/map", label: "Live Map", icon: MapIcon },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary-glow to-primary flex items-center justify-center shadow-lifted">
          <ShieldAlert className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white tracking-tight">SEVAK</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/60">Smart Allocation</div>
        </div>
      </div>

      <div className="px-3 py-4">
        <div className="px-2 mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/50">Operations</div>
        <nav className="space-y-0.5">
          {items.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-white shadow-elegant"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white"
                )}
              >
                <item.icon className={cn("h-4 w-4", active ? "text-primary-glow" : "text-sidebar-foreground/60 group-hover:text-white")} />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="px-2 mt-6 mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/50">System</div>
        <div className="px-2.5 py-3 rounded-md bg-sidebar-accent/50 border border-sidebar-border">
          <div className="flex items-center gap-2 text-xs">
            <Radio className="h-3.5 w-3.5 text-success animate-pulse" />
            <span className="text-white font-medium">All systems operational</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-sidebar-foreground/60">
            <span>Mock: SQLite</span>
            <span className="font-mono">v2.0</span>
          </div>
        </div>
      </div>

      <div className="mt-auto p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-glow to-primary flex items-center justify-center text-xs font-semibold text-white">
            {user?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??"}
          </div>
          <div className="leading-tight flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{user?.name || "Unknown"}</div>
            <div className="text-[10px] text-sidebar-foreground/60 capitalize">{user?.role || "guest"}</div>
          </div>
          <button onClick={handleLogout} className="text-sidebar-foreground/60 hover:text-white transition-colors" title="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
