import { useState, type ReactNode } from 'react';
import {
  BookOpenCheck,
  BookOpenText,
  ChartNoAxesColumnIncreasing,
  Library,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquarePen,
  type LucideIcon,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

interface AppShellProps {
  children: ReactNode;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const navigationItems: NavigationItem[] = [
  { label: '总览', path: '/', icon: LayoutDashboard },
  { label: '录入', path: '/entry', icon: SquarePen },
  { label: '背诵', path: '/study', icon: BookOpenCheck },
  { label: '卡片库', path: '/cards', icon: Library },
  { label: '复盘', path: '/review', icon: ChartNoAxesColumnIncreasing },
  { label: '设置', path: '/settings', icon: Settings },
];

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const toggleLabel = collapsed ? '展开侧栏' : '折叠侧栏';

  return (
    <div className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}`}>
      <aside className="app-shell__sidebar" id="app-sidebar">
        <Link className="app-shell__brand" to="/" aria-label="公考记忆卡">
          <span className="app-shell__brand-mark" aria-hidden="true">
            <BookOpenText size={19} strokeWidth={1.9} />
          </span>
          {collapsed ? null : <span className="app-shell__brand-text">公考记忆卡</span>}
        </Link>

        <nav className="app-shell__nav" aria-label="主导航">
          {navigationItems.map(({ icon: Icon, label, path }) => (
            <NavLink
              aria-label={label}
              className={({ isActive }) =>
                `app-shell__nav-link${isActive ? ' app-shell__nav-link--active' : ''}`
              }
              end={path === '/'}
              key={path}
              title={collapsed ? label : undefined}
              to={path}
            >
              <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
              {collapsed ? null : <span className="app-shell__nav-label">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="app-shell__sidebar-tools">
          <button
            aria-controls="app-sidebar"
            aria-expanded={!collapsed}
            aria-label={toggleLabel}
            className="app-shell__collapse-button"
            onClick={() => setCollapsed((current) => !current)}
            title={toggleLabel}
            type="button"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" size={19} />
            ) : (
              <PanelLeftClose aria-hidden="true" size={19} />
            )}
          </button>
        </div>
      </aside>

      <main className="app-shell__main">{children}</main>
    </div>
  );
}
