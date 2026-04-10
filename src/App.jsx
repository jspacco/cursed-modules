import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Landing from './pages/Landing';
import CaseStudy from './pages/CaseStudy';
import Assignment from './pages/Assignment';
import InstructorDashboard from './pages/InstructorDashboard';

export default function App() {
  const { user, loading, isProfessor, permissions, signIn, signOut } = useAuth();
  // Professors default to student view; resets on reload
  const [viewMode, setViewMode] = useState('student');

  const sharedProps = { user, isProfessor, signOut, permissions, viewMode, setViewMode };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Landing
              {...sharedProps}
              loading={loading}
              signIn={signIn}
            />
          }
        />
        <Route
          path="/case/:caseStudyId"
          element={
            !loading && !user
              ? <Navigate to="/" replace />
              : <CaseStudy {...sharedProps} />
          }
        />
        <Route
          path="/assignment/:assignmentId"
          element={
            !loading && !user
              ? <Navigate to="/" replace />
              : <Assignment {...sharedProps} />
          }
        />
        <Route
          path="/instructor"
          element={
            !loading && !isProfessor
              ? <Navigate to="/" replace />
              : <InstructorDashboard {...sharedProps} />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
