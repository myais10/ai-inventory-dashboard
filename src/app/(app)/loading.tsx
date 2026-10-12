export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="h-6 w-72 rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[104px] rounded-xl border border-line bg-white" />
        ))}
      </div>
      <div className="h-[420px] rounded-xl border border-line bg-white" />
    </div>
  );
}
