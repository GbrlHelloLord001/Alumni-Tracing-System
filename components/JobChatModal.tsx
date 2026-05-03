
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { JobApplication, JobMessage, Student } from '../types';
import { getMessages, sendMessage } from '../services/jobService';
import { Send, X, MessageSquare, Building2, Clock, CheckCircle2 } from 'lucide-react';

interface JobChatModalProps {
  application: JobApplication;
  user: Student; // Current logged in user
  onClose: () => void;
}

const JobChatModal: React.FC<JobChatModalProps> = ({ application, user, onClose }) => {
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [application.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
        const data = await getMessages(application.id);
        setMessages(data);
    } catch (e) { console.error(e); }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim()) return;
      
      setSending(true);
      try {
          const userTable = user.table_source || (user.enrollment_status === 'Graduating' ? 'students' : 'students');
          const userType = userTable === 'students' ? 'STUDENT' : 'ALUMNI';
          
          const payload: Partial<JobMessage> = {
              application_id: application.id,
              sender_type: userType,
              message: newMessage,
              is_read: false
          };
          
          if (userType === 'STUDENT') payload.student_id = user.id;
          else payload.alumni_id = user.id;

          await sendMessage(payload);
          setNewMessage('');
          fetchMessages();
      } catch (e) {
          alert("Failed to send message");
      } finally {
          setSending(false);
      }
  };

  // Use Portal to render outside the current DOM hierarchy (e.g., outside Dashboard main content)
  // This ensures fixed positioning is relative to the viewport, covering the top bar.
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end font-sans">
        {/* Backdrop with heavy blur */}
        <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300 animate-in fade-in" 
            onClick={onClose}
        ></div>

        {/* Drawer Panel */}
        <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-white/50 z-10">
            
            {/* Header with Company Context */}
            <div className="flex-none p-6 bg-slate-50/80 backdrop-blur-xl border-b border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="relative z-10 flex justify-between items-start mb-4">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-2xl font-black text-slate-700">
                        {application.job?.company_name?.[0]}
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600 hover:shadow-sm"
                    >
                        <X size={20}/>
                    </button>
                </div>

                <div className="relative z-10">
                    <h3 className="font-black text-xl text-slate-800 leading-tight mb-1 line-clamp-2">{application.job?.job_title}</h3>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                        <Building2 size={14} className="text-blue-500"/>
                        {application.job?.company_name}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                            application.application_status === 'Hired' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            application.application_status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                            'bg-amber-50 text-amber-600 border-amber-200'
                        }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                                application.application_status === 'Hired' ? 'bg-emerald-500' :
                                application.application_status === 'Rejected' ? 'bg-red-500' : 'bg-amber-500'
                            }`}></div>
                            {application.application_status}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <Clock size={12}/> Applied {new Date(application.applied_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-grow p-6 overflow-y-auto bg-white space-y-6 custom-scrollbar">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <MessageSquare size={32} className="opacity-50"/>
                        </div>
                        <p className="text-sm font-bold text-slate-400">Start a conversation with HR</p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.sender_type !== 'HR';
                        const showAvatar = !isMe && (i === 0 || messages[i-1].sender_type !== 'HR');
                        
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm font-medium ${
                                        isMe 
                                        ? 'bg-blue-600 text-white rounded-tr-none' 
                                        : 'bg-slate-100 text-slate-700 rounded-tl-none'
                                    }`}>
                                        {msg.message}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-300 mt-1.5 px-1">
                                        {isMe ? 'You' : 'HR'} • {new Date(msg.sent_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100">
                <form onSubmit={handleSend} className="relative flex items-end gap-2">
                    <div className="flex-grow bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                        <textarea 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                            placeholder="Type your message..."
                            className="w-full bg-transparent px-4 py-3.5 text-sm font-medium text-slate-700 outline-none resize-none max-h-32 min-h-[50px]"
                            rows={1}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={!newMessage.trim() || sending}
                        className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:scale-95 shadow-lg shadow-blue-200 flex-shrink-0 h-[50px] w-[50px] flex items-center justify-center"
                    >
                        {sending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send size={20} />}
                    </button>
                </form>
                <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
                    Enter to send • Shift + Enter for new line
                </p>
            </div>
        </div>
    </div>,
    document.body
  );
};

export default JobChatModal;
