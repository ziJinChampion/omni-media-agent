import { useState } from 'react';
import { NavLink } from 'react-router';
import { motion } from 'framer-motion';
import {
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJobs, useMockMode } from '@/lib/hooks';

const NAV = [
  { to: '/dashboard', label: 'Dashboard 概览', icon: LayoutDashboard, end: false },
  { to: '/accounts', label: 'Accounts 账号矩阵', icon: Users, end: false },
  { to: '/jobs', label: 'Jobs 内容工单', icon: ListChecks, end: false },
  { to: '/review', label: 'Review 审核队列', icon: ClipboardCheck, end: false },
];

/** 240px collapsible sidebar (72px collapsed) with live review badge + API status card. */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const isMock = useMockMode();
  const { data: awaiting } = useJobs({ status: 'awaiting_human' });
  const reviewCount = awaiting?.length ?? 0;

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-[100dvh] shrink-0 flex-col border-r border-border-subtle bg-panel',
        'transition-[width] duration-250 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]',
        collapsed ? 'w-[72px]' : 'w-60',
      )}
      style={{ transitionDuration: '250ms' }}
    >
      {/* logo + wordmark */}
      <div className={cn('flex items-center gap-2.5 px-4 pt-5 pb-4', collapsed && 'justify-center px-0')}>
        <img src="/assets/logo.svg" alt="omni-media-agent" width={34} height={34} className="shrink-0" draggable={false} />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate font-grotesk text-[14px] font-bold text-text-primary">omni-media-agent</div>
            <div className="mt-0.5 text-[10px] text-text-muted">内容运营矩阵 · 管理台</div>
          </div>
        )}
      </div>

      {/* nav */}
      <nav className="mt-2 flex flex-1 flex-col gap-1 px-2.5">
        {NAV.map(({ to, label, icon: Icon }) => {
          const isReview = to === '/review';
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] transition-colors duration-150',
                  isActive
                    ? 'bg-glass text-text-primary'
                    : 'text-text-secondary hover:bg-glass hover:text-text-primary',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-bar"
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                      style={{ background: 'linear-gradient(180deg,#7C5CFF,#22D3EE)' }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <Icon
                    size={17}
                    className={cn('shrink-0 transition-colors', isActive ? 'text-accent-violet' : 'text-text-muted group-hover:text-text-secondary')}
                  />
                  {!collapsed && <span className="flex-1 truncate transition-opacity duration-200">{label}</span>}
                  {isReview && reviewCount > 0 && (
                    <span
                      className={cn(
                        'flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-status-awaiting px-1 font-mono text-[10px] font-semibold text-[#1a1206] tabular-nums',
                        'animate-dot-pulse',
                        collapsed && 'absolute right-1.5 top-1',
                      )}
                    >
                      {reviewCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* bottom: API status + collapse */}
      <div className="flex flex-col gap-2 border-t border-border-subtle p-2.5">
        {!collapsed && (
          <div className="flex items-center gap-2.5 rounded-[10px] border border-border-subtle bg-glass px-3 py-2.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className={cn(
                  'absolute inset-0 rounded-full animate-dot-pulse',
                  isMock ? 'bg-text-muted' : 'bg-status-published',
                )}
                style={{ opacity: 0.5 }}
              />
              <span className={cn('h-2 w-2 rounded-full', isMock ? 'bg-text-muted' : 'bg-status-published')} />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-[11.5px] font-medium text-text-primary">{isMock ? 'Mock 数据模式' : 'API 已连接'}</div>
              <div className="text-[10px] text-text-muted">{isMock ? '使用内置演示数据' : '与后端实时同步'}</div>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-[10px] px-3 py-2 text-[12px] text-text-muted transition-colors hover:bg-glass hover:text-text-secondary',
            collapsed && 'justify-center px-0',
          )}
          title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && '折叠'}
        </button>
      </div>
    </aside>
  );
}
