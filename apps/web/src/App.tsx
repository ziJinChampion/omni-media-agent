import { Routes, Route, Navigate } from 'react-router';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Accounts from '@/pages/Accounts';
import Jobs from '@/pages/Jobs';
import Review from '@/pages/Review';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="review" element={<Review />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
