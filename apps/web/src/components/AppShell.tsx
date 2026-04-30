import { SignOutButton, useUser } from '@clerk/clerk-react';
import { History, LayoutDashboard, LogOut, Menu, Plus, Sparkles, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Layout shell pour toutes les pages authentifiées.
// Sidebar fixe sur desktop, drawer collapsible sur mobile.
interface AppShellProps {
  children: ReactNode;
  // Callback pour déclencher le dialog "nouvelle analyse" depuis n'importe quelle page.
  onNewAnalysis?: () => void;
}

export function AppShell({ children, onNewAnalysis }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop - sticky pour rester fixée pendant le scroll du main */}
      <aside className="hidden md:flex w-60 flex-col border-r border-[var(--color-border)] bg-card sticky top-0 h-screen shrink-0">
        <SidebarContent onNewAnalysis={onNewAnalysis} />
      </aside>

      {/* Sidebar mobile (drawer) */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-[var(--color-border)] bg-card animate-in slide-in-from-left duration-200">
            <SidebarContent
              onNewAnalysis={() => {
                setMobileOpen(false);
                onNewAnalysis?.();
              }}
              onNavigate={() => setMobileOpen(false)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile (hamburger) */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-[var(--color-border)] bg-card">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" />
            Konsole
          </div>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

interface SidebarContentProps {
  onNewAnalysis?: () => void;
  onNavigate?: () => void;
}

function SidebarContent({ onNewAnalysis, onNavigate }: SidebarContentProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 h-16 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">Konsole</span>
          <span className="text-[10px] font-mono text-muted-foreground border border-[var(--color-border)] rounded px-1 ml-1">
            MVP
          </span>
        </div>
        <ThemeToggle />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem to="/" icon={<LayoutDashboard className="h-4 w-4" />} onClick={onNavigate}>
          Dashboard
        </NavItem>
        <NavItem to="/history" icon={<History className="h-4 w-4" />} onClick={onNavigate}>
          Historique
        </NavItem>
      </nav>

      <div className="px-3 pb-3">
        <Button onClick={onNewAnalysis} className="w-full" size="default">
          <Plus className="h-4 w-4" />
          Nouvelle analyse
        </Button>
      </div>

      <UserMenu />
    </>
  );
}

interface NavItemProps {
  to: string;
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}

function NavItem({ to, icon, children, onClick }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-secondary text-secondary-foreground'
          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </NavLink>
  );
}

function UserMenu() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const initial = email.charAt(0).toUpperCase() || 'U';

  return (
    <div className="border-t border-[var(--color-border)] p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-secondary/50 transition-colors">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
              {initial}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-xs font-medium truncate">{email}</div>
              <div className="text-[10px] text-muted-foreground">Compte</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-52">
          <DropdownMenuLabel>{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <SignOutButton>
            <DropdownMenuItem className="cursor-pointer">
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </DropdownMenuItem>
          </SignOutButton>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
