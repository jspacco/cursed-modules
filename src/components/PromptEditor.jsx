import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

function formatDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

export default function PromptEditor({ docPath, data, onSaved, userEmail, label = 'Prompt' }) {
  const [content, setContent] = useState(data?.content || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const ref = doc(db, ...docPath.split('/').filter(Boolean));
      await updateDoc(ref, {
        content,
        version: (data?.version || 0) + 1,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (onSaved) onSaved({ content, version: (data?.version || 0) + 1 });
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  };

  return (
    <div className="prompt-area">
      <div className="prompt-meta">
        {data?.version && <span>Version: <strong>{data.version}</strong></span>}
        {data?.updatedAt && <span>Last updated: <strong>{formatDate(data.updatedAt)}</strong></span>}
        {data?.updatedBy && <span>By: <strong>{data.updatedBy}</strong></span>}
      </div>

      <div className="warning-banner" style={{ marginBottom: '12px' }}>
        ⚠️ Changes apply to new sessions only. Existing sessions use the prompt version active when they started.
      </div>

      <textarea
        className="prompt-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`Enter ${label.toLowerCase()} content...`}
      />

      <div className="prompt-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : `Save ${label}`}
        </button>
        {saved && (
          <span style={{ color: 'var(--success)', fontSize: '13px' }}>
            ✓ Saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
