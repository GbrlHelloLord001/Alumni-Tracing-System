
import React, { useState, useEffect } from 'react';
import { Admin, ReportConfig, GeneratedReport, ReportSchedule } from '../types';
import ReportGenerator from './reports/ReportGenerator';
import ReportHistory from './reports/ReportHistory';
import ReportScheduler from './reports/ReportScheduler';
import { Plus, History, Clock, FileText, Loader2 } from 'lucide-react';
import { fetchReportContext, generateAIReport, saveReport } from '../services/reportService';

interface ReportsPageProps {
  adminId: string;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ adminId }) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'schedule'>('generate');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);

  // Auto-run Scheduler Check on Mount
  useEffect(() => {
    checkScheduledReports();
  }, []);

  const checkScheduledReports = async () => {
    const stored = localStorage.getItem('lu_report_schedules');
    if (!stored) return;

    const schedules: ReportSchedule[] = JSON.parse(stored);
    const today = new Date();
    const updatedSchedules: ReportSchedule[] = [];
    let didRun = false;

    for (const sch of schedules) {
        if (sch.isActive && new Date(sch.nextRun) <= today) {
            console.log(`Running scheduled report: ${sch.frequency} ${sch.config.type}`);
            // Generate
            try {
                const context = await fetchReportContext(sch.config);
                const content = await generateAIReport(sch.config, context);
                await saveReport(adminId, content, sch.config.type); // Updated call
                didRun = true;
                
                // Update Schedule
                const nextDate = new Date();
                if (sch.frequency === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                if (sch.frequency === 'Quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
                if (sch.frequency === 'Yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
                
                updatedSchedules.push({
                    ...sch,
                    lastRun: new Date().toISOString(),
                    nextRun: nextDate.toISOString().split('T')[0]
                });
            } catch (e) {
                console.error("Auto-report failed", e);
                updatedSchedules.push(sch); // Keep old schedule if failed
            }
        } else {
            updatedSchedules.push(sch);
        }
    }

    if (didRun) {
        localStorage.setItem('lu_report_schedules', JSON.stringify(updatedSchedules));
        // Optional: Show toast "Scheduled reports generated"
    }
  };

  const handleGenerate = async (config: ReportConfig) => {
    setIsProcessing(true);
    setGeneratedReport(null);
    try {
        // 1. Fetch Data
        const context = await fetchReportContext(config);
        if (context.totalGraduates === 0) {
            alert("No data found for the selected filters.");
            setIsProcessing(false);
            return;
        }

        // 2. AI Gen
        const content = await generateAIReport(config, context);

        // 3. Save (Updated call to pass type)
        await saveReport(adminId, content, config.type);

        // 4. View
        // Create a temporary object to view immediately without refetching from DB
        setGeneratedReport({
            id: 'temp',
            admin_id: adminId,
            content: JSON.stringify(content),
            created_at: new Date().toISOString(),
            parsedContent: content,
            // Pre-fill type for immediate viewing consistency if needed
            [config.type.toLowerCase()]: JSON.stringify(content) 
        });

    } catch (e) {
        console.error(e);
        alert("Failed to generate report. Please try again.");
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-lg shadow-orange-500/5">
          <div>
              <h2 className="text-2xl font-bold text-slate-800">Report Generator</h2>
              <p className="text-slate-500 mt-1">Create custom narratives and tables from alumni data.</p>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4">
          {[
              { id: 'generate', label: 'Create New', icon: Plus, color: 'orange' },
              { id: 'history', label: 'Report History', icon: History, color: 'blue' },
              { id: 'schedule', label: 'Automation', icon: Clock, color: 'purple' },
          ].map(tab => (
              <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all border ${
                      activeTab === tab.id 
                      ? `bg-gradient-to-r from-${tab.color}-500 to-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-500/30 border-transparent` 
                      : 'bg-white/40 border-white/60 text-slate-500 hover:bg-white/60 hover:text-slate-800'
                  }`}
              >
                  <tab.icon size={18} /> {tab.label}
              </button>
          ))}
      </div>

      {/* Content - Removed backdrop-blur-xl to fix fixed modal clipping */}
      <div className="bg-white/60 rounded-3xl border border-white/50 shadow-lg shadow-indigo-500/5 overflow-hidden min-h-[500px] p-6 relative">
          
          {isProcessing && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in">
                  <div className="w-20 h-20 relative mb-4">
                      <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-orange-500 border-transparent rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 animate-pulse">Analyzing Data...</h3>
                  <p className="text-slate-500 text-sm mt-1">Generating insights, tables, and visualizations.</p>
              </div>
          )}

          {activeTab === 'generate' && (
              <ReportGenerator 
                  onGenerate={handleGenerate} 
                  report={generatedReport} 
                  onReset={() => setGeneratedReport(null)}
              />
          )}

          {activeTab === 'history' && (
              <ReportHistory adminId={adminId} />
          )}

          {activeTab === 'schedule' && (
              <ReportScheduler />
          )}

      </div>
    </div>
  );
};

export default ReportsPage;