export const COURSES = [
    "Bachelor of Elementary Education (BEED)",
    "Bachelor of Secondary Education (BSED) English",
    "Bachelor of Secondary Education (BSED) Science",
    "Bachelor of Secondary Education (BSED) Math",
    "Bachelor of Science in Entrepreneurship (BSE)",
    "Bachelor of Science in Tourism Management (BSTM)",
    "Bachelor of Science in Accountancy (BSA)",
    "Bachelor of Science in Accountancy Information System (BSAIS)",
    "Bachelor of Science in Computer Science (BSCS)",
    "Bachelor of Science in Information Technology (BSIT)",
    "Bachelor of Science in Mechanical Engineering (BSME)",
    "Bachelor of Arts in Communication (BAC)",
    "Diploma in Midwifery"
];

export const COURSE_ABBREVIATIONS: Record<string, string> = {
    "Bachelor of Elementary Education (BEED)": "BEED",
    "Bachelor of Secondary Education (BSED) English": "BSED English",
    "Bachelor of Secondary Education (BSED) Science": "BSED Science",
    "Bachelor of Secondary Education (BSED) Math": "BSED Math",
    "Bachelor of Science in Entrepreneurship (BSE)": "BSE",
    "Bachelor of Science in Tourism Management (BSTM)": "BSTM",
    "Bachelor of Science in Accountancy (BSA)": "BSA",
    "Bachelor of Science in Accountancy Information System (BSAIS)": "BSAIS",
    "Bachelor of Science in Computer Science (BSCS)": "BSCS",
    "Bachelor of Science in Information Technology (BSIT)": "BSIT",
    "Bachelor of Science in Mechanical Engineering (BSME)": "BSME",
    "Bachelor of Arts in Communication (BAC)": "BAC",
    "Diploma in Midwifery": "Midwifery"
};

export function normalizeProgram(program: string | null | undefined): string {
    if (!program) return 'Unknown';
    
    // Normalize string for comparison
    const lowerProgram = program.toLowerCase().trim();

    // Map common raw database entries to standard formatted versions
    if (lowerProgram.includes('elementary ed') || lowerProgram.includes('beed')) return "Bachelor of Elementary Education (BEED)";
    if ((lowerProgram.includes('secondary ed') || lowerProgram.includes('bsed')) && lowerProgram.includes('english')) return "Bachelor of Secondary Education (BSED) English";
    if ((lowerProgram.includes('secondary ed') || lowerProgram.includes('bsed')) && lowerProgram.includes('science')) return "Bachelor of Secondary Education (BSED) Science";
    if ((lowerProgram.includes('secondary ed') || lowerProgram.includes('bsed')) && lowerProgram.includes('math')) return "Bachelor of Secondary Education (BSED) Math";
    if (lowerProgram.includes('entrepreneurship') || lowerProgram.includes('bse')) return "Bachelor of Science in Entrepreneurship (BSE)";
    if (lowerProgram.includes('tourism') || lowerProgram.includes('bstm')) return "Bachelor of Science in Tourism Management (BSTM)";
    
    // Check BSAIS before BSA to prevent false positives
    if (lowerProgram.includes('accountancy information system') || lowerProgram.includes('bsais')) return "Bachelor of Science in Accountancy Information System (BSAIS)";
    if (lowerProgram.includes('accountancy') || lowerProgram.includes('bsa')) return "Bachelor of Science in Accountancy (BSA)";
    
    if (lowerProgram.includes('computer science') || lowerProgram.includes('bscs')) return "Bachelor of Science in Computer Science (BSCS)";
    if (lowerProgram.includes('information technology') || lowerProgram.includes('bsit')) return "Bachelor of Science in Information Technology (BSIT)";
    if (lowerProgram.includes('mechanical engineering') || lowerProgram.includes('bsme')) return "Bachelor of Science in Mechanical Engineering (BSME)";
    if (lowerProgram.includes('communication') || lowerProgram.includes('bac')) return "Bachelor of Arts in Communication (BAC)";
    if (lowerProgram.includes('midwifery')) return "Diploma in Midwifery";
    
    // Check against exact standard list elements just in case
    const match = COURSES.find(c => c.toLowerCase() === lowerProgram);
    if (match) return match;

    // Default fallback
    return program; // Better to return the original if not found than 'Unknown'
}

export function normalizeBatchYear(yearLevel: string | undefined, dateGraduated?: string | null): string {
    // If year_level looks like a year, use it
    if (yearLevel && !isNaN(parseInt(yearLevel))) {
        if (yearLevel.length === 4) return yearLevel;
    }

    // Try to extract from dateGraduated
    if (dateGraduated) {
        try {
            const date = new Date(dateGraduated);
            if (!isNaN(date.getFullYear())) {
                return date.getFullYear().toString();
            }
        } catch (e) {
            // Ignore error
        }
    }

    return yearLevel || 'Unknown';
}
