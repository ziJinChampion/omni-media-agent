import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, RotateCcw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALL_STATUSES,
  IN_PROGRESS_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  type AccountConfig,
  type JobStatus,
} from '@/lib/types';
import AccountAvatar from '@/components/AccountAvatar';

/* ------------------------------------------------------------------ */
/* status chip with flip-animating count                               */
/* ------------------------------------------------------------------ */

function FlipCount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('relative inline-flex h-4 min-w-4 items-center justify-center overflow-hidden font-mono text-[10.5px] tabular-nums', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface ChipProps {
  label: string;
  count?: number;
  color?: string;
  selected: boolean;
  danger?: boolean;
  onClick: () => void;
}

function Chip({ label, count, color, selected, danger, onClick }: ChipProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 600, damping: 24 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex h-[30px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-medium transition-colors duration-150',
        !selected && 'border-border-subtle bg-glass hover:border-white/20',
        !selected && danger ? 'text-status-failed' : !selected && 'text-text-secondary hover:text-text-primary',
      )}
      style={
        selected
          ? {
              background: color ?? '#7C5CFF',
              borderColor: color ?? '#7C5CFF',
              color: '#fff',
              boxShadow: `0 0 14px color-mix(in srgb, ${color ?? '#7C5CFF'} 35%, transparent)`,
            }
          : undefined
      }
    >
      {color && !selected && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      )}
      {danger && !selected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-failed" />}
      {label}
      {count != null && <FlipCount value={count} className={selected ? 'text-white/85' : 'text-text-muted'} />}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* account dropdown                                                    */
/* ------------------------------------------------------------------ */

function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: AccountConfig[];
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = accounts.find((a) => a.name === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-[30px] items-center gap-2 rounded-full border border-border-subtle bg-glass px-3 text-[11.5px] text-text-secondary transition-colors hover:border-white/20 hover:text-text-primary"
      >
        {current ? (
          <>
            <AccountAvatar name={current.name} platform={current.platform} size={16} />
            <span className="font-mono">{current.name}</span>
          </>
        ) : (
          <span>全部账号</span>
        )}
        <ChevronDown size={12} className={cn('text-text-muted transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 z-50 mt-1.5 w-52 overflow-hidden rounded-[12px] border border-border-subtle bg-elevated shadow-2xl"
          >
            <button
              onClick={() => {
                onChange('all');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] text-text-primary transition-colors hover:bg-glass"
            >
              <span className="flex-1">全部账号</span>
              {value === 'all' && <Check size={13} className="text-accent-violet" />}
            </button>
            {accounts.map((a) => (
              <button
                key={a.name}
                onClick={() => {
                  onChange(a.name);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] text-text-primary transition-colors hover:bg-glass"
              >
                <AccountAvatar name={a.name} platform={a.platform} size={20} />
                <span className="flex-1 font-mono">{a.name}</span>
                {value === a.name && <Check size={13} className="text-accent-violet" />}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* filter bar                                                          */
/* ------------------------------------------------------------------ */

const ACTIVE_SET: JobStatus[] = [...IN_PROGRESS_STATUSES, 'awaiting_human'];
const ABNORMAL_SET: JobStatus[] = ['failed', 'alert'];

function sameSet(a: JobStatus[], b: JobStatus[]) {
  return a.length === b.length && b.every((s) => a.includes(s));
}

interface Props {
  total: number;
  counts: Map<JobStatus, number>;
  statuses: JobStatus[];
  onStatusesChange: (ss: JobStatus[]) => void;
  accounts: AccountConfig[];
  account: string;
  onAccountChange: (name: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
  isFiltered: boolean;
  onReset: () => void;
}

export default function FilterBar({
  total,
  counts,
  statuses,
  onStatusesChange,
  accounts,
  account,
  onAccountChange,
  query,
  onQueryChange,
  resultCount,
  isFiltered,
  onReset,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  /* ⌘K focuses this page-level filter (capture phase wins over the Topbar shortcut) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopImmediatePropagation();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const toggle = (s: JobStatus) => {
    onStatusesChange(statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.12 }}
      className="glass-panel flex flex-wrap items-center gap-2 px-4 py-3"
    >
      {/* status chips: 全部 + 9 states, multi-select */}
      <Chip
        label="全部"
        count={total}
        selected={statuses.length === 0}
        onClick={() => onStatusesChange([])}
      />
      {ALL_STATUSES.map((s) => (
        <Chip
          key={s}
          label={STATUS_LABELS[s]}
          count={counts.get(s) ?? 0}
          color={STATUS_COLORS[s]}
          selected={statuses.includes(s)}
          onClick={() => toggle(s)}
        />
      ))}

      <span className="mx-1 hidden h-5 w-px bg-border-subtle sm:block" />

      {/* one-click combos */}
      <Chip
        label="活跃"
        selected={sameSet(statuses, ACTIVE_SET)}
        onClick={() => onStatusesChange(sameSet(statuses, ACTIVE_SET) ? [] : ACTIVE_SET)}
      />
      <Chip
        label="异常"
        danger
        selected={sameSet(statuses, ABNORMAL_SET)}
        onClick={() => onStatusesChange(sameSet(statuses, ABNORMAL_SET) ? [] : ABNORMAL_SET)}
      />

      <span className="mx-1 hidden h-5 w-px bg-border-subtle sm:block" />

      <AccountSelect accounts={accounts} value={account} onChange={onAccountChange} />

      {/* search */}
      <div className="flex h-[30px] min-w-[200px] flex-1 items-center gap-2 rounded-full border border-border-subtle bg-glass px-3 transition-colors focus-within:border-accent-violet/50 sm:max-w-[240px]">
        <Search size={13} className="shrink-0 text-text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索 job_id / topic…"
          className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <kbd>⌘K</kbd>
      </div>

      {/* reset + result count */}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-[11px] text-text-muted">
          当前过滤: <span className="font-mono tabular-nums text-text-secondary">{resultCount}</span> 条结果
        </span>
        <button
          onClick={onReset}
          disabled={!isFiltered}
          className={cn(
            'flex h-[30px] items-center gap-1.5 rounded-full border border-border-subtle px-3 text-[11.5px] transition-all',
            isFiltered
              ? 'text-text-secondary hover:border-accent-violet/40 hover:text-text-primary'
              : 'cursor-not-allowed text-text-muted opacity-50',
          )}
        >
          <RotateCcw size={11} />
          重置
        </button>
      </div>
    </motion.div>
  );
}
