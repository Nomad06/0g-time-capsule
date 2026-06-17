export default function DiscoverLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted/60" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    </main>
  );
}
