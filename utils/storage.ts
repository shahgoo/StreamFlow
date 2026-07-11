import { MagnetOverride } from '../types';

const OVERRIDES_KEY = 'streamflow_overrides';

export const StorageUtils = {
    getOverrides: (): Record<number, MagnetOverride> => {
        try {
            return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}');
        } catch {
            return {};
        }
    },

    getOverride: (magnetId: number): MagnetOverride | undefined => {
        const overrides = StorageUtils.getOverrides();
        return overrides[magnetId];
    },

    saveOverride: (override: MagnetOverride) => {
        const overrides = StorageUtils.getOverrides();
        overrides[override.id] = { ...overrides[override.id], ...override };
        localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    },

    removeOverride: (magnetId: number) => {
        const overrides = StorageUtils.getOverrides();
        delete overrides[magnetId];
        localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    }
};