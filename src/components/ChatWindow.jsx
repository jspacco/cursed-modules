import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

const windowStyle = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  paddingTop: '16px',
  paddingBottom: '8px',
};

const thinkingStyle = {
  display: 'flex',
  justifyContent: 'flex-start',
  padding: '6px 20px',
};

const thinkingInnerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 16px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: '18px 18px 18px 4px',
  color: 'var(--text-muted)',
  fontSize: '13px',
};

export default function ChatWindow({ messages, isThinking }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <div style={windowStyle}>
      {messages.map((msg, i) => (
        <MessageBubble
          key={i}
          message={msg}
          showTime={
            i === messages.length - 1 ||
            messages[i + 1]?.role !== msg.role
          }
        />
      ))}

      {isThinking && (
        <div style={thinkingStyle}>
          <div style={thinkingInnerStyle}>
            <div className="thinking-dots">
              <span />
              <span />
              <span />
            </div>
            <span>Thinking...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
