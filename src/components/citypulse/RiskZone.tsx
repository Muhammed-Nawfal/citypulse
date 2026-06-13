"use client"

interface Props {
  id: string
  position: [number, number, number]
}

export default function RiskZone({ id, position }: Props) {
  return (
    <mesh position={position}>
      <boxGeometry args={[4, 0.1, 4]} />
      <meshStandardMaterial color="#1a1a3a" />
    </mesh>
  )
}
