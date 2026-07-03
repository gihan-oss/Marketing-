"use client";

export function SkeletonBlock({ h = 96 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} aria-hidden />;
}

export function SkeletonGrid({ count = 4, h = 96 }: { count?: number; h?: number }) {
  return (
    <div className="grid grid-kpi" role="status" aria-label="Loading data">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} h={h} />
      ))}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner" role="alert">
      {message}
    </div>
  );
}

export function SetupNotice() {
  return (
    <div className="empty">
      <h3>Connect your Airtable base</h3>
      <p>
        Set <code>AIRTABLE_API_KEY</code> in <code>.env</code> (see <code>.env.example</code>) and
        restart the server. The platform reads live from the “Amal &amp; Company Marketing” base —
        no data is hardcoded.
      </p>
    </div>
  );
}
