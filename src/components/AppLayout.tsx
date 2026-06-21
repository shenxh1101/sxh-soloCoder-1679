import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.js';
import TopBar from './TopBar.js';
import Toaster from './Toaster.js';
import { useAppStore } from '../store/appStore.js';
import { Loader2 } from 'lucide-react';

interface Props { title: string; subtitle?: string; }

export default function AppLayout({ title, subtitle }: Props) {
  const loading = useAppStore((s) => s.loading);
  return (
    <div className="flex h-screen overflow-hidden bg-bg-page">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-6 animate-stagger">
          <Outlet />
        </main>
      </div>
      <Toaster />
      {loading && (
        <div className="fixed inset-0 z-[9998] bg-white/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-card shadow-cardHover px-6 py-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-accent-500 animate-spin" />
            <span className="text-sm font-medium text-primary-700">加载中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
