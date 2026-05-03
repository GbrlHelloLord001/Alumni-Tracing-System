
import { GoogleGenAI, Schema, Type } from "../lib/geminiClient";

const API_KEY = undefined;
const ai = new GoogleGenAI({ apiKey: API_KEY });

const MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"];

const eduInterpretationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    attainmentAnalysis: { type: Type.STRING, description: "Analysis of the distribution of educational attainment (Bachelors vs Masters vs Doctoral)." },
    licenseImpact: { type: Type.STRING, description: "Insight on how having a professional license affects employment rate and salary." },
    feederSchools: { type: Type.STRING, description: "Commentary on the top source schools for primary and secondary education." },
    salaryProgression: { type: Type.STRING, description: "Analysis of the Return on Education: How salary increases with higher degrees." },
    gradTrendsAnalysis: { type: Type.STRING, description: "Analysis of the graduation trends over the years (increasing/decreasing/peaks)." },
  },
  required: ["attainmentAnalysis", "licenseImpact", "feederSchools", "salaryProgression", "gradTrendsAnalysis"]
};

export interface EduInterpretations {
    attainmentAnalysis: string;
    licenseImpact: string;
    feederSchools: string;
    salaryProgression: string;
    gradTrendsAnalysis: string;
}

export const generateEducationInsights = async (stats: any): Promise<EduInterpretations> => {
  const prompt = `
    You are a Data Analyst for a University. Analyze the following Education Statistics and provide professional insights.

    **Data Context:**
    1. **Attainment**: ${JSON.stringify(stats.attainmentCounts)}
    2. **License Impact**: 
       - Licensed Alumni: Avg Salary ${stats.licenseStats.licensedSalary}, Emp Rate ${stats.licenseStats.licensedEmpRate}%
       - Non-Licensed: Avg Salary ${stats.licenseStats.nonLicensedSalary}, Emp Rate ${stats.licenseStats.nonLicensedEmpRate}%
    3. **Top Feeder Schools**: ${JSON.stringify(stats.feederSchools)}
    4. **Salary by Degree**: ${JSON.stringify(stats.degreeSalaries)}
    5. **Graduation Trends**: ${JSON.stringify(stats.gradTrends)}

    **Instructions:**
    - **License Impact**: Compare Licensed vs Non-Licensed statistics.
    - **Salary Progression**: Evaluate if pursuing a Master's or Doctorate yields a financial return based on the data.
    - **Graduation Trends**: Identify if the number of graduates is growing or shrinking.
    - Keep interpretations concise (2-3 sentences).

    Output strictly JSON.
  `;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: eduInterpretationSchema,
        },
      });
  
      if (response.text) {
          return JSON.parse(response.text) as EduInterpretations;
      }
    } catch (error) {
       console.warn(`Model ${model} failed for edu analytics:`, error);
    }
  }

  return {
      attainmentAnalysis: "Data unavailable.",
      licenseImpact: "Data unavailable.",
      feederSchools: "Data unavailable.",
      salaryProgression: "Data unavailable.",
      gradTrendsAnalysis: "Data unavailable."
  };
};
