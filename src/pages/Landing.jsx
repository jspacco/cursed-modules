import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import Header from '../components/Header';
import '../styles/landing.css';

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function formatTime(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim();
}

export default function Landing({ user, loading, isProfessor, signIn, signOut, viewMode, setViewMode }) {
  const navigate = useNavigate();
  const [caseStudies, setCaseStudies] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [studentData, setStudentData] = useState({ casestudies: {}, assignments: {} });
  const [contentLoading, setContentLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadContent();
  }, [user]);

  const loadContent = async () => {
    setContentLoading(true);
    try {
      const [csSnap, assignSnap, studentCsSnap, studentAssignSnap] = await Promise.all([
        getDocs(query(collection(db, 'casestudies'), where('active', '==', true), orderBy('order', 'asc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'd4-assignments'), where('active', '==', true), orderBy('order', 'asc'))).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'students', user.email, 'casestudies')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'students', user.email, 'assignments')).catch(() => ({ docs: [] })),
      ]);

      const csProgress = {};
      studentCsSnap.docs.forEach((d) => { csProgress[d.id] = d.data(); });
      const assignProgress = {};
      studentAssignSnap.docs.forEach((d) => { assignProgress[d.id] = d.data(); });
      setStudentData({ casestudies: csProgress, assignments: assignProgress });

      setCaseStudies(csSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAssignments(assignSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error loading content:', err);
    }
    setContentLoading(false);
  };

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="landing-page">
        <div className="signin-screen">
          <div className="signin-card">
            <div className="signin-logo">⚡</div>
            <div className="signin-college">Knox College · CS</div>
            <h1>Cursed Modules</h1>
            <p>
              Interactive case studies and design exercises for systems architecture.
              Sign in with your Knox Google account to get started.
            </p>
            <button className="google-signin-btn" onClick={signIn}>
              <GoogleIcon />
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasCsProgress = (csId) => !!studentData.casestudies[csId];
  const isCompleted = (csId) => studentData.casestudies[csId]?.metadata?.completed;
  const hasAssignProgress = (assignId) => !!studentData.assignments[assignId];

  return (
    <div className="landing-page">
      <Header
        user={user}
        isProfessor={isProfessor}
        signOut={signOut}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <main className="landing-content">
        <div className="landing-greeting">
          <h1>Welcome back, {user.displayName?.split(' ')[0] || 'student'}.</h1>
          <p>Continue your work below, or start something new.</p>
        </div>

        {/* Case Studies */}
        <section className="landing-section">
          <div className="landing-section-header">
            <h2>Case Studies</h2>
            <span className="section-desc">Socratic conversations about software design failures</span>
          </div>

          {contentLoading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : caseStudies.length === 0 ? (
            <div className="empty-state">
              No case studies available yet. Check back soon.
            </div>
          ) : (
            <div className="card-grid">
              {caseStudies.map((cs) => {
                const completed = isCompleted(cs.id);
                const hasProgress = hasCsProgress(cs.id);
                return (
                  <div
                    key={cs.id}
                    className={`activity-card${completed ? ' completed' : ''}`}
                  >
                    <div className="card-header">
                      <div className="card-title">{cs.title}</div>
                      {completed && <span className="card-checkmark">✓</span>}
                    </div>

                    {cs.subtitle && (
                      <div className="card-subtitle">{cs.subtitle}</div>
                    )}

                    <div className="card-meta">
                      {cs.prereqs && (
                        <span className="badge badge-muted">{cs.prereqs}</span>
                      )}
                      {cs.estimatedMinutes && (
                        <span className="card-time">
                          ⏱ {formatTime(cs.estimatedMinutes)}
                        </span>
                      )}
                    </div>

                    {cs.tutorName && (
                      <div className="card-tutor">
                        with {cs.tutorName}
                        {cs.tutorRole ? ` — ${cs.tutorRole}` : ''}
                      </div>
                    )}

                    <div className="card-footer">
                      <button
                        className={`card-btn ${hasProgress ? 'card-btn-resume' : 'card-btn-begin'}`}
                        onClick={() => navigate(`/case/${cs.id}`)}
                      >
                        {completed ? 'Review' : hasProgress ? 'Resume' : 'Begin'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* D4 Assignments */}
        <section className="landing-section">
          <div className="landing-section-header">
            <h2>D4 Assignments</h2>
            <span className="section-desc">Design Doc Driven Development with Klaus</span>
          </div>

          {contentLoading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="empty-state">
              No assignments available yet. Check back soon.
            </div>
          ) : (
            <div className="card-grid">
              {assignments.map((assign) => {
                const hasProgress = hasAssignProgress(assign.id);
                return (
                  <div key={assign.id} className="activity-card">
                    <div className="card-header">
                      <div className="card-title">{assign.title}</div>
                    </div>

                    {assign.subtitle && (
                      <div className="card-subtitle">{assign.subtitle}</div>
                    )}

                    <div className="card-meta">
                      {assign.prereqs && (
                        <span className="badge badge-muted">{assign.prereqs}</span>
                      )}
                      {assign.estimatedMinutes && (
                        <span className="card-time">
                          ⏱ {formatTime(assign.estimatedMinutes)}
                        </span>
                      )}
                    </div>

                    {assign.description && (
                      <div className="card-description">{assign.description}</div>
                    )}

                    {assign.mentorName && (
                      <div className="card-tutor">
                        with {assign.mentorName}
                        {assign.mentorRole ? ` — ${assign.mentorRole}` : ''}
                      </div>
                    )}

                    <div className="card-footer">
                      <button
                        className={`card-btn ${hasProgress ? 'card-btn-resume' : 'card-btn-begin'}`}
                        onClick={() => navigate(`/assignment/${assign.id}`)}
                      >
                        {hasProgress ? 'View Sessions' : 'Begin'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
