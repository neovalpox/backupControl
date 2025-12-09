import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cog6ToothIcon,
  BellIcon,
  EnvelopeIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { settingsApi, notificationsApi } from '../api';

export default function Settings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingNotif, setTestingNotif] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    discord_webhook: '',
    teams_webhook: '',
    slack_webhook: '',
    email_check_interval: 30,
    alert_on_failure: true,
    daily_report_enabled: false,
    daily_report_time: '08:00',
    sla_default_hours: 24,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await settingsApi.getAll();
      const settingsObj: any = {};
      data.forEach((s: any) => { settingsObj[s.key] = s.value; });
      setSettings(settingsObj);
      setFormData({
        discord_webhook: settingsObj.discord_webhook || '',
        teams_webhook: settingsObj.teams_webhook || '',
        slack_webhook: settingsObj.slack_webhook || '',
        email_check_interval: settingsObj.email_check_interval || 30,
        alert_on_failure: settingsObj.alert_on_failure !== false,
        daily_report_enabled: settingsObj.daily_report_enabled === true,
        daily_report_time: settingsObj.daily_report_time || '08:00',
        sla_default_hours: settingsObj.sla_default_hours || 24,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      for (const [key, value] of Object.entries(formData)) {
        await settingsApi.update(key, value);
      }
      setMessage({ type: 'success', text: 'Parametres sauvegardes avec succes' });
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async (type: string) => {
    setTestingNotif(type);
    setMessage(null);
    try {
      await notificationsApi.test(type);
      setMessage({ type: 'success', text: `Notification ${type} envoyee avec succes` });
    } catch (error) {
      setMessage({ type: 'error', text: `Erreur lors de l'envoi de la notification ${type}` });
    } finally {
      setTestingNotif(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
        <p className="text-gray-400 mt-1">{t('settings.subtitle')}</p>
      </div>

      {message && (
        <div className={`flex items-center p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {message.type === 'success' ? <CheckCircleIcon className="w-5 h-5 mr-2" /> : <ExclamationTriangleIcon className="w-5 h-5 mr-2" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center mb-6">
            <BellIcon className="w-6 h-6 text-primary-500 mr-3" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Discord Webhook URL</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.discord_webhook}
                  onChange={(e) => setFormData({ ...formData, discord_webhook: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500"
                />
                <button
                  onClick={() => handleTestNotification('discord')}
                  disabled={!formData.discord_webhook || testingNotif === 'discord'}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg"
                >
                  {testingNotif === 'discord' ? '...' : 'Test'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Microsoft Teams Webhook URL</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.teams_webhook}
                  onChange={(e) => setFormData({ ...formData, teams_webhook: e.target.value })}
                  placeholder="https://outlook.office.com/webhook/..."
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500"
                />
                <button
                  onClick={() => handleTestNotification('teams')}
                  disabled={!formData.teams_webhook || testingNotif === 'teams'}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
                >
                  {testingNotif === 'teams' ? '...' : 'Test'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Slack Webhook URL</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.slack_webhook}
                  onChange={(e) => setFormData({ ...formData, slack_webhook: e.target.value })}
                  placeholder="https://hooks.slack.com/services/..."
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500"
                />
                <button
                  onClick={() => handleTestNotification('slack')}
                  disabled={!formData.slack_webhook || testingNotif === 'slack'}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg"
                >
                  {testingNotif === 'slack' ? '...' : 'Test'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center mb-6">
            <ClockIcon className="w-6 h-6 text-primary-500 mr-3" />
            <h2 className="text-lg font-semibold text-white">Automatisation</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Intervalle de verification emails (min)</label>
              <input
                type="number"
                value={formData.email_check_interval}
                onChange={(e) => setFormData({ ...formData, email_check_interval: Number(e.target.value) })}
                min={5}
                max={120}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Alerter sur echec de backup</span>
              <button
                onClick={() => setFormData({ ...formData, alert_on_failure: !formData.alert_on_failure })}
                className={`w-12 h-6 rounded-full transition-colors ${formData.alert_on_failure ? 'bg-primary-600' : 'bg-gray-600'} relative`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.alert_on_failure ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Rapport quotidien</span>
              <button
                onClick={() => setFormData({ ...formData, daily_report_enabled: !formData.daily_report_enabled })}
                className={`w-12 h-6 rounded-full transition-colors ${formData.daily_report_enabled ? 'bg-primary-600' : 'bg-gray-600'} relative`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.daily_report_enabled ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            {formData.daily_report_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Heure du rapport quotidien</label>
                <input
                  type="time"
                  value={formData.daily_report_time}
                  onChange={(e) => setFormData({ ...formData, daily_report_time: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center mb-6">
            <Cog6ToothIcon className="w-6 h-6 text-primary-500 mr-3" />
            <h2 className="text-lg font-semibold text-white">General</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">SLA par defaut (heures)</label>
              <input
                type="number"
                value={formData.sla_default_hours}
                onChange={(e) => setFormData({ ...formData, sla_default_hours: Number(e.target.value) })}
                min={1}
                max={168}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Delai maximum acceptable entre deux backups reussis</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder les parametres'}
        </button>
      </div>
    </div>
  );
}