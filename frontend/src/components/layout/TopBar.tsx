import { Search, Bell, Command, Plus, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header className="h-16 shrink-0 border-b border-border bg-card/70 glass sticky top-0 z-30">
      <div className="h-full px-6 flex items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-semibold tracking-tight truncate">{title}</h1>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
              <span className="h-1.5 w-1.5 rounded-full bg-success live-dot" /> LIVE
            </span>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>

        <div className="flex-1 max-w-xl mx-auto hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search tasks, volunteers, locations…"
              className="w-full h-9 pl-9 pr-16 text-sm bg-secondary/60 border border-border rounded-md outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-card border border-border rounded px-1.5 py-0.5">
              <Command className="h-3 w-3" /> K
            </kbd>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => setDark(d => !d)}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0 relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-danger ring-2 ring-card" />
          </Button>
          <Button size="sm" className="h-9 gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Task
          </Button>
        </div>
      </div>
    </header>
  );
}
