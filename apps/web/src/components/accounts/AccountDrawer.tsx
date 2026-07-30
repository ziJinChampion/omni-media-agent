/**
 * S4 — account detail drawer (520px, right slide-in): persona header with
 * trigger CTA, two-column config definition list, 7-day run overview and the
 * account's 5 most recent jobs linking to the Jobs page.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PLATFORM_LABELS,
  VERTICAL_LABELS,
  type AccountConfig,
  type JobSummary,
} from '@/lib/types';
import AccountAvatar from '@/components/AccountAvatar';
import PlatformIcon from '@/components/PlatformIcon';
import StatusBadge from '@/components/StatusBadge';
import { bucketByDay, humanCron, personaPlatform, PERSONA_COLORS, relTime } from './utils';

interface Props {
  /** account to display; null closes the drawer */
  account: AccountConfig | null;
  jobs: JobSummary[];
  onClose: () => void;
  onTrigger: (account: AccountConfig) => void;
}

function Block({ title, index, children }: { title?: string; index: number; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.08 + index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="mt-5 first:mt-0"
    >
      {title && <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{title}</h4>}
      {children}
    </motion.section>
  );
}

function DrawerBody({ account, jobs, onTrigger }: { account: AccountConfig; jobs: JobSummary[]; onTrigger: (a: AccountConfig) => void }) {
  const navigate = useNavigate();
  const persona = personaPlatform(account);
  const personaColor = PERSONA_COLORS[persona];

  const mine = jobs.filter((j) => j.account_name === account.name);
  const recent = [...mine].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 5);
  const jobs7d = bucketByDay(mine, (j) => j.created_at).reduce((s, n) => s + n, 0);
  const published = mine.filter((j) => j.status === 'published').length;
  const failed = mine.filter((j) => j.status === 'failed').length;
  const successRate = published + failed > 0 ? (published / (published + failed)) * 100 : 100;
  const durations = mine
    .filter((j) => j.status === 'published' || j.status === 'failed')
    .map((j) => +new Date(j.updated_at) - +new Date(j.created_at))
    .filter((ms) => ms > 0);
  const avgMin = durations.length > 0 ? durations.reduce((s, n) => s + n, 0) / durations.length / 60_000 : null;

  const stats = [
    { label: '近7天工单', value: String(jobs7d), tone: '#E8ECF4' },
    { label: '成功率', value: `${successRate.toFixed(0)}%`, tone: successRate >= 90 ? '#34D399' : successRate >= 70 ? '#F59E0B' : '#F87171' },
    { label: '平均耗时', value: avgMin !== null ? `${avgMin.toFixed(1)} min` : '—', tone: '#22D3EE' },
  ];

  const goJobs = () => navigate(`/jobs?account=${account.name}`);

  return (
    <div className="px-5 pb-10 pt-5">
      {/* 1 header */}
      <Block index={0}>
        <div className="flex items-start gap-4">
          <AccountAvatar name={account.name} platform={persona} size={64} className="rounded-[14px]" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-grotesk text-[18px] font-bold text-text-primary">{account.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  color: personaColor,
                  borderColor: `color-mix(in srgb, ${personaColor} 45%, transparent)`,
                  background: `color-mix(in srgb, ${personaColor} 8%, transparent)`,
                }}
              >
                <PlatformIcon platform={persona} size={13} />
                {PLATFORM_LABELS[persona]}
              </span>
              <span className="rounded-full border border-border-subtle bg-glass px-2.5 py-0.5 text-[11px] text-text-secondary">
                {VERTICAL_LABELS[account.vertical]}
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  account.human_review ? 'bg-status-awaiting/10 text-status-awaiting' : 'bg-accent-cyan/10 text-accent-cyan',
                )}
              >
                {account.human_review ? '人工审核' : '全自动发布'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onTrigger(account)}
          className="btn-primary-gradient mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-medium text-white transition-transform hover:scale-[1.01] active:scale-[0.98]"
        >
          <Play size={14} />
          立即触发一次内容生产
        </button>
      </Block>

      {/* 2 config definition list */}
      <Block title="配置清单" index={1}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 rounded-[12px] border border-border-subtle bg-glass p-4">
          <div>
            <dt className="text-[10.5px] text-text-muted">调度</dt>
            <dd className="mt-1 text-[12.5px] text-text-primary">{humanCron(account.cron)}</dd>
            <dd className="mt-0.5 font-mono text-[11px] text-text-secondary">{account.cron}</dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-text-muted">每日配额上限</dt>
            <dd className="mt-1 font-mono text-[12.5px] tabular-nums text-text-primary">{account.max_posts_per_day} 条/天</dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-text-muted">人工审核</dt>
            <dd className="mt-1">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  account.human_review ? 'bg-status-awaiting/10 text-status-awaiting' : 'bg-glass text-text-muted',
                )}
              >
                {account.human_review ? '已开启' : '已关闭'}
              </span>
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10.5px] text-text-muted">关键词</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {account.keywords.map((k) => (
                <span key={k} className="rounded-full border border-border-subtle bg-elevated px-2.5 py-0.5 text-[11px] text-text-secondary">
                  {k}
                </span>
              ))}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10.5px] text-text-muted">风格提示词</dt>
            <dd className="mt-1.5 max-h-[7.5rem] overflow-y-auto rounded-[10px] border border-border-subtle bg-void/60 p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
              {account.style_prompt}
            </dd>
          </div>
        </dl>
      </Block>

      {/* 3 run overview */}
      <Block title="运行概览" index={2}>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[12px] border border-border-subtle bg-glass px-3 py-2.5 text-center">
              <div className="font-grotesk text-[18px] font-semibold tabular-nums" style={{ color: s.tone }}>
                {s.value}
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </Block>

      {/* 4 recent jobs */}
      <Block title="该账号最近工单" index={3}>
        {recent.length === 0 ? (
          <p className="rounded-[12px] border border-border-subtle bg-glass py-6 text-center text-[12px] text-text-muted">
            暂无工单 · 点击上方「立即触发」发起首次内容生产
          </p>
        ) : (
          <ol className="overflow-hidden rounded-[12px] border border-border-subtle">
            {recent.map((j) => (
              <li key={j.job_id}>
                <button
                  onClick={goJobs}
                  className="flex w-full items-center gap-2.5 border-b border-border-subtle/60 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-white/[0.03]"
                >
                  <StatusBadge status={j.status} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-text-primary" title={j.topic}>
                    {j.topic}
                  </span>
                  <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-text-muted">{relTime(j.updated_at)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        <button
          onClick={goJobs}
          className="mt-3 flex items-center gap-1 text-[12px] text-accent-cyan transition-colors hover:text-text-primary"
        >
          查看该账号全部工单 <ArrowRight size={12} />
        </button>
      </Block>
    </div>
  );
}

export default function AccountDrawer({ account, jobs, onClose, onTrigger }: Props) {
  // esc to close
  useEffect(() => {
    if (!account) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [account, onClose]);

  return (
    <AnimatePresence>
      {account && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-[80] flex w-[520px] max-w-[92vw] flex-col border-l border-border-subtle bg-elevated shadow-2xl"
            initial={{ x: 520 }}
            animate={{ x: 0 }}
            exit={{ x: 520, transition: { duration: 0.25, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-5">
              <span className="font-grotesk text-[13px] font-semibold text-text-primary">账号详情</span>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-muted transition-colors hover:bg-glass hover:text-text-primary"
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <DrawerBody account={account} jobs={jobs} onTrigger={onTrigger} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
