import { Check, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_COLORS, STATUS_LABELS, type JobStatus } from '@/lib/types';

interface Props {
  status: JobStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const PULSE: JobStatus[] = ['researching', 'drafting', 'reviewing'];

/** Semantic badge for the 9-state job state machine (design.md color system). */
export default function StatusBadge({ status, size = 'md', className }: Props) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  const dot = (
    <span className="relative inline-flex shrink-0" style={{ width: 8, height: 8 }}>
      {PULSE.includes(status) && (
        <span
          className="absolute inset-0 rounded-full animate-dot-pulse"
          style={{ background: color, opacity: 0.45 }}
        />
      )}
      {status === 'awaiting_human' && (
        <span className="absolute -inset-0.5 rounded-full animate-amber-breathe" />
      )}
      {status === 'publishing' ? (
        <svg viewBox="0 0 8 8" className="h-2 w-2 animate-spin-slow" aria-hidden>
          <circle cx="4" cy="4" r="3" fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="1.6" />
          <path d="M4 1a3 3 0 0 1 3 3" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : status === 'published' ? (
        <Check size={10} strokeWidth={3} style={{ color }} aria-hidden />
      ) : status === 'failed' ? (
        <TriangleAlert size={10} strokeWidth={2.5} style={{ color }} aria-hidden />
      ) : (
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      )}
    </span>
  );

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-[3px] text-[11.5px]',
        status === 'alert' && 'animate-badge-shake',
        className,
      )}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 32%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        boxShadow:
          status === 'awaiting_human'
            ? '0 0 14px rgba(245,158,11,0.18)'
            : status === 'alert'
              ? '0 0 16px rgba(251,113,133,0.25)'
              : undefined,
      }}
    >
      {dot}
      {label}
    </span>
  );
}
