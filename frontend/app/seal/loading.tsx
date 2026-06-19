export default function SealLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-2 h-8 w-40 animate-pulse rounded-md bg-secondary" />
      <div className="mb-8 h-4 w-72 animate-pulse rounded bg-secondary" />
      <div className="flex flex-col gap-4">
        <div className="h-28 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    </main>
  );
}
