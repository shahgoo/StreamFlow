import { TMDBResult } from './services/tmdb';

export interface ADResponse<T> {
    status: 'success' | 'error';
    data: T;
    error?: {
        code: string;
        message: string;
    };
}

export interface Magnet {
    id: number;
    filename: string;
    size: number;
    hash: string;
    status: 'Ready' | 'Downloading' | 'Error' | 'Uploaded';
    statusCode: number;
    downloaded: number;
    uploaded: number;
    seeders: number;
    downloadSpeed: number;
    uploadSpeed: number;
    uploadDate: number;
    completionDate: number;
    links: {
        filename: string;
        link: string;
    }[];
}

export interface MagnetsResponse {
    magnets: Magnet[];
}

export interface SavedLink {
    link: string;
    filename: string;
    size: number;
    date: number;
    host: string;
}

export interface SavedLinksResponse {
    links: SavedLink[];
}

export interface UnlockResponse {
    link: string;
    host: string;
    filename: string;
    streaming: boolean;
    id: string;
}

export interface UserConfig {
    apiKey: string;
}

export enum ViewMode {
    GRID = 'GRID',
    LIST = 'LIST'
}

export interface MagnetOverride {
    id: number;
    type?: 'movie' | 'tv';
    tmdbId?: number;
    customTmdbData?: TMDBResult;
    kidsFriendlyOverride?: boolean;
}