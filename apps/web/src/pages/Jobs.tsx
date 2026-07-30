import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { KanbanSquare, RefreshCw, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countByStatus, useAccounts, useJobs } from '@/lib/hooks';
import {
  ALL_STATUSES,
  IN_PROGRESS_STATUSES,
  type JobStatus,
  type Platform,
} from '@/lib/types';
import ErrorBanner from '@/components/ErrorBanner';
import JobDrawer from '@/components/JobDrawer';
import FilterBar from '@/components/jobs/FilterBar';
import JobsTable from '@/components/jobs/JobsTable';
import JobsBoard from '@/components/jobs/JobsBoard';

const JOBS_PAGE_SIZE = 20;

type View = 'table' | 'board';

function parseStatuses(raw: string | null): JobStatus[] {
  if (!raw) return [];
  return raw
    .split(',')
    .filter((s): s is JobStatus => (ALL_STATUSES as string[]).includes(s));
}

/* ------------------------------------------------------------------ */
/* S1: segmented view toggle (layout pill slides 200ms)                */
/* ------------------------------------------------------------------ */

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const options: { key: View; label: string; icon: React.ReactNode }[] = [
    { key: 'table', label: '表格', icon: <Rows3 size={13} /> },
    { key: 'board', label: '看板', icon: <KanbanSquare size={13} /> },
  ];
  return (
    <div className="flex rounded-[10px] border border-border-subtle bg-glass p-1">
      {options.map((o) => {
        const active = view === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className="relative rounded-[8px] px-3.5 py-1.5 text-[12px] font-medium outline-none"
            aria-pressed={active}
          >
            {active && (
              <motion.span
                layoutId="jobs-view-pill"
                transition={{ type: 'spring', stiffness: 550, damping: 42 }}
                className="absolute inset-0 rounded-[8px] bg-accent-violet shadow-glow-violet"
              />
            )}
            <span
              className={cn(
                'relative z-10 flex items-center gap-1.5 transition-colors duration-150',
                active ? 'text-white' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Jobs page                                                           */
/* ------------------------------------------------------------------ */

export default function Jobs() {
  /* ---- URL query is the source of truth for status/account/view ---- */
  const [searchParams, setSearchParams] = useSearchParams();
  const statuses = useMemo(() => parseStatuses(searchParams.get('status')), [searchParams]);
  const account = searchParams.get('account') ?? 'all';
  const view: View = searchParams.get('view') === 'board' ? 'board' : 'table';

  const [query, setQuery] = useState('');
  const [drawerJob, setDrawerJob] = useState<string | null>(null);
  const [rotate, setRotate] = useState(0);

  const { data: jobs, isLoading, refetch } = useJobs();
  const { data: accounts } = useAccounts();

  const patchParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next, { replace: true });
  };
  const setStatuses = (ss: JobStatus[]) => patchParams({ status: ss.length ? ss.join(',') : null });
  const setAccount = (a: string) => patchParams({ account: a === 'all' ? null : a });
  const setView = (v: View) => patchParams({ view: v === 'table' ? null : v });

  const resetFilters = () => {
    patchParams({ status: null, account: null });
    setQuery('');
  };

  /* pagination resets whenever the filter set changes (derived-state pattern) */
  const filterKey = `${searchParams.toString()}|${query}`;
  const [pagination, setPagination] = useState({ key: filterKey, limit: JOBS_PAGE_SIZE });
  if (pagination.key !== filterKey) {
    setPagination({ key: filterKey, limit: JOBS_PAGE_SIZE });
  }
  const limit = pagination.limit;
  const setLimit = (updater: (l: number) => number) =>
    setPagination((p) => ({ key: filterKey, limit: updater(p.limit) }));

  const all = useMemo(() => jobs ?? [], [jobs]);

  const counts = useMemo(() => {
    const m = new Map<JobStatus, number>();
    for (const j of all) m.set(j.status, (m.get(j.status) ?? 0) + 1);
    return m;
  }, [all]);

  const filtered = useMemo(() => {
    let list = all;
    if (statuses.length) list = list.filter((j) => statuses.includes(j.status));
    if (account !== 'all') list = list.filter((j) => j.account_name === account);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (j) => j.job_id.toLowerCase().includes(q) || j.topic.toLowerCase().includes(q),
      );
    }
    return list;
  }, [all, statuses, account, query]);

  const activeCount = countByStatus(all, [...IN_PROGRESS_STATUSES, 'awaiting_human']);
  const isFiltered = statuses.length > 0 || account !== 'all' || query.trim() !== '';

  const platformOf = useMemo(() => {
    const m = new Map<string, Platform>();
    for (const a of accounts ?? []) m.set(a.name, a.platform);
    return (name: string): Platform => m.get(name) ?? 'mock';
  }, [accounts]);

  const onRefresh = () => {
    setRotate((r) => r + 360);
    void refetch();
  };

  const visible = filtered.slice(0, limit);

  return (
    <div className="flex flex-col gap-5">
      <ErrorBanner />

      {/* S1 page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="font-grotesk text-[22px] font-bold tracking-[-0.01em] text-text-primary"
          >
            内容工单
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.06 }}
            className="mt-1 text-[12px] text-text-muted"
          >
            共 <span className="font-mono tabular-nums text-text-secondary">{all.length}</span> 条
            · 进行中 <span className="font-mono tabular-nums text-text-secondary">{activeCount}</span> 条
            · 每 10s 自动刷新
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex items-center gap-2.5"
        >
          <ViewToggle view={view} onChange={setView} />
          <button
            onClick={onRefresh}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-border-subtle bg-glass text-text-secondary transition-colors hover:border-accent-violet/40 hover:text-text-primary"
            title="手动刷新"
            aria-label="刷新工单列表"
          >
            <motion.span
              animate={{ rotate }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="flex"
            >
              <RefreshCw size={14} />
            </motion.span>
          </button>
        </motion.div>
      </div>

      {/* S2 filter bar */}
      <FilterBar
        total={all.length}
        counts={counts}
        statuses={statuses}
        onStatusesChange={setStatuses}
        accounts={accounts ?? []}
        account={account}
        onAccountChange={setAccount}
        query={query}
        onQueryChange={setQuery}
        resultCount={filtered.length}
        isFiltered={isFiltered}
        onReset={resetFilters}
      />

      {/* S3 table / board with crossfade on view switch */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {view === 'table' ? (
            <JobsTable
              jobs={visible}
              total={filtered.length}
              hasMore={filtered.length > visible.length}
              onLoadMore={() => setLimit((l) => l + JOBS_PAGE_SIZE)}
              loading={isLoading}
              platformOf={platformOf}
              isFiltered={isFiltered}
              onReset={resetFilters}
              onOpen={setDrawerJob}
            />
          ) : (
            <JobsBoard
              jobs={filtered}
              loading={isLoading}
              platformOf={platformOf}
              isFiltered={isFiltered}
              onReset={resetFilters}
              onOpen={setDrawerJob}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* S4 shared job detail drawer */}
      <JobDrawer jobId={drawerJob} onClose={() => setDrawerJob(null)} />
    </div>
  );
}
