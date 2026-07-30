import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ExternalLink, FileText, Images, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useApproveJob, useJobDetail, useRejectJob } from '@/lib/hooks';
import { STATUS_COLORS, STATUS_LABELS, type JobDetail, type JobStatus } from '@/lib/types';
import StatusBadge from './StatusBadge';
import { RejectModal } from './Modals';

interface Props {
  /** job to display; null closes the drawer */
  jobId: string | null;
  onClose: () => void;
  /** optional callbacks after a successful mutation (e.g. advance review queue) */
  onApproved?: (jobId: string) => void;
  onRejected?: (jobId: string) => void;
}

const TIMELINE: JobStatus[] = ['pending', 'researching', 'drafting', 'reviewing', 'awaiting_human', 'publishing', 'published'];

function fmtTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{title}</h4>
      {children}
    </section>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 8 ? '#34D399' : value >= 6 ? '#F59E0B' : '#F87171';
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-[12px] text-text-secondary">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value * 10}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-[12px] tabular-nums" style={{ color }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function DrawerBody({ job }: { job: JobDetail }) {
  const reached = new Set(job.history.map((h) => h.status));
  const images = job.state.materials.filter((m) => m.kind === 'image');

  return (
    <div className="px-5 pb-24 pt-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-text-muted">{job.job_id}</div>
          <h3 className="mt-1 text-[16px] font-semibold leading-snug text-text-primary">{job.topic}</h3>
          <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-text-muted">
            <span>{job.account_name}</span>
            <span>·</span>
            <span>重试 {job.retry_count} 次</span>
            <span>·</span>
            <span>更新于 {fmtTime(job.updated_at)}</span>
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* error */}
      {job.error && (
        <div className="mt-4 rounded-[10px] border border-status-failed/30 bg-status-failed/10 px-3 py-2.5 text-[12px] leading-relaxed text-status-failed">
          {job.error}
        </div>
      )}

      {/* status machine timeline */}
      <Section title="状态机时间线">
        <ol className="relative ml-1.5 border-l border-border-subtle pl-4">
          {TIMELINE.map((st) => {
            const ev = job.history.find((h) => h.status === st);
            const active = job.status === st;
            const color = STATUS_COLORS[st];
            const done = reached.has(st);
            return (
              <li key={st} className="relative flex items-center justify-between py-1.5">
                <span
                  className="absolute -left-[21.5px] h-2.5 w-2.5 rounded-full border-2"
                  style={{
                    borderColor: done ? color : 'rgba(255,255,255,0.15)',
                    background: done ? color : 'transparent',
                    boxShadow: active ? `0 0 10px ${color}` : undefined,
                  }}
                />
                <span className={cn('text-[12.5px]', done ? 'text-text-primary' : 'text-text-muted')}>
                  {STATUS_LABELS[st]}
                </span>
                <span className="font-mono text-[10.5px] text-text-muted tabular-nums">
                  {ev ? fmtTime(ev.at) : '—'}
                </span>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* materials gallery */}
      {images.length > 0 && (
        <Section title={`素材画廊（${images.length}）`}>
          <div className="grid grid-cols-3 gap-2">
            {images.map((m) => (
              <figure key={m.url} className="group relative overflow-hidden rounded-[10px] border border-border-subtle">
                <img src={m.url} alt={m.caption} className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                <figcaption className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[10px] text-text-secondary backdrop-blur-sm">
                  {m.caption}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-text-muted">
            <Images size={11} />
            来源 {Array.from(new Set(images.map((m) => m.source))).join(' / ')} · 授权 {Array.from(new Set(images.map((m) => m.license))).join(' / ')}
          </div>
        </Section>
      )}

      {/* draft preview */}
      {job.state.draft && (
        <Section title="草稿预览">
          <div className="rounded-[12px] border border-border-subtle bg-glass p-3.5">
            <div className="flex items-center gap-1.5 text-[10.5px] text-text-muted">
              <FileText size={11} /> 标题（{job.state.draft.title.length}/20）
            </div>
            <p className="mt-1 text-[14px] font-semibold text-text-primary">{job.state.draft.title}</p>
            <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-text-secondary">{job.state.draft.body}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {job.state.draft.tags.map((t) => (
                <span key={t} className="rounded-full bg-accent-violet/10 px-2 py-0.5 text-[10.5px] text-accent-violet">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* judge scores */}
      {job.state.judge && (
        <Section title="AI 评审">
          <div className="rounded-[12px] border border-border-subtle bg-glass p-3.5">
            <div className="flex flex-col gap-2">
              <ScoreBar label="事实性" value={job.state.judge.accuracy} />
              <ScoreBar label="风格" value={job.state.judge.style} />
              <ScoreBar label="合规" value={job.state.judge.compliance} />
            </div>
            <p className="mt-3 border-t border-border-subtle pt-2.5 text-[12px] leading-relaxed text-text-secondary">
              {job.state.judge.feedback}
            </p>
            <span
              className={cn(
                'mt-2 inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-medium',
                job.state.judge.passed ? 'bg-status-published/10 text-status-published' : 'bg-status-failed/10 text-status-failed',
              )}
            >
              {job.state.judge.passed ? '评审通过' : '评审未通过'}
            </span>
          </div>
        </Section>
      )}

      {/* publish result */}
      {job.state.publish_result && (
        <Section title="发布结果">
          <div className="rounded-[12px] border border-border-subtle bg-glass p-3.5 text-[12.5px]">
            {job.state.publish_result.success ? (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-status-published">
                  <Check size={13} /> 发布成功
                </span>
                <span className="flex items-center gap-1 font-mono text-[11px] text-text-secondary">
                  {job.state.publish_result.platform_post_id}
                  <ExternalLink size={11} className="text-text-muted" />
                </span>
              </div>
            ) : (
              <span className="text-status-failed">发布失败：{job.state.publish_result.error}</span>
            )}
            {job.state.publish_result.published_at && (
              <div className="mt-1 font-mono text-[10.5px] text-text-muted">{fmtTime(job.state.publish_result.published_at)}</div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

/** 560px right-hand job detail drawer, reused by Jobs and Review pages. */
export default function JobDrawer({ jobId, onClose, onApproved, onRejected }: Props) {
  const { data: job, isLoading } = useJobDetail(jobId);
  const approve = useApproveJob();
  const reject = useRejectJob();
  const [rejectOpen, setRejectOpen] = useState(false);

  const doApprove = () => {
    if (!jobId) return;
    approve.mutate(jobId, {
      onSuccess: () => {
        toast.success(`已通过审核并进入发布队列`, { description: `job_id: ${jobId}` });
        onApproved?.(jobId);
      },
      onError: (e) => toast.error('操作失败', { description: e.message }),
    });
  };

  const doReject = (reason: string) => {
    if (!jobId) return;
    reject.mutate(
      { jobId, reason },
      {
        onSuccess: () => {
          setRejectOpen(false);
          toast.success('已拒绝该草稿', { description: `job_id: ${jobId}` });
          onRejected?.(jobId);
        },
        onError: (e) => toast.error('操作失败', { description: e.message }),
      },
    );
  };

  return (
    <>
      <AnimatePresence>
        {jobId && (
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
              className="fixed inset-y-0 right-0 z-[80] flex w-[560px] max-w-[92vw] flex-col border-l border-border-subtle bg-elevated shadow-2xl"
              initial={{ x: 560 }}
              animate={{ x: 0 }}
              exit={{ x: 560 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-5">
                <span className="font-grotesk text-[13px] font-semibold text-text-primary">工单详情</span>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-muted transition-colors hover:bg-glass hover:text-text-primary"
                  aria-label="关闭"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLoading || !job ? (
                  <div className="flex flex-col gap-3 p-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="skeleton-shimmer h-20 rounded-[12px]" />
                    ))}
                  </div>
                ) : (
                  <DrawerBody job={job} />
                )}
              </div>

              {/* action bar */}
              {job?.status === 'awaiting_human' && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2.5 border-t border-border-subtle bg-elevated/95 px-5 py-3.5 backdrop-blur">
                  <button
                    onClick={() => setRejectOpen(true)}
                    disabled={reject.isPending || approve.isPending}
                    className="rounded-[10px] border border-status-failed/40 bg-status-failed/10 px-4 py-2 text-[13px] font-medium text-status-failed transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
                  >
                    拒绝 (R)
                  </button>
                  <button
                    onClick={doApprove}
                    disabled={approve.isPending || reject.isPending}
                    className="btn-primary-gradient rounded-[10px] px-4 py-2 text-[13px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
                  >
                    {approve.isPending ? '提交中…' : '通过并发布 (A)'}
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <RejectModal
        open={rejectOpen}
        loading={reject.isPending}
        onSubmit={doReject}
        onCancel={() => setRejectOpen(false)}
      />
    </>
  );
}
