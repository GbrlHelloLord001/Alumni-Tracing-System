
import emailjs from '@emailjs/browser';

// Credentials from the provided reference
const PUBLIC_KEY = 'haEhYz7iGgrGEu0kP';
const SERVICE_ID = 'service_om6q4kc';
const TEMPLATE_ID_APPROVAL = 'template_8gw6alr';
const TEMPLATE_ID_HIRED = 'template_v6kh749';

export const initEmailService = () => {
  emailjs.init(PUBLIC_KEY);
};

export const sendApprovalEmail = async (toName: string, toEmail: string, course: string) => {
  try {
    const templateParams = {
      to_name: toName,
      to_email: toEmail,
      course: course,
      from_name: 'Laguna University Alumni System',
      message: `Congratulations! Your alumni account has been approved. You can now log in to the Alumni Tracer System to update your profile and employment status.`,
      subject: 'Alumni Account Approved',
      reply_to: 'placement.alumni.linkages@gmail.com'
    };

    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID_APPROVAL,
      templateParams
    );

    return { success: true, response };
  } catch (error) {
    console.error('EmailJS Error:', error);
    return { success: false, error };
  }
};

export const sendInviteEmail = async (toName: string, toEmail: string) => {
  try {
    const templateParams = {
      to_name: toName,
      to_email: toEmail,
      from_name: 'LU Placement & Linkages Office',
      message: `We noticed your professional profile online and would like to invite you to join the official Laguna University Alumni Tracer System. Please register to stay connected with your alma mater and update your employment records.`,
      subject: 'Invitation: Join the LU Alumni Network',
      reply_to: 'placement.alumni.linkages@gmail.com'
    };

    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID_APPROVAL, // Reusing the generic template
      templateParams
    );

    return { success: true, response };
  } catch (error) {
    console.error('EmailJS Invite Error:', error);
    return { success: false, error };
  }
};

export const sendFollowUpEmail = async (toName: string, toEmail: string, frequency: string) => {
  try {
    const templateParams = {
      to_name: toName,
      to_email: toEmail,
      from_name: 'LU Placement & Linkages Office',
      message: `Greetings! This is your ${frequency} alumni tracer follow-up. We kindly request you to log in to the Alumni Portal and update your current employment status and profile. Your data is vital for our university accreditation and improvement.`,
      subject: `Action Required: ${frequency} Alumni Update`,
      reply_to: 'placement.alumni.linkages@gmail.com'
    };

    // Reusing the generic approval template structure which accepts message/subject
    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID_APPROVAL,
      templateParams
    );

    return { success: true, response };
  } catch (error) {
    console.error('EmailJS FollowUp Error:', error);
    return { success: false, error };
  }
};

export const sendHiredEmail = async (toName: string, toEmail: string, jobTitle: string, companyName: string) => {
  try {
    const templateParams = {
      to_name: toName,
      to_email: toEmail,
      job_title: jobTitle,
      company_name: companyName,
      from_name: 'LU Career Portal',
      message: `We are pleased to inform you that you have been hired for the position of ${jobTitle} at ${companyName}. Please check your inbox in the portal for further instructions.`,
      subject: 'Congratulations! You have been Hired',
      reply_to: 'placement.alumni.linkages@gmail.com'
    };

    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID_HIRED,
      templateParams
    );
    
    return { success: true, response };
  } catch (error) {
    console.error('EmailJS Hired Error:', error);
    return { success: false, error };
  }
};

export const sendUpdateAcknowledgementEmail = async (toName: string, toEmail: string, actionSummary: string) => {
  try {
    const templateParams = {
      to_name: toName,
      to_email: toEmail,
      job_title: "Alumni Update", // Mapping to template variable
      company_name: "Laguna University", // Mapping to template variable
      from_name: 'LU Alumni Admin',
      message: `We have received and processed your update: "${actionSummary}". Your employment record has been automatically updated in our system. Thank you for keeping your profile current.`,
      subject: 'Update Acknowledged',
      reply_to: 'placement.alumni.linkages@gmail.com'
    };

    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID_HIRED, // Using the requested template ID
      templateParams
    );
    
    return { success: true, response };
  } catch (error) {
    console.error('EmailJS Update Ack Error:', error);
    return { success: false, error };
  }
};
