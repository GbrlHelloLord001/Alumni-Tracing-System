import React, { useEffect, useState } from 'react';
import { Heart, Users, Landmark, TrendingUp, Crown, Lightbulb } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { generateCommunityInsights, CommunityInterpretations } from '../services/communityAI';

// --- HELPERS ---

const categorizeOrg = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('sk') || n.includes('sangguniang') || n.includes('barangay') || n.includes('lgu') || n.includes('municipality') || n.includes('city') || n.includes('government')) return 'LGU / Government';
    if (n.includes('church') || n.includes('ministry') || n.includes('parish') || n.includes('religious') || n.includes('christian') || n.includes('catholic')) return 'Religious Group';
    if (n.includes('red cross') || n.includes('rotary') || n.includes('foundation') || n.includes('ngo') || n.includes('volunteer') || n.includes('charity')) return 'NGO / Civic';
    if (n.includes('society') || n.includes('association') || n.includes('chapter') || n.includes('league') || n.includes('council') || n.includes('professional') || n.includes('institute')) return 'Professional Org';
    if (n.includes('alumni') || n.includes('student') || n.includes('university') || n.includes('college') || n.includes('school')) return 'Academic / School';
    return 'Other';
};

// Updated to match the new 4-role standard
const categorizeRole = (role: string): 'Owner' | 'Admin' | 'Volunteer' | 'Member' => {
    const r = role.toLowerCase().trim();
    
    // 1. Exact matches from standardized data
    if (r === 'owner') return 'Owner';
    if (r === 'admin') return 'Admin';
    if (r === 'volunteer') return 'Volunteer';
    if (r === 'member') return 'Member';

    // 2. Heuristic fallbacks for legacy data
    if (r.includes('president') || r.includes('chair') || r.includes('head') || r.includes('founder') || r.includes('captain') || r.includes('governor') || r.includes('mayor') || r.includes('leader')) return 'Owner';
    
    if (r.includes('secretary') || r.includes('treasurer') || r.includes('auditor') || r.includes('officer') || r.includes('manager') || r.includes('coordinator') || r.includes('vp') || r.includes('vice') || r.includes('director') || r.includes('committee') || r.includes('kagawad')) return 'Admin';
    
    if (r.includes('volunteer') || r.includes('participant') || r.includes('helper') || r.includes('donor')) return 'Volunteer';

    return 'Member';
};

// Vibrant Palette
const COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#64748b'  // Slate
];

const ROLE_COLORS: Record<string, string> = { 
    Owner: '#f59e0b',     // Amber/Gold (Leadership)
    Admin: '#3b82f6',     // Blue (Official/Management)
    Volunteer: '#10b981', // Emerald (Active Participation)
    Member: '#94a3b8'     // Slate (General Membership)
};

// Interpretation Component
const InsightCard = ({ text, loading }: { text?: string, loading: boolean }) => (
    <div className="mt-4 p-4 bg-gradient-to-br from-white to-indigo-50/50 rounded-xl border border-indigo-100 flex gap-3 relative overflow-hidden shadow-sm">
        <div className="bg-indigo-100 p-1.5 rounded-lg h-fit text-indigo-600">
            <Lightbulb size={16} />
        </div>
        <div className="relative z-10 w-full">
            <h5 className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest mb-1">System Interpretation</h5>
            {loading ? (
                <div className="space-y-2 animate-pulse">
                    <div className="h-2 bg-indigo-200 rounded w-full"></div>
                    <div className="h-2 bg-indigo-200 rounded w-3/4"></div>
                </div>
            ) : (
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{text || "Insufficient data for analysis."}</p>
            )}
        </div>
    </div>
);

// Custom Label for Pie Chart (Inside Slices)
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
      {percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} 
    </text>
  );
};

interface CommunityAnalyticsProps {
    autoAI?: boolean;
}

const CommunityAnalytics: React.FC<CommunityAnalyticsProps> = ({ autoAI = false }) => {
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [interpretations, setInterpretations] = useState<CommunityInterpretations | null>(null);

  // KPIs
  const [kpi, setKpi] = useState({ totalEngaged: 0, leadershipRate: 0, topSector: 'N/A' });

  // Chart Data States
  const [orgTypeData, setOrgTypeData] = useState<any[]>([]);
  const [topOrgs, setTopOrgs] = useState<any[]>([]);
  const [roleData, setRoleData] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  
  // Cross Section Data (Still needed for AI stats context, even if chart hidden)
  const [aiStats, setAiStats] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

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
          const insights = await generateCommunityInsights(stats);
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
        const [commRes, empRes] = await Promise.all([
            supabase.from('community_engagement').select('*'),
            supabase.from('employment_information').select('*')
        ]);

        const commData = commRes.data || [];
        const empData = empRes.data || [];

        // Map Employment by Survey ID
        const empMap = new Map();
        // Use a more robust mapping: if duplicates exist, we might want the latest, 
        // but sorting by ID desc is a good proxy for "latest added".
        [...empData].sort((a,b) => (a.id > b.id ? 1 : -1)).forEach(e => empMap.set(e.survey_response_id, e));

        // --- PROCESSING ---
        const typeCounts: Record<string, number> = {};
        const nameCounts: Record<string, number> = {};
        const roleCounts: Record<string, number> = { Owner: 0, Admin: 0, Volunteer: 0, Member: 0 };
        const yearCounts: Record<string, number> = {};

        let leadersTotal = 0, leadersManagers = 0;
        let membersTotal = 0, membersManagers = 0;

        // Track highest role per user
        // Rank: Owner (4) > Admin (3) > Volunteer (2) > Member (1)
        const roleRank = { Owner: 4, Admin: 3, Volunteer: 2, Member: 1 };
        const userHighestRole = new Map<string, 'Owner' | 'Admin' | 'Volunteer' | 'Member'>();

        commData.forEach(record => {
            if (!record.organization_name) return;

            // 1. Org Type
            const type = categorizeOrg(record.organization_name);
            typeCounts[type] = (typeCounts[type] || 0) + 1;

            // 2. Specific Name
            const cleanName = record.organization_name.trim();
            nameCounts[cleanName] = (nameCounts[cleanName] || 0) + 1;

            // 3. Role Categorization
            const roleCat = categorizeRole(record.role || '');
            roleCounts[roleCat]++;

            // 4. Timeline
            if (record.date_affiliated) {
                let year = 'Unknown';
                const match = record.date_affiliated.toString().match(/\d{4}/);
                if (match) {
                    year = match[0];
                } else {
                    const d = new Date(record.date_affiliated);
                    if (!isNaN(d.getFullYear())) year = d.getFullYear().toString();
                }
                if (year !== 'Unknown') yearCounts[year] = (yearCounts[year] || 0) + 1;
            }

            // 5. User Highest Role Tracking
            const currentHighest = userHighestRole.get(record.survey_response_id);
            if (!currentHighest) {
                userHighestRole.set(record.survey_response_id, roleCat);
            } else {
                const currentR = roleRank[currentHighest];
                const newR = roleRank[roleCat];
                if (newR > currentR) {
                    userHighestRole.set(record.survey_response_id, roleCat);
                }
            }
        });

        // Calculate Leaders vs Members Count for KPI & Correlation
        let uniqueLeaders = 0;
        
        userHighestRole.forEach((role, surveyId) => {
            const isLeadership = role === 'Owner' || role === 'Admin';
            if (isLeadership) uniqueLeaders++;
            
            const emp = empMap.get(surveyId);
            if (emp) {
                // Expanded logic to catch "Managerial" roles even if the exact drop-down value isn't perfect
                const jobLevel = (emp.current_job_level || '').toLowerCase();
                const position = (emp.current_position || '').toLowerCase();
                
                const isManagerial = 
                    jobLevel.includes('manager') || 
                    jobLevel.includes('director') || 
                    jobLevel.includes('head') || 
                    jobLevel.includes('president') || 
                    jobLevel.includes('executive') || 
                    jobLevel.includes('supervis') || 
                    jobLevel.includes('chief') || 
                    jobLevel.includes('owner') || 
                    position.includes('manager') ||
                    position.includes('chief') ||
                    position.includes('head of') ||
                    position.includes('director');
                
                if (isLeadership) {
                    leadersTotal++;
                    if (isManagerial) leadersManagers++;
                } else {
                    membersTotal++;
                    if (isManagerial) membersManagers++;
                }
            }
        });

        // --- FORMATTING ---
        const orgTypesFormatted = Object.entries(typeCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value);
        setOrgTypeData(orgTypesFormatted);

        const topOrgsFormatted = Object.entries(nameCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value)
            .slice(0, 5);
        setTopOrgs(topOrgsFormatted);

        const roleDataFormatted = Object.entries(roleCounts)
            .filter(([_, value]) => value > 0)
            .map(([name, value]) => ({ name, value }));
        setRoleData(roleDataFormatted);

        const timelineFormatted = Object.entries(yearCounts)
            .map(([year, count]) => ({ year, count }))
            .sort((a,b) => parseInt(a.year) - parseInt(b.year))
            .slice(-6);
        setTimelineData(timelineFormatted);

        const leaderRate = leadersTotal > 0 ? Math.round((leadersManagers / leadersTotal) * 100) : 0;
        const memberRate = membersTotal > 0 ? Math.round((membersManagers / membersTotal) * 100) : 0;

        // KPIs
        setKpi({
            totalEngaged: userHighestRole.size,
            leadershipRate: userHighestRole.size > 0 ? Math.round((uniqueLeaders / userHighestRole.size) * 100) : 0,
            topSector: orgTypesFormatted.length > 0 ? orgTypesFormatted[0].name : 'N/A'
        });

        setAiStats({
            orgTypeCounts: typeCounts,
            topOrgs: topOrgsFormatted.map(o => o.name),
            roleCounts: roleCounts,
            crossSection: { leaderManagerialRate: leaderRate, memberManagerialRate: memberRate },
            timelineData: timelineFormatted
        });
        
        setLoading(false);

    } catch (e) {
        console.error(e);
        setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-lg shadow-indigo-500/5 flex items-center gap-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-110"></div>
                <div className="p-3.5 bg-white text-indigo-600 rounded-2xl shadow-sm relative z-10"><Users size={24} /></div>
                <div className="relative z-10">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Engaged Alumni</p>
                    <h3 className="text-3xl font-black text-slate-800">{kpi.totalEngaged}</h3>
                </div>
            </div>
            <div className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-lg shadow-amber-500/5 flex items-center gap-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-110"></div>
                <div className="p-3.5 bg-white text-amber-500 rounded-2xl shadow-sm relative z-10"><Crown size={24} /></div>
                <div className="relative z-10">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Leadership Rate</p>
                    <h3 className="text-3xl font-black text-slate-800">{kpi.leadershipRate}%</h3>
                    <p className="text-[10px] text-slate-400">Owners & Admins</p>
                </div>
            </div>
            <div className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-lg shadow-emerald-500/5 flex items-center gap-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-110"></div>
                <div className="p-3.5 bg-white text-emerald-500 rounded-2xl shadow-sm relative z-10"><Heart size={24} /></div>
                <div className="relative z-10 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Sector</p>
                    <h3 className="text-lg font-black text-slate-800 truncate" title={kpi.topSector}>{kpi.topSector}</h3>
                </div>
            </div>
        </div>

        {/* ROW 1: Org Types & Top Orgs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Org Types Donut */}
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg shadow-slate-200/50 p-6 rounded-3xl lg:col-span-1 flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-pink-100 text-pink-600 rounded-xl"><Heart size={18}/></div>
                    <h4 className="font-bold text-slate-800 text-sm">Engagement by Sector</h4>
                </div>
                <div className="h-64 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={orgTypeData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {orgTypeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}}/>
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                        <div className="text-center">
                            <span className="text-2xl font-black text-slate-700">{orgTypeData.length}</span>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Types</p>
                        </div>
                    </div>
                </div>
                <InsightCard text={interpretations?.participationAnalysis} loading={loadingAI} />
            </div>

            {/* Top Organizations Horizontal Bar */}
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg shadow-slate-200/50 p-6 rounded-3xl lg:col-span-2 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-teal-100 text-teal-600 rounded-xl"><Landmark size={18}/></div>
                    <h4 className="font-bold text-slate-800 text-sm">Most Popular Organizations</h4>
                </div>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topOrgs} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} opacity={0.3} />
                            <XAxis type="number" tick={{fontSize: 10}} />
                            <YAxis dataKey="name" type="category" width={140} tick={{fontSize: 11, fontWeight: 'bold', fill: '#475569'}} />
                            <Tooltip cursor={{fill: '#f0fdfa'}} contentStyle={{borderRadius: '12px', border:'none'}} />
                            <Bar dataKey="value" fill="#2dd4bf" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <InsightCard text={interpretations?.orgTypeInsights} loading={loadingAI} />
            </div>
        </div>

        {/* ROW 3 (Now ROW 2): Role Distribution & Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Roles Distribution - MODIFIED: Pie Chart with Internal Labels */}
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-6 rounded-3xl flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><Users size={18}/></div>
                        <h4 className="font-bold text-slate-800 text-sm">Role Distribution</h4>
                    </div>
                    <div className="h-64 w-full flex justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={roleData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={0} // Full Pie
                                    outerRadius={80}
                                    dataKey="value"
                                    paddingAngle={0}
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                >
                                    {roleData.map((entry, index) => (
                                        // @ts-ignore
                                        <Cell key={`cell-${index}`} fill={ROLE_COLORS[entry.name] || '#ccc'} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '12px', border:'none'}} />
                                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                {/* Added Interpretation Block here */}
                <InsightCard text={interpretations?.roleDistributionAnalysis} loading={loadingAI} />
            </div>

            {/* Timeline */}
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg shadow-indigo-500/5 p-6 rounded-3xl flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 text-green-600 rounded-xl"><TrendingUp size={18}/></div>
                    <h4 className="font-bold text-slate-800 text-sm">Engagement Timeline</h4>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3}/>
                            <XAxis dataKey="year" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{borderRadius: '12px', border:'none'}} />
                            <Area type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#colorEngagement)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <InsightCard text={interpretations?.timelineTrends} loading={loadingAI} />
            </div>
        </div>

    </div>
  );
};

export default CommunityAnalytics;