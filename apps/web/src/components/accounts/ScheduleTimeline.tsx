/**
 * S2 — 24h cron schedule swim-lane timeline.
 * One lane per account, glowing dots at the daily cron时刻, a live cyan
 * "now" cursor, hover tooltips with the countdown to the next run.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AccountConfig } from '@/lib/types';
import AccountAvatar from '@/components/AccountAvatar';
import { fmtCountdown, humanCron, msUntilNextRun, pad2, parseDailyCron, personaPlatform, PERSONA_COLORS } from './utils';

interface Props {
  accounts: AccountConfig[];
  onSelect: (account: AccountConfig) => void;
}

const LABEL_W = 'w-[152px]';
const TICKS = Array.from({ length: 13 }, (_, i) => i * 2); // 0,2,…,24

/** one cron dot on a lane; solid when today's slot already passed, hollow + pulsing when upcoming */
function CronDot({
  account,
  now,
  delay,
}: {
  account: AccountConfig;
  now: number;
  delay: number;
}) {
  const daily = parseDailyCron(account.cron);
  if (!daily) return null;
  const frac = (daily.h + daily.m / 60) / 24;
  const color = PERSONA_COLORS[personaPlatform(account)];
  const d = new Date(now);
  const passed = daily.h * 60 + daily.m <= d.getHours() * 60 + d.getMinutes();
  const remain = msUntilNextRun(account.cron, now);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ type: 'spring', stiffness: 380, damping: 18, delay }}
      className="group/dot absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${frac * 100}%` }}
    >
      {/* pulse halo for future slots */}
      {!passed && (
        <span
          className="absolute inset-0 rounded-full animate-dot-pulse"
          style={{ background: color, opacity: 0.35 }}
        />
      )}
      <span
        className="relative block h-3 w-3 rounded-full"
        style={
          passed
            ? { background: color, boxShadow: `0 0 10px ${color}` }
            : { border: `2px solid ${color}`, background: 'rgba(8,10,16,0.9)', boxShadow: `0 0 10px color-mix(in srgb, ${color} 55%, transparent)` }
        }
      />
      {/* tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[10px] border border-border-subtle bg-elevated/95 px-3 py-1.5 backdrop-blur group-hover/dot:block">
        <span className="text-[11px] text-text-primary">{humanCron(account.cron)}</span>
        <span className="mx-1.5 text-[11px] text-text-muted">·</span>
        <span className="font-mono text-[11px] text-text-secondary">cron `{account.cron}`</span>
        {remain !== null && (
          <>
            <span className="mx-1.5 text-[11px] text-text-muted">·</span>
            <span className="text-[11px] text-text-secondary">
              下次运行还有 <span className="font-mono tabular-nums text-accent-cyan">{fmtCountdown(remain)}</span>
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function ScheduleTimeline({ accounts, onSelect }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const d = new Date(now);
  const nowFrac = (d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60) / (24 * 60);

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary">24h 调度时间线</h3>
          <p className="mt-0.5 text-[11px] text-text-muted">cron 每日触发时刻 · 点击圆点或泳道查看账号详情</p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-text-muted">
          现在 <span className="text-accent-cyan">{pad2(d.getHours())}:{pad2(d.getMinutes())}</span>
        </span>
      </div>

      <div className="mt-3 flex">
        {/* lane labels column */}
        <div className={cn(LABEL_W, 'shrink-0')}>
          <div className="h-6" />
          {accounts.map((a) => (
            <button
              key={a.name}
              onClick={() => onSelect(a)}
              className="flex h-11 w-full items-center gap-2 rounded-l-[10px] pr-2 text-left transition-colors hover:bg-white/[0.03]"
            >
              <AccountAvatar name={a.name} platform={personaPlatform(a)} size={22} />
              <span className="truncate font-mono text-[11.5px] text-text-secondary">{a.name}</span>
            </button>
          ))}
        </div>

        {/* timeline column */}
        <div className="relative min-w-0 flex-1">
          {/* live "now" cursor across all lanes */}
          <motion.div
            className="pointer-events-none absolute inset-y-1 z-20 w-px"
            style={{ left: `${nowFrac * 100}%`, background: '#22D3EE' }}
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span
              className="absolute inset-y-0 w-px"
              style={{ boxShadow: '0 0 8px rgba(34,211,238,0.7)' }}
            />
            <span className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent-cyan" />
          </motion.div>

          {/* hour ticks */}
          <div className="relative h-6">
            {TICKS.map((h) => (
              <span
                key={h}
                className="absolute top-0 -translate-x-1/2 font-mono text-[9.5px] tabular-nums text-text-muted"
                style={{ left: `${(h / 24) * 100}%` }}
              >
                {pad2(h)}
              </span>
            ))}
            {/* tick axis draw-in */}
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute bottom-1 left-0 h-px w-full origin-left"
              style={{ background: 'linear-gradient(90deg, rgba(124,92,255,0.45), rgba(34,211,238,0.45), rgba(255,255,255,0.10))' }}
            />
            {TICKS.map((h) => (
              <span
                key={`t${h}`}
                className="absolute bottom-0 h-1 w-px bg-white/15"
                style={{ left: `${(h / 24) * 100}%` }}
              />
            ))}
          </div>

          {/* account lanes */}
          {accounts.map((a, i) => (
            <button
              key={a.name}
              onClick={() => onSelect(a)}
              className="group relative block h-11 w-full rounded-r-[10px] text-left transition-colors hover:bg-white/[0.03]"
            >
              <span
                className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              />
              <CronDot account={a} now={now} delay={0.15 + i * 0.12} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
