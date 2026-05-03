
import React, { useState } from 'react';
import { ReportConfig, GeneratedReport } from '../../types';
import { FileText, BarChart2, Table, RefreshCw, Download } from 'lucide-react';
import ReportPreview from './ReportPreview';
import { COURSES } from '../../lib/normalization';

interface ReportGeneratorProps {
  onGenerate: (config: ReportConfig) => void;
  report: GeneratedReport | null;
  onReset: () => void;
}

const COURSES_WITH_ALL = ["All", ...COURSES];

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ onGenerate, report, onReset }) => {
  const [config, setConfig] = useState<ReportConfig>({
      type: 'Employment',
      batch: 'All',
      program: 'All',
      formats: ['Narrative'],
      customPrompt: ''
  });

  const years = ['All', ...Array.from({length: 20}, (_, i) => (2026 - i).toString())];

  const toggleFormat = (fmt: 'Narrative' | 'Table' | 'Graph') => {
      const current = config.formats;
      if (current.includes(fmt)) {
          setConfig({ ...config, formats: current.filter(f => f !== fmt) });
      } else {
          setConfig({ ...config, formats: [...current, fmt] });
      }
  };

  if (report) {
      return (
          <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                  <div>
                      <h3 className="text-xl font-bold text-slate-800">Report Generated</h3>
                      <p className="text-sm text-slate-500">Review your generated insights below.</p>
                  </div>
                  <button onClick={onReset} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2">
                      <RefreshCw size={16} /> Create Another
                  </button>
              </div>
              <ReportPreview report={report} />
          </div>
      );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left: Configuration */}
        <div className="space-y-6">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Report Category</label>
                <div className="grid grid-cols-2 gap-3">
                    {['Employment', 'Education', 'Community', 'Skills', 'All', 'Custom'].map(type => (
                        <button
                            key={type}
                            onClick={() => setConfig({ ...config, type: type as any })}
                            className={`py-3 px-4 rounded-xl text-sm font-bold border transition-all text-left ${
                                config.type === type 
                                ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-sm' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-orange-200'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Batch / Year</label>
                    <select 
                        value={config.batch} 
                        onChange={e => setConfig({...config, batch: e.target.value})}
                        className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-orange-400"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Program</label>
                    <select 
                        value={config.program} 
                        onChange={e => setConfig({...config, program: e.target.value})}
                        className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-orange-400"
                    >
                        {COURSES_WITH_ALL.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Output Format</label>
                <div className="flex gap-3">
                    <button 
                        onClick={() => toggleFormat('Narrative')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 transition-all ${config.formats.includes('Narrative') ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                        <FileText size={18}/> Narrative
                    </button>
                    <button 
                        onClick={() => toggleFormat('Table')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 transition-all ${config.formats.includes('Table') ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400'}`}
                    >
                        <Table size={18}/> Data Table
                    </button>
                </div>
            </div>

            {config.type === 'Custom' && (
                <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Custom Prompt</label>
                    <textarea 
                        value={config.customPrompt}
                        onChange={e => setConfig({...config, customPrompt: e.target.value})}
                        className="w-full p-4 bg-white rounded-xl border border-slate-200 text-sm font-medium h-32 outline-none focus:border-orange-400 resize-none"
                        placeholder="e.g. Analyze the correlation between high grades and employment speed..."
                    />
                </div>
            )}

            <button 
                onClick={() => onGenerate(config)}
                disabled={config.formats.length === 0}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <FileText size={20}/> Generate Report
            </button>
        </div>

        {/* Right: Info / Illustration */}
        <div className="hidden lg:flex flex-col items-center justify-center bg-white/50 rounded-3xl border border-slate-100 p-8 text-center text-slate-400">
            <div className="w-32 h-32 bg-orange-50 rounded-full flex items-center justify-center mb-6">
                <FileText size={64} className="text-orange-200" />
            </div>
            <h4 className="text-xl font-bold text-slate-600 mb-2">Automated Insights</h4>
            <p className="max-w-xs text-sm">Select your data parameters and let our system build a comprehensive report instantly.</p>
        </div>
    </div>
  );
};

export default ReportGenerator;