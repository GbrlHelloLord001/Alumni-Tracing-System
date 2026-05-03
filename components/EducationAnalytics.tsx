
import React, { useEffect, useState } from 'react';
import { BookOpen, Award, School, TrendingUp, DollarSign, Lightbulb, Loader2, GraduationCap, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Cell, PieChart, Pie } from 'recharts';
import { generateEducationInsights, EduInterpretations } from '../services/educationAI';

// Helper to estimate salary from range string (Robust normalization)
const estimateSalary = (range: string): number => {
    if (!range) return 0;
    // Remove Currency symbols, commas, and normalize dashes
    const r = range.replace(/₱/g, '').replace(/,/g, '').replace(/–/g, '-').replace(/—/g, '-').trim(); 
    
    // Employed Ranges
    if (r.includes('Below 15000')) return 12500;
    if (r.includes('15000') && r.includes('20000')) return 17500;
    if (r.includes('20001') && r.includes('30000')) return 25000;
    if (r.includes('30001') && r.includes('50000')) return 40000;
    if (r.includes('Above 50000')) return 75000; // Increased estimate for "Above"

    // Self-Employed / Business Revenue Ranges
    if (r.includes('Below 10000')) return 8000;
    if (r.includes('10000') && r.includes('50000')) return 30000;
    if (r.includes('50001') && r.includes('100000')) return 75000;
    if (r.includes('100001') && r.includes('500000')) return 250000;
    if (r.includes('500001') && r.includes('1000000')) return 750000;
    if (r.includes('Above 1000000')) return 1200000;

    return 0;
};

// Interpretation Component
const InsightCard = ({ text, loading }: { text?: string, loading: boolean }) => (
    <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 flex gap-3 relative overflow-hidden">
        <Lightbulb className="text-blue-600 shrink-0 mt-1" size={18} />
        <div className="relative z-10 w-full">
            <h5 className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-1">Interpretation</h5>
            {loading ? (
                <div className="space-y-2 animate-pulse">
                    <div className="h-2 bg-blue-200 rounded w-full"></div>
                    <div className="h-2 bg-blue-200 rounded w-3/4"></div>
                </div>
            ) : (
                <p className="text-xs text-slate-700 font-medium leading-relaxed">{text || "Insufficient data for analysis, or Auto-Interpretation is disabled."}</p>
            )}
        </div>
    </div>
);

interface EducationAnalyticsProps {
    autoAI?: boolean;
}

const EducationAnalytics: React.FC<EducationAnalyticsProps> = ({ autoAI = false }) => {
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [interpretations, setInterpretations] = useState<EduInterpretations | null>(null);

  // State for Charts
  const [attainmentData, setAttainmentData] = useState<any[]>([]);
  const [feederSchools, setFeederSchools] = useState<{ primary: any[], secondary: any[] }>({ primary: [], secondary: [] });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [licenseStats, setLicenseStats] = useState<any>(null); // Kept for AI calculation context
  const [gradTrends, setGradTrends] = useState<any[]>([]);
  const [salaryByDegree, setSalaryByDegree] = useState<any[]>([]);
  
  // Data State for AI
  const [aiStats, setAiStats] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Separate effect to trigger AI when data is ready AND autoAI is enabled
  useEffect(() => {
      if (autoAI && aiStats && !interpretations && !loadingAI) {
          runAI(aiStats);
      } else if (!autoAI) {
          setInterpretations(null);
      }
  }, [autoAI, aiStats]);

  const runAI = async (stats: any) => {
      setLoadingAI(true);
      try {
          const insights = await generateEducationInsights(stats);
          setInterpretations(insights);
      } catch (e) {
          console.error("AI Error", e);
      } finally {
          setLoadingAI(false);
      }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
        // 1. Fetch Basic User Data (For Graduation Trends & Mapping)
        const [ { data: students }, { data: alumni } ] = await Promise.all([
            supabase.from('students').select('id, year_level'),
            supabase.from('alumni').select('id, year_level')
        ]);

        // 2. Fetch Surveys (The Bridge)
        const { data: surveys, error: surveyError } = await supabase.from('survey_responses').select('id, student_id, alumni_id');
        if (surveyError) throw surveyError;

        // Create a map of SurveyID -> UserID
        const surveyUserMap = new Map<string, string>();
        surveys?.forEach(s => {
            const userId = s.student_id || s.alumni_id;
            if (userId) surveyUserMap.set(s.id, userId);
        });

        // 3. Fetch Education Data
        const { data: eduData, error: eduError } = await supabase.from('education_information').select('*');
        if (eduError) throw eduError;

        // 4. Fetch Employment Data
        const { data: empData, error: empError } = await supabase.from('employment_information').select('*');
        if (empError) throw empError;

        // --- DATA MAPS ---
        
        // Map: UserID -> Education Record
        const userEduMap = new Map<string, any>();
        eduData?.forEach(edu => {
            const userId = surveyUserMap.get(edu.survey_response_id);
            if (userId) userEduMap.set(userId, edu);
        });

        // Map: UserID -> Employment Record (Latest)
        const userEmpMap = new Map<string, any>();
        const sortedEmp = [...(empData || [])].sort((a, b) => (a.id > b.id ? 1 : -1));
        sortedEmp.forEach(emp => {
            const userId = surveyUserMap.get(emp.survey_response_id);
            if (userId) userEmpMap.set(userId, emp);
        });

        // --- PROCESSING ---

        // A. Graduation Trends (Source: Students/Alumni Tables 'year_level')
        const years: Record<string, number> = {};
        const allUsers = [...(students || []), ...(alumni || [])];
        
        allUsers.forEach(u => {
            if (u.year_level) {
                const val = parseInt(u.year_level);
                // Ensure it's a valid year (4 digits) to exclude "4th Year" (val=4) and other non-years
                if (!isNaN(val) && val > 1900) {
                    years[u.year_level] = (years[u.year_level] || 0) + 1;
                }
            }
        });

        // B. Attainment & Feeder Schools (Source: Education Table)
        const degrees = { Bachelors: 0, Masters: 0, Doctoral: 0 };
        const primaryCount: Record<string, number> = {};
        const secondaryCount: Record<string, number> = {};

        allUsers.forEach(u => {
            const edu = userEduMap.get(u.id);
            
            // Degree Level
            if (edu && edu.doctoral_degree && edu.doctoral_degree.trim()) {
                degrees.Doctoral++;
            } else if (edu && edu.masters_degree && edu.masters_degree.trim()) {
                degrees.Masters++;
            } else {
                // Default to Bachelor's for any registered alumni
                degrees.Bachelors++;
            }

            // Feeder Schools (Only if record exists)
            if (edu) {
                if (edu.primary_school) primaryCount[edu.primary_school] = (primaryCount[edu.primary_school] || 0) + 1;
                if (edu.secondary_school) secondaryCount[edu.secondary_school] = (secondaryCount[edu.secondary_school] || 0) + 1;
            }
        });

        // C. Salary by Degree (Source: Employment Table -> Education Table)
        const degreeSalaries: Record<string, { sum: number, count: number }> = {
            "Bachelor's": { sum: 0, count: 0 },
            "Master's": { sum: 0, count: 0 },
            "Doctoral": { sum: 0, count: 0 }
        };

        // D. License Impact Stats (Calculation retained for AI context)
        let licEmp = 0, licTotal = 0, licSalSum = 0, licSalCount = 0;
        let nonLicEmp = 0, nonLicTotal = 0, nonLicSalSum = 0, nonLicSalCount = 0;

        // Iterate through all users to cross-reference Edu + Emp
        allUsers.forEach(u => {
            const edu = userEduMap.get(u.id);
            const emp = userEmpMap.get(u.id);

            // Determine Degree Level
            let level = "Bachelor's";
            if (edu) {
                if (edu.doctoral_degree && edu.doctoral_degree.trim()) level = "Doctoral";
                else if (edu.masters_degree && edu.masters_degree.trim()) level = "Master's";
            }

            // Calculate Salary Stats
            if (emp) {
                const rawRange = emp.salary_range || emp.business_revenue;
                const salary = estimateSalary(rawRange);
                
                if (salary > 0) {
                    degreeSalaries[level].sum += salary;
                    degreeSalaries[level].count++;
                }
            }

            // Determine License Status
            const licVal = edu?.professional_license ? edu.professional_license.trim().toLowerCase() : '';
            const hasLicense = licVal && licVal !== 'none' && licVal !== 'n/a' && licVal !== '-' && licVal !== 'no';

            // Check Employment for License Stats
            const isEmployed = emp && (emp.employment_status === 'Employed' || emp.employment_status === 'Self-employed');
            const salaryVal = emp ? estimateSalary(emp.salary_range || emp.business_revenue) : 0;

            if (hasLicense) {
                licTotal++;
                if (isEmployed) licEmp++;
                if (salaryVal > 0) { licSalSum += salaryVal; licSalCount++; }
            } else {
                nonLicTotal++;
                if (isEmployed) nonLicEmp++;
                if (salaryVal > 0) { nonLicSalSum += salaryVal; nonLicSalCount++; }
            }
        });

        // --- FORMATTING FOR CHARTS ---

        // Attainment
        setAttainmentData([
            { name: "Bachelor's", value: degrees.Bachelors, fill: '#60a5fa' },
            { name: "Master's", value: degrees.Masters, fill: '#818cf8' },
            { name: "Doctoral", value: degrees.Doctoral, fill: '#c084fc' },
        ]);

        // Feeder Schools (Top 5)
        const topPrimary = Object.entries(primaryCount).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
        const topSecondary = Object.entries(secondaryCount).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
        setFeederSchools({ primary: topPrimary, secondary: topSecondary });

        // License Stats (Internal State for AI)
        setLicenseStats({
            licensedEmpRate: licTotal > 0 ? Math.round((licEmp / licTotal) * 100) : 0,
            licensedSalary: licSalCount > 0 ? Math.round(licSalSum / licSalCount) : 0,
            nonLicensedEmpRate: nonLicTotal > 0 ? Math.round((nonLicEmp / nonLicTotal) * 100) : 0,
            nonLicensedSalary: nonLicSalCount > 0 ? Math.round(nonLicSalSum / nonLicSalCount) : 0,
            licensedCount: licTotal,
            nonLicensedCount: nonLicTotal
        });

        // Grad Trends
        const trendData = Object.entries(years).map(([year, count]) => ({ year, count })).sort((a,b) => parseInt(a.year) - parseInt(b.year));
        setGradTrends(trendData);

        // Salary by Degree
        const salData = Object.entries(degreeSalaries).map(([level, data]) => ({
            name: level,
            avgSalary: data.count > 0 ? Math.round(data.sum / data.count) : 0
        }));
        setSalaryByDegree(salData);

        // --- PREPARE AI STATS ---
        const statsForAI = {
            attainmentCounts: degrees,
            licenseStats: {
                licensedEmpRate: licTotal > 0 ? Math.round((licEmp / licTotal) * 100) : 0,
                licensedSalary: licSalCount > 0 ? Math.round(licSalSum / licSalCount) : 0,
                nonLicensedEmpRate: nonLicTotal > 0 ? Math.round((nonLicEmp / nonLicTotal) * 100) : 0,
                nonLicensedSalary: nonLicSalCount > 0 ? Math.round(nonLicSalSum / nonLicSalCount) : 0,
            },
            feederSchools: { primary: topPrimary.slice(0,3), secondary: topSecondary.slice(0,3) },
            degreeSalaries: salData,
            gradTrends: trendData.slice(-5) 
        };
        setAiStats(statsForAI);
        
        // Mark initial data fetch as done
        setLoading(false);

    } catch (e) {
        console.error("Fetch Error:", e);
        setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
        
        {/* ROW 1: Attainment & Schools */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Highest Educational Attainment */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-6 rounded-3xl lg:col-span-1 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><GraduationCap size={20}/></div>
                    <h4 className="font-bold text-slate-800">Educational Attainment</h4>
                </div>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attainmentData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11, fontWeight: 'bold', fill: '#64748b'}} />
                            <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                {attainmentData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <InsightCard text={interpretations?.attainmentAnalysis} loading={loadingAI} />
            </div>

            {/* School Source Analysis */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-6 rounded-3xl lg:col-span-2 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><School size={20}/></div>
                    <h4 className="font-bold text-slate-800">Top Feeder Schools</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
                    {/* Primary */}
                    <div className="bg-white/60 rounded-xl border border-white/60 p-4">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Primary Level
                        </h5>
                        <ul className="space-y-3">
                            {feederSchools.primary.map((school, i) => (
                                <li key={i} className="flex justify-between items-center text-sm">
                                    <span className="text-slate-700 font-medium truncate pr-2" title={school.name}>{school.name}</span>
                                    <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">{school.count}</span>
                                </li>
                            ))}
                            {feederSchools.primary.length === 0 && <li className="text-slate-400 text-xs italic">No data available</li>}
                        </ul>
                    </div>
                    {/* Secondary */}
                    <div className="bg-white/60 rounded-xl border border-white/60 p-4">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span> Secondary Level
                        </h5>
                        <ul className="space-y-3">
                            {feederSchools.secondary.map((school, i) => (
                                <li key={i} className="flex justify-between items-center text-sm">
                                    <span className="text-slate-700 font-medium truncate pr-2" title={school.name}>{school.name}</span>
                                    <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">{school.count}</span>
                                </li>
                            ))}
                            {feederSchools.secondary.length === 0 && <li className="text-slate-400 text-xs italic">No data available</li>}
                        </ul>
                    </div>
                </div>
                <InsightCard text={interpretations?.feederSchools} loading={loadingAI} />
            </div>
        </div>

        {/* ROW 2: Trends & Salary Progression */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Graduation Trends */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-6 rounded-3xl flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><TrendingUp size={20}/></div>
                    <h4 className="font-bold text-slate-800">Graduation Trends</h4>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={gradTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey="year" tick={{fontSize: 11}} />
                            <YAxis tick={{fontSize: 11}} />
                            <Tooltip contentStyle={{borderRadius: '12px'}} />
                            <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981'}} activeDot={{r: 6}} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <InsightCard text={interpretations?.gradTrendsAnalysis} loading={loadingAI} />
            </div>

            {/* Salary Progression */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-6 rounded-3xl flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><DollarSign size={20}/></div>
                    <div>
                        <h4 className="font-bold text-slate-800">Return on Education</h4>
                        <p className="text-xs text-slate-500">Average Salary by Degree Level</p>
                    </div>
                </div>
                <div className="h-64 w-full flex-grow">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salaryByDegree} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 'bold'}} />
                            <YAxis tickFormatter={(val) => `₱${val/1000}k`} tick={{fontSize: 11}} />
                            <Tooltip formatter={(val: number) => `₱${val.toLocaleString()}`} cursor={{fill: '#fef3c7'}} contentStyle={{borderRadius: '12px'}} />
                            <Bar dataKey="avgSalary" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40}>
                                {salaryByDegree.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={['#60a5fa', '#818cf8', '#c084fc'][index % 3]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <InsightCard text={interpretations?.salaryProgression} loading={loadingAI} />
            </div>
        </div>

    </div>
  );
};

export default EducationAnalytics;
