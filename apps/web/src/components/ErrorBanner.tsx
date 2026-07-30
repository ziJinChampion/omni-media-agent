import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff } from 'lucide-react';
import { useMockMode } from '@/lib/hooks';

/**
 * Amber banner shown when real API requests failed and the console silently
 * degraded to the built-in mock dataset.
 */
export default function ErrorBanner() {
  const isMock = useMockMode();
  return (
    <AnimatePresence>
      {isMock && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="mb-4 flex items-center gap-2.5 rounded-[10px] border border-status-awaiting/30 bg-status-awaiting/10 px-3.5 py-2.5 text-[12.5px] text-status-awaiting">
            <CloudOff size={15} className="shrink-0" />
            <span>
              后端 API 不可达，已切换至 <span className="font-semibold">Mock 数据模式</span>
              （数据为内置演示数据，操作不会写入真实后端）
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
