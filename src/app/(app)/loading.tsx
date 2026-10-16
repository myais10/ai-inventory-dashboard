export default function Loading() {
  return (
    <div className="px-6 py-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
