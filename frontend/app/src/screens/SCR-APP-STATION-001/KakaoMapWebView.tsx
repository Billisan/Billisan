import { useMemo } from 'react'
import { View } from 'react-native'
import WebView from 'react-native-webview'
import type { Station } from '../../types/station'
import {
  TILE_0_0_0,
  TILE_0_0_1,
  TILE_0_0_2,
  TILE_0_1_0,
  TILE_0_1_1,
  TILE_0_1_2,
  TILE_0_2_0,
  TILE_0_2_1,
  TILE_0_2_2,
  TILE_1_0_0,
  TILE_1_0_1,
  TILE_1_1_0,
  TILE_1_1_1,
  TILE_2_0_0,
  TILE_BLANK_FALLBACK,
} from './kakaoTiles.generated'
import { MARKER_ICON } from './kakaoMarkerIcon.generated'

const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY
if (!KAKAO_JS_KEY) {
  throw new Error('EXPO_PUBLIC_KAKAO_JS_KEY is not set')
}

// 0단계(가장 세밀한 레벨, 3x3=9장) 기준 캠퍼스 지도 전체 픽셀 크기(512px 타일 3x3) — 지도 중심
// 좌표 계산에 쓰인다(타일 정렬 실기기 확인 완료된 값이라 그대로 유지).
const WORLD_SIZE = 1536

// 마커 좌표 변환 전용 스케일 — WORLD_SIZE와 분리(2026-08-09). 이름표 붙인 실기기 스크린샷으로
// 측정한 결과 WORLD_SIZE(1536)로는 마커가 화면 위쪽 끝까지 못 미치고 전체적으로 아래로 쏠려
// 보여서, 화면 전체 범위를 커버하도록 더 크게 잡음(실측 기반 — 정확한 수치는 추가 확인 후
// 미세조정 가능). 지도 중심(WORLD_SIZE)과 같이 바꾸면 타일 정렬이 다시 깨지므로 반드시 분리 유지.
const MARKER_SCALE = 2048

interface KakaoMapWebViewProps {
  stations: Station[]
  selectedStationId: number | null
  onSelectStation: (id: number) => void
  // 마커 아이콘 표시 크기(정사각형, px) — 화면마다 다르게 쓰기 위해 옵션으로 뺌(2026-08-09,
  // 홈 화면 미리보기는 더 작게). 기본값은 지도 탭에서 쓰던 기존 크기 그대로 유지.
  markerSize?: number
  // 초기 진입 줌 레벨(0~2) — 기본 2단계(전체 지도)는 타일 1장을 늘려 쓰는 거라 화질이 낮다.
  // 홈 화면 미리보기는 1단계(타일 4장, 더 선명함)로 시작하도록 오버라이드 가능(2026-08-09).
  // 0단계는 마커 좌표 어긋남이 남아있어 미해결 상태라 쓰지 않는다.
  initialLevel?: number
}

// 마커 탭 시 WebView -> RN으로 오는 메시지 타입. HTML 쪽 post(type, payload)가 항상
// { type, payload } 형태로 감싸서 보낸다 — stationId는 payload 안에 있다(2026-08-08 버그 수정:
// message.stationId를 바로 읽어서 undefined가 되던 문제).
interface StationSelectedMessage {
  type: 'STATION_SELECTED'
  payload: { stationId: number }
}

// getTile(x,y,z)에서 타일을 찾을 때 쓰는 키. 0단계 x,y 각각 0~2(3x3=9장), 1단계 0~1(2x2=4장),
// 2단계 0뿐(1장) — 카카오 공식 샘플의 limit=ceil(3/2^z) 규칙과 동일한 구조(2026-08-09).
const TILES: Record<string, string> = {
  '0_0_0': TILE_0_0_0,
  '0_0_1': TILE_0_0_1,
  '0_0_2': TILE_0_0_2,
  '0_1_0': TILE_0_1_0,
  '0_1_1': TILE_0_1_1,
  '0_1_2': TILE_0_1_2,
  '0_2_0': TILE_0_2_0,
  '0_2_1': TILE_0_2_1,
  '0_2_2': TILE_0_2_2,
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
  const markerData = stations.map((station) => ({
    id: station.id,
    name: station.name,
    x: station.x * MARKER_SCALE,
    // 모든 레벨에서 마커를 전체적으로 살짝 위로 올려달라는 요청(2026-08-09) — Coords y가 클수록
    // 화면 위쪽이라 작은 값을 더한다.
    y: (1 - station.y) * MARKER_SCALE + 40,
  }))

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }</style>
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
    var MARKER_ICON_SRC = ${JSON.stringify(MARKER_ICON)};
    var MARKER_SIZE = ${markerSize};
    var WORLD_SIZE = ${WORLD_SIZE};
    var stations = ${JSON.stringify(markerData)};

    // 줌 레벨 z의 한 변 타일 개수 — 카카오 공식 커스텀 타일셋 샘플과 동일한 공식(2026-08-09).
    // z=0(최대 확대) -> 3, z=1 -> 2, z=2(최소 확대/전체 지도) -> 1.
    function limitForZ(z) {
      return Math.ceil(3 / Math.pow(2, z));
    }

    // 지도 전체가 상하로 뒤집혀 보인다는 실사용 확인(북문이 정문보다 아래에 있음, 2026-08-09)에
    // 따라 세로 방향을 그 레벨의 타일 범위 안에서 미러(반전)한다. 2단계(타일 1개)는 이 공식을
    // 적용해도 결과가 그대로라 기존 정상 동작에 영향 없음.
    function getTile(origX, origY, z) {
      var x = origX;
      var limit = limitForZ(z);
      var y = (limit - 1) - origY;
      var key = z + '_' + x + '_' + y;
      var found = Object.prototype.hasOwnProperty.call(TILES, key);
      if (!found) {
        post('TILE_MISS', { z: z, origX: origX, origY: origY, mappedX: x, mappedY: y, limit: limit, key: key });
      }
      if (x < 0 || x >= limit || y < 0 || y >= limit) {
        return BLANK_FALLBACK;
      }
      return TILES[key] || BLANK_FALLBACK;
    }

    try {
      kakao.maps.load(function () {
        try {
          kakao.maps.Tileset.add(
            'BILLISAN',
            new kakao.maps.Tileset(512, 512, getTile, '', false, 0, 2)
          );

          // 초기 진입 레벨은 prop으로 받는다(2026-08-09) — 2단계(전체 지도 1장)·1단계(4장) 모두
          // 좌표 정상 동작 확인됨. 0단계(9장)만 마커 좌표가 어긋나는 별도 문제가 남아있어
          // initialLevel로 0을 넘기지 않는다(추후 조사 필요). left-bottom 원점 좌표계라 x/y 모두
          // 양수(2026-08-09 문서 확인).
          var center = new kakao.maps.Coords(WORLD_SIZE / 2, WORLD_SIZE / 2);
          var map = new kakao.maps.Map(document.getElementById('map'), {
            projectionId: null,
            mapTypeId: kakao.maps.MapTypeId.BILLISAN,
            center: center,
            level: ${initialLevel},
          });
          // 정의된 14장 범위를 벗어나면 옅은 회색 빈 화면이 보일 수 있음을 감수하고, 드래그(팬)를
          // 허용하기로 확정(2026-08-09 사용자 확인).
          map.setDraggable(true);

          // 1단계/0단계 좌표 어긋남 디버깅용 TILE_NUMBER 오버레이 — 확인 끝나서 주석 처리
          // (2026-08-09). 다시 필요하면 이 블록만 풀면 됨.
          // kakao.maps.Tileset.add('TILE_NUMBER', new kakao.maps.Tileset({
          //   width: 512,
          //   height: 512,
          //   getTile: function (x, y, z) {
          //     var div = document.createElement('div');
          //     div.innerHTML = x + ', ' + y + ', ' + z;
          //     div.style.fontSize = '28px';
          //     div.style.fontWeight = 'bold';
          //     div.style.lineHeight = '512px';
          //     div.style.textAlign = 'center';
          //     div.style.color = 'red';
          //     div.style.boxSizing = 'border-box';
          //     div.style.border = '2px dashed red';
          //     return div;
          //   }
          // }));
          // map.addOverlayMapTypeId(kakao.maps.MapTypeId.TILE_NUMBER);

          // 커스텀 마커 아이콘(marker.svg, 2026-08-09 사용자 요청) — MARKER_SIZE 정사각형 표시,
          // 하단 중앙이 실제 좌표를 가리키도록 anchor 지정(핀 모양 기준 추정치, 실물 확인 후 조정
          // 가능). 화면마다 크기를 다르게 쓸 수 있도록 prop으로 받음(2026-08-09).
          var markerImage = new kakao.maps.MarkerImage(
            MARKER_ICON_SRC,
            new kakao.maps.Size(MARKER_SIZE, MARKER_SIZE),
            { offset: new kakao.maps.Point(MARKER_SIZE / 2, MARKER_SIZE) }
          );

          stations.forEach(function (station) {
            // station.x/y는 이미 buildHtml에서 left-bottom 원점 기준으로 변환된 값(위 주석 참고).
            var position = new kakao.maps.Coords(station.x, station.y);
            var marker = new kakao.maps.Marker({ position: position, image: markerImage, map: map });
            kakao.maps.event.addListener(marker, 'click', function () {
              post('STATION_SELECTED', { stationId: station.id });
            });

            // 마커 좌표 디버깅용 이름 라벨 — 확인 끝나서 주석 처리(2026-08-09). 다시 필요하면
            // 이 블록만 풀면 됨.
            // var label = document.createElement('div');
            // label.innerHTML = station.name;
            // label.style.color = 'red';
            // label.style.fontWeight = 'bold';
            // label.style.fontSize = '16px';
            // label.style.whiteSpace = 'nowrap';
            // label.style.background = 'white';
            // label.style.padding = '1px 3px';
            // var labelOverlay = new kakao.maps.CustomOverlay({
            //   position: position,
            //   content: label,
            //   yAnchor: 1.6,
            // });
            // labelOverlay.setMap(map);
          });

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
// 카카오 엔진이 그리고, 탭 이벤트만 postMessage로 받아 기존 네이티브 StationBottomSheet를 연다.
export function KakaoMapWebView({
  stations,
  onSelectStation,
  markerSize = 40,
  initialLevel = 2,
}: KakaoMapWebViewProps) {
  const html = useMemo(
    () => buildHtml(stations, markerSize, initialLevel),
    [stations, markerSize, initialLevel],
  )

  return (
    <View className="flex-1">
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(event) => {
          const message = JSON.parse(event.nativeEvent.data) as
            | StationSelectedMessage
            | { type: 'MAP_READY' | 'MAP_ERROR' | 'SDK_LOAD_ERROR'; payload: unknown }

          if (message.type === 'STATION_SELECTED') {
            onSelectStation(message.payload.stationId)
          } else {
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
