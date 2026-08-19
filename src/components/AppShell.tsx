import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  BookOpenCheck,
  ChartNoAxesColumnIncreasing,
  FilePenLine,
  Library,
  LayoutDashboard,
  MessagesSquare,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquarePen,
  type LucideIcon,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { applyDiyTheme, readDiyTheme } from '../theme/diyTheme';
import { applyMotionLevel, readMotionLevel } from '../theme/experienceSettings';
import '../styles/app-shell-glass.css';

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
  { label: '教练', path: '/coach', icon: MessagesSquare },
  { label: '卡片库', path: '/cards', icon: Library },
  { label: '复盘', path: '/review', icon: ChartNoAxesColumnIncreasing },
  { label: '申论', path: '/shenlun', icon: FilePenLine },
  { label: '图谱', path: '/graphs', icon: Network },
  { label: '设置', path: '/settings', icon: Settings },
];

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const toggleLabel = collapsed ? '展开侧栏' : '折叠侧栏';

  useLayoutEffect(() => {
    applyDiyTheme(readDiyTheme());
    applyMotionLevel(readMotionLevel());
  }, []);

  useEffect(() => {
    let frameId: number | null = null;
    let pendingUpdate: { surface: HTMLElement; x: number; y: number } | null = null;

    const updateGlassHighlight = () => {
      frameId = null;
      const update = pendingUpdate;
      pendingUpdate = null;
      if (!update) return;

      const bounds = update.surface.getBoundingClientRect();
      const localX = bounds.width > 0 ? ((update.x - bounds.left) / bounds.width) * 100 : 50;
      const localY = bounds.height > 0 ? ((update.y - bounds.top) / bounds.height) * 100 : 50;
      const clampedX = Math.min(100, Math.max(0, localX));
      const clampedY = Math.min(100, Math.max(0, localY));
      update.surface.style.setProperty('--glass-pointer-x', `${clampedX}%`);
      update.surface.style.setProperty('--glass-pointer-y', `${clampedY}%`);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;

      const surface = event.target.closest<HTMLElement>('.liquid-glass');
      if (!surface) return;

      pendingUpdate = { surface, x: event.clientX, y: event.clientY };
      if (frameId === null) {
        frameId = window.requestAnimationFrame(updateGlassHighlight);
      }
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}`}>
      <aside
        className="app-shell__sidebar liquid-glass liquid-glass--dark"
        id="app-sidebar"
      >
        <Link
          className="app-shell__brand liquid-glass__nested liquid-pressable"
          to="/"
          aria-label="为人民服务 · 公考记忆卡"
        >
          <img
            alt="中华人民共和国国徽"
            className="app-shell__brand-emblem"
            src="/diy/国徽.jpg"
          />
          {collapsed ? null : (
            <span className="app-shell__brand-copy">
              <span className="app-shell__brand-motto">为人民服务</span>
              <span className="app-shell__brand-product">公考记忆卡</span>
            </span>
          )}
        </Link>

        <nav className="app-shell__nav" aria-label="主导航">
          {navigationItems.map(({ icon: Icon, label, path }) => (
            <NavLink
              aria-label={label}
              className={({ isActive }) =>
                `app-shell__nav-link liquid-glass__nested liquid-pressable${
                  isActive ? ' app-shell__nav-link--active' : ''
                }`
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
            className="app-shell__collapse-button liquid-glass__nested liquid-pressable"
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

      <main className="app-shell__main liquid-glass liquid-glass--regular">
        {children}
      </main>
    </div>
  );
}
