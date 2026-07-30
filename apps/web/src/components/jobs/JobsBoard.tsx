import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LayoutGroup, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALL_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  type JobStatus,
  type JobSummary,
  type Platform,
} from '@/lib/types';
import AccountAvatar from '@/components/AccountAvatar';
import EmptyState from '@/components/EmptyState';

/* ------------------------------------------------------------------ */
/* column definitions                                                  */
/* ------------------------------------------------------------------ */

interface ColumnDef {
  key: string;
  label: string;
  statuses: JobStatus[];
}

const ALL_COLUMNS: ColumnDef[] = ALL_STATUSES.map((s) => ({
  key: s,
  label: STATUS_LABELS[s],
  statuses: [s],
}));

/** compact mode: merge in-progress states, fold alert into failed */
const ACTIVE_COLUMNS: ColumnDef[] = [
  { key: 'pending', label: '待处理', statuses: ['pending'] },
  { key: 'in-progress', label: '进行中', statuses: ['researching', 'drafting', 'reviewing'] },
  { key: 'awaiting_human', label: '待人工审核', statuses: ['awaiting_human'] },
  { key: 'publishing', label: '发布中', statuses: ['publishing'] },
  { key: 'published', label: '已发布', statuses: ['published'] },
  { key: 'failed', label: '失败 / 告警', statuses: ['failed', 'alert'] },
];

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

function abbrevId(id: string): string {
  return id.length > 9 ? `${id.slice(0, 8)}…` : id;
}

/* ------------------------------------------------------------------ */
/* kanban card — layoutId lets it "fly" across columns on status change */
/* ------------------------------------------------------------------ */

interface CardProps {
  job: JobSummary;
  flash: boolean;
  delay: number;
  platformOf: (name: string) => Platform;
  onOpen: (jobId: string) => void;
}

function BoardCard({ job, flash, delay, platformOf, onOpen }: CardProps) {
  const color = STATUS_COLORS[job.status];
  return (
    <motion.div
      layout
      layoutId={`jobs-board-card-${job.job_id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        type: 'spring',
        stiffness: 320,
        damping: 30,
        delay,
        layout: { type: 'spring', stiffness: 260, damping: 30 },
      }}
      onClick={() => onOpen(job.job_id)}
      className="group relative cursor-pointer overflow-hidden rounded-[12px] border border-border-subtle bg-glass p-3 backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lg"
    >
      {/* status-change color flash (fades out after flying to the new column) */}
      {flash && (
        <motion.span
          className="pointer-events-none absolute inset-0 z-10 rounded-[12px]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ boxShadow: `inset 0 0 0 1.5px ${color}, 0 0 26px color-mix(in srgb, ${color} 40%, transparent)` }}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] tabular-nums text-accent-cyan/80">
          {abbrevId(job.job_id)}
        </span>
        <span className="text-[10px] text-text-muted">{relTime(job.updated_at)}</span>
      </div>

      <p className="mt-1.5 line-clamp-2 min-h-[32px] text-[12px] leading-snug text-text-primary" title={job.topic}>
        {job.topic}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <AccountAvatar name={job.account_name} platform={platformOf(job.account_name)} size={18} />
          <span className="truncate font-mono text-[10.5px] text-text-secondary">{job.account_name}</span>
        </span>
        {job.retry_count > 0 && (
          <span className="shrink-0 rounded-full border border-border-subtle bg-white/[0.03] px-1.5 py-px text-[9.5px] text-text-secondary">
            重试 ×{job.retry_count}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* board view                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  jobs: JobSummary[];
  loading: boolean;
  platformOf: (name: string) => Platform;
  isFiltered: boolean;
  onReset: () => void;
  onOpen: (jobId: string) => void;
}

export default function JobsBoard({ jobs, loading, platformOf, isFiltered, onReset, onOpen }: Props) {
  const [activeOnly, setActiveOnly] = useState(false);
  const columns = activeOnly ? ACTIVE_COLUMNS : ALL_COLUMNS;

  /* entrance stagger applies only to cards present at board mount so that
     cards flying between columns on later polls are never delayed */
  const [initialIds] = useState(() => new Set(jobs.map((j) => j.job_id)));

  /* status changes between polls → flash the moved card in its new column.
     Previous statuses are kept via the derive-state-during-render pattern. */
  const [prevJobs, setPrevJobs] = useState<{ list: JobSummary[]; map: Map<string, JobStatus> }>({
    list: jobs,
    map: new Map(jobs.map((j) => [j.job_id, j.status])),
  });
  const flashIds = new Set<string>();
  if (prevJobs.list !== jobs) {
    if (prevJobs.map.size > 0) {
      for (const j of jobs) {
        const p = prevJobs.map.get(j.job_id);
        if (p && p !== j.status) flashIds.add(j.job_id);
      }
    }
    setPrevJobs({ list: jobs, map: new Map(jobs.map((j) => [j.job_id, j.status])) });
  }

  const byColumn = useMemo(() => {
    const m = new Map<string, JobSummary[]>();
    for (const col of columns) m.set(col.key, []);
    for (const j of [...jobs].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))) {
      const col = columns.find((c) => c.statuses.includes(j.status));
      if (col) m.get(col.key)!.push(j);
    }
    return m;
  }, [jobs, columns]);

  const awaitingCount = byColumn.get('awaiting_human')?.length ?? 0;

  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-[420px] w-[280px] shrink-0 rounded-[14px]" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="glass-panel">
        <EmptyState
          title="没有符合条件的工单"
          description="尝试调整状态、账号或搜索条件，或重置全部过滤。"
          action={
            isFiltered ? (
              <button
                onClick={onReset}
                className="btn-primary-gradient rounded-[10px] px-4 py-2 text-[12.5px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.97]"
              >
                重置过滤
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div>
      {/* board toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] text-text-muted">
          {columns.length} 列 · 状态轮询变化时卡片自动归入对应列
        </span>
        <button
          onClick={() => setActiveOnly((v) => !v)}
          className="flex items-center gap-2 text-[11.5px] text-text-secondary transition-colors hover:text-text-primary"
          aria-pressed={activeOnly}
        >
          仅活跃列
          <span
            className={cn(
              'relative h-[18px] w-[32px] rounded-full transition-colors duration-200',
              activeOnly ? 'bg-accent-violet' : 'bg-white/10',
            )}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className={cn(
                'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white',
                activeOnly ? 'right-[2px]' : 'left-[2px]',
              )}
            />
          </span>
        </button>
      </div>

      <LayoutGroup id="jobs-board">
        <div className="flex gap-4 overflow-x-auto pb-3">
          {columns.map((col, ci) => {
            const list = byColumn.get(col.key) ?? [];
            const isAwaiting = col.statuses.length === 1 && col.statuses[0] === 'awaiting_human';
            return (
              <motion.section
                key={col.key}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: ci * 0.06, ease: 'easeOut' }}
                className={cn(
                  'flex w-[280px] shrink-0 flex-col rounded-[14px] border border-border-subtle bg-panel/50 p-2.5',
                  isAwaiting && awaitingCount > 0 && 'border-status-awaiting/25',
                )}
              >
                {/* column header */}
                <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1">
                  <span className="flex -space-x-0.5">
                    {col.statuses.map((s) => (
                      <span
                        key={s}
                        className="h-2 w-2 rounded-full ring-2 ring-panel"
                        style={{ background: STATUS_COLORS[s] }}
                      />
                    ))}
                  </span>
                  <span className="text-[12px] font-semibold text-text-primary">{col.label}</span>
                  <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-px font-mono text-[10px] tabular-nums text-text-secondary">
                    {list.length}
                  </span>
                </div>

                {/* amber strip on the awaiting_human column */}
                {isAwaiting && awaitingCount > 0 && (
                  <Link
                    to="/review"
                    className="mb-2 flex items-center justify-between rounded-[10px] border border-status-awaiting/30 bg-gradient-to-r from-status-awaiting/15 to-status-awaiting/5 px-3 py-2 text-[11px] font-medium text-status-awaiting transition-all hover:from-status-awaiting/25 hover:shadow-glow-amber"
                  >
                    {awaitingCount} 条等待人工审核
                    <span className="flex items-center gap-1">
                      前往 Review <ArrowRight size={11} />
                    </span>
                  </Link>
                )}

                {/* cards */}
                <div className="flex min-h-[120px] flex-col gap-2">
                  {list.map((j, i) => (
                    <BoardCard
                      key={j.job_id}
                      job={j}
                      flash={flashIds.has(j.job_id)}
                      delay={initialIds.has(j.job_id) ? Math.min(ci * 0.06 + i * 0.04, 0.6) : 0}
                      platformOf={platformOf}
                      onOpen={onOpen}
                    />
                  ))}
                  {list.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-border-subtle py-8 text-[10.5px] text-text-muted">
                      暂无工单
                    </div>
                  )}
                </div>
              </motion.section>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
