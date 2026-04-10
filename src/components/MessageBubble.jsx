const bubbleWrapperStyle = (role) => ({
  display: 'flex',
  justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
  padding: '6px 20px',
});

const bubbleStyle = (role) => ({
  maxWidth: '72%',
  padding: '12px 16px',
  borderRadius: role === 'user'
    ? '18px 18px 4px 18px'
    : '18px 18px 18px 4px',
  background: role === 'user'
    ? 'var(--accent)'
    : 'var(--bg-elevated)',
  color: role === 'user' ? '#0f1117' : 'var(--text-primary)',
  fontSize: '14px',
  lineHeight: 1.6,
  border: role === 'user'
    ? 'none'
    : '1px solid var(--border)',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
});

const timestampStyle = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  marginTop: '4px',
  textAlign: 'center',
};

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function MessageBubble({ message, showTime }) {
  const { role, content, timestamp } = message;

  return (
    <div>
      <div style={bubbleWrapperStyle(role)}>
        <div style={bubbleStyle(role)}>
          {content}
        </div>
      </div>
      {showTime && timestamp && (
        <div style={timestampStyle}>{formatTime(timestamp)}</div>
      )}
    </div>
  );
}
