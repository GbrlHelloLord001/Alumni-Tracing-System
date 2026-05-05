import React, { useState, useMemo } from 'react';
import { X, Printer, Filter, Target, Briefcase, Building2, CheckCircle2, XCircle, Info, Lightbulb, ChevronDown } from 'lucide-react';
import { MasterRecord } from './HomePage';

interface AlignmentDetailModalProps {
    data: MasterRecord[];
    onClose: () => void;
    interpretation?: string;
}

const AlignmentDetailModal: React.FC<AlignmentDetailModalProps> = ({ data, onClose, interpretation }) => {
    const [localCourse, setLocalCourse] = useState<string>('All');
    const [localBatch, setLocalBatch] = useState<string>('All');
    const [activeTab, setActiveTab] = useState<'Aligned' | 'Misaligned'>('Aligned');

    const uniqueCourses = useMemo(() => Array.from(new Set(data.map(d => d.program).filter(Boolean))), [data]);
    const uniqueBatches = useMemo(() => Array.from(new Set(data.map(d => d.year_level).filter(Boolean))), [data]);

    const processedData = useMemo(() => {
        const filtered = data.filter(record => {
            const matchCourse = localCourse === 'All' || record.program === localCourse;
            const matchBatch = localBatch === 'All' || record.year_level === localBatch;
            return matchCourse && matchBatch;
        });

        const userGroups: Record<string, MasterRecord[]> = {};
        for (const record of filtered) {
            if (record.employment_status === 'Employed' || record.employment_status === 'Self-employed') {
                if (record.job_alignment) {
                    if (!userGroups[record.user_id]) userGroups[record.user_id] = [];
                    userGroups[record.user_id].push(record);
                }
            }
        }

        const alignedWork: any[] = [];
        const alignedBusiness: any[] = [];
        const misalignedWork: any[] = [];
        const misalignedBusiness: any[] = [];

        for (const userId in userGroups) {
            const records = userGroups[userId];
            // Rule: If one of their jobs/business is Misaligned, they appear in Misaligned.
            const isMisaligned = records.some(r => r.job_alignment === 'Non-Related');
            
            let bestRecord = records.find(r => r.job_alignment === (isMisaligned ? 'Non-Related' : 'Related') && r.employment_status === 'Employed') 
                          || records.find(r => r.job_alignment === (isMisaligned ? 'Non-Related' : 'Related') && r.employment_status === 'Self-employed')
                          || records[0];

            const allRoles = records.map(r => (r.employment_status === 'Employed' ? r.current_position : r.business_type)?.trim()).filter(Boolean);
            const allCompanies = records.map(r => (r.employment_status === 'Employed' ? r.company_name : r.business_name)?.trim()).filter(Boolean);
            const allReasons = records.map(r => r.alignment_reason?.trim()).filter(Boolean);

            const mappedUser = {
                user_id: userId,
                name: bestRecord.full_name,
                program: bestRecord.program,
                batch: bestRecord.year_level,
                status: bestRecord.employment_status,
                roles: Array.from(new Set(allRoles)).join(' • '),
                companies: Array.from(new Set(allCompanies)).join(' • '),
                alignment_reason: isMisaligned && allReasons.length > 0 ? Array.from(new Set(allReasons)).join(' • ') : null,
            };

            if (!isMisaligned) {
                if (bestRecord.employment_status === 'Employed') alignedWork.push(mappedUser);
                else alignedBusiness.push(mappedUser);
            } else {
                if (bestRecord.employment_status === 'Employed') misalignedWork.push(mappedUser);
                else misalignedBusiness.push(mappedUser);
            }
        }

        const sortByName = (a: any, b: any) => a.name.localeCompare(b.name);
        alignedWork.sort(sortByName);
        alignedBusiness.sort(sortByName);
        misalignedWork.sort(sortByName);
        misalignedBusiness.sort(sortByName);

        return { alignedWork, alignedBusiness, misalignedWork, misalignedBusiness };
    }, [data, localCourse, localBatch]);

    const handlePrint = () => {
        window.print();
    };

    const totalAligned = processedData.alignedWork.length + processedData.alignedBusiness.length;
    const totalMisaligned = processedData.misalignedWork.length + processedData.misalignedBusiness.length;

    const renderTable = (label: string, items: any[], type: 'Work' | 'Business') => {
        if (items.length === 0) return null;
        return (
            <div className="mb-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:mb-12 print:break-inside-avoid">
                <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                    <div className={`p-2 rounded-xl text-white ${type === 'Work' ? 'bg-blue-500 shadow-blue-500/20' : 'bg-emerald-500 shadow-emerald-500/20'} shadow-lg`}>
                        {type === 'Work' ? <Briefcase size={20} /> : <Building2 size={20} />}
                    </div>
                    <h4 className="font-bold text-slate-800 text-lg">{label} ({items.length})</h4>
                </div>
                <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left border-collapse print:table-fixed">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 w-1/4">Name</th>
                                <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 w-1/6">Course & Batch</th>
                                <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 w-1/4">Roles / Types</th>
                                <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 w-1/5">Companies / Businesses</th>
                                {items[0]?.alignment_reason !== undefined && items[0]?.alignment_reason !== null && (
                                   <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Reason for Misalignment</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, idx) => (
                                <tr key={`${item.user_id}-${idx}`} className="hover:bg-slate-50/80 transition-colors print:break-inside-avoid">
                                    <td className="p-4 align-top">
                                        <p className="text-sm font-bold text-slate-800">{item.name}</p>
                                    </td>
                                    <td className="p-4 align-top">
                                        <p className="text-xs font-bold text-slate-700">{item.program}</p>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mt-1 bg-slate-100 inline-block px-1.5 py-0.5 rounded">Batch {item.batch}</p>
                                    </td>
                                    <td className="p-4 align-top">
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{item.roles || 'N/A'}</p>
                                    </td>
                                    <td className="p-4 align-top">
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{item.companies || 'N/A'}</p>
                                    </td>
                                    {item.alignment_reason !== null && (
                                         <td className="p-4 align-top">
                                            {item.alignment_reason ? (
                                                <span className="inline-flex items-center px-2 py-1.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-xs font-medium leading-tight">
                                                    {item.alignment_reason}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">Not Specified</span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <>
            <style>
                {`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #print-modal-section, #print-modal-section * {
                        visibility: visible;
                    }
                    #print-modal-section {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
                `}
            </style>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center print:static print:z-auto">
                <div 
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 no-print"
                    onClick={onClose}
                ></div>
                <div id="print-modal-section" className="bg-white rounded-[2rem] shadow-2xl w-full max-w-7xl h-[90vh] relative z-10 flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden print:h-auto print:shadow-none print:w-full print:rounded-none">
                    
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 no-print">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                                <Target size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Program Alignment</h3>
                                <p className="text-sm text-slate-500 font-medium mt-0.5">
                                    Career alignment breakdown by course, batch, and relevance
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                                        <Filter size={12} className="text-slate-400" />
                                    </div>
                                    <select 
                                        value={localCourse} 
                                        onChange={(e) => setLocalCourse(e.target.value)}
                                        className="appearance-none bg-transparent hover:bg-slate-200/50 text-[11px] font-bold text-slate-700 py-1.5 pl-6 pr-5 outline-none cursor-pointer rounded-lg transition-colors w-24 truncate"
                                    >
                                        <option value="All">All Courses</option>
                                        {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <div className="absolute inset-y-0 right-1.5 flex items-center pointer-events-none">
                                        <ChevronDown size={10} className="text-slate-400" />
                                    </div>
                                </div>
                                <div className="w-px bg-slate-200 my-1 mx-0.5"></div>
                                <div className="relative">
                                    <select 
                                        value={localBatch} 
                                        onChange={(e) => setLocalBatch(e.target.value)}
                                        className="appearance-none bg-transparent hover:bg-slate-200/50 text-[11px] font-bold text-slate-700 py-1.5 pl-2 pr-5 outline-none cursor-pointer rounded-lg transition-colors w-20"
                                    >
                                        <option value="All">All Batches</option>
                                        {uniqueBatches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                    <div className="absolute inset-y-0 right-1.5 flex items-center pointer-events-none">
                                        <ChevronDown size={10} className="text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-[11px] font-bold shadow-lg shadow-slate-800/20 hover:bg-indigo-600 hover:shadow-indigo-500/20 active:scale-95 transition-all">
                                <Printer size={14} /> Print
                            </button>
                            <button onClick={onClose} className="p-1.5 bg-slate-100 rounded-lg hover:bg-rose-100 hover:text-rose-600 transition-all text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Print Header (Only visible when printing) */}
                    <div className="hidden print:block mb-10 pb-6 border-b-2 border-slate-800 px-8 pt-8">
                        <div className="flex border-b border-slate-200 pb-6 mb-6 gap-6">
                            <Target size={48} className="text-indigo-600" />
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Program to Career Alignment Report</h1>
                                <p className="text-lg text-slate-600 mt-2 font-medium">As of {new Date().toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div className="flex gap-12 text-sm font-bold text-slate-700 bg-slate-50 p-4 rounded-xl">
                            <p>Filtered Course: <span className="text-indigo-600">{localCourse}</span></p>
                            <p>Filtered Batch: <span className="text-indigo-600">{localBatch}</span></p>
                        </div>
                    </div>

                    <div className="flex-grow overflow-auto p-8 bg-slate-50/50 print:p-8 print:overflow-visible print:bg-white pb-32">
                        
                        <div className="max-w-5xl mx-auto">
                            {/* Insights Block */}
                            {interpretation && (
                                <div className="mb-10 p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/20 shadow-sm print:bg-white print:border-slate-300">
                                    <div className="flex gap-4">
                                        <div className="mt-1">
                                            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/30">
                                                <Lightbulb size={24} />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-900 mb-2">Systems Analysis & Interpretation</h4>
                                            <p className="text-base text-slate-700 leading-relaxed font-medium">{interpretation}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Stats Summary */}
                            <div className="grid grid-cols-2 gap-6 mb-12">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                            <CheckCircle2 size={32} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Aligned</p>
                                            <p className="text-4xl font-black text-slate-800 tracking-tight">{totalAligned}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-400">Alumni in Related Fields</p>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors duration-300">
                                            <XCircle size={32} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Misaligned</p>
                                            <p className="text-4xl font-black text-slate-800 tracking-tight">{totalMisaligned}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-400">Non-Related Fields/Business</p>
                                    </div>
                                </div>
                            </div>

                            <div className="no-print mb-8">
                                <div className="inline-flex p-1 bg-slate-200/50 backdrop-blur-sm rounded-2xl border border-slate-200">
                                    <button
                                        onClick={() => setActiveTab('Aligned')}
                                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                                            activeTab === 'Aligned' 
                                            ? 'bg-white text-indigo-700 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={18} />
                                            Aligned Alumni
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('Misaligned')}
                                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                                            activeTab === 'Misaligned' 
                                            ? 'bg-white text-rose-600 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <XCircle size={18} />
                                            Misaligned Alumni
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {(totalAligned === 0 && totalMisaligned === 0) ? (
                                <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                        <Info size={40} className="text-slate-300" />
                                    </div>
                                    <p className="text-xl font-bold text-slate-500">No alignment data available</p>
                                    <p className="text-sm text-slate-400 mt-2">Try adjusting your course or batch filters</p>
                                </div>
                            ) : (
                                <div className="space-y-12 print:space-y-16">
                                    {/* Aligned Section */}
                                    <section className={`print:block ${activeTab === 'Aligned' ? 'block' : 'hidden print:block'}`}>
                                        <div className="flex items-center gap-3 mb-6 hidden print:flex mt-12 border-b-2 border-slate-800 pb-4">
                                            <CheckCircle2 className="text-indigo-600" size={32} />
                                            <h2 className="text-3xl font-black text-slate-900">Aligned Alumni List</h2>
                                        </div>
                                        {totalAligned > 0 ? (
                                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                {renderTable("Employed in Related Field", processedData.alignedWork, 'Work')}
                                                {renderTable("Self-Employed (Business Related)", processedData.alignedBusiness, 'Business')}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                                                <p className="text-slate-400 font-bold">No aligned alumni found for this selection.</p>
                                            </div>
                                        )}
                                    </section>

                                    {/* Misaligned Section */}
                                    <section className={`print:block ${activeTab === 'Misaligned' ? 'block' : 'hidden print:block'}`}>
                                        <div className="flex items-center gap-3 mb-6 hidden print:flex mt-12 border-b-2 border-slate-800 pb-4">
                                            <XCircle className="text-rose-600" size={32} />
                                            <h2 className="text-3xl font-black text-slate-900">Misaligned Alumni List</h2>
                                        </div>
                                        {totalMisaligned > 0 ? (
                                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                {renderTable("Employed in Non-Related Field", processedData.misalignedWork, 'Work')}
                                                {renderTable("Self-Employed (Business Non-Related)", processedData.misalignedBusiness, 'Business')}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200" style={{display: 'none'}}>
                                                <p className="text-slate-400 font-bold">No misaligned alumni found for this selection.</p>
                                            </div>
                                        )}
                                    </section>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AlignmentDetailModal;

