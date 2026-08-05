// campus-map.svg의 viewBox 크기(고정값 — 에셋이 통째로 바뀌지 않는 한 유지된다).
export const CAMPUS_MAP_SVG_WIDTH = 912
export const CAMPUS_MAP_SVG_HEIGHT = 1300

// preserveAspectRatio="xMidYMid meet"(contain)로 렌더링될 때 컨테이너 안에서 실제로 지도가
// 그려지는 영역(레터박스 여백 제외)을 기준으로 0~1 비율 좌표를 스크린 픽셀로 변환한다.
// "slice"(cover)를 쓰면 컨테이너와 SVG의 가로세로 비율이 다를 때 좌우(또는 상하) 끝부분이
// 아예 그려지지 않고 잘려서, 팬으로도 복구할 수 없다(2026-08-06 확인) — 그래서 meet를 쓴다.
export function toContainedMapPoint(
  containerWidth: number,
  containerHeight: number,
  ratioX: number,
  ratioY: number,
) {
  const containScale = Math.min(
    containerWidth / CAMPUS_MAP_SVG_WIDTH,
    containerHeight / CAMPUS_MAP_SVG_HEIGHT,
  )
  const renderedWidth = CAMPUS_MAP_SVG_WIDTH * containScale
  const renderedHeight = CAMPUS_MAP_SVG_HEIGHT * containScale
  const offsetX = (containerWidth - renderedWidth) / 2
  const offsetY = (containerHeight - renderedHeight) / 2

  return {
    x: offsetX + renderedWidth * ratioX,
    y: offsetY + renderedHeight * ratioY,
  }
}

// 대여소 마커 주변에 남겨둘 여유(라벨·마커 오프셋이 화면 밖으로 밀리지 않도록, SVG 단위).
const STATION_SAFE_BUFFER = 60

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

// "meet"(contain)는 등록된 모든 대여소가 잘리지 않지만 짧은 쪽 축에 여백이 남고, "slice"(cover)는
// 여백은 없지만 긴 쪽 축의 끝부분(예: AI 연구관)이 화면 밖으로 잘릴 수 있다. 그래서 등록된 모든
// 대여소가 화면 안에 들어오는 한도 내에서 meet~slice 사이 최대한 slice에 가까운 배율을 찾아
// 여백을 최소화한다(2026-08-06 사용자 확인 — "양옆은 다 나와야 하는데 위아래는 여백까지 나와").
// 반환값은 CAMPUS_MAP_SVG_WIDTH/HEIGHT 기준 실제 배율(=1이 아니라 컨테이너/SVG 크기의 비율)이다.
export function computeSafeFillScale(
  containerWidth: number,
  containerHeight: number,
  stations: { x: number; y: number }[],
) {
  const meetScale = Math.min(containerWidth / CAMPUS_MAP_SVG_WIDTH, containerHeight / CAMPUS_MAP_SVG_HEIGHT)
  const sliceScale = Math.max(containerWidth / CAMPUS_MAP_SVG_WIDTH, containerHeight / CAMPUS_MAP_SVG_HEIGHT)

  if (stations.length === 0 || containerWidth === 0 || containerHeight === 0) {
    return meetScale
  }

  const xs = stations.map((station) => station.x * CAMPUS_MAP_SVG_WIDTH)
  const ys = stations.map((station) => station.y * CAMPUS_MAP_SVG_HEIGHT)
  const minX = Math.min(...xs) - STATION_SAFE_BUFFER
  const maxX = Math.max(...xs) + STATION_SAFE_BUFFER
  const minY = Math.min(...ys) - STATION_SAFE_BUFFER
  const maxY = Math.max(...ys) + STATION_SAFE_BUFFER

  const centerX = CAMPUS_MAP_SVG_WIDTH / 2
  const centerY = CAMPUS_MAP_SVG_HEIGHT / 2
  const neededHalfWidth = Math.max(centerX - minX, maxX - centerX)
  const neededHalfHeight = Math.max(centerY - minY, maxY - centerY)

  const safeScaleX = containerWidth / (2 * neededHalfWidth)
  const safeScaleY = containerHeight / (2 * neededHalfHeight)

  return clampNumber(Math.min(safeScaleX, safeScaleY, sliceScale), meetScale, sliceScale)
}
