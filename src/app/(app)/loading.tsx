export default function Loading() {
  return (
    <div className="px-4 py-5 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-44 animate-pulse rounded-md bg-subtle" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded bg-subtle/70" />
      <div className="mt-5 overflow-hidden rounded-lg border border-line bg-surface">
        <div className="h-9 border-b border-line bg-subtle" />
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line/70 px-4 py-3 last:border-0">
            <div className="h-3.5 w-40 animate-pulse rounded bg-subtle" />
            <div className="h-3.5 w-56 animate-pulse rounded bg-subtle/70" />
            <div className="ml-auto h-3.5 w-16 animate-pulse rounded bg-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
