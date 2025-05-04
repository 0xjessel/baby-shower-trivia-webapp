"use client"

import { useEffect, useRef } from "react"

export default function HextechBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Hextech circuit parameters
    const nodeCount = Math.floor((window.innerWidth * window.innerHeight) / 25000) // Adjust density based on screen size
    const nodes: { x: number; y: number; size: number }[] = []
    const connections: { from: number; to: number; active: boolean; progress: number; speed: number }[] = []
    const pulses: { x: number; y: number; size: number; alpha: number }[] = []

    // Draw hexagonal pattern
    function drawHexPattern(x: number, y: number) {
      const size = 10 + Math.random() * 20
      const sides = 6

      ctx.beginPath()
      ctx.moveTo(x + size * Math.cos(0), y + size * Math.sin(0))

      for (let i = 1; i <= sides; i++) {
        const angle = (i * 2 * Math.PI) / sides
        ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle))
      }

      ctx.closePath()
      ctx.strokeStyle = "rgba(0, 191, 255, 0.15)"
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Add inner hex
      ctx.beginPath()
      ctx.moveTo(x + size * 0.7 * Math.cos(0), y + size * 0.7 * Math.sin(0))

      for (let i = 1; i <= sides; i++) {
        const angle = (i * 2 * Math.PI) / sides
        ctx.lineTo(x + size * 0.7 * Math.cos(angle), y + size * 0.7 * Math.sin(angle))
      }

      ctx.closePath()
      ctx.strokeStyle = "rgba(0, 191, 255, 0.1)"
      ctx.stroke()

      // Add to pulses for animation
      pulses.push({
        x,
        y,
        size: size * 1.2,
        alpha: 0.2,
      })
    }

    // Animation function
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw connections
      connections.forEach((conn) => {
        const fromNode = nodes[conn.from]
        const toNode = nodes[conn.to]

        // Draw base connection line (dim)
        ctx.beginPath()
        ctx.moveTo(fromNode.x, fromNode.y)
        ctx.lineTo(toNode.x, toNode.y)
        ctx.strokeStyle = "rgba(0, 191, 255, 0.05)" // Very dim arcane blue
        ctx.lineWidth = 0.5
        ctx.stroke()

        // Draw active connections with pulse
        if (conn.active) {
          const dx = toNode.x - fromNode.x
          const dy = toNode.y - fromNode.y
          const x = fromNode.x + dx * conn.progress
          const y = fromNode.y + dy * conn.progress

          // Draw pulse
          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = "rgba(0, 191, 255, 0.8)" // Arcane blue
          ctx.fill()

          // Update pulse position
          conn.progress += conn.speed

          // Reset pulse when it reaches the end
          if (conn.progress > 1) {
            conn.progress = 0
            conn.active = Math.random() < 0.7 // 70% chance to remain active

            // Create a pulse effect at the destination node
            pulses.push({
              x: toNode.x,
              y: toNode.y,
              size: 1,
              alpha: 0.7,
            })

            // Randomly activate connected nodes
            connections.forEach((otherConn) => {
              if ((otherConn.from === conn.to || otherConn.to === conn.to) && !otherConn.active) {
                if (Math.random() < 0.3) {
                  // 30% chance to activate connected node
                  otherConn.active = true
                  otherConn.progress = 0
                }
              }
            })
          }
        } else if (Math.random() < 0.001) {
          // Small chance for inactive connections to become active
          conn.active = true
          conn.progress = 0
        }
      })

      // Draw nodes
      nodes.forEach((node) => {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(0, 191, 255, 0.2)" // Arcane blue with transparency
        ctx.fill()
      })

      // Draw and update pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i]
        ctx.beginPath()
        ctx.arc(pulse.x, pulse.y, pulse.size, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0, 191, 255, ${pulse.alpha})`
        ctx.lineWidth = 0.5
        ctx.stroke()

        // Update pulse
        pulse.size += 0.5
        pulse.alpha -= 0.02

        // Remove faded pulses
        if (pulse.alpha <= 0) {
          pulses.splice(i, 1)
        }
      }

      // Add hexagonal patterns occasionally
      if (Math.random() < 0.01 && pulses.length < 20) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        drawHexPattern(x, y)
      }
    }

    // Initialize the canvas and create nodes/connections
    function initializeCanvas() {
      // Set canvas to full screen
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      // Clear existing nodes and connections
      nodes.length = 0
      connections.length = 0
      pulses.length = 0

      // Create nodes
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 1,
        })
      }

      // Create connections between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 200) {
            // Only connect nearby nodes
            connections.push({
              from: i,
              to: j,
              active: Math.random() < 0.2, // 20% of connections are active initially
              progress: Math.random(), // Random starting progress
              speed: 0.002 + Math.random() * 0.006, // Random speed
            })
          }
        }
      }
    }

    // Handle window resize
    const resize = () => {
      initializeCanvas()
    }

    window.addEventListener("resize", resize)

    // Initial setup
    initializeCanvas()

    // Animation loop
    let animationId: number
    function animate() {
      draw()
      animationId = requestAnimationFrame(animate)
    }

    animate()

    // Cleanup
    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 opacity-40 pointer-events-none" aria-hidden="true" />
}
