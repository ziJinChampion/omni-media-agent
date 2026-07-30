import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ConfirmProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 6 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="relative w-full max-w-[420px] rounded-[18px] border border-border-subtle bg-elevated p-5 shadow-2xl"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Generic confirm dialog (trigger confirmation etc.). */
export function ConfirmModal({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <AnimatePresence>
      {open && (
        <ModalShell onClose={onCancel}>
          <h3 className="font-grotesk text-[15px] font-semibold text-text-primary">{title}</h3>
          {description && <div className="mt-2 text-[13px] leading-relaxed text-text-secondary">{description}</div>}
          <div className="mt-5 flex justify-end gap-2.5">
            <button
              onClick={onCancel}
              className="rounded-[10px] border border-border-subtle px-3.5 py-1.5 text-[13px] text-text-secondary transition-colors hover:bg-glass"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                'rounded-[10px] px-3.5 py-1.5 text-[13px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50',
                danger ? 'bg-status-failed/90' : 'btn-primary-gradient',
              )}
            >
              {loading ? '处理中…' : confirmText}
            </button>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}

const QUICK_REASONS = ['事实性错误', '风格不符', '图片质量差', '合规风险'];

interface RejectProps {
  open: boolean;
  loading?: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}

/** Reject dialog with reason textarea + quick-reason chips (Review flow). */
export function RejectModal({ open, loading, onSubmit, onCancel }: RejectProps) {
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    onCancel();
  };

  return (
    <AnimatePresence>
      {open && (
        <ModalShell onClose={close}>
          <h3 className="font-grotesk text-[15px] font-semibold text-text-primary">拒绝该草稿</h3>
          <p className="mt-1 text-[12px] text-text-muted">拒绝原因将记录到工单 error 字段，供运营复盘。</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason((cur) => (cur ? `${cur}；${r}` : r))}
                className="rounded-full border border-border-subtle bg-glass px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:border-accent-violet/50 hover:text-text-primary"
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="补充说明（可选）…"
            className="mt-3 w-full resize-none rounded-[10px] border border-border-subtle bg-glass px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted focus:border-accent-violet/60 focus:outline-none focus:ring-2 focus:ring-accent-violet-glow"
          />
          <div className="mt-4 flex justify-end gap-2.5">
            <button
              onClick={close}
              className="rounded-[10px] border border-border-subtle px-3.5 py-1.5 text-[13px] text-text-secondary transition-colors hover:bg-glass"
            >
              取消
            </button>
            <button
              onClick={() => onSubmit(reason)}
              disabled={loading}
              className="rounded-[10px] bg-status-failed/90 px-3.5 py-1.5 text-[13px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
            >
              {loading ? '提交中…' : '确认拒绝'}
            </button>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}
