
import React, { useState, useEffect, useRef } from 'react';
import { HumanResource, JobPosting, JobApplication, JobMessage, Student } from '../types';
import { LogOut, Briefcase, Users, MessageSquare, Plus, Search, MapPin, DollarSign, Calendar, Trash2, Edit, X, Save, Send, Loader2, CheckCircle, FileText, ArrowRight, Clock, Award, Filter, ExternalLink } from 'lucide-react';
import { getHRJobs, createJob, updateJob, deleteJob, getHRApplications, updateApplicationStatus, getMessages, sendMessage, getResumeBlob } from '../services/jobService';
import { sendHiredEmail } from '../services/emailService';

interface HRDashboardProps {
  hr: HumanResource;
  onLogout: () => void;
}

const HRDashboard: React.FC<HRDashboardProps> = ({ hr, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'applications'>('jobs');
  
  // Jobs State
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [jobFormData, setJobFormData] = useState<Partial<JobPosting>>({});
  
  // Applications/Chat State
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingApps, setLoadingApps] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial Data Load
  useEffect(() => {
    fetchJobs();
    fetchApplications();
  }, [hr.id]);

  useEffect(() => {
    if (activeTab === 'applications') {
        fetchApplications();
    } else {
        fetchJobs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedApplication) {
        fetchMessages(selectedApplication.id);
        // Set up interval for polling messages
        const interval = setInterval(() => {
            fetchMessages(selectedApplication.id);
        }, 5000);
        return () => clearInterval(interval);
    }
  }, [selectedApplication]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // --- JOB ACTIONS ---

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
        const data = await getHRJobs(hr.id);
        setJobs(data);
    } catch (e) {
        console.error(e);
    } finally {
        setLoadingJobs(false);
    }
  };

  const handleCreateJob = () => {
    setEditingJob(null);
    setJobFormData({
        hr_id: hr.id,
        company_name: hr.company_name,
        employment_type: 'Full-Time',
        is_active: true
    });
    setIsJobModalOpen(true);
  };

  const handleEditJob = (job: JobPosting) => {
      setEditingJob(job);
      setJobFormData(job);
      setIsJobModalOpen(true);
  };

  const handleDeleteJob = async (id: string) => {
      if(!window.confirm("Are you sure you want to delete this job posting?")) return;
      try {
          await deleteJob(id);
          fetchJobs();
      } catch (e) {
          alert("Failed to delete job.");
      }
  };

  const saveJob = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          if (editingJob) {
              await updateJob(editingJob.id, jobFormData);
          } else {
              await createJob(jobFormData);
          }
          setIsJobModalOpen(false);
          fetchJobs();
      } catch (e) {
          console.error(e);
          alert("Failed to save job.");
      }
  };

  // --- APPLICATION ACTIONS ---

  const fetchApplications = async () => {
      setLoadingApps(true);
      try {
          const data = await getHRApplications(hr.id);
          setApplications(data);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingApps(false);
      }
  };

  const fetchMessages = async (appId: string) => {
      try {
          const data = await getMessages(appId);
          setMessages(data);
      } catch (e) { console.error(e); }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !selectedApplication) return;
      setSending(true);
      try {
          await sendMessage({
              application_id: selectedApplication.id,
              sender_type: 'HR',
              hr_id: hr.id,
              message: newMessage,
              is_read: false
          });
          setNewMessage('');
          fetchMessages(selectedApplication.id);
      } catch (e) {
          alert("Failed to send.");
      } finally {
          setSending(false);
      }
  };

  const changeStatus = async (status: string) => {
      if (!selectedApplication) return;
      if (status === 'Hired') {
          if (!window.confirm("Are you sure you want to hire this applicant? This will trigger an email notification.")) return;
      }

      try {
          // @ts-ignore
          await updateApplicationStatus(selectedApplication.id, status);
          
          if (status === 'Hired' && selectedApplication.applicant_details && selectedApplication.job) {
             await sendHiredEmail(
                 `${selectedApplication.applicant_details.first_name} ${selectedApplication.applicant_details.last_name}`,
                 selectedApplication.applicant_details.email,
                 selectedApplication.job.job_title,
                 hr.company_name
             );
             alert("Applicant hired! Notification email sent.");
          }

          // Update local state
          setSelectedApplication(prev => prev ? ({ ...prev, application_status: status as any }) : null);
          fetchApplications();
      } catch (e) {
          alert("Failed to update status.");
      }
  };

  // Helper to open resume
  const openResume = (hexString?: string) => {
      if (!hexString) {
          alert("No resume uploaded for this applicant.");
          return;
      }
      const url = getResumeBlob(hexString);
      if (url) window.open(url, '_blank');
      else alert("Invalid resume format.");
  };

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md">
                     <Briefcase size={20} />
                 </div>
                 <div>
                     <h1 className="font-bold text-gray-800 text-lg leading-tight">{hr.company_name}</h1>
                     <p className="text-xs text-gray-500 font-medium">HR Portal</p>
                 </div>
             </div>
             <button onClick={onLogout} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                 <LogOut size={20} />
             </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8 flex flex-col h-[calc(100vh-64px)]">
          
          {/* Tabs */}
          <div className="flex gap-6 border-b border-gray-200 mb-6 flex-shrink-0">
              <button 
                onClick={() => setActiveTab('jobs')}
                className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'jobs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                  <Briefcase size={18} /> Manage Jobs
              </button>
              <button 
                onClick={() => setActiveTab('applications')}
                className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'applications' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                  <Users size={18} /> 
                  Applicants
                  {applications.some(a => a.application_status === 'Pending') && (
                      <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full ml-1">New</span>
                  )}
              </button>
          </div>

          {/* === JOBS VIEW === */}
          {activeTab === 'jobs' && (
              <div className="flex-grow overflow-auto pb-10">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-800">Your Job Postings</h2>
                      <button 
                        onClick={handleCreateJob}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                      >
                          <Plus size={16} /> Post New Job
                      </button>
                  </div>

                  {loadingJobs ? (
                      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300"/></div>
                  ) : jobs.length === 0 ? (
                      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">No job postings yet.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {jobs.map(job => (
                              <div key={job.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 flex flex-col">
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                          <Briefcase size={20} />
                                      </div>
                                      <div className="flex gap-1">
                                          <button onClick={() => handleEditJob(job)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                                          <button onClick={() => handleDeleteJob(job.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                      </div>
                                  </div>
                                  <h3 className="font-bold text-gray-800 text-lg mb-1">{job.job_title}</h3>
                                  <p className="text-xs text-gray-500 font-medium mb-4 flex items-center gap-1">
                                      <MapPin size={12}/> {job.location} • <Clock size={12}/> {job.employment_type}
                                  </p>
                                  
                                  <div className="mt-auto pt-4 border-t border-gray-50 flex justify-between items-center">
                                      <div className="flex -space-x-2">
                                          {/* Placeholder Avatars */}
                                          {[...Array(Math.min(3, job.applicant_count || 0))].map((_,i) => (
                                              <div key={i} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                  ?
                                              </div>
                                          ))}
                                          {(job.applicant_count || 0) > 3 && (
                                              <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                  +{(job.applicant_count || 0) - 3}
                                              </div>
                                          )}
                                      </div>
                                      <button 
                                        onClick={() => { setActiveTab('applications'); }}
                                        className="text-xs font-bold text-blue-600 hover:underline"
                                      >
                                          {job.applicant_count || 0} Applicants
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {/* === APPLICANTS / CHAT VIEW === */}
          {activeTab === 'applications' && (
              <div className="flex-grow flex bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full">
                  
                  {/* Sidebar: List */}
                  <div className="w-80 border-r border-gray-100 flex flex-col bg-gray-50/50">
                      <div className="p-4 border-b border-gray-100">
                          <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                              <input type="text" placeholder="Search applicant..." className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"/>
                          </div>
                      </div>
                      <div className="flex-grow overflow-y-auto">
                          {loadingApps ? (
                              <div className="p-6 text-center text-gray-400"><Loader2 className="animate-spin mx-auto"/></div>
                          ) : applications.length === 0 ? (
                              <div className="p-6 text-center text-gray-400 text-sm">No applications found.</div>
                          ) : (
                              applications.map(app => (
                                  <div 
                                    key={app.id} 
                                    onClick={() => setSelectedApplication(app)}
                                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-white transition-colors ${selectedApplication?.id === app.id ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : 'border-l-4 border-l-transparent'}`}
                                  >
                                      <div className="flex justify-between items-start mb-1">
                                          <h4 className="font-bold text-gray-800 text-sm truncate pr-2">
                                              {app.applicant_details?.first_name} {app.applicant_details?.last_name}
                                          </h4>
                                          {app.application_status === 'Pending' && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>}
                                      </div>
                                      <p className="text-xs text-gray-500 truncate mb-1">{app.job?.job_title}</p>
                                      <div className="flex items-center justify-between">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                            app.application_status === 'Hired' ? 'bg-green-100 text-green-700' :
                                            app.application_status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>{app.application_status}</span>
                                        <span className="text-[10px] text-gray-400">{new Date(app.applied_at).toLocaleDateString()}</span>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>

                  {/* Main: Chat & Details */}
                  {selectedApplication ? (
                      <div className="flex-1 flex">
                          
                          {/* Chat Area */}
                          <div className="flex-1 flex flex-col bg-gray-50">
                              <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
                                  <div>
                                      <h3 className="font-bold text-gray-800">{selectedApplication.applicant_details?.first_name} {selectedApplication.applicant_details?.last_name}</h3>
                                      <p className="text-xs text-gray-500">Applying for <span className="text-blue-600 font-semibold">{selectedApplication.job?.job_title}</span></p>
                                  </div>
                                  <div className="flex gap-2">
                                      <select 
                                        value={selectedApplication.application_status}
                                        onChange={(e) => changeStatus(e.target.value)}
                                        className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-blue-500"
                                      >
                                          <option value="Pending">Pending</option>
                                          <option value="Reviewed">Reviewed</option>
                                          <option value="Shortlisted">Shortlisted</option>
                                          <option value="Interview">Interview</option>
                                          <option value="Rejected">Rejected</option>
                                          <option value="Hired">Hired</option>
                                      </select>
                                  </div>
                              </div>
                              
                              {/* Messages List */}
                              <div className="flex-grow p-4 overflow-y-auto space-y-4">
                                  {messages.length === 0 ? (
                                      <div className="text-center py-10 text-gray-400 text-sm">
                                          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30"/>
                                          Start the conversation with the applicant.
                                      </div>
                                  ) : (
                                      messages.map(msg => {
                                          const isMe = msg.sender_type === 'HR';
                                          return (
                                              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                                                      isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-700 border border-gray-100 rounded-bl-none'
                                                  }`}>
                                                      <p>{msg.message}</p>
                                                      <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                                                          {new Date(msg.sent_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                      </p>
                                                  </div>
                                              </div>
                                          );
                                      })
                                  )}
                                  <div ref={messagesEndRef} />
                              </div>

                              {/* Input */}
                              <div className="p-3 bg-white border-t border-gray-200">
                                  <form onSubmit={handleSendMessage} className="flex gap-2">
                                      <input 
                                        type="text" 
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-grow bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                      />
                                      <button 
                                        type="submit" 
                                        disabled={!newMessage.trim() || sending}
                                        className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50"
                                      >
                                          <Send size={18} />
                                      </button>
                                  </form>
                              </div>
                          </div>

                          {/* Right Sidebar: Profile */}
                          <div className="w-72 bg-white border-l border-gray-200 p-6 overflow-y-auto hidden lg:block">
                                <div className="text-center mb-6">
                                    <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-gray-400">
                                        {selectedApplication.applicant_details?.first_name.charAt(0)}
                                    </div>
                                    <h3 className="font-bold text-gray-800">{selectedApplication.applicant_details?.first_name} {selectedApplication.applicant_details?.last_name}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{selectedApplication.applicant_details?.program} • Batch {selectedApplication.applicant_details?.year_level}</p>
                                    
                                    <div className="flex gap-2 justify-center mt-4">
                                        <button 
                                            onClick={() => openResume(selectedApplication.applicant_details?.resume)}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                                        >
                                            <FileText size={12}/> View Resume
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Contact Info</h4>
                                        <p className="text-sm text-gray-700 mb-1 flex items-center gap-2 truncate" title={selectedApplication.applicant_details?.email}>@{selectedApplication.applicant_details?.email}</p>
                                        <p className="text-sm text-gray-700 flex items-center gap-2">📞 {selectedApplication.applicant_details?.contact_no}</p>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Application Status</h4>
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-500">Applied</span>
                                                <span className="font-bold">{new Date(selectedApplication.applied_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-500">Status</span>
                                                <span className="font-bold text-blue-600">{selectedApplication.application_status}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                          </div>
                      </div>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                          <Users className="w-16 h-16 mb-4 opacity-20" />
                          <p className="font-medium">Select an application to view details.</p>
                      </div>
                  )}
              </div>
          )}
      </main>

      {/* === CREATE JOB MODAL === */}
      {isJobModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsJobModalOpen(false)}></div>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-gray-800">{editingJob ? 'Edit Job Posting' : 'Create New Job'}</h3>
                      <button onClick={() => setIsJobModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  </div>
                  <form onSubmit={saveJob} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Job Title</label>
                          <input required type="text" value={jobFormData.job_title || ''} onChange={e => setJobFormData({...jobFormData, job_title: e.target.value})} className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none"/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Employment Type</label>
                            <select value={jobFormData.employment_type || 'Full-Time'} onChange={e => setJobFormData({...jobFormData, employment_type: e.target.value as any})} className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm outline-none">
                                <option>Full-Time</option>
                                <option>Part-Time</option>
                                <option>Contract</option>
                                <option>Temporary</option>
                                <option>Internship</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                            <input required type="text" value={jobFormData.location || ''} onChange={e => setJobFormData({...jobFormData, location: e.target.value})} className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm outline-none"/>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Industry</label>
                            <input required type="text" value={jobFormData.industry || ''} onChange={e => setJobFormData({...jobFormData, industry: e.target.value})} className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm outline-none"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Job Level</label>
                            <input required type="text" value={jobFormData.job_level || ''} onChange={e => setJobFormData({...jobFormData, job_level: e.target.value})} className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm outline-none" placeholder="e.g. Entry Level"/>
                        </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Salary Range</label>
                          <input type="text" value={jobFormData.salary_range || ''} onChange={e => setJobFormData({...jobFormData, salary_range: e.target.value})} className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm outline-none" placeholder="e.g. 20,000 - 30,000"/>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                          <textarea required rows={4} value={jobFormData.job_description || ''} onChange={e => setJobFormData({...jobFormData, job_description: e.target.value})} className="w-full px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm outline-none resize-none"></textarea>
                      </div>
                      
                      <div className="pt-4 flex gap-3">
                          <button type="button" onClick={() => setIsJobModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                          <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                              <Save size={16} /> Save Job
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
};

export default HRDashboard;
