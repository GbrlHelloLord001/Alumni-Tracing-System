
import React, { useState, useEffect } from 'react';
import { performAlumniSearch, saveMinedAlumni, fetchMinedAnalytics, getMiningConfig, saveMiningConfig, generateMinerInsights } from '../services/fetcherService';
import { sendInviteEmail, initEmailService } from '../services/emailService';
import { InternetAlumni, MiningConfig } from '../types';
import { Globe, Download, Loader2, Database, Briefcase, CheckCircle, XCircle, RefreshCw, UserCheck, ExternalLink, Settings, Clock, Save, ToggleLeft, ToggleRight, Facebook, Linkedin, Lightbulb, Mail, CheckSquare, Square, Send, AlertTriangle, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const AlumniFetcherPage: React.FC = () => {
  const [isFetching, setIsFetching] = useState(false);
  const [analytics, setAnalytics] = useState<any>({ total: 0, topIndustries: [], relationData: [], statusData: [], recentRecords: [] });
  const [interpretations, setInterpretations] = useState<any>(null);
  const [minedResults, setMinedResults] = useState<InternetAlumni[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  
  // Selection & Email State
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [sendingInvites, setSendingInvites] = useState(false);
  
  // Modal States for Invite Flow
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<InternetAlumni | null>(null); // Track single target if any

  // Config State
  const [config, setConfig] = useState<MiningConfig>({ isActive: false, frequency: 'Monthly' });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // --- ACTIONS ---

  const loadData = async () => {
    try {
        const data = await fetchMinedAnalytics();
        setAnalytics(data);
        
        if (data.total > 0) {
            setLoadingInsights(true);
            const insights = await generateMinerInsights(data);
            setInterpretations(insights);
            setLoadingInsights(false);
        }
    } catch (e) {
        console.error("Failed to load analytics", e);
    }
  };

  const handleAutoFetch = async (currentConfig: MiningConfig) => {
      setIsFetching(true);
      try {
          console.log("Starting Auto-Mining...");
          const results = await performAlumniSearch();
          setMinedResults(results);
          
          if (results.length > 0) {
              const savedCount = await saveMinedAlumni(results);
              await loadData(); // Refresh stats & insights
              
              if (savedCount > 0) {
                  // Schedule Next Run
                  const nextDate = new Date();
                  if (currentConfig.frequency === 'Weekly') nextDate.setDate(nextDate.getDate() + 7);
                  if (currentConfig.frequency === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                  if (currentConfig.frequency === 'Quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
                  
                  const newConfig = { ...currentConfig, nextRun: nextDate.toISOString().split('T')[0] };
                  saveMiningConfig(newConfig);
                  setConfig(newConfig);
              }
          }
      } catch (error: any) {
          console.error("Auto mining failed:", error);
      } finally {
          setIsFetching(false);
      }
  };

  const handleFetch = async () => {
    setIsFetching(true);
    setMinedResults([]);
    setSelectedEmails(new Set()); // Reset selection
    try {
        const results = await performAlumniSearch();
        setMinedResults(results);
        
        if (results.length > 0) {
            const savedCount = await saveMinedAlumni(results);
            await loadData(); // Refresh stats & insights
            if (savedCount === 0) {
                alert("Found alumni, but they were filtered out or already exist in the database.");
            } else {
                alert(`Successfully saved ${savedCount} new alumni profiles to database.`);
            }
        } else {
            alert("No new alumni found matching the criteria from available sources.");
        }
    } catch (error: any) {
        // Safe Alerting: Ensure we show a string even if error is an object
        const msg = error?.message || (typeof error === 'string' ? error : "An unknown error occurred");
        alert(`Mining Error: ${msg}`);
    } finally {
        setIsFetching(false);
    }
  };

  // --- SELECTION & EMAIL ACTIONS ---

  const displayedList = minedResults.length > 0 ? minedResults : analytics.recentRecords;

  const handleSelectAll = () => {
      if (selectedEmails.size === displayedList.length) {
          setSelectedEmails(new Set());
      } else {
          const allEmails = displayedList.map((a: InternetAlumni) => a.email);
          setSelectedEmails(new Set(allEmails));
      }
  };

  const toggleSelect = (email: string) => {
      const newSet = new Set(selectedEmails);
      if (newSet.has(email)) newSet.delete(email);
      else newSet.add(email);
      setSelectedEmails(newSet);
  };

  // Click handler for Bulk Button
  const initiateBulkInvite = () => {
      setInviteTarget(null); // Ensure we are in bulk mode
      setShowConfirmModal(true);
  };

  // Click handler for Single Button
  const initiateSingleInvite = (alum: InternetAlumni) => {
      if (alum.email.includes('placeholder')) {
          // Optional: You can block it here, or just let it fail silently/log.
          // User requested "dont show no verified email when hovered", but didn't specify clicking behavior.
          // Keeping a simple alert if clicked is safer to avoid confusion, or we can just proceed and log.
          alert("This user does not have a verified email address.");
          return;
      }
      setInviteTarget(alum);
      setShowConfirmModal(true);
  };

  // Unified Send Function
  const executeSendInvites = async () => {
      setSendingInvites(true);
      
      try {
          if (inviteTarget) {
              // Single Send
              await sendInviteEmail(inviteTarget.full_name, inviteTarget.email);
          } else {
              // Bulk Send
              const targets = displayedList.filter((a: InternetAlumni) => selectedEmails.has(a.email));
              for (const alum of targets) {
                  if (alum.email.includes('placeholder')) continue;
                  await sendInviteEmail(alum.full_name, alum.email);
              }
              setSelectedEmails(new Set()); // Clear selection after bulk send
          }
      } catch (error) {
          console.error("Error sending invites:", error);
      } finally {
          setSendingInvites(false);
          setShowConfirmModal(false);
          setInviteTarget(null);
      }
  };

  // --- EFFECTS ---

  useEffect(() => {
    initEmailService();
    loadData();
    const loadedConfig = getMiningConfig();
    setConfig(loadedConfig);

    // --- AUTO MINING CHECK ---
    if (loadedConfig.isActive && loadedConfig.nextRun) {
        const today = new Date();
        const scheduledDate = new Date(loadedConfig.nextRun);
        
        today.setHours(0,0,0,0);
        scheduledDate.setHours(0,0,0,0);

        if (today >= scheduledDate) {
            handleAutoFetch(loadedConfig);
        }
    }
  }, []);

  const handleSaveConfig = () => {
      setIsSavingConfig(true);
      setTimeout(() => {
          const updated = saveMiningConfig(config);
          setConfig(updated);
          setIsSavingConfig(false);
          alert(`Mining Scheduler Updated: ${updated.isActive ? 'Active' : 'Paused'}`);
      }, 800);
  };

  const getSourceIcon = (source: string) => {
      switch(source) {
          case 'LinkedIn': return <Linkedin size={16} className="text-blue-600" />;
          default: return <Globe size={16} className="text-gray-500" />;
      }
  };

  const InterpretationBlock = ({ text }: { text: string }) => (
      <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg h-fit">
              <Lightbulb size={16} />
          </div>
          <div>
              <h5 className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest mb-1">Interpretation</h5>
              {loadingInsights ? (
                  <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"></div>
              ) : (
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{text || "Data insufficient for analysis."}</p>
              )}
          </div>
      </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-10">
        
        {/* Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-lg shadow-blue-500/5">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Globe className="text-blue-600" /> Public Profile Miner
                </h2>
                <p className="text-slate-500 mt-1">Discover alumni public profiles from LinkedIn.</p>
            </div>
        </div>

        {/* Configuration & Action Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Scheduler Panel */}
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                        <Settings size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Mining Automation</h3>
                        <p className="text-sm text-slate-500">Configure when the system should automatically scan for new data.</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Frequency</label>
                        <select 
                            value={config.frequency} 
                            onChange={(e) => setConfig({...config, frequency: e.target.value as any})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="Weekly">Weekly</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly">Quarterly</option>
                        </select>
                    </div>
                    
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Auto-Mining Status</label>
                        <button 
                            onClick={() => setConfig({...config, isActive: !config.isActive})}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${config.isActive ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                        >
                            <span className="text-sm font-bold">{config.isActive ? 'Active' : 'Paused'}</span>
                            {config.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                        </button>
                    </div>

                    <button 
                        onClick={handleSaveConfig}
                        disabled={isSavingConfig}
                        className="w-full md:w-auto px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                    >
                        {isSavingConfig ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save
                    </button>
                </div>

                {config.isActive && config.nextRun && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-blue-600">
                        <Clock size={14} /> Next Scheduled Run: {new Date(config.nextRun).toLocaleDateString()}
                    </div>
                )}
            </div>

            {/* Manual Action Panel */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl shadow-xl text-white flex flex-col justify-center items-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                
                <h3 className="text-2xl font-black mb-2 relative z-10">Manual Scan</h3>
                <p className="text-blue-100 text-sm mb-6 relative z-10 max-w-xs">Run an immediate search across LinkedIn public profiles.</p>
                
                <button 
                    onClick={handleFetch}
                    disabled={isFetching}
                    className="w-full py-4 bg-white text-blue-600 font-bold rounded-2xl shadow-lg hover:bg-blue-50 hover:scale-105 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative z-10"
                >
                    {isFetching ? (
                        <>
                            <Loader2 className="animate-spin" size={20}/>
                            <span>Scanning Web...</span>
                        </>
                    ) : (
                        <>
                            <Download size={20}/>
                            <span>Start Mining Now</span>
                        </>
                    )}
                </button>
            </div>
        </div>

        {/* --- EXPANDED ANALYTICS ROW --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. Employment Status Chart */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[400px] flex flex-col justify-between">
                <div>
                    <h4 className="font-bold text-slate-800 mb-6 text-base uppercase flex items-center gap-2">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><UserCheck size={20}/></div>
                        Employment Status Distribution
                    </h4>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analytics.statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {analytics.statusData.map((entry: any, index: number) => {
                                        let color = '#94a3b8'; // Unknown / Default (Slate)
                                        if (entry.name === 'Employed') color = '#3b82f6'; // Blue
                                        if (entry.name === 'Unemployed') color = '#ef4444'; // Red
                                        if (entry.name === 'Self-Employed') color = '#f59e0b'; // Amber (Gold)
                                        return <Cell key={`cell-${index}`} fill={color} />;
                                    })}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '12px'}} />
                                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <InterpretationBlock text={interpretations?.statusInterpretation} />
            </div>

            {/* 2. Job Alignment Chart */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[400px] flex flex-col justify-between">
                <div>
                    <h4 className="font-bold text-slate-800 mb-6 text-base uppercase flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle size={20}/></div>
                        Job Alignment
                    </h4>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analytics.relationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {analytics.relationData.map((entry: any, index: number) => {
                                        let color = '#94a3b8'; // Unknown
                                        if (entry.name === 'Related') color = '#10b981'; // Emerald
                                        if (entry.name === 'Non-Related') color = '#f59e0b'; // Amber
                                        return <Cell key={`cell-${index}`} fill={color} />;
                                    })}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '12px'}}/>
                                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle"/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <InterpretationBlock text={interpretations?.alignmentInterpretation} />
            </div>

            {/* 3. Top Industries (Full Width) */}
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[400px] flex flex-col justify-between">
                <div>
                    <h4 className="font-bold text-slate-800 mb-6 text-base uppercase flex items-center gap-2">
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Briefcase size={20}/></div>
                        Top Industries Detected
                    </h4>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.topIndustries} layout="vertical" margin={{left: 20, right: 30}}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={180} tick={{fontSize: 12, fontWeight: 'bold', fill: '#475569'}} />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px'}}/>
                                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <InterpretationBlock text={interpretations?.industryInterpretation} />
            </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        {minedResults.length > 0 ? (
                            <>
                                <RefreshCw size={18} className="text-blue-600 animate-spin-slow"/>
                                New Mined Results ({minedResults.length})
                            </>
                        ) : (
                            "Recent Mined Database"
                        )}
                    </h3>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-100">
                        Total Records: {analytics.total}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {selectedEmails.size > 0 && (
                        <button 
                            onClick={initiateBulkInvite}
                            disabled={sendingInvites}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md animate-fade-in"
                        >
                            {sendingInvites ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                            Send Invites ({selectedEmails.size})
                        </button>
                    )}
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                        <tr>
                            <th className="px-6 py-4 w-12 text-center">
                                <button onClick={handleSelectAll} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                    {selectedEmails.size > 0 && selectedEmails.size === displayedList.length ? <CheckSquare size={20}/> : <Square size={20}/>}
                                </button>
                            </th>
                            <th className="px-6 py-4">Source</th>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Course</th>
                            <th className="px-6 py-4">Job / Status</th>
                            <th className="px-6 py-4">Industry</th>
                            <th className="px-6 py-4">Alignment</th>
                            <th className="px-6 py-4">Grad Year</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {displayedList.map((alum: InternetAlumni, i: number) => {
                            const isSelected = selectedEmails.has(alum.email);
                            return (
                                <tr key={i} className={`hover:bg-blue-50/50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`} onClick={() => toggleSelect(alum.email)}>
                                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => toggleSelect(alum.email)} className={`transition-colors ${isSelected ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-400'}`}>
                                            {isSelected ? <CheckSquare size={20}/> : <Square size={20}/>}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
                                            alum.sourced_at === 'LinkedIn' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            'bg-gray-50 text-gray-700 border-gray-200'
                                        }`}>
                                            {getSourceIcon(alum.sourced_at)}
                                            {alum.sourced_at}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-700">
                                        {alum.full_name}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={alum.course}>{alum.course || 'Unknown'}</td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <div className="font-medium">{alum.current_job || (alum.employment_status === 'Unknown' ? 'Unknown' : 'N/A')}</div>
                                        <div className={`text-xs font-bold mt-1 ${
                                            alum.employment_status === 'Unemployed' ? 'text-red-500' :
                                            alum.employment_status === 'Self-Employed' ? 'text-amber-600' :
                                            alum.employment_status === 'Unknown' ? 'text-slate-400' :
                                            'text-blue-600'
                                        }`}>
                                            {alum.employment_status}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{alum.industry || 'Unknown'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                            alum.job_relation === 'Related' 
                                            ? 'bg-emerald-100 text-emerald-700' 
                                            : alum.job_relation === 'Unknown'
                                            ? 'bg-slate-100 text-slate-500'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {alum.job_relation === 'Related' ? <CheckCircle size={12}/> : <XCircle size={12}/>}
                                            {alum.job_relation || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-bold">{alum.graduation_year || 'N/A'}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {alum.link && (
                                                <a 
                                                    href={alum.link} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                                                    title="View Profile"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                            )}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); initiateSingleInvite(alum); }}
                                                className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-500 hover:text-white transition-colors group relative"
                                                title="Send Invite via Gmail"
                                                disabled={sendingInvites}
                                            >
                                                <Mail size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {displayedList.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-6 py-10 text-center text-slate-400">No data available. Start mining to populate the database.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* --- CONFIRMATION MODAL --- */}
        {showConfirmModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowConfirmModal(false)}></div>
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-blue-50">
                            <Mail size={32} className="text-blue-500" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Send Invitation(s)?</h3>
                        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                            Are you sure you want to send invitation(s)?
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={executeSendInvites}
                                disabled={sendingInvites}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5"
                            >
                                {sendingInvites ? <Loader2 size={18} className="animate-spin" /> : "Yes, Send"}
                            </button>
                            <button 
                                onClick={() => setShowConfirmModal(false)}
                                disabled={sendingInvites}
                                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default AlumniFetcherPage;
