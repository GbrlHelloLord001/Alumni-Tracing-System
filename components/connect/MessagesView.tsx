
import React, { useState, useEffect, useRef } from 'react';
import { AlumniUser, Conversation, Message } from '../../types';
import { getConversations, getPrivateMessages, sendPrivateMessage } from '../../services/socialService';
import { Send, Loader2, MessageSquare, Search } from 'lucide-react';

interface MessagesViewProps {
  currentUser: AlumniUser;
}

const MessagesView: React.FC<MessagesViewProps> = ({ currentUser }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    let interval: any;
    if (selectedConvo) {
      loadMessages(selectedConvo.id);
      interval = setInterval(() => loadMessages(selectedConvo.id), 3000);
    }
    return () => clearInterval(interval);
  }, [selectedConvo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await getConversations(currentUser.id);
      setConversations(data);
    } catch (e) { console.error(e); }
  };

  const loadMessages = async (convoId: string) => {
    try {
      const data = await getPrivateMessages(convoId);
      setMessages(data);
    } catch (e) { console.error(e); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvo) return;
    try {
      await sendPrivateMessage(selectedConvo.id, currentUser.id, newMessage);
      setNewMessage('');
      loadMessages(selectedConvo.id);
    } catch (e) { alert("Failed to send"); }
  };

  return (
    <div className="flex h-full bg-slate-50/50">
      
      {/* SIDEBAR: CONVERSATION LIST */}
      <div className="w-full md:w-80 flex-shrink-0 bg-white/60 backdrop-blur-xl border-r border-white/60 flex flex-col">
        <div className="p-5 border-b border-white/40">
            <h2 className="font-black text-slate-800 text-lg mb-4">Messages</h2>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Search..." 
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {conversations.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No conversations started.</div>
            ) : (
                conversations.map(c => (
                    <div 
                        key={c.id}
                        onClick={() => setSelectedConvo(c)}
                        className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 ${
                            selectedConvo?.id === c.id 
                            ? 'bg-white shadow-md shadow-blue-500/5 ring-1 ring-black/5' 
                            : 'hover:bg-white/50'
                        }`}
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                            {c.other_user?.avatar_initials}
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm truncate">{c.other_user?.full_name}</h4>
                            <p className="text-xs text-slate-500 truncate mt-0.5">{c.last_message?.message || 'Start chatting...'}</p>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* MAIN: CHAT AREA */}
      <div className={`flex-1 flex flex-col bg-white/40 backdrop-blur-sm ${!selectedConvo ? 'hidden md:flex' : ''}`}>
        {selectedConvo ? (
            <>
                {/* Chat Header */}
                <div className="h-16 px-6 border-b border-white/60 flex items-center justify-between bg-white/40 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                            {selectedConvo.other_user?.avatar_initials}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">{selectedConvo.other_user?.full_name}</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Online</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {messages.map((msg, i) => {
                        const isMe = msg.sender_id === currentUser.id;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                    isMe 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                                }`}>
                                    {msg.message}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white/80 border-t border-white/60">
                    <form onSubmit={handleSend} className="flex gap-2">
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-grow bg-slate-100 rounded-2xl px-5 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                        <button 
                            type="submit" 
                            disabled={!newMessage.trim()}
                            className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-black transition-colors disabled:opacity-50 shadow-lg shadow-slate-200"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare size={32} className="opacity-40" />
                </div>
                <p className="font-bold">Select a conversation</p>
            </div>
        )}
      </div>

    </div>
  );
};

export default MessagesView;
