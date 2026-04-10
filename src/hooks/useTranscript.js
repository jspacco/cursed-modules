import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export function useTranscript(user, caseStudyId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [effectivePrompt, setEffectivePrompt] = useState('');
  const [isNew, setIsNew] = useState(false);
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (!user || !caseStudyId) return;

    const ref = doc(db, 'students', user.email, 'casestudies', caseStudyId);
    transcriptRef.current = ref;

    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMessages(data.messages || []);
        setEffectivePrompt(data.prompts?.effective || '');
        setIsNew(false);
      } else {
        setMessages([]);
        setEffectivePrompt('');
        setIsNew(true);
      }
      setLoading(false);
    });
  }, [user, caseStudyId]);

  const initSession = async (caseStudy) => {
    const ref = transcriptRef.current;
    const promptContent = caseStudy.content || '';
    const now = new Date().toISOString();

    await setDoc(ref, {
      metadata: {
        studentName: user.displayName || '',
        studentEmail: user.email,
        caseStudyId,
        caseStudyTitle: caseStudy.title || '',
        startedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        completed: false,
      },
      prompts: {
        casestudy: {
          content: promptContent,
          version: caseStudy.version || 1,
          savedAt: now,
        },
        effective: promptContent,
      },
      messages: [],
    });

    setEffectivePrompt(promptContent);
    setIsNew(false);
    return promptContent;
  };

  const appendMessage = async (message) => {
    const ref = transcriptRef.current;
    const updated = [...messages, message];
    setMessages(updated);

    await updateDoc(ref, {
      messages: updated,
      'metadata.lastActiveAt': serverTimestamp(),
    });
  };

  const markCompleted = async () => {
    const ref = transcriptRef.current;
    await updateDoc(ref, { 'metadata.completed': true });
  };

  return {
    messages,
    setMessages,
    loading,
    effectivePrompt,
    isNew,
    initSession,
    appendMessage,
    markCompleted,
  };
}
