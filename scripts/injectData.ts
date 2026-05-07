import { supabase } from '../lib/supabaseClient';
import { REALISTIC_ALUMNI } from './mockDataset';

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Education', 'Finance', 
  'Hospitality', 'Retail', 'Manufacturing', 'Government'
];

const POSITIONS = [
  'Software Engineer', 'Data Analyst', 'Teacher', 'Manager',
  'Sales Executive', 'HR Specialist', 'IT Support', 'Chef', 'Agent'
];

const COMPANIES = [
  'TechCorp', 'InnoVentures', 'Global Solutions', 'Acme Corp',
  'Laguna Tech', 'NextGen Systems', 'EduCare', 'FinServe', 'Mega Retail', 'City Gov'
];

const MISALIGNMENT_REASONS = [
  'Higher salary/compensation in current job',
  'Better career growth opportunities',
  'No available jobs related to my degree',
  'Change of career interest',
  'Better work-life balance',
  'Location constraints and availability of jobs locally',
  'Took the first job offered after graduation',
  'Lack of passing licensure exam',
  'Family reasons/business'
];

async function run() {
  console.log(`Starting generation of ${REALISTIC_ALUMNI.length} mock alumni...`);
  
  // Generate graduates
  const newGraduates = [];
  for (let i = 0; i < REALISTIC_ALUMNI.length; i++) {
    const p = REALISTIC_ALUMNI[i];
    const year = parseInt(p.grad);
    
    newGraduates.push({
      first_name: p.first,
      last_name: p.last,
      middle_name: p.middle,
      course: p.course,
      academic_year: String(year),
      email: p.email,
      date_graduated: new Date(year, 5, 15).toISOString().split('T')[0],
      is_first_login: true,
      password: 'password123'
    });
  }

  console.log("Inserting into graduates_import...");
  const { data: insertedGrads, error: gradError } = await supabase
    .from('graduates_import')
    .insert(newGraduates)
    .select();

  if (gradError) {
      console.error(gradError);
      return;
  }
  console.log(`Inserted ${insertedGrads.length} graduates.`);

  // Map 70% of them to be "activated" Alumni
  const activatedCount = Math.floor(insertedGrads.length * 0.7);
  const activatedGrads = insertedGrads.slice(0, activatedCount);
  
  // Insert into Alumni table
  const alumniRecords = activatedGrads.map(g => ({
      first_name: g.first_name,
      last_name: g.last_name,
      email: g.email,
      contact_no: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
      program: g.course,
      year_level: g.academic_year,
      student_number: `ST-${Math.floor(10000000 + Math.random() * 90000000)}`,
      gender: 'Unknown',
      address: 'Unknown',
      birthdate: new Date(1998, 1, 1).toISOString().split('T')[0],
      is_first_login: true,
      password: 'password123'
  }));

  console.log("Activating users as Alumni...");
  const { data: insertedAlumni, error: alumniError } = await supabase
      .from('alumni')
      .insert(alumniRecords)
      .select();

  if (alumniError) {
      console.error(alumniError);
      return;
  }
  console.log(`Activated ${insertedAlumni.length} alumni.`);

  console.log("Generating survey responses...");
  const surveyToInsert = insertedAlumni.map(alumni => ({
       respondent_type: 'alumni',
       alumni_id: alumni.id
  }));
  
  const { data: insertedSurveys, error: surveyError } = await supabase
       .from('survey_responses')
       .insert(surveyToInsert)
       .select();
  if (surveyError) {
      console.error(surveyError);
      return;
  }
  console.log(`Generated ${insertedSurveys.length} survey responses.`);

  console.log("Generating employment history and survey answers...");
  const employmentRecords = [];
  const educationRecords = [];

  for (let i = 0; i < insertedSurveys.length; i++) {
      const survey = insertedSurveys[i];
      const alumni = insertedAlumni[i];

      const employmentStatusRand = Math.random();
      if (employmentStatusRand > 0.3) {
          // 70% employed/self-employed
          const statusType = Math.random() > 0.1 ? 'Employed' : 'Self-employed';
          const alignment = Math.random() > 0.4 ? 'Related' : 'Non-Related';
          const alignReason = alignment === 'Non-Related' 
            ? MISALIGNMENT_REASONS[Math.floor(Math.random() * MISALIGNMENT_REASONS.length)] 
            : null;
          
          const empTypes = ['Full-Time', 'Part-Time', 'Temporary/Contract', 'Seasonal', 'Casual', 'Internship'];
          const posLevels = ['Intern', 'Trainee', 'Entry-Level', 'Rank and File', 'Senior Staff', 'Supervisory', 'Managerial', 'Department Head', 'Director', 'Vice President', 'Executive'];
          
          employmentRecords.push({
              survey_response_id: survey.id,
              current_position: POSITIONS[Math.floor(Math.random() * POSITIONS.length)],
              company_name: COMPANIES[Math.floor(Math.random() * COMPANIES.length)],
              industry: INDUSTRIES[Math.floor(Math.random() * INDUSTRIES.length)],
              date_hired: new Date(Date.now() - Math.random() * 100000000000).toISOString().split('T')[0],
              employment_status: statusType,
              employment_type: empTypes[Math.floor(Math.random() * empTypes.length)],
              current_job_level: posLevels[Math.floor(Math.random() * posLevels.length)],
              job_alignment: alignment,
              alignment_reason: alignReason,
              salary_range: '₱30,000 - ₱40,000'
          });
      } else if (employmentStatusRand > 0.05) {
          // 25% unemployed
          const UNEMPLOYED_REASONS = [
            'Continuing professional development',
            'Family priorities',
            'Health reasons',
            'Lack of job opportunities',
            'Currently looking for a job',
            'Pursuing further studies'
          ];
          employmentRecords.push({
              survey_response_id: survey.id,
              employment_status: 'Unemployed',
              unemployed_reasons: UNEMPLOYED_REASONS[Math.floor(Math.random() * UNEMPLOYED_REASONS.length)],
              last_company: COMPANIES[Math.floor(Math.random() * COMPANIES.length)]
          });
      } else {
          // 5% retired
          const RETIREMENT_REASONS = [
            'Reached mandatory retirement age',
            'Early retirement',
            'Health reasons',
            'Family priorities',
            'Started own business'
          ];
          employmentRecords.push({
              survey_response_id: survey.id,
              employment_status: 'Retired',
              retirement_reason: RETIREMENT_REASONS[Math.floor(Math.random() * RETIREMENT_REASONS.length)],
              date_retired: new Date(Date.now() - Math.random() * 100000000000).toISOString().split('T')[0]
          });
      }

      const isMaster = Math.random() > 0.8;
      if (isMaster) {
           educationRecords.push({
               survey_response_id: survey.id,
               bachelors_degree: alumni?.program || 'Unknown Course',
               masters_degree: 'Master in Information Technology',
               masters_year_graduated_or_units: '2025'
           });
      }
  }

  if (employmentRecords.length > 0) {
       const { error: empError } = await supabase.from('employment_information').insert(employmentRecords);
       if (empError) {
           console.error(empError);
       }
  }
  
  if (educationRecords.length > 0) {
       const { error: eduError } = await supabase.from('education_information').insert(educationRecords);
       if (eduError) {
           console.error(eduError);
       }
  }
  
  console.log("Generation Complete! ✅");
}

run();
