import { useState } from 'react';

const panelStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};

const placeholderStyle = {
  textAlign: 'center',
  padding: '40px 20px',
  color: 'var(--text-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
};

const placeholderIconStyle = {
  fontSize: '32px',
  marginBottom: '12px',
};

const docContentStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  lineHeight: 1.7,
  color: 'var(--text-secondary)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  flex: 1,
};

const copyBtnStyle = (copied) => ({
  padding: '6px 14px',
  background: copied ? 'var(--success-dim)' : 'var(--bg-elevated)',
  color: copied ? 'var(--success)' : 'var(--text-secondary)',
  border: `1px solid ${copied ? 'rgba(63,185,80,0.3)' : 'var(--border)'}`,
  borderRadius: 'var(--radius-sm)',
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s',
  marginBottom: '12px',
  alignSelf: 'flex-start',
});

export default function DesignDocPanel({ designDoc }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(designDoc);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (!designDoc) {
    return (
      <div style={panelStyle}>
        <div style={placeholderStyle}>
          <div style={placeholderIconStyle}>📄</div>
          <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            No design document yet
          </strong>
          Continue your conversation with Klaus. When your design is complete, he will generate your design document here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...panelStyle, gap: '0' }}>
      <button style={copyBtnStyle(copied)} onClick={handleCopy}>
        {copied ? '✓ Copied!' : 'Copy to clipboard'}
      </button>
      <div style={docContentStyle}>
        {designDoc}
      </div>
    </div>
  );
}
