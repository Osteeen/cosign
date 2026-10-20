import { formatUsd } from "@/lib/money";
import { LocalTime } from "./local-time";


export function ActivityList({
  events,
}: {
  events: { id: string; summary: string; occurredAt: Date; amountCents: number | null; type: string }[];
}) {
  if (events.length === 0) return <p className="muted">Nothing has happened yet.</p>;
  return (
    <ol className="activity">
      {events.map((e) => (
        <li key={e.id} className="activity-item">
          <time className="activity-time" dateTime={e.occurredAt.toISOString()}>
            <LocalTime iso={e.occurredAt.toISOString()} />
          </time>
          <span className="activity-summary">{e.summary}</span>
          {e.amountCents != null ? <span className="activity-amount">{formatUsd(e.amountCents)}</span> : <span />}
        </li>
      ))}
    </ol>
  );
}
