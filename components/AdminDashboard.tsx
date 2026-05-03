
import React, { useState } from 'react';
import { LogOut, Users, Database, LayoutDashboard, ChevronRight, Menu, Bell, Search, Settings, CheckCircle, FileText, Globe, Inbox, Bot, AlertTriangle, GraduationCap, Shield, Sparkles, BrainCircuit } from 'lucide-react';
import HomePage from './HomePage';
import UserManagement from './UserManagement';
import ReportsPage from './ReportsPage';
import AlumniFetcherPage from './AlumniFetcherPage';
import InboxPage from './InboxPage';
import PauloPage from './PauloPage';
import SystemAdminPage from './SystemAdminPage';
import GraduateImport from './GraduateImport';
import { Admin } from '../types';

interface AdminDashboardProps {
  admin: Admin;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ admin, onLogout }) => {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'users' | 'reports' | 'fetcher' | 'inbox' | 'paulo' | 'settings' | 'system' | 'import'>('dashboard');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    onLogout();
  };

  const NavItem = ({ id, label, icon: Icon }: { id: typeof currentTab, label: string, icon: any }) => (
    <button 
        onClick={() => setCurrentTab(id)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold group relative overflow-hidden mb-1 ${
            currentTab === id 
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20' 
            : 'text-slate-600 hover:bg-white/50 hover:text-blue-600'
        }`}
    >
        <div className="flex items-center gap-3 relative z-10">
            <Icon size={18} className={currentTab === id ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} />
            <span>{label}</span>
        </div>
        {currentTab === id && <ChevronRight size={16} className="relative z-10 opacity-80" />}
    </button>
  );
  
  return (
    <div className="h-screen w-screen relative flex flex-col font-sans text-slate-800 overflow-hidden bg-slate-50">
      
      {/* --- Glassmorphism Background Blobs --- */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/30 blur-[120px] animate-blob"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-400/30 blur-[120px] animate-blob animation-delay-2000"></div>
          <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-indigo-300/20 blur-[100px] animate-blob animation-delay-4000"></div>
      </div>

      {/* Top Bar - Glass Style - Fixed at Top */}
      <header className="flex-none z-50 mx-4 lg:mx-8 mt-4 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/80 shadow-lg shadow-black/5 relative">
        <div className="px-6 h-20 flex justify-between items-center">
             
             {/* Left: Brand */}
             <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 text-white">
                     <GraduationCap className="w-6 h-6" />
                 </div>
                 <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">Admin<span className="text-blue-600">Portal</span></h1>
                    <p className="text-[10px] font-bold tracking-widest uppercase">
                        <span className="text-slate-900">Laguna</span> <span className="text-green-600">University</span>
                    </p>
                 </div>
             </div>

             {/* Right: Actions */}
             <div className="flex items-center gap-4 md:gap-6">
                
                {/* Search Bar - High Visibility */}
                <div className="hidden md:flex items-center bg-white rounded-xl px-4 py-2 border border-slate-200 shadow-sm focus-within:shadow-md focus-within:border-blue-300 transition-all w-64 group">
                    <Search size={16} className="text-slate-400 group-focus-within:text-blue-500 mr-2 transition-colors" />
                    <input type="text" placeholder="Quick Search..." className="bg-transparent border-none outline-none text-sm text-slate-700 w-full placeholder-slate-400 font-medium"/>
                </div>

                <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

                <div className="flex items-center gap-3">
                    <button className="p-2.5 rounded-xl bg-white/70 border border-white/80 hover:bg-white hover:shadow-md text-slate-600 transition-all">
                        <Bell size={20} />
                    </button>
                    <button onClick={() => setCurrentTab('settings')} className="p-2.5 rounded-xl bg-white/70 border border-white/80 hover:bg-white hover:shadow-md text-slate-600 transition-all">
                        <Settings size={20} />
                    </button>
                </div>

                {/* Profile / Logout */}
                <div className="flex items-center gap-3 pl-2">
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/50 border border-white/60 rounded-full shadow-sm">
                        <span className="text-xs font-bold text-slate-700">{admin.username}</span>
                        <span className="h-3 w-px bg-slate-300"></span>
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Administrator</span>
                    </div>
                    <button 
                        onClick={handleLogoutClick}
                        className="ml-2 p-2.5 rounded-xl bg-white/70 border border-white/80 text-red-500 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm"
                        title="Sign Out"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </div>
      </header>

      {/* Main Layout - Content Scrollable Only */}
      <div className="flex-grow flex overflow-hidden pt-6 pb-6 px-4 lg:px-8 relative z-[60] gap-8">
            
            {/* === LEFT SIDEBAR NAVIGATION (Fixed Width) === */}
            <div className="hidden lg:flex flex-col w-72 flex-shrink-0">
                 <div className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl shadow-indigo-500/5 rounded-3xl p-4 h-full overflow-y-auto custom-scrollbar">
                    
                    {/* Section: Dashboard */}
                    <div className="mb-6">
                        <div className="px-4 py-2 mb-1">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dashboard</h3>
                        </div>
                        <NavItem id="dashboard" label="Overview" icon={LayoutDashboard} />
                    </div>

                    {/* Section: AI & Communication */}
                    <div className="mb-6">
                        <div className="px-4 py-2 mb-1">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI & Communication</h3>
                        </div>
                        <NavItem id="inbox" label="Updates Inbox" icon={Inbox} />
                        <NavItem id="paulo" label="P.A.U.L.O. Assistant" icon={Bot} />
                    </div>

                    {/* Section: User & Records Management */}
                    <div className="mb-6">
                        <div className="px-4 py-2 mb-1">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User & Records</h3>
                        </div>
                        <NavItem id="users" label="User Database" icon={Users} />
                        <NavItem id="import" label="Graduate Import" icon={Database} />
                    </div>

                    {/* Section: Alumni & Placement Tools */}
                    <div className="mb-6">
                        <div className="px-4 py-2 mb-1">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Placement Tools</h3>
                        </div>
                        <NavItem id="fetcher" label="Alumni Fetcher" icon={Globe} />
                        <NavItem id="reports" label="Generate Reports" icon={FileText} />
                    </div>

                    {/* Section: System */}
                    <div className="mb-6">
                        <div className="px-4 py-2 mb-1">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System</h3>
                        </div>
                        <NavItem id="system" label="System Panel" icon={Shield} />
                        <NavItem id="settings" label="Settings" icon={Settings} />
                        
                        <button 
                            onClick={handleLogoutClick}
                            className="w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-xl transition-all duration-200 text-sm font-bold text-red-500 hover:bg-red-50"
                        >
                            <LogOut size={18} />
                            <span>Log Out</span>
                        </button>
                    </div>

                 </div>
            </div>

            {/* === RIGHT CONTENT AREA (Scrollable) === */}
            <main className="flex-grow h-full overflow-y-auto pr-2 scrollbar-hide">
                {currentTab === 'dashboard' && <HomePage adminId={admin.id} />}
                {currentTab === 'inbox' && <InboxPage />}
                {currentTab === 'paulo' && <PauloPage />}
                {currentTab === 'users' && <UserManagement />}
                {currentTab === 'import' && <GraduateImport />}
                {currentTab === 'fetcher' && <AlumniFetcherPage />}
                {currentTab === 'reports' && <ReportsPage adminId={admin.id} />}
                {currentTab === 'system' && <SystemAdminPage />}
                {currentTab === 'settings' && (
                    <div className="max-w-4xl mx-auto py-8">
                        <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/80 shadow-xl overflow-hidden">
                            <div className="p-8 border-b border-white/40">
                                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                    <Settings className="text-blue-600" /> System Settings
                                </h2>
                                <p className="text-slate-500 text-sm mt-1 font-medium">Configure global system behavior and automation.</p>
                            </div>

                            <div className="p-8 space-y-8">
                                {/* Automation Section */}
                                <div>
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <Sparkles size={14} className="text-blue-500" /> Automation & AI
                                    </h3>
                                    
                                    <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 group hover:border-blue-200 transition-all">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                            <div className="flex gap-5">
                                                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 flex-shrink-0">
                                                    <BrainCircuit size={28} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-lg">Auto-Processing Updates</h4>
                                                    <p className="text-sm text-slate-500 mt-1 max-w-md leading-relaxed">
                                                        Enable AI-driven automatic analysis and acknowledgement for all incoming pending updates. Confirmation emails will be sent automatically.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${JSON.parse(localStorage.getItem('lu_inbox_auto_ack') || '{"enabled":false}').enabled ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                    {JSON.parse(localStorage.getItem('lu_inbox_auto_ack') || '{"enabled":false}').enabled ? 'Running' : 'Disabled'}
                                                </span>
                                                <button 
                                                    onClick={() => {
                                                        const current = JSON.parse(localStorage.getItem('lu_inbox_auto_ack') || '{"enabled":false}');
                                                        const newVal = { ...current, enabled: !current.enabled };
                                                        localStorage.setItem('lu_inbox_auto_ack', JSON.stringify(newVal));
                                                        setCurrentTab('settings'); // Force re-render
                                                    }}
                                                    className={`w-16 h-9 rounded-full transition-all relative shadow-inner ${JSON.parse(localStorage.getItem('lu_inbox_auto_ack') || '{"enabled":false}').enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                                                >
                                                    <div className={`w-7 h-7 bg-white rounded-full absolute top-1 transition-all shadow-md ${JSON.parse(localStorage.getItem('lu_inbox_auto_ack') || '{"enabled":false}').enabled ? 'left-8' : 'left-1'}`}></div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Privacy Section */}
                                <div>
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <Shield size={14} className="text-blue-500" /> Security & Privacy
                                    </h3>
                                    <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 flex justify-between items-center opacity-60">
                                        <div className="flex gap-5">
                                            <div className="w-14 h-14 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 flex-shrink-0">
                                                <Globe size={28} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-400 text-lg">Public Directory Visibility</h4>
                                                <p className="text-sm text-slate-400 mt-1">Control who can see alumni profiles in the public search.</p>
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">Coming Soon</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
      </div>

      {/* === LOGOUT CONFIRMATION MODAL === */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowLogoutModal(false)}></div>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Sign Out?</h3>
                    <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">
                        Are you sure you want to log out of the admin portal? Any unsaved changes may be lost.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                         <button 
                            onClick={() => setShowLogoutModal(false)}
                            className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmLogout}
                            className="py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-all text-sm"
                        >
                            Yes, Log Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
