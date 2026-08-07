import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { Dashboard } from '@/pages/Dashboard';
import { AssetsList } from '@/pages/AssetsList';
import { AssetDetail } from '@/pages/AssetDetail';
import { Documents } from '@/pages/Documents';
import { DocumentDetail } from '@/pages/DocumentDetail';
import { Drawings } from '@/pages/Drawings';
import { Copilot } from '@/pages/Copilot';
import { Maintenance } from '@/pages/Maintenance';
import { Compliance } from '@/pages/Compliance';
import { KnowledgeGraph } from '@/pages/KnowledgeGraph';
import { Alerts } from '@/pages/Alerts';
import { Settings } from '@/pages/Settings';
import { QMS } from '@/pages/QMS';
import { RagSearch } from '@/pages/RagSearch';
import { Memory } from '@/pages/Memory';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <div className="hidden lg:block shrink-0">
          <Sidebar />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/assets" element={<AssetsList />} />
              <Route path="/assets/:assetId" element={<AssetDetail />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/documents/:documentId" element={<DocumentDetail />} />
              <Route path="/drawings" element={<Drawings />} />
              <Route path="/copilot" element={<Copilot />} />
              <Route path="/rag-search" element={<RagSearch />} />
              <Route path="/memory" element={<Memory />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/qms" element={<QMS />} />
              <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
