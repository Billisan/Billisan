import { describe, expect, it } from 'vitest';

import { centerOffset, clampOffset, isClick, isPannable } from '@/features/map/lib/pan';

/**
 * 끌어보기 경계.
 *
 * 한 칸 어긋나면 "끝까지 끌었는데 가장자리에 빈 띠가 남는" 식으로 나타납니다. 손으로
 * 끌어 보며 찾기 어려운 종류라 경계값을 여기서 못 박습니다.
 */

const VIEWPORT = { width: 1000, height: 520 };
const CANVAS = { width: 1240, height: 860 };

describe('clampOffset', () => {
    it('왼쪽·위 끝을 넘지 않는다', () => {
        // 0 보다 크면 캔버스 왼쪽/위에 빈 자리가 생깁니다.
        expect(clampOffset({ x: 50, y: 80 }, VIEWPORT, CANVAS)).toEqual({ x: 0, y: 0 });
    });

    it('오른쪽·아래 끝을 넘지 않는다', () => {
        expect(clampOffset({ x: -9999, y: -9999 }, VIEWPORT, CANVAS)).toEqual({
            x: 1000 - 1240, // -240
            y: 520 - 860, // -340
        });
    });

    it('범위 안의 값은 그대로 둔다', () => {
        expect(clampOffset({ x: -120, y: -200 }, VIEWPORT, CANVAS)).toEqual({ x: -120, y: -200 });
    });

    /** 작은 도식을 자유롭게 끌게 두면 구석으로 밀려나 화면 밖으로 사라집니다. */
    it('캔버스가 보이는 영역보다 작으면 가운데 고정', () => {
        const small = { width: 400, height: 300 };
        expect(clampOffset({ x: -500, y: 900 }, VIEWPORT, small)).toEqual({ x: 300, y: 110 });
    });

    it('딱 맞으면 이동값이 0이다', () => {
        expect(clampOffset({ x: -50, y: 50 }, VIEWPORT, VIEWPORT)).toEqual({ x: 0, y: 0 });
    });
});

describe('centerOffset', () => {
    it('캔버스 가운데가 화면 가운데에 온다', () => {
        expect(centerOffset(VIEWPORT, CANVAS)).toEqual({ x: -120, y: -170 });
    });

    it('가운데 값도 경계를 넘지 않는다', () => {
        // 한 축만 큰 경우: 작은 축은 가운데 고정, 큰 축만 이동합니다.
        expect(centerOffset(VIEWPORT, { width: 600, height: 860 })).toEqual({ x: 200, y: -170 });
    });
});

describe('isPannable', () => {
    it.each([
        ['둘 다 크면', { width: 1240, height: 860 }, true],
        ['가로만 크면', { width: 1240, height: 400 }, true],
        ['세로만 크면', { width: 600, height: 860 }, true],
        ['둘 다 작으면', { width: 600, height: 400 }, false],
        ['딱 맞으면', VIEWPORT, false],
    ])('%s → %s', (_label, canvas, expected) => {
        expect(isPannable(VIEWPORT, canvas)).toBe(expected);
    });
});

describe('isClick', () => {
    /** 마커를 누를 때 손이 미세하게 흔들립니다. 그걸 끌기로 처리하면 마커가 안 눌립니다. */
    it('거의 안 움직였으면 클릭이다', () => {
        expect(isClick({ x: 100, y: 100 }, { x: 101, y: 102 })).toBe(true);
        expect(isClick({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(true);
    });

    it('충분히 움직였으면 끌기다', () => {
        expect(isClick({ x: 100, y: 100 }, { x: 140, y: 100 })).toBe(false);
        expect(isClick({ x: 100, y: 100 }, { x: 100, y: 105 })).toBe(false);
    });

    it('대각선 이동도 거리로 잰다', () => {
        // 각 축은 3px 뿐이지만 실제 이동은 4.24px 라 끌기입니다.
        expect(isClick({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(false);
    });
});
