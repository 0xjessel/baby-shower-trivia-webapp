import { Card, CardContent } from "@/components/ui/card"
import PlayerHeartbeat from "@/components/player-heartbeat"

export default function WaitingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-arcane-navy p-4">
      <PlayerHeartbeat />
      <Card className="w-full max-w-md border-2 border-arcane-blue/50 bg-arcane-navy/80 text-center shadow-md">
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-arcane-gray-light">Waiting for the game to start</h2>
          <p className="mt-2 text-arcane-gray">The host will start the game soon!</p>
        </CardContent>
      </Card>
    </div>
  )
}
