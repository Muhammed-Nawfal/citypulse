"use client"

import { useEffect, useRef } from "react"
import { useCityStore, type RiskLabel } from "@/lib/cityStore"
// Static type-only import so TypeScript resolves Cesium types without bundling the module
import type * as CesiumTypes from "cesium"

type BoundsTuple = [west: number, south: number, east: number, north: number]

const ZONE_BOUNDS: Record<string, BoundsTuple> = {
  z_0_0: [-0.18, 51.52, -0.14, 51.54],
  z_0_1: [-0.14, 51.52, -0.10, 51.54],
  z_0_2: [-0.10, 51.52, -0.06, 51.54],
  z_1_0: [-0.18, 51.50, -0.14, 51.52],
  z_1_1: [-0.14, 51.50, -0.10, 51.52],
  z_1_2: [-0.10, 51.50, -0.06, 51.52],
  z_2_0: [-0.18, 51.48, -0.14, 51.50],
  z_2_1: [-0.14, 51.48, -0.10, 51.50],
  z_2_2: [-0.10, 51.48, -0.06, 51.50],
}

const ALPHA: Record<RiskLabel, number> = {
  LOW: 0.4,
  MEDIUM: 0.5,
  HIGH: 0.6,
  CRITICAL: 0.7,
}

const HEX: Record<RiskLabel, string> = {
  LOW: "#4ade80",
  MEDIUM: "#fb923c",
  HIGH: "#f87171",
  CRITICAL: "#dc2626",
}

export default function CityCesiumCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<CesiumTypes.Viewer | null>(null)
  const handlerRef = useRef<CesiumTypes.ScreenSpaceEventHandler | null>(null)

  const zonesState = useCityStore((s) => s.zones)
  const setSelectedZone = useCityStore((s) => s.setSelectedZone)

  // Effect #1 — Viewer lifecycle (mount / unmount only)
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      // Must be set before any Cesium module initialises its worker base path
      ;(window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium"

      const Cesium = await import("cesium")
      // @ts-expect-error — no type declaration for Cesium widget CSS
      await import("cesium/Build/Cesium/Widgets/widgets.css")

      if (cancelled || !containerRef.current) return

      // Trim guards against accidental leading/trailing whitespace in the env var
      Cesium.Ion.defaultAccessToken =
        (process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? "").trim()

      // Load world terrain first so Ion imagery and 3D tiles have a surface to land on
      const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1)

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        fullscreenButton: false,
        selectionIndicator: false,
        infoBox: false,
        terrainProvider: terrain,
      })

      viewerRef.current = viewer

      // Photorealistic OSM buildings
      try {
        const buildings = await Cesium.createOsmBuildingsAsync()
        if (!cancelled) viewer.scene.primitives.add(buildings)
      } catch {
        // Non-fatal — viewer still works without 3D buildings if Ion token is missing
      }

      // Initial camera: London, isometric pitch
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-0.1278, 51.485, 2800),
        orientation: {
          heading: 0.0,
          pitch: Cesium.Math.toRadians(-35),
          roll: 0.0,
        },
      })

      // Seed all 9 zone entities with invisible fill; Effect #2 will colour them
      const white = Cesium.Color.WHITE
      for (const [id, [west, south, east, north]] of Object.entries(ZONE_BOUNDS)) {
        viewer.entities.add({
          id,
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(west, south, east, north),
            height: 50,
            material: new Cesium.ColorMaterialProperty(
              Cesium.Color.TRANSPARENT
            ),
            outline: true,
            outlineColor: white.withAlpha(0.6),
            outlineWidth: 1.5,
          },
        })
      }

      // Click → zone selection
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
      handlerRef.current = handler

      handler.setInputAction(
        (movement: { position: CesiumTypes.Cartesian2 }) => {
          const picked = viewer.scene.pick(movement.position)
          if (picked?.id instanceof Cesium.Entity) {
            setSelectedZone(picked.id.id as string)
          } else {
            setSelectedZone(null)
          }
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      )
    }

    init()

    return () => {
      cancelled = true
      handlerRef.current?.destroy()
      handlerRef.current = null
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
      }
      viewerRef.current = null
    }
  }, [setSelectedZone])

  // Effect #2 — Reactive colour sync driven by Zustand zone state
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    // Dynamic import is already resolved by the time this effect fires
    // (Effect #1 ran first); re-import resolves instantly from module cache
    import("cesium").then((Cesium) => {
      for (const [id, zoneState] of Object.entries(zonesState)) {
        const entity = viewer.entities.getById(id)
        if (!entity?.rectangle) continue

        if (!zoneState.visible) {
          entity.rectangle.material = new Cesium.ColorMaterialProperty(
            Cesium.Color.TRANSPARENT
          )
          continue
        }

        const color = Cesium.Color.fromCssColorString(HEX[zoneState.label]).withAlpha(
          ALPHA[zoneState.label]
        )
        entity.rectangle.material = new Cesium.ColorMaterialProperty(color)
      }
    })
  }, [zonesState])

  return <div ref={containerRef} className="w-full h-full" />
}
