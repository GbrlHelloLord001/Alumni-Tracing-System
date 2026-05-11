
import React, { useState, useRef } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Database, Trash2, ArrowRight, UserPlus, FileText, ChevronRight, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { Graduate } from '../types';

const COMMON_COURSES = [
  'Bachelor of Elementary Education',
  'Bachelor of Secondary Education major in Biological Science',
  'Bachelor of Secondary Education major in English',
  'Bachelor of Secondary Education major in Mathematics',
  'Bachelor of Secondary Education major in Science',
  'Bachelor of Science in Accounting Technology',
  'Bachelor of Science in Mechanical Engineering',
  'Bachelor of Science in Entrepreneurship',
  'Bachelor of Arts in Communication',
  'Bachelor of Science in Computer Science',
  'Bachelor of Science in Information Technology',
  'Bachelor of Science in Tourism Management',
  'Bachelor of Science in Accountancy',
  'Bachelor of Science in Accounting Information System',
  'Bachelor of Science in Information Technology - Business Analytics',
  'Bachelor of Science in Information Technology - System Development',
  'Bachelor of Science in Computer Science - Data Science',
  'Diploma in Midwifery'
];

const GraduateImport: React.FC = () => {
  const [importMode, setImportMode] = useState<'bulk' | 'manual'>('bulk');
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<Graduate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Form State
  const [manualForm, setManualForm] = useState<Graduate>({
    student_number: '',
    last_name: '',
    first_name: '',
    middle_name: '',
    course: '',
    date_graduated: '',
    birthdate: '',
    email: '',
  });

  const downloadTemplate = () => {
    const ws_data = [
      ["Student Number", "Last Name (L-name)", "First Name (F_name)", "Middle Name (M_name)", "Course", "Graduated (Dt-grad)", "Birthdate", "Email Address"],
      ["221-3028", "DOE", "JOHN", "SMITH", "Bachelor of Science in Information Technology", "July 2, 2024", "10/20/1998", "john.doe@email.com"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    
    // Set column widths
    const wscols = [
      {wch: 15}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 40}, {wch: 20}, {wch: 15}, {wch: 30}
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Graduates");
    XLSX.writeFile(wb, "LU_Graduates_Template.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" && !selectedFile.name.endsWith('.xlsx')) {
        setError("Please upload a valid .xlsx file");
        return;
      }
      setFile(selectedFile);
      setError(null);
      parseExcel(selectedFile);
    }
  };

  const parseExcel = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true, cellNF: false, cellText: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'mm/dd/yyyy' }) as any[][];

        // Skip header row
        const rows = json.slice(1);
        const graduates: Graduate[] = rows.filter(row => row.length > 0 && (row[1] || row[7])).map(row => ({
          student_number: String(row[0] || '').trim(),
          last_name: String(row[1] || '').trim(),
          first_name: String(row[2] || '').trim(),
          middle_name: String(row[3] || '').trim(),
          course: String(row[4] || '').trim(),
          date_graduated: String(row[5] || '').trim(),
          birthdate: String(row[6] || '').trim(),
          email: String(row[7] || '').trim()
        }));

        const missingCore = graduates.filter(g => !g.last_name || !g.first_name || !g.email);
        if (missingCore.length > 0) {
          setError(`${missingCore.length} rows are missing Names or Emails and will be skipped. Other rows are valid.`);
        }

        if (graduates.length === 0) {
          throw new Error("No data found in the sheet. Please ensure the template is followed.");
        }

        setExtractedData(graduates);
      } catch (err: any) {
        setError(err.message || "Failed to parse excel file");
        setFile(null);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const formatDateForDB = (val: string | undefined): string | null => {
    if (!val || val === 'undefined' || val.trim() === '') return null;
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    } catch (e) {
      return null;
    }
  };

  const [uploadProgress, setUploadProgress] = useState(0);

  const saveToDatabase = async () => {
    if (extractedData.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      // Map extracted data to DB schema
      const dataToInsert = extractedData.map((g, idx) => {
        // We still need at least a name and email to identify the person
        if (!g.last_name || !g.first_name || !g.email) {
          console.warn(`Row ${idx + 2} skipped: Missing core identifier (Name or Email)`);
          return null;
        }

        const formattedBirthdate = formatDateForDB(g.birthdate);
        
        const payload: any = {
          last_name: g.last_name,
          first_name: g.first_name,
          email: g.email,
          is_first_login: true
        };

        if (g.student_number) payload.student_number = g.student_number;
        if (g.middle_name) payload.middle_name = g.middle_name;
        if (g.course) payload.course = g.course;
        
        const formattedGradDate = formatDateForDB(g.date_graduated);
        if (formattedGradDate) payload.date_graduated = formattedGradDate;
        
        if (formattedBirthdate) payload.birthdate = formattedBirthdate;

        return payload;
      }).filter((val): val is any => val !== null);

      if (dataToInsert.length === 0) {
        throw new Error("No valid records found to import. Ensure names and emails are provided.");
      }

      // Chunk size (e.g., 500 records per request)
      const CHUNK_SIZE = 500;
      const totalChunks = Math.ceil(dataToInsert.length / CHUNK_SIZE);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = start + CHUNK_SIZE;
        const chunk = dataToInsert.slice(start, end);

        const { error } = await supabase
          .from('graduates_import')
          .upsert(chunk, { onConflict: 'email', ignoreDuplicates: true });

        if (error) {
          throw error;
        }
        
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      setSuccess(`Import process complete! Any new graduates have been successfully added to the database.`);
      setExtractedData([]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error("Import Error:", err);
      // More descriptive error for fetch failures
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setError("Network Error: The connection was interrupted. This usually happens with very large files. Try refreshing or using a smaller batch.");
      } else {
        setError(err.message || "An error occurred while saving to the database.");
      }
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const removeFile = () => {
    setFile(null);
    setExtractedData([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.first_name || !manualForm.last_name || !manualForm.email) {
      setError("Names and Email are required for manual entry.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const dataToInsert: any = {
        last_name: manualForm.last_name,
        first_name: manualForm.first_name,
        email: manualForm.email,
        is_first_login: true
      };
      
      if (manualForm.student_number) dataToInsert.student_number = manualForm.student_number;
      if (manualForm.middle_name) dataToInsert.middle_name = manualForm.middle_name;
      if (manualForm.course) dataToInsert.course = manualForm.course;
      
      const manualGradDate = formatDateForDB(manualForm.date_graduated);
      if (manualGradDate) dataToInsert.date_graduated = manualGradDate;
      
      const manualBirthDate = formatDateForDB(manualForm.birthdate);
      if (manualBirthDate) dataToInsert.birthdate = manualBirthDate;

      const { error } = await supabase
        .from('graduates_import')
        .upsert([dataToInsert], { onConflict: 'email', ignoreDuplicates: true });

      if (error) throw error;

      setSuccess(`Graduate ${manualForm.first_name} ${manualForm.last_name} has been added successfully!`);
      setManualForm({
        student_number: '',
        last_name: '',
        first_name: '',
        middle_name: '',
        course: '',
        date_graduated: '',
        birthdate: '',
        email: '',
      });
    } catch (err: any) {
      console.error("Manual Entry Error:", err);
      setError(err.message || "Failed to save the record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/80 shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="p-8 border-b border-white/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <Database className="text-blue-600" /> Graduate Records
            </h2>
            <div className="flex items-center gap-1 mt-2">
               <button 
                onClick={() => { setImportMode('bulk'); setError(null); setSuccess(null); }}
                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${importMode === 'bulk' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/50 text-slate-400 hover:bg-white'}`}
               >
                 BULK IMPORT
               </button>
               <button 
                onClick={() => { setImportMode('manual'); setError(null); setSuccess(null); }}
                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${importMode === 'manual' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/50 text-slate-400 hover:bg-white'}`}
               >
                 MANUAL ADD
               </button>
            </div>
          </div>
          {importMode === 'bulk' && (
            <button 
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-blue-100 text-blue-600 rounded-2xl text-sm font-bold shadow-sm hover:shadow-md hover:bg-blue-50 transition-all active:translate-y-px"
            >
              <Download size={18} />
              Download Template
            </button>
          )}
        </div>

        <div className="p-8">
          {/* Main Content Area */}
          <AnimatePresence mode="wait">
            {importMode === 'bulk' ? (
              <motion.div 
                key="bulk-mode"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {!file ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center group hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer relative"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform shadow-inner">
                      <Upload size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">Click or Drag to Upload</h3>
                    <p className="text-slate-400 text-sm mt-1 mb-8 max-w-xs font-medium">Please use the official template for best results (.xlsx format only)</p>
                    
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".xlsx"
                      className="hidden"
                    />
                    
                    <div className="flex flex-wrap justify-center gap-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                         Check Names
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                         Email Formats
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                         Date Formats
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    {/* File Info Card */}
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                          <FileSpreadsheet size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">{file.name}</h4>
                          <p className="text-xs text-slate-500 font-medium">{extractedData.length} records detected</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={removeFile}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          title="Remove File"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button 
                          onClick={saveToDatabase}
                          disabled={saving || extractedData.length === 0}
                          className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0 relative overflow-hidden"
                        >
                          {saving && (
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                              className="absolute inset-0 bg-blue-500/30 pointer-events-none"
                            />
                          )}
                          {saving ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
                          <span className="relative z-10">
                            {saving ? `IMPORTING (${uploadProgress}%)` : "COMMIT TO DATABASE"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Status Messages for Bulk */}
                    <AnimatePresence>
                      {error && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-bold"
                        >
                          <AlertCircle size={16} className="shrink-0" />
                          <span>{error}</span>
                        </motion.div>
                      )}
                      {success && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 text-xs font-bold"
                        >
                          <CheckCircle size={16} className="shrink-0" />
                          <span>{success}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Data Preview */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <h5 className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Data Preview</h5>
                        <span className="text-[10px] text-slate-400 font-bold">Showing first 10 rows</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <tr>
                              <th className="px-6 py-4">Name</th>
                              <th className="px-6 py-4">Course</th>
                              <th className="px-6 py-4">Graduated</th>
                              <th className="px-6 py-4">Birthdate</th>
                              <th className="px-6 py-4">Email</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {extractedData.slice(0, 10).map((item, idx) => {
                              const isBirthdateMissing = !item.birthdate || item.birthdate === 'undefined' || item.birthdate.trim() === '';
                              const isEmailMissing = !item.email || item.email === 'undefined' || item.email.trim() === '';
                              
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm font-bold text-slate-700">
                                      {item.first_name} {item.middle_name ? `${item.middle_name.charAt(0)}.` : ''} {item.last_name}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`text-xs font-medium truncate max-w-[200px] block ${!item.course ? 'text-slate-300 italic' : 'text-slate-500'}`}>
                                      {item.course || 'NOT PROVIDED'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-xs text-slate-500 font-medium">{item.date_graduated}</span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`text-xs font-medium ${isBirthdateMissing ? 'text-amber-500/60 italic' : 'text-slate-500'}`}>
                                      {isBirthdateMissing ? 'OPTIONAL' : item.birthdate}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`text-xs font-bold ${isEmailMissing ? 'text-red-500 bg-red-50 px-2 py-1 rounded-md' : 'text-blue-600'}`}>
                                      {isEmailMissing ? 'REQUIRED' : item.email}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {extractedData.length > 10 && (
                        <div className="px-6 py-4 bg-slate-50/30 text-center border-t border-slate-50">
                          <p className="text-[11px] font-bold text-slate-400 italic">And {extractedData.length - 10} more rows...</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="manual-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto"
              >
                <form onSubmit={handleManualSubmit} className="space-y-8">
                  {/* Form Header */}
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                      <UserPlus size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">Add Single Graduate</h3>
                      <p className="text-slate-500 text-xs font-medium">Manually enter details for a specific individual.</p>
                    </div>
                  </div>

                  {/* Errors/Success for Manual */}
                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-bold"
                      >
                        <AlertCircle size={16} />
                        <span>{error}</span>
                      </motion.div>
                    )}
                    {success && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 text-xs font-bold"
                      >
                        <CheckCircle size={16} />
                        <span>{success}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Unique Identifier */}
                    <div className="space-y-4 md:col-span-2">
                       <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest px-1">University Identifier</label>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5 w-1/2">
                            <label className="text-xs font-bold text-slate-600 ml-1">Student Number</label>
                            <input 
                              type="text"
                              value={manualForm.student_number || ''}
                              onChange={(e) => setManualForm({...manualForm, student_number: e.target.value})}
                              className="w-full bg-slate-50/50 border-slate-200 border-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:scale-[1.01] outline-none transition-all placeholder:text-slate-300 shadow-sm hover:border-slate-300"
                              placeholder="e.g. 221-3028"
                              pattern="\d{3}-\d{4}"
                              title="Format: 000-0000"
                            />
                          </div>
                       </div>
                    </div>

                    {/* Names Section */}
                    <div className="space-y-4 md:col-span-2">
                       <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest px-1">Full Identity</label>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 ml-1">First Name</label>
                            <input 
                              type="text"
                              value={manualForm.first_name}
                              onChange={(e) => setManualForm({...manualForm, first_name: e.target.value})}
                              className="w-full bg-slate-50/50 border-slate-200 border-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:scale-[1.01] outline-none transition-all placeholder:text-slate-300 shadow-sm hover:border-slate-300"
                              placeholder="e.g. John"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 ml-1">Middle Name</label>
                            <input 
                              type="text"
                              value={manualForm.middle_name}
                              onChange={(e) => setManualForm({...manualForm, middle_name: e.target.value})}
                              className="w-full bg-slate-50/50 border-slate-200 border-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:scale-[1.01] outline-none transition-all placeholder:text-slate-300 shadow-sm hover:border-slate-300"
                              placeholder="Optional"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 ml-1">Last Name</label>
                            <input 
                              type="text"
                              value={manualForm.last_name}
                              onChange={(e) => setManualForm({...manualForm, last_name: e.target.value})}
                              className="w-full bg-slate-50/50 border-slate-200 border-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:scale-[1.01] outline-none transition-all placeholder:text-slate-300 shadow-sm hover:border-slate-300"
                              placeholder="e.g. Doe"
                              required
                            />
                          </div>
                       </div>
                    </div>

                    {/* Email & Birthdate */}
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest px-1">Contact & Personal</label>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 ml-1">Email Address</label>
                        <input 
                          type="email"
                          value={manualForm.email}
                          onChange={(e) => setManualForm({...manualForm, email: e.target.value})}
                          className="w-full bg-slate-50/50 border-slate-200 border-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:scale-[1.01] outline-none transition-all placeholder:text-slate-300 shadow-sm hover:border-slate-300"
                          placeholder="john.doe@university.edu"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 ml-1">Birthdate</label>
                        <input 
                          type="date"
                          value={manualForm.birthdate}
                          onChange={(e) => setManualForm({...manualForm, birthdate: e.target.value})}
                          className="w-full bg-slate-50/50 border-slate-200 border-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:scale-[1.01] outline-none transition-all placeholder:text-slate-300 shadow-sm hover:border-slate-300"
                        />
                      </div>
                    </div>

                    {/* Academic Section */}
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest px-1">Academic Status</label>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 ml-1">Course/Program</label>
                        <input 
                          type="text"
                          value={manualForm.course}
                          onChange={(e) => setManualForm({...manualForm, course: e.target.value})}
                          className="w-full bg-slate-50/50 border-slate-200 border-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:scale-[1.01] outline-none transition-all placeholder:text-slate-300 shadow-sm hover:border-slate-300"
                          placeholder="Bachelor of Science in..."
                          list="course-list"
                        />
                        <datalist id="course-list">
                          {COMMON_COURSES.map(course => (
                            <option key={course} value={course} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 ml-1">Date Graduated</label>
                        <input 
                          type="date"
                          value={manualForm.date_graduated}
                          onChange={(e) => setManualForm({...manualForm, date_graduated: e.target.value})}
                          className="w-full bg-slate-50/50 border-slate-200 border-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:scale-[1.01] outline-none transition-all placeholder:text-slate-300 shadow-sm hover:border-slate-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submission */}
                  <div className="pt-6 border-t border-slate-100 flex justify-end">
                     <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-10 py-4 bg-blue-600 text-white rounded-[1.25rem] text-sm font-black shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-1 transition-all disabled:opacity-50"
                     >
                       {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                       {saving ? "SAVING..." : "ADD TO DATABASE"}
                     </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Guide */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col gap-3">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 font-black text-lg">1</div>
              <h4 className="font-bold text-slate-800 text-sm">Download Template</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Start with our official Excel template to ensure columns are mapped correctly.</p>
            </div>
            <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col gap-3">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600 font-black text-lg">2</div>
              <h4 className="font-bold text-slate-800 text-sm">Fill & Validate</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Enter graduate details. Duplicate emails will be skipped automatically during import.</p>
            </div>
            <div className="p-6 bg-purple-50/50 rounded-2xl border border-purple-100 flex flex-col gap-3">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-600 font-black text-lg">3</div>
              <h4 className="font-bold text-slate-800 text-sm">Upload & Confirm</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Preview the extracted data and click Commit to synchronize with the main database.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GraduateImport;
