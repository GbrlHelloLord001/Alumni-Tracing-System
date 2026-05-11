

export interface Graduate {
  id?: string;
  student_number?: string;
  academic_year?: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  course: string;
  date_graduated?: string;
  birthdate: string;
  email: string;
  password?: string;
  is_first_login?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type UserType = 'graduating' | 'alumni';

export interface Student {
  id?: string;
  student_number: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  program: string;
  gender: string;
  email: string;
  contact_no: string;
  address: string;
  civil_status?: string;
  birthdate: string;
  year_level?: string;
  enrollment_status?: string;
  resume?: string; // Hex string or binary reference
  table_source?: 'students' | 'alumni'; // Track which table the user record belongs to
  password?: string;
  is_first_login?: boolean;
}

export interface InternetAlumni {
  id?: string;
  full_name: string;
  email: string;
  contact_number?: string;
  course: string;
  graduation_year?: number;
  employment_status: 'Employed' | 'Unemployed' | 'Self-Employed' | 'Freelancer' | 'Not Seeking Employment' | 'Unknown';
  current_job?: string;
  industry?: string;
  job_relation?: 'Related' | 'Non-Related' | 'Unknown' | null;
  link?: string;
  sourced_at: string;
  created_at?: string;
  password?: string;
  is_first_login?: boolean;
}

export interface MiningConfig {
  isActive: boolean;
  frequency: 'Weekly' | 'Monthly' | 'Quarterly';
  lastRun?: string;
  nextRun?: string;
}

export interface ExtractedData {
  student_number: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  program: string;
  gender: string;
  email: string;
  contact_no: string;
  address: string;
  civil_status: string;
  school_name: string;
  year_level: string;
  birthdate: string;
}

export interface Admin {
  id: string;
  username: string;
}

export interface HumanResource {
  id: number;
  company_name: string;
  username: string;
}

export interface JobPosting {
  id: string;
  hr_id: number;
  company_name: string;
  job_title: string;
  job_description: string;
  employment_type: 'Full-Time' | 'Part-Time' | 'Temporary' | 'Contract' | 'Internship';
  job_level: string;
  industry: string;
  salary_range: string;
  location: string;
  application_deadline: string;
  is_active: boolean;
  created_at: string;
  applicant_count?: number; // UI helper
}

export interface JobApplication {
  id: string;
  job_posting_id: string;
  alumni_id?: string;
  student_id?: string;
  application_status: 'Pending' | 'Reviewed' | 'Shortlisted' | 'Interview' | 'Rejected' | 'Hired';
  applied_at: string;
  
  // Joined Data
  job?: JobPosting;
  applicant_details?: Student; // Merged student/alumni details
}

export interface JobMessage {
  id: string;
  application_id: string;
  sender_type: 'HR' | 'ALUMNI' | 'STUDENT';
  hr_id?: number;
  alumni_id?: string;
  student_id?: string;
  message: string;
  is_read: boolean;
  sent_at: string;
}

export interface UserSession {
  email: string;
  id: string;
}

export enum AuthState {
  LOGIN,
  SIGNUP,
  VERIFYING,
  SUCCESS
}

export type EmploymentStatus = 'Employed' | 'Self-employed' | 'Unemployed' | 'Retired';
export type JobAlignment = 'Related' | 'Non-Related';
export type PositionLevel = 
  | 'Intern' 
  | 'Trainee' 
  | 'Entry-Level' 
  | 'Rank and File' 
  | 'Senior Staff' 
  | 'Supervisory' 
  | 'Managerial' 
  | 'Department Head' 
  | 'Director' 
  | 'Vice President' 
  | 'Executive';

export type EmploymentType = 
  | 'Full-Time'
  | 'Part-Time'
  | 'Temporary/Contract'
  | 'Seasonal'
  | 'Casual'
  | 'Internship';

export interface EmploymentFormState {
  id?: string; // For editing
  employment_status: EmploymentStatus | '';
  current_position: string;
  date_hired: string;
  company_name: string;
  company_address: string;
  business_name: string;
  business_address: string;
  business_type: string;
  business_contact_no: string;
  unemployed_reasons: string;
  last_company: string;
  retirement_reason: string;
  date_retired: string;
  industry?: string;
  // New Fields
  business_duration?: string;
  alignment_reason?: string;
  
  // Newest Fields
  employment_type?: EmploymentType;
  salary_range?: string;
  business_revenue?: string;
  
  // UI Helpers for exact input before normalization
  exact_salary?: string;
  exact_revenue?: string;
}

export interface EmploymentRecord extends EmploymentFormState {
  id: string;
  survey_response_id: string;
  job_alignment?: JobAlignment;
  current_job_level?: PositionLevel;
  industry?: string;
  created_at?: string;
}

// --- New Interfaces for Profile / Resume Feature ---

export interface EducationInformation {
  primary_school?: string;
  primary_year_graduated?: string;
  secondary_school?: string;
  secondary_year_graduated?: string;
  bachelors_degree?: string;
  bachelors_year_graduated?: string;
  masters_degree?: string;
  masters_year_graduated_or_units?: string;
  doctoral_degree?: string;
  doctoral_year_graduated_or_units?: string;
  professional_license?: string;
  license_date_passed?: string;
  license_number?: string;
}

export interface EmploymentHistory {
  employment_status?: string;
  job_alignment?: string;
  position?: string;
  date_hired?: string;
  company_name?: string;
  company_address?: string;
  job_level?: string;
  first_job_level?: string;
  time_to_first_job?: string;
  business_name?: string;
  business_address?: string;
  business_type?: string;
  business_contact_no?: string;
  unemployed_reasons?: string;
  last_company?: string;
  retirement_reason?: string;
  date_retired?: string;
  industry?: string;
  is_current_job?: boolean;
}

export interface CommunityEngagement {
  organization_name?: string;
  role?: string;
  date_affiliated?: string;
}

export interface AlumniAttributes {
  // Institutional Graduate Attributes
  professionally_competent?: number;
  critical_thinker?: number;
  communicator?: number;
  lifelong_learner?: number;
  socially_responsible?: number;
  ethical_citizen?: number;
  innovative_worker?: number;
  people_oriented?: number;

  // 21st Century Skills & Literacies
  critical_thinking_skill?: number;
  creativity?: number;
  collaboration?: number;
  communication_skill?: number;
  information_literacy?: number;
  media_literacy?: number;
  technology_literacy?: number;
  flexibility?: number;
  leadership?: number;
  initiative?: number;
  productivity?: number;
  social_skills?: number;
}

export interface ResumeProfile {
    first_name?: string;
    last_name?: string;
    email?: string;
    contact_no?: string;
    address?: string;
}

export interface FullProfileData {
  personal?: ResumeProfile;
  education: EducationInformation;
  employment: EmploymentHistory[]; // Changed to Array
  community: CommunityEngagement[]; // Changed to Array
  attributes: AlumniAttributes;
}

// --- SOCIAL / CONNECT FEATURE INTERFACES ---

export interface AlumniUser {
  id: string; // The Unified ID
  source_table: 'students' | 'alumni';
  source_id: string;
  created_at: string;
  // DB Fields
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  display_name?: string;
  // Hydrated fields from source table
  full_name?: string; // Derived or mapped from display_name
  avatar_initials?: string;
  program?: string;
  batch?: string;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Blocked';
  created_at: string;
  sender?: AlumniUser;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
  friend_details?: AlumniUser;
}

export interface Conversation {
  id: string;
  user_one: string;
  user_two: string;
  created_at: string;
  other_user?: AlumniUser; // Helper for UI
  last_message?: Message; // Helper for UI
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  sent_at: string;
}

export interface Forum {
  id: string;
  title: string;
  description: string;
  created_by: string;
  is_private: boolean;
  created_at: string;
  post_count?: number; // UI Helper
}

export interface ForumPost {
  id: string;
  forum_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: AlumniUser;
  comments?: ForumComment[];
}

export interface ForumComment {
  id: string;
  post_id: string;
  author_id: string;
  comment: string;
  created_at: string;
  author?: AlumniUser;
}

export interface Group {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  post_count?: number; // UI Helper
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  message: string;
  sent_at: string;
  sender?: AlumniUser;
}

// --- REPORTS & ANALYTICS ---

export interface ReportConfig {
  type: 'Employment' | 'Education' | 'Community' | 'Skills' | 'All' | 'Custom';
  subCategory?: string; // e.g., 'Unemployed', 'Employed', 'Retired', etc.
  batch: string; // 'All' or year string
  program: string; // 'All' or program name
  formats: ('Narrative' | 'Table' | 'Graph')[];
  customPrompt?: string; // For 'Custom' type
}

export interface GeneratedReport {
  id: string;
  admin_id: string;
  content: string; // JSON string containing title, sections, etc.
  created_at: string;
  // Specific Categories (Optional - Database Columns)
  employment?: string;
  education?: string;
  community?: string;
  skills?: string;
  // Parsed content helper (not in DB)
  parsedContent?: ReportContent; 
}

export interface ReportContent {
  title: string;
  generatedAt: string;
  filters: {
    batch: string;
    program: string;
    subCategory?: string;
  };
  sections: ReportSection[];
}

export interface ReportSection {
  title: string;
  type: 'text' | 'table' | 'bar-chart' | 'pie-chart';
  content: any; // String for text, Array/Object for table/chart
}

export interface ReportSchedule {
  id: string; // unique ID for local storage tracking
  frequency: 'Monthly' | 'Quarterly' | 'Yearly';
  nextRun: string; // ISO date string
  config: ReportConfig;
  lastRun?: string;
  isActive: boolean;
}