function formatDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function SessionList({ sessions, onSelect, onNew, assignment }) {
  return (
    <div className="session-list-view">
      <h2>{assignment?.title || 'D4 Assignment'}</h2>
      {assignment?.subtitle && (
        <p className="assignment-subtitle">{assignment.subtitle}</p>
      )}

      <div className="session-list-controls">
        <h3>Your Sessions</h3>
        <button className="btn btn-primary" onClick={onNew}>
          + Start New Session
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          No sessions yet. Start your first session above.
        </div>
      ) : (
        <table className="session-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Started</th>
              <th>Last Active</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} onClick={() => onSelect(s.id)}>
                <td>
                  <span className="session-number">
                    Session {s.metadata?.sessionNumber}
                  </span>
                </td>
                <td>{formatDate(s.metadata?.startedAt)}</td>
                <td>{formatDate(s.metadata?.lastActiveAt)}</td>
                <td>
                  {s.metadata?.completed ? (
                    <span className="badge badge-success">Completed</span>
                  ) : (
                    <span className="badge badge-warning">In Progress</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
