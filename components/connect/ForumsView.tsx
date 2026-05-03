
import React, { useState, useEffect } from 'react';
import { AlumniUser, Forum, ForumPost } from '../../types';
import { getForums, createForum, getForumPosts, createPost } from '../../services/socialService';
import { Plus, MessageCircle, ArrowRight, LayoutGrid, ChevronLeft, Send, Hash } from 'lucide-react';

interface ForumsViewProps {
  currentUser: AlumniUser;
}

const ForumsView: React.FC<ForumsViewProps> = ({ currentUser }) => {
  const [forums, setForums] = useState<Forum[]>([]);
  const [activeForum, setActiveForum] = useState<Forum | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newForumData, setNewForumData] = useState({ title: '', desc: '' });
  const [newPostContent, setNewPostContent] = useState('');

  useEffect(() => {
    loadForums();
  }, []);

  useEffect(() => {
    if (activeForum) loadPosts(activeForum.id);
  }, [activeForum]);

  const loadForums = async () => {
    try {
      const data = await getForums();
      setForums(data);
    } catch (e) { console.error(e); }
  };

  const loadPosts = async (id: string) => {
    try {
      const data = await getForumPosts(id);
      setPosts(data);
    } catch (e) { console.error(e); }
  };

  const handleCreateForum = async () => {
    try {
      await createForum(currentUser.id, newForumData.title, newForumData.desc, false);
      setShowCreateModal(false);
      loadForums();
    } catch (e) { alert("Failed"); }
  };

  const handleCreatePost = async () => {
    if (!activeForum || !newPostContent.trim()) return;
    try {
      await createPost(activeForum.id, currentUser.id, newPostContent);
      setNewPostContent('');
      loadPosts(activeForum.id);
    } catch (e) { alert("Failed"); }
  };

  if (activeForum) {
    return (
      <div className="h-full flex flex-col bg-slate-50/50">
        {/* Forum Header */}
        <div className="bg-white/80 backdrop-blur-md border-b border-white/60 p-6 sticky top-0 z-10 shadow-sm">
            <button 
                onClick={() => setActiveForum(null)} 
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-3 transition-colors"
            >
                <ChevronLeft size={14}/> Back to Communities
            </button>
            <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl text-white shadow-lg shadow-orange-200">
                    <Hash size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{activeForum.title}</h2>
                    <p className="text-sm text-slate-500 mt-1">{activeForum.description}</p>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
            
            {/* Create Post Card */}
            <div className="bg-white p-4 rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 flex gap-4 items-start transition-all focus-within:shadow-xl focus-within:ring-2 focus-within:ring-orange-100">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 text-sm shrink-0">
                    {currentUser.avatar_initials}
                </div>
                <div className="flex-grow">
                    <textarea 
                        value={newPostContent}
                        onChange={e => setNewPostContent(e.target.value)}
                        placeholder="Start a discussion..."
                        className="w-full bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none resize-none min-h-[60px]"
                    />
                    <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                        <button 
                            onClick={handleCreatePost} 
                            disabled={!newPostContent.trim()}
                            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            Post <Send size={12}/>
                        </button>
                    </div>
                </div>
            </div>

            {/* Posts Feed */}
            <div className="space-y-4">
                {posts.map(post => (
                    <div key={post.id} className="bg-white p-6 rounded-3xl border border-white/60 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-gradient-to-tr from-orange-100 to-amber-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-xs">
                                {post.author?.avatar_initials}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">{post.author?.full_name}</h4>
                                <span className="text-[10px] font-bold text-slate-400 block">{new Date(post.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <p className="text-slate-700 text-sm leading-relaxed mb-4 pl-11">{post.content}</p>
                        
                        <div className="flex items-center gap-4 pl-11">
                            <button className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors">
                                <MessageCircle size={14}/> Comment
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/50 p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Communities</h2>
            <p className="text-sm text-slate-500 font-medium">Join discussions with fellow alumni.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="px-5 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-black hover:scale-105 transition-all shadow-lg shadow-slate-200">
          <Plus size={16} /> New Forum
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forums.map(forum => (
            <div key={forum.id} onClick={() => setActiveForum(forum)} className="bg-white p-6 rounded-[2rem] border border-white/60 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-[200px]">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-colors">
                        <LayoutGrid size={20} />
                    </div>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">Public</span>
                </div>
                
                <h3 className="font-bold text-lg text-slate-800 mb-2 group-hover:text-orange-600 transition-colors line-clamp-1">{forum.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">{forum.description}</p>
                
                <div className="mt-auto flex justify-end">
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                        <ArrowRight size={16} />
                    </div>
                </div>
            </div>
            ))}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-6">Create Community</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Name</label>
                    <input 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200 transition-all" 
                    placeholder="e.g. Tech Startups"
                    value={newForumData.title}
                    onChange={e => setNewForumData({...newForumData, title: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Description</label>
                    <textarea 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-orange-200 transition-all resize-none" 
                    placeholder="What's this community about?"
                    rows={3}
                    value={newForumData.desc}
                    onChange={e => setNewForumData({...newForumData, desc: e.target.value})}
                    />
                </div>
            </div>
            <button onClick={handleCreateForum} className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors mt-8 shadow-lg shadow-orange-200">
                Create Forum
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumsView;
