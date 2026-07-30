/**
 * Accounts 账号矩阵页 — /accounts
 * S1 页头（标题词级入场 + 平台筛选 chips，URL query 同步）
 * S2 24h cron 调度泳道时间线
 * S3 账号配置卡网格（关键词/调度/风格/配额 + 手动触发）
 * S4 账号详情抽屉
 */

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAccounts, useJobs, useTriggerAccount } from '@/lib/hooks';
import { PLATFORM_LABELS, type AccountConfig, type Platform } from '@/lib/types';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import { ConfirmModal } from '@/components/Modals';
import ScheduleTimeline from '@/components/accounts/ScheduleTimeline';
import AccountCard from '@/components/accounts/AccountCard';
import AccountDrawer from '@/components/accounts/AccountDrawer';
import { personaPlatform } from '@/components/accounts/utils';

type PlatformFilter = 'all' | Platform;

const FILTER_CHIPS: { key: PlatformFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'xhs', label: PLATFORM_LABELS.xhs },
  { key: 'douyin', label: PLATFORM_LABELS.douyin },
  { key: 'mock', label: PLATFORM_LABELS.mock },
];

function isFilter(v: string | null): v is PlatformFilter {
  return v === 'all' || v === 'xhs' || v === 'douyin' || v === 'mock';
}

/* ------------------------------------------------------------------ */
/* S1 header                                                           */
/* ------------------------------------------------------------------ */

function PageHeader({
  total,
  reviewCount,
  filter,
  onFilter,
}: {
  total: number;
  reviewCount: number;
  filter: PlatformFilter;
  onFilter: (f: PlatformFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-grotesk text-[22px] font-bold tracking-[-0.01em] text-text-primary">
          {'账号矩阵'.split('').map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              {ch}
            </motion.span>
          ))}
        </h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mt-1 text-[12px] text-text-muted"
        >
          共 <span className="font-mono tabular-nums text-text-secondary">{total}</span> 个受管账号 ·{' '}
          <span className="font-mono tabular-nums text-status-awaiting">{reviewCount}</span> 个启用人工审核
        </motion.p>
      </div>

      {/* platform filter chips with sliding active indicator */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="flex items-center gap-1 rounded-full border border-border-subtle bg-glass p-1"
      >
        {FILTER_CHIPS.map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => onFilter(c.key)}
              className={cn(
                'relative rounded-full px-3.5 py-1.5 text-[12px] transition-colors',
                active ? 'text-accent-violet' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {active && (
                <motion.span
                  layoutId="platform-chip-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full border border-accent-violet/60 bg-accent-violet/10"
                />
              )}
              <span className="relative">{c.label}</span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function Accounts() {
  const { data: accounts = [], isLoading } = useAccounts();
  const { data: jobs = [] } = useJobs({ limit: 100 });
  const trigger = useTriggerAccount();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const filter: PlatformFilter = isFilter(searchParams.get('platform')) ? searchParams.get('platform') as PlatformFilter : 'all';
  const setFilter = (f: PlatformFilter) => {
    setSearchParams(f === 'all' ? {} : { platform: f }, { replace: true });
  };

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [confirmAccount, setConfirmAccount] = useState<AccountConfig | null>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? accounts : accounts.filter((a) => personaPlatform(a) === filter)),
    [accounts, filter],
  );
  const selected = selectedName ? accounts.find((a) => a.name === selectedName) ?? null : null;
  const reviewCount = accounts.filter((a) => a.human_review).length;

  const fire = () => {
    if (!confirmAccount) return;
    const name = confirmAccount.name;
    trigger.mutate(name, {
      onSuccess: (r) => {
        setConfirmAccount(null);
        toast.success(`已触发 ${name}`, {
          description: `job_id: ${r.job_id}`,
          action: { label: '在 Jobs 中查看', onClick: () => navigate('/jobs') },
        });
      },
      onError: (e) => toast.error('触发失败', { description: e.message }),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <ErrorBanner />

      {/* S1 */}
      <PageHeader total={accounts.length} reviewCount={reviewCount} filter={filter} onFilter={setFilter} />

      {/* S2 */}
      {isLoading ? (
        <div className="skeleton-shimmer h-[150px] rounded-[14px]" />
      ) : (
        <ScheduleTimeline accounts={filtered} onSelect={(a) => setSelectedName(a.name)} />
      )}

      {/* S3 */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-[300px] rounded-[14px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel">
          <EmptyState
            title="该平台下暂无账号"
            description="切换上方平台筛选查看其他账号，或等待新的受管账号接入矩阵"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((a, i) => (
              <AccountCard
                key={a.name}
                account={a}
                jobs={jobs}
                delay={i * 0.08}
                onOpen={(acc) => setSelectedName(acc.name)}
                onTrigger={setConfirmAccount}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* S4 */}
      <AccountDrawer
        account={selected}
        jobs={jobs}
        onClose={() => setSelectedName(null)}
        onTrigger={setConfirmAccount}
      />

      <ConfirmModal
        open={!!confirmAccount}
        title="手动触发内容生产"
        description={
          confirmAccount && (
            <>
              确认立即为 <span className="font-mono text-accent-cyan">{confirmAccount.name}</span> 触发一次内容生产？
              <br />
              <span className="text-text-muted">Agent 将执行检索 → 撰稿 → 评审流程，约 1 分钟内进入下一状态。</span>
            </>
          )
        }
        confirmText="立即触发"
        loading={trigger.isPending}
        onConfirm={fire}
        onCancel={() => setConfirmAccount(null)}
      />
    </div>
  );
}
