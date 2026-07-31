/**
 * 분포도 끌어보기(pan) 계산.
 *
 * 도식 캔버스를 보이는 영역보다 크게 두고 끌어서 봅니다. 캔버스 크기를 고정하면
 * **가로세로비가 화면 폭에 따라 변하지 않아** 배경이 눌리거나 늘어나지 않습니다.
 * 예전에는 컨테이너 비율에 맞춰 배경을 늘였는데, 넓은 화면에서 도로와 블록이 가로로
 * 납작해졌습니다.
 *
 * 계산을 컴포넌트 밖에 두는 이유: 경계값이 눈으로 검산되지 않습니다. 한 칸 어긋나면
 * "끝까지 끌었는데 가장자리에 빈 띠가 남는" 식으로 나타나는데, 손으로 끌어 보며 찾기
 * 어렵습니다.
 */

export interface Size {
    width: number;
    height: number;
}

export interface Offset {
    x: number;
    y: number;
}

/**
 * 한 축의 이동 범위를 구합니다.
 *
 * 캔버스가 보이는 폭보다 **크면** 0(왼쪽 끝)부터 `viewport - canvas`(오른쪽 끝)까지
 * 음수 방향으로 움직입니다. 캔버스가 더 **작으면** 끌 이유가 없으므로 가운데에 고정합니다
 * — 자유롭게 두면 작은 도식이 구석으로 밀려나 화면 밖으로 사라질 수 있습니다.
 */
function clampAxis(value: number, viewport: number, canvas: number): number {
    if (canvas <= viewport) return (viewport - canvas) / 2;
    return Math.min(0, Math.max(viewport - canvas, value));
}

/** 캔버스가 보이는 영역 밖으로 빠져나가지 않도록 이동값을 가둡니다. */
export function clampOffset(offset: Offset, viewport: Size, canvas: Size): Offset {
    return {
        x: clampAxis(offset.x, viewport.width, canvas.width),
        y: clampAxis(offset.y, viewport.height, canvas.height),
    };
}

/** 캔버스 가운데가 보이는 영역 가운데에 오는 이동값. 처음 위치이자 「처음 위치」 버튼의 목표입니다. */
export function centerOffset(viewport: Size, canvas: Size): Offset {
    return clampOffset(
        { x: (viewport.width - canvas.width) / 2, y: (viewport.height - canvas.height) / 2 },
        viewport,
        canvas,
    );
}

/** 이 축을 끌 수 있는가. 끌 수 없으면 커서를 손 모양으로 바꾸지 않습니다. */
export function isPannable(viewport: Size, canvas: Size): boolean {
    return canvas.width > viewport.width || canvas.height > viewport.height;
}

/**
 * 누른 지점에서 이만큼 움직이면 '끌기'로 봅니다 (px).
 *
 * 마커를 누를 때 손이 미세하게 흔들립니다. 그걸 끌기로 처리하면 마커가 눌리지 않고,
 * 반대로 값이 너무 크면 짧게 끈 것이 클릭으로 새어 엉뚱한 대여소가 선택됩니다.
 */
export const DRAG_THRESHOLD_PX = 4;

/** 눌렀다 뗀 거리가 클릭으로 볼 만큼 작은가. */
export function isClick(from: Offset, to: Offset): boolean {
    return Math.hypot(to.x - from.x, to.y - from.y) < DRAG_THRESHOLD_PX;
}
