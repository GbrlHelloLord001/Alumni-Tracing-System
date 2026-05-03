
import { supabase } from '../lib/supabaseClient';
import { JobPosting, JobApplication, JobMessage, Student } from '../types';

// --- JOBS ---

export const getHRJobs = async (hrId: number) => {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('hr_id', hrId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // Get applicant counts for each job
  const jobs = data as JobPosting[];
  for (let job of jobs) {
    const { count } = await supabase
      .from('job_applications')
      .select('*', { count: 'exact', head: true })
      .eq('job_posting_id', job.id);
    job.applicant_count = count || 0;
  }
  
  return jobs;
};

// New: Get all active jobs for students
export const getOpenJobs = async () => {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as JobPosting[];
};

export const createJob = async (job: Partial<JobPosting>) => {
  const { data, error } = await supabase
    .from('job_postings')
    .insert([job])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateJob = async (id: string, updates: Partial<JobPosting>) => {
  const { data, error } = await supabase
    .from('job_postings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteJob = async (id: string) => {
  const { error } = await supabase
    .from('job_postings')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// --- APPLICATIONS ---

export const getHRApplications = async (hrId: number) => {
  // First get all jobs by this HR
  const { data: jobs } = await supabase
    .from('job_postings')
    .select('id, job_title, company_name')
    .eq('hr_id', hrId);

  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map(j => j.id);

  // Get applications for these jobs
  const { data: applications, error } = await supabase
    .from('job_applications')
    .select('*')
    .in('job_posting_id', jobIds)
    .order('applied_at', { ascending: false });

  if (error) throw error;

  const results: JobApplication[] = [];

  // Populate details
  for (const app of applications) {
    const job = jobs.find(j => j.id === app.job_posting_id);
    let applicantDetails: Student | null = null;

    if (app.student_id) {
      const { data: student } = await supabase.from('students').select('*').eq('id', app.student_id).single();
      if (student) applicantDetails = { ...student, table_source: 'students' };
    } else if (app.alumni_id) {
      const { data: alumni } = await supabase.from('alumni').select('*').eq('id', app.alumni_id).single();
      if (alumni) applicantDetails = { ...alumni, table_source: 'alumni' };
    }

    if (applicantDetails) {
       // @ts-ignore
       results.push({
         ...app,
         job: job,
         applicant_details: applicantDetails
       });
    }
  }

  return results;
};

// New: Student Apply
export const applyForJob = async (jobId: string, userId: string, userType: 'student' | 'alumni') => {
    const payload: any = {
        job_posting_id: jobId,
        application_status: 'Pending',
        applied_at: new Date().toISOString()
    };
    
    if (userType === 'student') payload.student_id = userId;
    else payload.alumni_id = userId;

    const { data, error } = await supabase.from('job_applications').insert([payload]).select().single();
    if (error) throw error;
    return data;
};

// New: Get Student Applications
export const getUserApplications = async (userId: string, userType: 'student' | 'alumni') => {
    const idColumn = userType === 'student' ? 'student_id' : 'alumni_id';
    
    const { data, error } = await supabase
        .from('job_applications')
        .select(`
            *,
            job:job_postings(*)
        `)
        .eq(idColumn, userId)
        .order('applied_at', { ascending: false });

    if (error) throw error;
    return data as JobApplication[];
};

export const updateApplicationStatus = async (id: string, status: string) => {
  const { error } = await supabase
    .from('job_applications')
    .update({ application_status: status })
    .eq('id', id);

  if (error) throw error;
};

// --- MESSAGES ---

export const getMessages = async (applicationId: string) => {
  const { data, error } = await supabase
    .from('job_messages')
    .select('*')
    .eq('application_id', applicationId)
    .order('sent_at', { ascending: true });

  if (error) throw error;
  return data as JobMessage[];
};

export const sendMessage = async (message: Partial<JobMessage>) => {
  const { data, error } = await supabase
    .from('job_messages')
    .insert([message])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// --- RESUME HELPER ---
export const getResumeBlob = (hexString: string): string | null => {
    if (!hexString || !hexString.startsWith('\\x')) return null;
    
    // Convert hex string (Postgres bytea format \x...) to byte array
    const hex = hexString.substring(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
};
