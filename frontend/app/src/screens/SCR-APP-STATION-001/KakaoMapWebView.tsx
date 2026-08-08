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

const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY
if (!KAKAO_JS_KEY) {
  throw new Error('EXPO_PUBLIC_KAKAO_JS_KEY is not set')
}

// 0단계(가장 세밀한 레벨, 3x3=9장) 기준 캠퍼스 지도 전체 픽셀 크기(512px 타일 3x3, 2026-08-09
// 3단계 구조로 갱신). Station.x/y(0~1 비율)를 이 픽셀 크기 기준 kakao.maps.Coords로 변환한다.
const WORLD_SIZE = 1536

interface KakaoMapWebViewProps {
  stations: Station[]
  selectedStationId: number | null
  onSelectStation: (id: number) => void
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

function buildHtml(stations: Station[]): string {
  // 마커는 WebView(카카오 엔진) 안에서 직접 렌더링 — RN 쪽 StationMarker는 더 이상 쓰지 않는다
  // (PLAN §4). station.x/y(0~1 비율, 이미지 좌표계 — y=0이 위)를 kakao.maps.Coords로 변환한다.
  // projectionId:null일 때 카카오 좌표계는 left-bottom이 (0,0)이고 y가 위로 갈수록 증가하는
  // 방식이라(2026-08-09 확인, 공식 문서), 이미지 좌표(y=0이 위)를 그대로 못 쓰고 뒤집어야 한다.
  const markerData = stations.map((station) => ({
    id: station.id,
    name: station.name,
    x: station.x * WORLD_SIZE,
    y: (1 - station.y) * WORLD_SIZE,
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
    var WORLD_SIZE = ${WORLD_SIZE};
    var stations = ${JSON.stringify(markerData)};

    // 줌 레벨 z의 한 변 타일 개수 — 카카오 공식 커스텀 타일셋 샘플과 동일한 공식(2026-08-09).
    // z=0(최대 확대) -> 3, z=1 -> 2, z=2(최소 확대/전체 지도) -> 1.
    function limitForZ(z) {
      return Math.ceil(3 / Math.pow(2, z));
    }

    // 카카오 공식 커스텀 타일셋 샘플과 동일하게 y를 뒤집는다(y = -y - 1). left-bottom 원점
    // 좌표계(2026-08-09 문서 확인) 기준으로 타일 배치·이음새 실기기 확인 완료. 정의된 14장
    // 범위를 벗어난 요청만 로그로 남긴다(디버깅용).
    function getTile(origX, origY, z) {
      var x = origX;
      var y = -origY - 1;
      var limit = limitForZ(z);
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

          // 2단계(최소 확대, 전체 지도 1장)로 시작 — 카카오 공식 샘플과 동일하게 전체 개요부터
          // 보여준다(2026-08-09). left-bottom 원점 좌표계라 x/y 모두 양수(2026-08-09 문서 확인).
          var center = new kakao.maps.Coords(WORLD_SIZE / 2, WORLD_SIZE / 2);
          var map = new kakao.maps.Map(document.getElementById('map'), {
            projectionId: null,
            mapTypeId: kakao.maps.MapTypeId.BILLISAN,
            center: center,
            level: 2,
          });
          // 정의된 14장 범위를 벗어나면 옅은 회색 빈 화면이 보일 수 있음을 감수하고, 드래그(팬)를
          // 허용하기로 확정(2026-08-09 사용자 확인).
          map.setDraggable(true);

          stations.forEach(function (station) {
            // station.x/y는 이미 buildHtml에서 left-bottom 원점 기준으로 변환된 값(위 주석 참고).
            var position = new kakao.maps.Coords(station.x, station.y);
            var marker = new kakao.maps.Marker({ position: position, map: map });
            kakao.maps.event.addListener(marker, 'click', function () {
              post('STATION_SELECTED', { stationId: station.id });
            });
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
export function KakaoMapWebView({ stations, onSelectStation }: KakaoMapWebViewProps) {
  const html = useMemo(() => buildHtml(stations), [stations])

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
