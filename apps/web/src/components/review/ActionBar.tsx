import { Check, Info, X } from 'lucide-react';
import type { JobDetail } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import { fmtClock } from './helpers';

interface Props {
  job: JobDetail | null;
  /** 1-based position in the queue, and queue length */
  index: number;
  total: number;
  /** mutation in flight or exit animation running */
  busy: boolean;
  /** key-press feedback for the A / R shortcuts */
  pressed: 'a' | 'r' | null;
  onApprove: () => void;
  onReject: () => void;
}

/**
 * S6 sticky glass action bar. For non-awaiting focus jobs (e.g. jumped in
 * from Jobs after processing) the buttons are replaced by a status note.
 */
export default function ActionBar({ job, index, total, busy, pressed, onApprove, onReject }: Props) {
  const awaiting = job?.status === 'awaiting_human';

  return (
    <div className="sticky bottom-0 z-20 -mx-1 mt-4 border-t border-border-subtle bg-void/75 px-4 py-3 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {job ? (
            <>
              <span className="font-mono text-[11.5px] tabular-nums text-text-muted">{job.job_id}</span>
              {awaiting && (
                <span className="font-mono text-[11px] tabular-nums text-text-secondary">
                  队列第 {index}/{total} 条
                </span>
              )}
            </>
          ) : (
            <span className="font-mono text-[11.5px] text-text-muted">—</span>
          )}
        </div>

        {job && !awaiting ? (
          <div className="flex items-center gap-2.5 text-[12px] text-text-secondary">
            <Info size={13} className="text-text-muted" />
            <span>
              该工单当前状态为
              <StatusBadge status={job.status} size="sm" className="mx-1.5" />
              {job.status === 'published' && job.state.publish_result?.published_at
                ? `已于 ${fmtClock(job.state.publish_result.published_at)} 发布`
                : job.status === 'failed'
                  ? '已拒绝并归档'
                  : `「${STATUS_LABELS[job.status]}」，无需人工操作`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              onClick={onReject}
              disabled={busy || !job}
              className={cn(
                'flex items-center gap-2 rounded-[10px] border border-status-failed/55 px-4 py-2 text-[13px] font-medium text-status-failed transition-all duration-150 hover:bg-status-failed/10 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45',
                pressed === 'r' && 'scale-95 bg-status-failed/15',
              )}
            >
              <X size={14} strokeWidth={2.5} />
              拒绝
              <kbd className="border-status-failed/30 bg-status-failed/10 text-status-failed/80">R</kbd>
            </button>
            <button
              onClick={onApprove}
              disabled={busy || !job}
              className={cn(
                'flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold text-[#04140D] transition-all duration-150 hover:scale-[1.02] hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45',
                pressed === 'a' && 'scale-95 brightness-110',
              )}
              style={{
                background: 'linear-gradient(135deg,#34D399,#10B981)',
                boxShadow: busy ? undefined : '0 0 18px rgba(52,211,153,0.22)',
              }}
            >
              <Check size={14} strokeWidth={3} />
              通过并发布
              <kbd className="border-black/15 bg-black/10 text-[#04140D]/75">A</kbd>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
