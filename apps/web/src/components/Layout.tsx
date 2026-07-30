import { Outlet, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/**
 * App shell: fixed-width sidebar + sticky topbar + content slot.
 * Layout-route pattern — App.tsx MUST nest all pages under
 * `<Route element={<Layout/>}>`. Content area needs no offset bookkeeping.
 */
export default function Layout() {
  const location = useLocation();
  return (
    <div className="flex min-h-[100dvh]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-8 py-6">
          <div className="mx-auto max-w-[1440px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
