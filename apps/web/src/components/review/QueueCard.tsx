import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bot, RefreshCw } from 'lucide-react';
import type { JobSummary, Platform } from '@/lib/types';
import AccountAvatar from '@/components/AccountAvatar';
import PlatformIcon from '@/components/PlatformIcon';
import { cn } from '@/lib/utils';
import { fmtWait } from './helpers';

interface Props {
  job: JobSummary;
  platform: Platform;
  selected: boolean;
  /** entered the queue after page load → slide-in + amber flash */
  isNew: boolean;
  now: number;
  index: number;
  onSelect: (jobId: string) => void;
}

/**
 * S2 queue card (~88px): avatar + account/platform, 2-line topic,
 * mono wait time (amber, red > 2h) and an AI-judge badge derived from
 * retry_count (reaching awaiting_human implies the judge passed).
 */
export default function QueueCard({ job, platform, selected, isNew, now, index, onSelect }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const wait = fmtWait(job.created_at, now);

  // keep the selected card visible during ←/→ keyboard navigation
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: isNew ? -14 : 16 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: isNew
          ? [
              '0 0 0 0 rgba(245,158,11,0)',
              '0 0 22px 0 rgba(245,158,11,0.4)',
              '0 0 0 0 rgba(245,158,11,0)',
            ]
          : '0 0 0 0 rgba(245,158,11,0)',
      }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{
        opacity: { duration: 0.25, delay: isNew ? 0 : Math.min(index, 6) * 0.04 },
        y: { duration: 0.3, delay: isNew ? 0 : Math.min(index, 6) * 0.04, ease: 'easeOut' },
        boxShadow: { duration: 1, delay: 0.1 },
        height: { duration: 0.3, ease: 'easeInOut' },
        layout: { duration: 0.25, ease: 'easeInOut' },
      }}
      className="mb-2 overflow-hidden rounded-[12px]"
    >
      <button
        ref={ref}
        onClick={() => onSelect(job.job_id)}
        className={cn(
          'relative w-full rounded-[12px] border p-3 text-left transition-colors duration-150',
          selected
            ? 'border-accent-violet/60 bg-glass'
            : 'border-border-subtle bg-transparent hover:bg-white/[0.03] hover:border-white/[0.12]',
        )}
      >
        {/* selected: 3px violet gradient bar on the left edge */}
        {selected && (
          <motion.span
            layoutId="queue-selected-bar"
            className="absolute inset-y-2 left-0 w-[3px] rounded-full"
            style={{ background: 'linear-gradient(180deg,#7C5CFF,#22D3EE)' }}
            transition={{ duration: 0.2 }}
          />
        )}

        <div className="flex items-center gap-2.5">
          <AccountAvatar name={job.account_name} platform={platform} size={30} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[12.5px] font-medium text-text-primary">{job.account_name}</span>
              <PlatformIcon platform={platform} size={14} className="shrink-0" />
            </div>
            <span
              className={cn(
                'mt-0.5 block font-mono text-[10.5px] tabular-nums',
                wait.overdue ? 'text-status-failed' : 'text-status-awaiting',
              )}
            >
              {wait.text}
            </span>
          </div>
          {/* AI judge badge: passed by definition of the state; revision marker when retried */}
          {job.retry_count > 0 ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-status-reviewing/35 bg-status-reviewing/10 px-2 py-0.5 text-[10px] font-medium text-status-reviewing">
              <RefreshCw size={9} />
              第{job.retry_count + 1}次修订
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-status-published/30 bg-status-published/10 px-2 py-0.5 text-[10px] font-medium text-status-published">
              <Bot size={9} />
              AI 通过
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-text-secondary">{job.topic}</p>
      </button>
    </motion.div>
  );
}
