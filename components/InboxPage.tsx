
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { analyzeUserUpdate, UpdateAnalysisResult } from '../services/updatesAI';
import { sendUpdateAcknowledgementEmail } from '../services/emailService';
import { Loader2, Mail, CheckCircle, Trash2, ArrowRight, BrainCircuit, User, Calendar, Briefcase, MapPin, Building2, AlertTriangle, MessageSquare, CheckSquare, Square, Settings, X, Power, Target, Clock, Filter, Sparkles, Inbox, Check, Layers, GraduationCap, History, Activity } from 'lucide-react';

interface UserUpdate {
  id: string;
  update_text: string;
  email: string;
  submitted_at: string;
  student_id?: string;
  alumni_id?: string;
  // Joined fields
  student?: { first_name: string; last_name: string; program: string };
  alumni?: { first_name: string; last_name: string; program: string };
}

const InboxPage: React.FC = () => {
  const [updates, setUpdates] = useState<UserUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpdate, setSelectedUpdate] = useState<UserUpdate | null>(null);
  const [analysis, setAnalysis] = useState<UpdateAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal States
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  // Note: Auto-config UI moved to Settings page but we keep state for logic if needed
  const [autoConfig, setAutoConfig] = useState({ enabled: false });

  // History State
  const [activeTab, setActiveTab] = useState<'inbox' | 'history'>('inbox');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchUpdates();
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
        const { data, error } = await supabase
            .from('acknowledgement_history')
            .select('*')
            .order('processed_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        setHistoryLogs(data || []);
    } catch (e) {
        console.error("Error fetching history:", e);
    }
  };

    useEffect(() => {
        const stored = localStorage.getItem('lu_inbox_auto_ack');
        if (stored) {
            const config = JSON.parse(stored);
            setAutoConfig(config);
            // If we want it to run here too:
            // if (config.enabled) handleAutoProcess();
        }
    }, [activeTab]); // Check when tab changes or initially

  const fetchUpdates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_updates')
        .select(`
          *,
          student:students(first_name, last_name, program),
          alumni:alumni(first_name, last_name, program)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setUpdates(data as UserUpdate[]);
    } catch (e) {
      console.error("Error fetching updates:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUpdate = async (update: UserUpdate) => {
    setSelectedUpdate(update);
    // Only re-analyze if it's a different update or no analysis exists
    if (selectedUpdate?.id !== update.id) {
        setAnalysis(null);
        setAnalyzing(true);
        try {
            const program = update.student?.program || update.alumni?.program || "Unknown";
            const result = await analyzeUserUpdate(update.update_text, program);
            setAnalysis(result);
        } catch (e) {
            console.error("AI Analysis failed:", e);
        } finally {
            setAnalyzing(false);
        }
    }
  };

  // --- PROCESSING LOGIC ---

  const processUpdateItem = async (update: UserUpdate) => {
      let result = analysis;
      // If batch processing or not the currently selected/analyzed item, re-analyze
      if (!result || selectedUpdate?.id !== update.id) {
          const program = update.student?.program || update.alumni?.program || "Unknown";
          result = await analyzeUserUpdate(update.update_text, program);
      }

      const userId = update.student_id || update.alumni_id;
      if (!userId) throw new Error("User ID not found linked to this update.");

      const idColumn = update.student_id ? 'student_id' : 'alumni_id';
      const respondentType = update.student_id ? 'student' : 'alumni';

      // 1. Create survey wrapper
      const { data: survey, error: surveyError } = await supabase
          .from('survey_responses')
          .insert([{
              respondent_type: respondentType,
              [idColumn]: userId,
              submitted_at: new Date().toISOString()
          }])
          .select()
          .single();
      
      if (surveyError) throw surveyError;

      // 2. Logic Branch
      if (result.intent === 'RETIRE' || result.intent === 'UNEMPLOYED') {
          // Archive old active records
          const { data: activeRecords } = await supabase
              .from('employment_information')
              .select('*')
              .in('employment_status', ['Employed', 'Self-employed'])
              .in('survey_response_id', (
                  await supabase.from('survey_responses').select('id').eq(idColumn, userId)
              ).data?.map(s => s.id) || []);

          if (activeRecords && activeRecords.length > 0) {
              const historyPayloads = activeRecords.map(r => ({
                  survey_response_id: r.survey_response_id,
                  employment_status: r.employment_status,
                  position: r.current_position,
                  company_name: r.company_name,
                  company_address: r.company_address,
                  job_level: r.current_job_level,
                  date_hired: r.date_hired,
                  business_name: r.business_name,
                  business_address: r.business_address,
                  business_type: r.business_type,
                  industry: r.industry,
                  job_alignment: r.job_alignment,
                  is_current_job: false
              }));
              await supabase.from('employment_history').insert(historyPayloads);
              await supabase.from('employment_information').delete().in('id', activeRecords.map(r => r.id));
          }

          // Insert New Status
          await supabase.from('employment_information').insert([{
              survey_response_id: survey.id,
              employment_status: result.employment_status,
              unemployed_reasons: result.unemployed_reasons,
              retirement_reason: result.retirement_reason,
          }]);

      } else {
          // Add/Update Job
          // Cleanup conflicting inactive statuses
          const { data: inactiveRecords } = await supabase
              .from('employment_information')
              .select('id')
              .in('employment_status', ['Unemployed', 'Retired'])
              .in('survey_response_id', (
                  await supabase.from('survey_responses').select('id').eq(idColumn, userId)
              ).data?.map(s => s.id) || []);
          
          if (inactiveRecords && inactiveRecords.length > 0) {
              await supabase.from('employment_information').delete().in('id', inactiveRecords.map(r => r.id));
          }

          await supabase.from('employment_information').insert([{
              survey_response_id: survey.id,
              employment_status: result.employment_status,
              company_name: result.company_name,
              current_position: result.current_position,
              company_address: result.company_address,
              employment_type: result.employment_type,
              industry: result.industry,
              job_alignment: result.job_alignment,
              business_name: result.employment_status === 'Self-employed' ? result.company_name : null,
              business_address: result.employment_status === 'Self-employed' ? result.company_address : null,
          }]);
      }

      // 3. Email
      const userName = (update.student || update.alumni) 
          ? `${update.student?.first_name || update.alumni?.first_name} ${update.student?.last_name || update.alumni?.last_name}`
          : "Alumni";
          
      await sendUpdateAcknowledgementEmail(
          userName,
          update.email,
          result.intent === 'ADD_JOB' ? 'New Job Added' : result.intent === 'RETIRE' ? 'Retirement Recorded' : 'Status Updated'
      );

      // 4. Log to history (with more details)
      await supabase.from('acknowledgement_history').insert([{
          user_email: update.email,
          original_message: update.update_text,
          intent: result.intent,
          processed_by: 'System Admin',
          details: {
              company_name: result.company_name,
              current_position: result.current_position,
              company_address: result.company_address,
              employment_status: result.employment_status,
              industry: result.industry,
              job_alignment: result.job_alignment
          }
      }]);

      // 5. Delete
      await supabase.from('user_updates').delete().eq('id', update.id);
  };

  const handleApplySingle = async () => {
      if (!selectedUpdate) return;
      setProcessing(true);
      try {
          await processUpdateItem(selectedUpdate);
          alert("Update applied successfully!");
          setSelectedUpdate(null);
          setAnalysis(null);
          fetchUpdates();
      } catch (e: any) {
          alert("Failed to apply update: " + e.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleAcknowledgeAll = async () => {
      if (updates.length === 0) return;
      if (!window.confirm(`Are you sure you want to completely auto-process ALL ${updates.length} pending updates?`)) return;

      setProcessing(true);
      let successCount = 0;

      for (const update of updates) {
          try {
              await processUpdateItem(update);
              successCount++;
          } catch (e) {
              console.error(`Failed to process update ${update.id}`, e);
          }
      }

      alert(`Processed ${successCount}/${updates.length} updates.`);
      setProcessing(false);
      setSelectedIds(new Set());
      fetchUpdates();
      fetchHistory();
      setSelectedUpdate(null);
  };

  const handleBulkAcknowledge = async () => {
      if (selectedIds.size === 0) return;
      if (!window.confirm(`Are you sure you want to auto-process ${selectedIds.size} updates? This will apply AI-determined changes immediately.`)) return;

      setProcessing(true);
      const targets = updates.filter(u => selectedIds.has(u.id));
      let successCount = 0;

      for (const update of targets) {
          try {
              await processUpdateItem(update);
              successCount++;
          } catch (e) {
              console.error(`Failed to process update ${update.id}`, e);
          }
      }

      alert(`Processed ${successCount}/${targets.length} updates.`);
      setProcessing(false);
      setSelectedIds(new Set());
      fetchUpdates();
      setSelectedUpdate(null);
  };

  const handleAutoProcess = async () => {
      console.log("Auto-processing updates...");
  };

  // --- SELECTION ---

  const toggleSelect = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
      if (selectedIds.size === updates.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(updates.map(u => u.id)));
  };

  const handleCardDoubleClick = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSelect(id);
  };

  const isSelectionMode = selectedIds.size > 0;

  // --- DELETE ---

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
      if (!deleteModal.id) return;
      try {
          if (deleteModal.id === 'BULK') {
              const idsToDelete = Array.from(selectedIds);
              await supabase.from('user_updates').delete().in('id', idsToDelete);
              setSelectedIds(new Set());
              if (selectedUpdate && idsToDelete.includes(selectedUpdate.id)) {
                  setSelectedUpdate(null);
                  setAnalysis(null);
              }
          } else {
              await supabase.from('user_updates').delete().eq('id', deleteModal.id);
              if (selectedUpdate?.id === deleteModal.id) {
                  setSelectedUpdate(null);
                  setAnalysis(null);
              }
          }
          setDeleteModal({ isOpen: false, id: null });
          fetchUpdates();
      } catch (e) {
          alert("Failed to delete.");
      }
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-2">
        
        {/* Modern Header Toolbar (Glass - Pinkish) */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-pink-50/90 to-white/90 backdrop-blur-2xl p-5 rounded-[2rem] border border-white/60 shadow-lg shadow-pink-100/50 z-20 transition-all hover:shadow-xl">
            <div className="flex items-center gap-4 w-full md:w-auto mb-3 md:mb-0">
                <div className="p-3 bg-gradient-to-tr from-rose-500 to-pink-500 rounded-2xl shadow-lg shadow-pink-200 text-white">
                    <Inbox size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Update Inbox</h2>
                    <p className="text-xs font-bold text-pink-400 uppercase tracking-wider">{updates.length} Pending Requests</p>
                </div>
            </div>

            <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-200">
                <button 
                    onClick={() => setActiveTab('inbox')}
                    className={`flex items-center gap-2 px-5 py-2.5 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all duration-300 ${
                        activeTab === 'inbox' 
                        ? 'bg-white text-pink-600 shadow-sm border border-pink-100' 
                        : 'text-slate-500 hover:bg-white/50'
                    }`}
                >
                    <Inbox size={14} className={activeTab === 'inbox' ? 'animate-bounce' : ''} />
                    Pending Inbox
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-5 py-2.5 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all duration-300 ${
                        activeTab === 'history' 
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                        : 'text-slate-500 hover:bg-white/50'
                    }`}
                >
                    <Clock size={14} />
                    Processing History
                </button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                {selectedIds.size > 0 ? (
                    <div className="flex items-center gap-3 animate-in slide-in-from-right-6 fade-in duration-300 w-full md:w-auto bg-white/50 p-1.5 pr-2 rounded-2xl border border-white/60 shadow-sm">
                        <span className="text-xs font-black text-slate-600 px-3 bg-slate-100/50 py-2 rounded-xl">{selectedIds.size} Selected</span>
                        
                        <button 
                            onClick={handleBulkAcknowledge}
                            disabled={processing}
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all hover:-translate-y-0.5 active:scale-95"
                        >
                            {processing ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
                            <span className="hidden sm:inline">Approve Selected</span>
                        </button>
                        
                        <button 
                            onClick={() => setDeleteModal({ isOpen: true, id: 'BULK' })}
                            className="p-2.5 bg-red-500 text-white border border-red-400 rounded-xl hover:bg-red-600 transition-all shadow-sm hover:shadow-red-200"
                            title="Delete Selected"
                        >
                            <Trash2 size={16}/>
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 border-l border-pink-100 pl-4 ml-2">
                        {updates.length > 0 && activeTab === 'inbox' && (
                            <button 
                                onClick={handleAcknowledgeAll}
                                disabled={processing}
                                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl text-xs font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                            >
                                {processing ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle size={16}/>}
                                Acknowledge All ({updates.length})
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Content Split */}
        <div className="flex-grow flex flex-col md:flex-row gap-6 overflow-hidden h-full">
            
            {activeTab === 'inbox' && (
                <>
                    {/* LEFT: List Panel (Glass List) */}
                    <div className="w-full md:w-1/3 min-w-[360px] bg-white/30 backdrop-blur-xl rounded-[2.5rem] shadow-sm shadow-indigo-500/10 border border-white/50 flex flex-col overflow-hidden transition-all hover:bg-white/40 group/panel">
                        
                        {/* List Header */}
                        <div className="px-6 py-5 border-b border-white/40 flex justify-between items-center bg-white/20 backdrop-blur-md z-10">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                               <Clock size={14}/> Recent
                            </span>
                            <button 
                                onClick={handleSelectAll} 
                                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${selectedIds.size === updates.length && updates.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-white/50'}`}
                                disabled={updates.length === 0}
                            >
                                {selectedIds.size > 0 && selectedIds.size === updates.length ? <CheckSquare size={16}/> : <Square size={16}/>}
                                Select All
                            </button>
                        </div>

                        <div className="flex-grow overflow-y-auto p-4 pb-24 space-y-3 custom-scrollbar relative">
                            {loading ? (
                                <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-indigo-400"/></div>
                            ) : updates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                        <Inbox size={32} className="text-slate-300"/>
                                    </div>
                                    <p className="text-sm font-bold">All caught up!</p>
                                    <p className="text-xs">No pending updates.</p>
                                </div>
                            ) : (
                                updates.map(update => {
                                    const name = update.student 
                                        ? `${update.student.first_name} ${update.student.last_name}`
                                        : update.alumni 
                                            ? `${update.alumni.first_name} ${update.alumni.last_name}`
                                            : update.email;
                                    
                                    const isSelected = selectedIds.has(update.id);
                                    const isActive = selectedUpdate?.id === update.id;

                                    return (
                                        <div 
                                            key={update.id}
                                            onDoubleClick={(e) => handleCardDoubleClick(e, update.id)}
                                            onClick={() => handleSelectUpdate(update)}
                                            className={`relative p-5 rounded-2xl cursor-pointer transition-all duration-300 border group select-none overflow-hidden
                                                ${isActive 
                                                    ? 'bg-white border-pink-200 shadow-xl shadow-pink-500/10 ring-1 ring-pink-500/20 scale-[1.02] z-10' 
                                                    : 'bg-white/40 border-white/60 hover:bg-white hover:shadow-lg hover:border-pink-100 hover:scale-[1.01]'
                                                }
                                                ${isSelected ? 'bg-pink-50/80 ring-2 ring-pink-600 border-pink-600 shadow-pink-100' : ''}
                                            `}
                                        >
                                            {/* Decorative Background for Active Card */}
                                            {isActive && (
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50 pointer-events-none"></div>
                                            )}

                                            <div className="flex gap-4 relative z-10">
                                                {/* Selection Box */}
                                                <div 
                                                    className={`shrink-0 flex items-center justify-center transition-all duration-300 ${isSelectionMode ? 'w-6 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}
                                                    onClick={(e) => { e.stopPropagation(); toggleSelect(update.id); }}
                                                >
                                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-pink-600 border-pink-600 text-white shadow-md shadow-pink-300' : 'border-slate-200 bg-white hover:border-pink-400'}`}>
                                                        {isSelected && <Check size={12} strokeWidth={4} />}
                                                    </div>
                                                </div>

                                                <div className="flex-grow min-w-0 pr-6">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border transition-colors ${isActive ? 'bg-pink-500 text-white border-pink-400' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                                <User size={16} />
                                                            </div>
                                                            <div>
                                                                <h4 className={`font-black text-xs truncate ${isActive ? 'text-pink-900' : 'text-slate-800'}`}>{name.length > 25 ? name.substring(0, 25) + '...' : name}</h4>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                                    {update.student?.program || update.alumni?.program || 'General Alumni'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className={`mt-3 p-3 rounded-xl border transition-colors ${isActive ? 'bg-pink-50/30 border-pink-100/50' : 'bg-slate-900/[0.03] border-transparent group-hover:bg-slate-900/[0.05]'}`}>
                                                        <p className={`text-[11px] leading-relaxed italic ${isActive ? 'text-slate-600' : 'text-slate-500'} font-medium line-clamp-2`}>
                                                            "{update.update_text}"
                                                        </p>
                                                    </div>

                                                    <div className="mt-3 flex items-center gap-3">
                                                        <div className="flex items-center gap-1 py-0.5 px-2 bg-pink-50 rounded-md text-pink-600 border border-pink-100">
                                                            <Sparkles size={8} />
                                                            <span className="text-[8px] font-black uppercase tracking-wider">AI READY</span>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{new Date(update.submitted_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Delete Button */}
                                            <button 
                                                onClick={(e) => handleDeleteClick(update.id, e)}
                                                className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all z-20 group-hover:opacity-100"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* RIGHT: Detail & Action Panel (Glass Card) */}
            <div className="flex-1 bg-white/60 backdrop-blur-2xl rounded-[2.5rem] shadow-sm border border-white/60 p-0 flex flex-col relative overflow-hidden transition-all duration-500">
                
                {/* Background Decoration */}
                <div className="absolute -top-20 -right-20 w-96 h-96 bg-gradient-to-b from-indigo-100/40 to-transparent rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex-grow overflow-y-auto p-8 pb-32 custom-scrollbar relative z-10">
                    {selectedUpdate ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col min-h-full">
                            
                            {/* User Info Header with Colored Gradient - UPDATED: Pink Theme & White Avatar */}
                            <div className="flex justify-between items-start mb-8 p-6 bg-gradient-to-r from-pink-500 to-rose-500 rounded-3xl shadow-xl shadow-pink-200 text-white relative overflow-hidden shrink-0">
                                
                                {/* Decorative Background Blob */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                                <div className="flex items-center gap-5 relative z-10">
                                    {/* Avatar - Adjusted for pink header: White bg, Pink text */}
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-pink-600 font-black text-2xl shadow-lg shadow-black/5 ring-4 ring-white/20">
                                        {(selectedUpdate.student?.first_name || selectedUpdate.alumni?.first_name || 'U')[0]}
                                    </div>
                                    
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                                            {selectedUpdate.student ? `${selectedUpdate.student.first_name} ${selectedUpdate.student.last_name}` : selectedUpdate.alumni ? `${selectedUpdate.alumni.first_name} ${selectedUpdate.alumni.last_name}` : 'Unknown User'}
                                        </h2>
                                        
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <span className="text-[10px] font-bold text-white/80 flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm">
                                                <Mail size={10}/> {selectedUpdate.email} 
                                            </span>
                                            <span className="text-[10px] font-bold text-white/60 flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 backdrop-blur-sm">
                                                <Clock size={10}/> {new Date(selectedUpdate.submitted_at).toLocaleDateString()}
                                            </span>
                                            <span className="text-[10px] font-bold text-white/80 flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm">
                                                <GraduationCap size={10}/> {selectedUpdate.student?.program || selectedUpdate.alumni?.program || "Unknown Program"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setSelectedUpdate(null)} 
                                    className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors relative z-10"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* The Update Message Bubble (Limited Width for better read) */}
                            <div className="max-w-4xl w-full">
                                <div className="bg-gradient-to-br from-white to-slate-50 p-8 rounded-[2rem] border border-white shadow-lg shadow-slate-200/50 mb-8 relative group hover:shadow-xl transition-shadow">
                                    <div className="absolute -top-4 -left-4 bg-white p-2 rounded-2xl shadow-md border border-slate-100 text-pink-500">
                                        <MessageSquare size={24} fill="currentColor" className="opacity-90"/>
                                    </div>
                                    <p className="text-slate-700 italic text-xl leading-relaxed font-serif relative z-10">"{selectedUpdate.update_text}"</p>
                                </div>
                            </div>

                            {/* AI Analysis Section (Professional Glassmorphism) */}
                            <div className="flex-grow">
                                {analyzing ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[200px] animate-in fade-in">
                                        <div className="relative w-20 h-20 mb-6">
                                            <div className="absolute inset-0 border-[6px] border-slate-100 rounded-full"></div>
                                            <div className="absolute inset-0 border-[6px] border-t-pink-500 border-transparent rounded-full animate-spin"></div>
                                        </div>
                                        <p className="font-bold text-sm animate-pulse text-slate-500 uppercase tracking-widest">Analyzing Content...</p>
                                    </div>
                                ) : analysis ? (
                                    <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/60 p-8 shadow-sm shadow-indigo-500/5 relative overflow-hidden group hover:bg-white/60 transition-colors">
                                        
                                        {/* Header Badge - UPDATED: Removed Icon, Pink Badge */}
                                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200/50">
                                            <div className="flex items-center gap-3 text-pink-900 font-black uppercase text-xs tracking-[0.15em]">
                                                Proposed Action
                                                <span className="text-slate-400 font-normal normal-case ml-2 tracking-normal flex items-center gap-1">
                                                    <Clock size={12}/> {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} Analysis
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-pink-200 border border-pink-400">
                                                    {analysis.intent === 'ADD_JOB' ? 'Add Job' : 
                                                     analysis.intent === 'UPDATE_CURRENT' ? 'Update Job' :
                                                     analysis.intent === 'RETIRE' ? 'Retire' : 
                                                     analysis.intent === 'UNEMPLOYED' ? 'Unemployed' :
                                                     analysis.intent}
                                                </span>
                                                {analysis.job_alignment && (
                                                    <span className={`text-[10px] font-bold px-4 py-1.5 rounded-full border flex items-center gap-1.5 shadow-sm bg-white/80 backdrop-blur-sm ${
                                                        analysis.job_alignment === 'Related' ? 'text-emerald-700 border-emerald-200' :
                                                        analysis.job_alignment === 'Non-Related' ? 'text-amber-700 border-amber-200' :
                                                        'text-slate-500 border-slate-200'
                                                    }`}>
                                                        {analysis.job_alignment === 'Related' ? <Target size={12}/> : <AlertTriangle size={12}/>}
                                                        {analysis.job_alignment}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Grid Data */}
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-6 relative z-10">
                                            {/* Row 1: Status & Type */}
                                            <div className="space-y-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">New Status</span>
                                                <div className="font-bold text-slate-800 text-xl">{analysis.employment_status}</div>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Employment Type</span>
                                                {analysis.employment_type ? (
                                                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2 bg-white/50 w-fit px-3 py-1 rounded-lg border border-slate-100 shadow-sm">
                                                        <Clock size={14} className="text-slate-400"/> {analysis.employment_type}
                                                    </div>
                                                ) : (
                                                     <div className="text-slate-400 text-sm font-medium italic">--</div>
                                                )}
                                            </div>

                                            {/* Only show Rows 2 & 3 if status implies employment, otherwise it looks cluttered for Unemployed/Retired */}
                                            {(analysis.employment_status === 'Employed' || analysis.employment_status === 'Self-employed') && (
                                                <>
                                                    {/* Row 2: Company & Position */}
                                                    <div className="space-y-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Company / Business</span>
                                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                            <div className="p-1 bg-white rounded text-slate-500 shadow-sm"><Building2 size={14}/></div> 
                                                            <span className="truncate">{analysis.company_name || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Position</span>
                                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                            <div className="p-1 bg-white rounded text-slate-500 shadow-sm"><Briefcase size={14}/></div> 
                                                            <span className="truncate">{analysis.current_position || 'N/A'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Row 3: Industry & Location */}
                                                    <div className="space-y-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Industry</span>
                                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                            <div className="p-1 bg-white rounded text-slate-500 shadow-sm"><Layers size={14}/></div> 
                                                            <span className="truncate">{analysis.industry || 'N/A'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Location</span>
                                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                            <div className="p-1 bg-white rounded text-slate-500 shadow-sm"><MapPin size={14}/></div> 
                                                            <span className="truncate">{analysis.company_address || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            
                                            {/* Logic to hide reasons if adding a job (focus on positive action) or if related */}
                                            {(analysis.intent === 'UNEMPLOYED' || analysis.intent === 'RETIRE') && (analysis.unemployed_reasons || analysis.retirement_reason) && (
                                                <div className="col-span-2 space-y-2 bg-red-50/50 p-5 rounded-2xl border border-red-100/60 mt-2">
                                                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">Reason Provided</span>
                                                    <div className="font-bold text-red-700 text-sm italic">
                                                        "{analysis.unemployed_reasons || analysis.retirement_reason}"
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Decorative BG */}
                                        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-b from-indigo-50 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 -z-0 opacity-50"></div>
                                    </div>
                                ) : (
                                    <div className="text-center text-red-400 mt-10 text-sm font-medium bg-red-50 p-6 rounded-2xl border border-red-100 border-dashed">
                                        Analysis Failed. Please try re-selecting the update.
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                            <div className="w-32 h-32 bg-gradient-to-b from-white to-slate-50 rounded-full flex items-center justify-center mb-8 shadow-inner border border-white">
                                <Mail size={64} className="text-slate-200"/>
                            </div>
                            <p className="font-black text-2xl text-slate-300 tracking-tight">Select an update</p>
                            <p className="text-sm text-slate-400 font-medium mt-2">AI will automatically analyze the content</p>
                        </div>
                    )}
                </div>

                {/* Floating Action Buttons (Sticky Bottom) */}
                {selectedUpdate && (
                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white/95 to-white/90 z-20 border-t border-white/60">
                        <div className="flex gap-4">
                            <button 
                                onClick={handleApplySingle}
                                disabled={processing || !analysis}
                                className="flex-1 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-pink-200 hover:shadow-2xl hover:shadow-pink-300 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                {processing ? <Loader2 className="animate-spin" /> : (
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="p-1 bg-white/20 rounded-full text-white"><Check size={14} strokeWidth={4}/></div>
                                        <span>Acknowledge & Apply</span>
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform opacity-80"/>
                                    </div>
                                )}
                            </button>
                            <button 
                                onClick={(e) => handleDeleteClick(selectedUpdate.id, e)}
                                disabled={processing}
                                className="px-6 bg-white border-2 border-slate-100 text-slate-400 font-bold py-4 rounded-2xl hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm flex items-center gap-2 group"
                                title="Delete Request"
                            >
                                <Trash2 size={20} className="group-hover:scale-110 transition-transform"/>
                            </button>
                        </div>
                    </div>
                )}
            </div>
            </>
            )}

            {activeTab === 'history' && (
                <div className="w-full h-full bg-white/40 backdrop-blur-xl rounded-[2.5rem] shadow-sm shadow-indigo-500/10 border border-white/50 flex flex-col overflow-hidden transition-all p-6">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200 py-2">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-pink-50 rounded-2xl text-pink-500">
                                <History size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Processing History</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logs of recently acknowledged updates</p>
                            </div>
                        </div>
                        <div className="text-xs font-bold text-slate-400 flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                            <Activity size={14} className="text-emerald-500"/> System Operations Log
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 pb-10">
                        {historyLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                <Clock size={48} className="mb-4" />
                                <p className="font-bold">No history available yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-w-6xl mx-auto">
                                {historyLogs.map(log => (
                                    <div key={log.id} className="bg-white border-l-4 border-l-pink-500 border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden rounded-2xl">
                                        <div className="p-6">
                                            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-4 rounded-xl shadow-sm border ${
                                                        log.intent === 'ADD_JOB' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                                        log.intent === 'RETIRE' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                        log.intent === 'UNEMPLOYED' ? 'bg-red-50 text-red-600 border-red-100' :
                                                        'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                    }`}>
                                                        {log.intent === 'ADD_JOB' ? <Briefcase size={20}/> : 
                                                         log.intent === 'RETIRE' ? <GraduationCap size={20}/> :
                                                         log.intent === 'UNEMPLOYED' ? <AlertTriangle size={20}/> :
                                                         <Target size={20}/>}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-slate-800 font-mono tracking-tight text-base flex items-center gap-2">
                                                            {log.user_email}
                                                            {log.details?.job_alignment === 'Related' && <CheckCircle size={14} className="text-emerald-500" title="Course Related" />}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <div className="flex items-center gap-1.5 py-0.5 px-2 bg-slate-100 rounded-md">
                                                                <User size={10} className="text-slate-400"/>
                                                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider">
                                                                    Admin: {log.processed_by}
                                                                </span>
                                                            </div>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold">
                                                                <Calendar size={10}/>
                                                                {new Date(log.processed_at).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className={`text-[10px] font-black px-4 py-1.5 rounded-lg border shadow-sm tracking-[0.1em] uppercase ${
                                                        log.intent === 'ADD_JOB' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                                        log.intent === 'RETIRE' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                        'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                    }`}>
                                                        {log.intent.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Detailed Stats Grid */}
                                            {log.details && (log.details.company_name || log.details.current_position) && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                                                    {log.details.company_name && (
                                                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 group-hover:bg-indigo-50/20 transition-colors">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Entity</span>
                                                            <div className="flex items-center gap-2 text-slate-700">
                                                                <Building2 size={12} className="text-indigo-400 shrink-0" />
                                                                <span className="text-xs font-bold truncate">{log.details.company_name}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {log.details.current_position && (
                                                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 group-hover:bg-indigo-50/20 transition-colors">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Position</span>
                                                            <div className="flex items-center gap-2 text-slate-700">
                                                                <Briefcase size={12} className="text-indigo-400 shrink-0" />
                                                                <span className="text-xs font-bold truncate">{log.details.current_position}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {log.details.company_address && (
                                                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 group-hover:bg-indigo-50/20 transition-colors">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Region</span>
                                                            <div className="flex items-center gap-2 text-slate-700">
                                                                <MapPin size={12} className="text-indigo-400 shrink-0" />
                                                                <span className="text-xs font-bold truncate">{log.details.company_address}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {log.details.employment_status && (
                                                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 group-hover:bg-indigo-50/20 transition-colors">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Final Status</span>
                                                            <div className="flex items-center gap-2 text-slate-700">
                                                                <CheckSquare size={12} className="text-indigo-400 shrink-0" />
                                                                <span className="text-xs font-bold truncate">{log.details.employment_status}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="bg-slate-900/[0.02] p-5 rounded-xl border border-slate-100/50 relative overflow-hidden group-hover:bg-slate-900/[0.04] transition-colors">
                                                <div className="absolute top-0 right-0 p-2 opacity-[0.03] -mr-2 -mt-2">
                                                    <MessageSquare size={80} />
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block">Data Source</span>
                                                </div>
                                                <p className="text-xs text-slate-600 italic leading-relaxed relative z-10 font-medium pl-3 border-l-2 border-slate-200">"{log.original_message}"</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteModal.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setDeleteModal({isOpen: false, id: null})}></div>
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm relative z-10 p-8 animate-in zoom-in-95 duration-200 border border-white/40 ring-1 ring-black/5">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-red-50">
                            <Trash2 size={36} />
                        </div>
                        <h3 className="font-black text-2xl text-slate-800 mb-3">Delete {deleteModal.id === 'BULK' ? 'Selection' : 'Message'}?</h3>
                        <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">
                            This action cannot be undone. The update(s) will be permanently removed from the inbox.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteModal({isOpen: false, id: null})} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl text-sm hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={confirmDelete} className="flex-1 py-3.5 bg-red-500 text-white font-bold rounded-2xl text-sm hover:bg-red-600 shadow-lg shadow-red-200 transition-all">Yes, Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default InboxPage;
