import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ServerStackIcon,
  ArrowsRightLeftIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { clientsApi } from '../api';

type SortField = 'name' | 'backups_count' | 'backups_ok' | 'backups_critical';
type SortOrder = 'asc' | 'desc';

export default function Clients() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    contact_email: '',
    contact_phone: '',
    nas_identifiers: [] as string[],
    sla_hours: 24,
    notes: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const data = await clientsApi.getAll();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, formData);
      } else {
        await clientsApi.create(formData);
      }
      fetchClients();
      closeModal();
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm(t('clients.confirmDelete'))) {
      try {
        await clientsApi.delete(id);
        fetchClients();
      } catch (error) {
        console.error('Error deleting client:', error);
      }
    }
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget) return;
    if (mergeSource === mergeTarget) {
      alert('Impossible de fusionner un client avec lui-meme');
      return;
    }
    try {
      await clientsApi.merge(mergeSource, mergeTarget);
      fetchClients();
      setShowMergeModal(false);
      setMergeSource(null);
      setMergeTarget(null);
    } catch (error) {
      console.error('Error merging clients:', error);
      alert('Erreur lors de la fusion');
    }
  };

  const openModal = (client?: any) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        short_name: client.short_name || '',
        contact_email: client.contact_email || '',
        contact_phone: client.contact_phone || '',
        nas_identifiers: client.nas_identifiers || [],
        sla_hours: client.sla_hours || 24,
        notes: client.notes || '',
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        short_name: '',
        contact_email: '',
        contact_phone: '',
        nas_identifiers: [],
        sla_hours: 24,
        notes: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
  };

  const getHealthStatus = (client: any) => {
    const total = client.backups_count || 0;
    const ok = client.backups_ok || 0;
    const critical = client.backups_critical || 0;
    if (total === 0) return 'unknown';
    if (critical > 0) return 'critical';
    if (ok === total) return 'ok';
    return 'warning';
  };

  const getStatusBadge = (client: any) => {
    const status = getHealthStatus(client);
    const total = client.backups_count || 0;
    const ok = client.backups_ok || 0;
    const critical = client.backups_critical || 0;
    switch (status) {
      case 'ok':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
            <CheckCircleIcon className="w-4 h-4 mr-1" />
            {ok}/{total} OK
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
            <XCircleIcon className="w-4 h-4 mr-1" />
            {critical} echec
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
            <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
            Partiel
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500">
            Aucun backup
          </span>
        );
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedAndFilteredClients = clients
    .filter((client) => {
      const matchesSearch = client.name.toLowerCase().includes(search.toLowerCase()) ||
        client.short_name?.toLowerCase().includes(search.toLowerCase()) ||
        client.nas_identifiers?.some((nas: string) => nas.toLowerCase().includes(search.toLowerCase()));
      
      if (filterStatus === 'all') return matchesSearch;
      return matchesSearch && getHealthStatus(client) === filterStatus;
    })
    .sort((a, b) => {
      let aVal = a[sortField] || 0;
      let bVal = b[sortField] || 0;
      if (sortField === 'name') {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      }
      if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

  const totalClients = clients.length;
  const clientsOk = clients.filter(c => getHealthStatus(c) === 'ok').length;
  const clientsCritical = clients.filter(c => getHealthStatus(c) === 'critical').length;
  const totalBackups = clients.reduce((sum, c) => sum + (c.backups_count || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('clients.title')}</h1>
          <p className="text-gray-400 mt-1">{t('clients.subtitle')}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowMergeModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            <ArrowsRightLeftIcon className="w-5 h-5 mr-2" />
            Fusionner
          </button>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            {t('clients.add')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Clients</p>
          <p className="text-2xl font-bold text-white">{totalClients}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Clients OK</p>
          <p className="text-2xl font-bold text-green-500">{clientsOk}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Clients en erreur</p>
          <p className="text-2xl font-bold text-red-500">{clientsCritical}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Sauvegardes</p>
          <p className="text-2xl font-bold text-primary-500">{totalBackups}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clients.search')}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <FunnelIcon className="w-5 h-5 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="ok">OK uniquement</option>
            <option value="critical">En erreur</option>
            <option value="warning">Attention</option>
            <option value="unknown">Sans backup</option>
          </select>
        </div>
      </div>

      <div className="flex items-center space-x-4 text-sm">
        <span className="text-gray-400">Trier par:</span>
        {[
          { field: 'name' as SortField, label: 'Nom' },
          { field: 'backups_count' as SortField, label: 'Nb backups' },
          { field: 'backups_critical' as SortField, label: 'Erreurs' },
        ].map(({ field, label }) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={`flex items-center px-3 py-1 rounded ${sortField === field ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            {label}
            {sortField === field && (sortOrder === 'asc' ? <ArrowUpIcon className="w-3 h-3 ml-1" /> : <ArrowDownIcon className="w-3 h-3 ml-1" />)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedAndFilteredClients.length === 0 ? (
          <p className="text-gray-500 col-span-full text-center py-8">{t('clients.noClients')}</p>
        ) : (
          sortedAndFilteredClients.map((client) => (
            <Link
              key={client.id}
              to={`/clients/${client.id}`}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-primary-500 transition-colors block"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{client.name}</h3>
                  <p className="text-primary-400 text-sm font-mono">{client.short_name}</p>
                </div>
                {getStatusBadge(client)}
              </div>
              {client.nas_identifiers && client.nas_identifiers.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {client.nas_identifiers.slice(0, 3).map((nas: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                      <ServerStackIcon className="w-3 h-3 mr-1" />
                      {nas}
                    </span>
                  ))}
                  {client.nas_identifiers.length > 3 && (
                    <span className="text-xs text-gray-500">+{client.nas_identifiers.length - 3}</span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-gray-900/50 rounded-lg">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{client.backups_count || 0}</p>
                  <p className="text-xs text-gray-500">Backups</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-500">{client.backups_ok || 0}</p>
                  <p className="text-xs text-gray-500">OK</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-red-500">{client.backups_critical || 0}</p>
                  <p className="text-xs text-gray-500">Echec</p>
                </div>
              </div>
              <div className="flex items-center justify-end pt-4 border-t border-gray-700 space-x-2" onClick={(e) => e.preventDefault()}>
                <button
                  onClick={(e) => { e.preventDefault(); openModal(client); }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); handleDelete(client.id); }}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </Link>
          ))
        )}
      </div>

      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowMergeModal(false)} />
          <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-white mb-4">Fusionner deux clients</h2>
            <p className="text-gray-400 text-sm mb-6">Les sauvegardes du client source seront transferees vers le client cible. Le client source sera supprime.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Client source (sera supprime)</label>
                <select
                  value={mergeSource || ''}
                  onChange={(e) => setMergeSource(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Selectionnez...</option>
                  {clients.filter(c => c.id !== mergeTarget).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.backups_count || 0} backups)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Client cible (conserve)</label>
                <select
                  value={mergeTarget || ''}
                  onChange={(e) => setMergeTarget(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Selectionnez...</option>
                  {clients.filter(c => c.id !== mergeSource).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.backups_count || 0} backups)</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-6">
              <button onClick={() => setShowMergeModal(false)} className="px-4 py-2 text-gray-300 hover:text-white">Annuler</button>
              <button onClick={handleMerge} disabled={!mergeSource || !mergeTarget} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg">Fusionner</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">{editingClient ? t('clients.edit') : t('clients.add')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('clients.name')} *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Code court</label>
                <input type="text" value={formData.short_name} onChange={(e) => setFormData({ ...formData, short_name: e.target.value.toUpperCase() })} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono" placeholder="NCEN" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('clients.email')}</label>
                <input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('clients.phone')}</label>
                <input type="tel" value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-300 hover:text-white">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}