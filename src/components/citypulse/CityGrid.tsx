"use client"
import RiskZone from "./RiskZone"

const ZONE_LAYOUT: { id: string; position: [number, number, number] }[] = [
  { id: "z_0_0", position: [-6, 0, -6] },
  { id: "z_0_1", position: [0,  0, -6] },
  { id: "z_0_2", position: [6,  0, -6] },
  { id: "z_1_0", position: [-6, 0,  0] },
  { id: "z_1_1", position: [0,  0,  0] },
  { id: "z_1_2", position: [6,  0,  0] },
  { id: "z_2_0", position: [-6, 0,  6] },
  { id: "z_2_1", position: [0,  0,  6] },
  { id: "z_2_2", position: [6,  0,  6] },
]

export default function CityGrid() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[22, 22]} />
        <meshStandardMaterial color="#111122" />
      </mesh>
      <gridHelper args={[22, 6, "#1a1a3a", "#1a1a3a"]} />
      {ZONE_LAYOUT.map(z => (
        <RiskZone key={z.id} id={z.id} position={z.position} />
      ))}
    </group>
  )
}
