'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { getForms, getClients, createForm, toggleFormStatus, deleteForm } from '@/lib/actions';

interface Form {
  id: string;
  name: string;
  is_active: boolean;
  allowed_origins: string[];
  client_id: string;
  clients: {
    name: string;
  } | null;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

export default function FormsPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [originsInput, setOriginsInput] = useState('');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplySubject, setAutoReplySubject] = useState('Confirmation de réception');
  const [autoReplyMessage, setAutoReplyMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFormsAndClients();
  }, []);

  async function loadFormsAndClients() {
    try {
      const [formsData, clientsData] = await Promise.all([
        getForms(),
        getClients(),
      ]);

      // Cast join structure
      setForms((formsData as unknown as Form[]) || []);
      const sortedClients = [...clientsData].sort((a, b) => a.name.localeCompare(b.name));
      setClients(sortedClients || []);
    } catch (err) {
      console.error('Failed to load forms page:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !clientId) {
      setFormError('Nom et Client requis.');
      return;
    }

    setSaving(true);
    setFormError('');

    // Parse origins: split by comma, trim spaces, filter empty
    const allowedOrigins = originsInput
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o !== '');

    try {
      const res = await createForm(name, clientId, allowedOrigins, autoReplyEnabled, autoReplySubject, autoReplyMessage);
      if (res && !res.success) {
        setFormError(res.error || 'Impossible de créer le formulaire.');
        return;
      }
      await loadFormsAndClients();
      setModalOpen(false);
    } catch (err: any) {
      console.error('Error creating form:', err);
      setFormError(err.message || 'Impossible de créer le formulaire.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      const res = await toggleFormStatus(id, !currentStatus);
      if (res && !res.success) {
        alert('Erreur: ' + res.error);
        return;
      }
      setForms(
        forms.map((f) => (f.id === id ? { ...f, is_active: !currentStatus } : f))
      );
    } catch (err) {
      console.error('Failed to toggle form:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce formulaire définitivement ?')) {
      return;
    }

    try {
      const res = await deleteForm(id);
      if (res && !res.success) {
        alert('Erreur: ' + res.error);
        return;
      }
      await loadFormsAndClients();
    } catch (err) {
      console.error('Error deleting form:', err);
      alert('Erreur lors de la suppression.');
    }
  };

  const openCreateModal = () => {
    if (clients.length === 0) {
      alert('Veuillez d’abord créer au moins un client.');
      return;
    }
    setName('');
    setClientId(clients[0].id);
    setOriginsInput('*');
    setAutoReplyEnabled(false);
    setAutoReplySubject('Confirmation de réception');
    setAutoReplyMessage('');
    setFormError('');
    setModalOpen(true);
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
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Formulaires</h2>
          <p className="text-sm text-slate-500">Configurez et obtenez les liens d&apos;intégration pour vos formulaires.</p>
        </div>
        <Button onClick={openCreateModal} className="flex items-center gap-1.5 px-3 py-2">
          <Plus className="h-4 w-4" /> Nouveau formulaire
        </Button>
      </div>

      {/* Grid of Forms */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {forms.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <span className="text-sm font-medium text-slate-400">Aucun formulaire configuré.</span>
          </div>
        ) : (
          forms.map((form) => (
            <div
              key={form.id}
              className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs flex flex-col justify-between h-56 transition-all hover:shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between">
                  <Link
                    href={`/admin/forms/${form.id}`}
                    className="font-bold text-slate-900 text-base hover:underline block truncate max-w-[80%]"
                  >
                    {form.name}
                  </Link>
                  <button
                    onClick={() => handleToggle(form.id, form.is_active)}
                    className="text-slate-400 hover:text-slate-800 transition-colors"
                  >
                    {form.is_active ? (
                      <ToggleRight className="h-6 w-6 text-slate-900" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-slate-300" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400 font-semibold mt-1">
                  Client : {form.clients ? form.clients.name : 'Inconnu'}
                </p>
                <div className="mt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                    CORS Origines
                  </span>
                  <p className="text-xs text-slate-500 font-mono mt-1 truncate">
                    {form.allowed_origins.join(', ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-50 pt-4">
                <Link
                  href={`/admin/forms/${form.id}`}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950 transition-colors"
                >
                  Intégration
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(form.id)}
                  className="px-2 py-1.5 text-red-500 hover:bg-red-50 text-xs gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Creation Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Créer un formulaire">
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-600 font-medium">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Nom du formulaire</label>
            <Input
              type="text"
              placeholder="Ex: Formulaire de contact Acme"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Client destinataire</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              disabled={saving}
              className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Origines CORS autorisées (séparées par une virgule)
            </label>
            <Input
              type="text"
              placeholder="Ex: https://acme.com, https://blog.acme.com (ou * pour tout)"
              value={originsInput}
              onChange={(e) => setOriginsInput(e.target.value)}
              disabled={saving}
            />
            <span className="text-[10px] text-slate-400 block font-medium">
              Séparer par une virgule si plusieurs sites vitrines. Mettre `*` pour tout autoriser.
            </span>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label htmlFor="auto-reply" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Réponse automatique (Auto-Reply)
              </label>
              <input
                id="auto-reply"
                type="checkbox"
                checked={autoReplyEnabled}
                onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                disabled={saving}
              />
            </div>
            
            {autoReplyEnabled && (
              <div className="space-y-3 pl-4 border-l-2 border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Objet de l'e-mail
                  </label>
                  <Input
                    type="text"
                    placeholder="Confirmation de réception"
                    value={autoReplySubject}
                    onChange={(e) => setAutoReplySubject(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Message de confirmation
                  </label>
                  <textarea
                    placeholder="Ex: Merci pour votre message. Nous vous répondrons bientôt..."
                    value={autoReplyMessage}
                    onChange={(e) => setAutoReplyMessage(e.target.value)}
                    disabled={saving}
                    rows={3}
                    className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
                  />
                  <span className="text-[10px] text-slate-400 block font-medium">
                    Laissez vide pour utiliser le message par défaut (qui inclut le nom du client destinataire).
                  </span>
                </div>
              </div>
            )}
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
            <Button type="submit" disabled={saving}>
              {saving ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
