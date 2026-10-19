import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { EXTRA_STATIONS } from '@/features/stations/mocks/extraStations';
import { buildSlots } from '@/features/stations/mocks/slots';
import { listStations } from '@/features/stations/mocks/stations';

/**
 * 가상 대여소가 **개발 서버 밖으로 나가지 않는지** 지킵니다.
 *
 * 이 여덟 곳은 서버에 없습니다. 관리자 화면에 뜨면 관리자가 없는 대여소로 현장을 가거나
 * 재고를 잘못 보고합니다. `VITE_USE_MOCK_DATA` 는 사람이 켜고 끄는 스위치라 실수로 켠 채
 * 배포될 수 있어서, `import.meta.env.DEV` 로 한 겹 더 잠갔습니다.
 *
 * 여기서는 그 잠금이 **실제 빌드 산출물에서 작동하는지**를 봅니다. 소스에 `DEV` 조건이
 * 적혀 있는지만 확인하면 "적혀는 있는데 트리셰이킹이 안 돼 이름은 남아 있는" 경우를
 * 놓칩니다. 그래서 번들 파일을 직접 읽습니다.
 */

const WEB_ROOT = process.cwd();
const DIST_ASSETS = resolve(WEB_ROOT, 'dist/assets');

describe('가상 대여소 (목업 전용)', () => {
    it('개발 모드에서는 8곳이 있고 시드 대여소와 합쳐 여러 곳이 된다', () => {
        expect(EXTRA_STATIONS).toHaveLength(8);

        const stations = listStations();
        expect(stations.length).toBeGreaterThan(1);
        // 대여소가 하나뿐이면 목록·지도·집계 레이아웃을 개발 중에 확인할 수 없습니다.
        expect(new Set(stations.map((s) => s.stationId)).size).toBe(stations.length);
    });

    it('모든 가상 대여소가 슬롯을 갖는다', () => {
        for (const station of EXTRA_STATIONS) {
            const slots = buildSlots(station);
            // 슬롯이 비면 목록에는 보이는데 눌러 들어가면 빈 화면입니다.
            expect(slots.length, `${station.name} 의 슬롯이 비었습니다`).toBe(station.slotCount);
            expect(new Set(slots.map((s) => s.slotId)).size).toBe(slots.length);
        }
    });

    it('배포 빌드 산출물에는 가상 대여소 이름이 없다', () => {
        /*
         * `dist/` 가 없으면 빌드해서 만듭니다. CI 나 갓 클론한 작업 트리를 위해서입니다.
         * 이미 있으면 그대로 읽습니다 — 이 테스트 하나 때문에 매번 빌드하면 느립니다.
         */
        if (!existsSync(DIST_ASSETS)) {
            // Vitest 가 NODE_ENV=test 를 물려주면 개발 모드로 빌드되므로 배포 모드를 명시합니다.
            execFileSync('npm', ['run', 'build'], {
                cwd: WEB_ROOT,
                stdio: 'ignore',
                shell: true,
                env: { ...process.env, NODE_ENV: 'production' },
            });
        }

        const bundles = readdirSync(DIST_ASSETS).filter((f) => f.endsWith('.js'));
        expect(bundles.length, 'dist/assets 에 js 번들이 없습니다').toBeGreaterThan(0);

        const source = bundles
            .map((f) => readFileSync(resolve(DIST_ASSETS, f), 'utf8'))
            .join('\n');

        for (const station of EXTRA_STATIONS) {
            expect(
                source.includes(station.name),
                `배포 번들에 「${station.name}」 이 들어 있습니다. ` +
                    'import.meta.env.DEV 잠금이 풀렸거나 트리셰이킹이 깨졌습니다.',
            ).toBe(false);
        }
    }, 180_000);
});
