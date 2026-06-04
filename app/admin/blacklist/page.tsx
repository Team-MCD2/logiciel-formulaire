'use client';

import { useState, useEffect } from 'react';
import { Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { getBlacklist, addBlacklist, removeBlacklist } from '@/lib/actions';

interface BlacklistEntry {
  id: string;
  target: string;
  type: 'ip' | 'fingerprint' | 'host';
  reason: string;
  created_at: string;
}

export default function BlacklistPage() {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [type, setType] = useState<'ip' | 'fingerprint' | 'host'>('ip');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadBlacklist();
  }, []);

  async function loadBlacklist() {
    try {
      const data = await getBlacklist();
      setBlacklist((data as BlacklistEntry[]) || []);
    } catch (err) {
      console.error('Failed to load blacklist:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || !reason) {
      setFormError('Cible et motif requis.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const res = await addBlacklist(target, type, reason);
      if (res && !res.success) {
        setFormError(res.error || 'La cible existe déjà ou est invalide.');
        return;
      }
      await loadBlacklist();
      setModalOpen(false);
    } catch (err: any) {
      console.error('Error creating blacklist entry:', err);
      setFormError(err.message || 'La cible existe déjà ou est invalide.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment retirer cette cible de la blacklist ?')) {
      return;
    }

    try {
      const res = await removeBlacklist(id);
      if (res && !res.success) {
        alert('Erreur: ' + res.error);
        return;
      }
      await loadBlacklist();
    } catch (err) {
      console.error('Error deleting blacklist entry:', err);
      alert('Erreur lors du retrait.');
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Blacklist Sécurité</h2>
          <p className="text-sm text-slate-500">Visualisez et gérez les adresses IP, empreintes ou hôtes bannis.</p>
        </div>
        <Button onClick={() => {
          setTarget('');
          setReason('');
          setFormError('');
          setModalOpen(true);
        }} className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 text-white font-medium border border-red-600 rounded-lg">
          <Plus className="h-4 w-4" /> Bannir une cible
        </Button>
      </div>

      {/* Blacklist Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs">
        {blacklist.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <ShieldAlert className="h-10 w-10 text-slate-300" />
            <span className="text-sm font-medium text-slate-400 mt-2">Aucun bannissement actif.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-500">
              <thead className="bg-slate-50 text-xs font-bold text-slate-700 uppercase border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Cible</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Raison</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {blacklist.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                      {new Date(entry.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-900">
                      {entry.target}
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <span className={`inline-block font-mono font-semibold px-2 py-0.5 rounded text-[10px] uppercase border ${
                        entry.type === 'ip' 
                          ? 'bg-blue-50 text-blue-700 border-blue-100' 
                          : entry.type === 'fingerprint' 
                            ? 'bg-purple-50 text-purple-700 border-purple-100' 
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-700">
                      {entry.reason}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold hover:opacity-85"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ban Creation Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Bannir une cible">
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-600 font-medium">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Cible à bannir (IP, Empreinte ou Hôte)</label>
            <Input
              type="text"
              placeholder="Ex: 198.51.100.42 ou un nom d'hôte VPS"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Type de cible</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'ip' | 'fingerprint' | 'host')}
              required
              disabled={saving}
              className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ip">Adresse IP</option>
              <option value="fingerprint">Fingerprint</option>
              <option value="host">Hôte (Reverse DNS domain)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Motif du bannissement</label>
            <Input
              type="text"
              placeholder="Ex: Spam constaté depuis ce serveur"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="submit" className="bg-red-600 hover:bg-red-500 border-red-600 text-white" disabled={saving}>
              {saving ? 'Bannissement...' : 'Bannir la cible'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
