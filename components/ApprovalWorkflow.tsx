
import React, { useState, useEffect } from 'react';
import { CheckCircle, Search, Settings, Loader2, Mail, CheckSquare, Square, X, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Student } from '../types';
import { sendApprovalEmail, initEmailService } from '../services/emailService';

interface ApprovalWorkflowProps {
  onUpdate: () => void;
}

const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({ onUpdate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Auto-Approval Config State
  const [autoDate, setAutoDate] = useState('');
  const [autoYear, setAutoYear] = useState(new Date().getFullYear().toString());
  const [isAutoEnabled, setIsAutoEnabled] = useState(false);

  useEffect(() => {
    initEmailService();
    fetchCandidates();
    loadAutoConfig();
  }, []);

  const loadAutoConfig = () => {
    const savedConfig = localStorage.getItem('lu_auto_approval_config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setAutoDate(config.date);
      setAutoYear(config.year);
      setIsAutoEnabled(config.enabled);
      
      // Check if we should run auto-approval now
      if (config.enabled && config.date) {
        const targetDate = new Date(config.date);
        const today = new Date();
        if (today >= targetDate) {
          runAutoApproval(config.year);
        }
      }
    }
  };

  const saveAutoConfig = () => {
    const config = { date: autoDate, year: autoYear, enabled: true };
    localStorage.setItem('lu_auto_approval_config', JSON.stringify(config));
    setIsAutoEnabled(true);
    setShowConfigModal(false);
    alert(`Auto-approval scheduled for ${autoDate}`);
  };

  const fetchCandidates = async () => {
    setLoading(true);
    // Fetch only users from 'students' table who are 'Graduating' and NOT yet 'Alumni'
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .neq('enrollment_status', 'Alumni') 
      .order('last_name', { ascending: true });

    if (!error && data) {
      setStudents(data as Student[]);
    }
    setLoading(false);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map(s => s.id!)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const runAutoApproval = async (targetYear: string) => {
    console.log("Running Auto Approval...");
    const { data } = await supabase
      .from('students')
      .select('*')
      .neq('enrollment_status', 'Alumni');
    
    if (data && data.length > 0) {
      const ids = data.map(s => s.id);
      await executeApproval(ids, targetYear, true);
      const config = { date: autoDate, year: autoYear, enabled: false };
      localStorage.setItem('lu_auto_approval_config', JSON.stringify(config));
      setIsAutoEnabled(false);
    }
  };

  const executeApproval = async (ids: string[], targetYear: string, isAuto = false) => {
    setProcessing(true);
    let successCount = 0;
    
    const targets = students.filter(s => ids.includes(s.id!)) || [];
    
    try {
      const { error } = await supabase
        .from('students')
        .update({ 
          enrollment_status: 'Alumni',
          year_level: targetYear 
        })
        .in('id', ids);

      if (error) throw error;

      for (const student of targets) {
        if (student.email) {
          await sendApprovalEmail(
            `${student.first_name} ${student.last_name}`,
            student.email,
            student.program
          );
          successCount++;
        }
      }

      if (!isAuto) {
        alert(`Successfully approved ${ids.length} students. Sent ${successCount} emails.`);
        setShowConfirmModal(false);
        setSelectedIds(new Set());
        fetchCandidates();
        onUpdate();
      } else {
        console.log(`Auto-approved ${ids.length} students.`);
        fetchCandidates();
      }

    } catch (err: any) {
      console.error("Approval Error:", err);
      if (!isAuto) alert("Failed to approve students: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredStudents = students.filter(student => 
    student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_number.includes(searchTerm)
  );

  return (
    <>
    <div className="space-y-6 animate-fade-in pb-10">
       
        {/* --- Header Section (Glass) --- */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-lg shadow-emerald-500/5">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Pending Approvals</h2>
                <p className="text-slate-500 mt-1">Review and approve graduating students for alumni status.</p>
            </div>
            
            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-center">
                {/* Search */}
                <div className="relative group w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search candidates..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                    />
                </div>

                {/* Auto Config Btn */}
                <button 
                   onClick={() => setShowConfigModal(true)}
                   className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border shadow-sm ${isAutoEnabled ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}
                 >
                    <Settings size={16} />
                    {isAutoEnabled ? 'Auto On' : 'Configure'}
                 </button>

                 {/* Approve Btn */}
                 <button 
                   onClick={() => setShowConfirmModal(true)}
                   disabled={selectedIds.size === 0}
                   className="flex-grow sm:flex-initial w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                 >
                    <CheckCircle size={18} />
                    Approve ({selectedIds.size})
                 </button>
            </div>
       </div>

       {/* Candidates Table (Glass) */}
       <div className="bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 shadow-lg shadow-emerald-500/5 overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 backdrop-blur-md border-b border-white/50">
                   <tr>
                      <th className="px-6 py-5 w-12">
                         <button onClick={handleSelectAll} className="text-slate-400 hover:text-emerald-500 transition-colors">
                            {selectedIds.size > 0 && selectedIds.size === students.length ? <CheckSquare size={20} /> : <Square size={20} />}
                         </button>
                      </th>
                      <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Candidate</th>
                      <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Program</th>
                      <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">ID Number</th>
                      <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Status</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50/30">
                   {loading ? (
                      <tr>
                          <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                              <div className="flex flex-col items-center">
                                  <Loader2 className="w-8 h-8 animate-spin mb-2 opacity-50" />
                                  <span className="text-sm font-medium">Loading candidates...</span>
                              </div>
                          </td>
                      </tr>
                   ) : filteredStudents.length === 0 ? (
                      <tr>
                          <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                              <div className="flex flex-col items-center">
                                  <CheckCircle className="w-10 h-10 mb-2 opacity-30" />
                                  <span className="text-sm font-medium">No pending approvals found.</span>
                              </div>
                          </td>
                      </tr>
                   ) : (
                      filteredStudents.map(student => (
                         <tr 
                            key={student.id} 
                            className={`transition-colors cursor-pointer group ${selectedIds.has(student.id!) ? 'bg-emerald-50/60' : 'hover:bg-white/40'}`} 
                            onClick={() => handleSelectOne(student.id!)}
                         >
                            <td className="px-6 py-4">
                               <button onClick={(e) => { e.stopPropagation(); handleSelectOne(student.id!); }} className={`${selectedIds.has(student.id!) ? 'text-emerald-500' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                  {selectedIds.has(student.id!) ? <CheckSquare size={20} /> : <Square size={20} />}
                               </button>
                            </td>
                            <td className="px-6 py-4">
                               <div className="font-bold text-slate-800">{student.last_name}, {student.first_name}</div>
                               <div className="text-xs text-slate-500">{student.email}</div>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-600">{student.program}</td>
                            <td className="px-6 py-4">
                                <span className="text-xs font-mono text-slate-500 bg-white/50 px-1.5 py-0.5 rounded border border-white/50">{student.student_number}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">
                                  Pending
                               </span>
                            </td>
                         </tr>
                      ))
                   )}
                </tbody>
             </table>
          </div>
       </div>
    </div>

       {/* Confirm Approval Modal */}
       {showConfirmModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowConfirmModal(false)}></div>
             <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-md relative z-10 p-8 border border-white/50 animate-in zoom-in-95 duration-300 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-inner">
                   <Mail size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Confirm Approval</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                   You are about to approve <strong>{selectedIds.size} student(s)</strong>. 
                   This will convert their status to <strong>Verified Alumni</strong> and send automated notification emails.
                </p>
                <div className="flex gap-3">
                   <button 
                     onClick={() => setShowConfirmModal(false)}
                     disabled={processing}
                     className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors"
                   >
                      Cancel
                   </button>
                   <button 
                     onClick={() => executeApproval(Array.from(selectedIds), new Date().getFullYear().toString())}
                     disabled={processing}
                     className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                   >
                      {processing ? <Loader2 className="animate-spin" size={20} /> : 'Yes, Approve'}
                   </button>
                </div>
             </div>
          </div>
       )}

       {/* Auto-Approval Config Modal */}
       {showConfigModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowConfigModal(false)}></div>
             <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-md relative z-10 p-8 border border-white/50 animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Settings className="text-indigo-500" size={20} /> Auto-Approval
                   </h3>
                   <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
                </div>
                
                <div className="space-y-5 mb-8">
                   <div className="bg-indigo-50/80 p-4 rounded-xl text-xs font-medium text-indigo-800 leading-relaxed border border-indigo-100 flex gap-3">
                      <Settings className="shrink-0 mt-0.5" size={16}/>
                      <p>When the scheduled date is reached, all "Graduating" students will automatically be converted to "Alumni" status and receive notification emails.</p>
                   </div>
                   
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Scheduled Date</label>
                      <input 
                         type="date" 
                         value={autoDate}
                         onChange={e => setAutoDate(e.target.value)}
                         className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      />
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Target Alumni Year</label>
                      <input 
                         type="text" 
                         value={autoYear}
                         onChange={e => setAutoYear(e.target.value)}
                         className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      />
                   </div>
                </div>

                <button 
                  onClick={saveAutoConfig}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
                >
                   Save Configuration
                </button>
             </div>
          </div>
       )}
    </>
  );
};

export default ApprovalWorkflow;