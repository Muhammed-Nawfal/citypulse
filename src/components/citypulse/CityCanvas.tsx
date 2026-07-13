"use client"
import Map, { Source, Layer, type MapLayerMouseEvent } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { useMemo, useCallback } from "react"
import { useCityStore } from "@/lib/cityStore"
import { LONDON_ZONES } from "./londonZones"

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty"

function riskFill(score: number, visible: boolean): string {
  if (!visible || score < 0.01) return "rgba(0,0,0,0)"
  if (score >= 0.8) return "rgba(220,38,38,0.48)"
  if (score >= 0.6) return "rgba(249,115,22,0.42)"
  if (score >= 0.3) return "rgba(234,179,8,0.36)"
  return "rgba(74,222,128,0.15)"
}

function riskBorder(score: number, visible: boolean, selected: boolean): string {
  if (!visible) return "rgba(255,255,255,0.0)"
  if (selected) return "rgba(255,255,255,0.9)"
  if (score >= 0.8) return "rgba(220,38,38,0.85)"
  if (score >= 0.6) return "rgba(249,115,22,0.75)"
  if (score >= 0.3) return "rgba(234,179,8,0.65)"
  return "rgba(74,222,128,0.30)"
}

export default function CityCanvas() {
  const zones = useCityStore(s => s.zones)
  const city = useCityStore(s => s.city)
  const selectedZone = useCityStore(s => s.selectedZone)
  const setSelectedZone = useCityStore(s => s.setSelectedZone)

  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: LONDON_ZONES.features.map(f => {
      const z = zones[f.properties.id]
      const score = z?.score ?? 0
      const visible = z?.visible ?? false
      const selected = selectedZone === f.properties.id
      return {
        ...f,
        properties: {
          ...f.properties,
          score, visible, selected,
          fillColor: riskFill(score, visible),
          borderColor: riskBorder(score, visible, selected),
          borderWidth: selected ? 3 : visible && score >= 0.3 ? 2 : 1,
          labelOpacity: visible ? 1 : 0,
        },
      }
    }),
  }), [zones, selectedZone])

  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0]
    if (feature?.properties?.visible) setSelectedZone(feature.properties.id)
  }, [setSelectedZone])

  return (
    <div className="relative w-full h-full">
      <Map
        initialViewState={{ longitude: -0.1157, latitude: 51.505, zoom: 12, pitch: 52, bearing: -20 }}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["zone-fill"]}
        onClick={handleClick}
      >
        <Source id="zones" type="geojson" data={geojson}>
          <Layer
            id="zone-fill"
            type="fill"
            paint={{
              "fill-color": ["get", "fillColor"] as any,
              "fill-antialias": true,
            }}
          />
          <Layer
            id="zone-border"
            type="line"
            paint={{
              "line-color": ["get", "borderColor"] as any,
              "line-width": ["get", "borderWidth"] as any,
              "line-opacity": 1,
            }}
          />
          <Layer
            id="zone-label"
            type="symbol"
            layout={{
              "text-field": ["get", "name"],
              "text-size": 13,
              "text-anchor": "center",
              "text-font": ["Noto Sans Bold"],
              "text-allow-overlap": false,
            }}
            paint={{
              "text-color": "#ffffff",
              "text-opacity": ["get", "labelOpacity"] as any,
              "text-halo-color": "#000000",
              "text-halo-width": 2,
            }}
          />
        </Source>
      </Map>

      {city && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 20, padding: "4px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
            <span style={{ color: "#1a1a2e", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {city}
            </span>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-4 z-10 pointer-events-none"
        style={{ background: "rgba(255,255,255,0.92)", borderRadius: 10, padding: "10px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
        <p style={{ color: "#666", fontSize: 9, marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Risk Level</p>
        {[
          { color: "rgba(220,38,38,0.7)", label: "Critical  ≥0.8" },
          { color: "rgba(249,115,22,0.65)", label: "High  ≥0.6" },
          { color: "rgba(234,179,8,0.6)", label: "Medium  ≥0.3" },
          { color: "rgba(74,222,128,0.5)", label: "Low  <0.3" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: color, border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0 }} />
            <span style={{ color: "#444", fontSize: 10, fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
