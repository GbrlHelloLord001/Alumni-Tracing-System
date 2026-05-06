
import React from 'react';
import { GeneratedReport, ReportSection } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, FileText, Printer } from 'lucide-react';

interface ReportPreviewProps {
  report: GeneratedReport;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

const ReportPreview: React.FC<ReportPreviewProps> = ({ report }) => {
  const content = report.parsedContent;

  if (!content) return <div>Invalid Report Data</div>;

  const handleDownloadPDF = () => {
      window.print();
  };

  const renderSection = (section: ReportSection, index: number) => {
      // 1. Render Text Section
      if (section.type === 'text') {
          return (
              <div key={index} className="mb-10 text-slate-800 break-inside-avoid page-break-inside-avoid">
                  {section.title && <h4 className="text-[1.05rem] font-bold text-slate-900 mb-3 uppercase tracking-widest border-b border-slate-200 pb-2">{section.title}</h4>}
                  <div className="text-[15px] leading-relaxed text-justify whitespace-pre-wrap font-medium text-slate-600 bg-slate-50/50 p-6 rounded-lg border border-slate-100/60 shadow-sm">
                      {typeof section.content === 'string' ? section.content : JSON.stringify(section.content)}
                  </div>
              </div>
          );
      }

      // 2. Render Table Section
      if (section.type === 'table') {
          // SAFETY CHECK: Ensure content is array
          if (!Array.isArray(section.content) || section.content.length === 0) {
              return <div key={index} className="mb-4 text-xs text-red-500 italic">Table data unavailable.</div>;
          }

          const rows = section.content;
          const headers = Object.keys(rows[0]);

          return (
              <div key={index} className="mb-14 overflow-hidden break-inside-avoid page-break-inside-avoid">
                  {section.title && <h4 className="text-[1.05rem] font-bold text-slate-900 mb-4 uppercase tracking-widest border-b border-slate-200 pb-2">{section.title}</h4>}
                  <div className="overflow-x-auto border border-slate-200/80 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                            <tr>
                                {headers.map(h => <th key={h} className="px-5 py-4 border-b border-slate-200/80 whitespace-nowrap">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((row: any, i: number) => {
                                // Check if this is a TOTAL row
                                const isTotal = Object.values(row).includes('TOTAL');
                                
                                return (
                                    <tr key={i} className={`
                                        ${isTotal ? 'bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-300' : 'hover:bg-slate-50/50 transition-colors'}
                                    `}>
                                        {headers.map(h => (
                                            <td key={h} className="px-5 py-3 text-slate-700 truncate max-w-[350px]">
                                                {typeof row[h] === 'object' ? JSON.stringify(row[h]) : row[h]}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                  </div>
              </div>
          );
      }

      // 3. Render Charts (Bar or Pie)
      const isChart = section.type === 'bar-chart' || section.type === 'pie-chart';
      if (isChart) {
          if (!Array.isArray(section.content) || section.content.length === 0) {
               return <div key={index} className="mb-4 text-xs text-red-400">Chart data unavailable.</div>;
          }

          return (
              <div key={index} className="mb-12 break-inside-avoid page-break-inside-avoid w-full">
                  {section.title && <h4 className="text-[1.05rem] font-bold text-slate-900 mb-4 uppercase tracking-widest border-b border-slate-200 pb-2">{section.title}</h4>}
                  <div className="h-80 w-full bg-white p-6 rounded-xl border border-slate-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex justify-center items-center">
                      <ResponsiveContainer width="100%" height="100%">
                          {section.type === 'bar-chart' ? (
                              <BarChart data={section.content} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                                  <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                                  <YAxis tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} />
                                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border:'1px solid #e2e8f0', boxShadow:'0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'}} />
                                  <Bar dataKey="value" fill="#3b82f6" radius={[4,4,0,0]} name="Count" />
                              </BarChart>
                          ) : (
                              <PieChart>
                                  <Pie
                                      data={section.content}
                                      cx="50%"
                                      cy="50%"
                                      outerRadius={110}
                                      innerRadius={60}
                                      paddingAngle={2}
                                      fill="#8884d8"
                                      dataKey="value"
                                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                      labelLine={false}
                                  >
                                      {section.content.map((entry: any, index: number) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip contentStyle={{borderRadius: '12px', border:'1px solid #e2e8f0', boxShadow:'0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'}} />
                                  <Legend wrapperStyle={{fontSize: '12px', paddingTop: '20px'}} />
                              </PieChart>
                          )}
                      </ResponsiveContainer>
                  </div>
              </div>
          );
      }

      return null;
  };

  return (
    <div className="bg-slate-50/30 rounded-3xl border border-slate-200/60 overflow-hidden flex flex-col h-full ring-1 ring-black/5 shadow-xl">
        {/* Toolbar */}
        <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 p-5 flex justify-between items-center no-print sticky top-0 z-50">
            <div className="flex items-center gap-3">
                <div className="bg-slate-900 p-2 rounded-lg">
                    <FileText size={18} className="text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 leading-none">Report Preview</h3>
                    <p className="text-[11px] text-slate-500 mt-1 font-medium tracking-wide uppercase">Print-Ready Document</p>
                </div>
            </div>
            <button onClick={handleDownloadPDF} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95">
                <Printer size={16} /> Print Report
            </button>
        </div>

        {/* Paper Content */}
        <div className="flex-grow overflow-y-auto p-6 md:p-12 bg-[#f8fafc] print:bg-white print:p-0 custom-scrollbar">
            <div className="max-w-4xl mx-auto bg-white p-12 md:p-16 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 rounded-sm min-h-[1056px] print:shadow-none print:border-none print:w-full print:max-w-none print:p-0">
                
                {/* Report Header Editorial Style */}
                <div className="border-b-[3px] border-slate-900 pb-8 mb-12 flex justify-between items-end">
                    <div className="pr-8">
                        <h1 className="text-4xl font-serif font-bold text-slate-900 tracking-tight leading-tight">{content.title}</h1>
                        <div className="flex items-center gap-4 mt-6">
                            <span className="text-xs font-semibold bg-slate-100/80 text-slate-600 px-3 py-1.5 rounded-full ring-1 ring-slate-200/50 uppercase tracking-widest">
                                Date: {new Date(content.generatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                        </div>
                    </div>
                    <div className="text-right pl-8 border-l border-slate-200">
                        <p className="text-sm font-bold text-slate-800 uppercase tracking-widest">Laguna University</p>
                        <p className="text-[11px] text-slate-500 font-medium tracking-wide mt-1">Alumni Tracer Analytics</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-2">{content.filters.program === 'All' ? 'University-Wide' : content.filters.program}</p>
                    </div>
                </div>

                {/* Filters Context Bar */}
                <div className="flex gap-4 mb-12 px-6 py-4 bg-slate-50 border border-slate-200/60 rounded-xl">
                    <div className="flex-1">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Target Cohort</p>
                        <p className="text-sm font-semibold text-slate-800">{content.filters.batch === 'All' ? 'All Graduating Batches' : `Batch of ${content.filters.batch}`}</p>
                    </div>
                    <div className="w-[1px] bg-slate-200"></div>
                    <div className="flex-1">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Academic Program</p>
                        <p className="text-sm font-semibold text-slate-800">{content.filters.program}</p>
                    </div>
                </div>

                {/* Dynamic Sections */}
                <div className="space-y-6">
                    {content.sections && Array.isArray(content.sections) ? (
                        content.sections.map((section, index) => renderSection(section, index))
                    ) : (
                        <div className="text-red-600 font-medium p-6 bg-red-50 rounded-xl border border-red-100 flex items-center justify-center">
                            Error: Report sections missing or malformed.
                        </div>
                    )}
                </div>

                {/* Footer Signature Box */}
                <div className="mt-24 pt-8 border-t border-slate-200 flex justify-between items-center text-center text-slate-400">
                    <p className="text-[11px] font-mono tracking-wider">*** CONFIDENTIAL & PROPRIETARY ***</p>
                    <p className="text-[11px] font-semibold text-slate-500 tracking-wide">End of Document</p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ReportPreview;

