
import { GoogleGenAI, Schema, Type } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

const MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"];

const communityInterpretationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    participationAnalysis: { type: Type.STRING, description: "Analysis of the overall participation rate and the types of organizations alumni prefer (e.g., NGOs vs LGUs)." },
    orgTypeInsights: { type: Type.STRING, description: "Insights on the specific organizations that have the most alumni (e.g., Red Cross, SK)." },
    roleDistributionAnalysis: { type: Type.STRING, description: "Analysis of the distribution of roles (Leaders vs Officers vs Members). Is the alumni base more leadership-oriented or member-oriented?" },
    leadershipImpact: { type: Type.STRING, description: "Correlation analysis: Does holding a community leadership role correlate with higher job levels (Managerial/Supervisory)?" },
    timelineTrends: { type: Type.STRING, description: "Analysis of engagement activity over time. Are alumni staying active after graduation?" },
  },
  required: ["participationAnalysis", "orgTypeInsights", "roleDistributionAnalysis", "leadershipImpact", "timelineTrends"]
};

// Schema for Role Normalization
const roleNormalizationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    normalizedRoles: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: ["Owner", "Admin", "Volunteer", "Member"] },
      description: "The list of normalized roles corresponding to the input list order."
    }
  },
  required: ["normalizedRoles"]
};

export interface CommunityInterpretations {
    participationAnalysis: string;
    orgTypeInsights: string;
    roleDistributionAnalysis: string;
    leadershipImpact: string;
    timelineTrends: string;
}

export const normalizeRolesBatch = async (rawRoles: string[]): Promise<string[]> => {
  if (rawRoles.length === 0) return [];

  const prompt = `
    You are a Data Standardizer. Map the following list of Community/Organization Roles to exactly one of these 4 categories: 
    
    1. **Owner**: (e.g., Founder, President, Chairperson, Head, Captain)
    2. **Admin**: (e.g., Officer, Secretary, Treasurer, VP, Coordinator, Director, Manager, Committee Lead)
    3. **Volunteer**: (e.g., Participant, Helper, Donor, Volunteer)
    4. **Member**: (e.g., Member, Associate, Joiner)

    **Rules:**
    - If ambiguous, default to "Member".
    - Maintain the exact order of the input list.
    
    **Input List:** 
    ${JSON.stringify(rawRoles)}
  `;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: roleNormalizationSchema,
        },
      });
  
      if (response.text) {
          const data = JSON.parse(response.text);
          // Safety check to ensure length matches
          if (data.normalizedRoles && data.normalizedRoles.length === rawRoles.length) {
              return data.normalizedRoles;
          }
      }
    } catch (error) {
       console.warn(`Model ${model} failed for role normalization:`, error);
    }
  }

  // Fallback: Return original roles if AI fails (or map all to Member)
  return rawRoles.map(() => "Member");
};

export const generateCommunityInsights = async (stats: any): Promise<CommunityInterpretations> => {
  const prompt = `
    You are a Research Analyst for a University. Analyze the following Community Engagement Statistics.

    **Data Context:**
    1. **Organization Types**: ${JSON.stringify(stats.orgTypeCounts)}
    2. **Top Specific Orgs**: ${JSON.stringify(stats.topOrgs)}
    3. **Role Distribution**: ${JSON.stringify(stats.roleCounts)} (Leaders vs Members)
    4. **Employment Correlation**: 
       - Of those who are Community Leaders, ${stats.crossSection.leaderManagerialRate}% hold Managerial/Supervisory jobs.
       - Of those who are just Members/Non-Active, ${stats.crossSection.memberManagerialRate}% hold Managerial/Supervisory jobs.
    5. **Timeline**: ${JSON.stringify(stats.timelineData)}

    **Instructions:**
    - **Role Distribution**: Comment on the balance of Leaders vs Members.
    - **Leadership Impact**: Specifically comment on the percentage difference in job levels. Does community leadership suggest better career outcomes?
    - **Participation**: Identify if alumni prefer civic (LGU), religious, or professional organizations.
    - **Timeline**: Is engagement increasing or decreasing recently?
    - Keep interpretations professional and concise (2-3 sentences).

    Output strictly JSON.
  `;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: communityInterpretationSchema,
        },
      });
  
      if (response.text) {
          return JSON.parse(response.text) as CommunityInterpretations;
      }
    } catch (error) {
       console.warn(`Model ${model} failed for community analytics:`, error);
    }
  }

  return {
      participationAnalysis: "Data unavailable.",
      orgTypeInsights: "Data unavailable.",
      roleDistributionAnalysis: "Data unavailable.",
      leadershipImpact: "Data unavailable.",
      timelineTrends: "Data unavailable."
  };
};
