import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 표 열 너비 합계 검사.
 *
 * `DataTable` 은 `table-fixed` 라 `<Th>` 에 적은 폭이 **그대로** 열 너비가 됩니다.
 * 합이 100% 가 아니면 남는 폭을 브라우저가 알아서 나눠 주고, 열 사이가 이유 없이
 * 벌어지거나 한 열만 뭉갭니다.
 *
 * **표 5개 중 3개가 어긋나 있었습니다** — 대여소 관리 80%, 검수 목록 97%, 슬롯 표 93.13%.
 * 시안에서 폭을 하나씩 재다 나온 소수점(`8.16%`·`26.9%`·`11.07%`)이라 아무도 합을 세지
 * 않았고, 열을 빼거나 더할 때마다 조금씩 더 벌어졌습니다.
 *
 * 눈으로는 "좀 이상한데" 정도로만 보이고 원인을 짚기 어려운 종류라, 숫자로 잡습니다.
 * 렌더링까지 돌리지 않고 소스를 읽습니다 — 확인할 게 문자열 상수뿐이라 그걸로 충분합니다.
 */

const TABLES = [
    'features/inspections/pages/InspectionListPage.tsx',
    'features/map/components/DistributionList.tsx',
    'features/stations/components/SlotTable.tsx',
    'features/stations/components/StationTable.tsx',
    'features/stations/pages/SlotDetailPage.tsx',
];

/**
 * `import.meta.url` 을 쓰지 않습니다 — jsdom 환경에서는 `file:` 스킴이 아니라
 * `fileURLToPath` 가 던집니다. vitest 는 프로젝트 루트에서 도니 거기서 잡습니다.
 */
const SRC = resolve(process.cwd(), 'src');

/** `<THead>…</THead>` 안의 `w-[12.5%]` 들을 모읍니다. */
function headerWidths(source: string): number[][] {
    return [...source.matchAll(/<THead>(.*?)<\/THead>/gs)].map((match) =>
        [...match[1].matchAll(/w-\[([\d.]+)%\]/g)].map((w) => Number(w[1])),
    );
}

describe('표 열 너비', () => {
    it.each(TABLES)('%s 의 열 너비 합이 100%% 다', (relative) => {
        const groups = headerWidths(readFileSync(resolve(SRC, relative), 'utf8')).filter(
            (widths) => widths.length > 0,
        );

        expect(groups.length, `${relative}: 폭이 지정된 THead 를 못 찾았습니다`).toBeGreaterThan(0);

        for (const widths of groups) {
            const total = widths.reduce((sum, width) => sum + width, 0);
            expect(Number(total.toFixed(2)), `${relative} 열 폭 ${widths.join(' + ')}`).toBe(100);
        }
    });
});
