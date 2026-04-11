import { useState, useEffect, useRef } from 'react';
import { useDirty } from '../context/DirtyContext';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import Header from '../components/Header';
import MessageBubble from '../components/MessageBubble';
import '../styles/dashboard.css';

function formatDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

function formatDateShort(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
}

// ─── Prompt Editor (inline, not separate component file) ──────────────────────
function InlinePromptEditor({ docPath, initialData, userEmail, label }) {
  const [content, setContent] = useState(initialData?.content || '');
  const [version, setVersion] = useState(initialData?.version || 1);
  const [updatedAt, setUpdatedAt] = useState(initialData?.updatedAt || null);
  const [updatedBy, setUpdatedBy] = useState(initialData?.updatedBy || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { setDirty } = useDirty();

  // Always-fresh ref so the dirty-modal Save can read current content
  const contentRef = useRef(content);

  useEffect(() => () => setDirty(false), [setDirty]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const segments = docPath.split('/').filter(Boolean);
      const ref = doc(db, ...segments);
      const newVersion = version + 1;
      const now = serverTimestamp();
      await setDoc(ref, {
        content: contentRef.current,
        version: newVersion,
        updatedAt: now,
        updatedBy: userEmail,
      }, { merge: true });
      setVersion(newVersion);
      setUpdatedBy(userEmail);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save error:', err);
      alert('Save failed: ' + err.message);
    }
    setSaving(false);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    contentRef.current = val;
    setDirty(true, handleSave);
  };

  return (
    <div className="prompt-area">
      <div className="prompt-meta">
        {version && <span>Version: <strong>{version}</strong></span>}
        {updatedAt && <span>Last updated: <strong>{formatDate(updatedAt)}</strong></span>}
        {updatedBy && <span>By: <strong>{updatedBy}</strong></span>}
      </div>
      <div className="warning-banner" style={{ marginBottom: '12px' }}>
        ⚠️ Changes apply to new sessions only. Existing sessions use the prompt version active when they started.
      </div>
      <textarea
        className="prompt-textarea"
        value={content}
        onChange={handleChange}
        placeholder={`Enter ${label || 'prompt'} content...`}
      />
      <div className="prompt-actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : `Save ${label || 'Prompt'}`}
        </button>
        {saved && <span style={{ color: 'var(--success)', fontSize: '13px' }}>✓ Saved</span>}
      </div>
    </div>
  );
}

// ─── Supporting Doc Editor ────────────────────────────────────────────────────
function DocEditor({ doc: docData, assignmentId, userEmail, onSaved }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(docData.title || '');
  const [content, setContent] = useState(docData.content || '');
  const [type, setType] = useState(docData.type || 'markdown');
  const [includeInPrompt, setIncludeInPrompt] = useState(docData.includeInPrompt || false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { setDirty } = useDirty();

  // Ref so handleSave always reads the latest field values (avoids stale closures)
  const fieldsRef = useRef({ title, content, type, includeInPrompt });

  useEffect(() => () => setDirty(false), [setDirty]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { title: t, content: c, type: ty, includeInPrompt: ip } = fieldsRef.current;
      const ref = doc(db, 'd4-assignments', assignmentId, 'docs', docData.id);
      await setDoc(ref, {
        title: t,
        content: c,
        type: ty,
        includeInPrompt: ip,
        version: (docData.version || 0) + 1,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      }, { merge: true });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onSaved) onSaved();
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
    setSaving(false);
  };

  const markDirty = () => setDirty(true, handleSave);

  const setField = (field, value) => {
    fieldsRef.current = { ...fieldsRef.current, [field]: value };
    markDirty();
  };

  return (
    <div className="doc-item">
      <div className="doc-item-header" onClick={() => setOpen(!open)}>
        <div className="doc-item-left">
          <span className="doc-item-title">{title || '(untitled)'}</span>
          <span className="badge badge-muted">{type}</span>
          <span className="doc-item-meta">v{docData.version || 1}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label className="include-checkbox" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={includeInPrompt}
              onChange={(e) => {
                const v = e.target.checked;
                setIncludeInPrompt(v);
                setField('includeInPrompt', v);
              }}
            />
            Include in prompt
          </label>
          <span className={`chevron${open ? ' open' : ''}`}>▼</span>
        </div>
      </div>

      {open && (
        <div className="doc-item-body">
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setField('title', e.target.value); }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select
              className="form-select"
              value={type}
              onChange={(e) => { setType(e.target.value); setField('type', e.target.value); }}
            >
              <option value="markdown">Markdown</option>
              <option value="plaintext">Plaintext</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Content</label>
            <textarea
              className="prompt-textarea"
              style={{ minHeight: '160px' }}
              value={content}
              onChange={(e) => { setContent(e.target.value); setField('content', e.target.value); }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Document'}
            </button>
            {saved && <span style={{ color: 'var(--success)', fontSize: '13px' }}>✓ Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assignment Editor ────────────────────────────────────────────────────────
function AssignmentEditor({ assignmentId, userEmail, onBack }) {
  const [data, setData] = useState(null);
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({});
  const { setDirty, guardedNavigate } = useDirty();

  // Always-fresh ref so the dirty-modal Save reads current form state
  const formRef = useRef(form);
  const dataRef = useRef(data);

  useEffect(() => () => setDirty(false), [setDirty]);

  useEffect(() => {
    load();
  }, [assignmentId]);

  const load = async () => {
    setLoading(true);
    try {
      const ref = doc(db, 'd4-assignments', assignmentId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        setData(d);
        dataRef.current = d;
        setForm(d);
        formRef.current = d;
      }
      const docsSnap = await getDocs(
        query(
          collection(db, 'd4-assignments', assignmentId, 'docs'),
          orderBy('order', 'asc')
        )
      );
      setSupportingDocs(docsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentForm = formRef.current;
      const currentData = dataRef.current;
      const ref = doc(db, 'd4-assignments', assignmentId);
      await setDoc(ref, {
        ...currentForm,
        version: (currentData?.version || 0) + 1,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
        active: currentForm.active === true || currentForm.active === 'true',
        order: parseInt(currentForm.order) || 0,
        estimatedMinutes: parseInt(currentForm.estimatedMinutes) || 0,
      }, { merge: true });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
    setSaving(false);
  };

  const handleAddDoc = async () => {
    try {
      const maxOrder = supportingDocs.reduce((m, d) => Math.max(m, d.order || 0), 0);
      const newDocRef = doc(collection(db, 'd4-assignments', assignmentId, 'docs'));
      await setDoc(newDocRef, {
        title: '',
        content: '',
        type: 'markdown',
        includeInPrompt: false,
        order: maxOrder + 1,
        version: 1,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      });
      await load();
    } catch (err) {
      alert('Failed to add doc: ' + err.message);
    }
  };

  const f = (field) => (e) => {
    const updated = { ...formRef.current, [field]: e.target.value };
    formRef.current = updated;
    setForm(updated);
    setDirty(true, handleSave);
  };
  const fb = (field) => (e) => {
    const updated = { ...formRef.current, [field]: e.target.checked };
    formRef.current = updated;
    setForm(updated);
    setDirty(true, handleSave);
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button className="back-btn" onClick={() => guardedNavigate(onBack)}>← Back</button>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {data?.title || assignmentId}
        </h2>
      </div>

      <div className="editor-form" style={{ marginBottom: '24px' }}>
        <h3>Assignment Metadata &amp; Prompt</h3>

        <div className="editor-form-grid">
          <div className="form-group full-width">
            <label className="form-label">Assignment ID (read-only)</label>
            <input className="form-input" value={assignmentId} readOnly style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={form.title || ''} onChange={f('title')} />
          </div>
          <div className="form-group">
            <label className="form-label">Subtitle</label>
            <input className="form-input" value={form.subtitle || ''} onChange={f('subtitle')} />
          </div>
          <div className="form-group">
            <label className="form-label">Mentor Name</label>
            <input className="form-input" value={form.mentorName || ''} onChange={f('mentorName')} placeholder="Klaus" />
          </div>
          <div className="form-group">
            <label className="form-label">Mentor Role</label>
            <input className="form-input" value={form.mentorRole || ''} onChange={f('mentorRole')} placeholder="Senior Software Architect" />
          </div>
          <div className="form-group">
            <label className="form-label">Prereqs</label>
            <input className="form-input" value={form.prereqs || ''} onChange={f('prereqs')} />
          </div>
          <div className="form-group">
            <label className="form-label">Estimated Minutes</label>
            <input className="form-input" type="number" value={form.estimatedMinutes || ''} onChange={f('estimatedMinutes')} />
          </div>
          <div className="form-group">
            <label className="form-label">Display Order</label>
            <input className="form-input" type="number" value={form.order || ''} onChange={f('order')} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={3} value={form.description || ''} onChange={f('description')} />
          </div>
          <div className="form-group">
            <label className="include-checkbox">
              <input type="checkbox" checked={!!form.active} onChange={fb('active')} />
              Active (visible on landing page)
            </label>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Assignment System Prompt</label>
          <div className="prompt-meta" style={{ marginBottom: '6px' }}>
            {data?.version && <span>Version: <strong>{data.version}</strong></span>}
            {data?.updatedAt && <span>Last updated: <strong>{formatDate(data.updatedAt)}</strong></span>}
          </div>
          <textarea
            className="prompt-textarea"
            value={form.content || ''}
            onChange={f('content')}
            placeholder="Enter assignment system prompt..."
          />
        </div>

        <div className="warning-banner" style={{ marginBottom: '12px' }}>
          ⚠️ Changes apply to new sessions only. Existing sessions use the prompt version active when they started.
        </div>

        <div className="prompt-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Assignment'}
          </button>
          {saved && <span style={{ color: 'var(--success)', fontSize: '13px' }}>✓ Saved</span>}
        </div>
      </div>

      {/* Supporting docs */}
      <div className="editor-form">
        <h3>Supporting Documents</h3>
        <div className="docs-list">
          {supportingDocs.map((d) => (
            <DocEditor
              key={d.id}
              doc={d}
              assignmentId={assignmentId}
              userEmail={userEmail}
              onSaved={load}
            />
          ))}
        </div>
        <button className="btn btn-secondary" onClick={handleAddDoc}>
          + Add Supporting Document
        </button>
      </div>
    </div>
  );
}

// ─── New Assignment Form ──────────────────────────────────────────────────────
function NewAssignmentForm({ userEmail, onCreated, onCancel }) {
  const [form, setForm] = useState({
    id: '',
    title: '',
    subtitle: '',
    mentorName: 'Klaus',
    mentorRole: 'Senior Software Architect',
    prereqs: '',
    estimatedMinutes: '',
    description: '',
    order: '1',
    active: true,
    content: '',
  });
  const [saving, setSaving] = useState(false);
  const [idError, setIdError] = useState('');

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const fb = (field) => (e) => setForm({ ...form, [field]: e.target.checked });

  const validateId = (id) => /^[a-z0-9-]+$/.test(id);

  const handleSave = async () => {
    if (!form.id) { setIdError('ID is required.'); return; }
    if (!validateId(form.id)) { setIdError('ID must be lowercase, numbers, and hyphens only.'); return; }

    setSaving(true);
    try {
      const ref = doc(db, 'd4-assignments', form.id);
      const existing = await getDoc(ref);
      if (existing.exists()) { setIdError('An assignment with this ID already exists.'); setSaving(false); return; }

      await setDoc(ref, {
        title: form.title,
        subtitle: form.subtitle,
        mentorName: form.mentorName || 'Klaus',
        mentorRole: form.mentorRole || 'Senior Software Architect',
        prereqs: form.prereqs,
        estimatedMinutes: parseInt(form.estimatedMinutes) || 0,
        description: form.description,
        order: parseInt(form.order) || 1,
        active: !!form.active,
        content: form.content,
        version: 1,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      });
      onCreated(form.id);
    } catch (err) {
      alert('Failed to create: ' + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="editor-form">
      <h3>New Assignment</h3>
      <div className="id-warning" style={{ marginBottom: '16px' }}>
        ⚠️ The Assignment ID is permanent and cannot be changed after creation. Use a URL-safe slug (lowercase letters, numbers, hyphens).
      </div>

      <div className="editor-form-grid">
        <div className="form-group full-width">
          <label className="form-label">Assignment ID *</label>
          <input
            className="form-input"
            value={form.id}
            onChange={(e) => { setForm({ ...form, id: e.target.value }); setIdError(''); }}
            placeholder="e.g. draw-shapes"
          />
          {idError && <span style={{ color: 'var(--danger)', fontSize: '12px' }}>{idError}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={form.title} onChange={f('title')} />
        </div>
        <div className="form-group">
          <label className="form-label">Subtitle</label>
          <input className="form-input" value={form.subtitle} onChange={f('subtitle')} />
        </div>
        <div className="form-group">
          <label className="form-label">Mentor Name</label>
          <input className="form-input" value={form.mentorName} onChange={f('mentorName')} />
        </div>
        <div className="form-group">
          <label className="form-label">Mentor Role</label>
          <input className="form-input" value={form.mentorRole} onChange={f('mentorRole')} />
        </div>
        <div className="form-group">
          <label className="form-label">Prereqs</label>
          <input className="form-input" value={form.prereqs} onChange={f('prereqs')} />
        </div>
        <div className="form-group">
          <label className="form-label">Estimated Minutes</label>
          <input className="form-input" type="number" value={form.estimatedMinutes} onChange={f('estimatedMinutes')} />
        </div>
        <div className="form-group">
          <label className="form-label">Display Order</label>
          <input className="form-input" type="number" value={form.order} onChange={f('order')} />
        </div>
        <div className="form-group full-width">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" rows={3} value={form.description} onChange={f('description')} />
        </div>
        <div className="form-group full-width">
          <label className="form-label">System Prompt</label>
          <textarea className="prompt-textarea" value={form.content} onChange={f('content')} placeholder="Enter assignment system prompt..." />
        </div>
        <div className="form-group">
          <label className="include-checkbox">
            <input type="checkbox" checked={!!form.active} onChange={fb('active')} />
            Active (visible on landing page)
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Creating...' : 'Create Assignment'}
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Case Study Editor ────────────────────────────────────────────────────────
function CaseStudyEditor({ caseStudyId, userEmail, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({});
  const [concepts, setConcepts] = useState([]);
  const [sources, setSources] = useState([]);
  const [quickPrompts, setQuickPrompts] = useState([]);
  const { setDirty, guardedNavigate } = useDirty();

  // Always-fresh refs so dirty-modal Save reads current state
  const formRef = useRef(form);
  const dataRef = useRef(data);
  const conceptsRef = useRef([]);
  const sourcesRef = useRef([]);
  const quickPromptsRef = useRef([]);

  useEffect(() => () => setDirty(false), [setDirty]);

  useEffect(() => { load(); }, [caseStudyId]);

  const load = async () => {
    setLoading(true);
    try {
      const ref = doc(db, 'casestudies', caseStudyId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        setData(d); dataRef.current = d;
        setForm(d); formRef.current = d;
        const c = d.concepts || []; setConcepts(c); conceptsRef.current = c;
        const s = d.primarySources || []; setSources(s); sourcesRef.current = s;
        const q = d.quickPrompts || []; setQuickPrompts(q); quickPromptsRef.current = q;
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ref = doc(db, 'casestudies', caseStudyId);
      const currentForm = formRef.current;
      await setDoc(ref, {
        ...currentForm,
        concepts: conceptsRef.current,
        primarySources: sourcesRef.current,
        quickPrompts: quickPromptsRef.current,
        version: (dataRef.current?.version || 0) + 1,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
        active: currentForm.active === true || currentForm.active === 'true',
        order: parseInt(currentForm.order) || 0,
        estimatedMinutes: parseInt(currentForm.estimatedMinutes) || 0,
      }, { merge: true });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { alert('Save failed: ' + err.message); }
    setSaving(false);
  };

  const f = (field) => (e) => {
    const updated = { ...formRef.current, [field]: e.target.value };
    formRef.current = updated;
    setForm(updated);
    setDirty(true, handleSave);
  };
  const fb = (field) => (e) => {
    const updated = { ...formRef.current, [field]: e.target.checked };
    formRef.current = updated;
    setForm(updated);
    setDirty(true, handleSave);
  };

  // Wrappers for array state so refs stay in sync
  const updateConcepts = (val) => { conceptsRef.current = val; setConcepts(val); setDirty(true, handleSave); };
  const updateSources = (val) => { sourcesRef.current = val; setSources(val); setDirty(true, handleSave); };
  const updateQuickPrompts = (val) => { quickPromptsRef.current = val; setQuickPrompts(val); setDirty(true, handleSave); };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button className="back-btn" onClick={() => guardedNavigate(onBack)}>← Back</button>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {data?.title || caseStudyId}
        </h2>
      </div>

      <div className="editor-form" style={{ marginBottom: '24px' }}>
        <h3>Case Study Metadata &amp; Prompt</h3>
        <div className="editor-form-grid">
          <div className="form-group full-width">
            <label className="form-label">Case Study ID (read-only)</label>
            <input className="form-input" value={caseStudyId} readOnly style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={form.title || ''} onChange={f('title')} />
          </div>
          <div className="form-group">
            <label className="form-label">Subtitle</label>
            <input className="form-input" value={form.subtitle || ''} onChange={f('subtitle')} />
          </div>
          <div className="form-group">
            <label className="form-label">Tutor Name</label>
            <input className="form-input" value={form.tutorName || ''} onChange={f('tutorName')} />
          </div>
          <div className="form-group">
            <label className="form-label">Tutor Role</label>
            <input className="form-input" value={form.tutorRole || ''} onChange={f('tutorRole')} />
          </div>
          <div className="form-group">
            <label className="form-label">Prereqs</label>
            <input className="form-input" value={form.prereqs || ''} onChange={f('prereqs')} />
          </div>
          <div className="form-group">
            <label className="form-label">Estimated Minutes</label>
            <input className="form-input" type="number" value={form.estimatedMinutes || ''} onChange={f('estimatedMinutes')} />
          </div>
          <div className="form-group">
            <label className="form-label">Display Order</label>
            <input className="form-input" type="number" value={form.order || ''} onChange={f('order')} />
          </div>
          <div className="form-group">
            <label className="include-checkbox">
              <input type="checkbox" checked={!!form.active} onChange={fb('active')} />
              Active (visible on landing page)
            </label>
          </div>
        </div>

        {/* Concepts */}
        <div style={{ marginTop: '20px', marginBottom: '20px' }}>
          <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
            Concept Tracker Entries
          </label>
          <div className="dynamic-list">
            {concepts.map((c, i) => (
              <div key={i} className="dynamic-list-item">
                <input
                  placeholder="ID (e.g. wrong-abstraction)"
                  value={c.id}
                  onChange={(e) => {
                    const updated = [...concepts]; updated[i] = { ...c, id: e.target.value };
                    updateConcepts(updated);
                  }}
                  style={{ flex: '0 0 160px' }}
                />
                <input
                  placeholder="Label (e.g. Wrong Abstraction)"
                  value={c.label}
                  onChange={(e) => {
                    const updated = [...concepts]; updated[i] = { ...c, label: e.target.value };
                    updateConcepts(updated);
                  }}
                />
                <button className="remove-btn" onClick={() => updateConcepts(concepts.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
          <button className="add-item-btn" onClick={() => updateConcepts([...concepts, { id: '', label: '' }])}>
            + Add Concept
          </button>
        </div>

        {/* Primary Sources */}
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
            Primary Sources
          </label>
          <div className="dynamic-list">
            {sources.map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    className="form-input"
                    placeholder="Label"
                    value={s.label}
                    onChange={(e) => { const u = [...sources]; u[i] = { ...s, label: e.target.value }; updateSources(u); }}
                    style={{ flex: 1 }}
                  />
                  <button className="remove-btn" onClick={() => updateSources(sources.filter((_, j) => j !== i))}>×</button>
                </div>
                <input
                  className="form-input"
                  placeholder="URL"
                  value={s.url}
                  onChange={(e) => { const u = [...sources]; u[i] = { ...s, url: e.target.value }; updateSources(u); }}
                />
                <input
                  className="form-input"
                  placeholder="Description"
                  value={s.description || ''}
                  onChange={(e) => { const u = [...sources]; u[i] = { ...s, description: e.target.value }; updateSources(u); }}
                />
              </div>
            ))}
          </div>
          <button className="add-item-btn" onClick={() => updateSources([...sources, { label: '', url: '', description: '' }])}>
            + Add Source
          </button>
        </div>

        {/* Quick Prompts */}
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
            Quick Prompts (chat buttons)
          </label>
          <div className="dynamic-list">
            {quickPrompts.map((qp, i) => (
              <div key={i} className="dynamic-list-item">
                <input
                  placeholder="Quick prompt text..."
                  value={qp}
                  onChange={(e) => { const u = [...quickPrompts]; u[i] = e.target.value; updateQuickPrompts(u); }}
                />
                <button className="remove-btn" onClick={() => updateQuickPrompts(quickPrompts.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
          <button className="add-item-btn" onClick={() => updateQuickPrompts([...quickPrompts, ''])}>
            + Add Quick Prompt
          </button>
        </div>

        {/* System Prompt */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Case Study System Prompt</label>
          <div className="prompt-meta" style={{ marginBottom: '6px' }}>
            {data?.version && <span>Version: <strong>{data.version}</strong></span>}
            {data?.updatedAt && <span>Last updated: <strong>{formatDate(data.updatedAt)}</strong></span>}
          </div>
          <textarea
            className="prompt-textarea"
            value={form.content || ''}
            onChange={f('content')}
            placeholder="Enter case study system prompt..."
          />
        </div>

        <div className="warning-banner" style={{ marginBottom: '12px' }}>
          ⚠️ Changes apply to new sessions only. Existing sessions use the prompt version active when they started.
        </div>

        <div className="prompt-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Case Study'}
          </button>
          {saved && <span style={{ color: 'var(--success)', fontSize: '13px' }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}

// ─── New Case Study Form ──────────────────────────────────────────────────────
function NewCaseStudyForm({ userEmail, onCreated, onCancel }) {
  const [form, setForm] = useState({
    id: '', title: '', subtitle: '', tutorName: '', tutorRole: '',
    prereqs: '', estimatedMinutes: '', order: '1', active: true, content: '',
  });
  const [saving, setSaving] = useState(false);
  const [idError, setIdError] = useState('');

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const fb = (field) => (e) => setForm({ ...form, [field]: e.target.checked });

  const handleSave = async () => {
    if (!form.id) { setIdError('ID is required.'); return; }
    if (!/^[a-z0-9-]+$/.test(form.id)) { setIdError('ID must be lowercase, numbers, and hyphens only.'); return; }
    setSaving(true);
    try {
      const ref = doc(db, 'casestudies', form.id);
      const existing = await getDoc(ref);
      if (existing.exists()) { setIdError('A case study with this ID already exists.'); setSaving(false); return; }
      await setDoc(ref, {
        title: form.title, subtitle: form.subtitle,
        tutorName: form.tutorName, tutorRole: form.tutorRole,
        prereqs: form.prereqs,
        estimatedMinutes: parseInt(form.estimatedMinutes) || 0,
        order: parseInt(form.order) || 1,
        active: !!form.active,
        content: form.content,
        concepts: [], primarySources: [], quickPrompts: [],
        version: 1, updatedAt: serverTimestamp(), updatedBy: userEmail,
      });
      onCreated(form.id);
    } catch (err) { alert('Failed to create: ' + err.message); }
    setSaving(false);
  };

  return (
    <div className="editor-form">
      <h3>New Case Study</h3>
      <div className="id-warning" style={{ marginBottom: '16px' }}>
        ⚠️ The Case Study ID is permanent and cannot be changed after creation. Use a URL-safe slug.
      </div>
      <div className="editor-form-grid">
        <div className="form-group full-width">
          <label className="form-label">Case Study ID *</label>
          <input className="form-input" value={form.id} onChange={(e) => { setForm({ ...form, id: e.target.value }); setIdError(''); }} placeholder="e.g. java-datetime" />
          {idError && <span style={{ color: 'var(--danger)', fontSize: '12px' }}>{idError}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={form.title} onChange={f('title')} />
        </div>
        <div className="form-group">
          <label className="form-label">Subtitle</label>
          <input className="form-input" value={form.subtitle} onChange={f('subtitle')} />
        </div>
        <div className="form-group">
          <label className="form-label">Tutor Name</label>
          <input className="form-input" value={form.tutorName} onChange={f('tutorName')} />
        </div>
        <div className="form-group">
          <label className="form-label">Tutor Role</label>
          <input className="form-input" value={form.tutorRole} onChange={f('tutorRole')} />
        </div>
        <div className="form-group">
          <label className="form-label">Prereqs</label>
          <input className="form-input" value={form.prereqs} onChange={f('prereqs')} />
        </div>
        <div className="form-group">
          <label className="form-label">Estimated Minutes</label>
          <input className="form-input" type="number" value={form.estimatedMinutes} onChange={f('estimatedMinutes')} />
        </div>
        <div className="form-group">
          <label className="form-label">Display Order</label>
          <input className="form-input" type="number" value={form.order} onChange={f('order')} />
        </div>
        <div className="form-group full-width">
          <label className="form-label">System Prompt</label>
          <textarea className="prompt-textarea" value={form.content} onChange={f('content')} placeholder="Enter case study system prompt..." />
        </div>
        <div className="form-group">
          <label className="include-checkbox">
            <input type="checkbox" checked={!!form.active} onChange={fb('active')} />
            Active (visible on landing page)
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Creating...' : 'Create Case Study'}
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Students View ────────────────────────────────────────────────────────────
function StudentsView({ userEmail }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [transcriptView, setTranscriptView] = useState(null);

  useEffect(() => { loadStudents(); }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'students'));
      const list = [];
      for (const studentDoc of snap.docs) {
        const email = studentDoc.id;
        // Get case studies
        const csSnap = await getDocs(collection(db, 'students', email, 'casestudies')).catch(() => ({ docs: [] }));
        // Get assignments
        const assignSnap = await getDocs(collection(db, 'students', email, 'assignments')).catch(() => ({ docs: [] }));

        let lastActive = null;
        let name = '';

        csSnap.docs.forEach((d) => {
          const ts = d.data().metadata?.lastActiveAt;
          if (!name) name = d.data().metadata?.studentName || '';
          if (ts) {
            const t = ts.toDate ? ts.toDate() : new Date(ts);
            if (!lastActive || t > lastActive) lastActive = t;
          }
        });
        assignSnap.docs.forEach((d) => {
          // assignments sub has sessions
        });

        list.push({
          email,
          name: name || email,
          csCount: csSnap.docs.length,
          assignCount: assignSnap.docs.length,
          lastActive,
        });
      }
      setStudents(list);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadStudentDetail = async (email) => {
    setDetailLoading(true);
    setSelectedStudent(email);
    try {
      const csSnap = await getDocs(collection(db, 'students', email, 'casestudies')).catch(() => ({ docs: [] }));
      const assignSnap = await getDocs(collection(db, 'students', email, 'assignments')).catch(() => ({ docs: [] }));

      const casestudies = csSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const assignments = [];
      for (const aDoc of assignSnap.docs) {
        const sessionsSnap = await getDocs(
          query(collection(db, 'students', email, 'assignments', aDoc.id, 'sessions'), orderBy('metadata.sessionNumber', 'asc'))
        ).catch(() => ({ docs: [] }));
        assignments.push({
          id: aDoc.id,
          sessions: sessionsSnap.docs.map((s) => ({ id: s.id, ...s.data() })),
        });
      }

      setStudentDetail({ email, casestudies, assignments });
    } catch (err) { console.error(err); }
    setDetailLoading(false);
  };

  if (transcriptView) {
    return (
      <TranscriptView
        data={transcriptView}
        onBack={() => setTranscriptView(null)}
      />
    );
  }

  if (selectedStudent && studentDetail) {
    return (
      <div className="student-detail">
        <div className="student-detail-header">
          <button className="back-btn" onClick={() => { setSelectedStudent(null); setStudentDetail(null); }}>
            ← All Students
          </button>
          <div>
            <div className="student-detail-name">{studentDetail.casestudies[0]?.metadata?.studentName || selectedStudent}</div>
            <div className="student-detail-email">{selectedStudent}</div>
          </div>
        </div>

        <div className="detail-section">
          <h3>Case Studies</h3>
          {studentDetail.casestudies.length === 0 ? (
            <div className="empty-state">No case study activity.</div>
          ) : (
            <div className="detail-list">
              {studentDetail.casestudies.map((cs) => (
                <div
                  key={cs.id}
                  className="detail-item"
                  onClick={() => setTranscriptView({ type: 'casestudy', data: cs, studentEmail: selectedStudent })}
                >
                  <div className="detail-item-info">
                    <div className="detail-item-title">{cs.metadata?.caseStudyTitle || cs.id}</div>
                    <div className="detail-item-meta">
                      Started {formatDateShort(cs.metadata?.startedAt)} ·
                      Last active {formatDateShort(cs.metadata?.lastActiveAt)} ·
                      {cs.messages?.length || 0} messages
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cs.metadata?.completed
                      ? <span className="badge badge-success">Completed</span>
                      : <span className="badge badge-warning">In Progress</span>}
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="detail-section">
          <h3>D4 Assignments</h3>
          {studentDetail.assignments.length === 0 ? (
            <div className="empty-state">No assignment activity.</div>
          ) : (
            <div className="detail-list">
              {studentDetail.assignments.map((a) => (
                <div key={a.id}>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>
                    {a.id} — {a.sessions.length} session{a.sessions.length !== 1 ? 's' : ''}
                  </div>
                  {a.sessions.map((s) => (
                    <div
                      key={s.id}
                      className="detail-item"
                      style={{ marginLeft: '16px', marginBottom: '4px' }}
                      onClick={() => setTranscriptView({ type: 'd4session', data: s, studentEmail: selectedStudent })}
                    >
                      <div className="detail-item-info">
                        <div className="detail-item-title">Session {s.metadata?.sessionNumber}</div>
                        <div className="detail-item-meta">
                          Started {formatDateShort(s.metadata?.startedAt)} ·
                          Last active {formatDateShort(s.metadata?.lastActiveAt)} ·
                          {s.messages?.length || 0} messages
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {s.metadata?.completed
                          ? <span className="badge badge-success">Completed</span>
                          : <span className="badge badge-warning">In Progress</span>}
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="dashboard-section-header">
        <h2>Students</h2>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{students.length} students</span>
      </div>

      {students.length === 0 ? (
        <div className="empty-state">No student activity yet.</div>
      ) : (
        <table className="students-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Last Active</th>
              <th>Case Studies</th>
              <th>Assignments</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr
                key={s.email}
                role="button"
                onClick={() => loadStudentDetail(s.email)}
              >
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</td>
                <td>{s.email}</td>
                <td>{s.lastActive ? s.lastActive.toLocaleDateString() : '—'}</td>
                <td>{s.csCount}</td>
                <td>{s.assignCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Transcript View ──────────────────────────────────────────────────────────
function TranscriptView({ data, onBack }) {
  const { type, data: record } = data;
  const title = type === 'casestudy'
    ? record.metadata?.caseStudyTitle || record.id
    : `Session ${record.metadata?.sessionNumber} — ${record.metadata?.assignmentTitle || record.metadata?.assignmentId}`;

  return (
    <div className="transcript-view">
      <div className="transcript-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div>
          <div className="transcript-title">{title}</div>
          <div className="transcript-meta">
            {record.messages?.length || 0} messages ·
            Started {formatDateShort(record.metadata?.startedAt)}
          </div>
        </div>
      </div>

      {type === 'd4session' && record.designDoc && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          marginBottom: '24px',
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', fontSize: '14px' }}>
            Design Document
          </div>
          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {record.designDoc}
          </pre>
        </div>
      )}

      <div className="transcript-messages">
        {(record.messages || []).map((msg, i) => (
          <MessageBubble key={i} message={msg} showTime={true} />
        ))}
        {(!record.messages || record.messages.length === 0) && (
          <div className="empty-state">No messages in this transcript.</div>
        )}
      </div>
    </div>
  );
}

// ─── System Prompts View ──────────────────────────────────────────────────────
function SystemPromptsView({ userEmail }) {
  const [subTab, setSubTab] = useState('d4base');
  const { guardedNavigate } = useDirty();
  const [d4Base, setD4Base] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [caseStudies, setCaseStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState(null);
  const [showNewAssignment, setShowNewAssignment] = useState(false);
  const [showNewCaseStudy, setShowNewCaseStudy] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [baseSnap, assignSnap, csSnap] = await Promise.all([
        getDoc(doc(db, 'config', 'd4-base')),
        getDocs(collection(db, 'd4-assignments')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'casestudies')).catch(() => ({ docs: [] })),
      ]);
      if (baseSnap.exists()) setD4Base({ ...baseSnap.data() });
      setAssignments(assignSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)));
      setCaseStudies(csSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  if (selectedAssignment) {
    return (
      <AssignmentEditor
        assignmentId={selectedAssignment}
        userEmail={userEmail}
        onBack={() => { setSelectedAssignment(null); loadAll(); }}
      />
    );
  }

  if (selectedCaseStudy) {
    return (
      <CaseStudyEditor
        caseStudyId={selectedCaseStudy}
        userEmail={userEmail}
        onBack={() => { setSelectedCaseStudy(null); loadAll(); }}
      />
    );
  }

  if (showNewAssignment) {
    return (
      <NewAssignmentForm
        userEmail={userEmail}
        onCreated={(id) => { setShowNewAssignment(false); setSelectedAssignment(id); }}
        onCancel={() => setShowNewAssignment(false)}
      />
    );
  }

  if (showNewCaseStudy) {
    return (
      <NewCaseStudyForm
        userEmail={userEmail}
        onCreated={(id) => { setShowNewCaseStudy(false); setSelectedCaseStudy(id); }}
        onCancel={() => setShowNewCaseStudy(false)}
      />
    );
  }

  return (
    <div>
      <div className="dashboard-section-header">
        <h2>System Prompts</h2>
      </div>

      <div className="subnav-tabs">
        <button className={`subnav-tab${subTab === 'd4base' ? ' active' : ''}`} onClick={() => guardedNavigate(() => setSubTab('d4base'))}>D4 Base</button>
        <button className={`subnav-tab${subTab === 'd4assignments' ? ' active' : ''}`} onClick={() => guardedNavigate(() => setSubTab('d4assignments'))}>D4 Assignments</button>
        <button className={`subnav-tab${subTab === 'casestudies' ? ' active' : ''}`} onClick={() => guardedNavigate(() => setSubTab('casestudies'))}>Case Studies</button>
      </div>

      {subTab === 'd4base' && (
        <InlinePromptEditor
          docPath="config/d4-base"
          initialData={d4Base}
          userEmail={userEmail}
          label="D4 Base Prompt"
        />
      )}

      {subTab === 'd4assignments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button className="btn btn-primary" onClick={() => setShowNewAssignment(true)}>
              + New Assignment
            </button>
          </div>
          {assignments.length === 0 ? (
            <div className="empty-state">No assignments yet. Create one above.</div>
          ) : (
            <div className="content-list">
              {assignments.map((a) => (
                <div key={a.id} className="content-list-item" onClick={() => setSelectedAssignment(a.id)}>
                  <div>
                    <div className="content-list-item-title">{a.title || a.id}</div>
                    <div className="content-list-item-meta">
                      v{a.version || 1} · Updated {formatDateShort(a.updatedAt)}
                    </div>
                  </div>
                  <div className="content-list-item-right">
                    {a.active
                      ? <span className="badge badge-success">Active</span>
                      : <span className="badge badge-muted">Hidden</span>}
                    <span style={{ color: 'var(--text-muted)' }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'casestudies' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button className="btn btn-primary" onClick={() => setShowNewCaseStudy(true)}>
              + New Case Study
            </button>
          </div>
          {caseStudies.length === 0 ? (
            <div className="empty-state">No case studies yet. Create one above.</div>
          ) : (
            <div className="content-list">
              {caseStudies.map((cs) => (
                <div key={cs.id} className="content-list-item" onClick={() => setSelectedCaseStudy(cs.id)}>
                  <div>
                    <div className="content-list-item-title">{cs.title || cs.id}</div>
                    <div className="content-list-item-meta">
                      v{cs.version || 1} · Updated {formatDateShort(cs.updatedAt)}
                    </div>
                  </div>
                  <div className="content-list-item-right">
                    {cs.active
                      ? <span className="badge badge-success">Active</span>
                      : <span className="badge badge-muted">Hidden</span>}
                    <span style={{ color: 'var(--text-muted)' }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function InstructorDashboard({ user, isProfessor, signOut, permissions, viewMode, setViewMode }) {
  const navigate = useNavigate();
  const [navTab, setNavTab] = useState('students');
  const { guardedNavigate } = useDirty();

  useEffect(() => {
    if (!isProfessor) {
      navigate('/');
    }
  }, [isProfessor]);

  if (!isProfessor) return null;

  return (
    <div className="dashboard-page">
      <Header
        user={user}
        isProfessor={isProfessor}
        signOut={signOut}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <div className="dashboard-layout">
        <nav className="dashboard-nav">
          <div className="dashboard-nav-title">Instructor</div>
          <button
            className={`dashboard-nav-item${navTab === 'students' ? ' active' : ''}`}
            onClick={() => guardedNavigate(() => setNavTab('students'))}
          >
            Students
          </button>
          <button
            className={`dashboard-nav-item${navTab === 'prompts' ? ' active' : ''}`}
            onClick={() => guardedNavigate(() => setNavTab('prompts'))}
          >
            System Prompts
          </button>
        </nav>

        <main className="dashboard-main">
          {navTab === 'students' && <StudentsView userEmail={user?.email} />}
          {navTab === 'prompts' && <SystemPromptsView userEmail={user?.email} />}
        </main>
      </div>
    </div>
  );
}
