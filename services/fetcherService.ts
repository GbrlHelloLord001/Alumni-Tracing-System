
import { GoogleGenAI, Schema, Type } from "../lib/geminiClient";
import { supabase } from '../lib/supabaseClient';
import { InternetAlumni, MiningConfig } from '../types';
import { COURSES, normalizeProgram, normalizeBatchYear } from '../lib/normalization';

const SERPER_KEY = "b3403d9cd24afa5ba9e3a1d7df38792db7c4caad";
const API_KEY = undefined;
const ai = new GoogleGenAI({ apiKey: API_KEY });

const MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"];

// Schema for Gemini to clean the scraped data
const cleanAlumniSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      full_name: { type: Type.STRING },
      course: { type: Type.STRING },
      graduation_year: { type: Type.INTEGER, description: "The year of graduation (End Date). Must be extracted. If not found, return null." },
      current_job: { type: Type.STRING, description: "Current Job Title. If generic (e.g. 'Graduate'), leave empty." },
      employment_status: { 
        type: Type.STRING, 
        enum: ['Employed', 'Unemployed', 'Self-Employed', 'Unknown'],
        description: "Strictly map to these 4: 'Freelancer'/'Business Owner' -> 'Self-Employed'. 'Open to work' -> 'Unemployed'. 'Student'/Generic Title -> 'Unknown'." 
      },
      industry: { type: Type.STRING, description: "Infer the industry. If unknown, put 'Unknown'." },
      job_relation: { 
        type: Type.STRING, 
        enum: ['Related', 'Non-Related', 'Unknown'],
        description: "Strictly analyze. If status is Unknown or Unemployed, this MUST be 'Unknown'."
      },
      link: { type: Type.STRING, description: "The direct URL link to the profile found in the input." }
    },
    required: ["full_name", "job_relation", "employment_status", "link"]
  }
};

const insightsSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        statusInterpretation: { type: Type.STRING, description: "Analysis of the employment vs unemployment vs unknown ratios." },
        industryInterpretation: { type: Type.STRING, description: "Insights on the top industries found." },
        alignmentInterpretation: { type: Type.STRING, description: "Commentary on how many alumni are working in related fields." }
    },
    required: ["statusInterpretation", "industryInterpretation", "alignmentInterpretation"]
};

export const performAlumniSearch = async (): Promise<InternetAlumni[]> => {
  const myHeaders = new Headers();
  myHeaders.append("X-API-KEY", SERPER_KEY);
  myHeaders.append("Content-Type", "application/json");

  // STRICT QUERY: LinkedIn Profiles containing "Laguna University" AND ("Bachelor" OR "BS")
  const searchQuery = "site:linkedin.com/in (\"Laguna University\" \"Bachelor\" OR \"Laguna University\" \"BS\")";

  const raw = JSON.stringify({
    "q": searchQuery,
    "num": 20 // Fetch up to 20 results per request
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow" as RequestRedirect
  };

  try {
    const response = await fetch("https://google.serper.dev/search", requestOptions);
    const result = await response.json();
    
    if (!result.organic || result.organic.length === 0) {
        return [];
    }

    // Process with AI
    return await processRawSearchResults(result.organic);

  } catch (error) {
    console.error("Search API Error:", error);
    throw new Error("Failed to fetch alumni data from the web.");
  }
};

const processRawSearchResults = async (results: any[]): Promise<InternetAlumni[]> => {
  // We include the link in the text block so the AI can extract it and map it to the person
  const snippets = results.map((r: any) => `Title: ${r.title}, Snippet: ${r.snippet}, Link: ${r.link}`).join("\n---\n");

  const prompt = `
    You are a Data Scraper Cleaner. I will provide raw Google Search results from LinkedIn.
    
    Target: **EXPLICITLY EXTRACT ONLY ALUMNI FROM LAGUNA UNIVERSITY.**
    
    Task:
    1. Extract specific alumni details. 
    2. **Verification**: Verify that the text confirms they studied at "Laguna University".
    3. **Link**: Extract the URL link.
    4. **Course & Grad Year**: Infer 'course' and 'graduation_year'.
    
    5. **STRICT Employment Status Logic (4 Categories Only)**: 
       - **Self-Employed**: IF text says "Freelancer", "Virtual Assistant", "Business Owner", "Founder", "Tutor".
       - **Unemployed**: IF text says "Open to work", "Looking for opportunities", "Unemployed", "Seeking".
       - **Unknown**: IF the description/title is GENERIC (e.g., "BS Accountancy Graduate", "Laguna University Alumni", "Student", "Cum Laude") AND no specific company/role is listed. 
       - **Employed**: Only if a specific VALID job title and company is found.
    
    6. **Unknown Logic**: If Status is 'Unknown' or 'Unemployed', set 'industry' and 'job_relation' to 'Unknown'.

    Raw Data:
    ${snippets}
    
    Output strictly a JSON array.
  `;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: cleanAlumniSchema,
        },
      });

      if (response.text) {
        const cleanedData = JSON.parse(response.text);
        
        // Post-processing: Filter and Add metadata
        const validAlumni: InternetAlumni[] = [];
        
        for (const alumni of cleanedData) {
            // FILTER 1: EXCLUDE STUDENTS (Explicitly)
            if (alumni.current_job && alumni.current_job.toLowerCase().includes('student at laguna university')) {
                continue;
            }

            // FILTER 2: Must have Graduation Year
            if (!alumni.graduation_year) {
                continue;
            }

            // FILTER 3: Data Quality Check - Handle Generic "Job Titles" in Code
            const jobLower = (alumni.current_job || '').toLowerCase();
            let finalStatus = alumni.employment_status;
            let finalJob = alumni.current_job;
            // Initialize finalRelation with nullable type locally
            let finalRelation: string | null | undefined = alumni.job_relation; 
            let finalIndustry = alumni.industry;

            // Specific keywords identifying non-jobs/generic titles
            const genericKeywords = ['graduate', 'alumni', 'student', 'bachelor', 'bs ', 'cum laude', 'looking for', 'seeking'];
            const isGenericTitle = genericKeywords.some(k => jobLower.includes(k) && !jobLower.includes('at ') && !jobLower.includes('officer'));

            // Force Unknown if title is generic
            if (isGenericTitle && finalStatus === 'Employed') {
               finalStatus = 'Unknown';
            }

            // --- STRICT 4-CATEGORY ENFORCEMENT & NORMALIZATION ---
            
            // 1. Normalize Freelancer -> Self-Employed
            if (finalStatus === 'Freelancer') finalStatus = 'Self-Employed';
            
            // 2. Handle DB Constraint for job_relation: 'Unknown' -> null
            if (finalRelation === 'Unknown') {
                finalRelation = null;
            }

            // 3. If Unknown/Unemployed -> Set details to Unknown (and relation to null)
            if (finalStatus === 'Unknown' || finalStatus === 'Unemployed') {
                finalJob = 'Unknown';
                finalRelation = null; // Ensure null for DB constraint
                finalIndustry = 'Unknown';
            }

            // Generate a unique placeholder email
            const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substr(2);
            const sanitizedName = (alumni.full_name || 'unknown').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const email = `${sanitizedName}.${uniqueSuffix}@mined.placeholder`;

            validAlumni.push({
                ...alumni,
                email: email,
                employment_status: finalStatus,
                current_job: finalJob,
                job_relation: finalRelation as any, // Cast to avoid TS issues if strict
                industry: finalIndustry,
                link: alumni.link, 
                sourced_at: 'LinkedIn',
                created_at: new Date().toISOString()
            });
        }

        return validAlumni;
      }
    } catch (error) {
      console.warn(`Model ${model} failed for cleaning alumni:`, error);
    }
  }

  return [];
};

export const saveMinedAlumni = async (alumniList: InternetAlumni[]) => {
    if (alumniList.length === 0) return 0;

    const links = alumniList.map(a => a.link).filter(l => l) as string[];
    let existingLinks = new Set();

    if (links.length > 0) {
        const { data: existing, error: fetchError } = await supabase
            .from('internet_alumni')
            .select('link')
            .in('link', links);
        
        if (fetchError) throw fetchError;
        existingLinks = new Set(existing?.map(e => e.link));
    }

    const newRecords = alumniList
        .filter(a => !a.link || !existingLinks.has(a.link))
        .map(a => ({
            ...a,
            course: normalizeProgram(a.course),
            graduation_year: normalizeBatchYear(a.graduation_year)
        }));

    if (newRecords.length === 0) return 0;

    const { error } = await supabase.from('internet_alumni').insert(newRecords);
    
    if (error) {
        console.error("Error inserting records:", error);
        // Throw a cleaner error message that UI can display
        throw new Error(`Database Error: ${error.message}`);
    }

    return newRecords.length;
};

export const fetchMinedAnalytics = async () => {
    const { data, error } = await supabase.from('internet_alumni').select('*');
    if (error) throw error;

    const total = data.length;
    
    // Aggregations
    const industryCounts: Record<string, number> = {};
    const relationCounts: Record<string, number> = { Related: 0, "Non-Related": 0, "Unknown": 0 };
    const statusCounts: Record<string, number> = { 
        'Employed': 0, 
        'Unemployed': 0, 
        'Self-Employed': 0, 
        'Unknown': 0 
    };

    data.forEach((alum: InternetAlumni) => {
        if (alum.industry && alum.industry !== 'Unknown') industryCounts[alum.industry] = (industryCounts[alum.industry] || 0) + 1;
        
        // Handle null relation by defaulting to 'Unknown' key for stats
        const rel = alum.job_relation || 'Unknown';
        relationCounts[rel] = (relationCounts[rel] || 0) + 1;
        
        // Normalize status count to ensure only 4 keys
        let status = alum.employment_status;
        if (status === 'Freelancer') status = 'Self-Employed';
        if (!['Employed', 'Unemployed', 'Self-Employed'].includes(status)) status = 'Unknown';
        
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const topIndustries = Object.entries(industryCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 5);

    const relationData = [
        { name: 'Related', value: relationCounts['Related'] },
        { name: 'Non-Related', value: relationCounts['Non-Related'] },
        { name: 'Unknown', value: relationCounts['Unknown'] }
    ];

    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    return {
        total,
        topIndustries,
        relationData,
        statusData,
        recentRecords: data.sort((a,b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 10)
    };
};

export const generateMinerInsights = async (analytics: any) => {
    if (!analytics || analytics.total === 0) return null;

    const prompt = `
        Analyze the Mined Alumni Data and provide professional interpretations.
        
        Data:
        - Status: ${JSON.stringify(analytics.statusData)}
        - Alignment: ${JSON.stringify(analytics.relationData)}
        - Top Industries: ${JSON.stringify(analytics.topIndustries)}
        
        Provide concise insights (2 sentences max per category).
        Output JSON.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json", responseSchema: insightsSchema }
        });
        return response.text ? JSON.parse(response.text) : null;
    } catch (e) {
        console.error("AI Insight Error", e);
        return null;
    }
};

// --- CONFIGURATION ---

export const getMiningConfig = (): MiningConfig => {
    const stored = localStorage.getItem('lu_mining_config');
    if (stored) {
        return JSON.parse(stored);
    }
    return { isActive: false, frequency: 'Monthly' };
};

export const saveMiningConfig = (config: MiningConfig) => {
    let nextRun = config.nextRun || '';
    if (config.isActive && !nextRun) {
        const date = new Date();
        if (config.frequency === 'Weekly') date.setDate(date.getDate() + 7);
        if (config.frequency === 'Monthly') date.setMonth(date.getMonth() + 1);
        if (config.frequency === 'Quarterly') date.setMonth(date.getMonth() + 3);
        nextRun = date.toISOString().split('T')[0];
    }
    const finalConfig = { ...config, nextRun };
    localStorage.setItem('lu_mining_config', JSON.stringify(finalConfig));
    return finalConfig;
};
