export default function RevealLoading() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="mb-1 h-8 w-44 animate-pulse rounded-md bg-secondary" />
      <div className="mb-8 h-4 w-64 animate-pulse rounded bg-secondary" />
      <div className="flex gap-2">
        <div className="h-10 flex-1 animate-pulse rounded-md bg-secondary" />
        <div className="h-10 w-24 animate-pulse rounded-md bg-secondary" />
      </div>
    </main>
  );
}
