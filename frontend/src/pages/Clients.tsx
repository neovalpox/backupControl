import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ServerIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { clientsApi, backupsApi } from '../api';
import type { Client, Backup } from '../api';

export default function Clients() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientBackups, setClientBackups] = useState<Backup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    contact_email: '',
    contact_phone: '',
    nas_identifiers: '',
    email_patterns: '',
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

  const fetchClientBackups = async (clientId: number) => {
    setLoadingBackups(true);
    try {
      const data = await backupsApi.getAll({ client_id: clientId, active_only: false });
      setClientBackups(data);
    } catch (error) {
      console.error('Error fetching backups:', error);
      setClientBackups([]);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleClientClick = async (client: Client) => {
    setSelectedClient(client);
    await fetchClientBackups(client.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        short_name: formData.short_name || formData.name.substring(0, 10).toUpperCase().replace(/\s/g, ''),
        contact_email: formData.contact_email || undefined,
        contact_phone: formData.contact_phone || undefined,
        nas_identifiers: formData.nas_identifiers ? formData.nas_identifiers.split(',').map(s => s.trim()).filter(Boolean) : [],
        email_patterns: formData.email_patterns ? formData.email_patterns.split(',').map(s => s.trim()).filter(Boolean) : [],
        sla_hours: formData.sla_hours,
        notes: formData.notes || undefined,
      };
      
      if (editingClient) {
        await clientsApi.update(editingClient.id, payload);
      } else {
        await clientsApi.create(payload);
      }
      fetchClients();
      closeModal();
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t('clients.confirmDelete'))) {
      try {
        await clientsApi.delete(id);
        if (selectedClient?.id === id) {
          setSelectedClient(null);
          setClientBackups([]);
        }
        fetchClients();
      } catch (error) {
        console.error('Error deleting client:', error);
      }
    }
  };

  const openModal = (client?: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        short_name: client.short_name || '',
        contact_email: client.contact_email || '',
        contact_phone: client.contact_phone || '',
        nas_identifiers: (client.nas_identifiers || []).join(', '),
        email_patterns: (client.email_patterns || []).join(', '),
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
        nas_identifiers: '',
        email_patterns: '',
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

  const getStatusIcon = (status: string, size = 'w-5 h-5') => {
    switch (status) {
      case 'success':
      case 'ok':
        return <CheckCircleIcon className={`${size} text-green-500`} />;
      case 'failed':
      case 'error':
      case 'critical':
        return <XCircleIcon className={`${size} text-red-500`} />;
      case 'warning':
      case 'alert':
        return <ExclamationTriangleIcon className={`${size} text-yellow-500`} />;
      default:
        return <ClockIcon className={`${size} text-gray-500`} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
            <CheckCircleIcon className="w-4 h-4 mr-1" />
            OK
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
            <XCircleIcon className="w-4 h-4 mr-1" />
            Echec
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
            <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
            Attention
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500">
            <ClockIcon className="w-4 h-4 mr-1" />
            Aucune
          </span>
        );
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'ok':
        return 'border-l-green-500';
      case 'failed':
      case 'error':
      case 'critical':
        return 'border-l-red-500';
      case 'warning':
      case 'alert':
        return 'border-l-yellow-500';
      default:
        return 'border-l-gray-500';
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.short_name?.toLowerCase().includes(search.toLowerCase()) ||
    (client.nas_identifiers || []).some(n => n.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Left panel - Clients list */}
      <div className={`${selectedClient ? 'w-1/3' : 'w-full'} transition-all duration-300 pr-4 overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('clients.title')}</h1>
            <p className="text-gray-400 mt-1">{t('clients.subtitle')}</p>
          </div>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            {t('clients.add')}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clients.search')}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Clients list */}
        <div className="space-y-3">
          {filteredClients.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('clients.noClients')}</p>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => handleClientClick(client)}
                className={`bg-gray-800 rounded-xl p-4 border-l-4 cursor-pointer transition-all hover:bg-gray-750 ${
                  getStatusBgColor(client.last_backup_status)
                } ${selectedClient?.id === client.id ? 'ring-2 ring-primary-500' : 'border border-gray-700'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-white truncate">{client.name}</h3>
                      {getStatusBadge(client.last_backup_status)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span className="flex items-center">
                        <ServerIcon className="w-4 h-4 mr-1" />
                        {client.backups_count} sauvegarde{client.backups_count > 1 ? 's' : ''}
                      </span>
                      {client.backups_ok > 0 && (
                        <span className="text-green-500">{client.backups_ok} OK</span>
                      )}
                      {client.backups_warning > 0 && (
                        <span className="text-yellow-500">{client.backups_warning} Attention</span>
                      )}
                      {client.backups_critical > 0 && (
                        <span className="text-red-500">{client.backups_critical} Echec</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => openModal(client, e)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(client.id, e)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                    <ChevronRightIcon className="w-5 h-5 text-gray-500" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel - Client backups */}
      {selectedClient && (
        <div className="w-2/3 pl-4 border-l border-gray-700 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">{selectedClient.name}</h2>
              <p className="text-gray-400">Sauvegardes du client</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchClientBackups(selectedClient.id)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowPathIcon className={`w-5 h-5 ${loadingBackups ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => { setSelectedClient(null); setClientBackups([]); }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Client info summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <p className="text-gray-500 text-xs">Total</p>
              <p className="text-2xl font-bold text-white">{selectedClient.backups_count}</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
              <p className="text-green-400 text-xs">OK</p>
              <p className="text-2xl font-bold text-green-500">{selectedClient.backups_ok}</p>
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
              <p className="text-yellow-400 text-xs">Attention</p>
              <p className="text-2xl font-bold text-yellow-500">{selectedClient.backups_warning}</p>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
              <p className="text-red-400 text-xs">Echec</p>
              <p className="text-2xl font-bold text-red-500">{selectedClient.backups_critical}</p>
            </div>
          </div>

          {/* Contact info */}
          {(selectedClient.contact_email || selectedClient.contact_phone) && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Contact</h3>
              <div className="flex gap-6 text-sm">
                {selectedClient.contact_email && (
                  <span className="text-gray-300">{selectedClient.contact_email}</span>
                )}
                {selectedClient.contact_phone && (
                  <span className="text-gray-300">{selectedClient.contact_phone}</span>
                )}
              </div>
            </div>
          )}

          {/* Backups list */}
          {loadingBackups ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : clientBackups.length === 0 ? (
            <div className="text-center py-12">
              <ServerIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">Aucune sauvegarde configuree pour ce client</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clientBackups.map((backup) => (
                <div
                  key={backup.id}
                  className={`bg-gray-800 rounded-lg p-4 border border-gray-700 border-l-4 ${getStatusBgColor(backup.current_status)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        backup.current_status === 'ok' ? 'bg-green-500/10' :
                        backup.current_status === 'failed' ? 'bg-red-500/10' :
                        backup.current_status === 'warning' ? 'bg-yellow-500/10' :
                        'bg-gray-500/10'
                      }`}>
                        {getStatusIcon(backup.current_status)}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{backup.name}</h4>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                          <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">{backup.backup_type}</span>
                          {backup.source_nas && <span>Source: {backup.source_nas}</span>}
                          {backup.destination_nas && <span>Dest: {backup.destination_nas}</span>}
                        </div>
                        {backup.last_error_message && (backup.current_status === 'failed' || backup.current_status === 'error') && (
                          <p className="text-red-400 text-sm mt-2">{backup.last_error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-400">Derniere execution</p>
                      <p className="text-white">{formatDate(backup.last_event_at)}</p>
                      <div className="mt-2">
                        <span className="text-green-500">{backup.total_success_count}</span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className="text-red-500">{backup.total_failure_count}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingClient ? t('clients.edit') : t('clients.add')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom du client *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom court (identifiant)
                </label>
                <input
                  type="text"
                  value={formData.short_name}
                  onChange={(e) => setFormData({ ...formData, short_name: e.target.value.toUpperCase() })}
                  placeholder="NABOCLIENT"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-gray-500 text-xs mt-1">Sera genere automatiquement si vide</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Identifiants NAS
                </label>
                <input
                  type="text"
                  value={formData.nas_identifiers}
                  onChange={(e) => setFormData({ ...formData, nas_identifiers: e.target.value })}
                  placeholder="NABO01, NABO02"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-gray-500 text-xs mt-1">Separes par des virgules</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email de contact
                  </label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Telephone
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Patterns email
                </label>
                <input
                  type="text"
                  value={formData.email_patterns}
                  onChange={(e) => setFormData({ ...formData, email_patterns: e.target.value })}
                  placeholder="*@client.com, backup@client.fr"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-gray-500 text-xs mt-1">Patterns pour identifier les emails de ce client</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SLA (heures)
                </label>
                <input
                  type="number"
                  value={formData.sla_hours}
                  onChange={(e) => setFormData({ ...formData, sla_hours: parseInt(e.target.value) || 24 })}
                  min="1"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                >
                  {editingClient ? 'Enregistrer' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
