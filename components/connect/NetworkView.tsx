
import React, { useState, useEffect } from 'react';
import { AlumniUser, FriendRequest, Friend } from '../../types';
import { searchConnectableUsers, sendFriendRequest, getIncomingRequests, respondToRequest, getFriends, startConversation } from '../../services/socialService';
import { Search, UserPlus, Check, X, MessageCircle, UserCheck, Loader2, Clock, Users } from 'lucide-react';

interface NetworkViewProps {
  currentUser: AlumniUser;
  onStartChat: () => void;
}

const NetworkView: React.FC<NetworkViewProps> = ({ currentUser, onStartChat }) => {
  const [activeSubTab, setActiveSubTab] = useState<'discover' | 'requests' | 'friends'>('discover');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ user: AlumniUser, status: string }[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeSubTab === 'requests') loadRequests();
    if (activeSubTab === 'friends') loadFriends();
  }, [activeSubTab]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const results = await searchConnectableUsers(searchTerm, currentUser.id);
      setSearchResults(results);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getIncomingRequests(currentUser.id);
      setRequests(data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadFriends = async () => {
    setLoading(true);
    try {
      const data = await getFriends(currentUser.id);
      setFriends(data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSendRequest = async (targetId: string) => {
    try {
      await sendFriendRequest(currentUser.id, targetId);
      setSearchResults(prev => prev.map(r => r.user.id === targetId ? { ...r, status: 'Pending' } : r));
    } catch (e: any) { alert(e.message || "Failed to send request"); }
  };

  const handleRespond = async (reqId: string, status: 'Accepted' | 'Rejected') => {
    try {
      await respondToRequest(reqId, status);
      loadRequests();
    } catch (e) { alert("Action failed"); }
  };

  const handleMessageFriend = async (friendId: string) => {
    try {
      await startConversation(currentUser.id, friendId);
      onStartChat();
    } catch (e: any) { alert(e.message || "Could not start chat"); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      {/* Sub-nav Header */}
      <div className="px-6 pt-6 pb-2">
          <div className="flex gap-1 p-1 bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 w-fit shadow-sm">
            {['discover', 'requests', 'friends'].map((tab) => (
                <button 
                    key={tab}
                    onClick={() => setActiveSubTab(tab as any)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                        activeSubTab === tab 
                        ? 'bg-slate-800 text-white shadow-md' 
                        : 'text-slate-500 hover:bg-white/50 hover:text-slate-800'
                    }`}
                >
                    {tab === 'requests' && requests.length > 0 ? `Requests (${requests.length})` : tab}
                </button>
            ))}
          </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        
        {/* DISCOVER VIEW */}
        {activeSubTab === 'discover' && (
            <div className="space-y-8">
                <div className="max-w-2xl mx-auto text-center space-y-4">
                    <h2 className="text-2xl font-black text-slate-800">Find Alumni</h2>
                    <form onSubmit={handleSearch} className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-luGreen transition-colors" size={20} />
                        <input 
                        type="text" 
                        placeholder="Search by name..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-white/50 focus:outline-none focus:ring-4 focus:ring-green-500/10 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                        />
                    </form>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300 w-8 h-8"/></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchResults.length === 0 && searchTerm && (
                            <div className="col-span-full text-center py-20 text-slate-400">No alumni found.</div>
                        )}
                        {searchResults.map(({ user, status }) => (
                            <div key={user.id} className="bg-white p-6 rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300 group">
                                <div className="w-20 h-20 bg-gradient-to-br from-luGreen to-emerald-600 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-green-500/20 mb-4 group-hover:scale-110 transition-transform">
                                    {user.avatar_initials}
                                </div>
                                <h4 className="font-bold text-slate-800 text-lg mb-1">{user.full_name}</h4>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-6">{user.program}</p>
                                
                                <div className="mt-auto w-full">
                                    {status === 'None' && (
                                        <button 
                                            onClick={() => handleSendRequest(user.id)}
                                            className="w-full py-3 bg-slate-100 hover:bg-luGreen hover:text-white text-slate-600 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <UserPlus size={18} /> Connect
                                        </button>
                                    )}
                                    {status === 'Pending' && (
                                        <div className="w-full py-3 bg-amber-50 text-amber-600 font-bold rounded-xl border border-amber-100 flex items-center justify-center gap-2 cursor-default">
                                            <Clock size={18} /> Pending
                                        </div>
                                    )}
                                    {status === 'Friend' && (
                                        <button 
                                            onClick={() => handleMessageFriend(user.id)}
                                            className="w-full py-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <MessageCircle size={18} /> Message
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* REQUESTS VIEW */}
        {activeSubTab === 'requests' && (
            <div className="max-w-3xl mx-auto">
                {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-slate-300"/></div> : 
                 requests.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><UserPlus size={24} className="opacity-50"/></div>
                        <p className="font-bold">No pending requests</p>
                    </div>
                 ) : (
                    <div className="grid gap-4">
                        {requests.map(req => (
                            <div key={req.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">
                                        {req.sender?.avatar_initials}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">{req.sender?.full_name}</h4>
                                        <p className="text-xs text-slate-500">{req.sender?.program}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleRespond(req.id, 'Accepted')} className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors"><Check size={20}/></button>
                                    <button onClick={() => handleRespond(req.id, 'Rejected')} className="p-2.5 bg-rose-100 text-rose-700 rounded-xl hover:bg-rose-200 transition-colors"><X size={20}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                 )
                }
            </div>
        )}

        {/* FRIENDS VIEW */}
        {activeSubTab === 'friends' && (
            <div>
                {loading ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-slate-300"/></div> : 
                 friends.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Users size={24} className="opacity-50"/></div>
                        <p className="font-bold">You haven't connected with anyone yet.</p>
                        <button onClick={() => setActiveSubTab('discover')} className="mt-2 text-luGreen font-bold hover:underline">Find Alumni</button>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {friends.map(friend => (
                            <div key={friend.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                        {friend.friend_details?.avatar_initials}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">{friend.friend_details?.full_name}</h4>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Connected</p>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleMessageFriend(friend.friend_id === currentUser.id ? friend.user_id : friend.friend_id)} 
                                    className="p-2.5 bg-slate-50 text-slate-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                                >
                                    <MessageCircle size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                 )
                }
            </div>
        )}

      </div>
    </div>
  );
};

export default NetworkView;
