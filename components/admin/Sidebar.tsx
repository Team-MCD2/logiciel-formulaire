'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, FileText, Users, ShieldAlert, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Formulaires', href: '/admin/forms', icon: FileText },
    { name: 'Clients', href: '/admin/clients', icon: Users },
    { name: 'Logs & Échecs', href: '/admin/logs', icon: ShieldAlert },
    { name: 'Blacklist', href: '/admin/blacklist', icon: ShieldAlert },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-100 bg-white px-4 py-6">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-base shadow-sm">
          M
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 leading-none">mwcrea</h1>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Form Service</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-8 flex-1 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-100 pt-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-4.5 w-4.5" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
