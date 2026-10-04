import type { Station } from '@/features/stations/types';

/** Fictitious example. Replace with your own authorized station or a list API. */
export interface StationSeedEntry {
    stationId: string;
    name: string;
    position: Station['position'];
}

export const REAL_STATIONS: StationSeedEntry[] = [
    {
        stationId: '00000000-0000-4000-8000-000000000101',
        name: 'Example station',
        position: { x: 20.1, y: 86.0 },
    },
];
