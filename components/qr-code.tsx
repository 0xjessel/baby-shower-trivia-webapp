"use client"

import { useEffect, useRef } from "react"
import QRCodeLib from "qrcode"

export default function QRCode() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      // In a real app, this would be your actual URL
      const joinUrl = window.location.origin + "/join"

      QRCodeLib.toCanvas(canvasRef.current, joinUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: "#d946ef", // Pink color for the QR code
          light: "#ffffff",
        },
      })
    }
  }, [])

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <canvas ref={canvasRef} className="h-48 w-48" />
    </div>
  )
}
