import { MagnetOverride, EnrichedMagnet } from '../types';
import { parseMagnetName } from './filename';

const OVERRIDES_KEY = 'streamflow_overrides';
const FAVORITES_KEY = 'streamflow_favorites';
const CUSTOM_COLLECTIONS_KEY = 'streamflow_custom_collections';

export interface CustomCollection {
    id: string;
    name: string;
    magnetIds: number[];
    createdAt: number;
}

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
    },

    getFileOverride: (magnetId: number, filename: string) => {
        const override = StorageUtils.getOverride(magnetId);
        return override?.fileOverrides?.[filename];
    },

    saveFileOverride: (magnetId: number, filename: string, customTmdbData: any) => {
        const overrides = StorageUtils.getOverrides();
        const existing = overrides[magnetId] || { id: magnetId };
        const fileOverrides = { ...(existing.fileOverrides || {}) };
        if (customTmdbData) {
            fileOverrides[filename] = customTmdbData;
        } else {
            delete fileOverrides[filename];
        }
        overrides[magnetId] = { ...existing, fileOverrides };
        localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    },

    // FAVORIS
    getFavorites: (): number[] => {
        try {
            return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
        } catch {
            return [];
        }
    },

    isFavorite: (magnetId: number): boolean => {
        const favs = StorageUtils.getFavorites();
        return favs.includes(magnetId);
    },

    toggleFavorite: (magnetId: number): boolean => {
        const favs = StorageUtils.getFavorites();
        const index = favs.indexOf(magnetId);
        let isFav = false;
        if (index > -1) {
            favs.splice(index, 1);
            isFav = false;
        } else {
            favs.push(magnetId);
            isFav = true;
        }
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
        return isFav;
    },

    // COLLECTIONS SUR MESURE
    getCustomCollections: (): CustomCollection[] => {
        try {
            return JSON.parse(localStorage.getItem(CUSTOM_COLLECTIONS_KEY) || '[]');
        } catch {
            return [];
        }
    },

    saveCustomCollection: (collection: CustomCollection): CustomCollection[] => {
        const collections = StorageUtils.getCustomCollections();
        const existingIdx = collections.findIndex(c => c.id === collection.id);
        if (existingIdx > -1) {
            collections[existingIdx] = collection;
        } else {
            collections.push(collection);
        }
        localStorage.setItem(CUSTOM_COLLECTIONS_KEY, JSON.stringify(collections));
        return collections;
    },

    deleteCustomCollection: (collectionId: string): CustomCollection[] => {
        const collections = StorageUtils.getCustomCollections().filter(c => c.id !== collectionId);
        localStorage.setItem(CUSTOM_COLLECTIONS_KEY, JSON.stringify(collections));
        return collections;
    },

    // Proposition intelligente de fichiers similaires d'après le 1er élément de la collection
    suggestRelatedMagnets: (firstMagnet: EnrichedMagnet, allMagnets: EnrichedMagnet[]): EnrichedMagnet[] => {
        if (!firstMagnet) return [];
        const parsedFirst = parseMagnetName(firstMagnet.filename);
        const titleFirst = (firstMagnet.tmdbData?.title || firstMagnet.tmdbData?.name || parsedFirst.title || '').toLowerCase();
        
        // Mots-clés pertinents (mots > 2 lettres, excluant les stop words)
        const stopWords = new Set(['the', 'and', 'les', 'des', 'une', 'un', 'le', 'la', 'du', 'collection', 'pack', 'trilogy', 'saga']);
        const keywords = titleFirst
            .replace(/[^\w\s]/gi, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));

        if (keywords.length === 0) return [];

        return allMagnets.filter(m => {
            if (m.id === firstMagnet.id) return false;
            const parsedOther = parseMagnetName(m.filename);
            const titleOther = (m.tmdbData?.title || m.tmdbData?.name || parsedOther.title || m.filename).toLowerCase();
            return keywords.some(kw => titleOther.includes(kw));
        });
    }
};