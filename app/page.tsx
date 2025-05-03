import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import QRCode from "@/components/qr-code"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-arcane-navy p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <div className="mb-6 rounded-lg overflow-hidden shadow-lg border-2 border-arcane-gold/50">
            <img
              src="/images/hero-banner.png"
              alt="Future of Piltover: Baby Jayce's League Challenge"
              className="w-full h-auto"
            />
          </div>
          <p className="mt-2 text-lg text-arcane-gray">Where Piltover Smarts Meet Baby Shower Fun.</p>
        </div>

        <Card className="border-2 border-arcane-blue bg-arcane-navy/80 shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-arcane-gray-light">Join the game!</h2>
                <p className="mt-1 text-sm text-arcane-gray">Scan this QR code with your phone</p>
              </div>

              <QRCode />

              <div className="text-center text-sm text-arcane-gray">
                <p>Or visit:</p>
                <p className="font-medium text-arcane-blue">babyjayceleaguechallenge.vercel.app/join</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center space-x-4">
          <Link href="/join" passHref>
            <Button className="bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold">Join as Guest</Button>
          </Link>
          <Link href="/admin" passHref>
            <Button
              variant="outline"
              className="border-arcane-gold text-arcane-gold hover:bg-arcane-gold/10 font-medium"
            >
              Admin Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
