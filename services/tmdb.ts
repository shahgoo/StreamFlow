const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export interface TMDBResult {
    id: number;
    title?: string;
    name?: string; // Pour les séries (TV)
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    overview?: string;
    vote_average?: number;
    genres?: { id: number; name: string }[];
    runtime?: number; // Pour les films
    episode_run_time?: number[]; // Pour les séries
    number_of_seasons?: number;
    number_of_episodes?: number;
    credits?: {
        cast: {
            id: number;
            name: string;
            character: string;
            profile_path: string | null;
        }[];
    };
    videos?: {
        results: {
            id: string;
            key: string;
            name: string;
            site: string;
            type: string;
        }[];
    };
    genre_ids?: number[];
    seasons?: {
        id: number;
        name: string;
        season_number: number;
        episode_count: number;
        poster_path?: string | null;
        overview?: string;
        air_date?: string;
    }[];
}

export interface TMDBEpisode {
    id: number;
    name: string;
    overview?: string;
    still_path?: string | null;
    episode_number: number;
    season_number: number;
    air_date?: string;
    runtime?: number;
    vote_average?: number;
}

export interface TMDBSeason {
    id: number;
    name: string;
    overview?: string;
    poster_path?: string | null;
    season_number: number;
    air_date?: string;
    episodes: TMDBEpisode[];
}

export const TMDBService = {
    /**
     * Vérifier si la clé API est valide
     */
    verifyKey: async (apiKey: string): Promise<boolean> => {
        try {
            const response = await fetch(`${BASE_URL}/configuration?api_key=${apiKey}`);
            return response.ok;
        } catch (error) {
            return false;
        }
    },

    /**
     * Recherche d'un seul résultat (le meilleur match)
     */
    search: async (apiKey: string, query: string, type: 'movie' | 'tv', year?: string): Promise<TMDBResult | null> => {
        const results = await TMDBService.searchCandidates(apiKey, query, type, year);
        return results.length > 0 ? results[0] : null;
    },

    /**
     * Recherche de candidats (liste complète)
     */
    searchCandidates: async (apiKey: string, query: string, type: 'movie' | 'tv', year?: string): Promise<TMDBResult[]> => {
        try {
            const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';
            const params = new URLSearchParams({
                api_key: apiKey,
                query: query,
                language: 'fr-FR',
                page: '1',
                include_adult: 'false'
            });

            if (year) {
                if (type === 'movie') params.append('year', year);
                if (type === 'tv') params.append('first_air_date_year', year);
            }

            const res = await fetch(`${BASE_URL}/${endpoint}?${params.toString()}`);
            const data = await res.json();

            if (data.results) {
                return data.results;
            }
            return [];
        } catch (error) {
            console.error("Erreur de recherche TMDB", error);
            return [];
        }
    },

    /**
     * Récupérer les détails d'un film (genres, casting, vidéos...)
     */
    getMovieDetails: async (apiKey: string, id: number): Promise<TMDBResult | null> => {
        try {
            const params = new URLSearchParams({
                api_key: apiKey,
                language: 'fr-FR',
                append_to_response: 'credits,videos'
            });
            const res = await fetch(`${BASE_URL}/movie/${id}?${params.toString()}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (error) {
            console.error("Erreur lors de la récupération des détails du film :", error);
            return null;
        }
    },

    /**
     * Récupérer les détails d'une série (genres, casting, saisons...)
     */
    getTVDetails: async (apiKey: string, id: number): Promise<TMDBResult | null> => {
        try {
            const params = new URLSearchParams({
                api_key: apiKey,
                language: 'fr-FR',
                append_to_response: 'credits,videos'
            });
            const res = await fetch(`${BASE_URL}/tv/${id}?${params.toString()}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (error) {
            console.error("Erreur lors de la récupération des détails de la série :", error);
            return null;
        }
    },

    /**
     * Récupérer les films/séries similaires
     */
    getSimilar: async (apiKey: string, id: number, type: 'movie' | 'tv'): Promise<TMDBResult[]> => {
        try {
            const params = new URLSearchParams({
                api_key: apiKey,
                language: 'fr-FR',
                page: '1'
            });
            const endpoint = type === 'movie' ? `movie/${id}/similar` : `tv/${id}/similar`;
            const res = await fetch(`${BASE_URL}/${endpoint}?${params.toString()}`);
            const data = await res.json();
            return data.results || [];
        } catch (error) {
            console.error("Erreur lors de la récupération des similaires TMDB :", error);
            return [];
        }
    },

    /**
     * Récupérer les détails d'une saison (liste d'épisodes avec images et synopsis)
     */
    getSeasonDetails: async (apiKey: string, tvId: number, seasonNumber: number): Promise<TMDBSeason | null> => {
        try {
            const params = new URLSearchParams({
                api_key: apiKey,
                language: 'fr-FR'
            });
            const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?${params.toString()}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (error) {
            console.error(`Erreur lors de la récupération de la saison ${seasonNumber} :`, error);
            return null;
        }
    },

    /**
     * Génère l'URL de l'image avec une taille spécifique
     */
    getImageUrl: (path: string | null | undefined, size: 'w200' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500') => {
        if (!path) return null;
        return `${IMAGE_BASE_URL}/${size}${path}`;
    }
};