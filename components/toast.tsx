"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function ToastContainer() {
  const { toasts, addToast, dismissToast } = useToast()

  useEffect(() => {
    const handleToast = (e: Event) => {
      const toast = (e as CustomEvent).detail
      addToast(toast)
    }

    document.addEventListener("toast", handleToast)
    return () => document.removeEventListener("toast", handleToast)
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-in slide-in-from-right rounded-lg p-4 shadow-md ${
            toast.variant === "destructive" ? "bg-red-50 text-red-600" : "bg-white"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium">{toast.title}</h3>
              <p className="text-sm">{toast.description}</p>
            </div>
            <button onClick={() => dismissToast(toast.id)} className="ml-4 rounded-full p-1 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
