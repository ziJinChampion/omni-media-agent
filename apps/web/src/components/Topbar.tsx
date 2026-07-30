import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealth, useJobs, useMockMode } from '@/lib/hooks';
import StatusBadge from './StatusBadge';

const TITLES: Record<string, { title: string; crumb: string }> = {
  '/dashboard': { title: '运营概览', crumb: 'Dashboard' },
  '/accounts': { title: '账号矩阵', crumb: 'Accounts' },
  '/jobs': { title: '内容工单', crumb: 'Jobs' },
  '/review': { title: '审核队列', crumb: 'Review' },
};

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** 10s countdown ring synced with the polling cadence */
function RefreshRing() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setP((Date.now() % 10_000) / 10_000), 200);
    return () => clearInterval(t);
  }, []);
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex h-6 w-6 items-center justify-center" title="距下次自动刷新">
      <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <circle
          cx="12" cy="12" r={r} fill="none"
          stroke="#22D3EE" strokeWidth="2" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
        />
      </svg>
      <span className="absolute font-mono text-[8px] text-text-muted tabular-nums">
        {Math.max(1, Math.ceil(10 - p * 10))}
      </span>
    </div>
  );
}

/** Global search over job_id / topic / account (local filter; ⌘K to focus). */
function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data: jobs } = useJobs({ limit: 60 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !jobs) return [];
    return jobs
      .filter(
        (j) =>
          j.job_id.toLowerCase().includes(s) ||
          j.topic.toLowerCase().includes(s) ||
          j.account_name.toLowerCase().includes(s),
      )
      .slice(0, 8);
  }, [q, jobs]);

  return (
    <div className="relative w-full max-w-[380px]">
      <div className="flex items-center gap-2 rounded-[10px] border border-border-subtle bg-glass px-3 py-[7px] transition-colors focus-within:border-accent-violet/50">
        <Search size={14} className="shrink-0 text-text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="搜索 job_id / topic / 账号…"
          className="w-full bg-transparent text-[12.5px] text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <kbd>⌘K</kbd>
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-[12px] border border-border-subtle bg-elevated shadow-2xl">
          {results.map((j) => (
            <button
              key={j.job_id}
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                setQ('');
                navigate(`/jobs?status=${j.status}&q=${encodeURIComponent(j.job_id)}`);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-glass"
            >
              <StatusBadge status={j.status} size="sm" />
              <span className="flex-1 truncate text-[12px] text-text-primary">{j.topic}</span>
              <span className="font-mono text-[10.5px] text-text-muted">{j.job_id.slice(0, 7)}…</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 64px sticky topbar: title / search / refresh ring / MOCK badge / health light / clock. */
export default function Topbar() {
  const { pathname } = useLocation();
  const meta = TITLES[pathname] ?? TITLES['/dashboard'];
  const isMock = useMockMode();
  const health = useHealth();
  const now = useClock();
  const healthy = health.isSuccess;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border-subtle bg-void/60 px-6 backdrop-blur-xl supports-[backdrop-filter]:bg-void/60">
      {/* title + breadcrumb */}
      <div className="flex shrink-0 items-baseline gap-2">
        <h1 className="font-grotesk text-[15px] font-semibold text-text-primary">{meta.title}</h1>
        <span className="text-[11px] text-text-muted">/ {meta.crumb}</span>
      </div>

      {/* search */}
      <div className="flex flex-1 justify-center">
        <GlobalSearch />
      </div>

      {/* right cluster */}
      <div className="flex shrink-0 items-center gap-3.5">
        <RefreshRing />
        {isMock && (
          <span className="rounded-full border border-status-awaiting/40 bg-status-awaiting/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-status-awaiting">
            MOCK
          </span>
        )}
        <span className="flex items-center gap-1.5" title={healthy ? 'GET /health OK' : 'API 不可达'}>
          <span className="relative flex h-2 w-2">
            <span
              className={cn('absolute inset-0 rounded-full animate-dot-pulse', healthy ? 'bg-status-published' : 'bg-status-failed')}
              style={{ opacity: 0.45 }}
            />
            <span className={cn('h-2 w-2 rounded-full', healthy ? 'bg-status-published' : 'bg-status-failed')} />
          </span>
          <span className="hidden text-[11px] text-text-muted xl:inline">API</span>
        </span>
        <span className="font-mono text-[12px] text-text-secondary tabular-nums">
          {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
        </span>
      </div>
    </header>
  );
}
