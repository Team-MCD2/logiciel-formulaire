'use client';

import { Sidebar } from '@/components/admin/Sidebar';
import { useAntiScraping } from '@/lib/useAntiScraping';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce anti-inspection scripts in production for the entire admin section
  useAntiScraping();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
