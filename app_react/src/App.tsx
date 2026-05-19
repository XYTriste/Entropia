import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import DashboardView from '@/pages/DashboardView';
import BaseDataView from '@/pages/BaseDataView';
import SchedulerView from '@/pages/SchedulerView';
import ResultsView from '@/pages/ResultsView';
import AdjustmentsView from '@/pages/AdjustmentsView';
import TransferView from '@/pages/TransferView';
import ImportExportView from '@/pages/ImportExportView';
import AuditLogsView from '@/pages/AuditLogsView';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/base-data" element={<BaseDataView />} />
        <Route path="/scheduler" element={<SchedulerView />} />
        <Route path="/results" element={<ResultsView />} />
        <Route path="/adjustments" element={<AdjustmentsView />} />
        <Route path="/transfer" element={<TransferView />} />
        <Route path="/import-export" element={<ImportExportView />} />
        <Route path="/audit-logs" element={<AuditLogsView />} />
      </Route>
    </Routes>
  );
}

export default App;
