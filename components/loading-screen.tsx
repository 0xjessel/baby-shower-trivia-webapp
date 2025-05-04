export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-arcane-navy">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-arcane-blue/30 border-t-arcane-blue mx-auto"></div>
        <p className="text-lg text-arcane-gray">Loading question...</p>
      </div>
    </div>
  )
}
