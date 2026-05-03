import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { extractDataFromID } from '../services/geminiService';
import { Student, Admin, HumanResource } from '../types';
import FileUpload from './FileUpload';
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader2, XCircle, ArrowRight, ShieldCheck, HelpCircle, FileText } from 'lucide-react';

import { COURSES, normalizeProgram, normalizeBatchYear } from '../lib/normalization';

interface AuthPageProps {
  onLoginSuccess: (student: Student) => void;
  onAdminLoginSuccess: (admin: Admin) => void;
  onHRLoginSuccess: (hr: HumanResource) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess, onAdminLoginSuccess, onHRLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Login Success Animation State
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [loggedInStudentName, setLoggedInStudentName] = useState('');

  // Portal State (Admin vs HR)
  const [isPortalMode, setIsPortalMode] = useState(false);
  const [portalType, setPortalType] = useState<'admin' | 'hr'>('admin');
  const [portalUsername, setPortalUsername] = useState('');
  const [portalPassword, setPortalPassword] = useState('');

  // Login State (Unified Alumni)
  const [alumniFirstName, setAlumniFirstName] = useState('');
  const [alumniLastName, setAlumniLastName] = useState('');
  const [loginPassword, setLoginPassword] = useState(''); 
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup Flow State
  const [signupStep, setSignupStep] = useState<'upload-id' | 'set-password'>('upload-id');
  const [matchedRecord, setMatchedRecord] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isMarriedFemale, setIsMarriedFemale] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // UI State
  const [showHelp, setShowHelp] = useState(false);

  // Helper: Strict Date Validation (MM-DD-YYYY)
  const isValidDateFormat = (dateString: string) => {
    const regex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-\d{4}$/;
    return regex.test(dateString);
  };

  // Step 1: Process ID or Proof of Alumni
  const handleIdProcess = async (file: File) => {
    setLoading(true);
    setSignupError('');
    setStatusMessage("Extracting information and locating record...");
    
    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = reader.result as string;
            const cleanBase64 = base64Data.split(',')[1];

            try {
                const idData = await extractDataFromID(cleanBase64, file.type);
                
                if (!idData.is_valid) {
                    throw new Error("The uploaded image does not appear to be a valid document or ID.");
                }

                const firstName = idData.first_name || '';
                const lastName = idData.last_name || '';
                const middleName = idData.middle_name || '';

                if (!firstName || !lastName) {
                    throw new Error("Could not extract a clear First Name and Last Name from the document.");
                }

                setStatusMessage("Matching alumni record...");

                // Find matching record
                let query = supabase
                    .from('graduates_import')
                    .select('*')
                    .ilike('first_name', `%${firstName}%`);
                    
                if (isMarriedFemale && middleName) {
                    query = query.or(`last_name.ilike.%${lastName}%,last_name.ilike.%${middleName}%`);
                } else {
                    query = query.ilike('last_name', `%${lastName}%`);
                }

                const { data: matches, error } = await query;
                    
                 if (error) throw error;
                 
                 if (!matches || matches.length === 0) {
                    if (isMarriedFemale && middleName) {
                        throw new Error(`No matching alumni record found for ${firstName} ${lastName} (or maiden name ${middleName}). Please contact the registrar.`);
                    }
                    throw new Error(`No matching alumni record found for ${firstName} ${lastName}. Please contact the registrar.`);
                 }

                 // Check if there is a match with birthdate, otherwise default to first match
                 let matched = matches[0];
                 if (idData.birthdate && isValidDateFormat(idData.birthdate)) {
                     const parts = idData.birthdate.split('-');
                     const isoForm = `${parts[2]}-${parts[0]}-${parts[1]}`;
                     const bdMatch = matches.find((m: any) => m.birthdate === isoForm);
                     if (bdMatch) matched = bdMatch;
                 }

                 const { data: existingStudent } = await supabase
                    .from('students')
                    .select('id')
                    .ilike('first_name', `%${matched.first_name}%`)
                    .ilike('last_name', `%${matched.last_name}%`);
                    
                 if (existingStudent && existingStudent.length > 0) {
                    throw new Error("An account has already been registered for this alumni. Please log in.");
                 }

                 setMatchedRecord(matched);
                 setSignupStep('set-password');

            } catch (err: any) {
                setSignupError(err.message || "Document verification failed.");
            } finally {
                setLoading(false);
                setStatusMessage("");
            }
        };
    } catch (err) {
        setSignupError("Error processing document.");
        setLoading(false);
        setStatusMessage("");
    }
  };

  // Step 3: Registration Set Password
  const executeRegistration = async () => {
    if (!newPassword || newPassword.length < 6) {
        setSignupError("Password must be at least 6 characters.");
        return;
    }
    if (newPassword !== confirmPassword) {
        setSignupError("Passwords do not match.");
        return;
    }

    setLoading(true);
    setStatusMessage("Creating secure account...");

    try {
      const studentPayload = {
         student_number: `ALUMNI-${matchedRecord.id.substring(0,8).toUpperCase()}`,
         first_name: matchedRecord.first_name, 
         last_name: matchedRecord.last_name,
         middle_name: matchedRecord.middle_name || null,
         program: normalizeProgram(matchedRecord.course),
         year_level: normalizeBatchYear('', matchedRecord.date_graduated),
         email: matchedRecord.email || `${matchedRecord.first_name.toLowerCase()}.${matchedRecord.last_name.toLowerCase()}.${Math.floor(Math.random() * 1000)}@alumni.lu.edu.ph`,
         password: newPassword,
         birthdate: matchedRecord.birthdate, 
         enrollment_status: 'Alumni',
         is_first_login: false
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('students')
        .insert([studentPayload])
        .select()
        .single();

      if (insertError) throw insertError;

      setLoggedInStudentName(insertedData.first_name || "Alumni");
      setShowSuccessAnim(true);
      
      const studentWithSource = { ...insertedData, table_source: 'students' } as Student;

      setTimeout(() => {
          onLoginSuccess(studentWithSource);
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setSignupError(err.message || "Registration failed. Database error.");
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  const handlePortalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');

    try {
        if (portalType === 'admin') {
            const { data: adminData, error } = await supabase
                .from('admins')
                .select('*')
                .eq('username', portalUsername)
                .eq('password', portalPassword)
                .single();

            if (error || !adminData) {
                throw new Error("Invalid Administrator Credentials.");
            }

            setLoggedInStudentName("Admin");
            setShowSuccessAnim(true);
            setTimeout(() => {
                onAdminLoginSuccess({
                    id: adminData.id,
                    username: adminData.username
                });
            }, 1500);

        } else {
            const { data: hrData, error } = await supabase
                .from('human_resource')
                .select('*')
                .eq('username', portalUsername)
                .eq('password', portalPassword)
                .single();
            
            if (error || !hrData) {
                throw new Error("Invalid HR Credentials.");
            }

            setLoggedInStudentName("Human Resource");
            setShowSuccessAnim(true);
            setTimeout(() => {
                onHRLoginSuccess({
                    id: hrData.id,
                    company_name: hrData.company_name,
                    username: hrData.username
                });
            }, 1500);
        }

    } catch (err: any) {
        setLoginError(err.message || "Login Failed");
        setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');

    try {
      const cleanFirstName = alumniFirstName.trim();
      const cleanLastName = alumniLastName.trim();
      const cleanPassword = loginPassword.trim();
      
      if (!cleanFirstName || !cleanLastName) {
        throw new Error("Please enter your full name.");
      }
      
      let matchedStudent = null;
      let targetTable = 'students';

      const { data: students, error: studentsErr } = await supabase.from('students')
        .select('*')
        .ilike('first_name', `%${cleanFirstName}%`)
        .ilike('last_name', `%${cleanLastName}%`);

      if (studentsErr) throw new Error(studentsErr.message);

      if (students && students.length > 0) {
          matchedStudent = students.find(s => s.password === cleanPassword);
          targetTable = 'students';
      }

      if (!matchedStudent) {
          const { data: alumni, error: alumniErr } = await supabase.from('alumni')
            .select('*')
            .ilike('first_name', `%${cleanFirstName}%`)
            .ilike('last_name', `%${cleanLastName}%`);
            
          if (!alumniErr && alumni && alumni.length > 0) {
              matchedStudent = alumni.find(s => s.password === cleanPassword);
              targetTable = 'alumni';
          }
      }

      if (!matchedStudent) {
          throw new Error("Invalid Credentials or Account Not Found. Please check your spelling and password.");
      }

      setLoggedInStudentName(matchedStudent.first_name);
      setShowSuccessAnim(true);
      
      const studentWithSource = { ...matchedStudent, table_source: targetTable } as Student;

      try {
          const courseName = matchedStudent.program || 'Unknown Course';
          const today = new Date().toISOString().split('T')[0];
          
          await supabase.from('alumni_visit_logs').insert([{
              alumni_id: matchedStudent.id,
              course_name: courseName,
              visit_date: today
          }]);
      } catch (visitErr) {}

      setTimeout(() => {
        onLoginSuccess(studentWithSource);
      }, 3500);

    } catch (err: any) {
      setLoginError(err.message || "Login failed due to an unexpected error.");
      setLoading(false);
    }
  };

  const toggleAuth = () => {
    setIsLogin(!isLogin);
    setLoginError('');
    setSignupError('');
    setSignupStep('upload-id');
    setStatusMessage("");
    setIsPortalMode(false);
    setMatchedRecord(null);
  };

  if (showSuccessAnim) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-4">
        <div className="absolute inset-0 bg-green-50 bg-opacity-50 backdrop-blur-sm"></div>
        <div className="relative flex flex-col items-center animate-slide-up z-10 p-10 bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl max-w-sm w-full border border-white/50">
           <div className="w-24 h-24 mb-6 bg-green-100 rounded-full flex items-center justify-center relative shadow-inner">
             <div className="absolute inset-0 rounded-full border-4 border-luGreen opacity-30 animate-ping"></div>
             <CheckCircle className="w-12 h-12 text-luGreen" />
           </div>
           <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center font-display">Welcome Back!</h2>
           <p className="text-xl text-luGold-dark font-medium mb-8 text-center">{loggedInStudentName}</p>
           <div className="flex items-center space-x-3 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full">
              <Loader2 className="w-4 h-4 animate-spin text-luGreen" />
              <span>Redirecting...</span>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 relative overflow-hidden flex flex-col font-sans selection:bg-luGreen selection:text-white">
      
      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowHelp(false)}></div>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-slide-up">
                <div className="bg-gradient-to-r from-luGreen to-luGreen-dark p-6 text-white relative">
                    <h3 className="text-2xl font-bold font-display">How it Works</h3>
                    <p className="opacity-80 text-sm mt-1">AI-Powered Registration System</p>
                    <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors">
                        <XCircle size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                        <h4 className="font-bold text-luGreen text-sm uppercase tracking-wide mb-2">Account Categories</h4>
                        <ul className="text-sm text-gray-600 space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-luGold-dark font-bold">•</span>
                                <span><strong>Alumni:</strong> Refers to graduates from Laguna University. Find your pre-registered record by uploading an ID or document.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">1. Upload Document or ID</h4>
                            <p className="text-sm text-gray-600 leading-relaxed mt-1">Upload your Certificate of Registration, Diploma/TOR, or any valid ID.</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 text-luGreen">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">2. Match & Secure</h4>
                            <p className="text-sm text-gray-600 leading-relaxed mt-1">Our AI extracts your info to match it with our records so you can set your password instantly.</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
                    <button onClick={() => setShowHelp(false)} className="text-luGreen font-bold text-sm hover:underline">
                        Got it, thanks!
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Modern Background with Blobs */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-gradient-to-br from-green-50 via-white to-yellow-50">
         <div className="absolute top-0 -left-4 w-72 h-72 bg-luGreen-light rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
         <div className="absolute top-0 -right-4 w-72 h-72 bg-luGold rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
         <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
         <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(#004d00 1px, transparent 1px)`, backgroundSize: '24px 24px' }}></div>
      </div>
      
      {/* Help Button Absolute Position */}
      <button 
        onClick={() => setShowHelp(true)}
        className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all text-sm font-semibold text-luGreen hover:text-luGreen-dark cursor-pointer border border-green-100"
      >
        <HelpCircle size={18} />
        <span className="hidden sm:inline">How it works</span>
      </button>

      <div className="flex-grow container mx-auto px-4 z-10 flex flex-col xl:flex-row items-center justify-center gap-12 xl:gap-20 min-h-screen py-8">
        <div className="w-full xl:w-5/12 text-center xl:text-left space-y-8 relative animate-slide-up">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-green-100 text-luGreen-dark font-semibold text-xs shadow-sm cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-luGold opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-luGold-dark"></span>
              </span>
              <span>Official Alumni Portal</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-display leading-tight text-gray-900">
              Laguna <span className="text-luGreen">University</span> <br/>
              <span className="text-4xl md:text-5xl lg:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-luGold-dark to-yellow-500">Alumni Tracer</span>
            </h1>
            
            <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto xl:mx-0 font-normal border-l-4 border-luGold pl-4">
              Reconnect with your alma mater, update your professional journey, and help us shape the future of education.
            </p>
        </div>

        <div className="w-full max-w-4xl min-h-[650px] md:h-[650px] bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_50px_100px_-10px_rgba(0,0,0,0.3)] flex relative overflow-hidden flex-col md:block transform transition-all duration-500 border border-white/60 animate-fade-in">
            <div 
                className={`hidden md:flex absolute top-0 h-full w-1/2 bg-cover bg-center transition-all duration-700 ease-in-out z-20 flex-col justify-center items-center text-white px-12 text-center shadow-2xl
                ${isLogin ? 'left-0 rounded-r-[3rem]' : 'left-1/2 rounded-l-[3rem]'}
                `}
                style={{ backgroundImage: `linear-gradient(135deg, #004200 0%, #006400 100%)` }}
            >
                <div className={`relative z-10 transform transition-all duration-700 flex flex-col items-center ${isLogin ? 'translate-x-0 opacity-100' : 'translate-x-[50px] opacity-0 hidden'}`}>
                    <h2 className="text-4xl font-bold mb-4 font-display text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FCE68A]">Welcome Back!</h2>
                    <p className="mb-8 text-green-50/90 font-light text-base leading-relaxed">Your journey continues here. Log in to access your alumni dashboard.</p>
                    <button onClick={toggleAuth} className="px-8 py-3 rounded-xl bg-white/10 border border-white/40 shadow-lg hover:bg-white hover:text-luGreen-dark hover:scale-105 active:scale-95 transition-all text-sm font-semibold tracking-wide">
                        CREATE ACCOUNT
                    </button>
                </div>
                <div className={`relative z-10 transform transition-all duration-700 flex flex-col items-center ${!isLogin ? 'translate-x-0 opacity-100' : '-translate-x-[50px] opacity-0 hidden'}`}>
                    <h2 className="text-4xl font-bold mb-4 font-display text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FCE68A]">Join the Network</h2>
                    <p className="mb-8 text-green-50/90 font-light text-base leading-relaxed">Verify your identity and join the official community.</p>
                    <button onClick={toggleAuth} className="px-8 py-3 rounded-xl bg-white/10 border border-white/40 shadow-lg hover:bg-white hover:text-luGreen-dark hover:scale-105 active:scale-95 transition-all text-sm font-semibold tracking-wide">
                        LOG IN INSTEAD
                    </button>
                </div>
            </div>

            <div className="w-full flex-1 md:h-full md:block relative">
                <div className={`w-full md:w-1/2 h-full flex flex-col px-8 sm:px-12 py-8 transition-all duration-700 relative md:absolute md:top-0 md:right-0 ${isLogin ? 'flex opacity-100 z-10 md:translate-x-0' : 'hidden md:flex opacity-0 z-0 pointer-events-none md:translate-x-20'}`}>
                    <div className="flex-grow flex flex-col justify-center">
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-900 font-display">{isPortalMode ? 'Management Portal' : 'Alumni Sign In'}</h1>
                            <p className="text-gray-400 mt-2 text-sm flex items-center gap-2"><span className="w-8 h-[1px] bg-luGold"></span>{isPortalMode ? 'Admin & HR Access' : 'Access your profile'}</p>
                        </div>

                        {!isPortalMode ? (
                            <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="group col-span-2 sm:col-span-1">
                                        <label className="block text-gray-600 text-[10px] font-bold mb-1 ml-1 uppercase tracking-wider">First Name</label>
                                        <input 
                                            type="text" 
                                            value={alumniFirstName}
                                            onChange={(e) => setAlumniFirstName(e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-luGreen focus:bg-white focus:outline-none transition-all text-sm font-medium"
                                            placeholder="Juan" required
                                        />
                                    </div>
                                    <div className="group col-span-2 sm:col-span-1">
                                        <label className="block text-gray-600 text-[10px] font-bold mb-1 ml-1 uppercase tracking-wider">Last Name</label>
                                        <input 
                                            type="text" 
                                            value={alumniLastName}
                                            onChange={(e) => setAlumniLastName(e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-luGreen focus:bg-white focus:outline-none transition-all text-sm font-medium"
                                            placeholder="Dela Cruz" required
                                        />
                                    </div>
                                </div>
                                <div className="group">
                                    <label className="block text-gray-600 text-[10px] font-bold mb-1 ml-1 uppercase tracking-wider">Password</label>
                                    <div className="relative">
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-luGreen focus:bg-white focus:outline-none transition-all text-sm font-medium"
                                        placeholder="••••••••" required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-luGreen">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                                    </div>
                                    <div className="flex justify-end mt-1.5 mr-1">
                                        <button type="button" onClick={(e) => { e.preventDefault(); /* TODO: Implement forgot password */ }} className="text-[10px] font-bold text-luGreen hover:underline">Forgot password?</button>
                                    </div>
                                </div>
                                
                                {loginError && (
                                    <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg flex items-start animate-fade-in border border-red-100"><AlertCircle size={14} className="mr-2 mt-0.5" /><span>{loginError}</span></div>
                                )}
                                <button type="submit" disabled={loading} className="w-full bg-luGreen text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-luGreen-dark text-sm mt-4">{loading ? <Loader2 className="animate-spin mx-auto w-5 h-5"/> : 'SIGN IN'}</button>
                            </form>
                        ) : (
                            <form onSubmit={handlePortalLogin} className="space-y-4 animate-fade-in">
                                <div className="flex bg-gray-100 p-1 rounded-xl mb-2 relative">
                                    <button type="button" onClick={() => setPortalType('admin')} className={`flex-1 py-2 text-xs font-bold uppercase transition-colors ${portalType === 'admin' ? 'bg-white shadow-sm text-blue-600 rounded-lg' : 'text-gray-500'}`}>Admin</button>
                                    <button type="button" onClick={() => setPortalType('hr')} className={`flex-1 py-2 text-xs font-bold uppercase transition-colors ${portalType === 'hr' ? 'bg-white shadow-sm text-blue-600 rounded-lg' : 'text-gray-500'}`}>HR</button>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-[10px] font-bold mb-1 tracking-wider uppercase">Username</label>
                                    <input type="text" value={portalUsername} onChange={(e)=>setPortalUsername(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-sm" required/>
                                </div>
                                <div className="relative">
                                    <label className="block text-gray-600 text-[10px] font-bold mb-1 tracking-wider uppercase">Password</label>
                                    <input type={showPassword ? "text" : "password"} value={portalPassword} onChange={(e)=>setPortalPassword(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-sm" required/>
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-[32px] text-gray-400 hover:text-blue-500">{showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                                </div>
                                {loginError && <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg">{loginError}</div>}
                                <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl text-sm">{loading ? <Loader2 className="animate-spin mx-auto w-5 h-5"/> : 'SECURE LOGIN'}</button>
                            </form>
                        )}
                    </div>
                    
                    <div className="mt-auto pt-6 border-t border-gray-100 w-full">
                        <button type="button" onClick={() => { setIsPortalMode(!isPortalMode); setLoginError(''); setPortalUsername(''); setPortalPassword(''); setPortalType('admin'); }} className="w-full group flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-luGreen/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-200 rounded-lg text-gray-500 group-hover:bg-luGreen group-hover:text-white transition-colors"><ShieldCheck size={18} /></div>
                                <div className="text-left">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isPortalMode ? 'Switch Portal' : 'Restricted Access'}</p>
                                    <p className="text-xs font-bold text-gray-700">{isPortalMode ? 'Back to User Login' : 'Admin & HR Portal'}</p>
                                </div>
                            </div>
                            <ArrowRight size={16} className="text-gray-300 group-hover:text-luGreen transition-colors" />
                        </button>
                    </div>
                    
                    <div className="mt-4 text-center md:hidden pb-2">
                        <p className="text-gray-500 text-sm">Don't have an account?</p>
                        <button onClick={toggleAuth} className="text-luGreen font-bold mt-1 text-sm">Sign Up Now</button>
                    </div>
                </div>

                <div className={`w-full md:w-1/2 h-full flex flex-col justify-center px-8 sm:px-12 py-10 transition-all duration-700 md:absolute md:top-0 md:left-0 ${!isLogin ? 'flex opacity-100 z-10 md:translate-x-0' : 'hidden md:flex opacity-0 z-0 pointer-events-none md:translate-x-20'}`}>
                    <div className="mb-4">
                        <h1 className="text-3xl font-bold text-gray-900 font-display">Create Account</h1>
                        <p className="text-gray-400 mt-2 text-sm flex items-center gap-2">
                            <span className="w-8 h-[1px] bg-luGold"></span> 
                            {signupStep === 'upload-id' && 'Upload proof of alumni status'}
                            {signupStep === 'set-password' && 'Verify identity & secure account'}
                        </p>
                    </div>

                    {signupError && <div className="mb-4 p-3 bg-red-50 text-red-800 text-xs rounded-lg flex items-start border border-red-100"><XCircle size={14} className="mr-2 mt-0.5" /><span>{signupError}</span></div>}
                    {statusMessage && loading && <div className="mb-4 p-3 bg-blue-50 text-blue-800 text-xs rounded-lg flex items-center"><Loader2 size={14} className="mr-2 animate-spin" /><span>{statusMessage}</span></div>}

                    {signupStep === 'upload-id' && (
                        <div className="animate-fade-in relative space-y-4">
                             <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800 leading-relaxed">
                                <p className="font-bold mb-1">Alumni Verification</p>
                                Please upload an ID or supporting documents (like a Diploma or Transcript) that proves you are an alumni of Laguna University.
                            </div>
                            <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100">
                                <FileUpload onFileSelect={handleIdProcess} isLoading={loading} label="Upload ID or Document" acceptCamera={true} />
                            </div>
                            <div className="flex items-center gap-2 px-2">
                                <input 
                                    type="checkbox" 
                                    id="marriedFemale" 
                                    checked={isMarriedFemale}
                                    onChange={(e) => setIsMarriedFemale(e.target.checked)}
                                    className="w-4 h-4 text-luGreen border-gray-300 rounded focus:ring-luGreen accent-luGreen"
                                />
                                <label htmlFor="marriedFemale" className="text-xs text-gray-600 font-medium cursor-pointer">
                                    I am a married female alumni.
                                </label>
                            </div>
                            <div className="text-center mt-8 md:hidden">
                                <button onClick={toggleAuth} className="text-gray-500 font-medium text-sm hover:text-luGreen">Back to Login</button>
                            </div>
                        </div>
                    )}

                    {signupStep === 'set-password' && matchedRecord && (
                        <div className="animate-fade-in space-y-5">
                             <div className="p-4 bg-green-50 border border-green-200 rounded-2xl relative overflow-hidden">
                                 <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle size={64}/></div>
                                 <p className="text-xs font-bold text-luGreen uppercase tracking-wider mb-2">Record Found</p>
                                 <div className="space-y-1 relative z-10">
                                     <p className="text-xl font-bold text-gray-800">{matchedRecord.first_name} {matchedRecord.last_name}</p>
                                     <p className="text-sm font-medium text-gray-600">{matchedRecord.course}</p>
                                     <p className="text-xs text-gray-500">Graduated: {matchedRecord.date_graduated ? new Date(matchedRecord.date_graduated).getFullYear() : 'N/A'}</p>
                                 </div>
                             </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Create Password</label>
                                    <div className="relative">
                                        <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 text-sm focus:border-luGreen focus:bg-white outline-none" placeholder="••••••••"/>
                                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-luGreen transition-colors focus:outline-none">
                                            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Confirm Password</label>
                                    <div className="relative">
                                        <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3.5 text-sm focus:border-luGreen focus:bg-white outline-none" placeholder="••••••••"/>
                                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-luGreen transition-colors focus:outline-none">
                                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="pt-2 flex gap-3">
                                    <button onClick={() => setSignupStep('upload-id')} className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-bold transition-colors">Back</button>
                                    <button onClick={executeRegistration} disabled={loading} className="flex-1 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold shadow-md transition-all flex justify-center">
                                        {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto"/> : 'Complete Registration'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export default AuthPage;
