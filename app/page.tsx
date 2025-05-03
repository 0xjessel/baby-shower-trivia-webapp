import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import QRCode from "@/components/qr-code"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-blue-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-pink-600">Baby Shower Trivia</h1>
          <p className="mt-2 text-lg text-gray-600">Guess who's who from baby pictures!</p>
        </div>

        <Card className="border-2 border-pink-200 shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-800">Join the game!</h2>
                <p className="mt-1 text-sm text-gray-500">Scan this QR code with your phone</p>
              </div>

              <QRCode />

              <div className="text-center text-sm text-gray-500">
                <p>Or visit:</p>
                <p className="font-medium text-pink-600">trivia.yourdomain.com/join</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center space-x-4">
          <Link href="/join" passHref>
            <Button className="bg-pink-600 hover:bg-pink-700">Join as Guest</Button>
          </Link>
          <Link href="/admin" passHref>
            <Button variant="outline" className="border-pink-600 text-pink-600 hover:bg-pink-50">
              Admin Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
