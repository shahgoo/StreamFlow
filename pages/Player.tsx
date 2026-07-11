import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icon';
import { VideoPlayer } from '../components/VideoPlayer';
import { WatchHistoryService } from '../services/watchHistory';

export const Player: React.FC = () => {
    const { state } = useLocation();
    const navigate = useNavigate();

    const streamUrl = state?.streamUrl;
    const filename = state?.filename || 'Vidéo';
    const tmdbData = state?.tmdbData;
    const magnetId = state?.magnetId;
    const fileIndex = state?.fileIndex;
    const initialTime = state?.initialTime || 0;

    // Redirection si les paramètres requis sont absents
    if (!streamUrl || magnetId === undefined || fileIndex === undefined) {
        return (
            <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-6 text-center">
                <Icons.AlertCircle size={64} className="text-red-500 mb-4" />
                <h2 className="text-xl font-bold">Erreur de flux</h2>
                <p className="text-gray-400 mb-6">Aucun lien de streaming n'a été trouvé.</p>
                <button onClick={() => navigate('/')} className="btn-glass px-6 py-2">Retour à l'accueil</button>
            </div>
        );
    }

    const handleProgressUpdate = (currentTime: number, duration: number) => {
        // Enregistrer la progression dans l'historique (local + cloud)
        WatchHistoryService.saveProgress(
            magnetId,
            fileIndex,
            filename,
            currentTime,
            duration,
            tmdbData
        );
    };

    const handleClose = () => {
        // Retourne à la fiche descriptive du média
        navigate(-1);
    };

    return (
        <VideoPlayer
            streamUrl={streamUrl}
            filename={filename}
            magnetId={magnetId}
            fileIndex={fileIndex}
            initialTime={initialTime}
            onClose={handleClose}
            onProgressUpdate={handleProgressUpdate}
        />
    );
};