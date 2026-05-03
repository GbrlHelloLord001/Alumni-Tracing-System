
import React, { useState, useEffect } from 'react';
import { Student, AlumniUser } from '../types';
import { getOrCreateAlumniUser } from '../services/socialService';
import { Users, MessageCircle, LayoutGrid, Globe, Loader2, UserPlus, LogOut, Menu, X } from 'lucide-react';
import NetworkView from './connect/NetworkView';
import MessagesView from './connect/MessagesView';
import ForumsView from './connect/ForumsView';
import GroupsView from './connect/GroupsView';

interface ConnectPageProps {
  user: Student;
}

const ConnectPage: React.FC<ConnectPageProps> = ({ user }) => {
  const [unifiedUser, setUnifiedUser] = useState<AlumniUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'network' | 'messages' | 'forums' | 'groups'>('network');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const initSocial = async () => {
      if (!user.id) return;
      try {
        const sourceTable = user.table_source || (user.enrollment_status === 'Graduating' ? 'students' : 'alumni');
        const unified = await getOrCreateAlumniUser(user.id, sourceTable === 'students' ? 'students' : 'alumni');
        setUnifiedUser(unified);
      } catch (error) {
        console.error("Social init failed", error);
      } finally {
        setLoading(false);
      }
    };
    initSocial();
  }, [user.id]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-12 h-12 text-luGreen animate-spin mb-4" />
        <p className="font-bold text-sm tracking-widest uppercase">Connecting to Network...</p>
      </div>
    );
  }

  if (!unifiedUser) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-red-400">
            <p className="font-bold">Failed to initialize social profile.</p>
        </div>
    );
  }

  const NavItem = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
    <button 
      onClick={() => { setActiveTab(id); setMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-bold text-sm group relative overflow-hidden ${
        activeTab === id 
        ? 'bg-gradient-to-r from-luGreen to-emerald-600 text-white shadow-xl shadow-green-500/20' 
        : 'text-slate-500 hover:bg-white/40 hover:text-luGreen'
      }`}
    >
      <div className={`p-2 rounded-xl transition-all duration-300 ${activeTab === id ? 'bg-white/20 text-white' : 'bg-white/50 text-slate-400 group-hover:bg-white group-hover:text-luGreen group-hover:scale-110 shadow-sm'}`}>
        <Icon size={20} />
      </div>
      <span className="tracking-wide relative z-10">{label}</span>
      {activeTab === id && (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
          </>
      )}
    </button>
  );

  return (
    <div className="flex h-full w-full gap-6 relative">
      
      {/* Mobile Toggle */}
      <button 
        className="lg:hidden absolute top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* --- SIDEBAR NAVIGATION (LEFT PANEL) --- */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40 w-72 flex-shrink-0 bg-white/30 backdrop-blur-2xl border border-white/60 shadow-xl shadow-slate-200/50 rounded-[2.5rem] flex flex-col transition-transform duration-300 transform lg:transform-none h-full
        ${mobileMenuOpen ? 'translate-x-0 m-2' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header Title */}
        <div className="p-8 pb-4 border-b border-white/20 relative overflow-hidden">
            <h3 className="font-black text-slate-800 text-2xl tracking-tight leading-tight flex flex-row items-center gap-2 whitespace-nowrap">
              Alumni <span className="text-luGreen">Connect</span>
            </h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-2">Social Network</p>
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Menu</p>
            <NavItem id="network" label="Discover" icon={UserPlus} />
            <NavItem id="messages" label="Messages" icon={MessageCircle} />
            <NavItem id="forums" label="Communities" icon={LayoutGrid} />
            <NavItem id="groups" label="Groups" icon={Users} />
        </div>
      </div>

      {/* --- MAIN CONTENT AREA (RIGHT PANEL) --- */}
      <div className="flex-1 bg-white/30 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-xl shadow-slate-200/50 relative overflow-hidden flex flex-col h-full">
          {/* Header for Mobile Context (Optional - visible only on small screens) */}
          <div className="lg:hidden h-16 bg-white/40 backdrop-blur-md border-b border-white/40 flex items-center justify-center shrink-0">
              <span className="font-black text-slate-700 uppercase tracking-widest text-sm bg-white/50 px-4 py-1 rounded-full border border-white/50 shadow-sm">
                  {activeTab === 'network' ? 'Discover' : activeTab}
              </span>
          </div>

          <div className="flex-1 overflow-hidden relative">
              {activeTab === 'network' && <NetworkView currentUser={unifiedUser} onStartChat={() => setActiveTab('messages')} />}
              {activeTab === 'messages' && <MessagesView currentUser={unifiedUser} />}
              {activeTab === 'forums' && <ForumsView currentUser={unifiedUser} />}
              {activeTab === 'groups' && <GroupsView currentUser={unifiedUser} />}
          </div>
      </div>

    </div>
  );
};

export default ConnectPage;
