'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { getClients, saveClient, deleteClient } from '@/lib/actions';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const data = await getClients();
      setClients(data);
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
    }
  }

  const openCreateModal = () => {
    setEditClient(null);
    setName('');
    setEmail('');
    setPhone('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditClient(client);
    setName(client.name);
    setEmail(client.email);
    setPhone(client.phone || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      setFormError('Nom et email requis.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const res = await saveClient(editClient ? editClient.id : null, name, email, phone);
      if (res && !res.success) {
        setFormError(res.error || 'Impossible de sauvegarder le client.');
        return;
      }
      await loadClients();
      setModalOpen(false);
    } catch (err: any) {
      console.error('Error saving client:', err);
      setFormError(err.message || 'Impossible de sauvegarder le client.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client et tous ses formulaires associés ?')) {
      return;
    }

    try {
      const res = await deleteClient(id);
      if (res && !res.success) {
        alert('Erreur: ' + res.error);
        return;
      }
      await loadClients();
    } catch (err) {
      console.error('Error deleting client:', err);
      alert('Erreur lors de la suppression du client.');
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
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Clients</h2>
          <p className="text-sm text-slate-500">Gérez les destinataires qui recevront les notifications de formulaires.</p>
        </div>
        <Button onClick={openCreateModal} className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white font-medium hover:bg-slate-800 rounded-lg">
          <Plus className="h-4 w-4" /> Nouveau client
        </Button>
      </div>

      {/* Grid of clients cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {clients.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <span className="text-sm font-medium text-slate-400">Aucun client configuré.</span>
          </div>
        ) : (
          clients.map((client) => (
            <div key={client.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs flex flex-col justify-between h-48">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{client.name}</h3>
                <p className="text-sm text-slate-500 mt-2 truncate">{client.email}</p>
                {client.phone && <p className="text-xs text-slate-400 mt-1 font-medium">{client.phone}</p>}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-50 pt-4">
                <Button 
                  variant="ghost" 
                  onClick={() => openEditModal(client)}
                  className="px-2 py-1.5 text-slate-500 hover:text-slate-900 text-xs gap-1"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Modifier
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => handleDelete(client.id)}
                  className="px-2 py-1.5 text-red-500 hover:bg-red-50 text-xs gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editClient ? "Modifier le client" : "Créer un client"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-600 font-medium">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Nom du client</label>
            <Input 
              type="text" 
              placeholder="Ex: Acme Corp" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Adresse Email</label>
            <Input 
              type="email" 
              placeholder="Ex: contact@acme.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Numéro de téléphone (SMS)</label>
            <Input 
              type="text" 
              placeholder="Ex: +33612345678" 
              value={phone} 
              onChange={e => setPhone(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
