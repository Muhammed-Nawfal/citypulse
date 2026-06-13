// 3×3 grid of central London zone polygons aligned to store zone IDs z_0_0 … z_2_2
// Grid covers lng [-0.210, -0.021], lat [51.470, 51.540]

type ZoneFeature = GeoJSON.Feature<GeoJSON.Polygon, { id: string; name: string }>

function makeBox(
  lngMin: number, lngMax: number,
  latMin: number, latMax: number,
  id: string, name: string,
): ZoneFeature {
  return {
    type: "Feature",
    properties: { id, name },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [lngMin, latMin],
        [lngMax, latMin],
        [lngMax, latMax],
        [lngMin, latMax],
        [lngMin, latMin],
      ]],
    },
  }
}

const C = [-0.210, -0.147, -0.084, -0.021] // column lng boundaries
const R = [51.470, 51.494, 51.517, 51.540] // row lat boundaries (S→N)

export const LONDON_ZONES: GeoJSON.FeatureCollection<GeoJSON.Polygon, { id: string; name: string }> = {
  type: "FeatureCollection",
  features: [
    // Row 0 (North)
    makeBox(C[0], C[1], R[2], R[3], "z_0_0", "Notting Hill"),
    makeBox(C[1], C[2], R[2], R[3], "z_0_1", "Camden"),
    makeBox(C[2], C[3], R[2], R[3], "z_0_2", "Hackney"),
    // Row 1 (Middle)
    makeBox(C[0], C[1], R[1], R[2], "z_1_0", "Kensington"),
    makeBox(C[1], C[2], R[1], R[2], "z_1_1", "City of London"),
    makeBox(C[2], C[3], R[1], R[2], "z_1_2", "Whitechapel"),
    // Row 2 (South)
    makeBox(C[0], C[1], R[0], R[1], "z_2_0", "Battersea"),
    makeBox(C[1], C[2], R[0], R[1], "z_2_1", "Lambeth"),
    makeBox(C[2], C[3], R[0], R[1], "z_2_2", "Southwark"),
  ],
}
