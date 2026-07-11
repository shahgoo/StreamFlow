import { FirebaseService } from './firebase';

export interface WatchProgress {
    magnetId: number;
    fileIndex: number;
    filename: string;
    currentTime: number;
    duration: number;
    percentage: number;
    updatedAt: number;
    tmdbData?: any;
}

const HISTORY_KEY = 'streamflow_watch_history';

export const WatchHistoryService = {
    /**
     * Récupère tout l'historique de lecture (local)
     */
    getLocalHistory: (): Record<string, WatchProgress> => {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
        } catch {
            return {};
        }
    },

    /**
     * Récupère la progression d'un fichier spécifique
     */
    getProgress: (magnetId: number, fileIndex: number): WatchProgress | null => {
        const history = WatchHistoryService.getLocalHistory();
        const key = `${magnetId}_${fileIndex}`;
        return history[key] || null;
    },

    /**
     * Enregistre la progression de lecture d'un fichier
     */
    saveProgress: async (
        magnetId: number,
        fileIndex: number,
        filename: string,
        currentTime: number,
        duration: number,
        tmdbData?: any
    ): Promise<void> => {
        if (duration <= 0) return;

        const percentage = Math.min((currentTime / duration) * 100, 100);
        const key = `${magnetId}_${fileIndex}`;
        
        const progress: WatchProgress = {
            magnetId,
            fileIndex,
            filename,
            currentTime,
            duration,
            percentage,
            updatedAt: Date.now(),
            tmdbData
        };

        // 1. Sauvegarde Locale
        const history = WatchHistoryService.getLocalHistory();
        
        // Si la lecture est complétée à plus de 95%, on peut la retirer de la file "Reprendre"
        if (percentage >= 95) {
            delete history[key];
        } else {
            history[key] = progress;
        }
        
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

        // 2. Sauvegarde Cloud Firestore (si connecté)
        try {
            if (percentage >= 95) {
                await FirebaseService.deleteDoc('history', key);
            } else {
                await FirebaseService.saveDoc('history', key, progress);
            }
        } catch (e) {
            console.error("Erreur de sauvegarde de l'historique sur Firebase:", e);
        }
    },

    /**
     * Récupère les sessions actives de lecture pour la page d'accueil (ordonnées par date décroissante)
     */
    getContinueWatchingList: async (firebaseConnected: boolean): Promise<WatchProgress[]> => {
        let history: Record<string, WatchProgress> = {};

        // Si Firebase est connecté, on synchronise d'abord les données
        if (firebaseConnected) {
            try {
                const cloudItems = await FirebaseService.getCollection('history');
                const localHistory = WatchHistoryService.getLocalHistory();
                
                cloudItems.forEach((item) => {
                    const key = `${item.magnetId}_${item.fileIndex}`;
                    // On prend la version la plus récente
                    if (!localHistory[key] || item.updatedAt > localHistory[key].updatedAt) {
                        localHistory[key] = item;
                    }
                });

                // On sauvegarde le résultat fusionné localement
                localStorage.setItem(HISTORY_KEY, JSON.stringify(localHistory));
                history = localHistory;
            } catch (e) {
                console.error("Erreur lors de la récupération cloud de l'historique :", e);
                history = WatchHistoryService.getLocalHistory();
            }
        } else {
            history = WatchHistoryService.getLocalHistory();
        }

        // On retourne la liste filtrée (moins de 95% lus) et triée du plus récent au plus ancien
        return Object.values(history)
            .filter((p) => p.percentage < 95 && p.percentage > 1) // Évite les lectures infimes de <1%
            .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    /**
     * Supprime une entrée de l'historique
     */
    deleteEntry: async (magnetId: number, fileIndex: number): Promise<void> => {
        const key = `${magnetId}_${fileIndex}`;
        
        const history = WatchHistoryService.getLocalHistory();
        delete history[key];
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

        try {
            await FirebaseService.deleteDoc('history', key);
        } catch (e) {
            console.error("Erreur de suppression cloud de l'historique:", e);
        }
    }
};
