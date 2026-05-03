
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { supabase } from '../lib/supabaseClient';
import { GeneratedReport, ReportConfig, ReportContent, ReportSection } from '../types';

const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

const MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"];

// --- 1. Data Aggregation ---

export const fetchReportContext = async (config: ReportConfig) => {
    try {
        // 1. Filter Users
        let studentQuery = supabase.from('students').select('id, first_name, last_name, program, year_level');
        let alumniQuery = supabase.from('alumni').select('id, first_name, last_name, program, year_level');

        if (config.batch !== 'All') {
            studentQuery = studentQuery.eq('year_level', config.batch);
            alumniQuery = alumniQuery.eq('year_level', config.batch);
        }
        if (config.program !== 'All') {
            studentQuery = studentQuery.eq('program', config.program);
            alumniQuery = alumniQuery.eq('program', config.program);
        }

        const [ studentRes, alumniRes ] = await Promise.all([studentQuery, alumniQuery]);
        const students = studentRes.data || [];
        const alumni = alumniRes.data || [];

        const studentMap = new Map(students.map((s: any) => [s.id, s]));
        const alumniMap = new Map(alumni.map((a: any) => [a.id, a]));

        // 2. Fetch Surveys
        const studentIds = students.map((s: any) => s.id);
        const alumniIds = alumni.map((a: any) => a.id);

        if (studentIds.length === 0 && alumniIds.length === 0) return { type: 'summary', totalGraduates: 0, records: [] };

        const surveyPromises = [];
        if (studentIds.length > 0) surveyPromises.push(supabase.from('survey_responses').select('id, student_id, alumni_id, respondent_type').in('student_id', studentIds));
        if (alumniIds.length > 0) surveyPromises.push(supabase.from('survey_responses').select('id, student_id, alumni_id, respondent_type').in('alumni_id', alumniIds));

        const surveyResults = await Promise.all(surveyPromises);
        const surveys = surveyResults.flatMap(r => r.data || []);
        
        const validSurveys: any[] = [];
        const surveyIds: string[] = [];

        surveys.forEach((survey: any) => {
            let profile: any = null;
            if (survey.respondent_type === 'student') profile = studentMap.get(survey.student_id);
            else profile = alumniMap.get(survey.alumni_id);

            if (profile) {
                validSurveys.push({ ...survey, profile });
                surveyIds.push(survey.id);
            }
        });

        if (validSurveys.length === 0) return { type: 'summary', totalGraduates: 0, records: [] };

        // 3. Fetch Details
        const [empRes, eduRes, commRes, attrRes] = await Promise.all([
            supabase.from('employment_information').select('*').in('survey_response_id', surveyIds),
            supabase.from('education_information').select('*').in('survey_response_id', surveyIds),
            supabase.from('community_engagement').select('*').in('survey_response_id', surveyIds),
            supabase.from('alumni_attributes').select('*').in('survey_response_id', surveyIds)
        ]);

        const empMap = new Map(empRes.data?.map((e: any) => [e.survey_response_id, e]));
        const eduMap = new Map(eduRes.data?.map((e: any) => [e.survey_response_id, e]));
        const attrMap = new Map(attrRes.data?.map((e: any) => [e.survey_response_id, e]));
        
        const commMap = new Map<string, any[]>();
        commRes.data?.forEach((c: any) => {
            const list = commMap.get(c.survey_response_id) || [];
            list.push(c);
            commMap.set(c.survey_response_id, list);
        });

        // 4. Aggregate
        const detailedRecords: any[] = [];
        const statusCounts: Record<string, number> = {};
        const industryCounts: Record<string, number> = {};
        const alignmentCounts: Record<string, number> = {};
        const salaryCounts: Record<string, number> = {};
        const degreesCounts: Record<string, number> = { Bachelors: 0, Masters: 0, Doctoral: 0 };
        const participationCount = { active: 0, inactive: 0 };
        const attributeSums: Record<string, number> = {};
        const attributeResponseCounts: Record<string, number> = {};

        validSurveys.forEach(survey => {
            const profile = survey.profile;
            const emp: any = empMap.get(survey.id);
            const edu: any = eduMap.get(survey.id);
            const attr: any = attrMap.get(survey.id);
            const comms: any[] = commMap.get(survey.id) || [];

            // Stats
            const status = emp?.employment_status || 'Unknown';
            
            // Only count known statuses for charts
            if (status !== 'Unknown' && status !== 'N/A') {
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            }

            if (status === 'Employed' || status === 'Self-employed') {
                if (emp?.industry && emp.industry !== 'Unknown' && emp.industry !== 'N/A') {
                    industryCounts[emp.industry] = (industryCounts[emp.industry] || 0) + 1;
                }
                if (emp?.job_alignment && emp.job_alignment !== 'Unknown' && emp.job_alignment !== 'N/A') {
                    alignmentCounts[emp.job_alignment] = (alignmentCounts[emp.job_alignment] || 0) + 1;
                }
                const sal = emp?.salary_range || emp?.business_revenue;
                if (sal && sal !== 'Unknown' && sal !== 'N/A') {
                    salaryCounts[sal] = (salaryCounts[sal] || 0) + 1;
                }
            }

            if (edu) {
                degreesCounts.Bachelors++; // Assume basic
                if (edu.masters_degree) degreesCounts.Masters++;
                if (edu.doctoral_degree) degreesCounts.Doctoral++;
            }

            if (comms.length > 0) participationCount.active++;
            else participationCount.inactive++;

            if (attr) {
                Object.keys(attr).forEach(key => {
                    if (typeof attr[key] === 'number') {
                        attributeSums[key] = (attributeSums[key] || 0) + attr[key];
                        attributeResponseCounts[key] = (attributeResponseCounts[key] || 0) + 1;
                    }
                });
            }

            // Raw data for categorization
            detailedRecords.push({
                full_name: `${profile.first_name} ${profile.last_name}`,
                program: profile.program,
                batch: profile.year_level,
                status: status,
                position: emp?.current_position || 'N/A',
                company: emp?.company_name || 'N/A',
                business_name: emp?.business_name || 'N/A',
                industry: emp?.industry || 'N/A',
                alignment: emp?.job_alignment || 'N/A',
                salary: emp?.salary_range || 'N/A',
                revenue: emp?.business_revenue || 'N/A',
                unemployed_reason: emp?.unemployed_reasons || 'N/A',
                retirement_date: emp?.date_retired || 'N/A',
                date_hired: emp?.date_hired || 'N/A'
            });
        });

        const toChartData = (map: Record<string, number>) => Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

        return {
            type: config.type,
            totalGraduates: validSurveys.length,
            records: detailedRecords,
            stats: {
                status: toChartData(statusCounts),
                industry: toChartData(industryCounts),
                alignment: toChartData(alignmentCounts),
                salary: toChartData(salaryCounts),
                degrees: toChartData(degreesCounts),
                participation: [
                    { name: 'Active', value: participationCount.active }, 
                    { name: 'Inactive', value: participationCount.inactive }
                ],
                attributes: Object.keys(attributeSums).map(k => ({
                    name: k.replace(/_/g, ' '),
                    value: parseFloat((attributeSums[k] / attributeResponseCounts[k]).toFixed(2))
                }))
            }
        };

    } catch (error) {
        console.error("Fetch context error", error);
        return { type: 'summary', totalGraduates: 0, records: [] };
    }
};

// --- 2. Report Generation Strategies ---

const insightsSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING },
        statusAnalysis: { type: Type.STRING },
        industryAnalysis: { type: Type.STRING },
        alignmentAnalysis: { type: Type.STRING },
        educationAnalysis: { type: Type.STRING },
        communityAnalysis: { type: Type.STRING },
        skillsAnalysis: { type: Type.STRING }
    }
};

// A. Standard Report (Tables with Totals + Short AI Interpretation)
const generateStandardReport = async (config: ReportConfig, context: any): Promise<ReportContent> => {
    
    // 1. Generate BRIEF Interpretations with AI
    let insights: any = {};
    try {
        const prompt = `
            Act as a Data Analyst. Provide **very brief** interpretations (1-2 sentences max) for each of the following sections based on the data.
            
            Context: Laguna University Alumni Tracer.
            Filters: Batch ${config.batch}, Program ${config.program}.
            
            Data:
            ${JSON.stringify(context.stats)}

            Output JSON with keys: summary, statusAnalysis, industryAnalysis, alignmentAnalysis, educationAnalysis, communityAnalysis, skillsAnalysis.
        `;
        
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json", responseSchema: insightsSchema }
        });
        
        if (result.text) insights = JSON.parse(result.text);
    } catch (e) {
        console.error("AI Text Gen failed", e);
    }

    // Helper to format table data and add TOTAL row
    const formatTable = (data: {name: string, value: number}[], labelCol: string) => {
        if (!data || data.length === 0) return [];
        const rows = data.map(d => ({
            [labelCol]: d.name,
            Count: d.value,
            Percentage: ((d.value / context.totalGraduates) * 100).toFixed(1) + '%'
        }));
        // Add Total Row
        const total = data.reduce((sum, item) => sum + item.value, 0);
        rows.push({
            [labelCol]: 'TOTAL',
            Count: total,
            Percentage: '100.0%'
        });
        return rows;
    };

    // 2. Build Sections Programmatically
    const sections: ReportSection[] = [];

    // Executive Summary
    if (insights.summary) {
        sections.push({ title: "Executive Summary", type: "text", content: insights.summary });
    }

    // --- EMPLOYMENT SECTIONS ---
    if (config.type === 'Employment' || config.type === 'All') {
        
        // Status
        sections.push({ title: "Employment Status", type: "text", content: insights.statusAnalysis || "Overview of graduate employment status." });
        sections.push({ title: "", type: "table", content: formatTable(context.stats.status, "Status") });

        // Industry
        if (context.stats.industry.length > 0) {
            sections.push({ title: "Industry Distribution", type: "text", content: insights.industryAnalysis || "Breakdown of industries where graduates are employed." });
            sections.push({ title: "", type: "table", content: formatTable(context.stats.industry, "Industry") });
        }

        // Alignment
        if (context.stats.alignment.length > 0) {
            sections.push({ title: "Job Alignment", type: "text", content: insights.alignmentAnalysis || "Correlation between course and current job." });
            sections.push({ title: "", type: "table", content: formatTable(context.stats.alignment, "Alignment") });
        }

        // Salary
        if (context.stats.salary.length > 0) {
            sections.push({ title: "Salary Ranges", type: "text", content: "Distribution of monthly income." });
            sections.push({ title: "", type: "table", content: formatTable(context.stats.salary, "Income Range") });
        }

        // --- ORGANIZED DETAILED LISTS ---
        if (config.formats.includes('Table')) {
            const records = context.records;
            
            // 1. Employed
            const employed = records.filter((r: any) => r.status === 'Employed');
            if (employed.length > 0) {
                sections.push({
                    title: "Detailed List: Employed Graduates",
                    type: "table",
                    content: employed.map((r: any) => ({
                        Name: r.full_name,
                        Position: r.position,
                        Company: r.company,
                        Industry: r.industry,
                        "Date Hired": r.date_hired
                    }))
                });
            }

            // 2. Self-Employed
            const selfEmployed = records.filter((r: any) => r.status === 'Self-employed');
            if (selfEmployed.length > 0) {
                sections.push({
                    title: "Detailed List: Entrepreneurs / Self-Employed",
                    type: "table",
                    content: selfEmployed.map((r: any) => ({
                        Name: r.full_name,
                        Business: r.business_name,
                        Role: r.position, // position often holds 'Owner'
                        Revenue: r.revenue,
                        Industry: r.industry
                    }))
                });
            }

            // 3. Unemployed
            const unemployed = records.filter((r: any) => r.status === 'Unemployed');
            if (unemployed.length > 0) {
                sections.push({
                    title: "Detailed List: Unemployed Graduates",
                    type: "table",
                    content: unemployed.map((r: any) => ({
                        Name: r.full_name,
                        Reason: r.unemployed_reason,
                        Batch: r.batch
                    }))
                });
            }

            // 4. Retired
            const retired = records.filter((r: any) => r.status === 'Retired');
            if (retired.length > 0) {
                sections.push({
                    title: "Detailed List: Retired",
                    type: "table",
                    content: retired.map((r: any) => ({
                        Name: r.full_name,
                        "Date Retired": r.retirement_date,
                        "Last Company": r.last_company
                    }))
                });
            }
        }
    }

    // --- EDUCATION SECTIONS ---
    if (config.type === 'Education' || config.type === 'All') {
        sections.push({ title: "Educational Attainment", type: "text", content: insights.educationAnalysis || "Highest degree attained by graduates." });
        sections.push({ title: "", type: "table", content: formatTable(context.stats.degrees, "Degree Level") });
    }

    // --- COMMUNITY SECTIONS ---
    if (config.type === 'Community' || config.type === 'All') {
        sections.push({ title: "Community Engagement", type: "text", content: insights.communityAnalysis || "Participation in community organizations." });
        sections.push({ title: "", type: "table", content: formatTable(context.stats.participation, "Status") });
    }

    // --- SKILLS SECTIONS ---
    if (config.type === 'Skills' || config.type === 'All') {
        sections.push({ title: "Graduate Attributes", type: "text", content: insights.skillsAnalysis || "Self-assessed proficiency ratings (1-5)." });
        
        // Custom formatting for skills (Average instead of count/percent)
        const skillRows = context.stats.attributes.map((s: any) => ({
            Attribute: s.name,
            "Average Rating": s.value
        }));
        sections.push({ title: "", type: "table", content: skillRows });
    }

    return {
        title: `Official ${config.type} Report`,
        generatedAt: new Date().toISOString(),
        filters: { batch: config.batch, program: config.program },
        sections: sections
    };
};

// B. Custom Report (Pure AI) - Kept mostly same but ensures safer parsing
const generateCustomReport = async (config: ReportConfig, context: any): Promise<ReportContent> => {
    const customSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            sections: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ['text', 'table'] },
                        textContent: { type: Type.STRING },
                        tableData: { 
                            type: Type.ARRAY, 
                            items: { type: Type.OBJECT, properties: { col1: {type:Type.STRING}, col2: {type:Type.STRING} } } 
                        } 
                    }
                }
            }
        }
    };

    const prompt = `
        Generate a Custom Report based on this user prompt: "${config.customPrompt}"
        
        Data Context (First 50 records):
        ${JSON.stringify(context.records.slice(0, 50))}

        Rules:
        1. If asking for a list, use 'table' type.
        2. If asking for summary/analysis, use 'text' type.
        3. Do not assume any formatting other than text or table.
    `;

    const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json", responseSchema: customSchema }
    });

    if (result.text) {
        const parsed = JSON.parse(result.text);
        return {
            title: parsed.title,
            generatedAt: new Date().toISOString(),
            filters: { batch: config.batch, program: config.program },
            sections: parsed.sections.map((s: any) => ({
                title: s.title,
                type: s.type,
                content: s.type === 'table' ? s.tableData : s.textContent
            }))
        };
    }
    throw new Error("AI Generation Failed");
};

// --- Main Generator Function ---

export const generateAIReport = async (config: ReportConfig, contextData: any): Promise<ReportContent> => {
    if (config.type === 'Custom') {
        return generateCustomReport(config, contextData);
    } else {
        return generateStandardReport(config, contextData);
    }
};

// --- Database Operations ---

export const saveReport = async (adminId: string, content: ReportContent, type: string) => {
    const jsonString = JSON.stringify(content);
    const payload: any = { admin_id: adminId, content: jsonString };
    const normalizedType = type.toLowerCase();
    
    if (['employment', 'education', 'community', 'skills'].includes(normalizedType)) {
        payload[normalizedType] = jsonString;
    }

    const { error } = await supabase.from('reports').insert([payload]);
    if (error) throw error;
};

export const getReportHistory = async (adminId: string): Promise<GeneratedReport[]> => {
    const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('admin_id', adminId)
        .order('created_at', { ascending: false });
    
    if (error) throw error;

    return data.map((row: any) => ({
        ...row,
        parsedContent: JSON.parse(row.content)
    }));
};

export const deleteReport = async (reportId: string) => {
    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    if (error) throw error;
};

export const deleteAllReports = async (adminId: string) => {
    const { error } = await supabase.from('reports').delete().eq('admin_id', adminId);
    if (error) throw error;
};
