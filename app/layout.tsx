import type React from "react"
import "@/app/globals.css"
import { PusherProvider } from "@/hooks/use-pusher"
import { PusherStatus } from "@/components/pusher-status"
import { ToastContainer } from "@/components/toast"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-arcane-navy text-arcane-gray-light">
      <head>
        <title>Baby Jayce's League Challenge</title>
        <meta name="description" content="A fun League of Legends themed trivia game for baby showers" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Baby Jayce's League Challenge" />
        <meta property="og:description" content="A fun League of Legends themed trivia game for baby showers" />
        <meta property="og:url" content="https://babyjayceleaguechallenge.vercel.app" />
      </head>
      <body className="bg-arcane-navy">
        <PusherProvider>
          {children}
          <PusherStatus />
          <ToastContainer />
        </PusherProvider>
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.dev'
    };
