
import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import HRDashboard from './components/HRDashboard';
import { Student, Admin, HumanResource } from './types';
import { supabase } from './lib/supabaseClient';

function App() {
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);
  const [adminProfile, setAdminProfile] = useState<Admin | null>(null);
  const [hrProfile, setHrProfile] = useState<HumanResource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for persisted sessions in localStorage
    const storedUser = localStorage.getItem('lu_tracer_user');
    const storedAdmin = localStorage.getItem('lu_tracer_admin');
    const storedHR = localStorage.getItem('lu_tracer_hr');

    if (storedAdmin) {
      try {
        const parsedAdmin = JSON.parse(storedAdmin);
        setAdminProfile(parsedAdmin);
      } catch (e) {
        console.error("Failed to parse stored admin", e);
        localStorage.removeItem('lu_tracer_admin');
      }
    } else if (storedHR) {
      try {
        const parsedHR = JSON.parse(storedHR);
        setHrProfile(parsedHR);
      } catch (e) {
        console.error("Failed to parse stored HR", e);
        localStorage.removeItem('lu_tracer_hr');
      }
    } else if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setStudentProfile(parsedUser);
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem('lu_tracer_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (student: Student) => {
    setStudentProfile(student);
    localStorage.setItem('lu_tracer_user', JSON.stringify(student));
    // Ensure others are logged out
    setAdminProfile(null);
    setHrProfile(null);
    localStorage.removeItem('lu_tracer_admin');
    localStorage.removeItem('lu_tracer_hr');
  };

  const handleAdminLoginSuccess = (admin: Admin) => {
    setAdminProfile(admin);
    localStorage.setItem('lu_tracer_admin', JSON.stringify(admin));
    // Ensure others are logged out
    setStudentProfile(null);
    setHrProfile(null);
    localStorage.removeItem('lu_tracer_user');
    localStorage.removeItem('lu_tracer_hr');
  };

  const handleHRLoginSuccess = (hr: HumanResource) => {
    setHrProfile(hr);
    localStorage.setItem('lu_tracer_hr', JSON.stringify(hr));
    // Ensure others are logged out
    setStudentProfile(null);
    setAdminProfile(null);
    localStorage.removeItem('lu_tracer_user');
    localStorage.removeItem('lu_tracer_admin');
  };

  const handleLogout = async () => {
    // Clear all sessions
    localStorage.removeItem('lu_tracer_user');
    localStorage.removeItem('lu_tracer_admin');
    localStorage.removeItem('lu_tracer_hr');
    setStudentProfile(null);
    setAdminProfile(null);
    setHrProfile(null);
    // Optional: Sign out from supabase
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Admin Dashboard
  if (adminProfile) {
    return <AdminDashboard admin={adminProfile} onLogout={handleLogout} />;
  }

  // HR Dashboard
  if (hrProfile) {
    return <HRDashboard hr={hrProfile} onLogout={handleLogout} />;
  }

  // Student/Alumni Dashboard
  if (studentProfile) {
    return <Dashboard user={studentProfile} onLogout={handleLogout} />;
  }

  // Login/Signup Page
  return (
    <AuthPage 
      onLoginSuccess={handleLoginSuccess}
      onAdminLoginSuccess={handleAdminLoginSuccess}
      onHRLoginSuccess={handleHRLoginSuccess}
    />
  );
}

export default App;
