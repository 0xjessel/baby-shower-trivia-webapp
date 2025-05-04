interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  message?: string
}

export function LoadingSpinner({ size = "md", message }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className={`${sizeClasses[size]} border-t-arcane-blue border-r-arcane-blue/30 border-b-arcane-blue/10 border-l-arcane-blue/50 rounded-full animate-spin`}
      ></div>
      {message && <p className="mt-2 text-arcane-gray-light text-sm">{message}</p>}
    </div>
  )
}
