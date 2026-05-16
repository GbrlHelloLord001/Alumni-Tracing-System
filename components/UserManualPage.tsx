import React, { useState } from 'react';
import { Download, FileText, CheckCircle, Info, LayoutTemplate, Layers, Inbox, Bot, Globe, Database, Users, Shield, BookOpen, UserCheck, Briefcase } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const UserManualPage: React.FC = () => {
    const [isDownloading, setIsDownloading] = useState(false);

    const downloadPDF = async () => {
        setIsDownloading(true);
        try {
            const pages = document.querySelectorAll('.pdf-page');
            if (pages.length === 0) {
                alert("No pages found to export.");
                setIsDownloading(false);
                return;
            }

            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // Iterate through each exact A4 sized div and capture individually
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i] as HTMLElement;
                
                // Keep the styling perfectly intact by using standard html2canvas config
                const canvas = await html2canvas(page, { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    backgroundColor: '#ffffff'
                });
                
                const imgData = canvas.toDataURL('image/png');
                
                if (i > 0) {
                    pdf.addPage();
                }
                
                // A4 landscape dimensions: exactly 297mm x 210mm
                pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
            }
            
            pdf.save('Laguna_University_Alumni_Tracer_User_Manual.pdf');
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to run PDF generation.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto py-8 font-sans">
            <div className="flex justify-between items-end mb-8 pl-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <FileText className="text-blue-600" /> System User Manual
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Complete walkthrough of the Alumni Tracer System.</p>
                </div>
                <button 
                    onClick={downloadPDF}
                    disabled={isDownloading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-200 transition-all font-bold flex items-center gap-2"
                >
                    {isDownloading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Generating PDF...
                        </>
                    ) : (
                        <>
                            <Download size={18} /> Download PDF
                        </>
                    )}
                </button>
            </div>

            {/* Viewport for browsing the manual on-screen before download */}
            <div className="bg-slate-200/50 rounded-3xl p-8 border border-slate-200 shadow-inner overflow-x-auto custom-scrollbar flex flex-col items-center gap-8 h-[80vh] overflow-y-auto">
                
                {/* PAGE 1: Cover Page */}
                <div className="pdf-page flex-shrink-0 w-[1123px] h-[794px] bg-white shadow-xl relative overflow-hidden p-16 flex flex-col justify-center items-center text-center border-8 border-indigo-50" style={{ boxSizing: 'border-box' }}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-100 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 opacity-50"></div>
                    
                    <div className="relative z-10 w-full flex flex-col items-center">
                        <div className="w-32 h-32 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 mb-10 transform -rotate-3 hover:rotate-0 transition-transform">
                            <Layers size={64} />
                        </div>
                        <h1 className="text-[5rem] leading-[1.1] font-black text-slate-800 tracking-tight mb-6">
                            Alumni <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Tracer</span> System
                        </h1>
                        <h2 className="text-3xl font-bold text-slate-400 uppercase tracking-widest mb-16">User Manual & Configuration Guide</h2>
                        
                        <div className="w-full max-w-2xl bg-white p-10 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6 text-left">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                                <span className="text-lg font-bold text-slate-400 uppercase tracking-widest">Institution</span>
                                <span className="text-xl font-bold text-slate-800">Laguna University</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                                <span className="text-lg font-bold text-slate-400 uppercase tracking-widest">Document Version</span>
                                <span className="text-xl font-bold text-slate-800 text-blue-600">Version 1.2.0</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Date Published</span>
                                <span className="text-sm font-bold text-slate-800">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PAGE 2: Introduction & Table of Contents */}
                <div className="pdf-page flex-shrink-0 w-[1123px] h-[794px] bg-white shadow-xl relative overflow-hidden p-16 flex flex-col justify-between" style={{ boxSizing: 'border-box' }}>
                    
                    <div className="flex justify-between items-center border-b-2 border-slate-100 pb-8 mb-8">
                        <h3 className="text-3xl font-black text-slate-800 flex items-center gap-4">
                            <BookOpen className="text-blue-500 w-8 h-8" /> 1. Overview & Contents
                        </h3>
                        <span className="text-slate-400 font-bold">Page 02</span>
                    </div>

                    <div className="flex flex-row gap-12 h-full">
                        <div className="w-1/3 bg-slate-50/80 rounded-[2rem] p-10 border border-slate-100 h-full">
                            <h4 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3 uppercase tracking-wider">
                                Table of Contents
                            </h4>
                            <ul className="space-y-6 font-bold text-slate-600">
                                <li className="flex items-center gap-3 text-blue-600"><span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs">1</span> Introduction & Overview</li>
                                <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs">2</span> Alumni Portal Features
                                    <ul className="mt-4 ml-9 space-y-3 text-slate-500 font-medium list-disc list-inside">
                                        <li>Authentication & Identity</li>
                                        <li>Dashboard Experience</li>
                                        <li>Digital ID Generation</li>
                                        <li>Curated Job Board</li>
                                    </ul>
                                </li>
                                <li className="flex items-center gap-3 mt-6"><span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">3</span> Admin Master Setup
                                    <ul className="mt-4 ml-9 space-y-3 text-slate-500 font-medium list-disc list-inside">
                                        <li>Analytics & Core Metrics</li>
                                        <li>Inbox & Update Approvals</li>
                                        <li>Database Management</li>
                                        <li>Advanced Export & Reporting</li>
                                    </ul>
                                </li>
                            </ul>
                        </div>

                        <div className="w-2/3 h-full pr-8">
                            <h4 className="text-4xl font-black text-slate-800 mb-6">Introduction to the System</h4>
                            <p className="text-slate-600 text-lg leading-relaxed mb-8">
                                The Laguna University Alumni Tracer System is an advanced digital platform developed to continuously bridge the connection between the university and its esteemed graduates. The architecture supports two simultaneous operational modalities: the <strong className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Alumni Sandbox</strong> and the <strong className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Administrative Control Center</strong>.
                            </p>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="bg-white p-6 rounded-2xl border-2 border-blue-100 shadow-sm flex items-start gap-5">
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                                        <UserCheck size={24} />
                                    </div>
                                    <div>
                                        <h5 className="text-xl font-bold text-slate-800 mb-2">The Alumni Perspective</h5>
                                        <p className="text-slate-600 leading-relaxed text-sm">
                                            Graduates utilize a modern web portal to register, submit identification documents for swift verification, strictly maintain updated employment histories, apply for careers on a dedicated job board, and provision their own digital campus access credential.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm flex items-start gap-5">
                                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                                        <LayoutTemplate size={24} />
                                    </div>
                                    <div>
                                        <h5 className="text-xl font-bold text-slate-800 mb-2">The Administrative Capacity</h5>
                                        <p className="text-slate-600 leading-relaxed text-sm">
                                            The system empowers staff to digest thousands of records efficiently, verify user identities, manually approve modified employment logs, instantly generate detailed statistical reports meeting CHED guidelines, and utilize an AI model (P.A.U.L.O) for accelerated insight gathering.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PAGE 3: Alumni Portal 1 */}
                <div className="pdf-page flex-shrink-0 w-[1123px] h-[794px] bg-white shadow-xl relative overflow-hidden p-16 flex flex-col justify-between" style={{ boxSizing: 'border-box' }}>
                    
                    <div className="flex justify-between items-center border-b-2 border-slate-100 pb-8 mb-8">
                        <h3 className="text-3xl font-black text-slate-800 flex items-center gap-4">
                            <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">2</span> Alumni Portal (Part 1)
                        </h3>
                        <span className="text-slate-400 font-bold">Page 03</span>
                    </div>

                    <div className="grid grid-cols-2 gap-16 h-full">
                        <div className="flex flex-col">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 mb-6">
                                <Shield size={32} />
                            </div>
                            <h4 className="text-2xl font-bold text-slate-800 mb-4">Registration & Verification</h4>
                            <p className="text-slate-600 leading-relaxed mb-6">
                                The foundational step for securing access is the registration protocol. The system ensures only legitimate alumni enter the ecosystem.
                            </p>
                            <ul className="space-y-4 text-slate-700 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <li className="flex gap-3"><CheckCircle className="text-emerald-500 flex-shrink-0 w-5 h-5" /> <strong>Step 1:</strong> User enters Student Number, Email, and Name.</li>
                                <li className="flex gap-3"><CheckCircle className="text-emerald-500 flex-shrink-0 w-5 h-5" /> <strong>Step 2:</strong> Requires upload of Valid ID or Camera Capture.</li>
                                <li className="flex gap-3"><CheckCircle className="text-emerald-500 flex-shrink-0 w-5 h-5" /> <strong>Step 3:</strong> ID undergoes processing before full account privileges are unlocked.</li>
                            </ul>
                        </div>

                        <div className="flex flex-col">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 mb-6">
                                <LayoutTemplate size={32} />
                            </div>
                            <h4 className="text-2xl font-bold text-slate-800 mb-4">Profile Dashboard & State Management</h4>
                            <p className="text-slate-600 leading-relaxed mb-6">
                                The immediate landing interface dictates user interaction. Profile completion is visibly gamified and sectioned.
                            </p>
                            <ul className="space-y-4 text-slate-700 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <li className="flex gap-3"><CheckCircle className="text-emerald-500 flex-shrink-0 w-5 h-5" /> <strong>Metrics:</strong> Visually displays Employment Status and Profile Completeness.</li>
                                <li className="flex gap-3"><CheckCircle className="text-emerald-500 flex-shrink-0 w-5 h-5" /> <strong>Update Lock:</strong> When employment details are edited, they enter a locked state awaiting Admin approval.</li>
                                <li className="flex gap-3"><CheckCircle className="text-emerald-500 flex-shrink-0 w-5 h-5" /> <strong>Contact Sync:</strong> Email and mobile numbers are explicitly preserved.</li>
                            </ul>
                            
                            <div className="mt-8 bg-amber-50 p-5 rounded-xl border border-amber-200 flex gap-4 items-start">
                                <Info className="text-amber-600 flex-shrink-0" />
                                <p className="text-sm text-amber-800 font-medium">To avoid conflicting data states, dual submission of identical records is restricted by the realtime database layer.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PAGE 4: Alumni Portal 2 */}
                <div className="pdf-page flex-shrink-0 w-[1123px] h-[794px] bg-white shadow-xl relative overflow-hidden p-16 flex flex-col justify-between" style={{ boxSizing: 'border-box' }}>
                    
                    <div className="flex justify-between items-center border-b-2 border-slate-100 pb-8 mb-8">
                        <h3 className="text-3xl font-black text-slate-800 flex items-center gap-4">
                            <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">2</span> Alumni Portal (Part 2)
                        </h3>
                        <span className="text-slate-400 font-bold">Page 04</span>
                    </div>

                    <div className="grid grid-cols-2 gap-16 h-full">
                        <div className="flex flex-col">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200 mb-6">
                                <UserCheck size={32} />
                            </div>
                            <h4 className="text-2xl font-bold text-slate-800 mb-4">Digital Alumni ID Generation</h4>
                            <p className="text-slate-600 leading-relaxed mb-6">
                                Serves as a definitive, verifiable token of university affiliation. Rendered natively in the browser and fully exportable.
                            </p>
                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 h-full flex flex-col justify-center items-center">
                                <div className="border-4 border-indigo-100 rounded-xl p-4 bg-white shadow-xl mb-6 relative hover:-translate-y-2 transition-transform duration-300 w-full max-w-sm">
                                    <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-4">
                                        <div className="w-12 h-12 rounded-full bg-slate-200"></div>
                                        <div>
                                            <div className="w-24 h-3 bg-slate-200 rounded mb-2"></div>
                                            <div className="w-16 h-2 bg-slate-200 rounded"></div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="w-32 h-2 bg-slate-200 rounded"></div>
                                        <div className="w-16 h-16 bg-slate-200 rounded-lg"></div>
                                    </div>
                                </div>
                                <p className="text-center text-sm font-bold text-slate-500">Automated High-Resolution Canvas Export</p>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-rose-200 mb-6">
                                <Briefcase size={32} />
                            </div>
                            <h4 className="text-2xl font-bold text-slate-800 mb-4">University Job Board</h4>
                            <p className="text-slate-600 leading-relaxed mb-6">
                                An exclusive employment portal where alumni browse verified active postings curated from reputable university partners.
                            </p>
                            <ul className="space-y-5 text-slate-700 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <li>
                                    <strong className="text-slate-800 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-500" /> Filtering System</strong>
                                    <p className="text-sm mt-1 text-slate-500">Categorizes jobs by full-time, part-time, remote, or hybrid tags for rapid consumption.</p>
                                </li>
                                <li>
                                    <strong className="text-slate-800 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-500" /> External Application Routing</strong>
                                    <p className="text-sm mt-1 text-slate-500">Uses explicit URIs to navigate directly to company application platforms.</p>
                                </li>
                                <li>
                                    <strong className="text-slate-800 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-500" /> Administrative Prerogative</strong>
                                    <p className="text-sm mt-1 text-slate-500">Administrators possess the supreme capability to push new job listings instantly to the feed.</p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* PAGE 5: Admin Portal 1 */}
                <div className="pdf-page flex-shrink-0 w-[1123px] h-[794px] bg-white shadow-xl relative overflow-hidden p-16 flex flex-col justify-between" style={{ boxSizing: 'border-box' }}>
                    
                    <div className="flex justify-between items-center border-b-2 border-slate-100 pb-8 mb-8">
                        <h3 className="text-3xl font-black text-slate-800 flex items-center gap-4">
                            <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">3</span> Admin Portal (Part 1)
                        </h3>
                        <span className="text-slate-400 font-bold">Page 05</span>
                    </div>

                    <div className="grid grid-cols-2 gap-12 h-full">
                        <div className="flex flex-col gap-8">
                            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                                <div className="flex items-center gap-5 mb-4">
                                    <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                                        <LayoutTemplate size={28} />
                                    </div>
                                    <h4 className="text-2xl font-bold text-slate-800">Master Analytics</h4>
                                </div>
                                <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                                    The core dashboard provides a bird's-eye view. Relies on dynamic calculation architectures to evaluate employment rates across active registered batches. Visualizes data points on pie charts rendering metrics like "Employed vs Unemployed" and "Degree Program Spread".
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 h-full">
                                <div className="flex items-center gap-5 mb-4">
                                    <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
                                        <Inbox size={28} />
                                    </div>
                                    <h4 className="text-2xl font-bold text-slate-800">Updates Inbox</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                                    A controlled moderation pipeline ensuring database purity. Instead of direct writes substituting previous data, the alumni submission creates an "Inbox Request". 
                                </p>
                                <div className="p-4 bg-white rounded-xl border border-slate-200">
                                    <p className="text-sm font-bold text-slate-800 mb-2">Review Process Check:</p>
                                    <ul className="text-xs text-slate-500 space-y-2 list-disc list-inside">
                                        <li>Examine "Prior State" vs "Requested State"</li>
                                        <li>Accepting overrides main DB record.</li>
                                        <li>Rejecting immediately clears the lock.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] p-10 text-white flex flex-col justify-center border border-slate-700 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/20 rounded-full blur-3xl"></div>
                            
                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-fuchsia-500/20 text-fuchsia-400 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-fuchsia-500/30 mb-8 mt-4">
                                    <Bot size={40} />
                                </div>
                                <h4 className="text-4xl font-black mb-4 tracking-tight">P.A.U.L.O. Assistant</h4>
                                <h5 className="text-xl font-medium text-fuchsia-300 mb-8">Predictive AI Utility & Logic Operator</h5>
                                
                                <p className="text-slate-300 leading-relaxed text-lg mb-8">
                                    Integrated directly into the system, P.A.U.L.O utilizes Google's Gemini LLM to interpret natural language commands.
                                </p>

                                <div className="space-y-4">
                                    <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/10">
                                        <code className="text-sm text-fuchsia-200 font-mono">"Summarize the highest employment industry for BSIT."</code>
                                    </div>
                                    <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/10">
                                        <code className="text-sm text-fuchsia-200 font-mono">"Draft a professional email reminder for inactive users."</code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PAGE 6: Admin Portal 2 */}
                <div className="pdf-page flex-shrink-0 w-[1123px] h-[794px] bg-white shadow-xl relative overflow-hidden p-16 flex flex-col justify-between" style={{ boxSizing: 'border-box' }}>
                    
                    <div className="flex justify-between items-center border-b-2 border-slate-100 pb-8 mb-8">
                        <h3 className="text-3xl font-black text-slate-800 flex items-center gap-4">
                            <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">3</span> Admin Portal (Part 2)
                        </h3>
                        <span className="text-slate-400 font-bold">Page 06</span>
                    </div>

                    <div className="grid grid-cols-2 gap-8 h-full">
                        
                        <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm flex flex-col">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                                    <Users size={28} />
                                </div>
                                <h4 className="text-2xl font-bold text-slate-800">User Database</h4>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                The comprehensive ledger of all users across both the raw graduate import table and active application users. Includes capabilities to multi-select users and dispatch bulk automated email reminders specifically targeting "Unregistered" or "Inactive" status profiles.
                            </p>
                            <div className="mt-auto flex items-center gap-2 text-indigo-600 font-bold bg-indigo-50 p-4 rounded-xl w-max">
                                <CheckCircle size={18} /> Features strict filtering by Array constraints
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm flex flex-col">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center">
                                    <Globe size={28} />
                                </div>
                                <h4 className="text-2xl font-bold text-slate-800">Alumni Fetcher</h4>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                A specialized intelligence tool leveraging external integrations. If an alumni refuses to update their portal, the Fetcher allows the admin to securely query public professional networks (like LinkedIn) to acquire the latest company and job title information, keeping institutional stats accurate.
                            </p>
                        </div>

                        <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm flex flex-col">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                                    <FileText size={28} />
                                </div>
                                <h4 className="text-2xl font-bold text-slate-800">Reports Module</h4>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                The definitive CHED compliance tool. Configures highly granular parameters (Employment Status, Income Bracket, Industry, Alignment with Course) and produces formal, tabular reports. Generates completely sanitized CSV files ready for auditing.
                            </p>
                        </div>

                        <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm flex flex-col">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-fuchsia-100 text-fuchsia-600 rounded-2xl flex items-center justify-center">
                                    <Database size={28} />
                                </div>
                                <h4 className="text-2xl font-bold text-slate-800">Graduate Bulk Import</h4>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                Designed for Registrar operation ease. Drag-and-drop mechanism for `.xlsx` or `.csv` files. The system previews the grid, maps exact column names (First Name, Middle Name, Student Number) and commits batches of 3,000+ rows directly to the operational database in seconds.
                            </p>
                        </div>

                    </div>
                </div>

                {/* PAGE 7: Safety & Architecture */}
                <div className="pdf-page flex-shrink-0 w-[1123px] h-[794px] bg-slate-800 text-white shadow-xl relative overflow-hidden p-16 flex flex-col justify-center items-center text-center border-8 border-slate-900" style={{ boxSizing: 'border-box' }}>
                    <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4"></div>
                    <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
                        <div className="w-24 h-24 bg-slate-700 rounded-[2rem] flex items-center justify-center text-slate-300 border border-slate-600 mb-8">
                            <Shield size={48} />
                        </div>
                        <h4 className="text-5xl font-black text-white mb-6">Security & Architecture</h4>
                        <p className="text-slate-300 text-xl leading-relaxed mb-12">
                            The Laguna University Alumni Tracer System operates on a strict zero-trust model utilizing multi-stage validation. All data interactions pass through Google Firebase's secured perimeter networks.
                        </p>

                        <div className="grid grid-cols-3 gap-6 w-full text-left">
                            <div className="bg-slate-700/50 p-6 rounded-2xl border border-slate-600">
                                <h5 className="text-lg font-bold text-white mb-3">Row Level Security</h5>
                                <p className="text-sm text-slate-300 leading-relaxed">
                                    PostgreSQL policies are strictly enforced. End users possess authorization exclusively to their respective Document IDs across tables.
                                </p>
                            </div>
                            <div className="bg-slate-700/50 p-6 rounded-2xl border border-slate-600">
                                <h5 className="text-lg font-bold text-white mb-3">Rate Limit Strategy</h5>
                                <p className="text-sm text-slate-300 leading-relaxed">
                                    Administrative functions like Bulk Emailing operate incrementally, resolving latency through chunked operations bypassing memory-limits.
                                </p>
                            </div>
                            <div className="bg-slate-700/50 p-6 rounded-2xl border border-slate-600">
                                <h5 className="text-lg font-bold text-white mb-3">Encryption Vectors</h5>
                                <p className="text-sm text-slate-300 leading-relaxed">
                                    Sensitive parameters, ID document URLs, and system passwords remain encrypted in transit and directly at rest within the cloud environment.
                                </p>
                            </div>
                        </div>

                        <div className="mt-16 text-slate-500 font-bold uppercase tracking-widest text-sm">
                            End of Legal & System Documentation
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default UserManualPage;
