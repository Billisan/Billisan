import { useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import WebView from 'react-native-webview'
import type { Station } from '../../types/station'
import {
  TILE_1_0_0,
  TILE_1_0_1,
  TILE_1_1_0,
  TILE_1_1_1,
  TILE_2_0_0,
  TILE_BLANK_FALLBACK,
} from './kakaoTiles.generated'
import { MARKER_ICON_EMPTY, MARKER_ICON_LESS, MARKER_ICON_MANY } from './kakaoMarkerIcon.generated'

const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY
if (!KAKAO_JS_KEY) {
  throw new Error('EXPO_PUBLIC_KAKAO_JS_KEY is not set')
}

// Kakao Tileset은 maxZoom=2일 때 0단계를 4x4(2048px) 가상 월드로 투영한다.
// 모든 레벨의 타일과 마커가 이 동일한 월드 좌표를 공유하도록 고정한다.
const WORLD_SIZE = 2048

interface KakaoMapWebViewProps {
  stations: Station[]
  selectedStationId: number | null
  onSelectStation: (id: number) => void
  // 마커 아이콘 표시 크기(정사각형, px) — 화면마다 다르게 쓰기 위해 옵션으로 뺌(2026-08-09,
  // 홈 화면 미리보기는 더 작게). 기본값은 지도 탭에서 쓰던 기존 크기 그대로 유지.
  markerSize?: number
  // 초기 진입 줌 레벨(1~2) — 기본 2단계(전체 지도)는 타일 1장을 늘려 쓰는 거라 화질이 낮다.
  // 홈 화면 미리보기는 1단계(타일 4장, 더 선명함)로 시작하도록 오버라이드 가능(2026-08-09).
  // 0단계(9장)는 카카오 4x4 가상 월드 그리드와 타일 수가 안 맞아 확대 범위에서 제외했다
  // (Tileset minZoom=1, 2026-08-09 사용자 결정) — initialLevel로도 0을 넘기지 않는다.
  initialLevel?: number
  // 새로고침용(2026-08-09) — stations는 Mock에서 항상 같은 배열 참조라 refetch만으로는
  // useMemo가 재계산되지 않는다. 이 값이 바뀌면 WebView를 강제로 다시 마운트해 지도를
  // 처음부터 다시 그린다(팬/줌 위치도 초기화됨, 새로고침 의도에 부합).
  refreshKey?: number
}

// 마커 탭 시 WebView -> RN으로 오는 메시지 타입. HTML 쪽 post(type, payload)가 항상
// { type, payload } 형태로 감싸서 보낸다 — stationId는 payload 안에 있다(2026-08-08 버그 수정:
// message.stationId를 바로 읽어서 undefined가 되던 문제).
interface StationSelectedMessage {
  type: 'STATION_SELECTED'
  payload: { stationId: number }
}

// getTile(x,y,z)에서 타일을 찾을 때 쓰는 키. 1단계 x,y 각각 0~1(2x2=4장), 2단계 0뿐(1장) —
// 0단계(3x3=9장)는 확대 범위에서 제외했다(2026-08-09, 아래 initialLevel 주석 참고).
const TILES: Record<string, string> = {
  '1_0_0': TILE_1_0_0,
  '1_0_1': TILE_1_0_1,
  '1_1_0': TILE_1_1_0,
  '1_1_1': TILE_1_1_1,
  '2_0_0': TILE_2_0_0,
}

function buildHtml(stations: Station[], markerSize: number, initialLevel: number): string {
  // 마커는 WebView(카카오 엔진) 안에서 직접 렌더링 — RN 쪽 StationMarker는 더 이상 쓰지 않는다
  // (PLAN §4). station.x/y(0~1 비율, 이미지 좌표계 — y=0이 위)를 kakao.maps.Coords로 변환한다.
  // projectionId:null일 때 카카오 좌표계는 left-bottom이 (0,0)이고 y가 위로 갈수록 증가하는
  // 방식이라(2026-08-09 확인, 공식 문서), 이미지 좌표(y=0이 위)를 그대로 못 쓰고 뒤집어야 한다.
  // 우산 개수별 마커 아이콘 tier — 5~3개: many, 2~1개: less, 0개: empty(2026-08-09 사용자 지정).
  const markerData = stations.map((station) => ({
    id: station.id,
    name: station.name,
    x: station.x * WORLD_SIZE,
    y: (1 - station.y) * WORLD_SIZE,
    iconTier:
      station.availableCount === 0 ? 'empty' : station.availableCount <= 2 ? 'less' : 'many',
  }))

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false"></script>
  <script>
    function post(type, payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload || null }));
      }
    }

    var TILES = ${JSON.stringify(TILES)};
    var BLANK_FALLBACK = ${JSON.stringify(TILE_BLANK_FALLBACK)};
    var MARKER_ICON_SRC = {
      many: ${JSON.stringify(MARKER_ICON_MANY)},
      less: ${JSON.stringify(MARKER_ICON_LESS)},
      empty: ${JSON.stringify(MARKER_ICON_EMPTY)},
    };
    var MARKER_SIZE = ${markerSize};
    var WORLD_SIZE = ${WORLD_SIZE};
    var stations = ${JSON.stringify(markerData)};

    // 줌 레벨 z의 한 변 타일 개수 — maxZoom=2 기준 Kakao의 표준(2의 거듭제곱) 가상 월드
    // 그리드와 정확히 일치시킨다(2026-08-09, 1단계 정렬 문제를 고치며 확인된 공식).
    // z=0(최대 확대) -> 4, z=1 -> 2, z=2(최소 확대/전체 지도) -> 1.
    // 0단계는 실제 타일 이미지가 9장(3x3)뿐이라 네 번째 행/열은 항상 빈 화면(fallback)이다 —
    // 캠퍼스 바깥 여백 쪽에 해당해 실사용에 지장 없을 것으로 예상(실기기 확인 필요).
    function limitForZ(z) {
      return Math.pow(2, 2 - z);
    }

    // 현재 PNG 파일의 y 키는 지도 콜백의 y 방향과 반대다. 이 변환은 파일 선택에만 쓰며,
    // 타일이 놓이는 월드 좌표 자체를 바꾸지 않는다.
    function sourceKey(z, x, mapRow) {
      var limit = limitForZ(z);
      var sourceRow = (limit - 1) - mapRow;
      return z + '_' + x + '_' + sourceRow;
    }

    function makeImageTile(src) {
      var image = document.createElement('img');
      image.src = src || BLANK_FALLBACK;
      image.style.display = 'block';
      image.style.width = '100%';
      image.style.height = '100%';
      image.style.objectFit = 'fill';
      return image;
    }

    // 0단계(9장, 3x3)는 Kakao의 level 0 가상 월드(4x4=2048px)와 타일 수가 안 맞아 정렬이
    // 깨지는 문제가 남아있어 제외한다(2026-08-09 사용자 결정). 1단계(2x2=4장)는 maxZoom=2
    // 기준 표준 월드(2x2)와 타일 수가 정확히 맞아 이 문제가 없다.
    function getTile(mapX, mapY, z) {
      var limit = limitForZ(z);
      var key = sourceKey(z, mapX, mapY);
      if (mapX < 0 || mapX >= limit || mapY < 0 || mapY >= limit || !TILES[key]) {
        post('TILE_MISS', { z: z, mapX: mapX, mapY: mapY, key: key, limit: limit });
        return makeImageTile(BLANK_FALLBACK);
      }
      return makeImageTile(TILES[key]);
    }

    try {
      kakao.maps.load(function () {
        try {
          kakao.maps.Tileset.add(
            'BILLISAN',
            new kakao.maps.Tileset({
              width: 512,
              height: 512,
              getTile: getTile,
              minZoom: 1,
              maxZoom: 2,
            })
          );

          // 초기 진입 레벨은 prop으로 받는다(2026-08-09) — 2단계(전체 지도 1장)·1단계(4장) 정상
          // 동작 확인됨(0단계는 위 TILES 주석 참고). left-bottom 원점 좌표계라 x/y 모두 양수
          // (2026-08-09 문서 확인).
          var center = new kakao.maps.Coords(WORLD_SIZE / 2, WORLD_SIZE / 2);
          var map = new kakao.maps.Map(document.getElementById('map'), {
            projectionId: null,
            mapTypeId: kakao.maps.MapTypeId.BILLISAN,
            center: center,
            level: ${initialLevel},
          });
          // 2단계(전체 지도, 콘텐츠 크기가 화면과 거의 같아 이동 여백이 없음)는 드래그를 막고,
          // 1단계(콘텐츠가 화면의 2배라 이동 여지 있음)만 드래그를 허용한다(2026-08-09 사용자
          // 확인). 경계에서 중심을 강제로 되돌리는 clamp도 시도했으나 idle마다 즉시 중앙으로
          // 리셋되어 드래그 자체가 안 되는 것처럼 느껴져 제거하고 이 방식으로 대체.
          function updateDraggable() {
            map.setDraggable(map.getLevel() !== 2);
          }
          updateDraggable();
          kakao.maps.event.addListener(map, 'zoom_changed', updateDraggable);

          // 커스텀 마커 아이콘 — 우산 개수 tier(many/less/empty)별로 다른 이미지(2026-08-09).
          // MARKER_SIZE 정사각형 표시, 하단 중앙이 실제 좌표를 가리키도록 anchor 지정(핀 모양
          // 기준 추정치, 실물 확인 후 조정 가능). 화면마다 크기를 다르게 쓸 수 있도록 prop으로
          // 받음(2026-08-09).
          function buildMarkerImageSet(size) {
            return {
              many: new kakao.maps.MarkerImage(
                MARKER_ICON_SRC.many,
                new kakao.maps.Size(size, size),
                { offset: new kakao.maps.Point(size / 2, size) }
              ),
              less: new kakao.maps.MarkerImage(
                MARKER_ICON_SRC.less,
                new kakao.maps.Size(size, size),
                { offset: new kakao.maps.Point(size / 2, size) }
              ),
              empty: new kakao.maps.MarkerImage(
                MARKER_ICON_SRC.empty,
                new kakao.maps.Size(size, size),
                { offset: new kakao.maps.Point(size / 2, size) }
              ),
            };
          }
          var markerImages = buildMarkerImageSet(MARKER_SIZE);
          // 바텀시트에서 대여소를 선택하면 해당 마커만 확대 표시한다(2026-08-09).
          var SELECTED_MARKER_SIZE = MARKER_SIZE * 1.4;
          var selectedMarkerImages = buildMarkerImageSet(SELECTED_MARKER_SIZE);

          var markersById = {};
          stations.forEach(function (station) {
            // station.x/y는 이미 buildHtml에서 left-bottom 원점 기준으로 변환된 값(위 주석 참고).
            var position = new kakao.maps.Coords(station.x, station.y);
            var markerImage = markerImages[station.iconTier];
            var marker = new kakao.maps.Marker({ position: position, image: markerImage, map: map });
            kakao.maps.event.addListener(marker, 'click', function () {
              post('STATION_SELECTED', { stationId: station.id });
            });
            markersById[station.id] = { marker: marker, iconTier: station.iconTier, position: position };
          });

          // RN(바텀시트 목록 탭 또는 selectedStationId 변경)에서 오는 postMessage를 받아
          // 선택된 대여소 마커만 확대하고, 이전에 선택돼 있던 마커는 원래 크기로 되돌린다.
          // 지도도 그 대여소 위치로 부드럽게 이동(panTo)한다(2026-08-09). 안드로이드는 document,
          // iOS는 window로 메시지가 온다.
          var currentSelectedId = null;
          function selectStationMarker(stationId) {
            if (currentSelectedId != null && markersById[currentSelectedId]) {
              var prev = markersById[currentSelectedId];
              prev.marker.setImage(markerImages[prev.iconTier]);
              prev.marker.setZIndex(0);
            }
            currentSelectedId = stationId;
            if (stationId != null && markersById[stationId]) {
              var next = markersById[stationId];
              next.marker.setImage(selectedMarkerImages[next.iconTier]);
              next.marker.setZIndex(999);
              map.panTo(next.position);
            }
          }
          function handleRNMessage(event) {
            try {
              var data = JSON.parse(event.data);
              if (data.type === 'SELECT_STATION') {
                selectStationMarker(data.stationId);
              }
            } catch (handleError) {
              post('RN_MESSAGE_ERROR', String(handleError));
            }
          }
          document.addEventListener('message', handleRNMessage);
          window.addEventListener('message', handleRNMessage);

          post('MAP_READY');
        } catch (innerError) {
          post('MAP_ERROR', String(innerError));
        }
      });
    } catch (outerError) {
      post('SDK_LOAD_ERROR', String(outerError));
    }
  </script>
</body>
</html>`
}

// SCR-APP-STATION-001. CampusMap.tsx(SVG+제스처)를 대체 — 카카오맵 JS SDK 커스텀 타일셋을
// WebView(source={{ html }})로 띄운다(DEC-SF-004 번복, 2026-08-08 PLAN 참고). 마커는 WebView 안
// 카카오 엔진이 그리고, 탭 이벤트만 postMessage로 받아 네이티브 StationListSheet에서 해당
// 대여소로 스크롤+하이라이트한다(2026-08-09).
export function KakaoMapWebView({
  stations,
  selectedStationId,
  onSelectStation,
  markerSize = 32,
  initialLevel = 2,
  refreshKey = 0,
}: KakaoMapWebViewProps) {
  const html = useMemo(
    () => buildHtml(stations, markerSize, initialLevel),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey는 stations 참조가 안 바뀌어도
    // 강제로 다시 그리기 위한 트리거일 뿐, html 계산 자체엔 안 쓰인다.
    [stations, markerSize, initialLevel, refreshKey],
  )
  const webViewRef = useRef<WebView>(null)
  const [isMapReady, setIsMapReady] = useState(false)

  // selectedStationId가 바뀌면(마커 탭 또는 바텀시트 목록 탭) WebView에 postMessage로 알려서
  // 해당 마커만 확대한다(2026-08-09) — 전체 HTML을 다시 로드하지 않기 위해 useMemo 의존성에는
  // selectedStationId를 넣지 않는다. MAP_READY 전에 보내면 리스너가 아직 없어 유실되므로
  // isMapReady로 순서를 보장한다.
  useEffect(() => {
    if (!isMapReady) return
    webViewRef.current?.postMessage(JSON.stringify({ type: 'SELECT_STATION', stationId: selectedStationId }))
  }, [selectedStationId, isMapReady])

  return (
    <View className="flex-1">
      <WebView
        key={refreshKey}
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(event) => {
          // WebView가 JSON이 아닌 문자열을 보내는 경우(예상 못 한 내부 오류 등)에도 앱 전체가
          // 죽지 않도록 방어(2026-08-09 코드 리뷰 반영).
          let message:
            | StationSelectedMessage
            | { type: 'MAP_READY' | 'MAP_ERROR' | 'SDK_LOAD_ERROR'; payload: unknown }
          try {
            message = JSON.parse(event.nativeEvent.data)
          } catch (error) {
            console.log('[KakaoMapWebView] failed to parse message', event.nativeEvent.data, error)
            return
          }

          if (message.type === 'STATION_SELECTED') {
            onSelectStation(message.payload.stationId)
          } else {
            if (message.type === 'MAP_READY') {
              setIsMapReady(true)
            }
            console.log('[KakaoMapWebView]', message.type, message.payload)
          }
        }}
        onError={(event) => {
          console.log('[KakaoMapWebView] WebView error', event.nativeEvent)
        }}
      />
    </View>
  )
}
