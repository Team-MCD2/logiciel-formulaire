'use client';

import { useState, useEffect, useRef } from 'react';
import { getFailuresLogs } from '@/lib/actions';
import BlurFade from '@/components/magicui/blur-fade';
import { Activity, AlertTriangle, PlayCircle, PauseCircle } from 'lucide-react';

interface FailureLog {
  id: string;
  form_id: string | null;
  error_type: string;
  error_message: string;
  payload: any;
  created_at: string;
  forms: { name: string } | null;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<FailureLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await getFailuresLogs();
      if (res.success) {
        setLogs(res.data as any);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLogs();
  }, []);

  useEffect(() => {
    // Polling logic
    const intervalMs = isLive ? 1000 : 120000;
    
    intervalRef.current = setInterval(() => {
      fetchLogs(true);
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLive]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Logs & Échecs</h2>
          <p className="text-sm text-slate-500">Tracez les échecs SMTP, les déclenchements de Honeypot et les blocages Anti-Spam.</p>
        </div>
        
        <button
          onClick={() => setIsLive(!isLive)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            isLive 
              ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200' 
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-xs'
          }`}
        >
          {isLive ? <PauseCircle className="w-4 h-4 animate-pulse" /> : <PlayCircle className="w-4 h-4 text-emerald-500" />}
          {isLive ? 'Mode Live (1s)' : 'Polling (2m)'}
        </button>
      </div>

      <BlurFade delay={0.1}>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-900 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-6 py-4">Horodatage</th>
                  <th className="px-6 py-4">Type d'Erreur</th>
                  <th className="px-6 py-4">Formulaire</th>
                  <th className="px-6 py-4">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      Chargement des logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Activity className="w-8 h-8 mb-2 text-slate-300" />
                        Aucun échec enregistré.
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          log.error_type.includes('SMTP') ? 'bg-orange-100 text-orange-800' :
                          log.error_type.includes('SPAM') || log.error_type.includes('HONEYPOT') ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {log.error_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {log.forms?.name || <span className="text-slate-400 italic">Inconnu</span>}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono bg-slate-50 rounded mt-2 mb-2 p-2 max-w-md truncate">
                        {log.error_message}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
