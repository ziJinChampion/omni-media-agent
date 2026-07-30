import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ChevronDown, FileText, History, Image as ImageIcon, ShieldCheck, X } from 'lucide-react';
import type { JobDetail, JudgeScore, Material } from '@/lib/types';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { fmtTime } from './helpers';

/* ------------------------------------------------------------------ */
/* accordion section (default expanded, height 300ms)                  */
/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  extra,
  children,
  stagger = 0,
}: {
  icon: ReactNode;
  title: string;
  extra?: ReactNode;
  children: ReactNode;
  stagger?: number;
}) {
  const [open, setOpen] = useState(true);
  return (
    <motion.section
      className="glass-panel overflow-hidden"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: stagger, ease: 'easeOut' }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-text-primary">
          <span className="text-accent-violet">{icon}</span>
          {title}
        </span>
        <span className="flex items-center gap-2">
          {extra}
          <ChevronDown
            size={14}
            className={cn('text-text-muted transition-transform duration-300', open && 'rotate-180')}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* 1. AI judge: verdict badge + 3 score bars + feedback quote          */
/* ------------------------------------------------------------------ */

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 8 ? '#34D399' : value >= 6 ? '#F59E0B' : '#F87171';
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[12px] text-text-secondary">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${value * 10}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[12px] tabular-nums" style={{ color }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function JudgeBlock({ judge }: { judge: JudgeScore }) {
  return (
    <div className="space-y-3">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold',
          judge.passed
            ? 'border-status-published/35 bg-status-published/10 text-status-published'
            : 'border-status-failed/40 bg-status-failed/10 text-status-failed',
        )}
      >
        <Bot size={13} />
        {judge.passed ? 'AI 建议通过' : 'AI 曾打回，此为修订稿'}
      </span>
      <div className="space-y-2">
        <ScoreBar label="准确性" value={judge.accuracy} />
        <ScoreBar label="风格匹配" value={judge.style} />
        <ScoreBar label="合规性" value={judge.compliance} />
      </div>
      {judge.feedback && (
        <blockquote className="rounded-r-[10px] border-l-[3px] border-accent-violet bg-glass px-3 py-2 text-[12px] italic leading-relaxed text-text-secondary">
          “{judge.feedback}”
        </blockquote>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. materials: source / license / caption + lightbox                 */
/* ------------------------------------------------------------------ */

function LicenseBadge({ license }: { license: string }) {
  const free = license.toUpperCase() === 'CC0';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-1.5 py-px font-mono text-[9.5px]',
        free
          ? 'border-status-published/35 bg-status-published/10 text-status-published'
          : 'border-status-awaiting/40 bg-status-awaiting/10 text-status-awaiting',
      )}
    >
      {license}
    </span>
  );
}

function MaterialRow({ m, onPreview }: { m: Material; onPreview: (url: string) => void }) {
  return (
    <li className="flex items-center gap-2.5 rounded-[10px] border border-border-subtle bg-glass px-2.5 py-2">
      {m.kind === 'image' ? (
        <button
          onClick={() => onPreview(m.url)}
          className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-[8px]"
          title="点击放大"
        >
          <img
            src={m.url}
            alt={m.caption}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110"
            loading="lazy"
            draggable={false}
          />
        </button>
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white/5 text-text-muted">
          <FileText size={15} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {m.kind === 'image' ? (
            <ImageIcon size={11} className="shrink-0 text-accent-cyan" />
          ) : (
            <FileText size={11} className="shrink-0 text-accent-violet" />
          )}
          <span className="truncate text-[11.5px] font-medium text-text-primary">{m.source}</span>
          <LicenseBadge license={m.license} />
        </div>
        <p className="mt-0.5 truncate text-[11px] text-text-muted" title={m.caption}>
          {m.caption}
        </p>
      </div>
      {m.kind === 'text' && (
        <a
          href={m.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[10.5px] text-accent-cyan hover:underline"
        >
          原文
        </a>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* 3. timeline: history events, revision nodes annotated               */
/* ------------------------------------------------------------------ */

function Timeline({ job }: { job: JobDetail }) {
  const seen = new Map<string, number>();
  return (
    <ol className="relative ml-1.5 space-y-3 border-l border-border-subtle pl-4">
      {job.history.map((ev, i) => {
        const n = (seen.get(ev.status) ?? 0) + 1;
        seen.set(ev.status, n);
        const revised = (ev.status === 'drafting' || ev.status === 'reviewing') && n > 1;
        const last = i === job.history.length - 1;
        const color = STATUS_COLORS[ev.status];
        return (
          <li key={`${ev.status}-${ev.at}-${i}`} className="relative">
            <span
              className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-void"
              style={{ background: color, boxShadow: last ? `0 0 10px ${color}` : undefined }}
            />
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-text-primary">
                {STATUS_LABELS[ev.status]}
                {revised && <span className="ml-1.5 text-[10.5px] text-status-reviewing">第 {n} 次修订</span>}
              </span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-muted">{fmtTime(ev.at)}</span>
            </div>
            {ev.note && <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{ev.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* panel                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  job: JobDetail | null;
  loading: boolean;
}

/**
 * S5 judge / materials / timeline accordion panel (all expanded by default).
 * Includes a spring-open image lightbox for copyright verification.
 */
export default function ReviewPanel({ job, loading }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (loading || !job) {
    return (
      <div className="w-full space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-shimmer h-28 rounded-[14px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <Section icon={<Bot size={14} />} title="AI 评审结论" stagger={0}>
        {job.state.judge ? (
          <JudgeBlock judge={job.state.judge} />
        ) : (
          <p className="text-[12px] text-text-muted">暂无评审记录</p>
        )}
      </Section>

      <Section
        icon={<ShieldCheck size={14} />}
        title="事实素材"
        extra={
          <span className="rounded-full border border-border-subtle px-1.5 py-px font-mono text-[9.5px] text-text-muted">
            {job.state.materials.length}
          </span>
        }
        stagger={0.06}
      >
        {job.state.materials.length > 0 ? (
          <ul className="space-y-2">
            {job.state.materials.map((m, i) => (
              <MaterialRow key={`${m.url}-${i}`} m={m} onPreview={setLightbox} />
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-text-muted">暂无素材记录</p>
        )}
      </Section>

      <Section icon={<History size={14} />} title="工单脉络" stagger={0.12}>
        <Timeline job={job} />
      </Section>

      {/* lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setLightbox(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="relative max-h-[85dvh] max-w-[85vw]"
            >
              <img
                src={lightbox}
                alt="素材预览"
                className="max-h-[85dvh] max-w-[85vw] rounded-[14px] object-contain shadow-2xl"
                draggable={false}
              />
              <button
                onClick={() => setLightbox(null)}
                className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle bg-elevated text-text-secondary transition-colors hover:text-text-primary"
                aria-label="关闭预览"
              >
                <X size={14} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
