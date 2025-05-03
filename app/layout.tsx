import type React from "react"
import "@/app/globals.css"
import { PusherProvider } from "@/hooks/use-pusher"
import { PusherStatus } from "@/components/pusher-status"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <title>Baby Shower Trivia Game</title>
        <meta name="description" content="A fun trivia game for baby showers" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <PusherProvider>
          {children}
          <PusherStatus />
        </PusherProvider>
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.dev'
    };
