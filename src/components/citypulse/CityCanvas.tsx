"use client"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import CityGrid from "./CityGrid"
import { useCityStore } from "@/lib/cityStore"

export default function CityCanvas() {
  const city = useCityStore(s => s.city)

  return (
    <Canvas
      camera={{ position: [12, 14, 12], fov: 45 }}
      shadows
      className="w-full h-full"
    >
      <color attach="background" args={["#0a0a1a"]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <fog attach="fog" args={["#0a0a1a", 30, 60]} />

      <CityGrid />

      {city && (
        <Html position={[0, 4, 0]} center>
          <div style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textShadow: "0 0 20px rgba(100,140,255,0.5)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}>
            {city}
          </div>
        </Html>
      )}

      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
    </Canvas>
  )
}
