import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { JobSummary, Platform } from '@/lib/types';
import AccountAvatar from '@/components/AccountAvatar';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function abbrevId(id: string): string {
  return id.length > 9 ? `${id.slice(0, 8)}…` : id;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function TimeCell({ iso }: { iso: string }) {
  return (
    <div className="leading-tight">
      <div className="font-mono text-[11.5px] tabular-nums text-text-secondary">{fmtTime(iso)}</div>
      <div className="mt-0.5 text-[10px] text-text-muted">{relTime(iso)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* table row                                                           */
/* ------------------------------------------------------------------ */

interface RowProps {
  job: JobSummary;
  index: number;
  fresh: boolean;
  platformOf: (name: string) => Platform;
  onOpen: (jobId: string) => void;
}

function JobRow({ job, index, fresh, platformOf, onOpen }: RowProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(job.job_id).catch(() => undefined);
    setCopied(true);
    toast.success('已复制', { description: `job_id: ${job.job_id}`, duration: 1800 });
    setTimeout(() => setCopied(false), 1200);
  };

  const openReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/review?focus=${job.job_id}`);
  };

  const failed = job.status === 'failed';
  const alert = job.status === 'alert';

  return (
    <motion.tr
      layout="position"
      initial={{ opacity: 0, y: fresh ? -12 : 12 }}
      animate={
        fresh
          ? { opacity: 1, y: 0, backgroundColor: ['rgba(124,92,255,0.14)', 'rgba(124,92,255,0)'] }
          : { opacity: 1, y: 0 }
      }
      transition={{
        duration: 0.28,
        ease: 'easeOut',
        delay: index < 20 ? index * 0.03 : 0,
        backgroundColor: { duration: 1.5, ease: 'easeOut' },
        layout: { duration: 0.3, ease: 'easeInOut' },
      }}
      onClick={() => onOpen(job.job_id)}
      className={cn(
        'group h-[52px] cursor-pointer border-b border-border-subtle transition-colors last:border-b-0 hover:bg-white/[0.03]',
        alert && 'bg-[rgba(248,113,113,0.05)] hover:bg-[rgba(248,113,113,0.08)]',
      )}
    >
      {/* status */}
      <td
        className="pl-4 pr-2"
        style={failed ? { boxShadow: 'inset 2px 0 0 #F87171' } : undefined}
      >
        <StatusBadge status={job.status} />
      </td>

      {/* job_id */}
      <td className="px-2">
        <button
          onClick={copyId}
          title={`${job.job_id} · 点击复制`}
          className="flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 font-mono text-[11.5px] tabular-nums text-accent-cyan/90 transition-colors hover:bg-glass hover:text-accent-cyan"
        >
          {abbrevId(job.job_id)}
          <Copy size={11} className={cn('transition-opacity', copied ? 'text-status-published opacity-100' : 'opacity-0 group-hover:opacity-60')} />
        </button>
      </td>

      {/* account */}
      <td className="px-2">
        <div className="flex items-center gap-2">
          <AccountAvatar name={job.account_name} platform={platformOf(job.account_name)} size={24} />
          <span className="font-mono text-[11.5px] text-text-secondary">{job.account_name}</span>
        </div>
      </td>

      {/* topic + inline error summary */}
      <td className="max-w-0 px-2">
        <div className="truncate text-[12.5px] text-text-primary" title={job.topic}>
          {truncate(job.topic, 40)}
        </div>
        {failed && job.error && (
          <div className="mt-0.5 truncate text-[11px] text-status-failed/90" title={job.error}>
            {truncate(job.error, 30)}
          </div>
        )}
      </td>

      {/* retry */}
      <td className="px-2 text-center">
        {job.retry_count > 0 ? (
          <span className="inline-flex rounded-full border border-border-subtle bg-glass px-2 py-0.5 text-[10.5px] text-text-secondary">
            重试 ×{job.retry_count}
          </span>
        ) : (
          <span className="text-[11px] text-text-muted">—</span>
        )}
      </td>

      {/* created / updated */}
      <td className="px-2">
        <TimeCell iso={job.created_at} />
      </td>
      <td className="px-2">
        <TimeCell iso={job.updated_at} />
      </td>

      {/* actions */}
      <td className="pl-2 pr-4">
        <div className="flex items-center justify-end gap-1.5">
          {job.status === 'awaiting_human' && (
            <button
              onClick={openReview}
              className="rounded-[8px] border border-status-awaiting/40 bg-status-awaiting/10 px-2.5 py-1 text-[11px] font-medium text-status-awaiting transition-all hover:bg-status-awaiting/20 hover:shadow-glow-amber"
            >
              审核
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(job.job_id);
            }}
            className="rounded-[8px] border border-border-subtle bg-glass px-2.5 py-1 text-[11px] text-text-secondary opacity-0 transition-all hover:border-accent-violet/40 hover:text-text-primary group-hover:opacity-100"
          >
            详情
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

/* ------------------------------------------------------------------ */
/* table view                                                          */
/* ------------------------------------------------------------------ */

const HEADERS = ['状态', 'job_id', '账号', '主题', '重试', '创建时间', '更新时间', '操作'];

interface Props {
  jobs: JobSummary[];
  total: number;
  hasMore: boolean;
  onLoadMore: () => void;
  loading: boolean;
  platformOf: (name: string) => Platform;
  isFiltered: boolean;
  onReset: () => void;
  onOpen: (jobId: string) => void;
}

export default function JobsTable({
  jobs,
  total,
  hasMore,
  onLoadMore,
  loading,
  platformOf,
  isFiltered,
  onReset,
  onOpen,
}: Props) {
  /* ids newly appearing between polls slide in + flash for 1.5s */
  const knownRef = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (knownRef.current === null) {
      knownRef.current = new Set(jobs.map((j) => j.job_id));
      return;
    }
    const known = knownRef.current;
    const added = jobs.filter((j) => !known.has(j.job_id)).map((j) => j.job_id);
    for (const j of jobs) known.add(j.job_id);
    if (added.length) {
      setFreshIds(new Set(added));
      const t = setTimeout(() => setFreshIds(new Set()), 1500);
      return () => clearTimeout(t);
    }
  }, [jobs]);

  if (loading) {
    return (
      <div className="glass-panel overflow-hidden p-4">
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-[52px] rounded-[10px]" />
          ))}
        </div>
      </div>
    );
  }

  if (total === 0) {
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
    <div className="glass-panel overflow-hidden">
      <table className="w-full border-collapse">
        <thead className="sticky top-16 z-10">
          <tr className="bg-panel/95 backdrop-blur-xl">
            {HEADERS.map((h, i) => (
              <th
                key={h}
                className={cn(
                  'border-b border-border-subtle px-2 py-3 text-[11px] font-medium uppercase tracking-wider text-text-muted',
                  i === 0 && 'pl-4 text-left',
                  i === HEADERS.length - 1 && 'pr-4 text-right',
                  i === 4 && 'text-center',
                  i !== 0 && i !== 4 && i !== HEADERS.length - 1 && 'text-left',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j, i) => (
            <JobRow
              key={j.job_id}
              job={j}
              index={i}
              fresh={freshIds.has(j.job_id)}
              platformOf={platformOf}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>

      {/* load more / count footer */}
      <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
        <span className="text-[11px] text-text-muted">
          显示 <span className="font-mono tabular-nums text-text-secondary">{jobs.length}</span>
          {' / '}
          <span className="font-mono tabular-nums text-text-secondary">{total}</span> 条
        </span>
        {hasMore && (
          <button
            onClick={onLoadMore}
            className="rounded-[10px] border border-border-subtle bg-glass px-4 py-1.5 text-[12px] text-text-secondary transition-all hover:border-accent-violet/40 hover:text-text-primary active:scale-[0.97]"
          >
            加载更多
          </button>
        )}
      </div>
    </div>
  );
}
