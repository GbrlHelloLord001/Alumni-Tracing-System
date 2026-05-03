
import React, { useEffect, useState } from 'react';
import { GeneratedReport } from '../../types';
import { getReportHistory, deleteReport, deleteAllReports } from '../../services/reportService';
import { FileText, Calendar, Eye, Loader2, Sparkles, Briefcase, BookOpen, Heart, Award, Trash2, AlertTriangle, X } from 'lucide-react';
import ReportPreview from './ReportPreview';

type ReportCategory = 'New' | 'Employment' | 'Education' | 'Community' | 'Skills';

const ReportHistory: React.FC<{ adminId: string }> = ({ adminId }) => {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null);
  const [activeCategory, setActiveCategory] = useState<ReportCategory>('New');
  
  // Modal States
  const [deleteModal, setDeleteModal] = useState<{ open: boolean, id: string | null }>({ open: false, id: null });
  const [deleteAllModal, setDeleteAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
        const data = await getReportHistory(adminId);
        setReports(data);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async () => {
      if (!deleteModal.id) return;
      setIsDeleting(true);
      try {
          await deleteReport(deleteModal.id);
          setReports(prev => prev.filter(r => r.id !== deleteModal.id));
          setDeleteModal({ open: false, id: null });
      } catch (e) {
          alert("Failed to delete report.");
      } finally {
          setIsDeleting(false);
      }
  };

  const handleDeleteAll = async () => {
      setIsDeleting(true);
      try {
          await deleteAllReports(adminId);
          setReports([]);
          setDeleteAllModal(false);
      } catch (e) {
          alert("Failed to clear history.");
      } finally {
          setIsDeleting(false);
      }
  };

  // Filter Logic
  const getFilteredReports = () => {
      if (activeCategory === 'New') {
          // Reports from the last 5 days
          const fiveDaysAgo = new Date();
          fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
          return reports.filter(r => new Date(r.created_at) >= fiveDaysAgo);
      } else {
          // Check specific columns OR parsed title/type fallback
          const key = activeCategory.toLowerCase() as keyof GeneratedReport;
          return reports.filter(r => {
              // Priority 1: Check if data exists in the specific new DB column
              if (r[key]) return true;
              
              // Priority 2: Fallback check on content title/body if user hasn't migrated DB fully
              const contentStr = r.content.toLowerCase();
              return contentStr.includes(activeCategory.toLowerCase());
          });
      }
  };

  const filteredReports = getFilteredReports();

  if (selectedReport) {
      return (
          <div className="space-y-4">
              <button onClick={() => setSelectedReport(null)} className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-2">
                  <span className="text-lg">←</span> Back to History
              </button>
              <ReportPreview report={selectedReport} />
          </div>
      );
  }

  const TabButton = ({ category, icon: Icon, colorClass }: { category: ReportCategory, icon: any, colorClass: string }) => (
      <button 
        onClick={() => setActiveCategory(category)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
            activeCategory === category 
            ? `${colorClass} text-white shadow-md border-transparent` 
            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
        }`}
      >
          <Icon size={14} /> {category}
      </button>
  );

  return (
    <>
    <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <h3 className="text-xl font-bold text-slate-800">Past Reports</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Manage and review previously generated insights.</p>
            </div>
            
            {reports.length > 0 && (
                <button 
                    onClick={() => setDeleteAllModal(true)}
                    className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-100"
                >
                    <Trash2 size={14} /> Clear History
                </button>
            )}
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 pb-2 border-b border-slate-100">
            <TabButton category="New" icon={Sparkles} colorClass="bg-blue-500" />
            <TabButton category="Employment" icon={Briefcase} colorClass="bg-orange-500" />
            <TabButton category="Education" icon={BookOpen} colorClass="bg-emerald-500" />
            <TabButton category="Community" icon={Heart} colorClass="bg-rose-500" />
            <TabButton category="Skills" icon={Award} colorClass="bg-purple-500" />
        </div>

        {loading ? (
            <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-300"/></div>
        ) : filteredReports.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <FileText className="mx-auto mb-2 opacity-20" size={32}/>
                No {activeCategory.toLowerCase()} reports found.
            </div>
        ) : (
            <div className="space-y-3">
                {filteredReports.map(report => (
                    <div key={report.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white shadow-sm ${
                                activeCategory === 'New' ? 'bg-blue-500' :
                                activeCategory === 'Employment' ? 'bg-orange-500' :
                                activeCategory === 'Education' ? 'bg-emerald-500' :
                                activeCategory === 'Community' ? 'bg-rose-500' : 'bg-purple-500'
                            }`}>
                                <FileText size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                                    {report.parsedContent?.title || "Untitled Report"}
                                </h4>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                    <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(report.created_at).toLocaleDateString()} {new Date(report.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    <span className="bg-slate-100 px-1.5 rounded border border-slate-200">
                                        Batch: {report.parsedContent?.filters.batch}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setSelectedReport(report)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View Report"
                            >
                                <Eye size={18} />
                            </button>
                            <button 
                                onClick={() => setDeleteModal({ open: true, id: report.id })}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Report"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>

    {/* Delete Single Modal */}
    {deleteModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setDeleteModal({ open: false, id: null })}></div>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 p-6 animate-in zoom-in-95">
                <div className="text-center">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Delete Report?</h3>
                    <p className="text-sm text-slate-500 mb-6">This action cannot be undone.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setDeleteModal({ open: false, id: null })} className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm">Cancel</button>
                        <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-2 bg-red-500 text-white font-bold rounded-xl text-sm hover:bg-red-600 flex justify-center">
                            {isDeleting ? <Loader2 className="animate-spin" size={16}/> : "Delete"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* Delete All Modal */}
    {deleteAllModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setDeleteAllModal(false)}></div>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 p-6 animate-in zoom-in-95">
                <div className="text-center">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-50">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Clear All History?</h3>
                    <p className="text-sm text-slate-500 mb-6">This will permanently delete ALL generated reports. Are you absolutely sure?</p>
                    <div className="flex gap-3">
                        <button onClick={() => setDeleteAllModal(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm">Cancel</button>
                        <button onClick={handleDeleteAll} disabled={isDeleting} className="flex-1 py-2 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 flex justify-center">
                            {isDeleting ? <Loader2 className="animate-spin" size={16}/> : "Yes, Delete All"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default ReportHistory;
