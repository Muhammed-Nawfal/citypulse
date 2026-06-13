"use client"
import Map, { Source, Layer, type MapLayerMouseEvent } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { useMemo, useCallback } from "react"
import { useCityStore } from "@/lib/cityStore"
import { LONDON_ZONES } from "./londonZones"

const CARTO_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

export default function CityCanvas() {
  const zones = useCityStore(s => s.zones)
  const city = useCityStore(s => s.city)
  const selectedZone = useCityStore(s => s.selectedZone)
  const setSelectedZone = useCityStore(s => s.setSelectedZone)

  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: LONDON_ZONES.features.map(f => ({
      ...f,
      properties: {
        ...f.properties,
        ...zones[f.properties.id],
        selected: selectedZone === f.properties.id,
      },
    })),
  }), [zones, selectedZone])

  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0]
    if (feature?.properties?.visible) {
      setSelectedZone(feature.properties.id)
    }
  }, [setSelectedZone])

  return (
    <div className="relative w-full h-full">
      <Map
        initialViewState={{ longitude: -0.1157, latitude: 51.505, zoom: 11.2 }}
        mapStyle={CARTO_DARK}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["zone-fill"]}
        onClick={handleClick}
      >
        <Source id="zones" type="geojson" data={geojson}>
          <Layer
            id="zone-fill"
            type="fill"
            paint={{
              "fill-color": [
                "case",
                [">=", ["get", "score"], 0.8], "#dc2626",
                [">=", ["get", "score"], 0.6], "#f87171",
                [">=", ["get", "score"], 0.3], "#fb923c",
                "#4ade80",
              ],
              "fill-opacity": [
                "case",
                ["boolean", ["get", "visible"], false], 0.30, 0.04,
              ],
            }}
          />
          <Layer
            id="zone-border"
            type="line"
            paint={{
              "line-color": [
                "case",
                [">=", ["get", "score"], 0.8], "#dc2626",
                [">=", ["get", "score"], 0.6], "#f87171",
                [">=", ["get", "score"], 0.3], "#fb923c",
                "#4ade80",
              ],
              "line-width": ["case", ["boolean", ["get", "selected"], false], 3, 1],
              "line-opacity": ["case", ["boolean", ["get", "visible"], false], 0.9, 0.15],
            }}
          />
          <Layer
            id="zone-label"
            type="symbol"
            layout={{
              "text-field": ["get", "name"],
              "text-size": 11,
              "text-anchor": "center",
            }}
            paint={{
              "text-color": "#ffffff",
              "text-opacity": ["case", ["boolean", ["get", "visible"], false], 0.85, 0],
              "text-halo-color": "#000000",
              "text-halo-width": 1,
            }}
          />
        </Source>
      </Map>

      {city && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <span style={{
            color: "rgba(255,255,255,0.8)",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textShadow: "0 0 20px rgba(100,140,255,0.6)",
          }}>
            {city}
          </span>
        </div>
      )}
    </div>
  )
}
