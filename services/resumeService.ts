
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { supabase } from "../lib/supabaseClient";
import { FullProfileData, EducationInformation, EmploymentHistory, CommunityEngagement, AlumniAttributes } from "../types";

const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Models for Vision/Document tasks
const MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"];

// Define Schemas for AI Extraction

const personalSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    first_name: { type: Type.STRING },
    last_name: { type: Type.STRING },
    email: { type: Type.STRING },
    contact_no: { type: Type.STRING },
    address: { type: Type.STRING, description: "Extract the home address if present." }
  }
};

const educationSchema: Schema = {
  type: Type.OBJECT,
  description: "Educational background.",
  properties: {
    primary_school: { type: Type.STRING, description: "Name of elementary school(s)." },
    primary_year_graduated: { type: Type.STRING },
    secondary_school: { type: Type.STRING, description: "Name of high school(s)." },
    secondary_year_graduated: { type: Type.STRING },
    bachelors_degree: { type: Type.STRING, description: "Name of the degree/program" },
    bachelors_year_graduated: { type: Type.STRING },
    masters_degree: { type: Type.STRING },
    masters_year_graduated_or_units: { type: Type.STRING },
    doctoral_degree: { type: Type.STRING },
    doctoral_year_graduated_or_units: { type: Type.STRING },
    professional_license: { type: Type.STRING },
    license_date_passed: { type: Type.STRING },
    license_number: { type: Type.STRING }
  }
};

const employmentItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    employment_status: { type: Type.STRING, enum: ['Employed', 'Self-employed', 'Unemployed', 'Retired'] },
    job_alignment: { type: Type.STRING, enum: ['Related', 'Non-Related'] },
    position: { type: Type.STRING, description: "Job Title" },
    date_hired: { type: Type.STRING, description: "Start Date in YYYY-MM-DD format. If only year is known, use YYYY-01-01." },
    company_name: { type: Type.STRING },
    company_address: { type: Type.STRING },
    job_level: { type: Type.STRING },
    first_job_level: { type: Type.STRING },
    time_to_first_job: { type: Type.STRING },
    business_name: { type: Type.STRING },
    business_address: { type: Type.STRING },
    business_type: { type: Type.STRING },
    business_contact_no: { type: Type.STRING },
    unemployed_reasons: { type: Type.STRING },
    last_company: { type: Type.STRING },
    retirement_reason: { type: Type.STRING },
    date_retired: { type: Type.STRING },
    industry: { type: Type.STRING },
    is_current_job: { type: Type.BOOLEAN, description: "Set to TRUE if the date range includes 'Present', 'Current', or 'Now'." }
  }
};

const communityItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    organization_name: { type: Type.STRING },
    role: { type: Type.STRING },
    date_affiliated: { type: Type.STRING }
  }
};

const attributesSchema: Schema = {
  type: Type.OBJECT,
  description: "Estimated ratings (1-5) for graduate attributes based on resume keywords, experience, and skills.",
  properties: {
    // Institutional
    professionally_competent: { type: Type.INTEGER },
    critical_thinker: { type: Type.INTEGER },
    communicator: { type: Type.INTEGER },
    lifelong_learner: { type: Type.INTEGER },
    socially_responsible: { type: Type.INTEGER },
    ethical_citizen: { type: Type.INTEGER },
    innovative_worker: { type: Type.INTEGER },
    people_oriented: { type: Type.INTEGER },
    // 21st Century
    critical_thinking_skill: { type: Type.INTEGER },
    creativity: { type: Type.INTEGER },
    collaboration: { type: Type.INTEGER },
    communication_skill: { type: Type.INTEGER },
    information_literacy: { type: Type.INTEGER },
    media_literacy: { type: Type.INTEGER },
    technology_literacy: { type: Type.INTEGER },
    flexibility: { type: Type.INTEGER },
    leadership: { type: Type.INTEGER },
    initiative: { type: Type.INTEGER },
    productivity: { type: Type.INTEGER },
    social_skills: { type: Type.INTEGER },
  }
};

const fullResumeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    personal: personalSchema,
    education: educationSchema,
    employment: {
        type: Type.ARRAY,
        items: employmentItemSchema,
        description: "List of employment history records found in the resume."
    },
    community: {
        type: Type.ARRAY,
        items: communityItemSchema,
        description: "List of community engagement or volunteer work."
    },
    attributes: attributesSchema
  }
};

export const parseResume = async (base64Data: string, mimeType: string): Promise<Partial<FullProfileData>> => {
  const prompt = `
    Analyze this resume document and extract data into the structured JSON format.
    
    **CRITICAL INSTRUCTIONS:**
    
    1. **Dates**: Standardize all dates to **YYYY-MM-DD** format.
    2. **Employment**: 
       - If a job date range ends in "Present", "Current", or "Now", mark 'is_current_job' as TRUE.
       - Extract Company Name, Position, and Start Date ('date_hired').
       - If the job description implies ownership, set status to 'Self-employed'.
    
    3. **Attributes & Skills Analysis (Auto-Rating)**:
       - Analyze the candidate's experience, description, and skills section.
       - Estimate a rating from 1 (Low) to 5 (High) for the requested attributes (e.g., Leadership, Communication, Technology Literacy).
       - Example: If they have leadership roles, rate 'leadership' 4 or 5. If they use Python/Office, rate 'technology_literacy' 4 or 5.
    
    If a field is not explicitly found, return null or empty string.
  `;

  let lastError: any;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType, data: base64Data } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: fullResumeSchema
        }
      });
  
      if (response.text) {
        const data = JSON.parse(response.text);
        // Ensure arrays are initialized
        return {
          ...data,
          employment: data.employment || [],
          community: data.community || [],
          attributes: data.attributes || {} 
        };
      }
    } catch (error) {
      console.warn(`Model ${model} failed for resume parsing:`, error);
      lastError = error;
    }
  }
  
  console.error("All models failed for resume parsing:", lastError);
  throw new Error("Failed to parse resume. Please enter data manually.");
};

export const uploadResumeToDB = async (file: File, userId: string, userType: 'graduating' | 'alumni' | 'student' | 'students') => {
  const buffer = await file.arrayBuffer();
  const byteArray = new Uint8Array(buffer);
  let hexString = '\\x';
  for (let i = 0; i < byteArray.length; i++) {
    hexString += byteArray[i].toString(16).padStart(2, '0');
  }

  // Determine table based on userType/source
  const targetTable = (userType === 'alumni') ? 'alumni' : 'students';

  const { error } = await supabase
    .from(targetTable)
    .update({ resume: hexString })
    .eq('id', userId);

  if (error) throw error;
};

export const deleteResumeFromDB = async (userId: string, userType: 'graduating' | 'alumni' | 'student' | 'students') => {
    const targetTable = (userType === 'alumni') ? 'alumni' : 'students';
    const { error } = await supabase
        .from(targetTable)
        .update({ resume: null })
        .eq('id', userId);
    if (error) throw error;
};

// --- DATA PERSISTENCE & FETCHING ---

export const fetchLatestProfile = async (userId: string, userType: 'graduating' | 'alumni' | 'student' | 'students'): Promise<FullProfileData | null> => {
    // If 'student' is passed (from table_source='students'), map it to 'student_id'
    const idColumn = (userType === 'alumni') ? 'alumni_id' : 'student_id';

    // 1. Get ALL survey response IDs for this user, ordered by newest first
    const { data: surveys, error: surveyError } = await supabase
        .from('survey_responses')
        .select('id, submitted_at')
        .eq(idColumn, userId)
        .order('submitted_at', { ascending: false });

    if (surveyError || !surveys || surveys.length === 0) {
        return null; // No profile data saved yet
    }

    const surveyIds = surveys.map(s => s.id);

    // 2. Fetch related data across ALL surveys
    // We fetch everything and then aggregate/deduplicate to handle cases where 
    // partial surveys (like job status updates) are created without full profile copies.
    const [educationRes, employmentRes, communityRes, attributesRes] = await Promise.all([
        supabase.from('education_information').select('*').in('survey_response_id', surveyIds),
        supabase.from('employment_history').select('*').in('survey_response_id', surveyIds),
        supabase.from('community_engagement').select('*').in('survey_response_id', surveyIds),
        supabase.from('alumni_attributes').select('*').in('survey_response_id', surveyIds)
    ]);

    // Helper: Sort by recency (Survey ID index in surveyIds array determines recency)
    // surveyIds[0] is newest. Lower index = newer.
    const sortByRecency = (a: any, b: any) => {
        const idxA = surveyIds.indexOf(a.survey_response_id);
        const idxB = surveyIds.indexOf(b.survey_response_id);
        return idxA - idxB;
    };

    // 3. Education: Use the single most recent record found
    const sortedEducation = (educationRes.data || []).sort(sortByRecency);
    const education = sortedEducation[0] || {};
    
    // 4. Attributes: Use the single most recent record found
    const sortedAttributes = (attributesRes.data || []).sort(sortByRecency);
    const attributes = sortedAttributes[0] || {
        professionally_competent: 0,
        critical_thinker: 0,
        communicator: 0,
        lifelong_learner: 0,
        socially_responsible: 0,
        ethical_citizen: 0,
        innovative_worker: 0,
        people_oriented: 0,
        critical_thinking_skill: 0,
        creativity: 0,
        collaboration: 0,
        communication_skill: 0,
        information_literacy: 0,
        media_literacy: 0,
        technology_literacy: 0,
        flexibility: 0,
        leadership: 0,
        initiative: 0,
        productivity: 0,
        social_skills: 0
    };

    // 5. Employment History: Deduplicate based on content
    // We iterate from newest to oldest (via sortByRecency). 
    // If we see a job that looks identical to one we've already kept, we skip it (keep newest version).
    const sortedEmployment = (employmentRes.data || []).sort(sortByRecency);
    const uniqueEmployment: EmploymentHistory[] = [];
    const seenJobs = new Set<string>();

    for (const job of sortedEmployment) {
        const key = `${job.company_name?.toLowerCase().trim() || ''}|${job.position?.toLowerCase().trim() || ''}|${job.date_hired || ''}`;
        // Only add if we haven't seen this "Entity" before. 
        // Since we sort by newest, we keep the latest version of any record.
        // We assume records with empty keys (bad data) are unique enough to keep or insignificant.
        if (!key.replace(/\|/g, '') || !seenJobs.has(key)) {
            if (key.replace(/\|/g, '')) seenJobs.add(key);
            uniqueEmployment.push(job);
        }
    }

    // 6. Community Engagement: Deduplicate
    const sortedCommunity = (communityRes.data || []).sort(sortByRecency);
    const uniqueCommunity: CommunityEngagement[] = [];
    const seenComm = new Set<string>();

    for (const comm of sortedCommunity) {
        const key = `${comm.organization_name?.toLowerCase().trim() || ''}|${comm.role?.toLowerCase().trim() || ''}`;
        if (!key.replace(/\|/g, '') || !seenComm.has(key)) {
            if (key.replace(/\|/g, '')) seenComm.add(key);
            uniqueCommunity.push(comm);
        }
    }

    return {
        education: education,
        employment: uniqueEmployment,
        community: uniqueCommunity,
        attributes: attributes
    };
};

export const updateStudentProfile = async (
    userId: string, 
    userType: 'graduating' | 'alumni' | 'student' | 'students', 
    data: {
        first_name?: string;
        last_name?: string;
        email?: string;
        contact_no?: string;
        address?: string;
        program?: string;
        year_level?: string;
    }
) => {
    const targetTable = (userType === 'alumni') ? 'alumni' : 'students';
    const { error } = await supabase.from(targetTable).update(data).eq('id', userId);
    if (error) throw error;
};

export const saveProfileData = async (
    userId: string,
    userType: 'graduating' | 'alumni' | 'student' | 'students',
    data: FullProfileData
) => {
    const respondentType = (userType === 'alumni') ? 'alumni' : 'student';
    const idColumn = (userType === 'alumni') ? 'alumni_id' : 'student_id';

    // Helper: Strip ID and system fields to avoid primary key conflicts when creating new snapshot
    const sanitize = (obj: any) => {
        const { id, created_at, survey_response_id, ...rest } = obj;
        return rest;
    };

    // 1. Create Survey Response (Snapshot)
    const surveyPayload: any = {
        respondent_type: respondentType,
        submitted_at: new Date().toISOString()
    };
    surveyPayload[idColumn] = userId;

    const { data: surveyData, error: surveyError } = await supabase
        .from('survey_responses')
        .insert([surveyPayload])
        .select()
        .single();
    
    if (surveyError) throw surveyError;
    const surveyId = surveyData.id;

    // 2. Insert Related Data
    const promises = [];

    // Education
    if (data.education && Object.keys(data.education).length > 0) {
        promises.push(
            supabase.from('education_information').insert([{
                survey_response_id: surveyId,
                ...sanitize(data.education)
            }])
        );
    }

    // Attributes
    if (data.attributes) {
        promises.push(
            supabase.from('alumni_attributes').insert([{
                survey_response_id: surveyId,
                ...sanitize(data.attributes)
            }])
        );
    }

    // Employment History (Batch Insert)
    if (data.employment && data.employment.length > 0) {
        const employmentPayloads = data.employment.map(emp => ({
            survey_response_id: surveyId,
            ...sanitize(emp)
        }));
        promises.push(supabase.from('employment_history').insert(employmentPayloads));
    }

    // Community Engagement (Batch Insert)
    if (data.community && data.community.length > 0) {
        const communityPayloads = data.community.map(comm => ({
            survey_response_id: surveyId,
            ...sanitize(comm)
        }));
        promises.push(supabase.from('community_engagement').insert(communityPayloads));
    }

    await Promise.all(promises);
};
