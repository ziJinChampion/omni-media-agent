import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** cron expression, only "M H * * *" daily forms are humanised */
  cron: string;
  className?: string;
}

function parseDailyCron(cron: string): { h: number; m: number } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, d, mo, w] = parts;
  if (d === '*' && mo === '*' && w === '*' && /^\d+$/.test(m) && /^\d+$/.test(h)) {
    return { h: parseInt(h, 10), m: parseInt(m, 10) };
  }
  return null;
}

function nextRun(h: number, m: number): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "每日 09:00" + live HH:MM:SS countdown to the next scheduled run. */
export default function CronCountdown({ cron, className }: Props) {
  const daily = useMemo(() => parseDailyCron(cron), [cron]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!daily) {
    return <span className={cn('font-mono text-xs text-text-muted', className)}>{cron}</span>;
  }

  const target = nextRun(daily.h, daily.m).getTime();
  const diff = Math.max(0, target - now);
  const hh = Math.floor(diff / 3_600_000);
  const mm = Math.floor((diff % 3_600_000) / 60_000);
  const ss = Math.floor((diff % 60_000) / 1000);

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-[11px] text-text-muted">每日 {pad(daily.h)}:{pad(daily.m)}</span>
      <span className="font-mono text-[13px] font-medium tabular-nums text-accent-cyan">
        {pad(hh)}:{pad(mm)}:{pad(ss)}
      </span>
    </div>
  );
}
