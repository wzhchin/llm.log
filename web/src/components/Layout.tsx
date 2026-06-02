import { NavLink, Outlet } from 'react-router-dom';
import { ProxyControl } from './ProxyControl';
import { DateRangePicker } from './DateRangePicker';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/requests', label: 'Requests' },
  { to: '/analytics', label: 'Analytics' },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-[var(--bg-root)] text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3 focus:bg-secondary focus:text-foreground"
      >
        Skip to content
      </a>

      {/* viewer.html topbar */}
      <header className="topbar">
        <div className="topbar-row">
          <div className="topbar-logo flex-1">
            llm<span>.</span>log
          </div>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors font-mono',
                    isActive
                      ? 'text-[var(--c-amber)] border-b border-[var(--c-amber)]'
                      : 'text-[var(--text-1)] hover:text-[var(--text-0)] border-b border-transparent',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1 flex items-center justify-end gap-3">
            <DateRangePicker />
            <ProxyControl />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto p-4 max-w-[1080px]"
      >
        <Outlet />
      </main>
    </div>
  );
}
