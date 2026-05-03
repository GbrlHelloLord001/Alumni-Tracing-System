
import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { ExtractedData } from "../types";

// Schema definition for the expected output
const extractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    school_name: { type: Type.STRING, description: "The name of the school or university in the document header." },
    student_number: { type: Type.STRING, description: "The student number. If not found (e.g. Diploma), use 'N/A' or try to find a reference number." },
    last_name: { type: Type.STRING, description: "The student's last name" },
    first_name: { type: Type.STRING, description: "The student's first name" },
    middle_name: { type: Type.STRING, description: "The student's middle name" },
    program: { type: Type.STRING, description: "The academic program (e.g., BSIT-SD, Bachelor of Science in...)" },
    year_level: { type: Type.STRING, description: "For Graduating: '4th Year'. For Alumni: The Year Graduated (e.g., '2023')." },
    gender: { type: Type.STRING, description: "Gender (e.g., Female)" },
    email: { type: Type.STRING, description: "Email address. If not in document, leave empty string." },
    contact_no: { type: Type.STRING, description: "Contact number. If not in document, leave empty string." },
    address: { type: Type.STRING, description: "Full address. If not in document, leave empty string." },
    civil_status: { type: Type.STRING, description: "Civil status. If not in document, leave empty string." },
    birthdate: { type: Type.STRING, description: "Birthdate formatted strictly as MM-DD-YYYY. If not found, leave empty string." },
  },
  required: ["last_name", "first_name", "school_name"],
};

const idValidationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    first_name: { type: Type.STRING, description: "The first name found on the document/ID." },
    middle_name: { type: Type.STRING, description: "The middle name found on the document/ID, if any." },
    last_name: { type: Type.STRING, description: "The last name found on the document/ID." },
    birthdate: { type: Type.STRING, description: "Birthdate formatted strictly as MM-DD-YYYY. Leave empty string if not found." },
    id_type: { type: Type.STRING, description: "The type of ID or document (e.g., Driver's License, School ID, UMID, Diploma, Registration Form)." },
    is_valid_id: { type: Type.BOOLEAN, description: "True if this looks like a valid document for identifying a person." }
  },
  required: ["first_name", "last_name", "is_valid_id"]
};

// --- API KEY CONFIGURATION ---
const API_KEY = process.env.GEMINI_API_KEY;

// Initialize with hardcoded key
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Fallback Models for Vision Tasks
// Efficient models for vision and extraction tasks (Fixed aliases)
const MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"];

// --- HELPER: PROGRAM NORMALIZATION ---
export const normalizeProgram = (rawProgram: string): string => {
  if (!rawProgram) return "";
  const p = rawProgram.toUpperCase().replace(/\./g, "").trim(); // Remove dots, trim, uppercase

  // IT & CS
  if (p.includes("INFORMATION TECHNOLOGY") || p.includes("BSIT")) return "Bachelor of Science in Information Technology (BSIT)";
  if (p.includes("COMPUTER SCIENCE") || p.includes("BSCS")) return "Bachelor of Science in Computer Science (BSCS)";

  // Engineering
  if (p.includes("MECHANICAL") || p.includes("BSME")) return "Bachelor of Science in Mechanical Engineering (BSME)";

  // Business & Accountancy
  // Check BSAIS first as it contains 'Accounting' which might conflict if logic is loose
  if (p.includes("ACCOUNTING INFORMATION") || p.includes("BSAIS")) return "Bachelor of Science in Accounting Information System (BSAIS)";
  if (p.includes("ACCOUNTANCY") || p.includes("BSA")) return "Bachelor of Science in Accountancy (BSA)";
  if (p.includes("ENTREPRENEURSHIP") || p.includes("ENTREP") || p.includes("BSE")) return "Bachelor of Science in Entrepreneurship (BSE)";
  if (p.includes("TOURISM") || p.includes("BSTM")) return "Bachelor of Science in Tourism Management (BSTM)";

  // Arts
  if (p.includes("COMMUNICATION") || p.includes("BAC") || p.includes("AB COMM")) return "Bachelor of Arts in Communication (BAC)";

  // Education
  if (p.includes("ELEMENTARY") || p.includes("BEED")) return "Bachelor of Elementary Education (BEED)";
  
  if (p.includes("SECONDARY") || p.includes("BSED")) {
    if (p.includes("ENGLISH")) return "Bachelor of Secondary Education (BSED) English";
    if (p.includes("SCIENCE")) return "Bachelor of Secondary Education (BSED) Science";
    if (p.includes("MATH")) return "Bachelor of Secondary Education (BSED) Math";
    // Fallback if major isn't explicitly found
    return "Bachelor of Secondary Education (BSED)"; 
  }

  // Midwifery
  if (p.includes("MIDWIFERY")) return "Diploma in Midwifery";

  // Return original if no match found
  return rawProgram;
}

export const extractDataFromDocument = async (base64Data: string, mimeType: string, userType: 'graduating' | 'alumni'): Promise<ExtractedData> => {
  
  let promptContext = "";
  if (userType === 'graduating') {
      promptContext = "Analyze this Registration Form (Certificate of Registration).";
  } else {
      promptContext = "Analyze this Alumni Document (Diploma, Transcript of Records, or Alumni ID).";
  }

  const prompt = `
    ${promptContext}
    Extract the details carefully.
    
    Specific Rules:
    - **School Name**: Extract the exact name of the school/university found in the document header. Do not assume it is Laguna University unless explicitly stated.
    - **Year Level**: ${userType === 'graduating' ? "Look for '4th Year' or 'IV'." : "Look for the Year of Graduation (e.g., 2022, 2023)."}
    - **Birthdate**: Format strictly as "MM-DD-YYYY".
    - **Student Number**: If analyzing a Diploma and no ID is present, put "000-0000" as placeholder if not found.
    - **Program**: Map the extracted program to one of these standardized names if possible:
        - Bachelor of Elementary Education (BEED)
        - Bachelor of Secondary Education (BSED) English/Science/Math
        - Bachelor of Science in Entrepreneurship (BSE)
        - Bachelor of Science in Tourism Management (BSTM)
        - Bachelor of Science in Accountancy (BSA)
        - Bachelor of Science in Accounting Information System (BSAIS)
        - Bachelor of Science in Computer Science (BSCS)
        - Bachelor of Science in Information Technology (BSIT)
        - Bachelor of Science in Mechanical Engineering (BSME)
        - Bachelor of Arts in Communication (BAC)
        - Diploma in Midwifery

    Format the response strictly as JSON according to the schema.
  `;

  let lastError: any;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: extractionSchema,
        },
      });

      if (response.text) {
        const data = JSON.parse(response.text) as ExtractedData;
        
        // Apply Normalization Function
        if (data.program) {
          data.program = normalizeProgram(data.program);
        }
        
        return data;
      } else {
        throw new Error("No data returned from AI");
      }
    } catch (error) {
      console.warn(`Model ${model} failed for document extraction:`, error);
      lastError = error;
      // Continue to next model
    }
  }

  console.error("All AI models exhausted:", lastError);
  throw new Error("Failed to extract data. Please ensure the document is clear or try again later.");
};

export const extractDataFromID = async (base64Data: string, mimeType: string): Promise<{ first_name: string; middle_name: string; last_name: string; birthdate: string; is_valid: boolean; id_type: string }> => {
    const prompt = `
      Analyze this image. It should be a Valid ID (Government issued or School ID) or supporting documents of an alumni.
      1. Extract the First Name, Middle Name (if available) and Last Name.
      2. Extract the Birthdate if available (format as MM-DD-YYYY).
      3. Determine the ID/Document Type.
      4. Confirm if it looks like a valid document.
    `;
  
    let lastError: any;

    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: idValidationSchema,
          },
        });
    
        if (response.text) {
          const data = JSON.parse(response.text);
          return {
              first_name: data.first_name || '',
              middle_name: data.middle_name || '',
              last_name: data.last_name || '',
              birthdate: data.birthdate || '',
              is_valid: data.is_valid_id,
              id_type: data.id_type || ''
          };
        }
      } catch (error) {
         console.warn(`Model ${model} failed for ID verification:`, error);
         lastError = error;
      }
    }

    console.error("All AI models exhausted for ID verification:", lastError);
    throw new Error("Failed to verify ID. Please ensure the image is clear or try again later.");
};
