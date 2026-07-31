/**
 * 분포도 배경 도식.
 *
 * **지도 SDK 가 아닙니다.** ERD `STATION` 에 위도·경도 컬럼이 없어서 실제 지도에 얹을
 * 좌표가 없습니다(§7.3 이 좌표를 응답 확장 후보로 적어 두었습니다). 그래서 캠퍼스 배치를
 * 도식으로 그리고 마커를 백분율 좌표에 놓습니다. 실제 지도 위에 목업 좌표로 마커를 찍으면
 * 위치가 맞는 것처럼 보이는데, 그 위치는 아무 근거가 없습니다.
 *
 * **좌표계를 마커와 맞춥니다.** `viewBox` 는 `0 0 100 100`, `preserveAspectRatio` 는
 * `none` 입니다. 그래야 SVG 의 `x=20` 과 마커의 `left: 20%` 가 화면에서 같은 자리입니다.
 *
 * 예전에는 `viewBox="306 184 606 562"` 에 `xMidYMid slice` 를 썼습니다. 두 가지가 깨졌습니다.
 *   1. `slice` 는 컨테이너를 덮도록 확대한 뒤 넘치는 부분을 **잘라냅니다.** 가로로 긴
 *      컨테이너(1116x520)에서는 위아래로 257px 씩, 도식의 절반이 잘려 나갔습니다.
 *   2. 마커는 컨테이너 백분율, 배경은 잘리고 남은 viewBox 좌표라 **좌표계가 서로 달랐습니다.**
 *      같은 20% 라도 화면에서 185px 까지 어긋났습니다. 마커가 길 위에 놓인 것처럼 보였다면
 *      우연이었습니다.
 *
 * 늘어남은 도로에서만 티가 납니다. 그래서 도로는 `stroke` 로 긋고
 * `vector-effect="non-scaling-stroke"` 를 겁니다 — 선 굵기가 확대·축소를 따라가지 않아
 * 컨테이너 비율이 어떻든 일정하게 보입니다. 블록은 배경 색면이라 늘어나도 무방합니다.
 *
 * TODO: 좌표 컬럼이 생기면 이 컴포넌트만 지도 SDK 로 갈아 끼우세요. 마커는 백분율 좌표를
 * 쓰므로 `left`·`top` 계산만 바꾸면 됩니다.
 */

/** 도로 격자. 마커가 모인 줄 **사이**를 지나갑니다 (열 16~28 / 46~59 / 79~82, 행 20~38 / 51~56 / 71~86). */
const VERTICAL_ROADS = [36, 70];
const HORIZONTAL_ROADS = [45, 64];

export function MapBackdrop() {
    return (
        <svg
            className="absolute inset-0 size-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
            focusable="false"
        >
            <rect x="0" y="0" width="100" height="100" fill="#EAEDF0" />

            {/* 블록 — 캠퍼스 녹지·건물 덩어리. 색면이라 늘어나도 됩니다. */}
            {/* 녹지 — 정문 광장 쪽 */}
            <rect x="5" y="70" width="27" height="26" rx="5" fill="#DCEEDD" />
            {/* 호수·광장 — 제1공학관 쪽 */}
            <rect x="73" y="6" width="24" height="30" rx="11" fill="#D7E8F7" />
            {/* 건물 덩어리 */}
            <rect x="40" y="6" width="17" height="13" rx="2" fill="#E1E4E8" />
            <rect x="6" y="28" width="19" height="11" rx="2" fill="#E1E4E8" />
            <rect x="74" y="78" width="16" height="15" rx="2" fill="#E1E4E8" />
            <rect x="40" y="68" width="14" height="10" rx="2" fill="#E1E4E8" />
            <rect x="60" y="26" width="8" height="14" rx="2" fill="#E1E4E8" />

            {/*
             * 도로. `non-scaling-stroke` 라 굵기가 화면 픽셀 기준으로 고정됩니다.
             * 이게 없으면 가로로 늘어난 컨테이너에서 세로 도로만 두꺼워집니다.
             */}
            <g
                stroke="#FFFFFF"
                strokeWidth="9"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            >
                {HORIZONTAL_ROADS.map((y) => (
                    <line key={`h-${y}`} x1="-2" y1={y} x2="102" y2={y} />
                ))}
                {VERTICAL_ROADS.map((x) => (
                    <line key={`v-${x}`} x1={x} y1="-2" x2={x} y2="102" />
                ))}
            </g>
        </svg>
    );
}
