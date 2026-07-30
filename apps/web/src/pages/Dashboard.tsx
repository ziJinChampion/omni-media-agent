import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Loader,
  Play,
  Send,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAccounts, useJobs, useTriggerAccount, countByStatus } from '@/lib/hooks';
import {
  IN_PROGRESS_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  VERTICAL_LABELS,
  type AccountConfig,
  type JobStatus,
  type JobSummary,
} from '@/lib/types';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import AccountAvatar from '@/components/AccountAvatar';
import PlatformIcon from '@/components/PlatformIcon';
import QuotaRing from '@/components/QuotaRing';
import CronCountdown from '@/components/CronCountdown';
import Sparkline from '@/components/Sparkline';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import JobDrawer from '@/components/JobDrawer';
import { ConfirmModal } from '@/components/Modals';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isYesterday(iso: string): boolean {
  return isToday(new Date(new Date(iso).getTime() + DAY).toISOString());
}

/** last-7-days buckets, oldest → newest */
function last7Days() {
  const days: { key: string; label: string; start: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      start: d.getTime(),
    });
  }
  return days;
}

function bucketByDay(jobs: JobSummary[], pick: (j: JobSummary) => string | null): number[] {
  const days = last7Days();
  const counts = new Array(7).fill(0);
  for (const j of jobs) {
    const iso = pick(j);
    if (!iso) continue;
    const t = new Date(iso).getTime();
    for (let i = 0; i < 7; i++) {
      if (t >= days[i].start && t < days[i].start + DAY) {
        counts[i]++;
        break;
      }
    }
  }
  return counts;
}

/* ------------------------------------------------------------------ */
/* S1 page header                                                      */
/* ------------------------------------------------------------------ */

function PageHeader({ accounts }: { accounts: AccountConfig[] }) {
  const [open, setOpen] = useState(false);
  const [justTriggered, setJustTriggered] = useState(false);
  const trigger = useTriggerAccount();

  const now = new Date();
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${week}`;

  const fire = (name: string) => {
    setOpen(false);
    trigger.mutate(name, {
      onSuccess: (r) => {
        setJustTriggered(true);
        setTimeout(() => setJustTriggered(false), 800);
        toast.success(`已触发 ${name}`, { description: `job_id: ${r.job_id}` });
      },
      onError: (e) => toast.error('触发失败', { description: e.message }),
    });
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="font-grotesk text-[22px] font-bold tracking-[-0.01em] text-text-primary"
        >
          运营概览
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
          className="mt-1 font-mono text-[12px] text-text-muted"
        >
          {dateStr} · 数据每 10s 自动刷新
        </motion.p>
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={trigger.isPending}
          className={cn(
            'flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60',
            justTriggered ? 'bg-status-published' : 'btn-primary-gradient',
          )}
        >
          {justTriggered ? (
            <>✓ 已触发</>
          ) : (
            <>
              <Play size={14} /> 手动触发 <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
            </>
          )}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-50 mt-1.5 w-48 overflow-hidden rounded-[12px] border border-border-subtle bg-elevated shadow-2xl"
            >
              {accounts.map((a) => (
                <button
                  key={a.name}
                  onClick={() => fire(a.name)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] text-text-primary transition-colors hover:bg-glass"
                >
                  <AccountAvatar name={a.name} size={20} />
                  <span className="flex-1 font-mono">{a.name}</span>
                  <span className="text-[10.5px] text-text-muted">{VERTICAL_LABELS[a.vertical]}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* S3 status pipeline                                                  */
/* ------------------------------------------------------------------ */

const PRODUCTION: JobStatus[] = ['pending', 'researching', 'drafting', 'reviewing'];
const TERMINAL: JobStatus[] = ['published', 'failed', 'alert'];

function PipelineNode({
  status,
  count,
  big = false,
  delay,
  onClick,
}: {
  status: JobStatus;
  count: number;
  big?: boolean;
  delay: number;
  onClick: () => void;
}) {
  const color = STATUS_COLORS[status];
  const active = IN_PROGRESS_STATUSES.includes(status) && count > 0;
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22, delay }}
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5"
      title={`查看「${STATUS_LABELS[status]}」工单`}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full border font-grotesk text-[18px] font-semibold tabular-nums transition-transform group-hover:scale-110',
          big ? 'h-14 w-14' : 'h-11 w-11',
          active && 'animate-dot-pulse',
        )}
        style={{
          color,
          borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          boxShadow:
            status === 'awaiting_human' && count > 0
              ? '0 0 24px rgba(245,158,11,0.25)'
              : count > 0
                ? `0 0 14px color-mix(in srgb, ${color} 22%, transparent)`
                : undefined,
        }}
      >
        {count}
      </span>
      <span className="text-[11px] text-text-secondary">{STATUS_LABELS[status]}</span>
    </motion.button>
  );
}

function FlowLine({ active, delay }: { active: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.6, delay }}
      className={cn('h-px min-w-6 flex-1 origin-left self-start', active && 'pipeline-flow animate-flow-x')}
      style={{
        marginTop: 22,
        background: active ? undefined : 'linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))',
      }}
    />
  );
}

function StatusPipeline({ jobs }: { jobs: JobSummary[] }) {
  const navigate = useNavigate();
  const counts = useMemo(() => {
    const m = new Map<JobStatus, number>();
    for (const j of jobs) m.set(j.status, (m.get(j.status) ?? 0) + 1);
    return m;
  }, [jobs]);
  const c = (s: JobStatus) => counts.get(s) ?? 0;
  const go = (s: JobStatus) => navigate(`/jobs?status=${s}`);
  const segActive = (from: JobStatus, to: JobStatus) =>
    IN_PROGRESS_STATUSES.includes(from) && IN_PROGRESS_STATUSES.includes(to) && c(from) + c(to) > 0;

  return (
    <div className="glass-panel p-5">
      <h3 className="text-[14px] font-semibold text-text-primary">状态流水线</h3>
      <p className="mt-0.5 text-[11px] text-text-muted">工单状态机实时计数 · 点击节点过滤</p>
      <div className="mt-5 flex items-start">
        {PRODUCTION.map((s, i) => (
          <div key={s} className="flex flex-1 items-start last:flex-none">
            <PipelineNode status={s} count={c(s)} delay={0.05 + i * 0.08} onClick={() => go(s)} />
            <FlowLine active={segActive(s, PRODUCTION[i + 1] ?? 'awaiting_human')} delay={0.1 + i * 0.08} />
          </div>
        ))}
        <PipelineNode status="awaiting_human" count={c('awaiting_human')} big delay={0.4} onClick={() => go('awaiting_human')} />
        <FlowLine active={c('publishing') > 0} delay={0.45} />
        <PipelineNode status="publishing" count={c('publishing')} delay={0.5} onClick={() => go('publishing')} />
        <FlowLine active={false} delay={0.55} />
        {/* terminal states, vertically stacked */}
        <div className="flex flex-col gap-2.5">
          {TERMINAL.map((s, i) => (
            <motion.button
              key={s}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 + i * 0.08, duration: 0.25 }}
              onClick={() => go(s)}
              className="flex items-center gap-2 rounded-full border px-2.5 py-1 transition-transform hover:scale-[1.03]"
              style={{
                borderColor: `color-mix(in srgb, ${STATUS_COLORS[s]} 35%, transparent)`,
                background: `color-mix(in srgb, ${STATUS_COLORS[s]} 9%, transparent)`,
              }}
            >
              <span className="font-grotesk text-[14px] font-semibold tabular-nums" style={{ color: STATUS_COLORS[s] }}>
                {c(s)}
              </span>
              <span className="text-[10.5px] text-text-secondary">{STATUS_LABELS[s]}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* S4 7-day trend area chart (hand-written SVG)                        */
/* ------------------------------------------------------------------ */

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y.toFixed(1)}`;
  }
  return d;
}

function TrendChart({ jobs }: { jobs: JobSummary[] }) {
  const days = useMemo(last7Days, []);
  const created = useMemo(() => bucketByDay(jobs, (j) => j.created_at), [jobs]);
  const published = useMemo(
    () => bucketByDay(jobs, (j) => (j.status === 'published' ? j.updated_at : null)),
    [jobs],
  );
  const [show, setShow] = useState({ created: true, published: true });
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 640;
  const H = 240;
  const PAD = { l: 34, r: 12, t: 14, b: 26 };
  const max = Math.max(...created, ...published, 4);
  const niceMax = Math.ceil(max / 4) * 4;

  const px = (i: number) => PAD.l + (i / 6) * (W - PAD.l - PAD.r);
  const py = (v: number) => PAD.t + (1 - v / niceMax) * (H - PAD.t - PAD.b);

  const mk = (arr: number[]) => arr.map((v, i) => ({ x: +px(i).toFixed(1), y: +py(v).toFixed(1) }));
  const createdPts = mk(created);
  const publishedPts = mk(published);
  const areaOf = (pts: { x: number; y: number }[]) =>
    `${smoothPath(pts)} L${pts[pts.length - 1].x},${H - PAD.b} L${pts[0].x},${H - PAD.b} Z`;

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < 7; i++) {
      const d = Math.abs(px(i) - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    setHover(best);
  };

  const legend = [
    { key: 'created' as const, label: '工单创建', color: '#7C5CFF' },
    { key: 'published' as const, label: '发布成功', color: '#22D3EE' },
  ];

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary">7 日趋势</h3>
          <p className="mt-0.5 text-[11px] text-text-muted">工单创建量 vs 发布成功量</p>
        </div>
        <div className="flex gap-2">
          {legend.map((l) => (
            <button
              key={l.key}
              onClick={() => setShow((s) => ({ ...s, [l.key]: !s[l.key] }))}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-opacity',
                show[l.key] ? 'border-border-subtle text-text-primary' : 'border-transparent text-text-muted opacity-50',
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="area-violet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="area-cyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* grid */}
          {Array.from({ length: 5 }).map((_, i) => {
            const v = (niceMax / 4) * i;
            const y = py(v);
            return (
              <g key={i}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 5" />
                <text x={PAD.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#565F73" fontFamily="JetBrains Mono">
                  {v}
                </text>
              </g>
            );
          })}

          {/* areas + lines */}
          {show.created && (
            <>
              <path d={areaOf(createdPts)} fill="url(#area-violet)">
                <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="0.8s" fill="freeze" />
              </path>
              <motion.path
                d={smoothPath(createdPts)}
                fill="none" stroke="#7C5CFF" strokeWidth="2" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </>
          )}
          {show.published && (
            <>
              <path d={areaOf(publishedPts)} fill="url(#area-cyan)">
                <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="1s" fill="freeze" />
              </path>
              <motion.path
                d={smoothPath(publishedPts)}
                fill="none" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }}
              />
            </>
          )}

          {/* x labels */}
          {days.map((d, i) => (
            <text
              key={d.key}
              x={px(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="9.5"
              fill={i === 6 ? '#8B94A7' : '#565F73'}
              fontFamily="JetBrains Mono"
            >
              {i === 6 ? '今天' : d.label}
            </text>
          ))}

          {/* hover crosshair */}
          {hover !== null && (
            <g>
              <line
                x1={px(hover)} x2={px(hover)} y1={PAD.t} y2={H - PAD.b}
                stroke="rgba(255,255,255,0.25)" strokeDasharray="2 3"
              />
              {show.created && <circle cx={px(hover)} cy={py(created[hover])} r="3.5" fill="#7C5CFF" stroke="#080A10" strokeWidth="1.5" />}
              {show.published && <circle cx={px(hover)} cy={py(published[hover])} r="3.5" fill="#22D3EE" stroke="#080A10" strokeWidth="1.5" />}
            </g>
          )}
        </svg>

        {/* tooltip */}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-[10px] border border-border-subtle bg-elevated/95 px-3 py-2 backdrop-blur"
            style={{ left: `${(px(hover) / W) * 100}%` }}
          >
            <div className="font-mono text-[10.5px] text-text-muted">{days[hover].key}</div>
            <div className="mt-1 flex flex-col gap-0.5 text-[11.5px]">
              {show.created && (
                <span className="flex items-center gap-1.5 text-text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-violet" />
                  创建 <b className="font-mono tabular-nums">{created[hover]}</b>
                </span>
              )}
              {show.published && (
                <span className="flex items-center gap-1.5 text-text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
                  发布 <b className="font-mono tabular-nums">{published[hover]}</b>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* S5 account health cards                                             */
/* ------------------------------------------------------------------ */

/** style accent derived from account persona (info.md: 小红书种草体 / 抖音文案体) */
function stylePlatform(a: AccountConfig): 'xhs' | 'douyin' {
  return a.name === 'geo-facts' ? 'douyin' : 'xhs';
}

function AccountHealthCard({
  account,
  jobs,
  delay,
  onTrigger,
}: {
  account: AccountConfig;
  jobs: JobSummary[];
  delay: number;
  onTrigger: (a: AccountConfig) => void;
}) {
  const mine = jobs.filter((j) => j.account_name === account.name);
  const publishedToday = mine.filter((j) => j.status === 'published' && isToday(j.updated_at)).length;
  const failing = mine.some((j) => j.status === 'alert' || (j.status === 'failed' && isToday(j.updated_at)));
  const daily = bucketByDay(mine, (j) => j.created_at);
  const sp = stylePlatform(account);

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="glass-panel p-4"
    >
      <div className="flex items-center gap-3">
        <AccountAvatar name={account.name} platform={sp} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-grotesk text-[14px] font-semibold text-text-primary">{account.name}</span>
            <PlatformIcon platform={sp} size={15} />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
            <span>{VERTICAL_LABELS[account.vertical]}</span>
            <span>·</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-px text-[10px] font-medium',
                account.human_review ? 'bg-status-awaiting/10 text-status-awaiting' : 'bg-accent-cyan/10 text-accent-cyan',
              )}
            >
              {account.human_review ? '人工审核' : '全自动发布'}
            </span>
            <span className={cn('flex items-center gap-1', failing ? 'text-status-failed' : 'text-status-published')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', failing ? 'bg-status-failed' : 'bg-status-published animate-dot-pulse')} />
              {failing ? '存在异常' : '正常运行'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-4 border-t border-border-subtle pt-3.5">
        <div className="flex flex-col items-center gap-1">
          <QuotaRing used={publishedToday} total={account.max_posts_per_day} size={54} />
          <span className="text-[10px] text-text-muted">今日配额</span>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div>
            <div className="text-[10px] text-text-muted">下次运行</div>
            <CronCountdown cron={account.cron} />
          </div>
          <div>
            <div className="mb-1 text-[10px] text-text-muted">近 7 天工单量</div>
            <Sparkline data={daily} width={120} height={18} color={sp === 'xhs' ? '#7C5CFF' : '#22D3EE'} />
          </div>
        </div>
        <button
          onClick={() => onTrigger(account)}
          className="self-end rounded-[10px] border border-border-subtle px-3 py-1.5 text-[12px] text-text-secondary transition-all hover:border-accent-violet/50 hover:text-text-primary hover:scale-[1.02] active:scale-[0.97]"
        >
          触发
        </button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* S6 latest jobs table                                                */
/* ------------------------------------------------------------------ */

function LatestJobsTable({ jobs, onOpen }: { jobs: JobSummary[]; onOpen: (id: string) => void }) {
  const copy = (id: string) => {
    void navigator.clipboard?.writeText(id).catch(() => undefined);
    toast.success('已复制 job_id', { description: id });
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4">
        <h3 className="text-[14px] font-semibold text-text-primary">最新工单</h3>
        <Link to="/jobs" className="text-[12px] text-accent-cyan transition-colors hover:text-text-primary">
          查看全部 →
        </Link>
      </div>
      {jobs.length === 0 ? (
        <EmptyState
          compact
          title="暂无工单"
          description="点击右上角「手动触发」立即发起一次内容生产"
        />
      ) : (
        <table className="mt-2 w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border-subtle text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-5 py-2.5 font-medium">状态</th>
              <th className="px-3 py-2.5 font-medium">job_id</th>
              <th className="px-3 py-2.5 font-medium">账号</th>
              <th className="px-3 py-2.5 font-medium">topic</th>
              <th className="px-3 py-2.5 font-medium">更新时间</th>
              <th className="px-5 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j, i) => (
              <motion.tr
                key={j.job_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className={cn(
                  'h-12 border-b border-border-subtle/60 transition-colors last:border-0 hover:bg-white/[0.03]',
                  j.status === 'failed' && 'border-l-2 border-l-status-failed',
                  j.status === 'awaiting_human' && 'border-l-2 border-l-status-awaiting',
                )}
              >
                <td className="px-5 py-2">
                  <StatusBadge status={j.status} size="sm" />
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => copy(j.job_id)}
                    className="group flex items-center gap-1 font-mono text-[11.5px] text-text-secondary transition-colors hover:text-accent-cyan"
                    title={`${j.job_id} · 点击复制`}
                  >
                    {j.job_id.slice(0, 7)}…
                    <Copy size={10} className="opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <AccountAvatar name={j.account_name} size={20} />
                    <span className="font-mono text-[11.5px] text-text-secondary">{j.account_name}</span>
                  </span>
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 text-text-primary" title={j.topic}>
                  {j.topic.length > 30 ? `${j.topic.slice(0, 30)}…` : j.topic}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-text-muted tabular-nums">{relTime(j.updated_at)}</td>
                <td className="px-5 py-2 text-right">
                  <button
                    onClick={() => onOpen(j.job_id)}
                    className="rounded-[8px] border border-border-subtle px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:border-accent-violet/50 hover:text-text-primary"
                  >
                    详情
                  </button>
                  {j.status === 'awaiting_human' && (
                    <Link
                      to="/review"
                      className="ml-2 rounded-[8px] border border-status-awaiting/40 bg-status-awaiting/10 px-2.5 py-1 text-[11px] text-status-awaiting transition-colors hover:bg-status-awaiting/20"
                    >
                      审核
                    </Link>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* S7 alerts & events feed                                             */
/* ------------------------------------------------------------------ */

interface FeedEvent {
  id: string;
  jobId: string;
  color: string;
  text: string;
  sub?: string;
  time: string;
  alert?: boolean;
}

function buildEvents(jobs: JobSummary[]): FeedEvent[] {
  const events: FeedEvent[] = [];
  for (const j of jobs) {
    if (j.status === 'failed' || j.status === 'alert') {
      events.push({
        id: `${j.job_id}-err`,
        jobId: j.job_id,
        color: j.status === 'alert' ? '#FB7185' : '#F87171',
        text: j.status === 'alert' ? `告警升级：${j.topic}` : `工单失败：${j.topic}`,
        sub: j.error ? (j.error.length > 34 ? `${j.error.slice(0, 34)}…` : j.error) : undefined,
        time: j.updated_at,
        alert: true,
      });
    } else if (j.status === 'awaiting_human') {
      events.push({
        id: `${j.job_id}-rev`,
        jobId: j.job_id,
        color: '#F59E0B',
        text: `进入人工审核：${j.topic}`,
        time: j.updated_at,
      });
    } else if (j.status === 'published') {
      events.push({
        id: `${j.job_id}-pub`,
        jobId: j.job_id,
        color: '#34D399',
        text: `发布成功：${j.topic}`,
        sub: j.job_id.startsWith('j-t') ? '手动触发' : undefined,
        time: j.updated_at,
      });
    } else if (j.retry_count > 0) {
      events.push({
        id: `${j.job_id}-retry`,
        jobId: j.job_id,
        color: '#8B94A7',
        text: `第 ${j.retry_count} 次重试：${j.topic}`,
        time: j.updated_at,
      });
    }
  }
  return events.sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 6);
}

function EventsFeed({ jobs, onOpen }: { jobs: JobSummary[]; onOpen: (id: string) => void }) {
  const events = useMemo(() => buildEvents(jobs), [jobs]);
  return (
    <div className="glass-panel flex h-full flex-col p-5">
      <h3 className="text-[14px] font-semibold text-text-primary">告警与事件流</h3>
      <div className="mt-4 flex-1">
        {events.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-text-muted">暂无事件 · 一切正常</p>
        ) : (
          <ol className="relative ml-1.5 border-l border-border-subtle pl-4">
            {events.map((e, i) => (
              <motion.li
                key={e.id}
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                className="relative pb-4 last:pb-0"
              >
                <span
                  className={cn('absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full', e.alert && 'animate-dot-pulse')}
                  style={{ background: e.color, boxShadow: `0 0 8px ${e.color}` }}
                />
                <p className="text-[12.5px] leading-snug text-text-primary">{e.text}</p>
                {e.sub && <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{e.sub}</p>}
                <div className="mt-1 flex items-center gap-2.5">
                  <span className="font-mono text-[10px] text-text-muted tabular-nums">{relTime(e.time)}</span>
                  {e.alert && (
                    <button
                      onClick={() => onOpen(e.jobId)}
                      className="text-[10.5px] text-accent-cyan hover:underline"
                    >
                      查看工单
                    </button>
                  )}
                </div>
              </motion.li>
            ))}
          </ol>
        )}
      </div>
      <Link to="/jobs" className="mt-3 border-t border-border-subtle pt-3 text-[12px] text-accent-cyan hover:text-text-primary">
        查看全部工单 →
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { data: jobs = [], isLoading } = useJobs({ limit: 100 });
  const { data: accounts = [] } = useAccounts();
  const navigate = useNavigate();
  const [drawerJob, setDrawerJob] = useState<string | null>(null);
  const [confirmAccount, setConfirmAccount] = useState<AccountConfig | null>(null);
  const trigger = useTriggerAccount();

  const publishedToday = jobs.filter((j) => j.status === 'published' && isToday(j.updated_at)).length;
  const publishedYesterday = jobs.filter((j) => j.status === 'published' && isYesterday(j.updated_at)).length;
  const inProgress = countByStatus(jobs, IN_PROGRESS_STATUSES);
  const awaiting = countByStatus(jobs, ['awaiting_human']);
  const weekPublished = countByStatus(jobs, ['published']);
  const weekFailed = countByStatus(jobs, ['failed']);
  const successRate = weekPublished + weekFailed > 0 ? (weekPublished / (weekPublished + weekFailed)) * 100 : 100;
  const failedToday = jobs.filter((j) => j.status === 'failed' && isToday(j.updated_at)).length;
  const alertCount = countByStatus(jobs, ['alert']) + failedToday;
  const healthy = alertCount === 0;

  const dailyRate = useMemo(() => {
    const days = last7Days();
    return days.map((d) => {
      const p = jobs.filter((j) => j.status === 'published' && +new Date(j.updated_at) >= d.start && +new Date(j.updated_at) < d.start + DAY).length;
      const f = jobs.filter((j) => j.status === 'failed' && +new Date(j.updated_at) >= d.start && +new Date(j.updated_at) < d.start + DAY).length;
      return p + f > 0 ? (p / (p + f)) * 100 : 0;
    });
  }, [jobs]);

  const fire = () => {
    if (!confirmAccount) return;
    const name = confirmAccount.name;
    trigger.mutate(name, {
      onSuccess: (r) => {
        setConfirmAccount(null);
        toast.success(`已触发 ${name}`, { description: `job_id: ${r.job_id}` });
      },
      onError: (e) => toast.error('触发失败', { description: e.message }),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <ErrorBanner />

      {/* S1 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader accounts={accounts} />
      </div>
      <div className="-mt-2 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]',
            healthy
              ? 'border-status-published/30 bg-status-published/10 text-status-published'
              : 'border-status-failed/30 bg-status-failed/10 text-status-failed',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', healthy ? 'bg-status-published animate-dot-pulse' : 'bg-status-failed')} />
          {healthy ? '矩阵运行正常' : `存在 ${alertCount} 条告警，需要关注`}
        </span>
      </div>

      {/* S2 KPI */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-[132px] rounded-[14px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            icon={<Send size={17} />}
            label="今日发布"
            value={publishedToday}
            delta={publishedToday - publishedYesterday}
            deltaLabel=" 较昨日"
            delay={0}
          />
          <StatCard
            icon={<Loader size={17} />}
            label="进行中"
            value={inProgress}
            delay={0.06}
            extra={
              <span className="flex items-center gap-1.5 text-[10.5px] text-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan animate-dot-pulse" />
                实时
              </span>
            }
          />
          <StatCard
            icon={<UserCheck size={17} />}
            label="待人工审核"
            value={awaiting}
            tone="amber"
            delay={0.12}
            extra={
              awaiting > 0 ? (
                <button
                  onClick={() => navigate('/review')}
                  className="text-[11px] text-status-awaiting transition-colors hover:text-text-primary"
                >
                  去处理 →
                </button>
              ) : undefined
            }
          />
          <StatCard
            icon={<TrendingUp size={17} />}
            label="发布成功率（近 7 日）"
            value={successRate}
            decimals={1}
            suffix="%"
            delay={0.18}
            extra={<Sparkline data={dailyRate} width={56} height={18} color="#7C5CFF" />}
          />
          <StatCard
            icon={<AlertTriangle size={17} />}
            label={alertCount > 0 ? '活跃告警' : '活跃告警 · 一切正常'}
            value={alertCount}
            tone={alertCount > 0 ? 'red' : 'default'}
            delay={0.24}
          />
        </div>
      )}

      {/* S3+S4 left / S5 right */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <StatusPipeline jobs={jobs} />
          <TrendChart jobs={jobs} />
        </div>
        <div className="flex flex-col gap-5 lg:col-span-4">
          {accounts.map((a, i) => (
            <AccountHealthCard key={a.name} account={a} jobs={jobs} delay={0.1 + i * 0.1} onTrigger={setConfirmAccount} />
          ))}
        </div>
      </div>

      {/* S6 left / S7 right */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <LatestJobsTable jobs={jobs.slice(0, 8)} onOpen={setDrawerJob} />
        </div>
        <div className="lg:col-span-4">
          <EventsFeed jobs={jobs} onOpen={setDrawerJob} />
        </div>
      </div>

      <JobDrawer jobId={drawerJob} onClose={() => setDrawerJob(null)} />
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
