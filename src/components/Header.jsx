import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 24px',
  height: '52px',
  background: 'var(--bg-secondary)',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const brandStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  textDecoration: 'none',
  color: 'var(--text-primary)',
  fontWeight: 700,
  fontSize: '16px',
};

const rightStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const userStyle = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
};

const signOutBtn = {
  background: 'none',
  color: 'var(--text-muted)',
  fontSize: '13px',
  padding: '4px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  transition: 'color 0.15s',
};

const toggleContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '3px',
};

const toggleBtnStyle = (active) => ({
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 500,
  borderRadius: 'calc(var(--radius) - 2px)',
  background: active ? 'var(--accent)' : 'none',
  color: active ? '#0f1117' : 'var(--text-muted)',
  cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s',
});

export default function Header({ user, isProfessor, signOut, viewMode, setViewMode }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header style={headerStyle}>
      <Link to="/" style={brandStyle}>
        <span>⚡</span>
        <span>Cursed Modules</span>
      </Link>

      <div style={rightStyle}>
        {isProfessor && viewMode !== undefined && (
          <div style={toggleContainerStyle}>
            <button
              style={toggleBtnStyle(viewMode === 'student')}
              onClick={() => { setViewMode('student'); navigate('/'); }}
            >
              Student View
            </button>
            <button
              style={toggleBtnStyle(viewMode === 'instructor')}
              onClick={() => {
                setViewMode('instructor');
                navigate('/instructor');
              }}
            >
              Instructor View
            </button>
          </div>
        )}

        {user && (
          <>
            <span style={userStyle}>{user.displayName || user.email}</span>
            <button style={signOutBtn} onClick={handleSignOut}>
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
