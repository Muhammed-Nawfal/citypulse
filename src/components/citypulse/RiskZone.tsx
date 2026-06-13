"use client"
import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useSpring, animated } from "@react-spring/three"
import { useCityStore } from "@/lib/cityStore"
import * as THREE from "three"

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function getRiskColour(score: number): string {
  if (score >= 0.8) return "#dc2626"
  if (score >= 0.6) return "#f87171"
  if (score >= 0.3) return "#fb923c"
  return "#4ade80"
}

interface Props {
  id: string
  position: [number, number, number]
}

export default function RiskZone({ id, position }: Props) {
  const zone = useCityStore(s => s.zones[id])
  const setSelectedZone = useCityStore(s => s.setSelectedZone)
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])

  const buildings = useMemo(() => {
    const seed = id.charCodeAt(2) * 100 + id.charCodeAt(4)
    const count = 6 + Math.floor(seededRandom(seed) * 4)
    return Array.from({ length: count }, (_, i) => ({
      x: (seededRandom(seed + i * 7) - 0.5) * 3.5,
      z: (seededRandom(seed + i * 13) - 0.5) * 3.5,
      height: 0.4 + seededRandom(seed + i * 3) * 1.8,
      width: 0.3 + seededRandom(seed + i * 5) * 0.5,
    }))
  }, [id])

  const { scaleY } = useSpring({
    scaleY: zone.visible ? 1 : 0,
    config: { tension: 120, friction: 14 },
  })

  useFrame(({ clock }) => {
    if (zone.label === "CRITICAL") {
      const pulse = 0.2 + Math.sin(clock.elapsedTime * 3) * 0.2
      matRefs.current.forEach(m => { if (m) m.emissiveIntensity = pulse })
    }
  })

  const colour = getRiskColour(zone.score)
  const baseEmissive = zone.score >= 0.8 ? 0.3 : 0.05

  return (
    <group position={position}>
      {buildings.map((b, i) => (
        <animated.mesh
          key={i}
          position={[b.x, b.height / 2, b.z]}
          scale-y={scaleY}
          castShadow
          onClick={() => zone.visible && setSelectedZone(id)}
          onPointerOver={e => { e.stopPropagation(); document.body.style.cursor = "pointer" }}
          onPointerOut={() => { document.body.style.cursor = "auto" }}
        >
          <boxGeometry args={[b.width, b.height, b.width]} />
          <meshStandardMaterial
            ref={el => { matRefs.current[i] = el }}
            color={colour}
            emissive={colour}
            emissiveIntensity={baseEmissive}
            transparent
          />
        </animated.mesh>
      ))}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.5, 4.5]} />
        <meshStandardMaterial
          color={colour}
          transparent
          opacity={zone.visible ? 0.08 : 0}
        />
      </mesh>
    </group>
  )
}
