
import React from 'react';
import { GeneratedReport, ReportSection } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, FileText } from 'lucide-react';

interface ReportPreviewProps {
  report: GeneratedReport;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

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
              <div key={index} className="mb-6 text-slate-700 break-inside-avoid page-break-inside-avoid">
                  {section.title && <h4 className="text-lg font-bold text-slate-900 mb-2 uppercase tracking-wide border-l-4 border-orange-500 pl-3">{section.title}</h4>}
                  <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-100 text-sm leading-relaxed text-justify whitespace-pre-wrap font-medium">
                      {typeof section.content === 'string' ? section.content : JSON.stringify(section.content)}
                  </div>
              </div>
          );
      }

      // 2. Render Table Section
      if (section.type === 'table') {
          // SAFETY CHECK: Ensure content is array
          if (!Array.isArray(section.content) || section.content.length === 0) {
              return <div key={index} className="mb-4 text-xs text-red-400">Table data unavailable.</div>;
          }

          const rows = section.content;
          const headers = Object.keys(rows[0]);

          return (
              <div key={index} className="mb-10 overflow-hidden break-inside-avoid page-break-inside-avoid">
                  {section.title && <h4 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wide border-l-4 border-emerald-500 pl-3">{section.title}</h4>}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                    <table className="w-full text-sm text-left bg-white">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs">
                            <tr>
                                {headers.map(h => <th key={h} className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((row: any, i: number) => {
                                // Check if this is a TOTAL row
                                const isTotal = Object.values(row).includes('TOTAL');
                                
                                return (
                                    <tr key={i} className={`
                                        ${isTotal ? 'bg-slate-200 font-black text-slate-900 border-t-2 border-slate-300' : 'hover:bg-slate-50'}
                                    `}>
                                        {headers.map(h => (
                                            <td key={h} className="px-4 py-2 border-r border-slate-50 last:border-r-0 truncate max-w-[300px]">
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

      // 3. Render Charts (Bar or Pie) - Kept for compatibility with Custom reports if they request charts
      const isChart = section.type === 'bar-chart' || section.type === 'pie-chart';
      if (isChart) {
          if (!Array.isArray(section.content) || section.content.length === 0) {
               return <div key={index} className="mb-4 text-xs text-red-400">Chart data unavailable.</div>;
          }

          return (
              <div key={index} className="mb-10 break-inside-avoid page-break-inside-avoid w-full">
                  {section.title && <h4 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wide border-l-4 border-blue-500 pl-3">{section.title}</h4>}
                  <div className="h-80 w-full bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-center items-center">
                      <ResponsiveContainer width="100%" height="100%">
                          {section.type === 'bar-chart' ? (
                              <BarChart data={section.content} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                                  <XAxis dataKey="name" tick={{fontSize: 10}} />
                                  <YAxis tick={{fontSize: 10}} />
                                  <Tooltip contentStyle={{borderRadius: '8px', border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}} />
                                  <Bar dataKey="value" fill="#3b82f6" radius={[4,4,0,0]} name="Count" />
                              </BarChart>
                          ) : (
                              <PieChart>
                                  <Pie
                                      data={section.content}
                                      cx="50%"
                                      cy="50%"
                                      outerRadius={100}
                                      fill="#8884d8"
                                      dataKey="value"
                                      label
                                  >
                                      {section.content.map((entry: any, index: number) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip />
                                  <Legend />
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
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full">
        {/* Toolbar */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center no-print sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <FileText size={20} className="text-orange-400" />
                <span className="font-bold tracking-tight">Report Preview</span>
            </div>
            <button onClick={handleDownloadPDF} className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-orange-900/20">
                <Download size={16} /> Print / Save PDF
            </button>
        </div>

        {/* Paper Content */}
        <div className="flex-grow overflow-y-auto p-8 md:p-12 bg-slate-50 print:bg-white print:p-0 custom-scrollbar">
            <div className="max-w-4xl mx-auto bg-white p-10 shadow-sm border border-slate-200 min-h-[1000px] print:shadow-none print:border-none">
                
                {/* Report Header */}
                <div className="border-b-2 border-slate-800 pb-6 mb-10 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">{content.title}</h1>
                        <div className="flex items-center gap-4 mt-3">
                            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                                Generated: {new Date(content.generatedAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Laguna University</p>
                        <p className="text-[10px] text-slate-400">Alumni Tracer System</p>
                    </div>
                </div>

                {/* Filters Badge */}
                <div className="flex gap-3 mb-10 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <span className="bg-blue-50 px-3 py-1.5 rounded border border-blue-100 text-blue-700">Batch: {content.filters.batch}</span>
                    <span className="bg-purple-50 px-3 py-1.5 rounded border border-purple-100 text-purple-700">Program: {content.filters.program}</span>
                </div>

                {/* Dynamic Sections */}
                <div className="space-y-2">
                    {content.sections && Array.isArray(content.sections) ? (
                        content.sections.map((section, index) => renderSection(section, index))
                    ) : (
                        <div className="text-red-500 font-bold p-4 bg-red-50 rounded border border-red-200">Error: Report sections missing or malformed.</div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-20 pt-6 border-t border-slate-200 text-center">
                    <p className="text-xs text-slate-400 font-mono">*** End of Official Report ***</p>
                    <p className="text-[10px] text-slate-300 mt-1">Generated via LU Tracer System</p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ReportPreview;
