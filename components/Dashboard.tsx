
import React, { useState, useEffect } from 'react';
import { LogOut, User, Bell, Search, ChevronDown, Briefcase, LayoutDashboard, Loader2, Globe, Lock, PieChart, AlertCircle, Sparkles, MapPin, ArrowRight, Calendar, Users, Building2, GraduationCap, Mail, CheckCircle, ShieldCheck } from 'lucide-react';
import { Student, JobPosting } from '../types';
import EmploymentStatusPage from './EmploymentStatusPage';
import MyProfilePage from './MyProfilePage';
import JobPostingsPage from './JobPostingsPage';
import ForYouPage from './ForYouPage';
import ConnectPage from './ConnectPage';
import { fetchLatestProfile } from '../services/resumeService';
import { getOpenJobs } from '../services/jobService';
import { supabase } from '../lib/supabaseClient';

interface DashboardProps {
  user: Student;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'employment' | 'profile' | 'jobs' | 'for-you' | 'connect'>('home');
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  
  // Data State
  const [recentJobs, setRecentJobs] = useState<JobPosting[]>([]);
  
  // Modals State
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  // Dashboard Metrics State
  const [metrics, setMetrics] = useState({
    completionPercentage: 0,
    employmentStatus: 'Unknown',
    latestCompany: '',
    missingSections: [] as string[]
  });

  useEffect(() => {
    // Check for first-time login
    if (user.is_first_login) {
        setShowPasswordChangeModal(true);
    }

    const loadDashboardData = async () => {
        if (!user.id) return;
        setLoadingMetrics(true);
        try {
            // Determine table
            const userType = user.table_source === 'students' ? 'student' : 
                             user.table_source === 'alumni' ? 'alumni' : 
                             (user.enrollment_status === 'Graduating' ? 'graduating' : 'alumni');
            
            // 1. Fetch Profile Data
            const profileData = await fetchLatestProfile(user.id, userType);
            
            // 2. Fetch Employment Records
            const idColumn = userType === 'alumni' ? 'alumni_id' : 'student_id';
            const { data: surveys } = await supabase.from('survey_responses').select('id').eq(idColumn, user.id);
            
            let statusDisplay = 'Update Status';
            let companyDisplay = '';

            if (surveys && surveys.length > 0) {
                const surveyIds = surveys.map(s => s.id);
                const { data: records } = await supabase
                    .from('employment_information')
                    .select('*')
                    .in('survey_response_id', surveyIds)
                    .order('id', { ascending: false });

                if (records && records.length > 0) {
                    const hasEmployed = records.some(r => r.employment_status === 'Employed');
                    const hasSelfEmployed = records.some(r => r.employment_status === 'Self-employed');
                    const latest = records[0];

                    if (hasEmployed && hasSelfEmployed) {
                        statusDisplay = 'Employed & Self-employed';
                        companyDisplay = 'Multiple Roles';
                    } else if (hasEmployed) {
                        statusDisplay = 'Employed';
                        companyDisplay = latest.company_name;
                    } else if (hasSelfEmployed) {
                        statusDisplay = 'Self-employed';
                        companyDisplay = latest.business_name;
                    } else {
                        statusDisplay = latest.employment_status || 'Unknown';
                        if (statusDisplay === 'Retired') companyDisplay = `Retired from ${latest.last_company || 'work'}`;
                        else companyDisplay = 'Not currently employed';
                    }
                }
            }

            // 3. Completion Percentage
            let score = 0;
            const missing: string[] = [];

            if (user.address && user.contact_no) score += 50;
            else missing.push("Contact Details");

            if (profileData && profileData.education && (profileData.education.primary_school || profileData.education.bachelors_degree)) score += 50;
            else missing.push("Education History");

            if (statusDisplay === 'Update Status' || statusDisplay === 'Unknown') missing.push("Employment Status (Optional)");

            const hasAttributes = profileData && profileData.attributes && Object.values(profileData.attributes).some(val => Number(val) > 0);
            if (!hasAttributes) missing.push("Skills & Attributes (Optional)");

            setMetrics({
                completionPercentage: score,
                employmentStatus: statusDisplay,
                latestCompany: companyDisplay,
                missingSections: missing
            });

            // 4. Fetch Recent Jobs (for widget)
            const jobs = await getOpenJobs();
            setRecentJobs(jobs.slice(0, 2)); // Get top 2 newest

        } catch (error) {
            console.error("Dashboard Load Error", error);
        } finally {
            setLoadingMetrics(false);
        }
    };

    if (activeTab === 'home') {
        loadDashboardData();
    }
  }, [user.id, user.enrollment_status, activeTab, user.table_source]);

  const handleRestrictedTab = (tab: 'jobs' | 'for-you' | 'connect') => {
      if (metrics.completionPercentage < 100) {
          setShowRestrictionModal(true);
      } else {
          setActiveTab(tab);
      }
  };

  const handlePasswordChange = async () => {
    if (newPass.length < 6) return setPasswordChangeError("Password must be at least 6 characters.");
    if (newPass !== confirmPass) return setPasswordChangeError("Passwords do not match.");
    
    setPasswordChangeLoading(true);
    setPasswordChangeError('');
    
    try {
        const { error } = await supabase
            .from(user.table_source || 'students')
            .update({ 
                password: newPass,
                is_first_login: false 
            })
            .eq('id', user.id);

        if (error) throw error;
        
        setPasswordChangeSuccess(true);
        setTimeout(() => setShowPasswordChangeModal(false), 2000);
    } catch (err: any) {
        setPasswordChangeError(err.message || "Failed to update password.");
    } finally {
        setPasswordChangeLoading(false);
    }
  };

  const NavItem = ({ id, label, icon: Icon, locked = false }: { id: string, label: string, icon: any, locked?: boolean }) => (
    <button 
      onClick={() => locked ? handleRestrictedTab(id as any) : setActiveTab(id as any)}
      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden mb-1 ${
        activeTab === id 
        ? 'bg-gradient-to-r from-luGreen to-emerald-600 text-white shadow-lg shadow-green-500/20' 
        : 'text-gray-600 hover:bg-white/60 hover:text-luGreen'
      }`}
    >
        <div className="flex items-center gap-3 relative z-10">
            <Icon size={18} className={activeTab === id ? 'text-white' : 'text-gray-400 group-hover:text-luGreen'} />
            <span className="font-bold text-sm tracking-wide">{label}</span>
        </div>
        {locked && metrics.completionPercentage < 100 && (
            <Lock size={14} className="text-gray-400/70" />
        )}
        {activeTab === id && (
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        )}
    </button>
  );

  // Define tabs that use full-height custom layout without default wrapper
  const isFullPage = ['connect', 'jobs', 'for-you'].includes(activeTab);

  return (
    <>
      {/* Forced Password Change Modal */}
      {showPasswordChangeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-slide-up border border-slate-100">
                <div className="bg-gradient-to-br from-luGreen to-luGreen-dark p-10 text-white relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Lock size={120} />
                    </div>
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                        <Sparkles className="text-luGold" size={28} />
                    </div>
                    <h3 className="text-3xl font-black font-display tracking-tight leading-tight">Secure Your Account</h3>
                    <p className="opacity-80 text-sm mt-3 font-medium leading-relaxed">As this is your first login, please update your security credentials to continue.</p>
                </div>
                
                <div className="p-10 space-y-6">
                    {passwordChangeSuccess ? (
                        <div className="text-center py-6 animate-fade-in">
                            <div className="w-16 h-16 bg-green-100 text-luGreen rounded-full flex items-center justify-center mx-auto mb-4 scale-110">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <h4 className="text-xl font-black text-slate-800">Security Updated!</h4>
                            <p className="text-sm text-slate-500 mt-2 font-medium">Redirecting to your dashboard...</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest pl-1">New Secure Password</label>
                                <div className="relative">
                                    <input 
                                        type="password" 
                                        value={newPass} 
                                        onChange={(e) => setNewPass(e.target.value)}
                                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-luGreen focus:bg-white focus:ring-4 focus:ring-luGreen/5 outline-none transition-all font-bold text-slate-800"
                                        placeholder="Min. 6 characters"
                                    />
                                    <Lock size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest pl-1">Confirm New Password</label>
                                <div className="relative">
                                    <input 
                                        type="password" 
                                        value={confirmPass} 
                                        onChange={(e) => setConfirmPass(e.target.value)}
                                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-luGreen focus:bg-white focus:ring-4 focus:ring-luGreen/5 outline-none transition-all font-bold text-slate-800"
                                        placeholder="Repeat password"
                                    />
                                    <ShieldCheck size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>
                            </div>

                            {passwordChangeError && (
                                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3 animate-shake">
                                    <AlertCircle className="text-red-500 shrink-0" size={18} />
                                    <p className="text-[11px] font-bold text-red-800 leading-tight">{passwordChangeError}</p>
                                </div>
                            )}

                            <button 
                                onClick={handlePasswordChange}
                                disabled={passwordChangeLoading}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black shadow-xl shadow-slate-200 hover:bg-slate-800 hover:translate-y-[-2px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2 group mt-2"
                            >
                                {passwordChangeLoading ? (
                                    <Loader2 size={20} className="animate-spin" />
                                ) : (
                                    <>
                                        SET NEW PASSWORD
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      <div className="h-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden text-slate-800 selection:bg-luGreen selection:text-white">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-green-200/20 blur-[120px]"></div>
          <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-200/20 blur-[120px]"></div>
          <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] rounded-full bg-purple-200/20 blur-[120px]"></div>
      </div>

      {/* Glass Header (Thicker + Gradient) */}
      <header className="flex-none z-50 px-4 pt-4">
        <div className="bg-gradient-to-r from-white/95 via-slate-50/95 to-white/95 backdrop-blur-2xl border border-white/60 shadow-sm rounded-3xl px-8 py-6 flex justify-between items-center max-w-[1600px] mx-auto">
            
            {/* Logo */}
            <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setActiveTab('home')}>
              <div className="w-12 h-12 bg-gradient-to-br from-luGreen to-emerald-600 rounded-xl flex items-center justify-center shadow-lg text-white font-display font-bold text-xl group-hover:scale-105 transition-transform">
                 <GraduationCap size={28} />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none group-hover:text-luGreen transition-colors">ALUMNI TRACER</h1>
                <p className="text-[11px] text-slate-500 font-bold tracking-widest uppercase mt-1">Laguna University</p>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center space-x-2 text-xs bg-emerald-50/80 backdrop-blur-md text-emerald-700 py-2 px-4 rounded-full border border-emerald-100/50 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-bold">System Online</span>
              </div>
            </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-grow w-full max-w-[1600px] mx-auto px-4 py-6 relative z-10 flex gap-6 overflow-hidden">
          
          {/* Left Navigation Panel - Fixed Sidebar */}
          <div className="hidden lg:flex flex-col w-72 flex-shrink-0 h-full">
            <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-xl shadow-slate-200/50 flex flex-col h-full overflow-hidden relative">
                
                {/* User Profile Section (Side-by-Side Name) */}
                <div className="p-5 relative z-10 bg-gradient-to-b from-white/50 to-transparent">
                    <div className="flex flex-col mb-2">
                        <h2 className="text-xl font-black text-slate-800 leading-tight truncate" title={`${user.first_name} ${user.last_name}`}>
                            {user.first_name} <span className="text-luGreen">{user.last_name}</span>
                        </h2>
                        <div className="flex items-center gap-1 mt-1 text-slate-500">
                            <Mail size={12} className="shrink-0"/>
                            <p className="text-[10px] font-bold truncate opacity-70">{user.email}</p>
                        </div>
                    </div>
                </div>

                <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-1"></div>

                {/* Nav Items (Scrollable Middle) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-3">Main Menu</p>
                        <div className="space-y-1">
                            <NavItem id="home" label="Dashboard" icon={LayoutDashboard} />
                            <NavItem id="profile" label="My Profile" icon={User} />
                            <NavItem id="employment" label="Job Status" icon={Briefcase} />
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-3">Opportunities</p>
                        <div className="space-y-1">
                            <NavItem id="connect" label="Network" icon={Globe} locked />
                            <NavItem id="jobs" label="Job Board" icon={Briefcase} locked />
                            <NavItem id="for-you" label="For You" icon={Search} locked />
                        </div>
                    </div>
                </div>

                {/* Logout Section (Bottom) */}
                <div className="p-4 border-t border-white/50 bg-white/40 mt-auto backdrop-blur-md">
                    <button 
                        onClick={() => setShowLogoutModal(true)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600 transition-all group border border-red-100 hover:border-red-200 shadow-sm"
                    >
                        <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span>Log Out</span>
                    </button>
                </div>
            </div>
          </div>

          {/* Right Content Area - Conditional Layout based on Tab */}
          <div className={`flex-1 h-full pr-2 ${isFullPage ? 'overflow-hidden flex flex-col pb-0' : 'overflow-y-auto pb-20 scrollbar-hide'}`}>
            
            {/* Mobile Nav (Fallback) */}
            <div className="lg:hidden mb-6 overflow-x-auto pb-2 shrink-0">
                 <div className="flex gap-2">
                    <button onClick={() => setActiveTab('home')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shadow-sm border ${activeTab === 'home' ? 'bg-luGreen text-white border-luGreen' : 'bg-white text-slate-600 border-white'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shadow-sm border ${activeTab === 'profile' ? 'bg-luGreen text-white border-luGreen' : 'bg-white text-slate-600 border-white'}`}>Profile</button>
                    <button onClick={() => setActiveTab('employment')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shadow-sm border ${activeTab === 'employment' ? 'bg-luGreen text-white border-luGreen' : 'bg-white text-slate-600 border-white'}`}>Job Status</button>
                    <button onClick={() => handleRestrictedTab('jobs')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shadow-sm border ${activeTab === 'jobs' ? 'bg-luGreen text-white border-luGreen' : 'bg-white text-slate-600 border-white'}`}>Jobs</button>
                    <button onClick={() => setShowLogoutModal(true)} className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shadow-sm border bg-red-50 text-red-500 border-red-100">Log Out</button>
                 </div>
            </div>

            {activeTab === 'home' && (
                <div className="space-y-6 animate-fade-in">
                    {/* ... Dashboard Content ... */}
                    {/* Welcome Hero */}
                    <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-green-600 to-emerald-700 text-white shadow-xl shadow-green-500/20 min-h-[180px] flex items-center group">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                        <div className="absolute right-20 bottom-0 w-40 h-40 bg-white/10 rounded-full blur-[50px]"></div>
                        <div className="relative z-10 px-10 py-8 w-full">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-display font-black mb-2 tracking-tight">
                                    Hello, <span className="text-white">{user.first_name}!</span>
                                </h2>
                                <p className="text-green-50 text-sm max-w-lg leading-relaxed font-medium">
                                    Welcome to your personalized alumni dashboard. Keep your career journey updated and unlock exclusive opportunities.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Status Card */}
                        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] border border-blue-100 shadow-lg shadow-blue-500/5 hover:bg-white hover:border-blue-200 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-[4rem] -z-10 transition-transform group-hover:scale-110 origin-top-right"></div>
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-200 group-hover:rotate-3 transition-transform"><Briefcase size={24} /></div>
                                <button onClick={() => setActiveTab('employment')} className="text-xs font-bold text-blue-400 hover:text-blue-600 flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-blue-50 shadow-sm">Update <ArrowRight size={12}/></button>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Current Status</p>
                                <h3 className={`text-2xl font-black ${metrics.employmentStatus === 'Unemployed' ? 'text-red-500' : 'text-slate-800'}`}>{loadingMetrics ? 'Loading...' : metrics.employmentStatus}</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1 truncate flex items-center gap-2">{metrics.latestCompany ? <Building2 size={14} className="text-slate-300"/> : null}{metrics.latestCompany || 'No active employment record'}</p>
                            </div>
                        </div>

                        {/* Completion Card */}
                        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] border border-violet-100 shadow-lg shadow-violet-500/5 hover:bg-white hover:border-violet-200 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-50 rounded-bl-[4rem] -z-10 transition-transform group-hover:scale-110 origin-top-right"></div>
                            <div className="flex justify-between items-start mb-6">
                                <div className={`p-3 rounded-2xl shadow-lg group-hover:rotate-3 transition-transform ${metrics.completionPercentage === 100 ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-violet-500 text-white shadow-violet-200'}`}><PieChart size={24} /></div>
                                <button onClick={() => setActiveTab('profile')} className="text-xs font-bold text-violet-400 hover:text-violet-600 flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-violet-50 shadow-sm">Edit Profile <ArrowRight size={12}/></button>
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">Completion</p>
                                    <span className="text-xl font-black text-slate-800">{metrics.completionPercentage}%</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                    <div className={`h-full rounded-full transition-all duration-1000 ${metrics.completionPercentage === 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-violet-400 to-purple-500'}`} style={{ width: `${metrics.completionPercentage}%` }}></div>
                                </div>
                                {metrics.missingSections.length > 0 && <div className="mt-3 flex items-center gap-2"><AlertCircle size={12} className="text-amber-500" /><p className="text-[10px] font-bold text-amber-600">Missing: {metrics.missingSections[0]} {metrics.missingSections.length > 1 && `+${metrics.missingSections.length - 1} more`}</p></div>}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Latest Jobs Widget */}
                        <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] border border-teal-100 shadow-lg shadow-teal-500/5 hover:bg-white hover:border-teal-200 transition-all flex flex-col relative overflow-hidden">
                            <div className="flex justify-between items-center mb-6 relative z-10">
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><div className="p-1.5 bg-teal-100 text-teal-600 rounded-lg"><Briefcase size={16}/></div> Recommended Jobs</h3>
                                {metrics.completionPercentage === 100 && <button onClick={() => setActiveTab('jobs')} className="text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline">View All</button>}
                            </div>
                            {metrics.completionPercentage < 100 ? (
                                <div className="flex-grow flex flex-col items-center justify-center text-center py-8 relative">
                                    <div className="absolute inset-0 bg-white/40 backdrop-blur-md z-10 flex items-center justify-center rounded-2xl border border-white/50">
                                        <div className="bg-white/90 p-6 rounded-2xl shadow-xl border border-white flex flex-col items-center">
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-3"><Lock size={24} /></div>
                                            <h4 className="font-bold text-gray-800 mb-1">Feature Locked</h4>
                                            <p className="text-xs text-gray-500 max-w-[200px]">Complete your profile to 100% to unlock personalized job recommendations.</p>
                                            <button onClick={() => setActiveTab('profile')} className="mt-4 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors">Complete Profile</button>
                                        </div>
                                    </div>
                                    <div className="w-full space-y-3 opacity-30 pointer-events-none filter blur-sm"><div className="h-20 bg-gray-200 rounded-xl w-full"></div><div className="h-20 bg-gray-200 rounded-xl w-full"></div></div>
                                </div>
                            ) : (
                                <div className="space-y-3 relative z-10">
                                    {recentJobs.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">No new jobs available.</div> : recentJobs.map(job => (
                                        <div key={job.id} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-teal-200 transition-all flex justify-between items-center group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">{job.company_name[0]}</div>
                                                <div><h4 className="font-bold text-gray-800 text-sm group-hover:text-teal-600 transition-colors">{job.job_title}</h4><p className="text-xs text-gray-500">{job.company_name} • {job.location}</p></div>
                                            </div>
                                            <button onClick={() => setActiveTab('jobs')} className="p-2 bg-gray-50 text-gray-400 rounded-lg group-hover:bg-teal-500 group-hover:text-white transition-all shadow-sm"><ArrowRight size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Networking Widget */}
                        <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-6 rounded-[2rem] shadow-xl shadow-green-500/20 text-white relative overflow-hidden flex flex-col justify-between min-h-[250px] border border-white/20">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4"><div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm shadow-sm"><Users size={18}/></div><span className="text-xs font-bold uppercase tracking-widest text-green-100">Community</span></div>
                                <h3 className="text-xl font-bold mb-2">Expand Your Network</h3>
                                <p className="text-green-50 text-xs leading-relaxed mb-6 font-medium">Connect with fellow graduates, join forums, and create groups.</p>
                            </div>
                            <button onClick={() => metrics.completionPercentage < 100 ? setShowRestrictionModal(true) : setActiveTab('connect')} className="w-full py-3 bg-white text-green-600 font-bold rounded-xl shadow-lg hover:bg-green-50 transition-colors flex items-center justify-center gap-2 text-sm relative z-10">Go to Connect</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-xl shadow-slate-200/50 p-6 md:p-8 animate-fade-in">
                    <MyProfilePage user={user} />
                </div>
            )}

            {activeTab === 'employment' && (
                <EmploymentStatusPage user={user} />
            )}

            {/* FULL HEIGHT APPS */}
            {activeTab === 'jobs' && (
                <div className="h-full w-full overflow-hidden animate-fade-in">
                    <JobPostingsPage user={user} />
                </div>
            )}

            {activeTab === 'for-you' && (
                <div className="h-full w-full overflow-hidden animate-fade-in">
                    <ForYouPage user={user} />
                </div>
            )}

            {activeTab === 'connect' && (
                <div className="h-full w-full overflow-hidden animate-fade-in">
                    <ConnectPage user={user} />
                </div>
            )}
            
          </div>
      </main>

      {/* --- RESTRICTION MODAL --- */}
      {showRestrictionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowRestrictionModal(false)}></div>
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 p-8 text-center">
                  <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-amber-50/50"><Lock className="w-10 h-10 text-amber-500" /></div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2">Feature Locked</h3>
                  <p className="text-gray-500 text-sm mb-8 leading-relaxed">This feature is reserved for active alumni with a complete profile. Please reach <strong>100% Profile Progress</strong> to access the network and job board.</p>
                  <div className="space-y-3">
                      <button onClick={() => { setShowRestrictionModal(false); setActiveTab('profile'); }} className="w-full py-4 bg-luGreen text-white font-bold rounded-2xl shadow-lg hover:bg-luGreen-dark transition-all text-sm flex items-center justify-center gap-2 hover:-translate-y-1">Complete My Profile</button>
                      <button onClick={() => setShowRestrictionModal(false)} className="w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-colors text-sm">Close</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- LOGOUT CONFIRMATION MODAL --- */}
      {showLogoutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowLogoutModal(false)}></div>
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 p-8 text-center">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-red-50/50"><LogOut className="w-8 h-8 text-red-500 ml-1" /></div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2">Sign Out?</h3>
                  <p className="text-gray-500 text-sm mb-8 leading-relaxed">Are you sure you want to end your session? You will need to log in again to access your dashboard.</p>
                  <div className="flex gap-3">
                      <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm">Cancel</button>
                      <button onClick={onLogout} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-600 transition-all text-sm">Yes, Log Out</button>
                  </div>
              </div>
          </div>
      )}

    </div>
    </>
  );
};

export default Dashboard;
