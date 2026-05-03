
import React, { useState, useEffect, useRef } from 'react';
import { GraduationCap, Users, Search, RefreshCw, Trash2, Edit, X, Save, AlertTriangle, Loader2, CheckSquare, Square, Send, Mail, Clock, Settings, Calendar, ChevronDown, Check, Bell, Eye } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Student } from '../types';
import { sendFollowUpEmail, initEmailService } from '../services/emailService';

// --- HELPERS ---
const getActivityStatus = (dateString?: string) => {
    if (!dateString) return { text: 'Unknown', color: 'bg-slate-50 text-slate-500 border-slate-200', isInactive: false, days: 0 };
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const textFormat = diffDays === 0 ? 'Today' : `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    // Inactive if they haven't updated for approximately 6 months (180 days)
    if (diffDays < 180) {
        return { text: textFormat, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', isInactive: false, days: diffDays };
    } else {
        return { text: textFormat, color: 'bg-red-50 text-red-700 border-red-200', isInactive: true, days: diffDays };
    }
};

import { COURSES, normalizeProgram, normalizeBatchYear } from '../lib/normalization';

// --- Custom Dropdown Component ---
const CustomDropdown = ({ 
    options, 
    value, 
    onChange, 
    label 
}: { 
    options: string[], 
    value: string, 
    onChange: (val: string) => void, 
    label: string 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full pl-4 pr-10 py-2.5 text-left bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-indigo-300 transition-all flex items-center justify-between min-h-[46px]"
            >
                <div className="flex flex-col overflow-hidden">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider leading-tight">{label}</span>
                    <span className="text-sm font-bold text-slate-700 truncate block">{value === 'All' ? `All ${label === 'Batch' ? 'Batches' : 'Programs'}` : value}</span>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <ul className="max-h-[250px] overflow-y-auto custom-scrollbar p-1">
                        <li 
                            onClick={() => { onChange("All"); setIsOpen(false); }}
                            className={`px-3 py-2 rounded-lg text-sm font-bold cursor-pointer flex items-center justify-between ${value === 'All' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <span>All {label === "Batch" ? "Batches" : "Programs"}</span>
                            {value === 'All' && <Check size={14} />}
                        </li>
                        {options.map((opt) => (
                            <li 
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false); }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer flex items-center justify-between ${value === opt ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <span className="truncate pr-2">{opt}</span>
                                {value === opt && <Check size={14} className="shrink-0" />}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const UserManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedCourse, setSelectedCourse] = useState('All');
  const years = Array.from({length: 20}, (_, i) => (2026 - i).toString());

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  // Follow Up Modal State
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpFrequency, setFollowUpFrequency] = useState<'Monthly' | 'Quarterly' | 'Semi-Annually' | 'Yearly'>('Semi-Annually');
  
  // Auto-Config State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [autoConfig, setAutoConfig] = useState({
    enabled: false,
    frequency: 'Semi-Annually',
    nextRun: ''
  });

  const [selectedUser, setSelectedUser] = useState<Student | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Student>>({});
  const [processing, setProcessing] = useState(false);
  
  // Custom Toast State
  const [toastMessage, setToastMessage] = useState<{title: string, message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  useEffect(() => {
    if (toastMessage) {
        const timer = setTimeout(() => setToastMessage(null), 5000);
        return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToastMessage({ title, message, type });
  };

  useEffect(() => {
    initEmailService();
    loadAutoConfig();
  }, []);

  const loadAutoConfig = () => {
    const stored = localStorage.getItem('lu_auto_followup');
    if (stored) {
        const config = JSON.parse(stored);
        setAutoConfig(config);
        checkAutoRun(config);
    }
  };

  const checkAutoRun = async (config: any) => {
      if (config.enabled && config.nextRun) {
          const today = new Date();
          const runDate = new Date(config.nextRun);
          
          today.setHours(0,0,0,0);
          runDate.setHours(0,0,0,0);

          if (today >= runDate) {
              console.log("Running Scheduled Follow-Ups...");
              await performAutoFollowUp(config);
          }
      }
  };

  const performAutoFollowUp = async (currentConfig: any, manualTrigger: boolean = false) => {
      setProcessing(true);
      const { data } = await supabase.from('alumni').select('*, survey_responses(submitted_at)')
        .order('submitted_at', { referencedTable: 'survey_responses', ascending: false })
        .limit(1, { referencedTable: 'survey_responses' });
        
      if (!data || data.length === 0) {
          setProcessing(false);
          return;
      }

      const inactiveAlumni = data.filter(alum => {
          const latestSurvey = (alum.survey_responses as any)?.[0]?.submitted_at;
          const status = getActivityStatus(latestSurvey || alum.updated_at || alum.created_at);
          return status.isInactive;
      });

      let sent = 0;
      for (const alum of inactiveAlumni) {
          if (alum.email) {
              await sendFollowUpEmail(`${alum.first_name} ${alum.last_name}`, alum.email, currentConfig.frequency || 'Profile Update Reminder');
              sent++;
          }
      }

      const nextDate = new Date();
      if (currentConfig.frequency === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1);
      if (currentConfig.frequency === 'Quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
      if (currentConfig.frequency === 'Semi-Annually') nextDate.setMonth(nextDate.getMonth() + 6);
      if (currentConfig.frequency === 'Yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

      const newConfig = { ...currentConfig, nextRun: nextDate.toISOString().split('T')[0] };
      localStorage.setItem('lu_auto_followup', JSON.stringify(newConfig));
      setAutoConfig(newConfig);
      setProcessing(false);
      showToast("Auto-Follow Up Complete", `Sent ${sent} automatic update reminders to users inactive for >6 months. Next run: ${newConfig.nextRun}`, "success");
      
      if (manualTrigger) {
          setIsConfigModalOpen(false);
      }
  };

  const saveAutoConfig = () => {
      const nextDate = new Date();
      if (autoConfig.enabled && !autoConfig.nextRun) {
          if (autoConfig.frequency === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          if (autoConfig.frequency === 'Quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
          if (autoConfig.frequency === 'Semi-Annually') nextDate.setMonth(nextDate.getMonth() + 6);
          if (autoConfig.frequency === 'Yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
          autoConfig.nextRun = nextDate.toISOString().split('T')[0];
      } else if (!autoConfig.enabled) {
          autoConfig.nextRun = '';
      }

      localStorage.setItem('lu_auto_followup', JSON.stringify(autoConfig));
      setIsConfigModalOpen(false);
      showToast("Configuration Saved", autoConfig.enabled ? `Auto-sending enabled. Next run: ${autoConfig.nextRun}` : 'Auto-sending disabled.', "info");
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    // Reset selection when refreshing or changing tabs
    setSelectedIds(new Set());
    
    // Fetch from both tables
    const [studentsRes, alumniRes] = await Promise.all([
      supabase
        .from('students')
        .select('*, survey_responses(submitted_at)')
        .order('submitted_at', { referencedTable: 'survey_responses', ascending: false })
        .limit(1, { referencedTable: 'survey_responses' }),
      supabase
        .from('alumni')
        .select('*, survey_responses(submitted_at)')
        .order('submitted_at', { referencedTable: 'survey_responses', ascending: false })
        .limit(1, { referencedTable: 'survey_responses' })
    ]);

    let combinedData: any[] = [];
    if (studentsRes.data) combinedData = [...combinedData, ...studentsRes.data.map(d => ({ ...d, table_source: 'students' }))];
    if (alumniRes.data) combinedData = [...combinedData, ...alumniRes.data.map(d => ({ ...d, table_source: 'alumni' }))];

    // Sort combined data by last_name
    combinedData.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));

    const normalizedData = combinedData.map(item => ({
      ...item,
      program: normalizeProgram(item.program),
      year_level: normalizeBatchYear(item.year_level)
    }));
    
    setStudents(normalizedData as Student[]);
    setLoadingUsers(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- Selection Handlers ---
  const handleSelectAll = () => {
    const filtered = students.filter(student => {
      const matchesSearch = 
        student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_number.includes(searchTerm);
      
      const matchesYear = selectedYear === 'All' || student.year_level === selectedYear;
      const matchesCourse = selectedCourse === 'All' || student.program === selectedCourse;

      return matchesSearch && matchesYear && matchesCourse;
    });

    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id!)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // --- Action Handlers ---

  const handleViewClick = (student: Student) => {
    setSelectedUser(student);
    setIsViewModalOpen(true);
  };

  const handleEditClick = (student: Student) => {
    setSelectedUser(student);
    setEditFormData({
      first_name: student.first_name,
      last_name: student.last_name,
      student_number: student.student_number,
      program: student.program,
      year_level: student.year_level,
      email: student.email,
      contact_no: student.contact_no
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (student: Student) => {
    setSelectedUser(student);
    setIsDeleteModalOpen(true);
  };

  const handleSendReminder = (student: Student) => {
    setSelectedUser(student);
    setIsReminderModalOpen(true);
  };

  const confirmSendReminder = async () => {
    if (!selectedUser?.email) {
      showToast("Missing Email", "This user does not have a registered email address.", "error");
      return;
    }
    setProcessing(true);
    try {
      await sendFollowUpEmail(
        `${selectedUser.first_name} ${selectedUser.last_name}`,
        selectedUser.email,
        'Profile Update Reminder'
      );
      showToast("Reminder Sent", `Notification successfully sent to ${selectedUser.email}`, "success");
      setIsReminderModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error("Failed to send reminder:", err);
      showToast("Delivery Failed", "An error occurred while sending the notification.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkFollowUp = async () => {
    setProcessing(true);
    let successCount = 0;
    const targets = students.filter(s => selectedIds.has(s.id!));

    try {
      for (const student of targets) {
        if (student.email) {
          await sendFollowUpEmail(
            `${student.first_name} ${student.last_name}`,
            student.email,
            followUpFrequency
          );
          successCount++;
        }
      }
      showToast("Bulk Action Complete", `Follow-up emails sent successfully to ${successCount} alumni.`, "success");
      setIsFollowUpModalOpen(false);
      setSelectedIds(new Set());
    } catch (error) {
      console.error(error);
      showToast("Action Failed", "An error occurred while sending emails.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedUser) return;
    setProcessing(true);
    try {
      const table = selectedUser.table_source || 'students';
      
      const dataToSave = {
          ...editFormData,
          program: normalizeProgram(editFormData.program),
          year_level: normalizeBatchYear(editFormData.year_level)
      };

      const { error } = await supabase
        .from(table)
        .update(dataToSave)
        .eq('id', selectedUser.id);

      if (error) throw error;

      await fetchUsers();
      setIsEditModalOpen(false);
      setSelectedUser(null);
      showToast("Account Updated", "User details were successfully saved.", "success");
    } catch (err) {
      console.error("Update failed:", err);
      showToast("Update Failed", "Failed to save user details.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;
    setProcessing(true);
    try {
      const table = selectedUser.table_source || 'students';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;

      await fetchUsers();
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      showToast("Account Deleted", "User has been permanently removed.", "success");
    } catch (err) {
      console.error("Delete failed:", err);
      showToast("Delete Failed", "Failed to delete the record.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
        student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_number.includes(searchTerm);
    
    const matchesYear = selectedYear === 'All' || student.year_level === selectedYear;
    const matchesCourse = selectedCourse === 'All' || student.program === selectedCourse;

    return matchesSearch && matchesYear && matchesCourse;
  });

  // Calculate Statistics
  const totalUsers = filteredStudents.length;
  const activeCount = filteredStudents.filter(s => {
      const latestSurvey = (s as any).survey_responses?.[0]?.submitted_at;
      const status = getActivityStatus(latestSurvey || (s as any).updated_at || (s as any).created_at);
      return !status.isInactive;
  }).length;
  const inactiveCount = totalUsers - activeCount;

  return (
    <>
    <div className="space-y-6 animate-fade-in pb-10">
        
        {/* --- Header Section (Glass) --- */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-lg shadow-indigo-500/5 relative z-30">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
                <p className="text-slate-500 mt-1">Manage new graduates and alumni records.</p>
            </div>
            
            {/* Filter & Action Bar */}
            <div className="flex flex-col lg:flex-row gap-3 w-full xl:w-auto items-end lg:items-center">
                
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="w-full sm:w-40">
                        <CustomDropdown label="Batch" options={years} value={selectedYear} onChange={setSelectedYear} />
                    </div>
                    <div className="w-full sm:w-60">
                        <CustomDropdown label="Program" options={COURSES} value={selectedCourse} onChange={setSelectedCourse} />
                    </div>
                </div>

                {/* Search & Refresh */}
                <div className="flex gap-3 w-full sm:w-auto">
                    <div className="relative group flex-grow sm:flex-grow-0 sm:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search name or ID..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm h-[46px]"
                        />
                    </div>

                    <button 
                        onClick={fetchUsers}
                        className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm h-[46px] w-[46px] flex items-center justify-center"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${loadingUsers ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
        </div>

        {/* --- Top Statistics Cards --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-20">
            <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-white/50 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Found</p>
                    <h3 className="text-2xl font-black text-slate-800">{totalUsers}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-100">
                    <Users size={24} />
                </div>
            </div>
            
            <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-white/50 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Active Users</p>
                    <h3 className="text-2xl font-black text-slate-800">{activeCount}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-100">
                    <CheckSquare size={24} />
                </div>
            </div>

            <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-white/50 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Inactive Users</p>
                    <h3 className="text-2xl font-black text-slate-800">{inactiveCount}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm border border-amber-100">
                    <Clock size={24} />
                </div>
            </div>

            <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-white/50 shadow-sm flex flex-col justify-center">
                 <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Auto-Reminders</p>
                        <h3 className={`text-sm font-bold ${autoConfig.enabled ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {autoConfig.enabled ? `Next: ${autoConfig.nextRun || 'Pending'}` : 'Disabled'}
                        </h3>
                    </div>
                </div>
            </div>
        </div>

        {/* --- Tabs & Actions Row --- */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 relative z-20">
            {/* Tabs removed */}
            <div className="flex gap-4">
            </div>

            {/* Right Side Actions */}
            <div className="flex gap-3 w-full md:w-auto">
                <button 
                    onClick={() => setIsConfigModalOpen(true)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border shadow-sm ${autoConfig.enabled ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}
                >
                    <Settings size={16} /> 
                    {autoConfig.enabled ? 'Auto On' : 'Configure'}
                </button>

                <button 
                    onClick={() => setIsFollowUpModalOpen(true)}
                    disabled={selectedIds.size === 0}
                    className="flex-grow sm:flex-initial w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                >
                    <Send size={16} /> 
                    Send Follow Up ({selectedIds.size})
                </button>
            </div>
        </div>

        {/* --- Table Section (Glass) --- */}
        <div className="bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 shadow-lg shadow-indigo-500/5 overflow-hidden min-h-[400px] relative z-10">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 backdrop-blur-md border-b border-white/50">
                        <tr>
                            <th className="px-6 py-5 w-12">
                                <button onClick={handleSelectAll} className="text-slate-400 hover:text-indigo-500 transition-colors">
                                    {selectedIds.size > 0 && selectedIds.size === filteredStudents.length ? <CheckSquare size={20} /> : <Square size={20} />}
                                </button>
                            </th>
                            <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Student Info</th>
                            <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Program & Batch</th>
                            <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Contact Details</th>
                            <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                            <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Activity Status</th>
                            <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-50/30">
                        {loadingUsers ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-20 text-center text-slate-400">
                                    <div className="flex flex-col items-center">
                                        <Loader2 className="w-8 h-8 animate-spin mb-2 opacity-50" />
                                        <span className="text-sm font-medium">Loading records...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredStudents.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-20 text-center text-slate-400">
                                    <div className="flex flex-col items-center">
                                        <Users className="w-10 h-10 mb-2 opacity-30" />
                                        <span className="text-sm font-medium">No records found.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredStudents.map((student, index) => (
                                <tr 
                                  key={index} 
                                  className={`transition-colors group cursor-pointer ${selectedIds.has(student.id!) ? 'bg-indigo-50/60' : 'hover:bg-white/40'}`}
                                  onClick={() => handleSelectOne(student.id!)}
                                >
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => handleSelectOne(student.id!)} className={`${selectedIds.has(student.id!) ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                            {selectedIds.has(student.id!) ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md ${student.table_source === 'students' ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-purple-400 to-indigo-500'}`}>
                                                {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                                    {student.last_name}, {student.first_name}
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleViewClick(student); }}
                                                        className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="View Full Profile"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </div>
                                                <div className="text-xs font-mono text-slate-500 bg-white/50 px-1.5 py-0.5 rounded border border-white/50 inline-block mt-1">
                                                    {student.student_number}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-slate-700">{student.program}</div>
                                        <div className="text-xs text-slate-500 mt-1">Batch {student.year_level}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-600">{student.email || 'No Email'}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{student.contact_no || 'No Contact'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-sm ${
                                            student.enrollment_status === 'Alumni' 
                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                            : 'bg-green-50 text-green-700 border-green-200'
                                        }`}>
                                            {student.enrollment_status === 'Alumni' ? 'Verified Alumni' : 'New Graduate'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm font-medium">
                                        {(() => {
                                            const latestSurvey = (student as any).survey_responses?.[0]?.submitted_at;
                                            const status = getActivityStatus(latestSurvey || (student as any).updated_at || (student as any).created_at);
                                            return (
                                                <div className={`flex items-center justify-center gap-1.5 w-max mx-auto px-3 py-1.5 rounded-lg border ${status.color}`}>
                                                    <Clock size={14} className="opacity-70" />
                                                    {status.text}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleSendReminder(student)}
                                                className="p-2 bg-white border border-slate-200 text-amber-600 rounded-lg hover:bg-amber-50 hover:border-amber-200 transition-all shadow-sm"
                                                title="Send Update Reminder Notification"
                                            >
                                                <Bell size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleEditClick(student)}
                                                className="p-2 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                                                title="Edit User"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteClick(student)}
                                                className="p-2 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                                                title="Delete User"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

        {/* --- Edit Modal --- */}
        {isEditModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsEditModalOpen(false)}></div>
                <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-lg relative z-10 p-8 border border-white/50 animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Edit className="text-indigo-500" size={20} /> Edit User
                        </h3>
                        <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">First Name</label>
                                <input 
                                    type="text" 
                                    value={editFormData.first_name || ''} 
                                    onChange={e => setEditFormData({...editFormData, first_name: e.target.value})}
                                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Name</label>
                                <input 
                                    type="text" 
                                    value={editFormData.last_name || ''} 
                                    onChange={e => setEditFormData({...editFormData, last_name: e.target.value})}
                                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Student ID</label>
                            <input 
                                type="text" 
                                value={editFormData.student_number || ''} 
                                onChange={e => setEditFormData({...editFormData, student_number: e.target.value})}
                                className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Program</label>
                                <input 
                                    type="text" 
                                    value={editFormData.program || ''} 
                                    onChange={e => setEditFormData({...editFormData, program: e.target.value})}
                                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year Level / Batch</label>
                                <input 
                                    type="text" 
                                    value={editFormData.year_level || ''} 
                                    onChange={e => setEditFormData({...editFormData, year_level: e.target.value})}
                                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                            <input 
                                type="email" 
                                value={editFormData.email || ''} 
                                onChange={e => setEditFormData({...editFormData, email: e.target.value})}
                                className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                        <button onClick={saveEdit} disabled={processing} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                            {processing ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- Delete Modal --- */}
        {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsDeleteModalOpen(false)}></div>
                <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-sm relative z-10 p-8 border border-white/50 animate-in zoom-in-95 duration-300 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Delete User?</h3>
                    <p className="text-slate-500 text-sm mb-8">
                        Are you sure you want to delete <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong>? This action cannot be undone and will remove all associated data.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                        <button onClick={confirmDelete} disabled={processing} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2">
                            {processing ? <Loader2 className="animate-spin" size={18} /> : 'Yes, Delete'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- Follow Up Modal --- */}
        {isFollowUpModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsFollowUpModalOpen(false)}></div>
                <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-md relative z-10 p-8 border border-white/50 animate-in zoom-in-95 duration-300 text-center">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-500 shadow-inner">
                        <Mail size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Follow Up Alumni</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                       You are about to send a follow-up email to <strong>{selectedIds.size} alumni</strong> asking them to update their employment status.
                    </p>
                    
                    <div className="bg-indigo-50 p-4 rounded-xl text-left mb-6 border border-indigo-100">
                        <label className="block text-xs font-bold text-indigo-800 uppercase mb-2 flex items-center gap-2">
                            <Clock size={12}/> Select Context
                        </label>
                        <select 
                            value={followUpFrequency}
                            onChange={(e) => setFollowUpFrequency(e.target.value as any)}
                            className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300"
                        >
                            <option value="Monthly">Monthly Check-in</option>
                            <option value="Quarterly">Quarterly Update</option>
                            <option value="Semi-Annually">Semi-Annually Check</option>
                            <option value="Yearly">Annual Tracer</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-2">
                            * Emails will be sent from <strong>placement.alumni.linkages@gmail.com</strong>
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setIsFollowUpModalOpen(false)} 
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleBulkFollowUp} 
                            disabled={processing} 
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                        >
                            {processing ? <Loader2 className="animate-spin" size={20} /> : 'Send Emails'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- Config Modal --- */}
        {isConfigModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsConfigModalOpen(false)}></div>
                <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-md relative z-10 p-8 border border-white/50 animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Settings className="text-indigo-500" size={20} /> Auto-Follow Up
                        </h3>
                        <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="bg-indigo-50 p-4 rounded-xl text-xs font-medium text-indigo-800 leading-relaxed border border-indigo-100">
                            <p>Automatically detect inactive users based on your frequency setting and send targeted profile update reminders.</p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <p className="text-sm font-bold text-slate-800">Enable Automation</p>
                                <p className="text-xs text-slate-500 mt-0.5">Send emails independently</p>
                            </div>
                            <button 
                                onClick={() => setAutoConfig({...autoConfig, enabled: !autoConfig.enabled})}
                                className={`w-12 h-6 rounded-full transition-colors relative ${autoConfig.enabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${autoConfig.enabled ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>

                        {autoConfig.enabled && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Check Inactivity Frequency</label>
                                    <select 
                                        value={autoConfig.frequency}
                                        onChange={(e) => setAutoConfig({...autoConfig, frequency: e.target.value})}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300"
                                    >
                                        <option value="Monthly">Monthly Check</option>
                                        <option value="Quarterly">Quarterly Check</option>
                                        <option value="Semi-Annually">Semi-Annually Check</option>
                                        <option value="Yearly">Yearly Check</option>
                                    </select>
                                </div>
                                <div className="p-4 bg-indigo-50 text-indigo-700 rounded-xl text-sm border border-indigo-100 flex items-start gap-3">
                                    <Calendar size={18} className="shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold">Next Automated Run</p>
                                        <p className="opacity-80 mt-1">{autoConfig.nextRun || 'Calculated on save'}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => performAutoFollowUp(autoConfig, true)}
                                    disabled={processing}
                                    className="w-full py-3 bg-white border-2 border-indigo-500 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors flex justify-center items-center gap-2"
                                >
                                    {processing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                                    Run Inactivity Check Now
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button onClick={() => setIsConfigModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                        <button onClick={saveAutoConfig} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Save Config</button>
                    </div>
                </div>
            </div>
        )}

        {/* --- Single Reminder Modal --- */}
        {isReminderModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsReminderModalOpen(false)}></div>
                <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-sm relative z-10 p-8 border border-white/50 animate-in zoom-in-95 duration-300 text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500 shadow-inner">
                        <Bell size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Send Reminder?</h3>
                    <p className="text-slate-500 text-sm mb-8">
                       You are about to notify <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong> to update their employment and status profile.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setIsReminderModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                        <button onClick={confirmSendReminder} disabled={processing} className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:shadow-amber-200 hover:bg-amber-600 transition-all flex items-center justify-center gap-2">
                            {processing ? <Loader2 className="animate-spin" size={18} /> : 'Send Alert'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- View Modal --- */}
        {isViewModalOpen && selectedUser && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsViewModalOpen(false)}></div>
                <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-white/50">
                    {/* Header */}
                    <div className="flex justify-between items-center px-8 py-6 border-b border-white/40 bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-md ${selectedUser.table_source === 'students' ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-purple-400 to-indigo-500'}`}>
                                {selectedUser.first_name.charAt(0)}{selectedUser.last_name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{selectedUser.first_name} {selectedUser.last_name}</h3>
                                <span className="text-xs font-mono text-slate-500 bg-white/50 px-1.5 py-0.5 rounded border border-white/50 mt-1 inline-block">
                                    {selectedUser.student_number}
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content Scrollable */}
                    <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                        {/* Status section */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Record Origin</p>
                                <p className="font-semibold text-slate-700 capitalize">{selectedUser.table_source || 'students'} Table</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Current Status</p>
                                <p className="font-semibold text-slate-700">{selectedUser.enrollment_status === 'Alumni' ? 'Verified Alumni' : 'New Graduate'}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Batch Year</p>
                                <p className="font-semibold text-slate-700">{selectedUser.year_level}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Gender</p>
                                <p className="font-semibold text-slate-700">{selectedUser.gender || 'Not specified'}</p>
                            </div>
                        </div>

                        {/* Personal Details */}
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Academic & Personal Info</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Program / Course</p>
                                    <p className="font-medium text-slate-800 text-sm leading-relaxed">{selectedUser.program}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Birthdate</p>
                                    <p className="font-medium text-slate-800 text-sm">{selectedUser.birthdate ? new Date(selectedUser.birthdate).toLocaleDateString() : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Civil Status</p>
                                    <p className="font-medium text-slate-800 text-sm capitalize">{selectedUser.civil_status || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Physical Address</p>
                                    <p className="font-medium text-slate-800 text-sm">{selectedUser.address || '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Contact Details */}
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">Contact Details</h4>
                            <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider mb-0.5">Primary Email</p>
                                        <p className="font-semibold text-indigo-900 text-sm flex items-center gap-2">
                                            <Mail size={14} className="opacity-50" />
                                            {selectedUser.email || 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider mb-0.5">Contact Number</p>
                                        <p className="font-semibold text-indigo-900 text-sm">{selectedUser.contact_no || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 px-8 py-5 border-t border-slate-100 bg-slate-50/50">
                        <button 
                            onClick={() => setIsViewModalOpen(false)}
                            className="px-6 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Custom Toast Message */}
        {toastMessage && (
            <div className="fixed bottom-6 right-6 z-[10000] animate-in slide-in-from-bottom-5 fade-in duration-300">
                <div className={`rounded-xl shadow-xl border flex items-center p-4 pr-6 min-w-[280px] max-w-sm backdrop-blur-xl bg-white/90 ${
                    toastMessage.type === 'success' ? 'border-emerald-200' :
                    toastMessage.type === 'error' ? 'border-red-200' : 'border-indigo-200'
                }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mr-4 ${
                        toastMessage.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                        toastMessage.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                        {toastMessage.type === 'success' && <Check size={20} />}
                        {toastMessage.type === 'error' && <X size={20} />}
                        {toastMessage.type === 'info' && <Bell size={20} />}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800">{toastMessage.title}</h4>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{toastMessage.message}</p>
                    </div>
                </div>
            </div>
        )}

    </>
  );
};

export default UserManagement;
