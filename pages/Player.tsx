import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icon';
import { TMDBService } from '../services/tmdb';

export const Player: React.FC = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    
    const streamUrl = state?.streamUrl;
    const filename = state?.filename || 'Vidéo';
    const tmdbData = state?.tmdbData; // Optionnel: pour afficher l'affiche en fond

    if (!streamUrl) {
        return (
            <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-6 text-center">
                <Icons.AlertCircle size={64} className="text-red-500 mb-4" />
                <h2 className="text-xl font-bold">Erreur de flux</h2>
                <p className="text-gray-400 mb-6">Aucun lien de streaming n'a été trouvé.</p>
                <button onClick={() => navigate(-1)} className="px-6 py-2 bg-brand-800 rounded-lg">Retour</button>
            </div>
        );
    }

    // Android Intent (Recommandé pour VLC Android)
    const openVlcAndroid = () => {
        const cleanUrl = streamUrl.trim();
        const intentUrl = `intent:${cleanUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=org.videolan.vlc;S.title=${encodeURIComponent(filename)};end`;
        window.location.href = intentUrl;
    };

    // Protocole VLC universel
    const openVlcUniversal = () => {
        window.location.href = `vlc://${streamUrl.trim()}`;
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(streamUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    const posterUrl = TMDBService.getImageUrl(tmdbData?.backdrop_path || tmdbData?.poster_path);

    return (
        <div className="fixed inset-0 bg-brand-900 z-[100] flex flex-col overflow-hidden">
            {/* Background avec Poster flouté */}
            <div className="absolute inset-0 z-0">
                {posterUrl ? (
                    <img src={posterUrl} className="w-full h-full object-cover opacity-20 blur-xl scale-110" alt="" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-900 to-black"></div>
                )}
                <div className="absolute inset-0 bg-black/40"></div>
            </div>

            {/* Header */}
            <div className="relative z-10 p-6 flex items-center">
                <button 
                    onClick={() => navigate(-1)}
                    className="bg-white/10 p-3 rounded-full hover:bg-white/20 text-white backdrop-blur-md transition-all active:scale-90"
                >
                    <Icons.ChevronLeft size={28} />
                </button>
                <h1 className="ml-4 text-gray-400 font-medium truncate uppercase tracking-widest text-xs">
                    Prêt à diffuser
                </h1>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-12">
                <div className="w-full max-w-lg">
                    {/* Visual Card */}
                    <div className="bg-brand-800/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl mb-8 text-center">
                        <div className="w-20 h-20 bg-brand-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Icons.Play size={40} className="text-brand-accent ml-1" fill="currentColor" />
                        </div>
                        <h2 className="text-white text-xl md:text-2xl font-bold mb-2 line-clamp-3 leading-tight">
                            {filename}
                        </h2>
                        <p className="text-gray-400 text-sm">Choisissez votre mode de lecture</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-4">
                        <button 
                            onClick={openVlcAndroid}
                            className="w-full flex items-center justify-center py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-orange-900/20 transition-all active:scale-[0.98]"
                        >
                            <Icons.ExternalLink size={24} className="mr-3" />
                            Ouvrir avec VLC
                        </button>

                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={copyToClipboard}
                                className={`flex items-center justify-center py-4 rounded-2xl font-bold transition-all active:scale-[0.98] border border-white/10 ${
                                    copied ? 'bg-green-600 text-white' : 'bg-brand-800/60 text-gray-300 hover:bg-brand-700'
                                }`}
                            >
                                {copied ? <Icons.Check size={20} className="mr-2" /> : <Icons.Copy size={20} className="mr-2" />}
                                {copied ? 'Copié !' : 'Copier lien'}
                            </button>

                            <a 
                                href={streamUrl} 
                                download
                                className="flex items-center justify-center py-4 bg-brand-800/60 hover:bg-brand-700 text-gray-300 rounded-2xl font-bold border border-white/10 transition-all active:scale-[0.98]"
                            >
                                <Icons.Download size={20} className="mr-2" />
                                Télécharger
                            </a>
                        </div>
                    </div>

                    {/* Secondary Options */}
                    <button 
                        onClick={openVlcUniversal}
                        className="w-full mt-8 py-3 text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
                    >
                        Problème ? Essayer le mode universel (vlc://)
                    </button>
                </div>
            </div>
        </div>
    );
};