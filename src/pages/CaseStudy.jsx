import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useTranscript } from '../hooks/useTranscript';
import Header from '../components/Header';
import ChatWindow from '../components/ChatWindow';
import ChatInput from '../components/ChatInput';
import '../styles/casestudy.css';

// Heuristic concept tracker — keyword match on assistant messages
function computeCoveredConcepts(concepts, messages) {
  if (!concepts?.length || !messages?.length) return new Set();
  const assistantText = messages
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content.toLowerCase())
    .join(' ');

  const covered = new Set();
  concepts.forEach((c) => {
    const keywords = c.label.toLowerCase().split(/[\s,/-]+/).filter((w) => w.length > 3);
    if (keywords.some((kw) => assistantText.includes(kw))) {
      covered.add(c.id);
    }
  });
  return covered;
}

async function callChatAPI(messages, systemPrompt) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

export default function CaseStudy({ user, isProfessor, signOut, viewMode, setViewMode }) {
  const { caseStudyId } = useParams();
  const navigate = useNavigate();

  const [caseStudy, setCaseStudy] = useState(null);
  const [csLoading, setCsLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(null);

  const {
    messages,
    loading: transcriptLoading,
    effectivePrompt,
    isNew,
    initSession,
    appendMessage,
  } = useTranscript(user, caseStudyId);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadCaseStudy();
  }, [caseStudyId, user]);

  useEffect(() => {
    // If transcript already exists, show chat directly
    if (!transcriptLoading && !isNew && messages.length > 0) {
      setStarted(true);
    }
  }, [transcriptLoading, isNew, messages.length]);

  const loadCaseStudy = async () => {
    setCsLoading(true);
    try {
      // Try the design.md path: /prompts/casestudies/{caseStudyId}
      const ref = doc(db, 'prompts', 'casestudies', caseStudyId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setCaseStudy({ id: snap.id, ...snap.data() });
      } else {
        setError('Case study not found.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load case study.');
    }
    setCsLoading(false);
  };

  const handleStart = async () => {
    setStarted(true);
    setIsThinking(true);
    try {
      // 1. Snapshot prompt into session
      const prompt = await initSession(caseStudy);

      // 2. Send hidden opening message
      const openingMsg = { role: 'user', content: "I'm ready to start the case study." };
      const apiMessages = [openingMsg];

      const reply = await callChatAPI(apiMessages, prompt);

      // 3. Save only the assistant reply (opening message not displayed)
      const assistantMsg = {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };
      await appendMessage(assistantMsg);
    } catch (err) {
      console.error(err);
      setError('Failed to start session. Please try again.');
      setStarted(false);
    }
    setIsThinking(false);
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isThinking) return;

    setInputValue('');
    setIsThinking(true);
    setError(null);

    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    await appendMessage(userMsg);

    try {
      // Build API messages from current messages + new user message
      const apiMessages = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

      const reply = await callChatAPI(apiMessages, effectivePrompt);

      const assistantMsg = {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };
      await appendMessage(assistantMsg);
    } catch (err) {
      console.error(err);
      setError('Failed to get response. Please try again.');
    }

    setIsThinking(false);
  };

  const coveredConcepts = computeCoveredConcepts(caseStudy?.concepts, messages);

  if (csLoading || transcriptLoading) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <span>Loading case study...</span>
      </div>
    );
  }

  if (error && !caseStudy) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <p style={{ color: 'var(--danger)' }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="casestudy-page">
      <Header
        user={user}
        isProfessor={isProfessor}
        signOut={signOut}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <div className="casestudy-layout">
        {/* Sidebar */}
        <aside className="casestudy-sidebar">
          {/* Case study info */}
          <div className="sidebar-section">
            <div className="casestudy-title">{caseStudy?.title}</div>
            {caseStudy?.tutorName && (
              <div className="casestudy-tutor">
                {caseStudy.tutorName}
                {caseStudy.tutorRole && <em> — {caseStudy.tutorRole}</em>}
              </div>
            )}
          </div>

          {/* Concept tracker */}
          {caseStudy?.concepts?.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Concepts</div>
              <div className="concept-list">
                {caseStudy.concepts.map((c) => (
                  <div
                    key={c.id}
                    className={`concept-item${coveredConcepts.has(c.id) ? ' covered' : ''}`}
                  >
                    <div className="concept-dot" />
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary sources */}
          {caseStudy?.primarySources?.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Primary Sources</div>
              <div className="source-list">
                {caseStudy.primarySources.map((src, i) => (
                  <div key={i}>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-link"
                    >
                      {src.label}
                    </a>
                    {src.description && (
                      <div className="source-desc">{src.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div className="sidebar-section">
            <p className="sidebar-note">
              This is a conversation, not a lecture. Ask follow-up questions.
            </p>
          </div>
        </aside>

        {/* Main chat area */}
        <main className="casestudy-main">
          {!started ? (
            <div className="welcome-screen">
              <h2>{caseStudy?.title}</h2>
              {caseStudy?.subtitle && (
                <div className="welcome-subtitle">{caseStudy.subtitle}</div>
              )}
              {caseStudy?.tutorName && (
                <div className="welcome-tutor-desc">
                  <strong>{caseStudy.tutorName}</strong>
                  {caseStudy.tutorRole ? `, ${caseStudy.tutorRole}` : ''}, will guide you through this case study using the Socratic method — asking questions, checking your understanding, and making you do the cognitive work.
                  {caseStudy?.prereqs && (
                    <div style={{ marginTop: '12px' }}>
                      <span className="badge badge-muted">Prereqs: {caseStudy.prereqs}</span>
                    </div>
                  )}
                </div>
              )}
              {error && (
                <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '16px' }}>
                  {error}
                </p>
              )}
              <button className="welcome-start-btn" onClick={handleStart} disabled={isThinking}>
                {isThinking ? 'Starting...' : 'Start Case Study'}
              </button>
            </div>
          ) : (
            <>
              {!isNew && messages.length > 0 && (
                <div className="welcome-back-banner">
                  Welcome back — continuing where you left off.
                </div>
              )}

              {error && (
                <div style={{ padding: '8px 20px', background: 'var(--danger-dim)', color: 'var(--danger)', fontSize: '13px', borderBottom: '1px solid rgba(248,81,73,0.3)' }}>
                  {error}
                </div>
              )}

              <ChatWindow messages={messages} isThinking={isThinking} />

              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSend}
                disabled={isThinking}
                quickPrompts={caseStudy?.quickPrompts || []}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
