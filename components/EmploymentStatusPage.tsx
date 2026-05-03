
import React, { useEffect, useState } from 'react';
import { LogOut, User, BookOpen, Calendar, MapPin, Award, Bell, Search, ChevronDown, Briefcase, LayoutDashboard, Save, Loader2, CheckCircle, Plus, Trash2, Edit2, X, RefreshCw, Building2, ToggleLeft, ToggleRight, Clock, HelpCircle, AlertTriangle, ArrowRight, Layers, Banknote, Tag, CheckCircle2, XCircle } from 'lucide-react';
import { Student, EmploymentFormState, EmploymentRecord, EmploymentStatus } from '../types';
import { supabase } from '../lib/supabaseClient';
import { analyzeJobDetails, normalizeAlignmentReason, normalizeSalaryRange, normalizeBusinessRevenue } from '../services/employmentAI';

interface EmploymentStatusPageProps {
  user: Student;
}

const EmploymentStatusPage: React.FC<EmploymentStatusPageProps> = ({ user }) => {
  const [submitting, setSubmitting] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [employmentRecords, setEmploymentRecords] = useState<EmploymentRecord[]>([]);
  
  // View State
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [selectedStatus, setSelectedStatus] = useState<EmploymentStatus | null>(null);
  const [showStatusSelector, setShowStatusSelector] = useState(false);
  
  // Transition State
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<EmploymentStatus | null>(null);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New: Record View Toggle
  const [recordViewType, setRecordViewType] = useState<'Employed' | 'Self-employed'>('Employed');

  // New: Non-Related Detection State
  const [isNonRelatedDetected, setIsNonRelatedDetected] = useState(false);
  const [customAlignmentReason, setCustomAlignmentReason] = useState('');

  // Info Modal State
  const [infoModal, setInfoModal] = useState<{show: boolean, title: string, message: string, type: 'success' | 'error' | 'warning'}>({ show: false, title: '', message: '', type: 'success' });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
      setInfoModal({ show: true, title, message, type });
  };

  // Form State
  const initialFormState: EmploymentFormState = {
    employment_status: '',
    current_position: '', // Used for both Job Title and Business Role
    date_hired: '',
    company_name: '',
    company_address: '',
    business_name: '',
    business_address: '',
    business_type: '',
    business_contact_no: '',
    unemployed_reasons: '',
    last_company: '',
    retirement_reason: '',
    date_retired: '',
    business_duration: '', // Used for Business Duration (Text)
    alignment_reason: '',
    employment_type: undefined,
    salary_range: '',
    business_revenue: '',
    exact_salary: '',
    exact_revenue: ''
  };
  const [formData, setFormData] = useState<EmploymentFormState>(initialFormState);

  // --- Data Fetching ---
  const fetchEmploymentRecords = async () => {
    setLoadingRecords(true);
    try {
        if (!user.id) {
            console.warn("User ID is missing, cannot fetch records.");
            return;
        }
        
        // Determine table based on table_source if available
        const userType = user.table_source === 'students' ? 'student' : 
                         user.table_source === 'alumni' ? 'alumni' : 
                         (user.enrollment_status === 'Graduating' ? 'student' : 'alumni');

        const idColumn = userType === 'alumni' ? 'alumni_id' : 'student_id';

        // 1. Get Survey Responses IDs for this user
        const { data: surveys, error: surveyError } = await supabase
            .from('survey_responses')
            .select('id')
            .eq(idColumn, user.id);
        
        if (surveyError) {
            console.error("Error fetching surveys:", JSON.stringify(surveyError));
            throw new Error(surveyError.message);
        }

        if (!surveys || surveys.length === 0) {
            setEmploymentRecords([]);
            setLoadingRecords(false);
            setShowStatusSelector(true); // Show selector if no records
            return;
        }

        const surveyIds = surveys.map(s => s.id);

        // 2. Get Employment Info linked to those surveys
        const { data: records, error: recordsError } = await supabase
            .from('employment_information')
            .select('*')
            .in('survey_response_id', surveyIds)
            .order('id', { ascending: false }); // Latest first
        
        if (recordsError) {
             console.error("Error fetching employment info:", JSON.stringify(recordsError));
             throw new Error(recordsError.message);
        }

        const typedRecords = records as EmploymentRecord[];
        setEmploymentRecords(typedRecords);
        
        // Logic for Initial View State
        if (typedRecords.length > 0) {
            const hasEmployed = typedRecords.some(r => r.employment_status === 'Employed');
            const hasSelfEmployed = typedRecords.some(r => r.employment_status === 'Self-employed');

            // Smartly set view type: 
            // - If user has both, keep current view if valid, otherwise default to Employed.
            // - If user only has one type, force that type.
            setRecordViewType(prev => {
                if (hasEmployed && hasSelfEmployed) {
                    return prev === 'Self-employed' ? 'Self-employed' : 'Employed';
                }
                if (hasEmployed) return 'Employed';
                if (hasSelfEmployed) return 'Self-employed';
                return 'Employed';
            });

            setSelectedStatus(typedRecords[0].employment_status as EmploymentStatus);
            setShowStatusSelector(false);
        } else {
            setShowStatusSelector(true);
        }

    } catch (error: any) {
        console.error("Error fetching records:", error.message || error);
    } finally {
        setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchEmploymentRecords();
  }, [user.id, user.table_source]); // Re-fetch if user changes, basically on mount

  // Reset detection when crucial fields change
  useEffect(() => {
    if (viewMode === 'form') {
        setIsNonRelatedDetected(false);
        setCustomAlignmentReason('');
    }
  }, [formData.current_position, formData.company_name, formData.business_name, formData.business_type]);


  // --- Event Handlers ---

  const handleStatusSelect = (status: EmploymentStatus) => {
      // Logic: If user is currently employed/self-employed and selects Unemployed or Retired, trigger transition flow
      const isCurrentlyActive = employmentRecords.some(r => 
          r.employment_status === 'Employed' || r.employment_status === 'Self-employed'
      );
      
      const isSwitchingToInactive = status === 'Unemployed' || status === 'Retired';

      if (isCurrentlyActive && isSwitchingToInactive) {
          setPendingStatus(status);
          setShowTransitionModal(true);
          return;
      }

      // Normal Flow
      setFormData({ ...initialFormState, employment_status: status });
      setViewMode('form');
      setShowStatusSelector(false);
      setIsNonRelatedDetected(false);
  };

  const confirmTransition = async () => {
    if (!pendingStatus) return;
    setSubmitting(true);

    try {
        // 1. Identify active records to archive
        const activeRecords = employmentRecords.filter(r => 
            r.employment_status === 'Employed' || r.employment_status === 'Self-employed'
        );

        // 2. Archive to Employment History table
        const historyPayloads = activeRecords.map(record => ({
            survey_response_id: record.survey_response_id,
            employment_status: record.employment_status,
            position: record.current_position || 'Owner', // Fallback
            company_name: record.company_name,
            company_address: record.company_address,
            job_level: record.current_job_level,
            date_hired: record.date_hired,
            business_name: record.business_name,
            business_address: record.business_address,
            business_type: record.business_type,
            industry: record.industry,
            job_alignment: record.job_alignment,
            is_current_job: false // Marking as past job
        }));

        if (historyPayloads.length > 0) {
            const { error: histError } = await supabase
                .from('employment_history')
                .insert(historyPayloads);
            if (histError) throw histError;
        }

        // 3. Delete from active Employment Information table
        const idsToDelete = activeRecords.map(r => r.id);
        if (idsToDelete.length > 0) {
            const { error: delError } = await supabase
                .from('employment_information')
                .delete()
                .in('id', idsToDelete);
            if (delError) throw delError;
        }

        // 4. Reset UI and Open Form for new Status
        setFormData({ ...initialFormState, employment_status: pendingStatus });
        setViewMode('form');
        setShowStatusSelector(false);
        setShowTransitionModal(false);
        
        // Refresh local list (it should be empty now for active records)
        await fetchEmploymentRecords();

    } catch (error: any) {
        console.error("Transition Error:", error);
        showAlert("Error", "Failed to update status: " + (error.message || String(error)), "error");
    } finally {
        setSubmitting(false);
    }
  };

  const handleAddJob = () => {
      setFormData({ ...initialFormState, employment_status: 'Employed' });
      setViewMode('form');
      setIsNonRelatedDetected(false);
  };

  const handleAddBusiness = () => {
      setFormData({ ...initialFormState, employment_status: 'Self-employed' });
      setViewMode('form');
      setIsNonRelatedDetected(false);
  };

  const handleEdit = (record: EmploymentRecord) => {
      setFormData({
          ...record,
          exact_salary: '', 
          exact_revenue: ''
      });
      setViewMode('form');
      setIsNonRelatedDetected(record.job_alignment === 'Non-Related');
  };

  // Open Delete Confirmation Modal
  const handleDeleteClick = (id: string) => {
      setRecordToDelete(id);
      setShowDeleteModal(true);
  };

  // Actual Delete Logic
  const confirmDelete = async () => {
      if (!recordToDelete) return;
      setIsDeleting(true);
      try {
          const { error } = await supabase.from('employment_information').delete().eq('id', recordToDelete);
          if (error) throw error;
          
          await fetchEmploymentRecords();
          setShowDeleteModal(false);
          setRecordToDelete(null);
      } catch (error) {
          console.error("Error deleting record:", error);
          showAlert("Error", "Failed to delete record.", "error");
      } finally {
          setIsDeleting(false);
      }
  };

  const handleInputChange = (field: keyof EmploymentFormState, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEmploymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!user.id) throw new Error("User ID missing");

      // Initialize with null/neutral values so it doesn't default to Non-Related immediately
      let aiResult = { job_alignment: null as string | null, current_job_level: null as string | null, industry: null as string | null };

      // 1. AI Analysis
      if (formData.employment_status === 'Employed') {
        // @ts-ignore
        aiResult = await analyzeJobDetails(formData.current_position, formData.company_name, user.program, 'Employed');
      } else if (formData.employment_status === 'Self-employed') {
        // @ts-ignore
        aiResult = await analyzeJobDetails(formData.current_position || 'Owner', formData.business_name, user.program, 'Self-employed');
      }

      // 2. Non-Related Check
      // Only apply this check if the user is Employed or Self-employed
      if (
          (formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') &&
          aiResult.job_alignment === 'Non-Related' && 
          !formData.alignment_reason
         ) {
          setIsNonRelatedDetected(true);
          setSubmitting(false);
          showAlert("Action Required", "The system detected that this role might be Non-Related to your course. Please scroll up/down to the 'System detected' section and select a reason.", "warning");
          return;
      }

      // 3. Normalization of 'Others' reason
      let finalAlignmentReason = formData.alignment_reason;
      if (isNonRelatedDetected && formData.alignment_reason === 'Others') {
         if (!customAlignmentReason.trim()) {
            setSubmitting(false);
            showAlert("Missing Information", "Please specify your reason for course misalignment.", "warning");
            return;
         }
         // Normalize via AI
         finalAlignmentReason = await normalizeAlignmentReason(customAlignmentReason);
      }

      // 4. NORMALIZE NUMBERS (Salary / Revenue)
      let normalizedSalary = formData.salary_range;
      let normalizedRevenue = formData.business_revenue;

      if (formData.employment_status === 'Employed' && formData.exact_salary) {
          const salaryNum = parseFloat(formData.exact_salary.replace(/,/g, ''));
          normalizedSalary = normalizeSalaryRange(salaryNum);
      }

      if (formData.employment_status === 'Self-employed' && formData.exact_revenue) {
          const revenueNum = parseFloat(formData.exact_revenue.replace(/,/g, ''));
          normalizedRevenue = normalizeBusinessRevenue(revenueNum);
      }

      // 5. Prepare Payload
      const respondentType = user.table_source === 'students' ? 'student' : 
                             user.table_source === 'alumni' ? 'alumni' : 
                             (user.enrollment_status === 'Graduating' ? 'student' : 'alumni');

      let surveyResponseId = '';

      // Determine the position/role value safely for both types
      const roleValue = formData.current_position || (formData.employment_status === 'Self-employed' ? 'Owner' : '');

      if (formData.id) {
          // UPDATE EXISTING RECORD
          const updatePayload: any = {
              employment_status: formData.employment_status,
              
              job_alignment: (formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') ? aiResult.job_alignment : null,
              current_job_level: (formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') ? aiResult.current_job_level : null,
              industry: (formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') ? aiResult.industry : null,

              current_position: (formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') ? roleValue : null,
              
              date_hired: formData.employment_status === 'Employed' ? formData.date_hired : null,
              company_name: formData.employment_status === 'Employed' ? formData.company_name : null,
              company_address: formData.employment_status === 'Employed' ? formData.company_address : null,
              employment_type: formData.employment_status === 'Employed' ? formData.employment_type : null,
              salary_range: formData.employment_status === 'Employed' ? normalizedSalary : null,

              business_name: formData.employment_status === 'Self-employed' ? formData.business_name : null,
              business_address: formData.employment_status === 'Self-employed' ? formData.business_address : null,
              business_type: formData.employment_status === 'Self-employed' ? formData.business_type : null,
              business_contact_no: formData.employment_status === 'Self-employed' ? formData.business_contact_no : null,
              business_duration: formData.employment_status === 'Self-employed' ? formData.business_duration : null,
              business_revenue: formData.employment_status === 'Self-employed' ? normalizedRevenue : null,

              unemployed_reasons: formData.employment_status === 'Unemployed' ? formData.unemployed_reasons : null,

              last_company: formData.employment_status === 'Retired' ? formData.last_company : null,
              retirement_reason: formData.employment_status === 'Retired' ? formData.retirement_reason : null,
              date_retired: formData.employment_status === 'Retired' ? formData.date_retired : null,

              alignment_reason: ((formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') && aiResult.job_alignment === 'Non-Related') ? finalAlignmentReason : null,
          };

          const { error } = await supabase.from('employment_information').update(updatePayload).eq('id', formData.id);
          if (error) throw error;

      } else {
          // CREATE NEW RECORD
          const surveyPayload: any = {
            respondent_type: respondentType,
            submitted_at: new Date().toISOString()
          };
          if (respondentType === 'student') surveyPayload.student_id = user.id;
          else surveyPayload.alumni_id = user.id;

          const { data: surveyData, error: surveyError } = await supabase
            .from('survey_responses')
            .insert([surveyPayload])
            .select()
            .single();
          
          if (surveyError) throw surveyError;
          surveyResponseId = surveyData.id;

          // --- AUTOMATIC CLEANUP OF CONFLICTING STATUSES ---
          const statusToCheck = formData.employment_status;
          const recordsToDelete: string[] = [];

          if (statusToCheck === 'Unemployed' || statusToCheck === 'Retired') {
              employmentRecords.forEach(r => {
                  recordsToDelete.push(r.id);
              });
          } else if (statusToCheck === 'Employed' || statusToCheck === 'Self-employed') {
              employmentRecords.forEach(r => {
                  if (r.employment_status === 'Unemployed' || r.employment_status === 'Retired') {
                      recordsToDelete.push(r.id);
                  }
              });
          }

          if (recordsToDelete.length > 0) {
              const { error: delErr } = await supabase
                .from('employment_information')
                .delete()
                .in('id', recordsToDelete);
              if (delErr) console.error("Cleanup error:", delErr);
          }

          const insertPayload = {
            survey_response_id: surveyResponseId,
            employment_status: formData.employment_status,
            
            job_alignment: (formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') ? aiResult.job_alignment : null,
            current_job_level: (formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') ? aiResult.current_job_level : null,
            industry: (formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') ? aiResult.industry : null,

            current_position: (formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') ? roleValue : null,
            
            date_hired: formData.employment_status === 'Employed' ? formData.date_hired : null,
            company_name: formData.employment_status === 'Employed' ? formData.company_name : null,
            company_address: formData.employment_status === 'Employed' ? formData.company_address : null,
            employment_type: formData.employment_status === 'Employed' ? formData.employment_type : null,
            salary_range: formData.employment_status === 'Employed' ? normalizedSalary : null,

            business_name: formData.employment_status === 'Self-employed' ? formData.business_name : null,
            business_address: formData.employment_status === 'Self-employed' ? formData.business_address : null,
            business_type: formData.employment_status === 'Self-employed' ? formData.business_type : null,
            business_contact_no: formData.employment_status === 'Self-employed' ? formData.business_contact_no : null,
            business_duration: formData.employment_status === 'Self-employed' ? formData.business_duration : null,
            business_revenue: formData.employment_status === 'Self-employed' ? normalizedRevenue : null,

            unemployed_reasons: formData.employment_status === 'Unemployed' ? formData.unemployed_reasons : null,

            last_company: formData.employment_status === 'Retired' ? formData.last_company : null,
            retirement_reason: formData.employment_status === 'Retired' ? formData.retirement_reason : null,
            date_retired: formData.employment_status === 'Retired' ? formData.date_retired : null,

            alignment_reason: ((formData.employment_status === 'Employed' || formData.employment_status === 'Self-employed') && aiResult.job_alignment === 'Non-Related') ? finalAlignmentReason : null,
          };

          const { error: empError } = await supabase.from('employment_information').insert([insertPayload]);
          if (empError) throw empError;
      }

      await fetchEmploymentRecords();
      
      if (formData.employment_status === 'Employed') setRecordViewType('Employed');
      if (formData.employment_status === 'Self-employed') setRecordViewType('Self-employed');

      setViewMode('list');
      setIsNonRelatedDetected(false);
      setCustomAlignmentReason('');
      showAlert("Success", "Status updated successfully!", "success");

    } catch (err: any) {
      console.error("Submission error:", err);
      let errorMessage = "An unexpected error occurred.";
      if (err instanceof Error) errorMessage = err.message;
      else if (typeof err === 'object' && err !== null) errorMessage = err.message || JSON.stringify(err);
      showAlert("Error", "Failed to save information: " + errorMessage, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelForm = () => {
      setViewMode('list');
      if (employmentRecords.length > 0) {
          setShowStatusSelector(false);
      }
      setIsNonRelatedDetected(false);
  };

  // Status Logic
  const hasEmployed = employmentRecords.some(r => r.employment_status === 'Employed');
  const hasSelfEmployed = employmentRecords.some(r => r.employment_status === 'Self-employed');
  const hasUnemployed = employmentRecords.some(r => r.employment_status === 'Unemployed');
  const hasRetired = employmentRecords.some(r => r.employment_status === 'Retired');

  // Filter Logic
  const filteredRecords = employmentRecords.filter(record => {
      if (recordViewType === 'Employed') return record.employment_status === 'Employed';
      if (recordViewType === 'Self-employed') return record.employment_status === 'Self-employed';
      return false;
  });

  const otherRecords = employmentRecords.filter(r => r.employment_status === 'Unemployed' || r.employment_status === 'Retired');

  return (
    <div className="relative">
        {/* Ambient Background for Glassmorphism */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full blur-[100px] pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-green-400/20 rounded-full blur-[100px] pointer-events-none -z-10"></div>

        {/* Main Glass Container with Maximum Fixed Height */}
        <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/60 overflow-hidden animate-slide-up relative h-[calc(100vh-40px)] flex flex-col">
            
            {/* === TRANSITION MODAL (Glass) === */}
            {showTransitionModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowTransitionModal(false)}></div>
                    <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-white/50 ring-1 ring-white/50">
                        <div className="p-8">
                            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-amber-50/50">
                                <AlertTriangle className="w-8 h-8 text-amber-500" />
                            </div>
                            <h3 className="text-2xl font-black text-center text-gray-800 mb-2">Change Job Status?</h3>
                            <p className="text-gray-500 text-center text-sm mb-6 leading-relaxed">
                                Are you sure you want to change your status to <strong className="text-gray-800">{pendingStatus}</strong>? 
                                <br/><br/>
                                Your current employment records will be <strong>archived to your profile history</strong> and removed from your active status.
                            </p>
                            
                            <div className="space-y-3">
                                <button 
                                    onClick={confirmTransition}
                                    disabled={submitting}
                                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-200/50 transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 size={18} className="animate-spin" /> : "Yes, Update Status"}
                                </button>
                                <button 
                                    onClick={() => setShowTransitionModal(false)}
                                    disabled={submitting}
                                    className="w-full py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* === DELETE CONFIRMATION MODAL (Glass) === */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowDeleteModal(false)}></div>
                    <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-white/50 ring-1 ring-white/50">
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-red-50/50">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-800 mb-2">Delete Record?</h3>
                            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                                Are you sure you want to delete this employment record? This action cannot be undone.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={isDeleting}
                                    className="py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    disabled={isDeleting}
                                    className="py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Yes, Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header (Fixed) */}
            <div className="p-8 border-b border-white/40 bg-gradient-to-r from-white/40 to-white/10 flex justify-between items-center backdrop-blur-md shrink-0 z-30">
                <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                            <Briefcase size={28} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-800 font-display tracking-tight">Employment Status</h3>
                            <p className="text-sm text-gray-500 font-medium mt-0.5">Manage your professional journey.</p>
                        </div>
                </div>
                {viewMode === 'form' && (
                    <button onClick={cancelForm} className="flex items-center gap-2 bg-white/60 hover:bg-white text-gray-600 px-4 py-2.5 rounded-xl text-sm font-bold border border-white/60 shadow-sm transition-all">
                        <X size={16} /> Cancel
                    </button>
                )}
            </div>

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {loadingRecords ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 animate-pulse h-full">
                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-luGreen" />
                        <p className="font-bold text-sm">Syncing records...</p>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="flex flex-col h-full">
                        
                        {/* Current Status Section (Fixed Top) */}
                        <div className="px-8 pt-8 pb-4 shrink-0 z-20 bg-gradient-to-b from-white/10 to-transparent">
                            {employmentRecords.length > 0 && !showStatusSelector && (
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-br from-green-50/80 to-emerald-50/80 backdrop-blur-md rounded-[2rem] p-6 border border-white/60 shadow-lg shadow-green-500/5 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                                        <div className="relative z-10">
                                            <h4 className="text-xs font-black text-emerald-600/70 uppercase tracking-widest mb-2">Current Status</h4>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 rounded-xl bg-white text-emerald-600 shadow-sm">
                                                    <CheckCircle size={24} />
                                                </div>
                                                <span className="text-2xl font-black text-gray-800 tracking-tight">
                                                    {hasEmployed && hasSelfEmployed ? 'Employed & Self-employed' :
                                                        hasEmployed ? 'Employed' :
                                                        hasSelfEmployed ? 'Self-employed' :
                                                        hasRetired ? 'Retired' :
                                                        hasUnemployed ? 'Unemployed' : 'Unknown'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 w-full md:w-auto relative z-10">
                                            {(hasEmployed || hasSelfEmployed) && (
                                                <>
                                                <button onClick={handleAddJob} className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-white/70 hover:bg-white text-blue-700 border border-white hover:border-blue-200 px-5 py-3 rounded-xl text-sm font-bold shadow-sm transition-all">
                                                    <Plus size={16} /> Add Job
                                                </button>
                                                <button onClick={handleAddBusiness} className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-white/70 hover:bg-white text-purple-700 border border-white hover:border-purple-200 px-5 py-3 rounded-xl text-sm font-bold shadow-sm transition-all">
                                                    <Plus size={16} /> Add Business
                                                </button>
                                                </>
                                            )}
                                            <button 
                                                onClick={() => setShowStatusSelector(true)}
                                                className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-gray-400/20 hover:bg-black hover:scale-105 transition-all"
                                            >
                                                <RefreshCw size={16} /> Update Status
                                            </button>
                                        </div>
                                    </div>

                                    {(hasEmployed && hasSelfEmployed) && (
                                        <div className="flex gap-2 p-1 bg-white/40 border border-white/60 rounded-xl w-fit shadow-sm backdrop-blur-md">
                                            <button 
                                                onClick={() => setRecordViewType('Employed')}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${recordViewType === 'Employed' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                            >
                                                Employed Records
                                            </button>
                                            <button 
                                                onClick={() => setRecordViewType('Self-employed')}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${recordViewType === 'Self-employed' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                            >
                                                Business Records
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* Status Selector (Empty State or Update Mode) */}
                        {showStatusSelector && (
                            <div className="px-8 pt-4 pb-8 overflow-y-auto custom-scrollbar flex-1">
                                <div className="animate-fade-in-up">
                                    {employmentRecords.length > 0 && (
                                        <div className="flex justify-end mb-4">
                                             <button 
                                                onClick={() => setShowStatusSelector(false)}
                                                className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-white/50 transition-colors"
                                            >
                                                <X size={16} /> Cancel Update
                                            </button>
                                        </div>
                                    )}

                                    {/* Glass Cards Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {[
                                            { status: 'Employed', icon: Briefcase, color: 'blue', desc: 'Working for a company/organization' },
                                            { status: 'Self-employed', icon: Building2, color: 'purple', desc: 'Running your own business' },
                                            { status: 'Unemployed', icon: AlertTriangle, color: 'red', desc: 'Currently looking for work' },
                                            { status: 'Retired', icon: Clock, color: 'gray', desc: 'No longer in the workforce' }
                                        ].map((opt) => (
                                            <button 
                                                key={opt.status}
                                                onClick={() => handleStatusSelect(opt.status as EmploymentStatus)}
                                                className={`p-6 rounded-[2rem] border transition-all hover:scale-[1.03] active:scale-95 text-left group h-full flex flex-col relative overflow-hidden backdrop-blur-md shadow-lg
                                                    ${opt.color === 'blue' ? 'border-blue-100 bg-blue-50/40 hover:bg-blue-50/60 shadow-blue-500/5' : ''}
                                                    ${opt.color === 'purple' ? 'border-purple-100 bg-purple-50/40 hover:bg-purple-50/60 shadow-purple-500/5' : ''}
                                                    ${opt.color === 'red' ? 'border-red-100 bg-red-50/40 hover:bg-red-50/60 shadow-red-500/5' : ''}
                                                    ${opt.color === 'gray' ? 'border-gray-100 bg-gray-50/40 hover:bg-gray-50/60 shadow-gray-500/5' : ''}
                                                `}
                                            >
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors shrink-0 shadow-sm
                                                    ${opt.color === 'blue' ? 'bg-white text-blue-600' : ''}
                                                    ${opt.color === 'purple' ? 'bg-white text-purple-600' : ''}
                                                    ${opt.color === 'red' ? 'bg-white text-red-600' : ''}
                                                    ${opt.color === 'gray' ? 'bg-white text-gray-600' : ''}
                                                `}>
                                                    <opt.icon size={26} />
                                                </div>
                                                <h5 className="font-black text-gray-800 text-lg mb-1">{opt.status}</h5>
                                                <p className="text-xs text-gray-500 font-medium leading-relaxed">{opt.desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Scrollable Records List */}
                        {employmentRecords.length > 0 && !showStatusSelector && (
                            <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                                {filteredRecords.length === 0 && otherRecords.length === 0 ? (
                                    <div className="text-center py-12 bg-white/30 rounded-[2rem] border border-dashed border-white/60">
                                        <p className="text-gray-400 text-sm font-bold">No active records found for this category.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-6">
                                        {/* Active Records */}
                                        {filteredRecords.map(record => (
                                            <div key={record.id} className="bg-white/60 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 shadow-lg shadow-gray-200/20 hover:shadow-xl transition-all group relative overflow-hidden">
                                                
                                                {/* Decorative background number/icon */}
                                                <div className="absolute -bottom-6 -right-6 text-gray-100 opacity-50 rotate-12 pointer-events-none">
                                                    {record.employment_status === 'Employed' ? <Briefcase size={120}/> : <Building2 size={120}/>}
                                                </div>

                                                <div className="flex justify-between items-start mb-6 relative z-10">
                                                    {/* Header: Title & Company */}
                                                    <div className="flex flex-col">
                                                        <h4 className="text-2xl font-black text-gray-800 leading-tight mb-1">
                                                            {record.current_position || 'Owner / Proprietor'}
                                                        </h4>
                                                        <p className="text-base font-bold text-gray-500 flex items-center gap-2">
                                                            {record.employment_status === 'Self-employed' ? (
                                                                 <><Building2 size={18} className="text-purple-400"/> {record.business_name}</>
                                                            ) : (
                                                                 <><Briefcase size={18} className="text-blue-400"/> {record.company_name}</>
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleEdit(record)} className="p-2.5 bg-white border border-gray-100 text-gray-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm" title="Edit">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDeleteClick(record.id)} className="p-2.5 bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-200 rounded-xl transition-all shadow-sm" title="Delete">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* New Professional Grid Layout for Details */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 mb-6 bg-white/40 p-5 rounded-2xl border border-white/50 shadow-sm">
                                                    
                                                    {/* Column 1: Status Info */}
                                                    <div className="space-y-4">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Status:</span>
                                                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase border ${
                                                                record.employment_status === 'Employed' 
                                                                ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                                                : 'bg-purple-50 text-purple-700 border-purple-100'
                                                            }`}>
                                                                {record.employment_status}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Job Type:</span>
                                                            <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                                                <Clock size={12} className="text-slate-400"/> {record.employment_type || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Column 2: Industry & Alignment */}
                                                    <div className="space-y-4">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Industry:</span>
                                                            <span className="text-sm font-bold text-slate-700 flex items-center gap-1 truncate" title={record.industry || 'N/A'}>
                                                                <Layers size={12} className="text-slate-400"/> {record.industry || 'Not Specified'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Alignment:</span>
                                                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                                                                record.job_alignment === 'Related' ? 'text-emerald-600' : 'text-amber-600'
                                                            }`}>
                                                                {record.job_alignment === 'Related' ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                                                                {record.job_alignment || 'Unknown'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Column 3: Location & Date */}
                                                    <div className="space-y-4">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Location:</span>
                                                            <span className="text-sm font-bold text-slate-700 flex items-center gap-1 truncate" title={record.company_address || record.business_address || 'N/A'}>
                                                                <MapPin size={12} className="text-slate-400"/> {record.company_address || record.business_address || 'N/A'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Date Started:</span>
                                                            <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                                                <Calendar size={12} className="text-slate-400"/> {record.date_hired || record.business_duration || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Column 4: Salary & Level */}
                                                    <div className="space-y-4">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Job Level:</span>
                                                            <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                                                <Award size={12} className="text-slate-400"/> {record.current_job_level || 'N/A'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Monthly Income:</span>
                                                            <span className="text-sm font-bold text-slate-800 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded border border-green-100 w-fit">
                                                                <Banknote size={12} className="text-green-600"/> {record.salary_range || record.business_revenue || 'Not Provided'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                </div>
                                                
                                                {record.alignment_reason && (
                                                    <div className="mt-4 p-4 bg-amber-50/80 backdrop-blur-sm rounded-xl border border-amber-100 flex items-start gap-3 relative z-10">
                                                        <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-amber-700 uppercase mb-0.5">Misalignment Reason</span>
                                                            <span className="text-xs font-semibold text-amber-800">{record.alignment_reason}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        
                                        {/* Other Records (Unemployed/Retired) */}
                                        {otherRecords.map(record => (
                                             <div key={record.id} className="bg-white/60 backdrop-blur-xl p-8 rounded-[2rem] border border-white/60 shadow-lg shadow-gray-200/20 hover:shadow-xl transition-all group relative overflow-hidden">
                                                 
                                                <div className="flex justify-between items-start mb-6">
                                                     <div className="flex items-center gap-2 mb-1">
                                                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border shadow-sm ${
                                                                record.employment_status === 'Unemployed' 
                                                                ? 'bg-red-50 text-red-600 border-red-100' 
                                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                                            }`}>
                                                                {record.employment_status}
                                                            </span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleEdit(record)} className="p-2.5 bg-white border border-gray-100 text-gray-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDeleteClick(record.id)} className="p-2.5 bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-200 rounded-xl transition-all shadow-sm">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="mb-6">
                                                    <h4 className="text-2xl font-black text-gray-800 leading-tight mb-2">
                                                        {record.employment_status === 'Retired' ? 'Retired' : 'Currently Unemployed'}
                                                    </h4>
                                                    <p className="text-base font-bold text-gray-500">
                                                        {record.employment_status === 'Retired' ? `Retired from ${record.last_company}` : 'Not currently employed'}
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-y-6 gap-x-8 pt-6 border-t border-gray-200/50">
                                                    <div className="flex flex-col gap-1 col-span-2">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                                                            {record.employment_status === 'Retired' ? 'Reason for Retirement' : 'Reason for Unemployment'}
                                                        </span>
                                                        <div className="text-sm font-bold text-slate-700 bg-white/50 px-4 py-3 rounded-xl border border-white/60 inline-block shadow-sm">
                                                            {record.retirement_reason || record.unemployed_reasons || 'N/A'}
                                                        </div>
                                                    </div>
                                                    {record.employment_status === 'Retired' && (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Date Retired</span>
                                                            <span className="text-sm font-bold text-gray-700 truncate">
                                                                {record.date_retired || 'N/A'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                             </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    // FORM VIEW SCROLLABLE
                    <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                        <form onSubmit={handleEmploymentSubmit} className="animate-fade-in space-y-8">
                            {/* Status Indicator */}
                            <div className="flex items-center gap-3 mb-2 bg-slate-800/5 p-3 rounded-2xl w-fit">
                                <span className="text-xs font-bold text-slate-500 uppercase">Selected Status:</span>
                                <span className="px-3 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm">
                                    {formData.employment_status}
                                </span>
                            </div>

                            {/* Dynamic Fields based on Status */}
                            {formData.employment_status === 'Employed' && (
                                <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Job Title / Position</label>
                                        <input required type="text" value={formData.current_position || ''} onChange={e => handleInputChange('current_position', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Company Name</label>
                                        <input required type="text" value={formData.company_name || ''} onChange={e => handleInputChange('company_name', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Company Address</label>
                                        <input required type="text" value={formData.company_address || ''} onChange={e => handleInputChange('company_address', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Date Hired</label>
                                        <input required type="date" value={formData.date_hired || ''} onChange={e => handleInputChange('date_hired', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Employment Type</label>
                                        <div className="relative">
                                            <select 
                                                required 
                                                value={formData.employment_type || ''} 
                                                onChange={e => handleInputChange('employment_type', e.target.value as any)}
                                                className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-sm appearance-none transition-all shadow-sm"
                                            >
                                                <option value="">Select Type</option>
                                                <option value="Full-Time">Full-Time</option>
                                                <option value="Part-Time">Part-Time</option>
                                                <option value="Temporary/Contract">Temporary/Contract</option>
                                                <option value="Seasonal">Seasonal</option>
                                                <option value="Casual">Casual</option>
                                                <option value="Internship">Internship</option>
                                            </select>
                                            <ChevronDown size={16} className="absolute right-4 top-4 text-gray-400 pointer-events-none"/>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Exact Monthly Salary (PHP)</label>
                                        <input 
                                            required 
                                            type="number" 
                                            placeholder="e.g. 25000"
                                            value={formData.exact_salary || ''} 
                                            onChange={e => handleInputChange('exact_salary', e.target.value)} 
                                            className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-sm transition-all shadow-sm"
                                        />
                                        {formData.salary_range && <p className="text-[10px] text-gray-400 font-bold ml-1">Auto-Categorized: {formData.salary_range}</p>}
                                    </div>
                                </div>
                                </>
                            )}

                            {formData.employment_status === 'Self-employed' && (
                                <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Business Name</label>
                                        <input required type="text" value={formData.business_name || ''} onChange={e => handleInputChange('business_name', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                     <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">My Role / Position</label>
                                        <input required type="text" value={formData.current_position || ''} onChange={e => handleInputChange('current_position', e.target.value)} placeholder="Owner, Proprietor, etc." className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Business Type / Industry</label>
                                        <input required type="text" value={formData.business_type || ''} onChange={e => handleInputChange('business_type', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Business Duration / Start Date</label>
                                        <input required type="text" value={formData.business_duration || ''} onChange={e => handleInputChange('business_duration', e.target.value)} placeholder="e.g. 2019 - Present, or Since Jan 2020" className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Business Address</label>
                                        <input required type="text" value={formData.business_address || ''} onChange={e => handleInputChange('business_address', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Contact Number</label>
                                        <input type="text" value={formData.business_contact_no || ''} onChange={e => handleInputChange('business_contact_no', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Exact Monthly Revenue (PHP)</label>
                                    <input 
                                        required 
                                        type="number" 
                                        placeholder="e.g. 50000"
                                        value={formData.exact_revenue || ''} 
                                        onChange={e => handleInputChange('exact_revenue', e.target.value)} 
                                        className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-sm transition-all shadow-sm"
                                    />
                                    {formData.business_revenue && <p className="text-[10px] text-gray-400 font-bold ml-1">Auto-Categorized: {formData.business_revenue}</p>}
                                </div>
                                </>
                            )}
                            
                            {formData.employment_status === 'Unemployed' && (
                                 <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Reason for Unemployment</label>
                                    <div className="relative">
                                        <select required value={formData.unemployed_reasons || ''} onChange={e => handleInputChange('unemployed_reasons', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none font-semibold text-sm appearance-none transition-all shadow-sm">
                                            <option value="">Select Reason</option>
                                            <option value="Advance Studies">Advance Studies</option>
                                            <option value="Family Concerns">Family Concerns</option>
                                            <option value="Health Related">Health Related</option>
                                            <option value="Lack of Experience">Lack of Work Experience</option>
                                            <option value="No Job Opportunity">No Job Opportunity</option>
                                            <option value="Did not look for job">Did not look for a job</option>
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-4 text-gray-400 pointer-events-none"/>
                                    </div>
                                </div>
                            )}

                             {formData.employment_status === 'Retired' && (
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Date Retired</label>
                                        <input required type="date" value={formData.date_retired || ''} onChange={e => handleInputChange('date_retired', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                     <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Last Company</label>
                                        <input required type="text" value={formData.last_company || ''} onChange={e => handleInputChange('last_company', e.target.value)} className="w-full px-4 py-3.5 bg-white/50 border border-white/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 outline-none font-semibold text-sm transition-all shadow-sm"/>
                                    </div>
                                </div>
                            )}

                            {/* Non-Related Reason Section - Shows only if detected */}
                            {isNonRelatedDetected && (
                                <div className="bg-amber-50/80 backdrop-blur-md p-6 rounded-2xl border border-amber-200 animate-fade-in shadow-sm">
                                    <div className="flex gap-4 mb-4">
                                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600 h-fit"><AlertTriangle size={20} /></div>
                                        <div>
                                            <h5 className="font-black text-amber-800 text-sm uppercase tracking-wide">Course Misalignment Detected</h5>
                                            <p className="text-xs text-amber-700 mt-1 leading-relaxed">Our system detected that this role might not be aligned with your program ({user.program}). Please specify a reason:</p>
                                        </div>
                                    </div>
                                    
                                    <div className="relative">
                                        <select 
                                            required 
                                            value={formData.alignment_reason || ''} 
                                            onChange={e => handleInputChange('alignment_reason', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-amber-300 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-amber-400 appearance-none shadow-sm"
                                        >
                                            <option value="">Select Reason...</option>
                                            <option value="Better Salary/Benefits">Better Salary and Benefits</option>
                                            <option value="Career Advancement">Career Advancement Opportunity</option>
                                            <option value="No Job Opportunity">No Job Opportunity in Field</option>
                                            <option value="Career Shift">Career Shift / Passion</option>
                                            <option value="Family Influence">Family Influence</option>
                                            <option value="Proximity">Proximity to Residence</option>
                                            <option value="Others">Others (Please specify)</option>
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-3.5 text-gray-400 pointer-events-none"/>
                                    </div>

                                    {formData.alignment_reason === 'Others' && (
                                        <div className="mt-4 animate-fade-in">
                                            <label className="text-xs font-bold text-amber-800 uppercase mb-2 block ml-1">Please specify your reason</label>
                                            <input 
                                                required
                                                type="text" 
                                                value={customAlignmentReason}
                                                onChange={(e) => setCustomAlignmentReason(e.target.value)}
                                                placeholder="e.g. My passion is in baking..."
                                                className="w-full px-4 py-3 bg-white border border-amber-300 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
                                            />
                                            <p className="text-[10px] text-amber-600 mt-2 ml-1 font-medium">* Our AI will automatically categorize your response for better reporting.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Submit Actions */}
                            <div className="pt-6 flex gap-4">
                                <button type="submit" disabled={submitting} className="flex-1 py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-xl hover:bg-black hover:scale-[1.02] transition-all flex justify-center items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {submitting ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin"/>
                                            {isNonRelatedDetected && formData.alignment_reason === 'Others' ? "Analyzing..." : "Saving..."}
                                        </>
                                    ) : (
                                        <><Save size={20}/> Save Status</>
                                    )}
                                </button>
                                <button type="button" onClick={cancelForm} className="px-8 py-4 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-colors shadow-sm">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>

        {/* Info Modal (Replaces built-in alerts) */}
        {infoModal.show && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setInfoModal(prev => ({ ...prev, show: false }))}></div>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10 animate-in zoom-in-95 duration-300">
                    <div className={`p-6 flex flex-col items-center text-center ${
                        infoModal.type === 'success' ? 'bg-green-50' :
                        infoModal.type === 'error' ? 'bg-red-50' : 'bg-amber-50'
                    }`}>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                            infoModal.type === 'success' ? 'bg-green-100 text-green-600' :
                            infoModal.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                            {infoModal.type === 'success' ? <CheckCircle2 size={32} /> :
                             infoModal.type === 'error' ? <XCircle size={32} /> : <AlertTriangle size={32} />}
                        </div>
                        <h3 className={`text-xl font-bold mb-2 ${
                            infoModal.type === 'success' ? 'text-green-900' :
                            infoModal.type === 'error' ? 'text-red-900' : 'text-amber-900'
                        }`}>
                            {infoModal.title}
                        </h3>
                        <p className="text-gray-600 font-medium text-sm">
                            {infoModal.message}
                        </p>
                    </div>
                    <div className="p-4 bg-white border-t border-gray-100">
                        <button 
                            onClick={() => setInfoModal(prev => ({ ...prev, show: false }))}
                            className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-colors"
                        >
                            Okay
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default EmploymentStatusPage;
