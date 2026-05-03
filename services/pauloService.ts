
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../lib/supabaseClient';

const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Using gemini-flash-latest for efficiency and high performance
const MODEL = "gemini-flash-latest";

// --- Context Gathering ---
const getSystemContext = async () => {
    try {
        // 1. Fetch All Related Data Tables
        const [
            { data: empData },
            { data: eduData },
            { data: commData },
            { data: attrData },
            { data: surveys },
            { data: students },
            { data: alumni }
        ] = await Promise.all([
            supabase.from('employment_information').select('*'),
            supabase.from('education_information').select('*'),
            supabase.from('community_engagement').select('*'),
            supabase.from('alumni_attributes').select('*'),
            supabase.from('survey_responses').select('id, student_id, alumni_id, respondent_type'),
            supabase.from('students').select('id, first_name, last_name, program, year_level'),
            supabase.from('alumni').select('id, first_name, last_name, program, year_level')
        ]);

        // --- Data Linking & Aggregation ---
        
        // Maps for O(1) lookup
        const surveyMap = new Map(surveys?.map((s: any) => [s.id, s]));
        const studentMap = new Map(students?.map((s: any) => [s.id, s]));
        const alumniMap = new Map(alumni?.map((a: any) => [a.id, a]));

        // Grouping Data by Survey ID
        const empBySurvey = new Map<string, any>(empData?.map((e: any) => [e.survey_response_id, e]));
        const eduBySurvey = new Map<string, any>(eduData?.map((e: any) => [e.survey_response_id, e]));
        const attrBySurvey = new Map<string, any>(attrData?.map((e: any) => [e.survey_response_id, e]));
        
        // Community is 1-to-many per survey, so we group into arrays
        const commBySurvey = new Map<string, any[]>();
        commData?.forEach((c: any) => {
            const existing = commBySurvey.get(c.survey_response_id) || [];
            existing.push(c);
            commBySurvey.set(c.survey_response_id, existing);
        });

        // Aggregation Containers
        const industryStats: Record<string, number> = {};
        
        // Detailed Roster for Name-Based Queries (The "Brain")
        const alumniRoster: any[] = [];
        
        // Helper to get user profile
        const getUserProfile = (survey: any) => {
            if (survey.respondent_type === 'student') return studentMap.get(survey.student_id);
            return alumniMap.get(survey.alumni_id);
        };

        // We iterate through surveys to build the comprehensive profile
        let totalRecords = 0;

        surveys?.forEach((survey: any) => {
            const userProfile: any = getUserProfile(survey);
            if (!userProfile) return;

            totalRecords++;
            const fullName = `${userProfile.first_name} ${userProfile.last_name}`;
            const program = userProfile.program || "Unknown Program";
            const batch = userProfile.year_level || "Unknown Batch";

            // 1. Employment Details
            const emp = empBySurvey.get(survey.id);
            const employmentInfo = {
                status: emp?.employment_status || "Unknown",
                company: emp?.company_name || emp?.business_name || "N/A",
                position: emp?.current_position || "N/A",
                industry: emp?.industry || "N/A",
                salary: emp?.salary_range || emp?.business_revenue || "N/A",
                alignment: emp?.job_alignment || "N/A",
                type: emp?.employment_type || "N/A"
            };

            // 2. Education Details
            const edu = eduBySurvey.get(survey.id);
            const educationInfo = {
                bachelors: edu?.bachelors_degree || "N/A",
                masters: edu?.masters_degree || "None",
                doctoral: edu?.doctoral_degree || "None",
                license: edu?.professional_license || "None",
                license_number: edu?.license_number || "N/A"
            };

            // 3. Community Engagement
            const comms = commBySurvey.get(survey.id) || [];
            const communityInfo = comms.map((c: any) => ({
                org: c.organization_name,
                role: c.role
            }));

            // 4. Skills / Attributes (Scores 1-5)
            const attr = attrBySurvey.get(survey.id);
            const skillsInfo = attr ? {
                leadership: attr.leadership || 0,
                communication: attr.communication_skill || 0,
                technology: attr.technology_literacy || 0,
                critical_thinking: attr.critical_thinking_skill || 0,
                collaboration: attr.collaboration || 0
            } : {};

            // Add to Roster
            alumniRoster.push({
                name: fullName,
                program: program,
                batch: batch,
                ...employmentInfo,
                education: educationInfo,
                community: communityInfo,
                skills: skillsInfo
            });

            // Global Industry Stats Aggregation (Exclude Unknown)
            if (emp?.industry && emp.industry !== 'Unknown' && emp.industry !== 'N/A') {
                industryStats[emp.industry] = (industryStats[emp.industry] || 0) + 1;
            }
        });

        // Get top industries
        const topIndustries = Object.entries(industryStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        return {
            summary: {
                total_records_analyzed: totalRecords,
                generated_at: new Date().toISOString()
            },
            // Full list of alumni with details
            alumni_roster: alumniRoster, 
            top_industries: topIndustries
        };

    } catch (error) {
        console.error("Context Gather Error:", error);
        return { error: "Failed to retrieve database context." };
    }
};

export const sendMessageToPaulo = async (message: string, history: any[]) => {
    try {
        const contextData = await getSystemContext();
        
        const systemPrompt = `
        You are P.A.U.L.O (Placement, Alumni, University Linkages Office), an advanced AI assistant for the Admin of Laguna University's Alumni Tracer System.
        
        **CRITICAL INSTRUCTION: DATA ACCESS**
        You have access to a specific JSON dataset below called "alumni_roster".
        **YOU MUST ANSWER ANY QUESTION** related to Employment, Education, Community Engagement, or Skills based on this roster.
        
        **CRITICAL INSTRUCTION: DATA CLEANING & EXCLUSION (STRICT)**
        1. **EXCLUDE 'Unknown' / 'N/A':** When generating summaries, counts, lists, statistics, or charts, **DO NOT** count, list, or display records where the value is "Unknown", "N/A", or null.
        2. **No 'Unknown' in Lists:** If listing statuses (e.g. Employed: 10, Unemployed: 2), do **NOT** list "Unknown: 21". Omit the Unknowns entirely from the output.
        3. **No 'Unknown' in Charts:** Never include an "Unknown" slice in pie charts or bar in bar charts.
        4. **Rates:** Calculate percentages based only on the *Known* population (e.g., Employment Rate = Employed / (Employed + Unemployed + Self-employed + Retired)).

        **CRITICAL INSTRUCTION: STRICT FACTUALITY & OPINIONS**
        1. **NO UNSOLICITED OPINIONS:** Do NOT provide opinions, recommendations, "thoughts", or subjective analysis unless the user explicitly asks (e.g., "What do you think?", "Give me an opinion").
        2. **FACTS ONLY:** If asked "What is the employment rate?", simply state the calculated percentage based on the data. Do not add "This is a good number".
        3. **UNKNOWN DATA:** If the data is not in the roster, say "I do not have that information in the current database."

        **CRITICAL INSTRUCTION: DOMAIN LOGIC**
        
        **1. EMPLOYMENT & SALARY:**
        - Use fields: status, company, position, salary (ranges).
        - **Salary Calculation:** Use these midpoints for averages:
          "Below 10,000"->8000, "Below 15,000"->12500, "10,000–50,000"->30000, "15,000–20,000"->17500, "20,001–30,000"->25000, "30,001–50,000"->40000, "50,001–100,000"->75000, "100,001–500,000"->300000, "Above 50,000"->60000.
        
        **2. EDUCATION:**
        - Use 'education' object in the roster.
        - **Questions:** "Who has a Master's degree?", "List licensed professionals".
        - Check 'education.masters' != "None", 'education.license' != "None".
        
        **3. COMMUNITY:**
        - Use 'community' array in the roster.
        - **Questions:** "Who is a member of Rotary?", "List alumni with leadership roles".
        - Search inside the 'community' array for 'org' names or 'role' (e.g. President, Head).
        
        **4. SKILLS / ATTRIBUTES:**
        - Use 'skills' object. Values are 1-5 (5 is highest).
        - **Questions:** "Who has the highest leadership score?", "Average technology literacy".
        - Calculate averages or find max values based on the 'skills' object keys.

        **Data Access (Context):**
        ${JSON.stringify(contextData, null, 2)}

        **How to Answer:**
        1. **Specific Names:** If asked "Who...", list names from the 'alumni_roster' that match the criteria.
        2. **Lookup:** If asked "Details about [Name]", find their entry and summarize ALL fields (Job, Education, Community, Skills).
        3. **Exact Matching:** If the user asks about a person, search the 'name' field. Support fuzzy matching.
        4. **Aggregation:** Calculate counts and averages dynamically from the roster.
        5. **Charts:** Always verify if the user wants a visualization.

        **Chart Generation Rules:**
        If the user asks to visualize data (e.g., "Chart of BSIT employment", "Graph industries"), output this JSON structure at the END of your response:
        
        :::CHART_DATA:::
        {
          "type": "bar" | "pie",
          "title": "Chart Title",
          "data": [
            {"name": "Label1", "value": 10},
            {"name": "Label2", "value": 20}
          ]
        }
        :::END_CHART:::

        **Tone:** Professional, direct, and precise. 
        `;

        // Format history for Gemini
        const chatHistory = history.map(h => ({
            role: h.sender === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
        }));

        const chat = ai.chats.create({
            model: MODEL,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.1, // Very low temperature for high factual accuracy
            },
            history: chatHistory
        });

        const result = await chat.sendMessage({ message: message });
        const responseText = result.text;

        // Parse for Chart Data
        let chartData = null;
        let cleanText = responseText;

        const chartRegex = /:::CHART_DATA:::([\s\S]*?):::END_CHART:::/;
        const match = responseText.match(chartRegex);

        if (match && match[1]) {
            try {
                chartData = JSON.parse(match[1]);
                cleanText = responseText.replace(match[0], '').trim();
            } catch (e) {
                console.error("Failed to parse chart JSON from AI", e);
            }
        }

        return {
            text: cleanText,
            chart: chartData
        };

    } catch (error) {
        console.error("PAULO Error:", error);
        return { text: "I'm encountering a connection error with my neural link. Please try again later.", chart: null };
    }
};
