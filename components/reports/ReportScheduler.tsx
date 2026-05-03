
import React, { useState, useEffect } from 'react';
import { ReportSchedule } from '../../types';
import { Clock, Plus, Trash2, Save, CheckCircle } from 'lucide-react';

const ReportScheduler: React.FC = () => {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newSchedule, setNewSchedule] = useState<Partial<ReportSchedule>>({
      frequency: 'Monthly',
      config: {
          type: 'Employment',
          batch: 'All',
          program: 'All',
          formats: ['Narrative']
      }
  });

  useEffect(() => {
      const stored = localStorage.getItem('lu_report_schedules');
      if (stored) setSchedules(JSON.parse(stored));
  }, []);

  const saveSchedules = (updated: ReportSchedule[]) => {
      setSchedules(updated);
      localStorage.setItem('lu_report_schedules', JSON.stringify(updated));
  };

  const handleAdd = () => {
      const nextRun = new Date();
      // Set simple next run logic
      nextRun.setDate(nextRun.getDate() + 1); 

      const schedule: ReportSchedule = {
          id: Date.now().toString(),
          frequency: newSchedule.frequency || 'Monthly',
          nextRun: nextRun.toISOString().split('T')[0],
          isActive: true,
          config: newSchedule.config!
      };
      
      saveSchedules([...schedules, schedule]);
      setIsAdding(false);
  };

  const removeSchedule = (id: string) => {
      saveSchedules(schedules.filter(s => s.id !== id));
  };

  return (
    <div>
        <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 mb-8">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-white text-purple-600 rounded-xl shadow-sm"><Clock size={24}/></div>
                <div>
                    <h3 className="font-bold text-purple-900 text-lg">Automated Reporting</h3>
                    <p className="text-purple-700 text-sm mt-1 max-w-xl">
                        Configure the system to automatically generate and save reports at specific intervals. 
                        Reports will be generated when an admin accesses the dashboard on the scheduled date.
                    </p>
                </div>
            </div>
        </div>

        <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-slate-800">Active Schedules</h4>
            <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl flex items-center gap-2">
                <Plus size={16}/> Add Schedule
            </button>
        </div>

        {isAdding && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg mb-6 animate-in slide-in-from-top-2">
                <h5 className="font-bold text-slate-800 mb-4">New Automation Rule</h5>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Frequency</label>
                        <select 
                            value={newSchedule.frequency}
                            onChange={e => setNewSchedule({...newSchedule, frequency: e.target.value as any})}
                            className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold"
                        >
                            <option>Monthly</option>
                            <option>Quarterly</option>
                            <option>Yearly</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Report Type</label>
                        <select 
                            value={newSchedule.config?.type}
                            onChange={e => setNewSchedule({...newSchedule, config: { ...newSchedule.config!, type: e.target.value as any }})}
                            className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold"
                        >
                            <option>Employment</option>
                            <option>Education</option>
                            <option>Community</option>
                            <option>Skills</option>
                            <option>All</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button>
                    <button onClick={handleAdd} className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg shadow hover:bg-purple-700">Save Schedule</button>
                </div>
            </div>
        )}

        <div className="space-y-3">
            {schedules.length === 0 ? (
                <div className="text-center py-10 text-slate-400">No active schedules.</div>
            ) : (
                schedules.map(sch => (
                    <div key={sch.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-slate-800">{sch.frequency} Report</span>
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">{sch.config.type}</span>
                            </div>
                            <div className="text-xs text-slate-500 flex gap-4">
                                <span>Next Run: {sch.nextRun}</span>
                                {sch.lastRun && <span className="text-emerald-600 flex items-center gap-1"><CheckCircle size={10}/> Last: {new Date(sch.lastRun).toLocaleDateString()}</span>}
                            </div>
                        </div>
                        <button onClick={() => removeSchedule(sch.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

export default ReportScheduler;
