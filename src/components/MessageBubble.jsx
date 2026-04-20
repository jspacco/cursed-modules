import ReactMarkdown from 'react-markdown';

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
  whiteSpace: role === 'user' ? 'pre-wrap' : undefined,
});

const timestampStyle = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  marginTop: '4px',
  textAlign: 'center',
};

const mdComponents = {
  p: ({ children }) => <p style={{ margin: '0 0 0.5em 0' }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  code: ({ children }) => (
    <code style={{
      background: 'var(--code-bg, #1a1208)',
      color: 'var(--code-text, #d4cfc8)',
      padding: '1px 5px',
      borderRadius: '3px',
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: '13px',
    }}>{children}</code>
  ),
  pre: ({ children }) => (
    <pre style={{
      background: 'var(--code-bg, #1a1208)',
      color: 'var(--code-text, #d4cfc8)',
      padding: '10px 14px',
      borderRadius: '6px',
      overflowX: 'auto',
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: '13px',
      margin: '0.5em 0',
    }}>{children}</pre>
  ),
  ul: ({ children }) => <ul style={{ margin: '0.25em 0', paddingLeft: '1.4em' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '0.25em 0', paddingLeft: '1.4em' }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '0.15em 0' }}>{children}</li>,
  h1: ({ children }) => <h1 style={{ fontSize: '1.2em', fontWeight: 700, margin: '0.5em 0 0.25em' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: '1.1em', fontWeight: 700, margin: '0.5em 0 0.25em' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: '1em', fontWeight: 700, margin: '0.5em 0 0.15em' }}>{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: '3px solid var(--border)',
      margin: '0.5em 0',
      paddingLeft: '0.75em',
      color: 'var(--text-dim)',
    }}>{children}</blockquote>
  ),
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
          {role === 'assistant'
            ? <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
            : content}
        </div>
      </div>
      {showTime && timestamp && (
        <div style={timestampStyle}>{formatTime(timestamp)}</div>
      )}
    </div>
  );
}
