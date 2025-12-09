import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HomeIcon,
  UserGroupIcon,
  ServerStackIcon,
  BellIcon,
  EnvelopeIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { dashboardApi, alertsApi, clientsApi } from '../api';

export default function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [clients, setClients] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStats();
    fetchAlertCount();
    fetchClients();
    const interval = setInterval(() => { fetchStats(); fetchAlertCount(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => { try { const data = await dashboardApi.getStats(); setStats(data); } catch (e) { console.error(e); } };
  const fetchAlertCount = async () => { try { const data = await alertsApi.getCount(); setAlertCount(data.count || 0); } catch (e) { setAlertCount(0); } };
  const fetchClients = async () => { try { const data = await clientsApi.getAll(); setClients(data); } catch (e) { console.error(e); } };
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const found = clients.find((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (found) { navigate(`/clients/${found.id}`); setSearchOpen(false); setSearchQuery(''); }
  };

  const navigation = [
    { name: t('nav.dashboard'), href: '/', icon: HomeIcon },
    { name: t('nav.clients'), href: '/clients', icon: UserGroupIcon },
    { name: t('nav.backups'), href: '/backups', icon: ServerStackIcon },
    { name: t('nav.alerts'), href: '/alerts', icon: BellIcon, badge: alertCount },
    { name: t('nav.emails'), href: '/emails', icon: EnvelopeIcon },
    { name: t('nav.settings'), href: '/settings', icon: Cog6ToothIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200 ease-in-out`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          <Link to="/" className="flex items-center space-x-2"><ServerStackIcon className="w-8 h-8 text-primary-500" /><span className="text-xl font-bold text-white">BackupControl</span></Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <nav className="mt-4 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link key={item.name} to={item.href} className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
                <div className="flex items-center space-x-3"><item.icon className="w-5 h-5" /><span>{item.name}</span></div>
                {item.badge && item.badge > 0 && (<span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500 text-white">{item.badge}</span>)}
              </Link>
            );
          })}
        </nav>
        {stats && (
          <div className="absolute bottom-20 left-0 right-0 px-4">
            <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Resume</h3>
              <div className="flex items-center justify-between text-sm"><div className="flex items-center text-gray-400"><UserGroupIcon className="w-4 h-4 mr-2" /><span>Clients</span></div><span className="text-white font-medium">{stats.total_clients || 0}</span></div>
              <div className="flex items-center justify-between text-sm"><div className="flex items-center text-green-400"><CheckCircleIcon className="w-4 h-4 mr-2" /><span>OK</span></div><span className="text-green-400 font-medium">{stats.backups_success || 0}</span></div>
              <div className="flex items-center justify-between text-sm"><div className="flex items-center text-red-400"><XCircleIcon className="w-4 h-4 mr-2" /><span>Echec</span></div><span className="text-red-400 font-medium">{stats.backups_failed || 0}</span></div>
              <div className="flex items-center justify-between text-sm"><div className="flex items-center text-yellow-400"><BellIcon className="w-4 h-4 mr-2" /><span>Alertes</span></div><span className="text-yellow-400 font-medium">{stats.pending_alerts || 0}</span></div>
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          <button onClick={handleLogout} className="flex items-center justify-center w-full px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"><ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" /><span>Deconnexion</span></button>
        </div>
      </div>
      <div className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-40 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center justify-between h-16 px-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-white"><Bars3Icon className="w-6 h-6" /></button>
            <div className="flex-1 flex justify-center lg:justify-start lg:ml-4">
              {searchOpen ? (
                <form onSubmit={handleSearch} className="relative w-full max-w-md">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher un client..." autoFocus className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
                </form>
              ) : (
                <button onClick={() => setSearchOpen(true)} className="flex items-center px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"><MagnifyingGlassIcon className="w-5 h-5 mr-2" /><span className="hidden sm:inline">Rechercher...</span></button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Link to="/alerts" className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                <BellIcon className="w-6 h-6" />
                {alertCount > 0 && (<span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-500 text-white min-w-[20px] text-center">{alertCount > 99 ? '99+' : alertCount}</span>)}
              </Link>
            </div>
          </div>
        </header>
        <main className="p-6"><Outlet /></main>
      </div>
      {sidebarOpen && (<div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />)}
    </div>
  );
}