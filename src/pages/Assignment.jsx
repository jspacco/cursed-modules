import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useSession } from '../hooks/useSession';
import Header from '../components/Header';
import ChatWindow from '../components/ChatWindow';
import ChatInput from '../components/ChatInput';
import SessionList from '../components/SessionList';
import DesignDocPanel from '../components/DesignDocPanel';
import '../styles/assignment.css';

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

export default function Assignment({ user, isProfessor, signOut, viewMode, setViewMode }) {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const autoNewTriggered = useRef(false);

  const [assignment, setAssignment] = useState(null);
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [assignLoading, setAssignLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'chat'
  const [isThinking, setIsThinking] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('description');

  const {
    sessions,
    currentSession,
    messages,
    loading: sessionsLoading,
    effectivePrompt,
    designDoc,
    openSession,
    startNewSession,
    appendMessage,
    loadSessions,
  } = useSession(user, assignmentId);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadAssignment();
  }, [assignmentId, user]);

  useEffect(() => {
    if (!assignLoading && !sessionsLoading && location.state?.autoNew && !autoNewTriggered.current) {
      autoNewTriggered.current = true;
      handleNewSession();
    }
  }, [assignLoading, sessionsLoading]);

  const loadAssignment = async () => {
    setAssignLoading(true);
    try {
      const ref = doc(db, 'd4-assignments', assignmentId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setAssignment({ id: snap.id, ...snap.data() });
      } else {
        setError('Assignment not found.');
      }
      // Load supporting docs fresh
      await loadSupportingDocs();
    } catch (err) {
      console.error(err);
      setError('Failed to load assignment.');
    }
    setAssignLoading(false);
  };

  const loadSupportingDocs = async () => {
    try {
      const docsRef = collection(db, 'd4-assignments', assignmentId, 'docs');
      const q = query(docsRef, orderBy('order', 'asc'));
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSupportingDocs(docs);
    } catch (err) {
      console.error('Failed to load supporting docs:', err);
      setSupportingDocs([]);
    }
  };

  const handleSelectSession = async (sessionId) => {
    await openSession(sessionId);
    // Reload supporting docs fresh when opening a session
    await loadSupportingDocs();
    setView('chat');
    setActiveTab('description');
  };

  const handleNewSession = async () => {
    setIsThinking(true);
    setError(null);
    try {
      // Load base prompt
      const baseRef = doc(db, 'config', 'd4-base');
      const baseSnap = await getDoc(baseRef);
      const basePrompt = baseSnap.exists()
        ? { content: baseSnap.data().content, version: baseSnap.data().version }
        : { content: '', version: 1 };

      // Load assignment prompt (fresh)
      const assignRef = doc(db, 'd4-assignments', assignmentId);
      const assignSnap = await getDoc(assignRef);
      const assignmentPrompt = assignSnap.exists()
        ? { content: assignSnap.data().content, version: assignSnap.data().version }
        : { content: assignment?.content || '', version: assignment?.version || 1 };

      // Separate included vs reference docs
      const allDocs = [...supportingDocs];
      const includedDocs = allDocs.filter((d) => d.includeInPrompt === true);

      // Start session (assembles + snapshots effective prompt)
      const effective = await startNewSession(
        basePrompt,
        assignmentPrompt,
        includedDocs,
        allDocs,
        assignment
      );

      setView('chat');
      setActiveTab('description');
    } catch (err) {
      console.error(err);
      setError('Failed to start session. Please try again.');
      setIsThinking(false);
      return;
    }

    // Send opening trigger — isolated so a failure here doesn't kill the session.
    try {
      const openingMsg = { role: 'user', content: "I'm ready to start the design exercise." };
      const reply = await callChatAPI([openingMsg], effective);
      if (reply) {
        await appendMessage({
          role: 'assistant',
          content: reply,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Opening message failed:', err);
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

  const handleBackToList = () => {
    setView('list');
    loadSessions();
  };

  // Build tabs for right panel
  const refDocs = supportingDocs.filter((d) => !d.includeInPrompt);

  if (assignLoading || sessionsLoading) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <span>Loading assignment...</span>
      </div>
    );
  }

  if (error && !assignment) {
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
    <div className="assignment-page">
      <Header
        user={user}
        isProfessor={isProfessor}
        signOut={signOut}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {view === 'list' ? (
        <SessionList
          sessions={sessions}
          assignment={assignment}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
        />
      ) : (
        <div className="assignment-layout">
          {/* Left sidebar */}
          <aside className="assignment-sidebar">
            <div className="sidebar-section" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
              <div className="assignment-title-sidebar">{assignment?.title}</div>
              {assignment?.mentorName && (
                <div className="assignment-mentor">
                  {assignment.mentorName}
                  {assignment.mentorRole ? ` — ${assignment.mentorRole}` : ''}
                </div>
              )}
            </div>

            {currentSession && (
              <div className="sidebar-section" style={{ paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                <div className="session-info">
                  <span className="session-num">
                    Session {currentSession.metadata?.sessionNumber}
                  </span>
                  {currentSession.metadata?.startedAt && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Started{' '}
                      {(() => {
                        try {
                          const d = currentSession.metadata.startedAt.toDate?.()
                            || new Date(currentSession.metadata.startedAt);
                          return d.toLocaleDateString();
                        } catch { return ''; }
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ padding: '0 16px' }}>
              <button className="sidebar-link-btn" onClick={handleBackToList}>
                ← All Sessions
              </button>
            </div>
          </aside>

          {/* Chat area */}
          <main className="assignment-main">
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
            />
          </main>

          {/* Right panel */}
          <div className="assignment-right-panel">
            <div className="right-panel-tabs">
              <button
                className={`right-panel-tab${activeTab === 'description' ? ' active' : ''}`}
                onClick={() => setActiveTab('description')}
              >
                Description
              </button>
              {supportingDocs.map((d) => (
                <button
                  key={d.id}
                  className={`right-panel-tab${activeTab === d.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(d.id)}
                >
                  {d.title || 'Other Docs'}
                </button>
              ))}
              <button
                className={`right-panel-tab${activeTab === 'design' ? ' active' : ''}`}
                onClick={() => setActiveTab('design')}
              >
                Design Doc
              </button>
            </div>

            <div className="right-panel-content">
              {activeTab === 'description' ? (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', fontSize: '14px' }}>
                    {assignment?.title}
                  </div>
                  <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {assignment?.description || 'No description provided.'}
                  </p>
                </div>
              ) : activeTab === 'design' ? (
                <DesignDocPanel designDoc={designDoc} />
              ) : (
                (() => {
                  const activeDoc = supportingDocs.find((d) => d.id === activeTab);
                  if (!activeDoc) return null;
                  return (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', fontSize: '14px' }}>
                        {activeDoc.title}
                      </div>
                      <pre style={{
                        fontFamily: activeDoc.type === 'markdown' ? 'var(--font-sans)' : 'var(--font-mono)',
                        fontSize: '13px',
                        lineHeight: 1.7,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                      }}>
                        {activeDoc.content}
                      </pre>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
