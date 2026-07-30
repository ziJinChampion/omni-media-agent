import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon: ReactNode;
  label: string;
  value: number;
  /** decimals to render (e.g. 1 for "92.3%") */
  decimals?: number;
  suffix?: string;
  /** trend chip vs. previous period; positive = up */
  delta?: number;
  deltaLabel?: string;
  /** right side extra (e.g. sparkline / "实时" tag / link) */
  extra?: ReactNode;
  /** visual emphasis */
  tone?: 'default' | 'amber' | 'red';
  /** entrance delay for stagger */
  delay?: number;
  className?: string;
}

const toneStyles = {
  default: {
    value: 'text-text-primary',
    ring: '',
  },
  amber: {
    value: 'text-status-awaiting',
    ring: 'shadow-glow-amber border-status-awaiting/30',
  },
  red: {
    value: 'text-status-failed',
    ring: 'shadow-glow-red border-status-failed/30',
  },
} as const;

function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => {
      const controls = animate(0, value, {
        duration: 1.2,
        ease: 'easeOut',
        onUpdate: (v) => setDisplay(v),
      });
      return () => controls.stop();
    };
    if (played.current) {
      setDisplay(value);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !played.current) {
          played.current = true;
          run();
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  // keep updated when value changes after first play
  useEffect(() => {
    if (played.current) setDisplay(value);
  }, [value]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toFixed(decimals)}
    </span>
  );
}

/** KPI card: icon in glass tile, CountUp number, trend chip, top hairline. */
export default function StatCard({
  icon,
  label,
  value,
  decimals = 0,
  suffix,
  delta,
  deltaLabel,
  extra,
  tone = 'default',
  delay = 0,
  className,
}: Props) {
  const t = toneStyles[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        'glass-panel card-hairline group relative overflow-hidden p-4 transition-shadow duration-200',
        t.ring,
        tone === 'amber' && value > 0 && 'animate-amber-breathe',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border-subtle bg-glass text-accent-violet">
          {icon}
        </div>
        {extra}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={cn('font-grotesk text-[34px] font-bold leading-none tracking-[-0.02em]', t.value)}>
          <CountUp value={value} decimals={decimals} />
        </span>
        {suffix && <span className="text-sm text-text-secondary">{suffix}</span>}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-xs text-text-secondary">{label}</span>
        {typeof delta === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
              delta >= 0 ? 'text-status-published' : 'text-status-failed',
            )}
          >
            {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {delta >= 0 ? '+' : ''}
            {delta}
            {deltaLabel && <span className="text-text-muted">{deltaLabel}</span>}
          </span>
        )}
      </div>
    </motion.div>
  );
}
