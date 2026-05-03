
import React, { useState, useMemo } from 'react';
import { X, Printer, Briefcase, AlertCircle, Building2, UserCheck, MapPin, Calendar, Clock, Award, CheckCircle2, XCircle, Filter } from 'lucide-react';

interface StatusDetailModalProps {
  status: string | null;
  data: any[];
  yearLabel: string;
  courseLabel: string;
  onClose: () => void;
}

const StatusDetailModal: React.FC<StatusDetailModalProps> = ({ status, data, yearLabel, courseLabel, onClose }) => {
  const [localCourse, setLocalCourse] = useState<string>('All');
  const [localBatch, setLocalBatch] = useState<string>('All');

  const filteredData = useMemo(() => {
    return data.filter(record => {
      const matchCourse = localCourse === 'All' || record.program === localCourse;
      const matchBatch = localBatch === 'All' || record.year_level === localBatch;
      return matchCourse && matchBatch;
    });
  }, [data, localCourse, localBatch]);

  const uniqueCourses = useMemo(() => Array.from(new Set(data.map(d => d.program).filter(Boolean))), [data]);
  const uniqueBatches = useMemo(() => Array.from(new Set(data.map(d => d.year_level).filter(Boolean))), [data]);

  if (!status) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center print:p-0">
        <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300 no-print"
            onClick={onClose}
        ></div>
        <div id="printable-modal" className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-2xl w-full max-w-7xl h-[85vh] relative z-10 flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden ring-1 ring-white/40">
            <div className="p-6 border-b border-white/40 flex justify-between items-center bg-white/40 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-xl shadow-indigo-500/20 no-print">
                        {status === 'Employed' && <Briefcase size={28} />}
                        {status === 'Unemployed' && <AlertCircle size={28} />}
                        {status === 'Self-employed' && <Building2 size={28} />}
                        {status === 'Retired' && <UserCheck size={28} />}
                        {status === 'Misaligned' && <XCircle size={28} />}
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-slate-800 tracking-tight">{status} List</h3>
                        <p className="text-sm text-slate-500 font-bold mt-1">
                            Showing <span className="text-indigo-600">{filteredData.length} records</span> • {yearLabel} • {courseLabel}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 no-print">
                    <div className="flex items-center gap-2 bg-white/60 p-1.5 rounded-xl border border-white/50 shadow-sm mr-2">
                        <Filter size={16} className="text-slate-400 ml-2" />
                        <select 
                            value={localCourse} 
                            onChange={(e) => setLocalCourse(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer py-1 px-2 border-r border-slate-200"
                        >
                            <option value="All">All Courses</option>
                            {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select 
                            value={localBatch} 
                            onChange={(e) => setLocalBatch(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer py-1 px-2 pr-4"
                        >
                            <option value="All">All Batches</option>
                            {uniqueBatches.map(b => <option key={b} value={b}>Batch {b}</option>)}
                        </select>
                    </div>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-slate-900 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                        <Printer size={18} /> Print
                    </button>
                    <button onClick={onClose} className="p-2.5 bg-white/60 border border-white/50 rounded-xl hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm text-slate-400">
                        <X size={24} />
                    </button>
                </div>
            </div>
            
            <div className="flex-grow overflow-auto p-0 bg-white/20">
                {filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                        <p className="font-bold text-lg">No records found matching current filters.</p>
                    </div>
                ) : (
                    <div className="w-full">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/90 sticky top-0 z-10 backdrop-blur-md shadow-sm">
                                <tr>
                                    {status === 'Misaligned' ? (
                                        <>
                                            <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Name</th>
                                            <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Course & Batch</th>
                                            <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Career</th>
                                            <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Reason for Misalignment</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50 w-1/4">Alumni Profile</th>
                                            {status === 'Employed' && (
                                                <>
                                                    <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Position & Level</th>
                                                    <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Company & Industry</th>
                                                    <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Details</th>
                                                    <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50 text-center">Alignment</th>
                                                </>
                                            )}
                                            {status === 'Self-employed' && (
                                                <>
                                                    <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Business Name & Type</th>
                                                    <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Address</th>
                                                    <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Duration</th>
                                                    <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50 text-center">Alignment</th>
                                                </>
                                            )}
                                            {status === 'Unemployed' && (
                                                <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Reason Provided</th>
                                            )}
                                            {status === 'Retired' && (
                                                <>
                                                    <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Retirement Info</th>
                                                    <th className="p-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/50">Previous Company</th>
                                                </>
                                            )}
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50/50">
                                {filteredData.map((record, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/40 transition-colors group">
                                        {status === 'Misaligned' ? (
                                            <>
                                                <td className="p-5 align-top">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs shadow-inner">
                                                            {record.full_name.charAt(0)}
                                                        </div>
                                                        <div className="flex items-center h-10">
                                                            <div className="font-bold text-slate-800 text-sm">{record.full_name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5 align-top">
                                                    <div className="text-sm text-slate-700 font-medium">{record.program}</div>
                                                    <div className="inline-block mt-1 px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold shadow-sm">
                                                        Batch {record.year_level}
                                                    </div>
                                                </td>
                                                <td className="p-5 align-top">
                                                    <div className="font-bold text-slate-700 text-sm mb-1">{record.current_position || record.business_name || 'N/A'}</div>
                                                    <div className="text-xs text-slate-500 flex flex-col gap-1">
                                                        <span className="flex items-center gap-1"><Building2 size={12}/> {record.company_name || record.business_address || 'N/A'}</span>
                                                        <span className="flex items-center gap-1"><Briefcase size={12}/> {record.industry || record.employment_status || 'N/A'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-5 align-top">
                                                    <div className="font-bold text-amber-700 bg-amber-50 px-3 py-2 rounded-lg inline-block border border-amber-200">
                                                        {record.alignment_reason || 'Not specified'}
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-5 align-top">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs shadow-inner">
                                                            {record.full_name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-sm">{record.full_name}</div>
                                                            <div className="text-xs text-slate-500 font-medium mt-0.5">{record.program}</div>
                                                            <div className="inline-block mt-2 px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold shadow-sm">
                                                                Batch {record.year_level}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {status === 'Employed' && (
                                                    <>
                                                        <td className="p-5 align-top">
                                                            <div className="font-bold text-slate-700 text-sm">{record.current_position || 'N/A'}</div>
                                                            <div className="text-xs text-indigo-500 font-bold mt-1 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded w-fit">
                                                                <Award size={12} /> {record.current_job_level || 'Unclassified'}
                                                            </div>
                                                        </td>
                                                        <td className="p-5 align-top">
                                                            <div className="font-bold text-slate-700 text-sm">{record.company_name}</div>
                                                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                                <Building2 size={12}/> {record.industry || 'N/A'}
                                                            </div>
                                                        </td>
                                                        <td className="p-5 align-top">
                                                            <div className="text-xs text-slate-600 space-y-1">
                                                                <div className="flex items-center gap-1"><MapPin size={12} className="text-slate-400"/> {record.company_address || 'N/A'}</div>
                                                                <div className="flex items-center gap-1"><Calendar size={12} className="text-slate-400"/> Hired: {record.date_hired || 'N/A'}</div>
                                                            </div>
                                                        </td>
                                                        <td className="p-5 align-top text-center">
                                                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase shadow-sm border ${
                                                                record.job_alignment === 'Related' 
                                                                ? 'bg-green-100 text-green-700 border-green-200' 
                                                                : 'bg-amber-100 text-amber-700 border-amber-200'
                                                            }`}>
                                                                {record.job_alignment === 'Related' ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                                                                {record.job_alignment || 'N/A'}
                                                            </span>
                                                        </td>
                                                    </>
                                                )}
                                                {status === 'Self-employed' && (
                                                    <>
                                                        <td className="p-5 align-top">
                                                            <div className="font-bold text-slate-700 text-sm">{record.business_name}</div>
                                                            <div className="text-xs text-slate-500 mt-1">{record.business_type || 'Type not specified'}</div>
                                                        </td>
                                                        <td className="p-5 align-top">
                                                            <div className="text-xs text-slate-600 flex items-center gap-1">
                                                                <MapPin size={12} className="text-slate-400"/> {record.business_address}
                                                            </div>
                                                        </td>
                                                        <td className="p-5 align-top">
                                                            <div className="text-xs text-slate-600 flex items-center gap-1">
                                                                <Clock size={12} className="text-slate-400"/> {record.business_duration}
                                                            </div>
                                                        </td>
                                                        <td className="p-5 align-top text-center">
                                                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase shadow-sm border ${
                                                                record.job_alignment === 'Related' 
                                                                ? 'bg-green-100 text-green-700 border-green-200' 
                                                                : 'bg-amber-100 text-amber-700 border-amber-200'
                                                            }`}>
                                                                {record.job_alignment === 'Related' ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                                                                {record.job_alignment || 'N/A'}
                                                            </span>
                                                        </td>
                                                    </>
                                                )}
                                                {status === 'Unemployed' && (
                                                    <td className="p-5 align-top">
                                                        <div className="font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg inline-block border border-slate-200">
                                                            {record.unemployed_reasons}
                                                        </div>
                                                    </td>
                                                )}
                                                {status === 'Retired' && (
                                                    <>
                                                        <td className="p-5 align-top">
                                                            <div className="font-semibold text-slate-700">{record.retirement_reason}</div>
                                                            <div className="text-xs text-slate-500 mt-1">Retired: {record.date_retired}</div>
                                                        </td>
                                                        <td className="p-5 align-top">{record.last_company}</td>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div className="p-4 bg-white/40 backdrop-blur-md border-t border-white/50 text-xs text-slate-500 text-center font-medium">
                Confidential Report generated by Laguna University Alumni Tracer
            </div>
        </div>
    </div>
  );
};

export default StatusDetailModal;