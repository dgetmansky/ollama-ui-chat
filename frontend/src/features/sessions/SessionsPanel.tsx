type Props = {
  sessionIds: string[];
};

export const SessionsPanel = ({ sessionIds }: Props) => (
  <aside className="panel sessions-panel">
    <h2>Sessions</h2>
    <ul>
      {sessionIds.map((id) => (
        <li key={id}>
          <button type="button">{id}</button>
        </li>
      ))}
    </ul>
  </aside>
);
