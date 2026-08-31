const EARTH_RADIUS_M = 6371000

function toRad(deg) {
  return (deg * Math.PI) / 180
}

function toDeg(rad) {
  return (rad * 180) / Math.PI
}

// 두 좌표 사이의 실제 거리(미터) — Haversine 공식
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, a)))
}

// 좌표1에서 좌표2를 바라보는 방위각(도, 0=북쪽)
export function bearingTo(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1))
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// 좌표에서 특정 방위각으로 distanceMeters만큼 떨어진 좌표를 계산
export function destinationPoint(lat, lon, distanceMeters, bearingDeg) {
  const angDist = distanceMeters / EARTH_RADIUS_M
  const brng = toRad(bearingDeg)
  const lat1 = toRad(lat)
  const lon1 = toRad(lon)
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng)
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2)
    )
  return { lat: toDeg(lat2), lon: ((toDeg(lon2) + 540) % 360) - 180 }
}

// 기준 좌표에서 minMeters~maxMeters 범위, 무작위 방향으로 떨어진 좌표 (좀비/아이템 스폰용)
export function randomPointNear(lat, lon, minMeters, maxMeters) {
  const dist = minMeters + Math.random() * (maxMeters - minMeters)
  const bearing = Math.random() * 360
  return destinationPoint(lat, lon, dist, bearing)
}

// from에서 to를 향해 stepMeters만큼 다가간 좌표 (좀비 추격 이동용)
export function moveToward(fromLat, fromLon, toLat, toLon, stepMeters) {
  const dist = haversineDistance(fromLat, fromLon, toLat, toLon)
  if (dist <= stepMeters || dist === 0) return { lat: toLat, lon: toLon }
  const brng = bearingTo(fromLat, fromLon, toLat, toLon)
  return destinationPoint(fromLat, fromLon, stepMeters, brng)
}
