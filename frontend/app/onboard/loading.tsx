export default function OnboardLoading() {
  return (
    <main className="mx-auto max-w-lg px-4 py-14 sm:px-6">
      <div className="mb-1 h-8 w-36 animate-pulse rounded-md bg-secondary" />
      <div className="mb-10 h-4 w-72 animate-pulse rounded bg-secondary" />
      <div className="mb-10 flex items-center gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <div className="h-7 w-7 animate-pulse rounded-full bg-secondary" />
            {i < 3 && <div className="h-px flex-1 animate-pulse bg-secondary" />}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    </main>
  );
}
