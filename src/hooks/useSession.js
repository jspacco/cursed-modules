import { useState, useEffect, useRef } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

export function useSession(user, assignmentId) {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  const [effectivePrompt, setEffectivePrompt] = useState('');
  const [designDoc, setDesignDoc] = useState('');
  const [loading, setLoading] = useState(true);
  const sessionDocRef = useRef(null);

  // Keep messagesRef in sync so appendMessage never reads stale closure state.
  const setMessagesSync = (msgs) => {
    messagesRef.current = msgs;
    setMessages(msgs);
  };

  useEffect(() => {
    if (!user || !assignmentId) return;
    loadSessions();
  }, [user, assignmentId]);

  const loadSessions = async () => {
    setLoading(true);
    const sessionsRef = collection(
      db,
      'students',
      user.email,
      'assignments',
      assignmentId,
      'sessions'
    );
    const q = query(sessionsRef, orderBy('metadata.sessionNumber', 'asc'));
    const snap = await getDocs(q);
    const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setSessions(loaded);
    setLoading(false);
  };

  const openSession = async (sessionId) => {
    const ref = doc(
      db,
      'students',
      user.email,
      'assignments',
      assignmentId,
      'sessions',
      sessionId
    );
    sessionDocRef.current = ref;
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      setCurrentSession({ id: sessionId, ...data });
      setMessagesSync(data.messages || []);
      setEffectivePrompt(data.prompts?.effective || '');
      setDesignDoc(data.designDoc || '');
    }
  };

  const startNewSession = async (basePrompt, assignmentPrompt, includedDocs, allDocs, assignment) => {
    // Build effective prompt
    const docParts = includedDocs
      .sort((a, b) => a.order - b.order)
      .map((d) => d.content);

    const parts = [basePrompt.content, assignmentPrompt.content, ...docParts].filter(Boolean);
    const effective = parts.join('\n\n');

    // Count existing sessions for session number
    const sessionNumber = sessions.length + 1;
    const sessionId = `session-${Date.now()}`;

    const ref = doc(
      db,
      'students',
      user.email,
      'assignments',
      assignmentId,
      'sessions',
      sessionId
    );
    sessionDocRef.current = ref;

    const now = new Date().toISOString();
    const sessionData = {
      metadata: {
        studentName: user.displayName || '',
        studentEmail: user.email,
        assignmentId,
        assignmentTitle: assignment.title || '',
        sessionId,
        sessionNumber,
        startedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        completed: false,
      },
      prompts: {
        base: {
          content: basePrompt.content,
          version: basePrompt.version || 1,
          savedAt: now,
        },
        assignment: {
          content: assignmentPrompt.content,
          version: assignmentPrompt.version || 1,
          savedAt: now,
        },
        includedDocs: includedDocs.map((d) => ({
          docId: d.id,
          title: d.title,
          content: d.content,
          type: d.type,
          version: d.version || 1,
          savedAt: now,
        })),
        effective,
      },
      messages: [],
      designDoc: '',
    };

    await setDoc(ref, sessionData);

    // Write parent assignment doc so Landing page can detect progress via
    // getDocs(collection(db, 'students', email, 'assignments')).
    // Firestore subcollections don't create their parent document automatically.
    const assignmentDocRef = doc(db, 'students', user.email, 'assignments', assignmentId);
    await setDoc(assignmentDocRef, {
      assignmentId,
      lastSessionAt: serverTimestamp(),
    }, { merge: true });

    setCurrentSession({ id: sessionId, ...sessionData });
    setMessagesSync([]);
    setEffectivePrompt(effective);
    setDesignDoc('');
    await loadSessions();
    return effective;
  };

  const appendMessage = async (message) => {
    const ref = sessionDocRef.current;
    const updated = [...messagesRef.current, message];
    setMessagesSync(updated);

    await updateDoc(ref, {
      messages: updated,
      'metadata.lastActiveAt': serverTimestamp(),
    });

    // Check for design doc extraction
    if (message.role === 'assistant') {
      const start = '===DESIGN DOCUMENT START===';
      const end = '===DESIGN DOCUMENT END===';
      if (message.content.includes(start) && message.content.includes(end)) {
        const startIdx = message.content.indexOf(start) + start.length;
        const endIdx = message.content.indexOf(end);
        const extracted = message.content.slice(startIdx, endIdx).trim();
        if (extracted) {
          setDesignDoc(extracted);
          await updateDoc(ref, { designDoc: extracted });
        }
      }
    }
  };

  const markCompleted = async () => {
    const ref = sessionDocRef.current;
    await updateDoc(ref, { 'metadata.completed': true });
  };

  return {
    sessions,
    currentSession,
    messages,
    setMessages,
    loading,
    effectivePrompt,
    designDoc,
    openSession,
    startNewSession,
    appendMessage,
    markCompleted,
    loadSessions,
  };
}
