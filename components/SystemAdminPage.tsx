
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Admin, HumanResource } from '../types';
import { 
    Shield, Users, Server, Activity, Plus, Trash2, Edit,
    CheckCircle, XCircle, Database, AlertCircle, 
    Briefcase, Save, X, Loader2, Wifi, ChevronDown, ChevronUp, BarChart2, Check,
    Calendar, Download, PieChart as PieIcon, FileText, Filter
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, PieChart, Pie, Legend, Sector } from 'recharts';
import { jsPDF } from 'jspdf';

const SystemAdminPage: React.FC = () => {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [hrs, setHrs] = useState<HumanResource[]>([]);
    const [loading, setLoading] = useState(true);
    
    // System Health State
    const [dbStatus, setDbStatus] = useState<'Connected' | 'Disconnected' | 'Checking'>('Checking');
    const [latency, setLatency] = useState<number>(0);
    const [totalUsers, setTotalUsers] = useState<number>(0);
    const [courseVisitors, setCourseVisitors] = useState<{ course_name: string; total_visitors: number }[]>([]);
    
    // Analytics State
    const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '1y' | 'all'>('today');
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [statsSummary, setStatsSummary] = useState({ totalVisits: 0, topCourse: 'None' });

    // Modal States
    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [showAddHR, setShowAddHR] = useState(false);
    
    // New List Modal States
    const [showAdminListModal, setShowAdminListModal] = useState(false);
    const [showHRListModal, setShowHRListModal] = useState(false);
    
    // Edit States
    const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
    const [editingHR, setEditingHR] = useState<HumanResource | null>(null);
    const [editForm, setEditForm] = useState({ username: '', password: '', company_name: '' });

    const [processing, setProcessing] = useState(false);

    // Forms
    const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });
    const [newHR, setNewHR] = useState({ company_name: '', username: '', password: '' });

    useEffect(() => {
        fetchSystemData();
        checkSystemHealth();
        
        // Poll health every 30 seconds
        const interval = setInterval(checkSystemHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const checkSystemHealth = async () => {
        const start = performance.now();
        try {
            const { error } = await supabase.from('admins').select('*', { count: 'exact', head: true });
            const end = performance.now();
            
            if (error) throw error;
            
            setLatency(Math.round(end - start));
            setDbStatus('Connected');
        } catch (e) {
            setDbStatus('Disconnected');
            setLatency(0);
        }
    };

    const fetchSystemData = async () => {
        setLoading(true);
        try {
            const [adminRes, hrRes, studentCount, alumniCount] = await Promise.all([
                supabase.from('admins').select('*'),
                supabase.from('human_resource').select('*'),
                supabase.from('students').select('*', { count: 'exact', head: true }),
                supabase.from('alumni').select('*', { count: 'exact', head: true })
            ]);

            if (adminRes.data) setAdmins(adminRes.data);
            if (hrRes.data) setHrs(hrRes.data);
            setTotalUsers((studentCount.count || 0) + (alumniCount.count || 0));

        } catch (e) {
            console.error("Fetch error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [timeRange]);

    const fetchAnalytics = async () => {
        setAnalyticsLoading(true);
        try {
            let query = supabase.from('alumni_visit_logs').select('*');
            const today = new Date();
            
            if (timeRange === 'today') {
                const dateStr = today.toISOString().split('T')[0];
                query = query.eq('visit_date', dateStr);
            } else if (timeRange === '7d') {
                const past = new Date();
                past.setDate(today.getDate() - 7);
                query = query.gte('visit_date', past.toISOString().split('T')[0]);
            } else if (timeRange === '30d') {
                const past = new Date();
                past.setDate(today.getDate() - 30);
                query = query.gte('visit_date', past.toISOString().split('T')[0]);
            } else if (timeRange === '1y') {
                const past = new Date();
                past.setFullYear(today.getFullYear() - 1);
                query = query.gte('visit_date', past.toISOString().split('T')[0]);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data) {
                const aggregated = data.reduce((acc: any, curr: any) => {
                    acc[curr.course_name] = (acc[curr.course_name] || 0) + 1;
                    return acc;
                }, {});

                const formatted = Object.keys(aggregated).map(course_name => ({
                    course_name,
                    total_visitors: aggregated[course_name]
                })).sort((a, b) => b.total_visitors - a.total_visitors);

                setCourseVisitors(formatted);
                setStatsSummary({
                    totalVisits: data.length,
                    topCourse: formatted.length > 0 ? formatted[0].course_name : 'No data'
                });
            }
        } catch (e) {
            console.error("Analytics fetch error", e);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const generateReport = () => {
        try {
            const doc = new jsPDF();
            const dateStr = new Date().toLocaleString();
            
            // Header
            doc.setFontSize(22);
            doc.setTextColor(30, 41, 59); // slate-800
            doc.text('ALUMNI PORTAL VISITS REPORT', 20, 20);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text(`Generated on: ${dateStr}`, 20, 28);
            doc.text(`Time Range: ${timeRange.toUpperCase()}`, 20, 33);
            
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.line(20, 40, 190, 40);

            // Summary
            doc.setFontSize(14);
            doc.setTextColor(30, 41, 59);
            doc.text('Performance Summary', 20, 50);
            
            doc.setFontSize(11);
            doc.text(`Total Unique Visits: ${statsSummary.totalVisits}`, 25, 60);
            doc.text(`Most Active Program: ${statsSummary.topCourse}`, 25, 67);
            
            // Programs Table
            doc.setFontSize(14);
            doc.text('Visits by Program', 20, 85);
            
            let y = 95;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Academic Program', 25, y);
            doc.text('Daily Visits', 150, y);
            doc.setFont('helvetica', 'normal');
            
            y += 5;
            doc.line(20, y, 190, y);
            y += 8;

            courseVisitors.forEach((item, index) => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(item.course_name.length > 60 ? item.course_name.substring(0, 60) + '...' : item.course_name, 25, y);
                doc.text(item.total_visitors.toString(), 155, y);
                y += 8;
            });

            // Footer
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(9);
                doc.setTextColor(148, 163, 184);
                doc.text(`Page ${i} of ${pageCount}`, 180, 290, { align: 'right' });
            }

            doc.save(`Alumni_Visits_Report_${timeRange}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error("PDF generation failed:", err);
            alert("Failed to generate PDF report.");
        }
    };

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            const { data, error } = await supabase.from('admins').insert([newAdmin]).select().single();
            if (error) throw error;
            setAdmins([...admins, data]);
            setShowAddAdmin(false);
            setNewAdmin({ username: '', password: '' });
            alert("Administrator added successfully.");
        } catch (e: any) {
            alert("Error adding admin: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteAdmin = async (id: string) => {
        if (!window.confirm("Are you sure? This will revoke access immediately.")) return;
        try {
            await supabase.from('admins').delete().eq('id', id);
            setAdmins(prev => prev.filter(a => a.id !== id));
        } catch (e) {
            alert("Failed to delete admin.");
        }
    };

    const initiateEditAdmin = (admin: Admin) => {
        setEditingAdmin(admin);
        setEditForm({ username: admin.username, password: '', company_name: '' });
    };

    const handleUpdateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAdmin) return;
        setProcessing(true);
        try {
            const updates: any = {};
            if (editForm.username && editForm.username !== editingAdmin.username) updates.username = editForm.username;
            if (editForm.password) updates.password = editForm.password;

            if (Object.keys(updates).length > 0) {
                const { error } = await supabase.from('admins').update(updates).eq('id', editingAdmin.id);
                if (error) throw error;
                setAdmins(prev => prev.map(a => a.id === editingAdmin.id ? { ...a, ...updates } : a));
            }
            setEditingAdmin(null);
            alert("Admin updated successfully.");
        } catch (e: any) {
            alert("Update failed: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleAddHR = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            const { data, error } = await supabase.from('human_resource').insert([newHR]).select().single();
            if (error) throw error;
            setHrs([...hrs, data]);
            setShowAddHR(false);
            setNewHR({ company_name: '', username: '', password: '' });
            alert("HR Account created successfully.");
        } catch (e: any) {
            alert("Error adding HR: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteHR = async (id: number) => {
        if (!window.confirm("Are you sure? This will remove the HR account and close their job postings.")) return;
        try {
            await supabase.from('human_resource').delete().eq('id', id);
            setHrs(prev => prev.filter(h => h.id !== id));
        } catch (e) {
            alert("Failed to delete HR account.");
        }
    };

    const initiateEditHR = (hr: HumanResource) => {
        setEditingHR(hr);
        setEditForm({ username: hr.username, password: '', company_name: hr.company_name });
    };

    const handleUpdateHR = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingHR) return;
        setProcessing(true);
        try {
            const updates: any = {};
            if (editForm.username && editForm.username !== editingHR.username) updates.username = editForm.username;
            if (editForm.company_name && editForm.company_name !== editingHR.company_name) updates.company_name = editForm.company_name;
            if (editForm.password) updates.password = editForm.password;

            if (Object.keys(updates).length > 0) {
                const { error } = await supabase.from('human_resource').update(updates).eq('id', editingHR.id);
                if (error) throw error;
                setHrs(prev => prev.map(h => h.id === editingHR.id ? { ...h, ...updates } : h));
            }
            setEditingHR(null);
            alert("HR account updated successfully.");
        } catch (e: any) {
            alert("Update failed: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const StatusCard = ({ icon: Icon, label, value, subtext, color }: any) => (
        <div className={`p-6 rounded-3xl border border-white/50 shadow-lg backdrop-blur-xl bg-gradient-to-br ${color} text-white relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-all"></div>
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-2 opacity-90">
                        <Icon size={18} />
                        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                    </div>
                    <h3 className="text-3xl font-black">{value}</h3>
                    <p className="text-xs font-medium mt-1 opacity-80">{subtext}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    <Activity size={24} className="animate-pulse" />
                </div>
            </div>
        </div>
    );

    const CHART_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#f43f5e', '#14b8a6', '#84cc16'];
    
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/90 backdrop-blur border border-slate-100 p-4 rounded-2xl shadow-xl max-w-[250px] z-50">
                    <p className="text-xs font-bold text-slate-500 mb-1 leading-snug">{label}</p>
                    <p className="text-xl font-black text-indigo-600">
                        {payload[0].value} <span className="text-xs font-medium text-slate-500">Visitors</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            
            {/* Header */}
            <div className="flex items-center justify-between bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-lg shadow-indigo-500/5">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Shield className="text-indigo-600" /> System Control Panel
                    </h2>
                    <p className="text-slate-500 mt-1">Monitor infrastructure and manage privileged accounts.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 text-xs font-bold shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                    System Online
                </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatusCard 
                    icon={Wifi} 
                    label="System Status" 
                    value="Online" 
                    subtext="All services operational" 
                    color="from-emerald-500 to-teal-600"
                />
                <StatusCard 
                    icon={Database} 
                    label="Database" 
                    value={dbStatus} 
                    subtext={dbStatus === 'Connected' ? `${latency}ms latency` : "Connection Failed"} 
                    color={dbStatus === 'Connected' ? "from-blue-500 to-indigo-600" : "from-red-500 to-rose-600"}
                />
                <StatusCard 
                    icon={Users} 
                    label="Total Users" 
                    value={totalUsers} 
                    subtext="Alumni & Students" 
                    color="from-violet-500 to-purple-600"
                />
                <StatusCard 
                    icon={Shield} 
                    label="Active Admins" 
                    value={admins.length} 
                    subtext="Privileged Access" 
                    color="from-orange-500 to-amber-600"
                />
            </div>

            {/* Site Visitors Monitoring (Recharts BarChart & PieChart) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg shadow-slate-200/50 rounded-3xl p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Activity className="text-emerald-500" size={20}/> Site Traffic Analytics
                            </h3>
                            <p className="text-xs text-slate-500 font-medium ml-7">Unique account visits by academic program.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            {(['today', '7d', '30d', '1y'] as const).map((range) => (
                                <button 
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${timeRange === range ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {range === '7d' ? 'Past Week' : range === 'today' ? 'Today' : range === '1y' ? 'Past Year' : 'Past Month'}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {analyticsLoading ? (
                        <div className="py-20 text-center flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-indigo-500" size={32}/>
                            <p className="text-xs font-bold text-slate-400">Processing Big Data...</p>
                        </div>
                    ) : courseVisitors.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                                <Filter size={32} />
                            </div>
                            <p className="text-slate-400 text-sm font-medium">No visitor logs found for this period.</p>
                        </div>
                    ) : (
                        <div className="w-full h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={courseVisitors} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.5} />
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="course_name" 
                                        type="category" 
                                        width={180} 
                                        tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} 
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(val) => val.length > 25 ? val.substring(0, 25) + '...' : val}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="total_visitors" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={24}>
                                        {courseVisitors.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Pie Chart / Distribution Panel */}
                <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg shadow-slate-200/50 rounded-3xl p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <PieIcon className="text-indigo-500" size={20}/> Program Share
                        </h3>
                        <button 
                            onClick={generateReport}
                            className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 group"
                            title="Download PDF Report"
                        >
                            <Download size={18} className="group-hover:scale-110 transition-transform"/>
                        </button>
                    </div>

                    <div className="flex-1 min-h-[300px]">
                        {courseVisitors.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-300">
                                <Activity size={40} className="opacity-20"/>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={courseVisitors}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="total_visitors"
                                        nameKey="course_name"
                                    >
                                        {courseVisitors.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend 
                                        layout="vertical" 
                                        verticalAlign="bottom" 
                                        align="center"
                                        formatter={(val) => <span className="text-[9px] font-bold text-slate-500">{val.length > 30 ? val.substring(0, 30) + '...' : val}</span>}
                                        iconType="circle"
                                        iconSize={6}
                                        wrapperStyle={{ paddingTop: '20px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Visits</p>
                                <p className="text-xl font-black text-slate-800">{statsSummary.totalVisits}</p>
                            </div>
                            <div className="text-center p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Top Track</p>
                                <p className="text-base font-black text-indigo-700 truncate px-1" title={statsSummary.topCourse}>{statsSummary.topCourse === 'No data' ? 'None' : statsSummary.topCourse.split(' ')[statsSummary.topCourse.split(' ').length - 1]}</p>
                            </div>
                        </div>
                        <button 
                            onClick={generateReport}
                            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-lg text-xs"
                        >
                            <FileText size={14}/> Save Comprehensive Report
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Admin Management Minimal Panel */}
                <div 
                    onClick={() => setShowAdminListModal(true)}
                    className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm hover:shadow-lg rounded-3xl p-6 cursor-pointer group transition-all"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Shield size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Manage Administrators</h3>
                                <p className="text-sm text-slate-500 mt-0.5">{admins.length} Active Accounts</p>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                            <Plus size={16} />
                        </div>
                    </div>
                </div>

                {/* HR Management Minimal Panel */}
                <div 
                    onClick={() => setShowHRListModal(true)}
                    className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm hover:shadow-lg rounded-3xl p-6 cursor-pointer group transition-all"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Briefcase size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Manage HR Partners</h3>
                                <p className="text-sm text-slate-500 mt-0.5">{hrs.length} Active Accounts</p>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Plus size={16} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Admin Modal */}
            {showAddAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddAdmin(false)}></div>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Add Administrator</h3>
                            <button onClick={() => setShowAddAdmin(false)}><X size={20} className="text-slate-400"/></button>
                        </div>
                        <form onSubmit={handleAddAdmin} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Username</label>
                                <input type="text" required value={newAdmin.username} onChange={e => setNewAdmin({...newAdmin, username: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Password</label>
                                <input type="password" required value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 transition-colors"/>
                            </div>
                            <button type="submit" disabled={processing} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all flex justify-center">
                                {processing ? <Loader2 className="animate-spin"/> : "Create Account"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Create HR Modal */}
            {showAddHR && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddHR(false)}></div>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Add HR Partner</h3>
                            <button onClick={() => setShowAddHR(false)}><X size={20} className="text-slate-400"/></button>
                        </div>
                        <form onSubmit={handleAddHR} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Company Name</label>
                                <input type="text" required value={newHR.company_name} onChange={e => setNewHR({...newHR, company_name: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Username</label>
                                <input type="text" required value={newHR.username} onChange={e => setNewHR({...newHR, username: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Password</label>
                                <input type="password" required value={newHR.password} onChange={e => setNewHR({...newHR, password: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"/>
                            </div>
                            <button type="submit" disabled={processing} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex justify-center">
                                {processing ? <Loader2 className="animate-spin"/> : "Create HR Account"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Admin Modal */}
            {editingAdmin && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingAdmin(null)}></div>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Edit Administrator</h3>
                            <button onClick={() => setEditingAdmin(null)}><X size={20} className="text-slate-400"/></button>
                        </div>
                        <form onSubmit={handleUpdateAdmin} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Username</label>
                                <input type="text" required value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">New Password <span className="text-slate-400 font-normal">(Leave blank to keep)</span></label>
                                <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 transition-colors"/>
                            </div>
                            <button type="submit" disabled={processing} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all flex justify-center">
                                {processing ? <Loader2 className="animate-spin"/> : "Save Changes"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit HR Modal */}
            {editingHR && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingHR(null)}></div>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Edit HR Account</h3>
                            <button onClick={() => setEditingHR(null)}><X size={20} className="text-slate-400"/></button>
                        </div>
                        <form onSubmit={handleUpdateHR} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Company Name</label>
                                <input type="text" required value={editForm.company_name} onChange={e => setEditForm({...editForm, company_name: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Username</label>
                                <input type="text" required value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">New Password <span className="text-slate-400 font-normal">(Leave blank to keep)</span></label>
                                <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-colors"/>
                            </div>
                            <button type="submit" disabled={processing} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex justify-center">
                                {processing ? <Loader2 className="animate-spin"/> : "Save Changes"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Admin List Modal */}
            {showAdminListModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAdminListModal(false)}></div>
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl relative z-10 flex flex-col h-[600px] max-h-[90vh] overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                <Shield className="text-orange-500" /> Manage Administrators
                            </h3>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => { setShowAdminListModal(false); setShowAddAdmin(true); }}
                                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 hover:bg-black transition-all shadow-md"
                                >
                                    <Plus size={14}/> Add Admin
                                </button>
                                <button onClick={() => setShowAdminListModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="flex-grow p-6 overflow-y-auto custom-scrollbar space-y-3">
                            {loading ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-slate-300"/></div> : 
                             admins.map(admin => (
                                <div key={admin.id} className="p-4 bg-white rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center font-bold text-xl">
                                            {admin.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{admin.username}</h4>
                                            <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200 uppercase tracking-widest mt-1 block w-max">Super Admin</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => initiateEditAdmin(admin)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-blue-100">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDeleteAdmin(admin.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-red-100">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* HR List Modal */}
            {showHRListModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHRListModal(false)}></div>
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl relative z-10 flex flex-col h-[600px] max-h-[90vh] overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                <Briefcase className="text-blue-500" /> Manage HR Partners
                            </h3>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => { setShowHRListModal(false); setShowAddHR(true); }}
                                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md"
                                >
                                    <Plus size={14}/> Add HR
                                </button>
                                <button onClick={() => setShowHRListModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="flex-grow p-6 overflow-y-auto custom-scrollbar space-y-3">
                            {loading ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-slate-300"/></div> : 
                             hrs.length === 0 ? <div className="text-center py-20 text-slate-400">No HR accounts found.</div> :
                             hrs.map(hr => (
                                <div key={hr.id} className="p-4 bg-white rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl">
                                            {hr.company_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{hr.company_name}</h4>
                                            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1"><Users size={12}/> @{hr.username}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => initiateEditHR(hr)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-blue-100">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDeleteHR(hr.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-red-100">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SystemAdminPage;
