import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAccounts,
  useApproveJob,
  useJobDetail,
  useJobs,
  useRejectJob,
} from '@/lib/hooks';
import type { JobSummary, Platform } from '@/lib/types';
import { PLATFORM_LABELS } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import { RejectModal } from '@/components/Modals';
import QueueCard from '@/components/review/QueueCard';
import DraftPreview, { type FlashKind } from '@/components/review/DraftPreview';
import ReviewPanel from '@/components/review/ReviewPanel';
import ActionBar from '@/components/review/ActionBar';
import SummaryCard from '@/components/review/SummaryCard';

/** workbench columns height: viewport minus topbar/main padding/page header */
const WORKBENCH_H = 'calc(100dvh - 224px)';

const byCreatedAsc = (a: JobSummary, b: JobSummary) => +new Date(a.created_at) - +new Date(b.created_at);

const errStatus = (e: unknown): number | undefined => (e as { status?: number } | null)?.status;

/**
 * Review 审核队列 — dual-pane human review workbench.
 * Left: awaiting_human queue (FIFO, wait timers, ←/→ navigation).
 * Right: platform-skinned draft preview + AI judge / materials / timeline
 * panel + sticky action bar (A approve / R reject, 409-aware).
 * `?focus=<job_id>` deep-links a job (read-only when no longer awaiting).
 */
export default function Review() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusParam = searchParams.get('focus');

  /* ---------------- data ---------------- */
  const { data: jobs } = useJobs({ status: 'awaiting_human' });
  const { data: accounts } = useAccounts();
  const approve = useApproveJob();
  const reject = useRejectJob();

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(() => focusParam);
  const [flash, setFlash] = useState<FlashKind | null>(null);
  const [exitKind, setExitKind] = useState<FlashKind | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [pressed, setPressed] = useState<'a' | 'r' | null>(null);
  const [processed, setProcessed] = useState({ approved: 0, rejected: 0 });
  const [now, setNow] = useState(() => Date.now());

  const detailQuery = useJobDetail(selectedId);
  const detail = detailQuery.data ?? null;

  const platformOf = useCallback(
    (accountName: string): Platform =>
      accounts?.find((a) => a.name === accountName)?.platform ?? 'mock',
    [accounts],
  );

  /** FIFO queue, minus cards collapsing out after an action */
  const queue = useMemo(
    () => (jobs ?? []).filter((j) => !hiddenIds.has(j.job_id)).sort(byCreatedAsc),
    [jobs, hiddenIds],
  );

  /* ---------------- refs for the keyboard listener ---------------- */
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const busy = approve.isPending || reject.isPending || !!flash;
  const canAct = !!detail && detail.status === 'awaiting_human' && !busy && !rejectOpen;
  const canActRef = useRef(canAct);
  canActRef.current = canAct;

  /* ---------------- selection helpers ---------------- */
  const selectJob = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      setSearchParams(id ? { focus: id } : {}, { replace: true });
    },
    [setSearchParams],
  );
  const selectJobRef = useRef(selectJob);
  selectJobRef.current = selectJob;

  // external navigation with ?focus= (e.g. from Dashboard / Jobs)
  useEffect(() => {
    if (focusParam && focusParam !== selectedIdRef.current) setSelectedId(focusParam);
  }, [focusParam]);

  // default to the first queue card; drop selection when it vanished
  useEffect(() => {
    if (!jobs) return;
    if (selectedId && !queue.some((j) => j.job_id === selectedId)) {
      // keep read-only detail mode for a focus job that left the queue
      if (focusParam === selectedId) return;
      const next = queue[0] ?? null;
      setSelectedId(next ? next.job_id : null);
    } else if (!selectedId && queue.length > 0) {
      setSelectedId(queue[0].job_id);
    }
  }, [jobs, queue, selectedId, focusParam]);

  // hidden cards can be forgotten once the server data dropped the job
  useEffect(() => {
    if (!jobs) return;
    setHiddenIds((prev) => {
      const alive = new Set(jobs.map((j) => j.job_id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [jobs]);

  // detect jobs that newly entered the queue (slide-in + amber flash)
  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!jobs) return;
    const ids = jobs.map((j) => j.job_id);
    if (seenRef.current === null) {
      seenRef.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seenRef.current!.has(id));
    seenRef.current = new Set(ids);
    if (fresh.length === 0) return;
    setNewIds((prev) => new Set([...prev, ...fresh]));
    const t = setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        fresh.forEach((id) => next.delete(id));
        return next;
      });
    }, 1400);
    return () => clearTimeout(t);
  }, [jobs]);

  // wait-time ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ---------------- actions ---------------- */
  /** collapse the card out of the queue and auto-select the next one */
  const advanceAfter = useCallback(
    (id: string) => {
      const visible = queueRef.current;
      const idx = visible.findIndex((j) => j.job_id === id);
      const next = visible[idx + 1] ?? visible[idx - 1] ?? null;
      setHiddenIds((prev) => new Set(prev).add(id));
      setFlash(null);
      if (selectedIdRef.current === id) selectJobRef.current(next ? next.job_id : null);
      const t = setTimeout(() => setExitKind(null), 450);
      return () => clearTimeout(t);
    },
    [],
  );

  const handleActionError = useCallback(
    (e: unknown, id: string) => {
      if (errStatus(e) === 409) {
        toast.error('该工单状态已变化', { description: `job_id: ${id} · 已从队列移除` });
        setRejectOpen(false);
        setFlash(null);
        advanceAfter(id);
      } else {
        toast.error('操作失败，请重试', { description: e instanceof Error ? e.message : String(e) });
      }
    },
    [advanceAfter],
  );

  const doApprove = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id || !canActRef.current) return;
    const platform = platformOf(detail?.account_name ?? '');
    approve.mutate(id, {
      onSuccess: () => {
        setProcessed((p) => ({ ...p, approved: p.approved + 1 }));
        setExitKind('approved');
        setFlash('approved');
        toast.success(`已发布至 ${PLATFORM_LABELS[platform]}`, { description: `job_id: ${id}` });
        setTimeout(() => advanceAfter(id), 550);
      },
      onError: (e) => handleActionError(e, id),
    });
  }, [approve, detail, platformOf, advanceAfter, handleActionError]);
  const doApproveRef = useRef(doApprove);
  doApproveRef.current = doApprove;

  const doReject = useCallback(
    (reason: string) => {
      const id = selectedIdRef.current;
      if (!id) return;
      reject.mutate(
        { jobId: id, reason },
        {
          onSuccess: () => {
            setRejectOpen(false);
            setProcessed((p) => ({ ...p, rejected: p.rejected + 1 }));
            setExitKind('rejected');
            setFlash('rejected');
            toast.success('已拒绝并归档', { description: `job_id: ${id}` });
            setTimeout(() => advanceAfter(id), 550);
          },
          onError: (e) => handleActionError(e, id),
        },
      );
    },
    [reject, advanceAfter, handleActionError],
  );

  /* ---------------- keyboard: A / R / ← → ---------------- */
  useEffect(() => {
    const pressFeedback = (k: 'a' | 'r') => {
      setPressed(k);
      setTimeout(() => setPressed(null), 120);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
        return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const q = queueRef.current;
        if (q.length === 0) return;
        e.preventDefault();
        const idx = Math.max(0, q.findIndex((j) => j.job_id === selectedIdRef.current));
        const next = e.key === 'ArrowRight' ? Math.min(idx + 1, q.length - 1) : Math.max(idx - 1, 0);
        if (q[next] && q[next].job_id !== selectedIdRef.current) selectJobRef.current(q[next].job_id);
        return;
      }
      if (!canActRef.current) return;
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        pressFeedback('a');
        doApproveRef.current();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        pressFeedback('r');
        setRejectOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------------- derived view state ---------------- */
  const done = processed.approved + processed.rejected;
  const totalToday = done + queue.length;
  const pct = totalToday > 0 ? Math.round((done / totalToday) * 100) : 0;
  const selectedIndex = queue.findIndex((j) => j.job_id === selectedId);
  const selectedPlatform = detail ? platformOf(detail.account_name) : 'mock';
  const readonlyFocus =
    !!selectedId && queue.length === 0 && !!detail && detail.status !== 'awaiting_human';
  const showWorkspace = queue.length > 0 || readonlyFocus;

  return (
    <div>
      {/* ---------------- S1 header ---------------- */}
      <motion.div
        className="flex flex-wrap items-center gap-x-6 gap-y-3"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="font-grotesk text-[22px] font-bold tracking-tight text-text-primary">审核队列</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-status-awaiting/35 bg-status-awaiting/10 px-2.5 py-[3px] text-[11.5px] font-medium text-status-awaiting shadow-glow-amber">
            <span className="h-1.5 w-1.5 rounded-full bg-status-awaiting" />
            {queue.length} 条待审核
          </span>
        </div>

        {/* progress: processed today / total, bar grows per action */}
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-text-secondary">
            今日已处理{' '}
            <span className="font-mono font-medium text-text-primary tabular-nums">
              {done}/{totalToday}
            </span>
          </span>
          <div className="h-1.5 w-36 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg,#22D3EE,#7C5CFF)',
              }}
            />
          </div>
          <AnimatePresence>
            {queue.length === 0 && done > 0 && (
              <motion.span
                key="done-check"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-status-published text-void"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.25, 1] }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 460, damping: 15 }}
              >
                <Check size={12} strokeWidth={3.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* keyboard hints */}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <kbd>A</kbd> 通过
          </span>
          <span className="flex items-center gap-1.5">
            <kbd>R</kbd> 拒绝
          </span>
          <span className="flex items-center gap-1.5">
            <kbd>←</kbd>
            <kbd>→</kbd> 切换工单
          </span>
        </div>
      </motion.div>

      {/* ---------------- workbench ---------------- */}
      <div className="mt-5 flex items-start gap-5">
        {/* S2 queue (left, 320px, independent scroll) */}
        <aside
          className="w-[320px] shrink-0 overflow-y-auto pr-1"
          style={{ height: WORKBENCH_H, minHeight: 420 }}
        >
          {!jobs ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-shimmer h-[88px] rounded-[12px]" />
              ))}
            </div>
          ) : queue.length > 0 ? (
            <AnimatePresence initial={false}>
              {queue.map((job, i) => (
                <QueueCard
                  key={job.job_id}
                  job={job}
                  platform={platformOf(job.account_name)}
                  selected={job.job_id === selectedId}
                  isNew={newIds.has(job.job_id)}
                  now={now}
                  index={i}
                  onSelect={selectJob}
                />
              ))}
            </AnimatePresence>
          ) : (
            <EmptyState compact title="队列已清空" description="新的待审工单将进入此队列" />
          )}
        </aside>

        {/* S3 workspace (right) */}
        <section
          className="min-w-0 flex-1 overflow-y-auto pl-1"
          style={{ height: WORKBENCH_H, minHeight: 420 }}
        >
          {!showWorkspace ? (
            <div className="flex h-full items-center justify-center">
              {done > 0 ? (
                <SummaryCard approved={processed.approved} rejected={processed.rejected} />
              ) : (
                <EmptyState
                  title="队列已清空，矩阵全速运转中 🎉"
                  description="所有待人工审核的工单均已处理完毕，新工单到达时会自动出现在左侧队列。"
                />
              )}
            </div>
          ) : (
            <div className="flex min-h-full flex-col">
              {detailQuery.isError ? (
                <EmptyState
                  compact
                  title="未找到该工单"
                  description="它可能已被处理或移除，请从左侧队列选择其他工单。"
                />
              ) : (
                <div className="flex flex-1 flex-col gap-5 px-1 pb-2 xl:flex-row">
                  {/* S4 platform-skinned draft preview (55%) */}
                  <DraftPreview
                    job={detail}
                    loading={detailQuery.isLoading}
                    platform={selectedPlatform}
                    flash={flash}
                    exitKind={exitKind}
                  />
                  {/* S5 judge / materials / timeline (45%) */}
                  <div className="w-full shrink-0 xl:w-[45%] xl:max-w-[520px]">
                    <ReviewPanel job={detail} loading={detailQuery.isLoading} />
                  </div>
                </div>
              )}

              {/* S6 sticky action bar */}
              <ActionBar
                job={detail}
                index={selectedIndex + 1}
                total={queue.length}
                busy={busy}
                pressed={pressed}
                onApprove={doApprove}
                onReject={() => setRejectOpen(true)}
              />
            </div>
          )}
        </section>
      </div>

      <RejectModal
        open={rejectOpen}
        loading={reject.isPending}
        onSubmit={doReject}
        onCancel={() => setRejectOpen(false)}
      />
    </div>
  );
}
