'use client';

import { useState, useEffect } from 'react';
import { Eye, FileText, Download } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getSubmissions } from '@/lib/actions';

interface Submission {
  id: string;
  form_id: string;
  payload: Record<string, string>;
  ip_address: string;
  fingerprint: string;
  created_at: string;
  forms: {
    name: string;
  } | null;
}

function formatPayloadPreview(payload: Record<string, string>): string {
  if (!payload || Object.keys(payload).length === 0) return 'Aucune donnée';
  
  const entries = Object.entries(payload)
    .filter(([k]) => k !== '_gotcha')
    .slice(0, 3)
    .map(([k, v]) => {
      const valStr = String(v);
      const truncatedVal = valStr.length > 25 ? valStr.substring(0, 25) + '...' : valStr;
      return `${k}: ${truncatedVal}`;
    });
    
  let preview = entries.join(', ');
  if (Object.keys(payload).length > 3) {
    preview += ' ...';
  }
  return preview;
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function loadSubmissions() {
    try {
      const data = await getSubmissions();
      setSubmissions((data as unknown as Submission[]) || []);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleExportCSV = () => {
    if (submissions.length === 0) return;
    
    const allKeys = new Set<string>();
    submissions.forEach(sub => Object.keys(sub.payload).forEach(k => allKeys.add(k)));
    const keysArray = Array.from(allKeys).filter(k => k !== '_gotcha');
    
    const headers = ['Date', 'Formulaire', 'IP', ...keysArray];
    
    const rows = submissions.map(sub => {
      const date = new Date(sub.created_at).toLocaleString('fr-FR');
      const formName = sub.forms ? sub.forms.name : 'Inconnu';
      const ip = sub.ip_address || '';
      
      const payloadCols = keysArray.map(key => {
        let val = sub.payload[key] || '';
        val = String(val).replace(/"/g, '""');
        // Remove newlines to keep CSV structure clean
        val = val.replace(/\n/g, ' '); 
        return `"${val}"`;
      });
      
      return `"${date}","${formName}","${ip}",${payloadCols.join(',')}`;
    });
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Leads / Soumissions</h2>
          <p className="text-sm text-slate-500">Historique complet des messages reçus via l&apos;ensemble de vos formulaires.</p>
        </div>
        <Button 
          onClick={handleExportCSV} 
          disabled={submissions.length === 0}
          className="flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800"
        >
          <Download className="w-4 h-4" />
          Exporter en CSV
        </Button>
      </div>

      {/* Leads Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs">
        {submissions.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <FileText className="h-10 w-10 text-slate-300" />
            <span className="text-sm font-medium text-slate-400 mt-2">Aucun lead reçu.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-500">
              <thead className="bg-slate-50 text-xs font-bold text-slate-700 uppercase border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Formulaire</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Aperçu des données</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                      {new Date(sub.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-slate-800">
                      {sub.forms ? sub.forms.name : 'Inconnu'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs">{sub.ip_address}</td>
                    <td className="px-4 py-3.5 max-w-[300px] truncate text-xs text-slate-700 font-medium">
                      {formatPayloadPreview(sub.payload)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedSub(sub)}
                        className="inline-flex items-center gap-1 text-xs text-slate-900 font-semibold hover:opacity-85"
                      >
                        <Eye className="h-3.5 w-3.5" /> Détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected lead details modal */}
      {selectedSub && (
        <Modal
          isOpen={!!selectedSub}
          onClose={() => setSelectedSub(null)}
          title="Détails du lead"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-100 pb-3 text-slate-400 font-medium">
              <div>
                Date: <span className="text-slate-800 font-semibold">{new Date(selectedSub.created_at).toLocaleString()}</span>
              </div>
              <div className="text-right">
                IP: <span className="text-slate-800 font-mono font-semibold">{selectedSub.ip_address}</span>
              </div>
            </div>

            {selectedSub.fingerprint && (
              <div className="text-[10px] text-slate-400 font-mono">
                Fingerprint: <span className="bg-slate-50 border border-slate-100 px-1 py-0.5 rounded-sm">{selectedSub.fingerprint}</span>
              </div>
            )}

            <div className="space-y-3 mt-4 max-h-96 overflow-y-auto pr-2">
              {Object.entries(selectedSub.payload).map(([key, val]) => (
                <div key={key} className="space-y-1 bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{key}</span>
                  <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap">{val}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 mt-6">
              <Button onClick={() => setSelectedSub(null)}>Fermer</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
