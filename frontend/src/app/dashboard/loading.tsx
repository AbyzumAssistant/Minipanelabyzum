export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="text-sm text-gray-400 font-minecraft">Cargando panel…</p>
      </div>
    </div>
  );
}
