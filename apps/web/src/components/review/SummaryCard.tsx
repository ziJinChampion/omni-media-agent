import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight, PartyPopper } from 'lucide-react';
import QuotaRing from '@/components/QuotaRing';

interface Props {
  approved: number;
  rejected: number;
}

/**
 * Completion card shown in the workspace once the queue is drained and at
 * least one job was processed this session (pass-rate ring + back link).
 */
export default function SummaryCard({ approved, rejected }: Props) {
  const total = approved + rejected;
  return (
    <motion.div
      className="glass-panel card-hairline mx-auto flex w-full max-w-[460px] flex-col items-center px-8 py-10 text-center"
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-status-published/12 text-status-published"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.15, 1] }}
        transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.1 }}
      >
        <PartyPopper size={22} />
      </motion.span>
      <h2 className="mt-4 font-grotesk text-[18px] font-bold text-text-primary">审核队列已清空</h2>
      <p className="mt-1.5 text-[13px] text-text-secondary">
        今日审核 <span className="font-mono font-semibold text-text-primary tabular-nums">{total}</span> 条 · 通过{' '}
        <span className="font-mono font-semibold text-status-published tabular-nums">{approved}</span> · 拒绝{' '}
        <span className="font-mono font-semibold text-status-failed tabular-nums">{rejected}</span>
      </p>

      <div className="mt-6 flex flex-col items-center gap-2">
        <QuotaRing used={approved} total={total} size={104} stroke={8} />
        <span className="text-[11px] text-text-muted">
          通过率{' '}
          <span className="font-mono text-text-secondary tabular-nums">
            {total > 0 ? Math.round((approved / total) * 100) : 0}%
          </span>
        </span>
      </div>

      <Link
        to="/dashboard"
        className="btn-primary-gradient mt-7 inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.97]"
      >
        返回 Dashboard
        <ArrowRight size={14} />
      </Link>
    </motion.div>
  );
}
