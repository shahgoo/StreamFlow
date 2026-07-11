
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export interface TMDBResult {
    id: number;
    title?: string;
    name?: string; // For TV
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    overview?: string;
}

export const TMDBService = {
    verifyKey: async (apiKey: string): Promise<boolean> => {
        try {
            // Fetch configuration to test key
            const response = await fetch(`${BASE_URL}/configuration?api_key=${apiKey}`);
            return response.ok;
        } catch (error) {
            return false;
        }
    },

    // Returns the single best match (for auto-detection)
    search: async (apiKey: string, query: string, type: 'movie' | 'tv', year?: string): Promise<TMDBResult | null> => {
        const results = await TMDBService.searchCandidates(apiKey, query, type, year);
        return results.length > 0 ? results[0] : null;
    },

    // Returns a list of candidates (for manual selection)
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
            console.error("TMDB Search Error", error);
            return [];
        }
    },

    getImageUrl: (path: string | null | undefined) => {
        if (!path) return null;
        return `${IMAGE_BASE_URL}${path}`;
    }
};