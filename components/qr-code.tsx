"use client"

import { useEffect, useRef } from "react"
import QRCodeLib from "qrcode"

export default function QRCode() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      // Use the new URL for the QR code
      const joinUrl = "https://babyjayceleaguechallenge.vercel.app/join"

      QRCodeLib.toCanvas(canvasRef.current, joinUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: "#00BFFF", // Arcane blue color for the QR code
          light: "#0A0A23", // Dark navy background
        },
      })
    }
  }, [])

  return (
    <div className="rounded-lg bg-arcane-navy p-4 shadow-sm border border-arcane-blue/30">
      <canvas ref={canvasRef} className="h-48 w-48" />
    </div>
  )
}
