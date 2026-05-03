
import { GoogleGenAI, Type, Schema } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Models suitable for text analysis
const MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"];

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    job_alignment: { 
      type: Type.STRING, 
      enum: ['Related', 'Non-Related'],
      description: "Is the job related to the student's program/course?"
    },
    current_job_level: { 
      type: Type.STRING, 
      enum: [
        'Intern', 
        'Trainee', 
        'Entry-Level', 
        'Rank and File', 
        'Senior Staff', 
        'Supervisory', 
        'Managerial', 
        'Department Head', 
        'Director', 
        'Vice President', 
        'Executive'
      ],
      description: "The level of the position based on the job title."
    },
    industry: {
      type: Type.STRING,
      description: "The specific industry sector of the company or business (e.g., 'Information Technology', 'Education', 'Healthcare', 'Retail', 'Construction')."
    }
  },
  required: ['job_alignment', 'current_job_level', 'industry']
};

const normalizationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    normalized_reason: {
      type: Type.STRING,
      enum: [
        "Better Salary/Benefits",
        "Career Advancement",
        "No Job Opportunity",
        "Career Shift",
        "Family Influence",
        "Proximity",
        "Health Reasons",
        "Peer Pressure",
        "Educational Mismatch",
        "Passion/Interest"
      ],
      description: "The standardized category that best fits the user's custom reason."
    }
  },
  required: ['normalized_reason']
};

export const analyzeJobDetails = async (
  position: string, 
  company: string, 
  program: string,
  employmentType: 'Employed' | 'Self-employed'
): Promise<{ 
  job_alignment: 'Related' | 'Non-Related'; 
  current_job_level: 'Intern' | 'Trainee' | 'Entry-Level' | 'Rank and File' | 'Senior Staff' | 'Supervisory' | 'Managerial' | 'Department Head' | 'Director' | 'Vice President' | 'Executive';
  industry: string;
}> => {
  
  let prompt = "";
  
  if (employmentType === 'Employed') {
    prompt = `
      Analyze the following employment details for a graduate of '${program}'.
      
      Job Position: ${position}
      Company: ${company}
      
      Tasks:
      1. Determine if this job is 'Related' or 'Non-Related' to the course '${program}'.
      2. Determine the Job Level based on the title '${position}'. Choose one from the following list that best fits:
         - Intern: Student or fresh graduate gaining practical experience.
         - Trainee: Entry position with structured training.
         - Entry-Level: Newly hired, minimal experience, basic tasks.
         - Rank and File: Non-supervisory, operational/technical/clerical duties.
         - Senior Staff: Experienced, advanced skills, guidance but no formal authority.
         - Supervisory: Overseeing rank-and-file staff.
         - Managerial: Managing teams/departments, decision-making.
         - Department Head: Senior leadership of a specific department.
         - Director: Executive-level, overseeing multiple departments.
         - Vice President: Leading major divisions.
         - Executive: Top executive leadership (CEO, COO, CFO, etc.).
      3. Classify the Company/Job Industry (e.g., IT, BPO, Manufacturing, Education).
    `;
  } else {
    prompt = `
      Analyze the following self-employment details for a graduate of '${program}'.
      
      Business Name: ${company} (Company Name/Business Name)
      Role/Position: ${position || 'Owner/Proprietor'}
      
      Tasks:
      1. Determine if this business is 'Related' or 'Non-Related' to the course '${program}'.
      2. Determine the Job Level. Business owners are typically 'Managerial' or higher, but verify based on context. Choose from:
         - Intern
         - Trainee
         - Entry-Level
         - Rank and File
         - Senior Staff
         - Supervisory
         - Managerial
         - Department Head
         - Director
         - Vice President
         - Executive
      3. Classify the Business Industry.
    `;
  }

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: analysisSchema,
        },
      });

      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (error) {
      console.warn(`Model ${model} failed in job analysis:`, error);
      // Continue to next model
    }
  }

  console.error("All models failed for job analysis.");
  // Fallback defaults if all AI models fail
  return { job_alignment: 'Non-Related', current_job_level: 'Rank and File', industry: 'Unclassified' };
};

export const normalizeAlignmentReason = async (customReason: string): Promise<string> => {
  const prompt = `
    The user stated this reason for working in a job NOT related to their college course: "${customReason}".
    
    Map this reason to one of the following standardized categories:
    - Better Salary/Benefits
    - Career Advancement
    - No Job Opportunity (in their field)
    - Career Shift
    - Family Influence
    - Proximity (Near home)
    - Health Reasons
    - Peer Pressure
    - Educational Mismatch
    - Passion/Interest

    Pick the closest match.
  `;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: normalizationSchema,
        },
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        return data.normalized_reason;
      }
    } catch (error) {
       console.warn(`Model ${model} failed in normalization:`, error);
    }
  }

  return "Career Shift"; // Fallback
};

// --- Exact Number Normalization Functions ---

export const normalizeSalaryRange = (exactAmount: number): string => {
  if (isNaN(exactAmount)) return "";
  if (exactAmount <= 15000) return "Below ₱15,000";
  if (exactAmount <= 20000) return "₱15,000 – ₱20,000";
  if (exactAmount <= 30000) return "₱20,001 – ₱30,000";
  if (exactAmount <= 50000) return "₱30,001 – ₱50,000";
  return "Above ₱50,000";
};

export const normalizeBusinessRevenue = (exactAmount: number): string => {
  if (isNaN(exactAmount)) return "";
  if (exactAmount <= 10000) return "Below ₱10,000";
  if (exactAmount <= 50000) return "₱10,000 – ₱50,000";
  if (exactAmount <= 100000) return "₱50,001 – ₱100,000";
  if (exactAmount <= 500000) return "₱100,001 – ₱500,000";
  if (exactAmount <= 1000000) return "₱500,001 – ₱1,000,000";
  return "Above ₱1,000,000";
};
