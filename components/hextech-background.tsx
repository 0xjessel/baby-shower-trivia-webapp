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

    // Edge circuit parameters
    const edgeCircuits: {
      startX: number
      startY: number
      endX: number
      endY: number
      controlPoints: { x: number; y: number }[]
      width: number
      glow: number
      speed: number
      progress: number
      active: boolean
    }[] = []

    // Circuit node parameters
    const circuitNodes: {
      x: number
      y: number
      size: number
      pulse: boolean
      pulseSize: number
      pulseAlpha: number
    }[] = []

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
        ctx.lineTo(x + size * 0.7 * Math.cos(angle), y + size * 0.7 * Math.sin(0))
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

    // Create arcane gold circuit paths along the edges
    function createEdgeCircuits() {
      const edgeMargin = 100 // Distance from edge
      const circuitCount = 12 // Number of circuit paths
      const nodeCount = 8 // Nodes per circuit

      // Create circuits along each edge
      for (let i = 0; i < circuitCount; i++) {
        // Determine which edge to place the circuit on
        const edge = Math.floor(Math.random() * 4) // 0: top, 1: right, 2: bottom, 3: left

        let startX, startY, endX, endY

        switch (edge) {
          case 0: // Top edge
            startX = Math.random() * canvas.width
            startY = Math.random() * edgeMargin
            endX = Math.random() * canvas.width
            endY = Math.random() * edgeMargin
            break
          case 1: // Right edge
            startX = canvas.width - Math.random() * edgeMargin
            startY = Math.random() * canvas.height
            endX = canvas.width - Math.random() * edgeMargin
            endY = Math.random() * canvas.height
            break
          case 2: // Bottom edge
            startX = Math.random() * canvas.width
            startY = canvas.height - Math.random() * edgeMargin
            endX = Math.random() * canvas.width
            endY = canvas.height - Math.random() * edgeMargin
            break
          case 3: // Left edge
            startX = Math.random() * edgeMargin
            startY = Math.random() * canvas.height
            endX = Math.random() * edgeMargin
            endY = Math.random() * canvas.height
            break
          default:
            startX = 0
            startY = 0
            endX = 0
            endY = 0
        }

        // Create control points for the circuit path
        const controlPoints = []
        for (let j = 0; j < nodeCount; j++) {
          let nodeX, nodeY

          // Keep nodes near the edge
          switch (edge) {
            case 0: // Top edge
              nodeX = startX + (endX - startX) * (j / nodeCount) + (Math.random() * 100 - 50)
              nodeY = Math.random() * edgeMargin
              break
            case 1: // Right edge
              nodeX = canvas.width - Math.random() * edgeMargin
              nodeY = startY + (endY - startY) * (j / nodeCount) + (Math.random() * 100 - 50)
              break
            case 2: // Bottom edge
              nodeX = startX + (endX - startX) * (j / nodeCount) + (Math.random() * 100 - 50)
              nodeY = canvas.height - Math.random() * edgeMargin
              break
            case 3: // Left edge
              nodeX = Math.random() * edgeMargin
              nodeY = startY + (endY - startY) * (j / nodeCount) + (Math.random() * 100 - 50)
              break
            default:
              nodeX = 0
              nodeY = 0
          }

          controlPoints.push({ x: nodeX, y: nodeY })

          // Add circuit nodes at control points
          circuitNodes.push({
            x: nodeX,
            y: nodeY,
            size: 2 + Math.random() * 4,
            pulse: Math.random() < 0.3,
            pulseSize: 0,
            pulseAlpha: 0.8,
          })
        }

        // Add the circuit to the array
        edgeCircuits.push({
          startX,
          startY,
          endX,
          endY,
          controlPoints,
          width: 1 + Math.random() * 2,
          glow: 3 + Math.random() * 5,
          speed: 0.002 + Math.random() * 0.006,
          progress: Math.random(),
          active: Math.random() < 0.7,
        })
      }
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

      // Draw edge circuits
      edgeCircuits.forEach((circuit) => {
        // Draw the base circuit path
        ctx.beginPath()
        ctx.moveTo(circuit.startX, circuit.startY)

        // Draw through control points
        for (let i = 0; i < circuit.controlPoints.length; i++) {
          ctx.lineTo(circuit.controlPoints[i].x, circuit.controlPoints[i].y)
        }

        ctx.lineTo(circuit.endX, circuit.endY)

        // Create gradient for the circuit
        const gradient = ctx.createLinearGradient(circuit.startX, circuit.startY, circuit.endX, circuit.endY)
        gradient.addColorStop(0, "rgba(255, 215, 0, 0.1)") // Gold with low opacity
        gradient.addColorStop(0.5, "rgba(255, 215, 0, 0.3)") // Brighter in the middle
        gradient.addColorStop(1, "rgba(255, 215, 0, 0.1)") // Gold with low opacity

        ctx.strokeStyle = gradient
        ctx.lineWidth = circuit.width
        ctx.stroke()

        // Add glow effect
        ctx.shadowBlur = circuit.glow
        ctx.shadowColor = "rgba(255, 215, 0, 0.5)"
        ctx.stroke()
        ctx.shadowBlur = 0

        // Draw energy pulse along the circuit if active
        if (circuit.active) {
          // Calculate position along the path
          const pulseIndex = Math.floor(circuit.progress * (circuit.controlPoints.length + 1))
          const pulseProgress = (circuit.progress * (circuit.controlPoints.length + 1)) % 1

          let x1, y1, x2, y2

          if (pulseIndex === 0) {
            // Between start and first control point
            x1 = circuit.startX
            y1 = circuit.startY
            x2 = circuit.controlPoints[0].x
            y2 = circuit.controlPoints[0].y
          } else if (pulseIndex >= circuit.controlPoints.length) {
            // Between last control point and end
            x1 = circuit.controlPoints[circuit.controlPoints.length - 1].x
            y1 = circuit.controlPoints[circuit.controlPoints.length - 1].y
            x2 = circuit.endX
            y2 = circuit.endY
          } else {
            // Between two control points
            x1 = circuit.controlPoints[pulseIndex - 1].x
            y1 = circuit.controlPoints[pulseIndex - 1].y
            x2 = circuit.controlPoints[pulseIndex].x
            y2 = circuit.controlPoints[pulseIndex].y
          }

          // Calculate pulse position
          const pulseX = x1 + (x2 - x1) * pulseProgress
          const pulseY = y1 + (y2 - y1) * pulseProgress

          // Draw pulse
          ctx.beginPath()
          ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2)
          ctx.fillStyle = "rgba(255, 215, 0, 0.9)" // Bright gold
          ctx.fill()

          // Add glow
          ctx.shadowBlur = 10
          ctx.shadowColor = "rgba(255, 215, 0, 0.8)"
          ctx.fill()
          ctx.shadowBlur = 0

          // Update progress
          circuit.progress += circuit.speed
          if (circuit.progress > 1) {
            circuit.progress = 0
            circuit.active = Math.random() < 0.8 // 80% chance to remain active
          }
        } else if (Math.random() < 0.005) {
          // Small chance for inactive circuits to become active
          circuit.active = true
          circuit.progress = 0
        }
      })

      // Draw circuit nodes
      circuitNodes.forEach((node) => {
        // Draw the node
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(255, 215, 0, 0.6)" // Gold
        ctx.fill()

        // Add glow
        ctx.shadowBlur = 5
        ctx.shadowColor = "rgba(255, 215, 0, 0.5)"
        ctx.fill()
        ctx.shadowBlur = 0

        // Handle pulsing nodes
        if (node.pulse) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, node.pulseSize, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255, 215, 0, ${node.pulseAlpha})`
          ctx.lineWidth = 1
          ctx.stroke()

          // Update pulse
          node.pulseSize += 0.3
          node.pulseAlpha -= 0.02

          // Reset pulse when it fades out
          if (node.pulseAlpha <= 0) {
            node.pulseSize = 0
            node.pulseAlpha = 0.8
          }
        }
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
      edgeCircuits.length = 0
      circuitNodes.length = 0

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

      // Create edge circuits
      createEdgeCircuits()
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
