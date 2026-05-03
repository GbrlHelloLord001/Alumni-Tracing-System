
import React, { useState, useEffect } from 'react';
import { JobPosting, Student } from '../types';
import { getOpenJobs, applyForJob, getUserApplications } from '../services/jobService';
import { Search, MapPin, Loader2, CheckCircle, ToggleRight, ToggleLeft, Briefcase, Building2, ChevronRight, DollarSign, Clock } from 'lucide-react';

interface ForYouPageProps {
  user: Student;
}

const ForYouPage: React.FC<ForYouPageProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [matchedJobs, setMatchedJobs] = useState<JobPosting[]>([]);
  const [showAllToggle, setShowAllToggle] = useState(false);
  const [allJobsCache, setAllJobsCache] = useState<JobPosting[]>([]); 
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const getUserType = () => {
      if (user.table_source) return user.table_source === 'students' ? 'student' : 'alumni';
      return 'student'; 
  };

  useEffect(() => {
    fetchAndMatchJobs();
  }, []);

  const fetchAndMatchJobs = async () => {
    setLoading(true);
    try {
        const userType = getUserType();
        const [jobs, userApps] = await Promise.all([
            getOpenJobs(),
            getUserApplications(user.id!, userType)
        ]);

        const appSet = new Set(userApps.map(a => a.job_posting_id));
        setAppliedIds(appSet);
        setAllJobsCache(jobs);

        const matches = jobs.filter(job => {
            let score = 0;
            const program = user.program.toLowerCase();
            const jobTitle = job.job_title.toLowerCase();
            const jobDesc = job.job_description.toLowerCase();
            const industry = job.industry.toLowerCase();

            const progKeywords = program.replace('bachelor of science in', '').replace('bachelor of', '').split(' ');
            const hasProgMatch = progKeywords.some(k => k.length > 3 && (jobTitle.includes(k) || jobDesc.includes(k)));
            
            if (hasProgMatch) score += 30;

            if (program.includes('information technology') || program.includes('computer science')) {
                if (jobTitle.includes('developer') || jobTitle.includes('engineer') || jobTitle.includes('it') || industry.includes('tech')) score += 20;
            }
            if (program.includes('accountancy') || program.includes('accounting')) {
                if (jobTitle.includes('accountant') || jobTitle.includes('audit') || jobTitle.includes('finance')) score += 20;
            }
            if (program.includes('education')) {
                if (jobTitle.includes('teacher') || jobTitle.includes('tutor') || industry.includes('education')) score += 20;
            }

            if (user.year_level && parseInt(user.year_level) >= new Date().getFullYear()) {
                if (job.job_level.toLowerCase().includes('entry') || job.job_level.toLowerCase().includes('fresh') || job.job_level.toLowerCase().includes('associate')) {
                    score += 15;
                }
            }

            return score >= 15;
        });

        setMatchedJobs(matches);

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
          if (!user.id) throw new Error("User ID not found");

          await applyForJob(jobId, user.id, userType);
          setAppliedIds(prev => new Set(prev).add(jobId));
      } catch (e: any) {
          console.error("Apply Error:", e);
          alert(`Error applying: ${e.message || "Unknown Error"}`);
      } finally {
          setApplyingId(null);
      }
  };

  const displayedJobs = showAllToggle ? allJobsCache : matchedJobs;

  return (
    <div className="h-full w-full relative flex flex-col">
       {/* Background Ambience (Warm Tone for 'For You') */}
       <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-amber-400/20 rounded-full blur-[100px] pointer-events-none"></div>
       <div className="absolute bottom-[-10%] right-[-5%] w-80 h-80 bg-orange-400/20 rounded-full blur-[100px] pointer-events-none"></div>

       {/* Main Glass Container */}
       <div className="flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl shadow-slate-200/50 rounded-[2.5rem] relative overflow-hidden flex flex-col">
           
           {/* Header */}
           <div className="p-8 pb-6 border-b border-white/40 flex flex-col md:flex-row justify-between items-end gap-6 bg-white/30 backdrop-blur-md sticky top-0 z-20">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl text-white shadow-lg shadow-orange-500/30">
                            <Search size={24} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Jobs For You</h2>
                    </div>
                    <p className="text-sm font-bold text-slate-500 ml-1">AI-curated matches based on your <span className="text-orange-600">{user.program}</span> profile.</p>
                </div>

                <button 
                    onClick={() => setShowAllToggle(!showAllToggle)}
                    className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/60 border border-white/60 shadow-sm hover:shadow-md transition-all group"
                >
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{showAllToggle ? 'Showing All Jobs' : 'Showing Matches'}</span>
                    {showAllToggle ? <ToggleRight className="text-blue-600" size={28} /> : <ToggleLeft className="text-orange-500" size={28} />}
                </button>
           </div>

           {/* Content */}
           <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar relative pt-6">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-400 w-10 h-10"/></div>
                ) : displayedJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 opacity-60">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6"><Search size={40} className="text-slate-300"/></div>
                        <p className="text-slate-500 font-bold text-lg mb-2">No specific matches found.</p>
                        <button onClick={() => setShowAllToggle(true)} className="text-blue-600 font-bold hover:underline">View all available jobs</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {displayedJobs.map(job => (
                            <div key={job.id} className={`bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border transition-all duration-300 relative group flex flex-col hover:-translate-y-1 hover:shadow-xl ${!showAllToggle ? 'border-orange-200 shadow-lg shadow-orange-500/5' : 'border-white/60 shadow-sm'}`}>
                                
                                {!showAllToggle && (
                                    <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-bl-2xl border-l border-b border-white/20 z-10 shadow-sm">
                                        Best Match
                                    </div>
                                )}

                                <div className="flex items-start gap-5 mb-4">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xl font-black shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-500">
                                        {job.company_name[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-black text-slate-800 group-hover:text-blue-600 transition-colors truncate pr-16">{job.job_title}</h3>
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mt-1">
                                            <Building2 size={14} className="text-slate-400"/> {job.company_name}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-5">
                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1"><MapPin size={12}/> {job.location}</span>
                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1"><Clock size={12}/> {job.employment_type}</span>
                                    <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-bold text-emerald-700 flex items-center gap-1"><DollarSign size={12}/> {job.salary_range}</span>
                                </div>

                                <p className="text-sm text-slate-600 line-clamp-2 mb-6 flex-grow leading-relaxed font-medium opacity-90">
                                    {job.job_description}
                                </p>

                                <button 
                                    onClick={() => handleApply(job.id)}
                                    disabled={appliedIds.has(job.id) || applyingId === job.id}
                                    className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 transform active:scale-95 ${
                                        appliedIds.has(job.id)
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                                        : !showAllToggle 
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-200 hover:shadow-orange-300' 
                                            : 'bg-slate-900 text-white hover:bg-blue-600 shadow-lg'
                                    }`}
                                >
                                    {applyingId === job.id ? <Loader2 className="animate-spin" size={18}/> : 
                                     appliedIds.has(job.id) ? <><CheckCircle size={18}/> Application Sent</> : 
                                     <>Apply Now <ChevronRight size={16}/></>}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
           </div>
       </div>
    </div>
  );
};

export default ForYouPage;
