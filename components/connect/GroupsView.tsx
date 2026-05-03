
import React, { useState, useEffect, useRef } from 'react';
import { AlumniUser, Group, GroupMessage } from '../../types';
import { getGroups, createGroup, getGroupMessages, sendGroupMessage } from '../../services/socialService';
import { Plus, Users, Send, Hash } from 'lucide-react';

interface GroupsViewProps {
  currentUser: AlumniUser;
}

const GroupsView: React.FC<GroupsViewProps> = ({ currentUser }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    let interval: any;
    if (activeGroup) {
      loadMessages(activeGroup.id);
      interval = setInterval(() => loadMessages(activeGroup.id), 3000);
    }
    return () => clearInterval(interval);
  }, [activeGroup]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadGroups = async () => {
    try {
      const data = await getGroups(currentUser.id);
      setGroups(data);
    } catch (e) { console.error(e); }
  };

  const loadMessages = async (id: string) => {
    try {
      const data = await getGroupMessages(id);
      setMessages(data);
    } catch (e) { console.error(e); }
  };

  const handleCreate = async () => {
    try {
      await createGroup(currentUser.id, newGroupName);
      setShowCreate(false);
      loadGroups();
    } catch (e) { alert("Failed"); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !newMessage.trim()) return;
    try {
      await sendGroupMessage(activeGroup.id, currentUser.id, newMessage);
      setNewMessage('');
      loadMessages(activeGroup.id);
    } catch (e) { alert("Failed"); }
  };

  return (
    <div className="h-full flex bg-slate-50/50">
      
      {/* Sidebar: Group List */}
      <div className="w-20 md:w-64 bg-white/60 backdrop-blur-xl border-r border-white/60 flex flex-col p-3 md:p-4 gap-4">
        <button 
            onClick={() => setShowCreate(true)} 
            className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 group"
        >
          <Plus size={20} /> <span className="hidden md:inline">New Group</span>
        </button>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {groups.map(g => (
            <div 
              key={g.id} 
              onClick={() => setActiveGroup(g)}
              className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 group ${activeGroup?.id === g.id ? 'bg-purple-50 text-purple-700 border border-purple-100 shadow-sm' : 'hover:bg-white/80 text-slate-600'}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${activeGroup?.id === g.id ? 'bg-purple-200' : 'bg-slate-200 group-hover:bg-purple-100'}`}>
                  <Hash size={18}/>
              </div>
              <h4 className="font-bold text-sm truncate hidden md:block">{g.name}</h4>
            </div>
          ))}
        </div>
      </div>

      {/* Main: Chat Area */}
      <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-sm">
        {activeGroup ? (
          <>
            {/* Header */}
            <div className="h-16 px-6 border-b border-white/60 bg-white/40 backdrop-blur-md flex items-center gap-3 sticky top-0 z-10">
              <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                <Users size={16}/>
              </div>
              <h3 className="font-black text-slate-800 text-lg tracking-tight">{activeGroup.name}</h3>
            </div>
            
            {/* Feed */}
            <div className="flex-grow p-6 overflow-y-auto space-y-6 custom-scrollbar">
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === currentUser.id;
                // Grouping logic visual simplification (Discord style)
                const showHeader = i === 0 || messages[i-1].sender_id !== msg.sender_id;

                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {showHeader && !isMe && (
                        <div className="w-8 h-8 bg-gradient-to-tr from-purple-100 to-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700 shrink-0">
                            {msg.sender?.avatar_initials}
                        </div>
                    )}
                    {!showHeader && !isMe && <div className="w-8 shrink-0"></div>}

                    <div className={`max-w-[80%]`}>
                       {showHeader && !isMe && <p className="text-[10px] font-bold text-slate-400 mb-1 ml-1">{msg.sender?.full_name}</p>}
                       <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-purple-600 text-white rounded-br-none' : 'bg-white text-slate-700 border border-white/50 rounded-bl-none'}`}>
                           {msg.message}
                       </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white/80 border-t border-white/60">
                <form onSubmit={handleSend} className="flex gap-2">
                <input 
                    className="flex-grow bg-slate-100 border border-transparent rounded-2xl px-5 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-purple-200 transition-all" 
                    placeholder={`Message #${activeGroup.name}...`}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                />
                <button type="submit" className="p-3 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">
                    <Send size={18} />
                </button>
                </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <Users size={48} className="opacity-20"/>
            </div>
            <p className="font-bold text-lg text-slate-300">Select a group to start chatting</p>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}></div>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl">
            <h3 className="text-xl font-black text-slate-800 mb-6">Create New Group</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Group Name</label>
                    <input 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-200 transition-all" 
                    placeholder="#general"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    />
                </div>
                <button onClick={handleCreate} className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all">
                    Create Group
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsView;
