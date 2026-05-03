
import { GoogleGenAI, Schema, Type } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

const MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"];

// Schema for the analysis result
const updateAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: { 
      type: Type.STRING, 
      enum: ['ADD_JOB', 'RETIRE', 'UNEMPLOYED', 'UPDATE_CURRENT', 'UNKNOWN'],
      description: "The primary action implied by the user's message. 'ADD_JOB' for new employment. 'RETIRE' or 'UNEMPLOYED' if they left the workforce."
    },
    employment_status: {
      type: Type.STRING,
      enum: ['Employed', 'Self-employed', 'Unemployed', 'Retired'],
      description: "The resulting employment status of the user."
    },
    company_name: { type: Type.STRING, description: "Name of the company or business. Null if not present." },
    current_position: { type: Type.STRING, description: "Job title or role. Null if not present." },
    company_address: { type: Type.STRING, description: "Location or address of work. Null if not present." },
    employment_type: { 
      type: Type.STRING, 
      enum: ['Full-Time', 'Part-Time', 'Temporary/Contract', 'Seasonal', 'Casual', 'Internship'],
      description: "Type of employment. Default to Full-Time if employed but unspecified." 
    },
    unemployed_reasons: { type: Type.STRING, description: "If status is Unemployed, extract the reason (e.g. 'End of contract', 'Resigned')." },
    retirement_reason: { type: Type.STRING, description: "If status is Retired, extract the reason." },
    industry: { type: Type.STRING, description: "Infer the industry based on the job title/company." },
    job_alignment: { 
      type: Type.STRING, 
      enum: ['Related', 'Non-Related', 'Unknown'],
      description: "Is the job related to the user's program? Only applicable if Employed/Self-employed."
    },
    confidence_score: { type: Type.NUMBER, description: "Confidence score (0-1) of extraction." }
  },
  required: ["intent", "employment_status"]
};

export interface UpdateAnalysisResult {
  intent: 'ADD_JOB' | 'RETIRE' | 'UNEMPLOYED' | 'UPDATE_CURRENT' | 'UNKNOWN';
  employment_status: string;
  company_name?: string;
  current_position?: string;
  company_address?: string;
  employment_type?: string;
  unemployed_reasons?: string;
  retirement_reason?: string;
  industry?: string;
  job_alignment?: 'Related' | 'Non-Related' | 'Unknown';
  confidence_score: number;
}

export const analyzeUserUpdate = async (updateText: string, userProgram: string = "Unknown Program"): Promise<UpdateAnalysisResult> => {
  const prompt = `
    Analyze the following update message from an alumni regarding their career status.
    
    User Program: "${userProgram}"
    User Message: "${updateText}"
    
    Tasks:
    1. Determine the **Intent**:
       - 'ADD_JOB': User got a new job or started a business.
       - 'RETIRE': User retired.
       - 'UNEMPLOYED': User resigned, got fired, or contract ended and is now looking for work.
       - 'UPDATE_CURRENT': User is updating details of their existing job.
    
    2. Extract Data:
       - Extract Company Name, Position, Location (Address).
       - Infer 'employment_type' (e.g., "part timer" -> "Part-Time").
       - Infer 'employment_status' (Employed, Self-employed, Unemployed, Retired).
       - If they got fired or retired, extract the reason into 'unemployed_reasons' or 'retirement_reason'.
       
    3. Job Alignment Analysis:
       - If the user is Employed or Self-employed, determine if the job (Title/Company) is related to their User Program ("${userProgram}").
       - Set 'job_alignment' to 'Related' or 'Non-Related'.
    
    4. Return null for fields not present in the text.
  `;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: updateAnalysisSchema,
        },
      });
  
      if (response.text) {
          return JSON.parse(response.text) as UpdateAnalysisResult;
      }
    } catch (error) {
       console.warn(`Model ${model} failed for update analysis:`, error);
    }
  }

  throw new Error("Failed to analyze update text.");
};
