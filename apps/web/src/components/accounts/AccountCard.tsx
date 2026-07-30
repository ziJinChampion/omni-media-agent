/**
 * S3 — account configuration card: persona header, keyword chips (hover to
 * expand), schedule + live countdown, style prompt, review mode + quota ring,
 * 7-day sparkline stats and detail / trigger actions.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Play, Quote, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS, VERTICAL_LABELS, type AccountConfig, type JobSummary } from '@/lib/types';
import AccountAvatar from '@/components/AccountAvatar';
import PlatformIcon from '@/components/PlatformIcon';
import QuotaRing from '@/components/QuotaRing';
import CronCountdown from '@/components/CronCountdown';
import Sparkline from '@/components/Sparkline';
import { bucketByDay, humanCron, isToday, personaPlatform, PERSONA_COLORS } from './utils';

interface Props {
  account: AccountConfig;
  jobs: JobSummary[];
  delay: number;
  onOpen: (account: AccountConfig) => void;
  onTrigger: (account: AccountConfig) => void;
}

const KW_COLLAPSED = 4;

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex w-16 shrink-0 items-center gap-1 pt-0.5 text-[11px] text-text-muted">
        {icon}
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default function AccountCard({ account, jobs, delay, onOpen, onTrigger }: Props) {
  const [kwExpanded, setKwExpanded] = useState(false);
  const persona = personaPlatform(account);
  const personaColor = PERSONA_COLORS[persona];

  const mine = jobs.filter((j) => j.account_name === account.name);
  const publishedToday = mine.filter((j) => j.status === 'published' && isToday(j.updated_at)).length;
  const published7d = mine.filter((j) => j.status === 'published').length;
  const failed7d = mine.filter((j) => j.status === 'failed').length;
  const daily = bucketByDay(mine, (j) => j.created_at);

  const keywords = account.keywords;
  const hiddenCount = keywords.length - KW_COLLAPSED;
  const visibleKw = kwExpanded ? keywords : keywords.slice(0, KW_COLLAPSED);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      onClick={() => onOpen(account)}
      className="glass-panel card-hairline group cursor-pointer p-5 transition-colors hover:border-white/[0.14]"
    >
      {/* header */}
      <div className="flex items-center gap-3.5">
        <AccountAvatar name={account.name} platform={persona} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-grotesk text-[16px] font-semibold text-text-primary">{account.name}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">
            {VERTICAL_LABELS[account.vertical]} · {persona}
          </div>
        </div>
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
          style={{
            color: personaColor,
            borderColor: `color-mix(in srgb, ${personaColor} 45%, transparent)`,
            background: `color-mix(in srgb, ${personaColor} 8%, transparent)`,
          }}
        >
          <PlatformIcon platform={persona} size={14} />
          {PLATFORM_LABELS[persona]}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4">
        {/* keywords */}
        <Row icon={<Tags size={11} />} label="关键词">
          <div
            className="flex flex-wrap gap-1.5"
            onMouseEnter={() => setKwExpanded(true)}
            onMouseLeave={() => setKwExpanded(false)}
          >
            {visibleKw.map((k, i) => (
              <motion.span
                key={k}
                initial={i >= KW_COLLAPSED ? { opacity: 0, scale: 0.85 } : false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.18, delay: i >= KW_COLLAPSED ? (i - KW_COLLAPSED) * 0.04 : 0 }}
                className="rounded-full border border-border-subtle bg-glass px-2.5 py-0.5 text-[11px] text-text-secondary"
              >
                {k}
              </motion.span>
            ))}
            {!kwExpanded && hiddenCount > 0 && (
              <span className="rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-violet">
                +{hiddenCount}
              </span>
            )}
          </div>
        </Row>

        {/* schedule */}
        <Row icon={<CalendarClock size={11} />} label="调度">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[12.5px] text-text-primary">{humanCron(account.cron)}</span>
            <span className="rounded-md border border-border-subtle bg-glass px-1.5 py-0.5 font-mono text-[10.5px] text-text-secondary">
              {account.cron}
            </span>
            <CronCountdown cron={account.cron} className="flex-row items-baseline gap-1.5 [&>span:first-child]:hidden" />
          </div>
        </Row>

        {/* style prompt */}
        <Row icon={<Quote size={11} />} label="风格">
          <p
            className="line-clamp-2 text-[12px] italic leading-relaxed text-text-secondary"
            title={account.style_prompt}
          >
            「{account.style_prompt}」
          </p>
        </Row>

        {/* mode + quota */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
              account.human_review
                ? 'bg-status-awaiting/10 text-status-awaiting shadow-glow-amber'
                : 'bg-accent-cyan/10 text-accent-cyan',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', account.human_review ? 'bg-status-awaiting' : 'bg-accent-cyan')} />
            {account.human_review ? '人工审核后发布' : '全自动发布'}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <QuotaRing used={publishedToday} total={account.max_posts_per_day} size={28} stroke={3} />
            <span className="text-[11px] text-text-muted">
              今日配额 <span className="font-mono tabular-nums text-text-secondary">{publishedToday}/{account.max_posts_per_day}</span>
            </span>
          </span>
        </div>
      </div>

      {/* footer stats + actions */}
      <div className="mt-4 flex items-center gap-3 border-t border-border-subtle pt-3.5">
        <span className="flex items-center gap-2">
          <span className="text-[10.5px] text-text-muted">近7天</span>
          <span className="opacity-70 transition-opacity group-hover:opacity-100">
            <Sparkline data={daily} width={48} height={16} color={persona === 'douyin' ? '#22D3EE' : '#7C5CFF'} />
          </span>
        </span>
        <span className="text-[11px] text-text-secondary">
          发布 <span className="font-mono tabular-nums text-text-primary">{published7d}</span>
          <span className="mx-1 text-text-muted">·</span>
          失败{' '}
          <span className={cn('font-mono tabular-nums', failed7d > 0 ? 'text-status-failed' : 'text-text-primary')}>
            {failed7d}
          </span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(account);
            }}
            className="rounded-[10px] border border-border-subtle px-3 py-1.5 text-[12px] text-text-secondary transition-all hover:border-accent-violet/50 hover:text-text-primary hover:scale-[1.02] active:scale-[0.97]"
          >
            查看详情
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTrigger(account);
            }}
            className="btn-primary-gradient flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            <Play size={12} />
            触发
          </button>
        </span>
      </div>
    </motion.div>
  );
}
