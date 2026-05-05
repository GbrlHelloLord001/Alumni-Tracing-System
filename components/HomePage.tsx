
// ... existing imports ...
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Briefcase, AlertCircle, UserCheck, Target, Building2, BarChart3, PieChart as PieChartIcon, TrendingUp, Users, Filter, ChevronDown, RefreshCw, Award, X, MapPin, Printer, Calendar, Phone, BookOpen, Heart, Sparkles, Lightbulb, CheckCircle2, XCircle, Clock, ArrowUpRight, ArrowDownRight, Timer, LineChart as LineChartIcon, Gauge, Check, DollarSign, ToggleLeft, ToggleRight, HelpCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ReferenceLine, ComposedChart, Line, Area, LineChart, LabelList 
} from 'recharts';
import { generateCardInterpretations, generateQualityAnalysis, CardInterpretations, QualityAnalysis } from '../services/adminAI';
import EducationAnalytics from './EducationAnalytics';
import CommunityAnalytics from './CommunityAnalytics';
import SkillsAnalytics from './SkillsAnalytics';
import StatusDetailModal from './StatusDetailModal';
import AlignmentDetailModal from './AlignmentDetailModal';
import { COURSES, normalizeProgram, normalizeBatchYear } from '../lib/normalization';

// --- Configuration ---
// Glassmorphism Palette (Vibrant for charts to pop against glass)
const ALIGNMENT_COLORS = ['#6366f1', '#a855f7']; // Indigo, Purple
const JOB_LEVEL_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444']; // Blue, Purple, Pink, Emerald, Amber, Red
const TYPE_COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#64748b', '#8b5cf6']; // Sky, Green, Yellow, Orange, Slate, Violet

// --- Types ---
interface AnalyticsState {
  totalRespondents: number;
  employedCount: number;
  unemployedCount: number;
  selfEmployedCount: number;
  retiredCount: number;
  industryData: { name: string; value: number }[];
  unemploymentReasonData: { name: string; value: number }[];
  alignmentReasonData: { name: string; value: number }[];
  retirementReasonData: { name: string; value: number }[];
  jobLevelData: { name: string; value: number }[];
  employmentTypeData: { name: string; value: number }[]; // Added
  alignmentRate: { name: string; value: number }[];
  // Updated to support stacked data
  salaryData: { name: string; salary: number; revenue: number }[];
  
  // New Analytics Types
  programStats: ProgramStat[];
  trendData: TrendStat[];
  universityAvgEmploymentRate: number;
  universityAvgTimeToJob: number;

  // Quality Metrics
  qualityScore: number;
  fullTimeCount: number;
  highSalaryCount: number; // > 20k
  professionalLevelCount: number; // > Rank and File
  alignedCount: number;
}

interface ProgramStat {
    program: string;
    total: number;
    employed: number;
    employmentRate: number;
    avgTimeToJob: number; // in months
    timeToJobCount: number;
}

interface TrendStat {
    year: string;
    employmentRate: number;
    avgTimeToJob: number;
    totalGraduates: number;
}

// Master record type that combines employment info with user profile info
export interface MasterRecord {
    employment_status: string;
    industry?: string;
    unemployed_reasons?: string;
    alignment_reason?: string;
    retirement_reason?: string;
    job_alignment?: string;
    current_job_level?: string;
    current_position?: string;
    company_name?: string;
    business_name?: string;
    
    // Detailed Info for Modal
    company_address?: string;
    business_address?: string;
    date_hired?: string;
    business_duration?: string;
    business_type?: string;
    business_contact_no?: string;
    date_retired?: string;
    last_company?: string;

    // Added fields
    employment_type?: string;
    salary_range?: string;
    business_revenue?: string;

    // Profile Data
    user_id: string;
    full_name: string;
    program: string;
    year_level: string; // Batch
}

// Helper Component for Interpretation - Professional Insight Card Style (Refined)
const InterpretationBlock = ({ text, loading }: { text?: string, loading: boolean }) => (
    <div className="mt-auto pt-4 border-t border-indigo-50/50">
        <div className="p-4 bg-gradient-to-br from-indigo-50/90 to-purple-50/90 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden group">
            <div className="flex gap-3 items-start">
                <div className="mt-0.5 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm ring-1 ring-indigo-100">
                        <Lightbulb size={16} />
                    </div>
                </div>
                <div className="flex flex-col relative z-10 flex-1 min-w-0">
                    <h5 className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest mt-1.5 mb-1">
                       System Interpretation
                    </h5>
                    {loading ? (
                        <div className="space-y-2 animate-pulse mt-1">
                            <div className="h-2 bg-indigo-200/50 rounded w-full max-w-[12rem]"></div>
                            <div className="h-2 bg-indigo-200/50 rounded w-full max-w-[18rem]"></div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-700 font-medium leading-relaxed block">
                            {text || "Data insufficient for analysis, or Auto-Interpretation is disabled."}
                        </p>
                    )}
                </div>
            </div>
        </div>
    </div>
);

// --- Custom Dropdown Component ---
const CustomDropdown = ({ 
    options, 
    value, 
    onChange, 
    label 
}: { 
    options: string[], 
    value: string, 
    onChange: (val: string) => void, 
    label: string 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full pl-4 pr-10 py-3 text-left bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 hover:border-blue-300 transition-all flex items-center justify-between"
            >
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</span>
                    <span className="text-sm font-bold text-slate-700 truncate block max-w-[140px] xl:max-w-xs">{value}</span>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <ul className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                        <li 
                            onClick={() => { onChange(label === "Batch" ? "All" : "All"); setIsOpen(false); }}
                            className={`px-3 py-2 rounded-lg text-sm font-bold cursor-pointer flex items-center justify-between ${value === 'All' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <span>All {label === "Batch" ? "Batches" : "Programs"}</span>
                            {value === 'All' && <Check size={14} />}
                        </li>
                        {options.map((opt) => (
                            <li 
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false); }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer flex items-center justify-between ${value === opt ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <span className="truncate pr-2">{opt}</span>
                                {value === opt && <Check size={14} className="shrink-0" />}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

interface HomePageProps {
    adminId?: string;
}

const HomePage: React.FC<HomePageProps> = ({ adminId }) => {
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState<MasterRecord[]>([]);
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'employment' | 'education' | 'community' | 'skills'>('employment');

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedCourse, setSelectedCourse] = useState<string>('All');
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  // Modal State
  const [selectedStatusDetail, setSelectedStatusDetail] = useState<string | null>(null);
  const [showAlignmentModal, setShowAlignmentModal] = useState(false);

  // AI Insights State
  const [interpretations, setInterpretations] = useState<CardInterpretations | null>(null);
  const [qualityAnalysis, setQualityAnalysis] = useState<QualityAnalysis | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [isAutoAIEnabled, setIsAutoAIEnabled] = useState(false);

  // Analytics State (Derived)
  const [analytics, setAnalytics] = useState<AnalyticsState>({
    totalRespondents: 0,
    employedCount: 0,
    unemployedCount: 0,
    selfEmployedCount: 0,
    retiredCount: 0,
    industryData: [],
    unemploymentReasonData: [],
    alignmentReasonData: [],
    retirementReasonData: [],
    jobLevelData: [],
    employmentTypeData: [],
    alignmentRate: [],
    salaryData: [],
    programStats: [],
    trendData: [],
    universityAvgEmploymentRate: 0,
    universityAvgTimeToJob: 0,
    qualityScore: 0,
    fullTimeCount: 0,
    highSalaryCount: 0,
    professionalLevelCount: 0,
    alignedCount: 0
  });

  // Fetch AI Toggle Preference
  useEffect(() => {
      const fetchToggle = async () => {
          if (!adminId) return;
          const { data, error } = await supabase
              .from('admins')
              .select('toggle')
              .eq('id', adminId)
              .single();
          
          if (!error && data) {
              setIsAutoAIEnabled(data.toggle === 'on');
          }
      };
      fetchToggle();
  }, [adminId]);

  const handleToggleAI = async () => {
      const newState = !isAutoAIEnabled;
      setIsAutoAIEnabled(newState);
      if (adminId) {
          await supabase
            .from('admins')
            .update({ toggle: newState ? 'on' : 'off' })
            .eq('id', adminId);
      }
  };

  // --- 1. Data Fetching (Joins Employment with User Profile) ---
  const fetchData = async () => {
      setLoading(true);
      try {
        const { data: empData, error: empError } = await supabase
            .from('employment_information')
            .select('*');
        
        if (empError) throw empError;
        if (!empData) return;

        const surveyIds = empData.map(e => e.survey_response_id);
        const { data: surveyData, error: surveyError } = await supabase
            .from('survey_responses')
            .select('id, student_id, alumni_id, respondent_type')
            .in('id', surveyIds);

        if (surveyError) throw surveyError;

        const [ { data: students }, { data: alumni } ] = await Promise.all([
            supabase.from('students').select('id, first_name, last_name, program, year_level'),
            supabase.from('alumni').select('id, first_name, last_name, program, year_level')
        ]);

        const studentMap = new Map(students?.map((s: any) => [s.id, s]));
        const alumniMap = new Map(alumni?.map((a: any) => [a.id, a]));
        const surveyMap = new Map(surveyData?.map((s: any) => [s.id, s]));

        const combined: MasterRecord[] = [];
        
        empData.forEach(record => {
            const survey = surveyMap.get(record.survey_response_id) as any;
            if (!survey) return;

            let userProfile: any = null;
            if (survey.respondent_type === 'student') {
                userProfile = studentMap.get(survey.student_id);
            } else {
                userProfile = alumniMap.get(survey.alumni_id);
            }

            if (userProfile) {
                const year = normalizeBatchYear(userProfile.year_level);
                const fullName = `${userProfile.last_name}, ${userProfile.first_name}`;

                combined.push({
                    employment_status: record.employment_status,
                    industry: record.industry,
                    unemployed_reasons: record.unemployed_reasons,
                    alignment_reason: record.alignment_reason,
                    retirement_reason: record.retirement_reason,
                    job_alignment: record.job_alignment,
                    current_job_level: record.current_job_level,
                    current_position: record.current_position,
                    company_name: record.company_name,
                    business_name: record.business_name,
                    company_address: record.company_address,
                    business_address: record.business_address,
                    date_hired: record.date_hired,
                    business_duration: record.business_duration,
                    business_type: record.business_type,
                    business_contact_no: record.business_contact_no,
                    date_retired: record.date_retired,
                    last_company: record.last_company,
                    // New Fields
                    employment_type: record.employment_type,
                    salary_range: record.salary_range,
                    business_revenue: record.business_revenue,
                    // Profile
                    user_id: `${survey.respondent_type}-${userProfile.id}`,
                    full_name: fullName,
                    program: normalizeProgram(userProfile.program),
                    year_level: year
                });
            }
        });

        const staticYears = [];
        for (let y = 2026; y >= 2006; y--) {
            staticYears.push(y.toString());
        }
        setAvailableYears(staticYears);
        
        setMasterData(combined);

      } catch (err) {
          console.error("Data fetch error:", err);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 2. Filter Logic & Calculation ---
  useEffect(() => {
    const filtered = masterData.filter(record => {
        const matchesYear = selectedYear === 'All' || record.year_level === selectedYear;
        const matchesCourse = selectedCourse === 'All' || record.program === selectedCourse;
        return matchesYear && matchesCourse;
    });

    const total = filtered.length;
    let employedCountTotal = 0;
    
    // Aggregation Maps
    const industryMap: Record<string, number> = {};
    const unempReasonMap: Record<string, number> = {};
    const misalignMap: Record<string, number> = {};
    const retireMap: Record<string, number> = {};
    const jobLevelMap: Record<string, number> = {};
    const employmentTypeMap: Record<string, number> = {};
    const financialStatsMap: Record<string, { salary: number, revenue: number }> = {};
    
    let relatedCount = 0;
    let nonRelatedCount = 0;
    
    // Quality Metrics Counters
    let fullTimeCount = 0;
    let highSalaryCount = 0; // Above 20k
    let professionalLevelCount = 0; // Above Entry/Rank

    // Program Stats Accumulators
    const programAccumulator: Record<string, { total: number, employed: number, timeToJobSum: number, timeToJobCount: number }> = {};
    
    // Trend Accumulator (Global or Filtered by Course ONLY)
    const trendAccumulator: Record<string, { total: number, employed: number, timeToJobSum: number, timeToJobCount: number }> = {};

    let totalTimeToJobSum = 0;
    let totalTimeToJobCount = 0;

    // 1. Loop through FILTERED data for current Dashboard cards
    filtered.forEach(r => {
        const isEmployed = r.employment_status === 'Employed' || r.employment_status === 'Self-employed';
        if (isEmployed) employedCountTotal++;

        if (r.industry) industryMap[r.industry] = (industryMap[r.industry] || 0) + 1;
        if (r.unemployed_reasons) unempReasonMap[r.unemployed_reasons] = (unempReasonMap[r.unemployed_reasons] || 0) + 1;
        if (r.alignment_reason) misalignMap[r.alignment_reason] = (misalignMap[r.alignment_reason] || 0) + 1;
        if (r.retirement_reason) retireMap[r.retirement_reason] = (retireMap[r.retirement_reason] || 0) + 1;
        if (r.current_job_level && r.current_job_level !== 'N/A') {
             jobLevelMap[r.current_job_level] = (jobLevelMap[r.current_job_level] || 0) + 1;
        }
        if (r.employment_type && r.employment_type !== 'N/A') {
             employmentTypeMap[r.employment_type] = (employmentTypeMap[r.employment_type] || 0) + 1;
        }
        if (r.job_alignment === 'Related') relatedCount++;
        if (r.job_alignment === 'Non-Related') nonRelatedCount++;

        // Financial Data Aggregation
        if (isEmployed) {
            const incomeRange = r.salary_range || r.business_revenue;
            if (incomeRange) {
                if (!financialStatsMap[incomeRange]) {
                    financialStatsMap[incomeRange] = { salary: 0, revenue: 0 };
                }
                
                if (r.employment_status === 'Employed') {
                     financialStatsMap[incomeRange].salary++;
                } else if (r.employment_status === 'Self-employed') {
                     financialStatsMap[incomeRange].revenue++;
                }
            }
        }

        // --- Quality Logic ---
        if (isEmployed) {
            // Full Time
            if (r.employment_type === 'Full-Time' || r.employment_status === 'Self-employed') fullTimeCount++;
            
            // High Salary (Above 20k)
            const lowSalaries = ['Below ₱15,000', '₱15,000 – ₱20,000', 'Below ₱10,000', '₱10,000 – ₱50,000'];
            const salary = r.salary_range || r.business_revenue;
            if (salary && !lowSalaries.includes(salary)) {
                highSalaryCount++;
            } else if (r.salary_range === '₱10,000 – ₱50,000') {
               // Self employed range overlap check
               if(r.employment_status === 'Self-employed') highSalaryCount++;
            }

            // Professional Level (Not Entry/Intern/Rank)
            const lowLevels = ['Intern', 'Trainee', 'Entry-Level', 'Rank and File'];
            if (r.current_job_level && !lowLevels.includes(r.current_job_level)) {
                professionalLevelCount++;
            }
        }

        // Program Stats Calculation
        const prog = r.program || 'Unknown';
        if (!programAccumulator[prog]) {
            programAccumulator[prog] = { total: 0, employed: 0, timeToJobSum: 0, timeToJobCount: 0 };
        }
        programAccumulator[prog].total++;
        if (isEmployed) {
            programAccumulator[prog].employed++;
            
            // Calculate Time to Job
            if (r.year_level && r.date_hired && !isNaN(parseInt(r.year_level))) {
                const gradYear = parseInt(r.year_level);
                const gradDate = new Date(gradYear, 5, 1); 
                const hiredDate = new Date(r.date_hired);
                
                if (hiredDate instanceof Date && !isNaN(hiredDate.getTime())) {
                     const diffMonths = (hiredDate.getFullYear() - gradDate.getFullYear()) * 12 + (hiredDate.getMonth() - gradDate.getMonth());
                     if (diffMonths > -24 && diffMonths < 120) {
                         const months = Math.max(0, diffMonths);
                         programAccumulator[prog].timeToJobSum += months;
                         programAccumulator[prog].timeToJobCount++;
                         totalTimeToJobSum += months;
                         totalTimeToJobCount++;
                     }
                }
            }
        }
    });

    // 2. Loop for TRENDS
    const trendSource = masterData.filter(record => selectedCourse === 'All' || record.program === selectedCourse);
    trendSource.forEach(r => {
        const year = r.year_level || 'Unknown';
        if (year === 'Unknown' || isNaN(Number(year))) return;
        if (!trendAccumulator[year]) trendAccumulator[year] = { total: 0, employed: 0, timeToJobSum: 0, timeToJobCount: 0 };
        trendAccumulator[year].total++;
        const isEmployed = r.employment_status === 'Employed' || r.employment_status === 'Self-employed';
        if (isEmployed) {
            trendAccumulator[year].employed++;
            if (r.date_hired) {
                const gradYear = parseInt(year);
                const gradDate = new Date(gradYear, 5, 1); 
                const hiredDate = new Date(r.date_hired);
                if (hiredDate instanceof Date && !isNaN(hiredDate.getTime())) {
                     const diffMonths = (hiredDate.getFullYear() - gradDate.getFullYear()) * 12 + (hiredDate.getMonth() - gradDate.getMonth());
                     if (diffMonths > -24 && diffMonths < 120) {
                         const months = Math.max(0, diffMonths);
                         trendAccumulator[year].timeToJobSum += months;
                         trendAccumulator[year].timeToJobCount++;
                     }
                }
            }
        }
    });

    const programStatsArray: ProgramStat[] = Object.entries(programAccumulator).map(([program, stats]) => ({
        program,
        total: stats.total,
        employed: stats.employed,
        employmentRate: stats.total > 0 ? (stats.employed / stats.total) * 100 : 0,
        avgTimeToJob: stats.timeToJobCount > 0 ? Math.round((stats.timeToJobSum / stats.timeToJobCount) * 10) / 10 : 0,
        timeToJobCount: stats.timeToJobCount
    }));

    const trendStatsArray: TrendStat[] = Object.entries(trendAccumulator)
        .map(([year, stats]) => ({
            year,
            totalGraduates: stats.total,
            employmentRate: stats.total > 0 ? Math.round((stats.employed / stats.total) * 100) : 0,
            avgTimeToJob: stats.timeToJobCount > 0 ? Math.round((stats.timeToJobSum / stats.timeToJobCount) * 10) / 10 : 0
        }))
        .sort((a, b) => parseInt(a.year) - parseInt(b.year));

    const uniAvgRate = total > 0 ? (employedCountTotal / total) * 100 : 0;
    const uniAvgTime = totalTimeToJobCount > 0 ? Math.round((totalTimeToJobSum / totalTimeToJobCount) * 10) / 10 : 0;

    const employed = filtered.filter(r => r.employment_status === 'Employed').length;
    const selfEmployed = filtered.filter(r => r.employment_status === 'Self-employed').length;
    const unemployed = filtered.filter(r => r.employment_status === 'Unemployed').length;
    const retired = filtered.filter(r => r.employment_status === 'Retired').length;

    const formatChartData = (map: Record<string, number>, topN = 5) => 
        Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, topN);

    // Format Salary Data (Sort by logical value)
    const salaryOrder = [
        "Below ₱10,000", "Below ₱15,000", 
        "₱10,000 – ₱50,000", "₱15,000 – ₱20,000",
        "₱20,001 – ₱30,000", "₱30,001 – ₱50,000", "₱50,001 – ₱100,000", 
        "₱100,001 – ₱500,000", "₱500,001 – ₱1,000,000", 
        "Above ₱50,000", "Above ₱1,000,000"
    ];
    
    const salaryDataArray = Object.entries(financialStatsMap)
        .map(([name, stats]) => ({ name, salary: stats.salary, revenue: stats.revenue }))
        .sort((a, b) => {
            const idxA = salaryOrder.indexOf(a.name);
            const idxB = salaryOrder.indexOf(b.name);
            // If found in custom order, use it, else push to end
            return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
        });

    // --- Quality Score Calculation (Weighted) ---
    const safeDiv = (n: number, d: number) => d === 0 ? 0 : n / d;
    
    const empRate = safeDiv(employedCountTotal, total);
    const alignRate = safeDiv(relatedCount, employedCountTotal);
    const fullTimeRate = safeDiv(fullTimeCount, employedCountTotal);
    const highSalRate = safeDiv(highSalaryCount, employedCountTotal);
    const proLevelRate = safeDiv(professionalLevelCount, employedCountTotal);

    let qualityScore = 0;
    if (employedCountTotal > 0) {
        qualityScore = Math.round(
            (empRate * 30) + 
            (alignRate * 25) + 
            (fullTimeRate * 20) + 
            (highSalRate * 15) + 
            (proLevelRate * 10)
        );
    }

    const calculatedAnalytics = {
        totalRespondents: total,
        employedCount: employed,
        selfEmployedCount: selfEmployed,
        unemployedCount: unemployed,
        retiredCount: retired,
        industryData: formatChartData(industryMap),
        unemploymentReasonData: formatChartData(unempReasonMap),
        alignmentReasonData: formatChartData(misalignMap),
        retirementReasonData: formatChartData(retireMap),
        jobLevelData: formatChartData(jobLevelMap, 10), 
        employmentTypeData: formatChartData(employmentTypeMap, 10),
        salaryData: salaryDataArray,
        alignmentRate: [
            { name: 'Related', value: relatedCount },
            { name: 'Non-Related', value: nonRelatedCount }
        ],
        programStats: programStatsArray,
        trendData: trendStatsArray,
        universityAvgEmploymentRate: uniAvgRate,
        universityAvgTimeToJob: uniAvgTime,
        qualityScore,
        fullTimeCount,
        highSalaryCount,
        professionalLevelCount,
        alignedCount: relatedCount
    };

    setAnalytics(calculatedAnalytics);

    if (total > 0 && activeTab === 'employment' && isAutoAIEnabled) {
        const fetchInsights = async () => {
            setLoadingInsights(true);
            const context = {
                year: selectedYear === 'All' ? 'All' : selectedYear,
                course: selectedCourse === 'All' ? 'All' : selectedCourse
            };
            const data = await generateCardInterpretations(calculatedAnalytics, context);
            if (data) {
                const combinedAlignment = `${data.alignment} ${data.misalignment}`;
                setInterpretations({ ...data, alignment: combinedAlignment });
            }

            // Calculate verdict locally to ensure consistency with gauge visual
            let calculatedVerdict = "Low Quality";
            if (qualityScore >= 66) calculatedVerdict = "High Quality";
            else if (qualityScore >= 33) calculatedVerdict = "Moderate Quality";

            const qualityData = await generateQualityAnalysis({
                score: qualityScore,
                fullTimePercentage: Math.round(fullTimeRate * 100),
                alignedPercentage: Math.round(alignRate * 100),
                salaryQualityPercentage: Math.round(highSalRate * 100),
                jobLevelQualityPercentage: Math.round(proLevelRate * 100),
                calculatedVerdict: calculatedVerdict // Pass this to AI context
            });
            
            // Override with calculated verdict to ensure UI match
            setQualityAnalysis({ ...qualityData, verdict: calculatedVerdict });

            setLoadingInsights(false);
        };
        fetchInsights();
    } else {
        // Clear interpretations if toggled off
        if (!isAutoAIEnabled) {
            setInterpretations(null);
            setQualityAnalysis(null);
        }
    }

  }, [masterData, selectedYear, selectedCourse, activeTab, isAutoAIEnabled]);

  // ... (rest of the component rendering)

  const modalData = useMemo(() => {
    if (!selectedStatusDetail) return [];
    return masterData.filter(record => {
        // Handle "Self-Employed" vs "Self-employed" difference in state vs DB
        const dbStatus = selectedStatusDetail === 'Self-Employed' ? 'Self-employed' : selectedStatusDetail;
        
        let matchesStatus = false;
        if (selectedStatusDetail === 'Misaligned') {
            matchesStatus = record.job_alignment === 'Non-Related' && (record.employment_status === 'Employed' || record.employment_status === 'Self-employed');
        } else {
            matchesStatus = record.employment_status === dbStatus;
        }

        const matchesYear = selectedYear === 'All' || record.year_level === selectedYear;
        const matchesCourse = selectedCourse === 'All' || record.program === selectedCourse;
        return matchesStatus && matchesYear && matchesCourse;
    });
  }, [selectedStatusDetail, masterData, selectedYear, selectedCourse]);

  const getPercent = (count: number) => {
      if (analytics.totalRespondents === 0) return 0;
      return Math.round((count / analytics.totalRespondents) * 100);
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6; 
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
  
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-black drop-shadow-md pointer-events-none">
        {percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} 
      </text>
    );
  };

  // Needle for Gauge
  const Needle = ({ value, cx, cy, iR, oR, color }: any) => {
    const total = 100;
    const ang = 180.0 * (1 - value / total);
    const length = (iR + 2 * oR) / 3;
    const sin = Math.sin(-RADIAN * ang);
    const cos = Math.cos(-RADIAN * ang);
    const r = 5;
    const x0 = cx + 5;
    const y0 = cy + 5;
    const xba = x0 + r * sin;
    const yba = y0 - r * cos;
    const xbb = x0 - r * sin;
    const ybb = y0 + r * cos;
    const xp = x0 + length * cos;
    const yp = y0 + length * sin;
  
    return (
      <g>
        <circle cx={x0} cy={y0} r={r} fill={color} stroke="none" />
        <path d={`M${xba} ${yba}L${xbb} ${ybb}L${xp} ${yp}L${xba} ${yba}`} stroke="#none" fill={color} />
      </g>
    );
  };
  const RADIAN = Math.PI / 180;

  // Glass List Card
  const ReasonListCard = ({ 
    title, 
    icon: Icon, 
    data, 
    colorClass, 
    barColorClass, 
    interpretation,
    embedded = false
  }: { 
    title: string, 
    icon: any, 
    data: { name: string, value: number }[],
    colorClass: string,
    barColorClass: string,
    interpretation?: string,
    embedded?: boolean
  }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <div className={`flex flex-col h-full hover:bg-white/60 transition-all duration-300 ${!embedded ? 'bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 rounded-2xl' : 'bg-transparent'}`}>
            <div className={`${embedded ? 'p-0' : 'p-6 flex-grow'}`}>
                {title && (
                    <div className={`flex items-center gap-3 mb-4 pb-2 ${!embedded ? 'border-b border-white/30' : ''}`}>
                        <div className={`p-2 rounded-xl bg-white/60 shadow-sm ${embedded ? 'text-purple-600' : 'text-indigo-600'}`}>
                            <Icon size={20}/>
                        </div>
                        <h4 className="font-bold text-slate-800">{title}</h4>
                    </div>
                )}
                
                <div className="space-y-4 mb-2">
                    {data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                            <AlertCircle size={24} className="mb-2 opacity-50" />
                            <p className="text-xs font-bold uppercase tracking-wider">No data</p>
                        </div>
                    ) : (
                        data.map((item, index) => (
                            <div key={index} className="group">
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-[10px] font-bold text-slate-500 bg-white/60 px-2 py-0.5 rounded-md min-w-[24px] text-center mr-3 shadow-sm border ${embedded ? 'border-purple-100' : 'border-white/40'}`}>#{index + 1}</span>
                                    <span className="text-sm font-semibold text-slate-700 flex-grow truncate mr-4" title={item.name}>
                                        {item.name}
                                    </span>
                                    <span className="text-sm font-bold text-slate-900">{item.value}</span>
                                </div>
                                <div className={`w-full bg-white/40 rounded-full h-1.5 overflow-hidden ${embedded ? 'bg-purple-100' : ''}`}>
                                    <div 
                                        className={`h-full rounded-full ${embedded ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`} 
                                        style={{ width: `${(item.value / maxValue) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            {!embedded && (
                <div className="px-6 pb-6">
                    <InterpretationBlock text={interpretation} loading={loadingInsights} />
                </div>
            )}
        </div>
    );
  };

  return (
    <>
    <div className="space-y-8 animate-fade-in pb-10 relative">
        <style>
          {`
            @media print {
              body * { visibility: hidden; }
              #printable-modal, #printable-modal * { visibility: visible; }
              #printable-modal { position: fixed; left: 0; top: 0; width: 100%; height: 100%; background: white; z-index: 9999; padding: 0; margin: 0; }
              .no-print { display: none !important; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; font-size: 10px; color: black; }
              thead { background-color: #eee; -webkit-print-color-adjust: exact; }
            }
          `}
        </style>
        
        {/* --- Header & Filter Section (Glass) --- */}
        <div className="relative z-40 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-lg shadow-indigo-500/5">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Analytics Overview</h2>
                <p className="text-slate-500 mt-1">Real-time data visualization.</p>
            </div>
            
            {/* Filter Bar with Custom Dropdowns */}
            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto z-50">
                <div className="w-full sm:w-40">
                    <CustomDropdown 
                        label="Batch"
                        options={availableYears}
                        value={selectedYear}
                        onChange={setSelectedYear}
                    />
                </div>
                <div className="w-full sm:w-80">
                    <CustomDropdown 
                        label="Program"
                        options={COURSES}
                        value={selectedCourse}
                        onChange={setSelectedCourse}
                    />
                </div>
            </div>
        </div>

        {/* --- NAVIGATION TABS + TOGGLE --- */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pb-2 border-b border-white/30">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide w-full md:w-auto">
                {[
                    { id: 'employment', label: 'Employment', icon: Briefcase },
                    { id: 'education', label: 'Education', icon: BookOpen },
                    { id: 'community', label: 'Community', icon: Heart },
                    { id: 'skills', label: 'Skills', icon: Award },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
                            activeTab === tab.id 
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105' 
                            : 'bg-white/40 text-slate-500 hover:bg-white/60 hover:text-slate-800 border border-white/50'
                        }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Auto-Interpretation Toggle (Moved to far right) */}
            <div className="flex items-center gap-3 bg-white/40 px-4 py-2 rounded-2xl border border-white/50 shadow-sm backdrop-blur-sm">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Auto Interpretation</span>
                 <button onClick={handleToggleAI} className="transition-transform active:scale-95 text-indigo-600 hover:text-indigo-700" title={isAutoAIEnabled ? "Disable Auto Interpretation" : "Enable Auto Interpretation"}>
                     {isAutoAIEnabled ? <ToggleRight className="w-8 h-8"/> : <ToggleLeft className="text-slate-400 w-8 h-8"/>}
                 </button>
            </div>
        </div>

        {/* === 1. EMPLOYMENT TAB CONTENT === */}
        {activeTab === 'employment' && (
        <>
            {/* KEY CARDS - CLICKABLE GLASS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Employed', count: analytics.employedCount, icon: Briefcase, color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/30' },
                    { label: 'Unemployed', count: analytics.unemployedCount, icon: AlertCircle, color: 'from-pink-500 to-rose-500', shadow: 'shadow-rose-500/30' },
                    { label: 'Self-Employed', count: analytics.selfEmployedCount, icon: Building2, color: 'from-purple-500 to-indigo-500', shadow: 'shadow-purple-500/30' },
                    { label: 'Retired', count: analytics.retiredCount, icon: UserCheck, color: 'from-slate-500 to-slate-600', shadow: 'shadow-slate-500/30' },
                ].map((item, idx) => (
                    <div 
                        key={idx}
                        onClick={() => setSelectedStatusDetail(item.label)}
                        className={`bg-gradient-to-br ${item.color} p-6 rounded-3xl shadow-xl ${item.shadow} hover:scale-[1.02] transition-all cursor-pointer relative group overflow-hidden border border-white/20`}
                    >
                        {/* Glass Reflection */}
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-2xl"></div>

                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm text-white">
                                <item.icon size={24} />
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-white/20 backdrop-blur-sm font-bold text-xs text-white">
                                {item.count}
                            </span>
                        </div>
                        <h3 className="text-5xl font-bold mb-1 text-white">{getPercent(item.count)}%</h3>
                        <p className="text-sm font-bold uppercase tracking-wider text-white/80">{item.label}</p>
                        
                        <TrendingUp className="absolute bottom-6 right-6 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
                    </div>
                ))}
            </div>

            {/* EMPLOYMENT QUALITY METER & JOURNEY */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-6 rounded-3xl flex flex-col">
                <div className="flex flex-col lg:flex-row gap-8 mb-4">
                    {/* Left Column: Gauge & Info */}
                    <div className="flex-1 flex flex-col relative min-h-[300px] border-r border-indigo-50/50 pr-8">
                        <div className="flex items-start gap-3 mb-2">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shadow-sm"><Gauge size={20}/></div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-lg leading-tight">Employment Quality Score</h4>
                                <p className="text-[10px] text-slate-500 font-medium mt-1">Metric based on Alignment, Salary, Job Level, & Status</p>
                            </div>
                        </div>
                        <div className="flex justify-center w-full mb-1 mt-10 relative z-20">
                            <div className="flex gap-4 text-[10px] font-bold uppercase text-slate-500 bg-white/50 px-4 py-2 rounded-full border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div>Low</div>
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Moderate</div>
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>High Quality</div>
                            </div>
                        </div>
                        <div className="flex-grow flex flex-col items-center justify-start relative"> 
                            <div className="relative w-[300px] h-[160px] z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            dataKey="value"
                                            startAngle={180}
                                            endAngle={0}
                                            data={[{ value: 33, color: '#ef4444' }, { value: 33, color: '#f59e0b' }, { value: 34, color: '#10b981' }]}
                                            cx={150} cy={150} innerRadius={80} outerRadius={120} stroke="none"
                                        >
                                            {[{ value: 33, color: '#ef4444' }, { value: 33, color: '#f59e0b' }, { value: 34, color: '#10b981' }].map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={() => null} />
                                        {Needle({ value: analytics.qualityScore, cx: 150, cy: 150, iR: 80, oR: 120, color: '#1e293b' })} 
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="text-center mt-2 z-0 relative animate-slide-up">
                                 <span className="text-5xl font-black text-slate-800 tracking-tighter drop-shadow-sm block">{analytics.qualityScore}</span>
                                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">/ 100 Score</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Detailed Breakdown Table */}
                    <div className="flex-1 flex flex-col justify-center">
                        <div className="mb-4">
                             <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Quality Breakdown</h5>
                             <span className={`text-lg font-bold px-4 py-2 rounded-xl border inline-block shadow-sm ${
                                    qualityAnalysis?.verdict === 'High Quality' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                    qualityAnalysis?.verdict === 'Moderate Quality' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                    'bg-red-50 text-red-600 border-red-200'
                                }`}>
                                    {qualityAnalysis?.verdict || "Pending Analysis..."}
                            </span>
                        </div>

                        <div className="bg-white/60 rounded-xl border border-white/50 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/50 text-slate-500 font-bold text-[10px] uppercase border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3">Metric Factor</th>
                                        <th className="px-4 py-3 text-right">Count</th>
                                        <th className="px-4 py-3 text-right">Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    <tr className="hover:bg-white/80 transition-colors">
                                        <td className="px-4 py-4 font-medium text-slate-700 flex items-center gap-2 text-base">
                                            <Briefcase size={16} className="text-blue-500"/> Job Stability (Full-Time)
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold text-slate-600">{analytics.fullTimeCount}</td>
                                        <td className="px-4 py-4 text-right font-bold text-blue-600">{analytics.employedCount > 0 ? Math.round((analytics.fullTimeCount / analytics.employedCount) * 100) : 0}%</td>
                                    </tr>
                                    <tr className="hover:bg-white/80 transition-colors">
                                        <td className="px-4 py-4 font-medium text-slate-700 flex items-center gap-2 text-base">
                                            <Target size={16} className="text-emerald-500"/> Program Alignment
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold text-slate-600">{analytics.alignedCount}</td>
                                        <td className="px-4 py-4 text-right font-bold text-emerald-600">{analytics.employedCount > 0 ? Math.round((analytics.alignedCount / analytics.employedCount) * 100) : 0}%</td>
                                    </tr>
                                    <tr className="hover:bg-white/80 transition-colors">
                                        <td className="px-4 py-4 font-medium text-slate-700 flex items-center gap-2 text-base">
                                            <DollarSign size={16} className="text-amber-500"/> Income Quality ({'>'}20k)
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold text-slate-600">{analytics.highSalaryCount}</td>
                                        <td className="px-4 py-4 text-right font-bold text-amber-600">{analytics.employedCount > 0 ? Math.round((analytics.highSalaryCount / analytics.employedCount) * 100) : 0}%</td>
                                    </tr>
                                    <tr className="hover:bg-white/80 transition-colors">
                                        <td className="px-4 py-4 font-medium text-slate-700 flex items-center gap-2 text-base">
                                            <Award size={16} className="text-purple-500"/> Professional Level
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold text-slate-600">{analytics.professionalLevelCount}</td>
                                        <td className="px-4 py-4 text-right font-bold text-purple-600">{analytics.employedCount > 0 ? Math.round((analytics.professionalLevelCount / analytics.employedCount) * 100) : 0}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <InterpretationBlock text={qualityAnalysis?.qualityInterpretation} loading={loadingInsights} />
            </div>

            {/* EMPLOYMENT JOURNEY SECTION (3 Columns) */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-8">
                     <div className="p-2 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200"><Timer size={20}/></div>
                     <div>
                         <h3 className="text-xl font-bold text-slate-800">Employment Journey</h3>
                         <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Time-to-Hire, Type & Level</p>
                     </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* COL 1: Time to First Job */}
                    <div className="bg-white/50 rounded-2xl p-6 border border-white/60 flex flex-col h-full">
                         <div className="flex justify-between items-start mb-6">
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Time-to-Hire</h4>
                                <p className="text-[10px] text-slate-500">Months to first job</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-2xl font-black text-indigo-600">{analytics.universityAvgTimeToJob} mo</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Avg</span>
                            </div>
                         </div>
                         
                         <div className="flex-grow min-h-[250px] w-full overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                            {analytics.programStats.filter(p => p.timeToJobCount > 0).length === 0 ? (
                                <div className="text-center text-slate-400 py-12">
                                    <Clock className="mx-auto mb-2 opacity-50"/>
                                    <p className="text-xs font-bold">No data available</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {analytics.programStats
                                        .filter(p => p.timeToJobCount > 0)
                                        .sort((a,b) => a.avgTimeToJob - b.avgTimeToJob)
                                        .map((stat, idx) => {
                                            const maxTime = Math.max(...analytics.programStats.map(p => p.avgTimeToJob), 12); 
                                            const percentage = Math.min((stat.avgTimeToJob / maxTime) * 100, 100);
                                            const isFaster = stat.avgTimeToJob <= analytics.universityAvgTimeToJob;
                                            
                                            return (
                                                <div key={idx} className="group">
                                                    <div className="flex justify-between items-end mb-1.5">
                                                        <span className="text-[11px] font-bold text-slate-700 leading-tight max-w-[80%]">
                                                            {stat.program}
                                                        </span>
                                                        <span className={`text-xs font-black ${isFaster ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                                            {stat.avgTimeToJob} mo
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ${isFaster ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                                            style={{ width: `${Math.max(percentage, 5)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            )}
                         </div>
                    </div>

                    {/* COL 2: Employment Type (NEW) */}
                    <div className="bg-white/50 rounded-2xl p-6 border border-white/60 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-sky-100 text-sky-600 rounded-lg"><Clock size={16}/></div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Employment Type</h4>
                                <p className="text-[10px] text-slate-500">Contractual Distribution</p>
                            </div>
                        </div>
                        
                        <div className="flex-grow flex items-center justify-center relative min-h-[200px]">
                            {analytics.employmentTypeData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={analytics.employmentTypeData}
                                            cx="50%"
                                            cy="50%" 
                                            innerRadius={0}
                                            outerRadius={80}
                                            dataKey="value"
                                            label={renderCustomizedLabel}
                                            labelLine={false}
                                        >
                                            {analytics.employmentTypeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} stroke="white" strokeWidth={2} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(255, 255, 255, 0.9)' }} />
                                        <Legend 
                                            verticalAlign="bottom" 
                                            height={36} 
                                            iconType="circle"
                                            formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-center text-slate-400">
                                    <AlertCircle className="mx-auto mb-2 opacity-50" />
                                    <p className="text-xs font-bold">No Data</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COL 3: Job Level Distribution */}
                    <div className="bg-white/50 rounded-2xl p-6 border border-white/60 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Award size={16}/></div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Job Level</h4>
                                <p className="text-[10px] text-slate-500">Current career standing</p>
                            </div>
                        </div>
                        
                        <div className="flex-grow flex items-center justify-center relative min-h-[250px]">
                            {analytics.jobLevelData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={analytics.jobLevelData}
                                            cx="50%"
                                            cy="50%" 
                                            innerRadius={0}
                                            outerRadius={80}
                                            dataKey="value"
                                            label={renderCustomizedLabel}
                                            labelLine={false}
                                        >
                                            {analytics.jobLevelData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={JOB_LEVEL_COLORS[index % JOB_LEVEL_COLORS.length]} stroke="white" strokeWidth={2} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(255, 255, 255, 0.9)' }} />
                                        <Legend 
                                            verticalAlign="bottom" 
                                            height={36} 
                                            iconType="circle"
                                            formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-center text-slate-400">
                                    <AlertCircle className="mx-auto mb-2 opacity-50" />
                                    <p className="text-xs font-bold">No Data</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <InterpretationBlock text={interpretations?.employmentJourney} loading={loadingInsights} />
            </div>

            {/* PROGRAM TO CAREER ALIGNMENT */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-6 rounded-3xl">
                <div className="flex flex-col lg:flex-row gap-8 mb-4">
                    
                    {/* Left: Alignment Chart */}
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Target size={20}/></div>
                                <h4 className="font-bold text-slate-800 flex-grow">Program to Career Alignment</h4>
                                <button
                                    onClick={() => setShowAlignmentModal(true)}
                                    className="p-1.5 bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                                    title="View Alignment Details"
                                >
                                    <Info size={18} />
                                </button>
                            </div>
                            
                            <div className="flex-grow flex items-center justify-center relative min-h-[250px]">
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={analytics.alignmentRate}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {analytics.alignmentRate.map((entry, index) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    fill={ALIGNMENT_COLORS[index % ALIGNMENT_COLORS.length]} 
                                                    onClick={() => entry.name === 'Non-Related' ? setSelectedStatusDetail('Misaligned') : null}
                                                    style={{ cursor: entry.name === 'Non-Related' ? 'pointer' : 'default' }}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(255, 255, 255, 0.9)' }} />
                                        <Legend 
                                            verticalAlign="bottom" 
                                            height={36} 
                                            iconType="circle"
                                            formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                                    <div className="text-center">
                                        <span className="text-4xl font-bold text-slate-800">
                                            {analytics.alignmentRate.length > 0 
                                                ? Math.round((analytics.alignmentRate[0].value / (analytics.alignmentRate[0].value + analytics.alignmentRate[1].value || 1)) * 100)
                                                : 0}%
                                        </span>
                                        <p className="text-xs text-indigo-500 font-bold uppercase">Aligned</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="hidden lg:block w-px bg-slate-200 my-4"></div>

                    {/* Right: Misalignment Reasons */}
                    <div className="flex-1">
                         {analytics.alignmentRate.find(a => a.name === 'Non-Related' && a.value > 0) ? (
                            <div 
                                className="h-full flex flex-col bg-purple-50/40 rounded-2xl border border-purple-100 p-5 shadow-sm relative overflow-hidden group cursor-pointer hover:bg-purple-100/50 hover:shadow-md transition-all"
                                onClick={() => setSelectedStatusDetail('Misaligned')}
                            >
                                 <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-200/20 rounded-full blur-xl pointer-events-none group-hover:bg-purple-300/30 transition-all"></div>
                                 <div className="flex items-center justify-between gap-3 mb-4 relative z-10 w-full">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white text-purple-600 rounded-xl shadow-sm border border-purple-50"><PieChartIcon size={20}/></div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">Misalignment Reasons</h4>
                                            <p className="text-[10px] text-slate-500 font-medium">Why graduates take non-related jobs</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-white text-purple-600 border border-purple-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        View Alumni
                                    </div>
                                </div>
                                 <div className="flex-grow relative z-10 pointer-events-none">
                                    <ReasonListCard 
                                        title="" 
                                        icon={PieChartIcon}
                                        data={analytics.alignmentReasonData}
                                        colorClass=""
                                        barColorClass=""
                                        embedded={true}
                                    />
                                 </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <CheckCircle2 size={48} className="mb-2"/>
                                <p className="font-bold">100% Alignment Achieved</p>
                            </div>
                        )}
                    </div>
                </div>
                <InterpretationBlock text={interpretations?.alignment} loading={loadingInsights} />
            </div>

            {/* UNEMPLOYMENT & RETIREMENT (Moved here per request) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ReasonListCard 
                    title="Unemployment Reasons" 
                    icon={AlertCircle}
                    data={analytics.unemploymentReasonData}
                    colorClass="" 
                    barColorClass=""
                    interpretation={interpretations?.unemployment}
                />
                <ReasonListCard 
                    title="Retirement Reasons" 
                    icon={UserCheck}
                    data={analytics.retirementReasonData}
                    colorClass="" 
                    barColorClass="" 
                    interpretation={interpretations?.retirement}
                />
            </div>

            {/* TOP INDUSTRIES */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-6 rounded-3xl flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><BarChart3 size={20}/></div>
                        <h4 className="font-bold text-slate-800">Top 5 Industries</h4>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={analytics.industryData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11, fill: '#475569', fontWeight: 'bold'}} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(255, 255, 255, 0.9)' }} 
                                    cursor={{fill: '#f1f5f9'}} 
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                                    <LabelList dataKey="value" position="right" style={{ fontSize: '11px', fontWeight: 'bold', fill: '#64748b' }} formatter={(val: any) => `${val}`} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <InterpretationBlock text={interpretations?.industry} loading={loadingInsights} />
            </div>

            {/* FINANCIAL DEMOGRAPHICS (Split Charts) */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-6 rounded-3xl">
                <div className="mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><DollarSign size={20}/></div>
                        <div>
                            <h4 className="font-bold text-slate-800">Financial Demographics</h4>
                            <p className="text-xs text-slate-500">Income distribution across employment types</p>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Chart 1: Salary */}
                    <div className="flex flex-col">
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 text-center">Monthly Salary (Employed)</h5>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.salaryData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                    <XAxis dataKey="name" tick={{fontSize: 9, fill: '#64748b'}} interval={0} angle={-30} textAnchor="end" height={60} />
                                    <YAxis hide />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(255, 255, 255, 0.9)' }} 
                                        cursor={{fill: '#f1f5f9'}} 
                                    />
                                    <Bar dataKey="salary" name="Salary" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32}>
                                         <LabelList dataKey="salary" position="top" style={{ fontSize: '10px', fill: '#64748b', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 2: Revenue */}
                    <div className="flex flex-col">
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 text-center">Monthly Revenue (Business)</h5>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.salaryData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                    <XAxis dataKey="name" tick={{fontSize: 9, fill: '#64748b'}} interval={0} angle={-30} textAnchor="end" height={60} />
                                    <YAxis hide />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(255, 255, 255, 0.9)' }} 
                                        cursor={{fill: '#f1f5f9'}} 
                                    />
                                    <Bar dataKey="revenue" name="Revenue" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={32}>
                                        <LabelList dataKey="revenue" position="top" style={{ fontSize: '10px', fill: '#64748b', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
                
                <InterpretationBlock text={interpretations?.salaryTrends} loading={loadingInsights} />
            </div>

        </>
        )}

        {/* === 2. EDUCATION TAB === */}
        {activeTab === 'education' && <EducationAnalytics autoAI={isAutoAIEnabled} />}

        {/* === 3. COMMUNITY TAB === */}
        {activeTab === 'community' && <CommunityAnalytics autoAI={isAutoAIEnabled} />}

        {/* === 4. SKILLS TAB === */}
        {activeTab === 'skills' && <SkillsAnalytics autoAI={isAutoAIEnabled} />}
    </div>

    {/* === SEPARATED MODAL COMPONENT === */}
    {selectedStatusDetail && (
        <StatusDetailModal 
            status={selectedStatusDetail}
            data={modalData}
            yearLabel={selectedYear === 'All' ? 'All Batches' : `Batch ${selectedYear}`}
            courseLabel={selectedCourse === 'All' ? 'All Programs' : 'Selected Program'}
            onClose={() => setSelectedStatusDetail(null)}
        />
    )}

    {showAlignmentModal && (
        <AlignmentDetailModal 
            data={masterData} 
            onClose={() => setShowAlignmentModal(false)} 
            interpretation={interpretations?.alignment} 
        />
    )}
    </>
  );
};

export default HomePage;
