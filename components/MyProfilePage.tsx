
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, FileText, Upload, Save, Loader2, CheckCircle, School, Briefcase, Heart, Star, AlertCircle, ChevronDown, Plus, Trash2, X, MapPin, Mail, Phone, Edit3, AlertTriangle, GraduationCap, Award, BookOpen, ArrowRight, HelpCircle, Building2 } from 'lucide-react';
import { Student, FullProfileData, EmploymentHistory, CommunityEngagement, EmploymentRecord } from '../types';
import FileUpload from './FileUpload';
import { parseResume, uploadResumeToDB, saveProfileData, deleteResumeFromDB, fetchLatestProfile, updateStudentProfile } from '../services/resumeService';
import { analyzeJobDetails, normalizeSalaryRange, normalizeBusinessRevenue } from '../services/employmentAI';
import { normalizeRolesBatch } from '../services/communityAI';
import { supabase } from '../lib/supabaseClient';
import { COURSES, normalizeProgram, normalizeBatchYear } from '../lib/normalization';

interface MyProfilePageProps {
  user: Student;
}

// Portal to render toasts at the document root level, bypassing overflow/z-index issues in containers
const ToastPortal = ({ children }: { children?: React.ReactNode }) => {
  return createPortal(children, document.body);
};

const MyProfilePage: React.FC<MyProfilePageProps> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // Resume State
  const [parsing, setParsing] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [verificationWarning, setVerificationWarning] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingResume, setDeletingResume] = useState(false);

  // Current Job Verification State
  const [showCurrentJobModal, setShowCurrentJobModal] = useState(false);
  const [currentJobCandidate, setCurrentJobCandidate] = useState<Partial<EmploymentRecord> | null>(null);
  const [analyzingJob, setAnalyzingJob] = useState(false);
  const [savingCurrentJob, setSavingCurrentJob] = useState(false);
  const [misalignmentReason, setMisalignmentReason] = useState('');

  // UI State
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);
  
  // AI Role Normalization Status
  const [normalizingRoles, setNormalizingRoles] = useState(false);

  // Editable Personal Information State
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [email, setEmail] = useState(user.email);
  const [contactNo, setContactNo] = useState(user.contact_no);
  const [address, setAddress] = useState(user.address || '');
  const [program, setProgram] = useState(user.program);
  const [yearLevel, setYearLevel] = useState(user.year_level || '');

  // Profile Data State
  const [profileData, setProfileData] = useState<FullProfileData>({
    education: {},
    employment: [],
    community: [],
    attributes: {
        professionally_competent: 0,
        critical_thinker: 0,
        communicator: 0,
        lifelong_learner: 0,
        socially_responsible: 0,
        ethical_citizen: 0,
        innovative_worker: 0,
        people_oriented: 0,
        critical_thinking_skill: 0,
        creativity: 0,
        collaboration: 0,
        communication_skill: 0,
        information_literacy: 0,
        media_literacy: 0,
        technology_literacy: 0,
        flexibility: 0,
        leadership: 0,
        initiative: 0,
        productivity: 0,
        social_skills: 0
    }
  });

  // Load latest profile data & Resume Status on mount
  useEffect(() => {
    const loadData = async () => {
        if (!user.id) return;
        try {
            // Determine table based on table_source if available
            const userType = user.table_source === 'students' ? 'student' : 
                             user.table_source === 'alumni' ? 'alumni' : 
                             (user.enrollment_status === 'Graduating' ? 'graduating' : 'alumni');
            
            const table = userType === 'alumni' ? 'alumni' : 'students';

            // 1. Fetch Profile Info
            const data = await fetchLatestProfile(user.id, userType);
            if (data) {
                setProfileData(data);
                setHasExistingRecord(true);
            }

            // 2. Fetch Resume Existence
            const { data: resumeCheck } = await supabase
                .from(table)
                .select('id')
                .eq('id', user.id)
                .not('resume', 'is', null)
                .single();
            
            setResumeUploaded(!!resumeCheck);

        } catch (error) {
            console.error("Failed to load profile", error);
        } finally {
            setFetching(false);
        }
    };
    loadData();
  }, [user.id, user.table_source]);

  const handleResumeUpload = async (file: File) => {
    setParsing(true);
    setVerificationWarning(null);
    
    try {
        const userType = user.table_source === 'students' ? 'student' : 
                         user.table_source === 'alumni' ? 'alumni' : 
                         (user.enrollment_status === 'Graduating' ? 'student' : 'alumni');
        
        await uploadResumeToDB(file, user.id!, userType);
        setResumeUploaded(true);
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            try {
                const extracted = await parseResume(base64Data, file.type);
                
                // Name Mismatch Warning
                if (extracted.personal) {
                    const extractedLast = extracted.personal.last_name?.toLowerCase() || '';
                    const userLast = lastName.toLowerCase();
                    if (extractedLast && !extractedLast.includes(userLast)) {
                        setVerificationWarning(`Warning: The name on the resume (${extracted.personal.first_name} ${extracted.personal.last_name}) does not match your account name.`);
                    }
                    if (extracted.personal.address && !address) setAddress(extracted.personal.address);
                    if (extracted.personal.contact_no && !contactNo) setContactNo(extracted.personal.contact_no);
                    if (extracted.personal.email && !email) setEmail(extracted.personal.email);
                }

                // SPLIT EMPLOYMENT: Past vs Current
                const allEmployment = extracted.employment || [];
                const pastJobs: EmploymentHistory[] = [];
                let foundCurrentJob: Partial<EmploymentRecord> | null = null;

                allEmployment.forEach((job: any) => {
                    if (job.is_current_job) {
                        // Found a "Present" job
                        foundCurrentJob = {
                            employment_status: job.employment_status || 'Employed',
                            company_name: job.company_name,
                            business_name: job.business_name, // In case of self-employed
                            current_position: job.position,
                            date_hired: job.date_hired,
                            company_address: job.company_address || '', // Likely missing in resume
                            business_address: job.business_address || '',
                            exact_salary: '',
                            exact_revenue: ''
                        };
                    } else {
                        pastJobs.push(job);
                    }
                });

                // Update Profile Data State (Past jobs + Other sections)
                setProfileData(prev => ({
                    ...prev,
                    education: { ...prev.education, ...extracted.education },
                    employment: [...(prev.employment || []), ...pastJobs],
                    community: [...(prev.community || []), ...(extracted.community || [])],
                    attributes: { ...prev.attributes, ...extracted.attributes } // Auto-fill Attributes
                }));

                // Handle Current Job Process
                if (foundCurrentJob) {
                    setAnalyzingJob(true);
                    setCurrentJobCandidate(foundCurrentJob);
                    setShowCurrentJobModal(true);

                    // Run AI Analysis for the Current Job (Industry & Alignment)
                    try {
                        // @ts-ignore
                        const jobTitle = foundCurrentJob.current_position || foundCurrentJob.business_name || 'Employee';
                        // @ts-ignore
                        const company = foundCurrentJob.company_name || foundCurrentJob.business_name || 'Company';
                        // @ts-ignore
                        const type = foundCurrentJob.employment_status === 'Self-employed' ? 'Self-employed' : 'Employed';

                        const analysis = await analyzeJobDetails(jobTitle, company, program, type);
                        
                        setCurrentJobCandidate(prev => ({
                            ...prev,
                            industry: analysis.industry,
                            job_alignment: analysis.job_alignment,
                            current_job_level: analysis.current_job_level
                        }));
                    } catch (e) {
                        console.error("AI Analysis failed for current job", e);
                    } finally {
                        setAnalyzingJob(false);
                    }
                }

            } catch (err) {
                console.error(err);
                alert("Could not parse resume details automatically. Please fill details manually.");
            } finally {
                setParsing(false);
            }
        };
    } catch (error) {
        console.error("Upload error:", error);
        alert("Failed to upload resume.");
        setParsing(false);
    }
  };

  const saveConfirmedCurrentJob = async () => {
    if (!currentJobCandidate || !user.id) return;
    
    // Check if misalignment reason is needed
    if (currentJobCandidate.job_alignment === 'Non-Related' && !misalignmentReason) {
        alert("Please select a reason for job misalignment.");
        return;
    }

    setSavingCurrentJob(true);
    try {
        const respondentType = user.table_source === 'students' ? 'student' : 
                               user.table_source === 'alumni' ? 'alumni' : 
                               (user.enrollment_status === 'Graduating' ? 'student' : 'alumni');
        
        // 1. Create Survey Response Container
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

        // 2. Normalize numbers
        let normalizedSalary = null;
        let normalizedRevenue = null;

        if (currentJobCandidate.employment_status === 'Employed' && currentJobCandidate.exact_salary) {
            const num = parseFloat(currentJobCandidate.exact_salary.replace(/,/g, ''));
            normalizedSalary = normalizeSalaryRange(num);
        }
        if (currentJobCandidate.employment_status === 'Self-employed' && currentJobCandidate.exact_revenue) {
            const num = parseFloat(currentJobCandidate.exact_revenue.replace(/,/g, ''));
            normalizedRevenue = normalizeBusinessRevenue(num);
        }

        // 3. Prepare Payload for employment_information
        const isSelfEmployed = currentJobCandidate.employment_status === 'Self-employed';
        
        const payload: any = {
            survey_response_id: surveyData.id,
            employment_status: currentJobCandidate.employment_status,
            industry: currentJobCandidate.industry,
            job_alignment: currentJobCandidate.job_alignment,
            current_job_level: currentJobCandidate.current_job_level,
            alignment_reason: currentJobCandidate.job_alignment === 'Non-Related' ? misalignmentReason : null,
            
            // Employed Fields
            current_position: !isSelfEmployed ? currentJobCandidate.current_position : null,
            date_hired: !isSelfEmployed ? currentJobCandidate.date_hired : null,
            company_name: !isSelfEmployed ? currentJobCandidate.company_name : null,
            company_address: !isSelfEmployed ? currentJobCandidate.company_address : null,
            employment_type: !isSelfEmployed ? currentJobCandidate.employment_type : null,
            salary_range: !isSelfEmployed ? normalizedSalary : null,

            // Self-Employed Fields
            business_name: isSelfEmployed ? (currentJobCandidate.business_name || currentJobCandidate.company_name) : null,
            business_address: isSelfEmployed ? (currentJobCandidate.business_address || currentJobCandidate.company_address) : null,
            business_type: isSelfEmployed ? currentJobCandidate.industry : null, // Default to industry if type missing
            business_revenue: isSelfEmployed ? normalizedRevenue : null
        };

        const { error } = await supabase.from('employment_information').insert([payload]);
        if (error) throw error;

        setShowCurrentJobModal(false);
        alert("Current Employment Status updated successfully!");
        setHasExistingRecord(true); // Assuming saving this counts as having a record

    } catch (error) {
        console.error("Failed to save current job", error);
        alert("Error saving employment status.");
    } finally {
        setSavingCurrentJob(false);
    }
  };

  const confirmDeleteResume = async () => {
      setDeletingResume(true);
      try {
          const userType = user.table_source === 'students' ? 'student' : 
                           user.table_source === 'alumni' ? 'alumni' : 
                           (user.enrollment_status === 'Graduating' ? 'student' : 'alumni');

          await deleteResumeFromDB(user.id!, userType);
          setResumeUploaded(false);
          setShowDeleteModal(false);
          setVerificationWarning(null);
      } catch (e) {
          console.error(e);
          alert("Failed to delete resume.");
      } finally {
          setDeletingResume(false);
      }
  };

  const handleInputChange = (section: keyof FullProfileData, field: string, value: any) => {
    setProfileData(prev => ({
        ...prev,
        [section]: {
            ...prev[section],
            [field]: value
        }
    }));
  };

  // --- List Handlers ---
  const addEmployment = () => {
      setProfileData(prev => ({
          ...prev,
          employment: [{ employment_status: 'Employed', is_current_job: false }, ...prev.employment]
      }));
  };

  const removeEmployment = (index: number) => {
      const newEmp = [...profileData.employment];
      newEmp.splice(index, 1);
      setProfileData(prev => ({ ...prev, employment: newEmp }));
  };

  const updateEmployment = (index: number, field: keyof EmploymentHistory, value: any) => {
      const newEmp = [...profileData.employment];
      newEmp[index] = { ...newEmp[index], [field]: value };
      setProfileData(prev => ({ ...prev, employment: newEmp }));
  };

  const addCommunity = () => {
      setProfileData(prev => ({
          ...prev,
          community: [{}, ...prev.community]
      }));
  };

  const removeCommunity = (index: number) => {
      const newComm = [...profileData.community];
      newComm.splice(index, 1);
      setProfileData(prev => ({ ...prev, community: newComm }));
  };

  const updateCommunity = (index: number, field: keyof CommunityEngagement, value: any) => {
      const newComm = [...profileData.community];
      newComm[index] = { ...newComm[index], [field]: value };
      setProfileData(prev => ({ ...prev, community: newComm }));
  };

  // --- SAVE ACTIONS ---
  const handleSaveHeader = async () => {
    setSavingHeader(true);
    try {
        const userType = user.table_source === 'students' ? 'student' : 
                         user.table_source === 'alumni' ? 'alumni' : 
                         (user.enrollment_status === 'Graduating' ? 'student' : 'alumni');
        
        await updateStudentProfile(user.id!, userType, {
            first_name: firstName,
            last_name: lastName,
            email: email,
            contact_no: contactNo,
            address: address,
            program: normalizeProgram(program),
            year_level: normalizeBatchYear(yearLevel)
        });
        setIsEditingHeader(false);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
        console.error("Header save error:", error);
        alert("Failed to update personal information.");
    } finally {
        setSavingHeader(false);
    }
  };

  const handleSaveAllData = async () => {
    setLoading(true);
    try {
        const userType = user.table_source === 'students' ? 'student' : 
                         user.table_source === 'alumni' ? 'alumni' : 
                         (user.enrollment_status === 'Graduating' ? 'student' : 'alumni');
        
        await updateStudentProfile(user.id!, userType, {
            first_name: firstName,
            last_name: lastName,
            email: email,
            contact_no: contactNo,
            address: address,
            program: normalizeProgram(program),
            year_level: normalizeBatchYear(yearLevel)
        });

        // --- AI ROLE NORMALIZATION ---
        // Before saving, we categorize community roles into Owner, Volunteer, Member, Admin
        let dataToSave = { ...profileData };
        
        if (dataToSave.community && dataToSave.community.length > 0) {
            setNormalizingRoles(true);
            const rawRoles = dataToSave.community.map(c => c.role || "Member");
            
            // Only normalize if roles exist
            if (rawRoles.some(r => r !== 'Member' && r !== 'Owner' && r !== 'Admin' && r !== 'Volunteer')) {
                try {
                    const normalized = await normalizeRolesBatch(rawRoles);
                    
                    // Update data with normalized roles
                    const updatedCommunity = dataToSave.community.map((c, i) => ({
                        ...c,
                        role: normalized[i] || c.role // Fallback to original if index missing
                    }));
                    dataToSave = { ...dataToSave, community: updatedCommunity };
                    setProfileData(prev => ({ ...prev, community: updatedCommunity })); // Update UI state
                } catch (aiErr) {
                    console.error("Role Normalization failed, proceeding with raw data", aiErr);
                }
            }
            setNormalizingRoles(false);
        }
        // --- END AI NORMALIZATION ---

        await saveProfileData(user.id!, userType, dataToSave);
        setHasExistingRecord(true);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
        console.error("Save error:", error);
        alert("Failed to save profile. Please check console for details.");
    } finally {
        setLoading(false);
        setNormalizingRoles(false);
    }
  };

  const toggleSection = (section: string) => {
      setActiveSection(activeSection === section ? null : section);
  };

  // --- Render Helpers (Modernized) ---
  const renderInput = (section: keyof FullProfileData, field: string, label: string, type: string = "text", placeholder: string = "") => (
      <div className="space-y-2 group">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider group-focus-within:text-luGreen transition-colors flex items-center gap-1">
            {label}
            <div className="h-[1px] flex-grow bg-gray-100 group-focus-within:bg-luGreen/20 ml-2 transition-colors"></div>
          </label>
          <div className="relative">
            <input 
                type={type} 
                value={(profileData[section] as any)[field] || ''} 
                onChange={(e) => handleInputChange(section, field, e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50/80 border border-transparent hover:bg-gray-50 focus:bg-white focus:border-luGreen focus:ring-4 focus:ring-green-500/10 text-sm font-semibold text-gray-800 transition-all shadow-sm placeholder:text-gray-300"
                placeholder={placeholder}
            />
          </div>
      </div>
  );

  const renderRating = (field: string, label: string) => {
    const currentValue = (profileData.attributes as any)[field];
    return (
      <div className="group relative p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-luGreen/30 transition-all duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900">{label}</span>
              <div className="flex gap-1.5 p-1 bg-gray-50 rounded-xl">
                  {[1, 2, 3, 4, 5].map((star) => (
                      <button 
                        key={star} 
                        type="button"
                        onClick={() => handleInputChange('attributes', field, star)}
                        className={`p-1.5 rounded-lg transition-all duration-300 ${
                            currentValue >= star 
                            ? 'text-yellow-400 bg-white shadow-sm scale-110' 
                            : 'text-gray-300 hover:text-yellow-300 hover:scale-105'
                        }`}
                      >
                          <Star size={18} fill={currentValue >= star ? "currentColor" : "none"} />
                      </button>
                  ))}
              </div>
          </div>
          {currentValue > 0 && (
             <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-luGreen/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          )}
      </div>
    );
  };

  if (fetching) {
      return (
          <div className="min-h-[70vh] flex items-center justify-center">
              <div className="flex flex-col items-center gap-6 animate-pulse">
                  <div className="relative">
                     <div className="w-20 h-20 bg-gray-100 rounded-full"></div>
                     <div className="absolute inset-0 border-4 border-t-luGreen border-gray-100 rounded-full animate-spin"></div>
                  </div>
                  <div className="h-4 w-32 bg-gray-100 rounded-full"></div>
              </div>
          </div>
      );
  }

  return (
    <>
    {/* Global Success Toast via Portal */}
    {savedSuccess && (
        <ToastPortal>
            <div className="fixed top-6 right-6 z-[9999] animate-in slide-in-from-top-5 fade-in duration-300">
                <div className="bg-white/95 backdrop-blur-md border border-green-200 text-green-800 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 ring-1 ring-black/5">
                    <div className="bg-green-100 p-2 rounded-full"><CheckCircle size={18} className="text-luGreen"/></div>
                    <div>
                        <p className="font-bold text-sm">Profile saved successfully!</p>
                        <p className="text-xs text-green-600">Your records have been updated.</p>
                    </div>
                </div>
            </div>
        </ToastPortal>
    )}

    <div className="max-w-7xl mx-auto space-y-8 pb-12 font-sans text-slate-800">
        
        {/* === HEADER SECTION (Enhanced Gradient) === */}
        <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-white via-white to-green-50 shadow-2xl shadow-green-900/10 border border-white/60 ring-1 ring-green-100 group">
            {/* Ambient Background with more color */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-green-100/30 opacity-70"></div>
            <div className="absolute -right-20 -top-20 w-[600px] h-[600px] bg-gradient-to-b from-luGreen/10 to-transparent rounded-full blur-3xl"></div>
            
            <div className="relative p-8 md:p-10 flex flex-col lg:flex-row gap-8 lg:items-center">
                
                {/* Avatar with Status Ring */}
                <div className="relative flex-shrink-0 mx-auto lg:mx-0">
                    <div className="w-36 h-36 md:w-44 md:h-44 rounded-[2rem] p-2 bg-white shadow-xl shadow-gray-200/50 relative z-10 rotate-3 transition-transform duration-500 hover:rotate-0">
                         <div className="w-full h-full rounded-[1.6rem] bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 group/avatar cursor-pointer relative">
                            {user.enrollment_status === 'Graduating' ? 
                                <User size={60} className="text-gray-300" /> : 
                                <GraduationCap size={60} className="text-gray-300"/> 
                            }
                            <div className="absolute inset-0 bg-gray-900/10 backdrop-blur-[1px] opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-white/90 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 shadow-sm flex items-center gap-2">
                                    <Upload size={14}/> Change
                                </span>
                            </div>
                         </div>
                    </div>
                    {/* Decorative Elements */}
                    <div className="absolute -z-10 top-4 -right-4 w-full h-full bg-luGold/20 rounded-[2rem] rotate-6 blur-md"></div>
                    <div className="absolute -bottom-2 -right-2 bg-white p-1.5 rounded-full shadow-lg z-20 cursor-pointer hover:scale-110 transition-transform text-luGreen border border-green-50">
                        <Edit3 size={18} />
                    </div>
                </div>

                {/* Profile Info */}
                <div className="flex-grow space-y-6 text-center lg:text-left">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="space-y-2">
                             {isEditingHeader ? (
                                <div className="flex gap-3 bg-white/80 backdrop-blur-sm p-2 rounded-2xl border border-gray-200 shadow-inner">
                                    <input 
                                        type="text" 
                                        value={firstName} 
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="bg-transparent border-b border-gray-300 focus:border-luGreen outline-none px-2 py-1 font-bold text-xl text-gray-800 w-full"
                                        placeholder="First Name"
                                    />
                                    <input 
                                        type="text" 
                                        value={lastName} 
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="bg-transparent border-b border-gray-300 focus:border-luGreen outline-none px-2 py-1 font-bold text-xl text-gray-800 w-full"
                                        placeholder="Last Name"
                                    />
                                </div>
                            ) : (
                                <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight">
                                    {firstName} <span className="text-transparent bg-clip-text bg-gradient-to-r from-luGreen to-emerald-600">{lastName}</span>
                                </h1>
                            )}
                            
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                                <span className="px-3 py-1 rounded-full bg-gray-900 text-white text-xs font-bold tracking-wide shadow-md shadow-gray-200">
                                    {user.student_number}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${user.enrollment_status === 'Graduating' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                    {user.enrollment_status}
                                </span>
                            </div>
                        </div>

                        {/* Header Actions */}
                        <div className="flex gap-2">
                            {isEditingHeader ? (
                                <>
                                <button onClick={() => setIsEditingHeader(false)} className="px-4 py-2 text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                                <button onClick={handleSaveHeader} disabled={savingHeader} className="px-5 py-2 text-xs font-bold text-white bg-luGreen rounded-xl shadow-lg shadow-green-200 hover:shadow-green-300 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                                    {savingHeader ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save
                                </button>
                                </>
                            ) : (
                                <button onClick={() => setIsEditingHeader(true)} className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex items-center gap-2">
                                    <Edit3 size={14}/> Edit Info
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-5 bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm">
                        {[
                            { icon: School, label: "Program", val: program, set: setProgram },
                            { icon: GraduationCap, label: "Year Level", val: yearLevel, set: setYearLevel },
                            { icon: Mail, label: "Email", val: email, set: setEmail },
                            { icon: Phone, label: "Contact", val: contactNo, set: setContactNo },
                        ].map((item, i) => (
                            <div key={i} className="flex flex-col gap-1 p-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                                    <item.icon size={12} className="text-luGreen"/> {item.label}
                                </div>
                                {isEditingHeader ? (
                                    <input value={item.val || ''} onChange={(e) => item.set(e.target.value)} className="w-full bg-white/80 border-b border-gray-200 focus:border-luGreen text-sm font-semibold outline-none py-1"/>
                                ) : (
                                    <p className="text-sm font-semibold text-gray-700 truncate" title={item.val}>{item.val}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* === RESUME PARSER (Glass Dropzone Style) === */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-[2rem] p-1 shadow-2xl shadow-gray-200">
             <div className="bg-gray-900/50 backdrop-blur-xl rounded-[1.8rem] p-8 md:p-10 text-white relative overflow-hidden">
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-luGreen/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="flex flex-col md:flex-row gap-8 items-center relative z-10">
                    <div className="flex-grow space-y-4">
                        <h3 className="text-xl font-bold">Smart Resume Upload</h3>
                        <p className="text-gray-300 text-sm leading-relaxed max-w-lg">
                            Upload your PDF resume to auto-populate your profile and <strong>reduce manual typing</strong>. 
                            This file will also be <strong>visible to HR</strong> when applying for jobs, making your application process seamless.
                        </p>
                        
                        {verificationWarning && (
                            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-200 text-sm flex gap-3 items-start">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0"/>
                                <span>{verificationWarning}</span>
                            </div>
                        )}

                        <div className="pt-2 flex flex-wrap gap-3">
                            {resumeUploaded ? (
                                <div className="flex items-center gap-3">
                                    <div className="px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-2">
                                        <CheckCircle size={14}/> File Uploaded
                                    </div>
                                    <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors">
                                        <Trash2 size={14}/> Remove
                                    </button>
                                </div>
                            ) : (
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-800 px-3 py-1 rounded-md">No file detected</span>
                            )}
                        </div>
                    </div>

                    <div className="w-full md:w-80">
                         {/* We wrap the existing FileUpload component but style the container */}
                         <div className="bg-white rounded-2xl p-2 shadow-lg shadow-black/20 transform transition-transform hover:scale-[1.02]">
                            <FileUpload 
                                onFileSelect={handleResumeUpload} 
                                isLoading={parsing} 
                                label={parsing ? "Analyzing..." : (resumeUploaded ? "Update PDF" : "Drop Resume Here")}
                            />
                        </div>
                    </div>
                </div>
             </div>
        </div>

        {/* === MAIN SECTIONS (Floating Cards Accordion) === */}
        <div className="space-y-6">
            
            {/* 1. Educational Background */}
            <div className={`transition-all duration-500 ease-out ${activeSection === 'education' ? 'scale-100 opacity-100' : 'opacity-100 hover:scale-[1.01]'}`}>
                <div className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${activeSection === 'education' ? 'shadow-2xl shadow-green-900/5 border-luGreen/30 ring-4 ring-green-50' : 'shadow-sm border-gray-100 hover:shadow-md'}`}>
                    <button onClick={() => toggleSection('education')} className="w-full p-6 md:p-8 flex justify-between items-center group">
                        <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${activeSection === 'education' ? 'bg-gradient-to-tr from-luGreen to-emerald-500 text-white shadow-lg shadow-green-200' : 'bg-green-50 text-luGreen group-hover:bg-luGreen group-hover:text-white'}`}>
                                <School size={26} />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-xl text-gray-800">Education</h4>
                                <p className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wider">Academic History & Licenses</p>
                            </div>
                        </div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${activeSection === 'education' ? 'bg-gray-100 rotate-180 text-gray-800' : 'bg-white text-gray-300 group-hover:bg-gray-50'}`}>
                            <ChevronDown size={20} />
                        </div>
                    </button>
                    
                    {activeSection === 'education' && (
                        <div className="px-8 pb-10 animate-fade-in-up">
                            <div className="h-px w-full bg-gray-100 mb-8"></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="col-span-full mb-2 p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-3 text-sm text-blue-800">
                                    <AlertCircle size={18} className="shrink-0 text-blue-500"/>
                                    <span>If you transferred schools, separate names with a slash (e.g. <strong>UP Diliman / Laguna University</strong>).</span>
                                </div>
                                {renderInput('education', 'primary_school', 'Primary School')}
                                {renderInput('education', 'primary_year_graduated', 'Year / Duration')}
                                {renderInput('education', 'secondary_school', 'Secondary School')}
                                {renderInput('education', 'secondary_year_graduated', 'Year / Duration')}
                                {renderInput('education', 'bachelors_degree', 'Bachelor\'s Degree')}
                                {renderInput('education', 'bachelors_year_graduated', 'Year Graduated')}
                                {renderInput('education', 'masters_degree', 'Master\'s Degree')}
                                {renderInput('education', 'masters_year_graduated_or_units', 'Year / Units')}
                                {renderInput('education', 'doctoral_degree', 'Doctoral Degree')}
                                {renderInput('education', 'doctoral_year_graduated_or_units', 'Year / Units')}
                                
                                <div className="col-span-full mt-8 pt-8 border-t border-dashed border-gray-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-amber-50 rounded-lg text-amber-500"><Award size={20}/></div>
                                        <h5 className="font-bold text-gray-800">Professional Licenses</h5>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {renderInput('education', 'professional_license', 'License Name')}
                                        {renderInput('education', 'license_number', 'License No.')}
                                        {renderInput('education', 'license_date_passed', 'Date Passed', 'date')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Employment History */}
            <div className={`transition-all duration-500 ease-out ${activeSection === 'employment' ? 'scale-100 opacity-100' : 'opacity-100 hover:scale-[1.01]'}`}>
                <div className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${activeSection === 'employment' ? 'shadow-2xl shadow-amber-900/5 border-amber-400/30 ring-4 ring-amber-50' : 'shadow-sm border-gray-100 hover:shadow-md'}`}>
                    <button onClick={() => toggleSection('employment')} className="w-full p-6 md:p-8 flex justify-between items-center group">
                        <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${activeSection === 'employment' ? 'bg-gradient-to-tr from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200' : 'bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white'}`}>
                                <Briefcase size={26} />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-xl text-gray-800">Employment History</h4>
                                <p className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wider">{profileData.employment.length} Records (Past Jobs)</p>
                            </div>
                        </div>
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${activeSection === 'employment' ? 'bg-gray-100 rotate-180 text-gray-800' : 'bg-white text-gray-300 group-hover:bg-gray-50'}`}>
                            <ChevronDown size={20} />
                        </div>
                    </button>

                    {activeSection === 'employment' && (
                        <div className="px-8 pb-10 animate-fade-in-up bg-gray-50/30">
                             <div className="h-px w-full bg-gray-100 mb-8"></div>
                             <div className="space-y-6">
                                {profileData.employment.length === 0 && (
                                    <div className="text-center py-8 text-gray-400 italic text-sm">No past employment records found. Current jobs are managed in 'Employment Status'.</div>
                                )}
                                {profileData.employment.map((emp, index) => (
                                    <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative hover:shadow-lg transition-shadow duration-300 group/card">
                                        <div className="absolute top-4 right-4 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                            <button onClick={() => removeEmployment(index)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><X size={18}/></button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
                                                <div className="relative">
                                                    <select 
                                                        value={emp.employment_status || ''}
                                                        onChange={(e) => updateEmployment(index, 'employment_status', e.target.value)}
                                                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none font-semibold text-sm text-gray-700 focus:ring-2 focus:ring-amber-200 appearance-none"
                                                    >
                                                        <option value="">Select Status</option>
                                                        <option value="Employed">Employed</option>
                                                        <option value="Self-employed">Self-employed</option>
                                                        <option value="Unemployed">Unemployed</option>
                                                        <option value="Retired">Retired</option>
                                                    </select>
                                                    <ChevronDown size={16} className="absolute right-4 top-3.5 text-gray-400 pointer-events-none"/>
                                                </div>
                                            </div>

                                            {emp.employment_status === 'Employed' && (
                                                <>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-gray-400 uppercase">Company</label>
                                                    <input className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none font-semibold text-sm focus:ring-2 focus:ring-amber-200" value={emp.company_name || ''} onChange={(e) => updateEmployment(index, 'company_name', e.target.value)} placeholder="Company Name" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-gray-400 uppercase">Position</label>
                                                    <input className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none font-semibold text-sm focus:ring-2 focus:ring-amber-200" value={emp.position || ''} onChange={(e) => updateEmployment(index, 'position', e.target.value)} placeholder="Job Title" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-gray-400 uppercase">Date Hired</label>
                                                    <input type="date" className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none font-semibold text-sm focus:ring-2 focus:ring-amber-200" value={emp.date_hired || ''} onChange={(e) => updateEmployment(index, 'date_hired', e.target.value)} />
                                                </div>
                                                </>
                                            )}
                                            {emp.employment_status === 'Self-employed' && (
                                                <>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-gray-400 uppercase">Business Name</label>
                                                    <input className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none font-semibold text-sm focus:ring-2 focus:ring-amber-200" value={emp.business_name || ''} onChange={(e) => updateEmployment(index, 'business_name', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-gray-400 uppercase">Nature of Business</label>
                                                    <input className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none font-semibold text-sm focus:ring-2 focus:ring-amber-200" value={emp.business_type || ''} onChange={(e) => updateEmployment(index, 'business_type', e.target.value)} />
                                                </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <button onClick={addEmployment} className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-amber-400 hover:bg-amber-50/50 text-gray-400 hover:text-amber-600 font-bold text-sm transition-all flex items-center justify-center gap-2">
                                    <Plus size={18}/> Add Past Employment Record
                                </button>
                             </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Community Engagement */}
            <div className={`transition-all duration-500 ease-out ${activeSection === 'community' ? 'scale-100 opacity-100' : 'opacity-100 hover:scale-[1.01]'}`}>
                <div className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${activeSection === 'community' ? 'shadow-2xl shadow-rose-900/5 border-rose-400/30 ring-4 ring-rose-50' : 'shadow-sm border-gray-100 hover:shadow-md'}`}>
                    <button onClick={() => toggleSection('community')} className="w-full p-6 md:p-8 flex justify-between items-center group">
                        <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${activeSection === 'community' ? 'bg-gradient-to-tr from-rose-400 to-pink-500 text-white shadow-lg shadow-rose-200' : 'bg-rose-50 text-rose-500 group-hover:bg-rose-500 group-hover:text-white'}`}>
                                <Heart size={26} />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-xl text-gray-800">Community</h4>
                                <p className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wider">Volunteering & Outreach</p>
                            </div>
                        </div>
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${activeSection === 'community' ? 'bg-gray-100 rotate-180 text-gray-800' : 'bg-white text-gray-300 group-hover:bg-gray-50'}`}>
                            <ChevronDown size={20} />
                        </div>
                    </button>

                    {activeSection === 'community' && (
                        <div className="px-8 pb-10 animate-fade-in-up">
                            <div className="h-px w-full bg-gray-100 mb-8"></div>
                            <div className="space-y-4">
                                {profileData.community.map((comm, index) => (
                                    <div key={index} className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                                        <button onClick={() => removeCommunity(index)} className="absolute top-2 right-2 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full"><X size={16}/></button>
                                        
                                        {/* Replaced renderInput with direct inputs using updateCommunity */}
                                        <div className="space-y-2 group">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider group-focus-within:text-luGreen transition-colors flex items-center gap-1">
                                                Organization
                                                <div className="h-[1px] flex-grow bg-gray-100 group-focus-within:bg-luGreen/20 ml-2 transition-colors"></div>
                                            </label>
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={comm.organization_name || ''} 
                                                    onChange={(e) => updateCommunity(index, 'organization_name', e.target.value)}
                                                    className="w-full px-4 py-3.5 rounded-xl bg-gray-50/80 border border-transparent hover:bg-gray-50 focus:bg-white focus:border-luGreen focus:ring-4 focus:ring-green-500/10 text-sm font-semibold text-gray-800 transition-all shadow-sm placeholder:text-gray-300"
                                                    placeholder="Red Cross, etc."
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2 group">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider group-focus-within:text-luGreen transition-colors flex items-center gap-1">
                                                Role
                                                <div className="h-[1px] flex-grow bg-gray-100 group-focus-within:bg-luGreen/20 ml-2 transition-colors"></div>
                                            </label>
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={comm.role || ''} 
                                                    onChange={(e) => updateCommunity(index, 'role', e.target.value)}
                                                    className="w-full px-4 py-3.5 rounded-xl bg-gray-50/80 border border-transparent hover:bg-gray-50 focus:bg-white focus:border-luGreen focus:ring-4 focus:ring-green-500/10 text-sm font-semibold text-gray-800 transition-all shadow-sm placeholder:text-gray-300"
                                                    placeholder="Volunteer"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2 group">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider group-focus-within:text-luGreen transition-colors flex items-center gap-1">
                                                Date Affiliated
                                                <div className="h-[1px] flex-grow bg-gray-100 group-focus-within:bg-luGreen/20 ml-2 transition-colors"></div>
                                            </label>
                                            <div className="relative">
                                                <input 
                                                    type="date" 
                                                    value={comm.date_affiliated || ''} 
                                                    onChange={(e) => updateCommunity(index, 'date_affiliated', e.target.value)}
                                                    className="w-full px-4 py-3.5 rounded-xl bg-gray-50/80 border border-transparent hover:bg-gray-50 focus:bg-white focus:border-luGreen focus:ring-4 focus:ring-green-500/10 text-sm font-semibold text-gray-800 transition-all shadow-sm placeholder:text-gray-300"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addCommunity} className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-rose-400 hover:bg-rose-50/50 text-gray-400 hover:text-rose-600 font-bold text-sm transition-all flex items-center justify-center gap-2">
                                    <Plus size={18}/> Add Community Engagement
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. Graduate Attributes (Skills) */}
             <div className={`transition-all duration-500 ease-out ${activeSection === 'attributes' ? 'scale-100 opacity-100' : 'opacity-100 hover:scale-[1.01]'}`}>
                <div className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${activeSection === 'attributes' ? 'shadow-2xl shadow-violet-900/5 border-violet-400/30 ring-4 ring-violet-50' : 'shadow-sm border-gray-100 hover:shadow-md'}`}>
                    <button onClick={() => toggleSection('attributes')} className="w-full p-6 md:p-8 flex justify-between items-center group">
                        <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${activeSection === 'attributes' ? 'bg-gradient-to-tr from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-200' : 'bg-violet-50 text-violet-500 group-hover:bg-violet-600 group-hover:text-white'}`}>
                                <BookOpen size={26} />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-xl text-gray-800">Attributes & Skills</h4>
                                <p className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wider">Self-Assessment (AI Estimated)</p>
                            </div>
                        </div>
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${activeSection === 'attributes' ? 'bg-gray-100 rotate-180 text-gray-800' : 'bg-white text-gray-300 group-hover:bg-gray-50'}`}>
                            <ChevronDown size={20} />
                        </div>
                    </button>

                    {activeSection === 'attributes' && (
                        <div className="px-8 pb-10 animate-fade-in-up">
                            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 mb-8 flex items-center gap-4 text-violet-800">
                                <div className="bg-white p-2 rounded-lg shadow-sm"><Star size={18} className="text-violet-500 fill-violet-500"/></div>
                                <p className="text-sm font-medium">Auto-rated based on your resume. You can manually adjust from <strong>1 (Lowest)</strong> to <strong>5 (Highest)</strong>.</p>
                            </div>

                            <div className="space-y-10">
                                {/* Institutional Attributes */}
                                <div>
                                    <h5 className="flex items-center gap-3 text-sm font-bold text-gray-900 uppercase tracking-widest mb-6">
                                        <div className="w-8 h-1 bg-luGreen rounded-full"></div>
                                        Core Attributes
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderRating('professionally_competent', 'Professionally Competent')}
                                        {renderRating('critical_thinker', 'Critical Thinker')}
                                        {renderRating('communicator', 'Communicator')}
                                        {renderRating('lifelong_learner', 'Lifelong Learner')}
                                        {renderRating('socially_responsible', 'Socially Responsible')}
                                        {renderRating('ethical_citizen', 'Ethical Citizen')}
                                        {renderRating('innovative_worker', 'Innovative Worker')}
                                        {renderRating('people_oriented', 'People Oriented')}
                                    </div>
                                </div>

                                {/* Skills */}
                                <div>
                                    <h5 className="flex items-center gap-3 text-sm font-bold text-gray-900 uppercase tracking-widest mb-6">
                                        <div className="w-8 h-1 bg-luGold rounded-full"></div>
                                        21st Century Skills
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderRating('critical_thinking_skill', 'Critical Thinking')}
                                        {renderRating('creativity', 'Creativity')}
                                        {renderRating('collaboration', 'Collaboration')}
                                        {renderRating('communication_skill', 'Communication Skills')}
                                        {renderRating('information_literacy', 'Information Literacy')}
                                        {renderRating('media_literacy', 'Media Literacy')}
                                        {renderRating('technology_literacy', 'Technology Literacy')}
                                        {renderRating('flexibility', 'Flexibility')}
                                        {renderRating('leadership', 'Leadership')}
                                        {renderRating('initiative', 'Initiative')}
                                        {renderRating('productivity', 'Productivity')}
                                        {renderRating('social_skills', 'Social Skills')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SAVE BUTTON BAR */}
            <div className="flex justify-end pt-8">
                 <button 
                    onClick={handleSaveAllData}
                    disabled={loading || normalizingRoles}
                    className="group relative px-8 py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-xl shadow-gray-400/20 hover:shadow-2xl hover:shadow-gray-400/40 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                >
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-luGreen to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex items-center gap-3">
                        {loading || normalizingRoles ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>{normalizingRoles ? "Standardizing Roles..." : "Saving Profile..."}</span>
                            </>
                        ) : (
                            <>
                                <span>{hasExistingRecord ? "Update Profile" : "Save Full Profile"}</span>
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"/>
                            </>
                        )}
                    </div>
                </button>
            </div>
        </div>

    </div>

    {/* === MODAL: CURRENT JOB VERIFICATION === */}
    {showCurrentJobModal && currentJobCandidate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"></div>
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 m-4 max-h-[90vh] overflow-y-auto">
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center shadow-inner">
                                <Briefcase className="w-6 h-6 text-luGreen" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-gray-800 leading-tight">Current Job Detected</h3>
                                <p className="text-xs text-gray-500">We found an active role in your resume.</p>
                            </div>
                        </div>
                        <button onClick={() => setShowCurrentJobModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    </div>

                    {analyzingJob ? (
                         <div className="py-12 flex flex-col items-center justify-center text-center">
                            <div className="relative w-16 h-16 mb-4">
                                <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-luGreen border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <p className="text-sm font-bold text-gray-800">Analyzing Job Details...</p>
                            <p className="text-xs text-gray-500 mt-1">Determining Industry & Course Alignment</p>
                         </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-sm">
                                <p className="font-bold text-green-800 mb-2">AI Analysis Complete</p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="bg-white px-2 py-1 rounded-md border border-green-200 text-xs font-semibold text-green-700">{currentJobCandidate.industry}</span>
                                    <span className={`bg-white px-2 py-1 rounded-md border text-xs font-semibold ${currentJobCandidate.job_alignment === 'Related' ? 'border-green-200 text-green-700' : 'border-amber-200 text-amber-700'}`}>
                                        {currentJobCandidate.job_alignment} to Course
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Company Name</label>
                                    <input 
                                        type="text" 
                                        value={currentJobCandidate.company_name || currentJobCandidate.business_name || ''} 
                                        onChange={(e) => setCurrentJobCandidate(prev => ({...prev!, company_name: e.target.value}))}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-semibold"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Company Address (Required)</label>
                                    <input 
                                        type="text" 
                                        placeholder="City, Country"
                                        value={currentJobCandidate.company_address || currentJobCandidate.business_address || ''} 
                                        onChange={(e) => setCurrentJobCandidate(prev => ({...prev!, company_address: e.target.value}))}
                                        className="w-full px-3 py-2 bg-white rounded-lg border-2 border-green-100 focus:border-luGreen outline-none text-sm font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Position</label>
                                    <input 
                                        type="text" 
                                        value={currentJobCandidate.current_position || ''} 
                                        onChange={(e) => setCurrentJobCandidate(prev => ({...prev!, current_position: e.target.value}))}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Date Hired</label>
                                    <input 
                                        type="date" 
                                        value={currentJobCandidate.date_hired || ''} 
                                        onChange={(e) => setCurrentJobCandidate(prev => ({...prev!, date_hired: e.target.value}))}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-semibold"
                                    />
                                </div>
                                
                                {currentJobCandidate.employment_status === 'Employed' && (
                                    <>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Employment Type</label>
                                        <select 
                                            value={currentJobCandidate.employment_type || ''}
                                            onChange={(e) => setCurrentJobCandidate(prev => ({...prev!, employment_type: e.target.value as any}))}
                                            className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-semibold"
                                        >
                                            <option value="">Select Type</option>
                                            <option value="Full-Time">Full-Time</option>
                                            <option value="Part-Time">Part-Time</option>
                                            <option value="Temporary/Contract">Temporary/Contract</option>
                                            <option value="Seasonal">Seasonal</option>
                                            <option value="Casual">Casual</option>
                                            <option value="Internship">Internship</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Exact Salary</label>
                                        <input 
                                            type="number" 
                                            placeholder="e.g. 25000"
                                            value={currentJobCandidate.exact_salary || ''}
                                            onChange={(e) => setCurrentJobCandidate(prev => ({...prev!, exact_salary: e.target.value}))}
                                            className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-semibold"
                                        />
                                    </div>
                                    </>
                                )}

                                {currentJobCandidate.employment_status === 'Self-employed' && (
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Exact Revenue</label>
                                        <input 
                                            type="number" 
                                            placeholder="e.g. 50000"
                                            value={currentJobCandidate.exact_revenue || ''}
                                            onChange={(e) => setCurrentJobCandidate(prev => ({...prev!, exact_revenue: e.target.value}))}
                                            className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-semibold"
                                        />
                                    </div>
                                )}
                            </div>

                            {currentJobCandidate.job_alignment === 'Non-Related' && (
                                <div className="animate-fade-in bg-amber-50 p-4 rounded-xl border border-amber-200">
                                    <label className="text-xs font-bold text-amber-800 uppercase flex items-center gap-1 mb-2">
                                        <HelpCircle size={12} /> Reason for Misalignment (Required)
                                    </label>
                                    <select 
                                        value={misalignmentReason}
                                        onChange={(e) => setMisalignmentReason(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-amber-200 text-sm font-semibold focus:border-amber-400 outline-none"
                                    >
                                        <option value="">-- Select Reason --</option>
                                        <option value="Better Salary/Benefits">Better Salary & Benefits</option>
                                        <option value="Career Advancement">Career Advancement</option>
                                        <option value="Limited Job Opportunity">Limited Job Opportunity</option>
                                        <option value="Career Shift / Passion">Career Shift / Passion</option>
                                        <option value="Proximity to Residence">Proximity to Residence</option>
                                    </select>
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={saveConfirmedCurrentJob}
                                    disabled={savingCurrentJob || (!currentJobCandidate.company_address && !currentJobCandidate.business_address)}
                                    className="flex-1 py-3 bg-luGreen text-white font-bold rounded-xl shadow-lg hover:bg-luGreen-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {savingCurrentJob ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                                    Confirm & Save Status
                                </button>
                                <button onClick={() => setShowCurrentJobModal(false)} className="px-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200">
                                    Skip
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )}

    {/* === MODAL: DELETE CONFIRMATION === */}
    {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowDeleteModal(false)}></div>
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 m-4">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 mb-2">Delete Resume?</h3>
                    <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                        This will remove the file and unlink extraction data. This action cannot be undone.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                         <button 
                            onClick={() => setShowDeleteModal(false)}
                            className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDeleteResume}
                            disabled={deletingResume}
                            className="py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-all text-sm flex items-center justify-center gap-2"
                        >
                            {deletingResume ? <Loader2 size={16} className="animate-spin" /> : "Yes, Delete"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )}
    
    </>
  );
};

export default MyProfilePage;
