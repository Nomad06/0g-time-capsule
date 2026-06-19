export default function GalleryLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="h-8 w-36 animate-pulse rounded-md bg-secondary" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded bg-secondary" />
        </div>
        <div className="h-9 w-20 animate-pulse rounded-md bg-secondary" />
      </div>

      <div className="mb-5 flex gap-1 border-b border-border pb-0">
        {[72, 48, 80].map((w, i) => (
          <div key={i} className={`h-10 w-${w === 72 ? "20" : w === 48 ? "16" : "24"} animate-pulse rounded-t bg-secondary`} />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    </main>
  );
}
