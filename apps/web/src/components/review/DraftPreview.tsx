import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, FileImage } from 'lucide-react';
import type { DraftContent, JobDetail, Platform } from '@/lib/types';
import { PLATFORM_LABELS } from '@/lib/types';
import PlatformIcon from '@/components/PlatformIcon';
import { cn } from '@/lib/utils';

export type FlashKind = 'approved' | 'rejected';

interface Props {
  /** the currently selected job (detail already fetched) */
  job: JobDetail | null;
  loading: boolean;
  platform: Platform;
  /** brief success overlay (green check / red flash) before the card slides out */
  flash: FlashKind | null;
  /** direction the preview exits when the selection advances */
  exitKind: FlashKind | null;
}

function useCarousel(count: number) {
  const [index, setIndex] = useState(0);
  const clamped = count > 0 ? Math.min(index, count - 1) : 0;
  return {
    index: clamped,
    prev: () => setIndex((i) => (count ? (i - 1 + count) % count : 0)),
    next: () => setIndex((i) => (count ? (i + 1) % count : 0)),
  };
}

function CarouselArrows({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  const btn =
    'absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-black/65 group-hover:opacity-100';
  return (
    <>
      <button aria-label="上一张" className={cn(btn, 'left-2')} onClick={onPrev}>
        <ChevronLeft size={16} />
      </button>
      <button aria-label="下一张" className={cn(btn, 'right-2')} onClick={onNext}>
        <ChevronRight size={16} />
      </button>
    </>
  );
}

/** 小红书 skin: bright rounded card floating on the dark workspace. */
function XhsCard({ draft }: { draft: DraftContent }) {
  const { index, prev, next } = useCarousel(draft.image_urls.length);
  return (
    <div className="group w-full max-w-[400px] overflow-hidden rounded-[16px] bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)]">
      <div className="relative aspect-square bg-neutral-100">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={draft.image_urls[index] ?? index}
            src={draft.image_urls[index]}
            alt={`草稿图片 ${index + 1}`}
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            draggable={false}
          />
        </AnimatePresence>
        {draft.image_urls.length > 1 && (
          <>
            <CarouselArrows onPrev={prev} onNext={next} />
            <div className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {draft.image_urls.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === index ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50',
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="px-4 py-3.5">
        <h3 className="text-[15px] font-bold leading-snug text-neutral-900">{draft.title}</h3>
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">{draft.body}</p>
        {draft.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1">
            {draft.tags.map((t) => (
              <span key={t} className="text-[12.5px] font-medium text-[#FF2442]">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 抖音 skin: 9:16 dark card, full-bleed image with bottom gradient overlay. */
function DouyinCard({ draft }: { draft: DraftContent }) {
  const { index, prev, next } = useCarousel(draft.image_urls.length);
  return (
    <div className="group relative aspect-[9/16] max-h-[560px] w-full max-w-[315px] overflow-hidden rounded-[16px] bg-black shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.img
          key={draft.image_urls[index] ?? index}
          src={draft.image_urls[index]}
          alt={`草稿图片 ${index + 1}`}
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          draggable={false}
        />
      </AnimatePresence>
      {draft.image_urls.length > 1 && (
        <>
          <CarouselArrows onPrev={prev} onNext={next} />
          <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1.5">
            {draft.image_urls.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'w-1.5 rounded-full transition-all duration-200',
                  i === index ? 'h-3.5 bg-white' : 'h-1.5 bg-white/50',
                )}
              />
            ))}
          </div>
        </>
      )}
      {/* bottom gradient scrim + white overlay copy */}
      <div
        className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-16"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.82) 78%)' }}
      >
        <h3 className="text-[15px] font-bold leading-snug text-white">{draft.title}</h3>
        <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[12.5px] leading-relaxed text-white/85">
          {draft.body}
        </p>
        {draft.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
            {draft.tags.map((t) => (
              <span key={t} className="text-[12px] font-medium text-[#00F2EA]">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * S4 platform-skinned draft preview. Skin is decided by the account platform
 * (mock falls back to the 小红书 skin). Crossfades on job switch; on action
 * success shows a green-check / red-flash overlay, then slides out.
 */
export default function DraftPreview({ job, loading, platform, flash, exitKind }: Props) {
  const skin: 'xhs' | 'douyin' = platform === 'douyin' ? 'douyin' : 'xhs';
  const draft = job?.state.draft ?? null;
  const titleLen = draft?.title.length ?? 0;
  const titleOk = titleLen <= 20;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* preview header: skin indicator + title length guard badge */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={platform} size={18} />
          <span className="text-[13px] font-medium text-text-secondary">
            {skin === 'douyin' ? '抖音预览' : '小红书预览'}
          </span>
          {platform === 'mock' && (
            <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[10px] text-text-muted">
              {PLATFORM_LABELS[platform]} 平台 · 套用小红书皮肤
            </span>
          )}
        </div>
        {draft && (
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 font-mono text-[10.5px] tabular-nums',
              titleOk
                ? 'border-status-published/30 bg-status-published/10 text-status-published'
                : 'border-status-failed/40 bg-status-failed/10 text-status-failed',
            )}
            title={titleOk ? '标题字数合规' : '标题超过 20 字上限'}
          >
            标题 {titleLen}/20
          </span>
        )}
      </div>

      {/* preview body: crossfade + slight scale on job switch; slide-out on action */}
      <div className="relative flex flex-1 items-start justify-center overflow-hidden rounded-[14px] py-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={job?.job_id ?? 'empty'}
            className="relative flex w-full justify-center"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={
              exitKind === 'approved'
                ? { opacity: 0, x: 90, y: -46, transition: { duration: 0.35, ease: 'easeIn' } }
                : exitKind === 'rejected'
                  ? { opacity: 0, x: -90, y: 46, transition: { duration: 0.35, ease: 'easeIn' } }
                  : { opacity: 0, scale: 0.98, transition: { duration: 0.18 } }
            }
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {loading ? (
              <div className="skeleton-shimmer aspect-square w-full max-w-[400px] rounded-[16px]" />
            ) : draft ? (
              skin === 'douyin' ? (
                <DouyinCard draft={draft} />
              ) : (
                <XhsCard draft={draft} />
              )
            ) : (
              <div className="glass-panel flex w-full max-w-[400px] flex-col items-center gap-2 px-6 py-12 text-center">
                <FileImage size={22} className="text-text-muted" />
                <p className="text-[13px] text-text-secondary">该工单暂无草稿内容</p>
                <p className="text-[11px] text-text-muted">草稿生成后将按平台样式渲染于此</p>
              </div>
            )}

            {/* success overlay: green check spring / red edge flash */}
            <AnimatePresence>
              {flash && (
                <motion.div
                  key="flash"
                  className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-[16px]"
                    initial={{
                      boxShadow:
                        flash === 'approved'
                          ? 'inset 0 0 0 0 rgba(52,211,153,0)'
                          : 'inset 0 0 0 0 rgba(248,113,113,0)',
                    }}
                    animate={{
                      boxShadow:
                        flash === 'approved'
                          ? [
                              'inset 0 0 0 0 rgba(52,211,153,0)',
                              'inset 0 0 0 3px rgba(52,211,153,0.95)',
                              'inset 0 0 24px 2px rgba(52,211,153,0.4)',
                            ]
                          : [
                              'inset 0 0 0 0 rgba(248,113,113,0)',
                              'inset 0 0 0 3px rgba(248,113,113,0.95)',
                              'inset 0 0 24px 2px rgba(248,113,113,0.4)',
                            ],
                    }}
                    transition={{ duration: 0.5 }}
                  />
                  {flash === 'approved' && (
                    <motion.span
                      className="relative mt-6 flex h-11 w-11 items-center justify-center rounded-full bg-status-published text-void shadow-[0_0_28px_rgba(52,211,153,0.55)]"
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ type: 'spring', stiffness: 420, damping: 17 }}
                    >
                      <Check size={22} strokeWidth={3} />
                    </motion.span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
