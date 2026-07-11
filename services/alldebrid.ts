import { ADResponse, MagnetsResponse, UnlockResponse } from '../types';

const BASE_URL = 'https://api.alldebrid.com/v4';
const AGENT = 'StreamFlowApp';

export const AlldebridService = {
    /**
     * Verify if the API key is valid by making a lightweight call
     */
    verifyKey: async (apiKey: string): Promise<boolean> => {
        try {
            const params = new URLSearchParams({
                agent: AGENT,
                apikey: apiKey,
            });
            // We use user endpoint or magnet status to check validity
            const response = await fetch(`${BASE_URL}/user?${params.toString()}`);
            const data = await response.json();
            return data.status === 'success';
        } catch (error) {
            return false;
        }
    },

    /**
     * Fetch all magnets from the user's account
     */
    getMagnets: async (apiKey: string): Promise<ADResponse<MagnetsResponse>> => {
        try {
            const params = new URLSearchParams({
                agent: AGENT,
                apikey: apiKey,
            });
            const response = await fetch(`${BASE_URL}/magnet/status?${params.toString()}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Failed to fetch magnets", error);
            throw error;
        }
    },

    /**
     * Unlock a link (Debrid) to get a streamable URL
     */
    unlockLink: async (apiKey: string, link: string): Promise<ADResponse<UnlockResponse>> => {
        try {
            const params = new URLSearchParams({
                agent: AGENT,
                apikey: apiKey,
                link: link,
            });
            const response = await fetch(`${BASE_URL}/link/unlock?${params.toString()}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Failed to unlock link", error);
            throw error;
        }
    },

    /**
     * Restart a magnet (if needed)
     */
    restartMagnet: async (apiKey: string, id: number): Promise<any> => {
        const params = new URLSearchParams({
            agent: AGENT,
            apikey: apiKey,
            id: id.toString(),
        });
        const response = await fetch(`${BASE_URL}/magnet/restart?${params.toString()}`);
        return await response.json();
    },

    /**
     * Delete a magnet
     */
    deleteMagnet: async (apiKey: string, id: number): Promise<any> => {
        const params = new URLSearchParams({
            agent: AGENT,
            apikey: apiKey,
            id: id.toString(),
        });
        const response = await fetch(`${BASE_URL}/magnet/delete?${params.toString()}`);
        return await response.json();
    }
};