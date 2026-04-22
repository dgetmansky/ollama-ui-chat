type Props = {
  sessionIds: string[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onDeleteActiveSession: () => void;
};

export const SessionsPanel = ({
  sessionIds,
  activeSessionId,
  onSelectSession,
  onDeleteActiveSession
}: Props) => (
  <aside className="panel sessions-panel">
    <h2>Sessions</h2>
    <button type="button" onClick={onDeleteActiveSession} disabled={!activeSessionId}>
      Delete session
    </button>
    <ul>
      {sessionIds.map((id) => (
        <li key={id}>
          <button type="button" aria-pressed={id === activeSessionId} onClick={() => onSelectSession(id)}>
            {id}
          </button>
        </li>
      ))}
    </ul>
  </aside>
);
