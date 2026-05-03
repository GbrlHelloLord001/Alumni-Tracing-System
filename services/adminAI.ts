
import { GoogleGenAI, Schema, Type } from "../lib/geminiClient";

// Note: Using the API key provided in the context. 
// In a production environment, this should be an environment variable.
const API_KEY = undefined;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Models for Analytics (Using efficient Flash versions)
const MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"];

const interpretationsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    industry: { type: Type.STRING, description: "Interpretation of top industries" },
    employmentJourney: { type: Type.STRING, description: "Combined interpretation of Time-to-First-Job trends and Job Level distribution." },
    alignment: { type: Type.STRING, description: "Interpretation of program alignment rate" },
    unemployment: { type: Type.STRING, description: "Interpretation of unemployment reasons" },
    misalignment: { type: Type.STRING, description: "Interpretation of misalignment reasons" },
    retirement: { type: Type.STRING, description: "Interpretation of retirement reasons" },
    trend: { type: Type.STRING, description: "Interpretation of employment rate trends over the years." },
    salaryTrends: { type: Type.STRING, description: "Interpretation of Salary Ranges and Business Revenues distribution." },
  },
  required: ["industry", "employmentJourney", "alignment", "unemployment", "misalignment", "retirement", "trend", "salaryTrends"]
};

const qualitySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    qualityInterpretation: { type: Type.STRING, description: "Analysis of the overall employment quality based on salary, job stability, and position levels." },
    verdict: { type: Type.STRING, enum: ["High Quality", "Moderate Quality", "Low Quality", "Insufficient Data"], description: "Overall verdict." }
  },
  required: ["qualityInterpretation", "verdict"]
};

export interface CardInterpretations {
    industry: string;
    employmentJourney: string;
    alignment: string;
    unemployment: string;
    misalignment: string;
    retirement: string;
    trend: string;
    salaryTrends: string;
}

export interface QualityAnalysis {
    qualityInterpretation: string;
    verdict: string;
}

export const generateCardInterpretations = async (analytics: any, context?: { year: string, course: string }): Promise<CardInterpretations> => {
  if (!analytics || analytics.totalRespondents === 0) {
    return {
        industry: "Insufficient data.",
        employmentJourney: "Insufficient data.",
        alignment: "Insufficient data.",
        unemployment: "Insufficient data.",
        misalignment: "Insufficient data.",
        retirement: "Insufficient data.",
        trend: "Insufficient data.",
        salaryTrends: "Insufficient data."
    };
  }

  const contextStr = context 
    ? `Focus your analysis specifically on the context of: **Batch ${context.year}** graduates from the **${context.course}** program.` 
    : "Focus on the overall general population of graduates.";

  const prompt = `
    You are an Data Analyst for Laguna University. 
    Analyze the provided data subsets and generate a concise **Interpretation** (2-3 sentences max) for each category.
    ${contextStr}
    
    Specific Instructions:
    - **Trend**: Focus on year-over-year employment rate changes.
    - **Employment Journey**: Combine insights from "Average Time to First Job" (is it fast/slow?) and "Job Level Distribution" (are they entering at good levels?).
    - **Salary Trends**: Analyze the distribution of income levels. Note that data is separated into "Salary" (for employed) and "Revenue" (for business owners).
    
    **Data Context:**
    - Trends (Year over Year): ${JSON.stringify(analytics.trendData)}
    - Program Stats (Time to Job): ${JSON.stringify(analytics.programStats.map((p: any) => ({ program: p.program, months: p.avgTimeToJob })))}
    - Job Levels: ${JSON.stringify(analytics.jobLevelData)}
    - Top Industries: ${JSON.stringify(analytics.industryData)}
    - Alignment Rate: ${JSON.stringify(analytics.alignmentRate)}
    - Unemployment Reasons: ${JSON.stringify(analytics.unemploymentReasonData)}
    - Misalignment Reasons: ${JSON.stringify(analytics.alignmentReasonData)}
    - Retirement Reasons: ${JSON.stringify(analytics.retirementReasonData)}
    - Salary & Revenue: ${JSON.stringify(analytics.salaryData)}

    Provide the output in JSON format.
  `;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: interpretationsSchema,
        },
      });
  
      if (response.text) {
          return JSON.parse(response.text) as CardInterpretations;
      }
    } catch (error) {
       console.warn(`Model ${model} failed for analytics:`, error);
    }
  }
  
  // Fallback if all fail
  return {
    industry: "Analysis unavailable.",
    employmentJourney: "Analysis unavailable.",
    alignment: "Analysis unavailable.",
    unemployment: "Analysis unavailable.",
    misalignment: "Analysis unavailable.",
    retirement: "Analysis unavailable.",
    trend: "Analysis unavailable.",
    salaryTrends: "Analysis unavailable."
  };
};

export const generateQualityAnalysis = async (metrics: any): Promise<QualityAnalysis> => {
    const prompt = `
      Analyze the Employment Quality of graduates.
      
      **System Context:**
      The system has calculated a Quality Score of **${metrics.score}/100**, which falls under the category of **"${metrics.calculatedVerdict}"**.
      
      **Key Metrics:**
      - Full-Time Employment Rate: ${metrics.fullTimePercentage}%
      - Job Alignment (Related to Course): ${metrics.alignedPercentage}%
      - High/Mid Salary Rate (>20k): ${metrics.salaryQualityPercentage}%
      - Professional/Managerial Level Rate: ${metrics.jobLevelQualityPercentage}%
      
      **Task:**
      Provide a concise professional interpretation (max 3 sentences) explaining this "${metrics.calculatedVerdict}" status based on the metrics above.
      
      Output JSON with 'qualityInterpretation' and 'verdict'. 
      **Important:** The 'verdict' field in your JSON output MUST be "${metrics.calculatedVerdict}".
    `;
  
    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: { parts: [{ text: prompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: qualitySchema,
          },
        });
    
        if (response.text) {
            return JSON.parse(response.text) as QualityAnalysis;
        }
      } catch (error) {
         console.warn(`Model ${model} failed for quality analysis:`, error);
      }
    }

    return { qualityInterpretation: "Unable to generate analysis.", verdict: "Moderate Quality" };
};
