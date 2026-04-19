import { useRef, useEffect } from 'react';

const containerStyle = {
  padding: '12px 20px 16px',
  background: 'var(--bg-primary)',
  borderTop: '1px solid var(--border)',
  flexShrink: 0,
};

const quickPromptsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginBottom: '10px',
};

const quickPromptBtnStyle = {
  padding: '5px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: '20px',
  color: 'var(--text-secondary)',
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
  whiteSpace: 'nowrap',
};

const inputRowStyle = {
  display: 'flex',
  gap: '10px',
  alignItems: 'flex-end',
};

const textareaStyle = (disabled) => ({
  flex: 1,
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
  fontSize: '14px',
  lineHeight: 1.6,
  padding: '10px 14px',
  resize: 'none',
  overflow: 'hidden',
  minHeight: '44px',
  maxHeight: '200px',
  transition: 'border-color 0.15s',
  cursor: disabled ? 'not-allowed' : 'text',
});

const sendBtnStyle = (disabled) => ({
  padding: '10px 20px',
  background: disabled ? 'var(--bg-elevated)' : 'var(--accent)',
  color: disabled ? 'var(--text-muted)' : '#0f1117',
  borderRadius: 'var(--radius)',
  fontWeight: 600,
  fontSize: '14px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'background 0.15s',
  flexShrink: 0,
  height: '44px',
});

export default function ChatInput({ value, onChange, onSend, disabled, quickPrompts = [] }) {
  const textareaRef = useRef(null);

  // Auto-expand textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [value]);

  // Refocus after server response completes
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    }
  };

  const handleQuickPrompt = (prompt) => {
    onChange(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div style={containerStyle}>
      {quickPrompts.length > 0 && (
        <div style={quickPromptsStyle}>
          {quickPrompts.map((qp, i) => (
            <button
              key={i}
              style={quickPromptBtnStyle}
              onClick={() => handleQuickPrompt(qp)}
              disabled={disabled}
            >
              {qp}
            </button>
          ))}
        </div>
      )}

      <div style={inputRowStyle}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'Waiting for response...' : 'Type a message... (Enter to send, Shift+Enter for newline)'}
          style={textareaStyle(disabled)}
          rows={1}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          style={sendBtnStyle(disabled || !value.trim())}
        >
          Send
        </button>
      </div>
    </div>
  );
}
