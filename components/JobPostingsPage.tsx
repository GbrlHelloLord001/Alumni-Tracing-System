
import React, { useState, useEffect } from 'react';
import { JobPosting, JobApplication, Student } from '../types';
import { getOpenJobs, applyForJob, getUserApplications } from '../services/jobService';
import { Search, MapPin, Briefcase, DollarSign, Clock, Send, MessageSquare, CheckCircle, Loader2, Building2, ChevronRight, Bookmark } from 'lucide-react';
import JobChatModal from './JobChatModal';

interface JobPostingsPageProps {
  user: Student;
}

const JobPostingsPage: React.FC<JobPostingsPageProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'applications'>('browse');
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Application State
  const [applyingId, setApplyingId] = useState<string | null>(null);
  
  // Chat State
  const [selectedChatApp, setSelectedChatApp] = useState<JobApplication | null>(null);

  // Helper to determine user type safely
  const getUserType = () => {
      if (user.table_source) return user.table_source === 'students' ? 'student' : 'alumni';
      return user.enrollment_status === 'Graduating' ? 'student' : 'student'; 
  };

  useEffect(() => {
    if (activeTab === 'browse') {
        fetchJobs();
    } else {
        fetchApplications();
    }
  }, [activeTab]);

  const fetchJobs = async () => {
      setLoading(true);
      try {
          const allJobs = await getOpenJobs();
          const userType = getUserType();
          const userApps = await getUserApplications(user.id!, userType);
          const appliedJobIds = new Set(userApps.map(app => app.job_posting_id));
          
          const jobsWithStatus = allJobs.map(job => ({
              ...job,
              hasApplied: appliedJobIds.has(job.id)
          }));
          
          // @ts-ignore
          setJobs(jobsWithStatus);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const fetchApplications = async () => {
      setLoading(true);
      try {
          const userType = getUserType();
          const apps = await getUserApplications(user.id!, userType);
          setApplications(apps);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleApply = async (jobId: string) => {
      setApplyingId(jobId);
      try {
          const userType = getUserType();
          if (!user.id) throw new Error("User ID not found.");

          await applyForJob(jobId, user.id, userType);
          await fetchJobs();
      } catch (e: any) {
          console.error("Apply Error:", e);
          alert(`Failed to apply: ${e.message || "Unknown error"}`);
      } finally {
          setApplyingId(null);
      }
  };

  const filteredJobs = jobs.filter(job => 
      job.job_title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      job.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full w-full relative flex flex-col overflow-hidden">
       {/* Natural Ambient Background */}
       <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
           <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[120px]"></div>
           <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-100/40 rounded-full blur-[120px]"></div>
       </div>

       {/* Main Scrollable Area */}
       <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-6 md:p-8">
           
           <div className="max-w-7xl mx-auto w-full flex flex-col gap-8">
               
               {/* 1. Header & Navigation */}
               <div className="bg-white/60 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 shadow-lg shadow-slate-200/50 flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            Career <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Opportunities</span>
                            </h2>
                            <p className="text-sm font-bold text-slate-500 mt-2 ml-1 max-w-md">
                                Discover roles tailored for Laguna University graduates.
                            </p>
                        </div>
                        
                        {/* Floating Tabs */}
                        <div className="flex p-1.5 bg-slate-100/50 backdrop-blur-md border border-white/50 rounded-2xl">
                            <button 
                                onClick={() => setActiveTab('browse')} 
                                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'browse' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Briefcase size={16}/> Browse
                            </button>
                            <button 
                                onClick={() => setActiveTab('applications')} 
                                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'applications' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Send size={16}/> Applications
                            </button>
                        </div>
                    </div>

                    {/* Integrated Search Bar (Visible only on Browse tab) */}
                    {activeTab === 'browse' && (
                        <div className="relative group max-w-full">
                            <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:ring-4 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
                                <Search className="ml-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input 
                                    type="text" 
                                    placeholder="Search by job title, company, or location..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full py-3.5 px-4 bg-transparent outline-none text-slate-700 font-bold placeholder:text-slate-400 text-sm"
                                />
                            </div>
                        </div>
                    )}
               </div>

               {/* 2. Main Content */}
               <div className="flex-1 min-w-0">
                    {activeTab === 'browse' ? (
                        <div className="space-y-8">
                            {/* Job Grid */}
                            {loading ? (
                                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-400 w-10 h-10"/></div>
                            ) : filteredJobs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 opacity-60 bg-white/40 rounded-[2rem] border border-dashed border-slate-300">
                                    <Briefcase size={40} className="text-slate-300 mb-4"/>
                                    <p className="text-slate-500 font-bold text-lg">No jobs found.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {filteredJobs.map((job) => (
                                        <div key={job.id} className="bg-white/70 backdrop-blur-md p-6 rounded-[2rem] border border-white/60 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 group relative flex flex-col h-full">
                                            
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-white border border-slate-200 flex items-center justify-center text-xl font-black text-slate-700 shadow-sm group-hover:scale-110 transition-transform duration-500">
                                                        {job.company_name[0]}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors line-clamp-1">{job.job_title}</h3>
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-0.5">{job.company_name}</p>
                                                    </div>
                                                </div>
                                                <button className="p-2 text-slate-300 hover:text-blue-500 transition-colors"><Bookmark size={20}/></button>
                                            </div>

                                            {/* Chips */}
                                            <div className="flex flex-wrap gap-2 mb-5">
                                                <span className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide rounded-lg flex items-center gap-1.5 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                    <MapPin size={12}/> {job.location}
                                                </span>
                                                <span className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide rounded-lg flex items-center gap-1.5 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                                                    <Clock size={12}/> {job.employment_type}
                                                </span>
                                                <span className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide rounded-lg flex items-center gap-1.5 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                                    <DollarSign size={12}/> {job.salary_range}
                                                </span>
                                            </div>

                                            {/* Description */}
                                            <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-6 font-medium flex-grow">
                                                {job.job_description}
                                            </p>

                                            {/* Footer Action */}
                                            <div className="mt-auto">
                                                <button 
                                                    onClick={() => handleApply(job.id)}
                                                    disabled={job.hasApplied || applyingId === job.id}
                                                    className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all duration-300 transform active:scale-95 ${
                                                        job.hasApplied 
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default shadow-none'
                                                        : 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-blue-500/30'
                                                    }`}
                                                >
                                                    {applyingId === job.id ? <Loader2 className="animate-spin" size={18}/> : 
                                                        job.hasApplied ? <><CheckCircle size={18}/> Application Sent</> : 
                                                        <>Apply Now <ChevronRight size={16}/></>}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        // APPLICATIONS TAB
                        <div className="space-y-6">
                            {loading ? (
                                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-400 w-10 h-10"/></div>
                            ) : applications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 bg-white/40 rounded-[2.5rem] border border-dashed border-slate-300">
                                    <Send className="w-16 h-16 text-slate-300 mb-6 opacity-50" />
                                    <p className="text-slate-500 font-bold text-lg">No active applications.</p>
                                    <button onClick={() => setActiveTab('browse')} className="mt-4 px-6 py-3 bg-blue-100 text-blue-700 font-bold rounded-xl hover:bg-blue-200 transition-colors">Find a Job</button>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {applications.map((app) => (
                                        <div key={app.id} className="bg-white p-6 rounded-[2rem] border border-white/60 shadow-sm hover:shadow-lg transition-all group flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                            <div className="flex items-center gap-5">
                                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                    <Briefcase size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">{app.job?.job_title}</h4>
                                                    <p className="text-sm font-bold text-slate-500">{app.job?.company_name}</p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded">Applied: {new Date(app.applied_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-row items-center gap-4 w-full md:w-auto mt-2 md:mt-0">
                                                {/* Status Badge */}
                                                <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide border flex items-center gap-2 ${
                                                    app.application_status === 'Hired' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                    app.application_status === 'Rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {app.application_status === 'Hired' && <CheckCircle size={14}/>}
                                                    {app.application_status}
                                                </div>
                                                
                                                <button 
                                                    onClick={() => setSelectedChatApp(app)}
                                                    className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                                                >
                                                    <MessageSquare size={16} /> <span className="hidden sm:inline">Message HR</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
               </div>
           </div>
       </div>

        {/* Chat Drawer */}
        {selectedChatApp && (
            <JobChatModal 
                application={selectedChatApp} 
                user={user} 
                onClose={() => setSelectedChatApp(null)} 
            />
        )}
    </div>
  );
};

export default JobPostingsPage;
