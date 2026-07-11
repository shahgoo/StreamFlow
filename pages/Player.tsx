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
    const tmdbData = state?.tmdbData;
    const magnetId = state?.magnetId;
    const fileIndex = state?.fileIndex;

    // Redirection si aucun flux
    if (!streamUrl) {
        return (
            <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-6 text-center">
                <Icons.AlertCircle size={64} className="text-red-500 mb-4" />
                <h2 className="text-xl font-bold">Erreur de flux</h2>
                <p className="text-gray-400 mb-6">Aucun lien de streaming n'a été trouvé.</p>
                <button onClick={() => navigate('/')} className="btn-glass px-6 py-2">Retour à l'accueil</button>
            </div>
        );
    }

    // Lien Intent VLC Android (Recommandé)
    const openVlcAndroid = () => {
        const cleanUrl = streamUrl.trim();
        const intentUrl = `intent:${cleanUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=org.videolan.vlc;S.title=${encodeURIComponent(filename)};end`;
        window.location.href = intentUrl;
    };

    // Lien protocole vlc:// universel (pour PC ou Mac avec VLC installé)
    const openVlcUniversal = () => {
        window.location.href = `vlc://${streamUrl.trim()}`;
    };

    // Copie de lien avec support HTTP (Contextes non sécurisés)
    const copyToClipboard = () => {
        try {
            navigator.clipboard.writeText(streamUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = streamUrl;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (e) {
                console.error("Copie manuelle échouée", e);
            }
            document.body.removeChild(textArea);
        }
    };

    const posterUrl = TMDBService.getImageUrl(tmdbData?.backdrop_path || tmdbData?.poster_path, 'w1280');

    return (
        <div className="fixed inset-0 bg-brand-900 z-[100] flex flex-col overflow-hidden animate-fade-in">
            {/* Arrière-plan flouté premium */}
            <div className="absolute inset-0 z-0">
                {posterUrl ? (
                    <img src={posterUrl} className="w-full h-full object-cover opacity-15 blur-2xl scale-110" alt="" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-900 to-black"></div>
                )}
                <div className="absolute inset-0 bg-black/45"></div>
            </div>

            {/* Header */}
            <div className="relative z-10 p-6 flex items-center justify-between">
                <button 
                    onClick={() => navigate(-1)}
                    className="bg-white/5 hover:bg-white/15 text-white backdrop-blur-md p-3.5 rounded-2xl active:scale-95 transition-all shadow-md"
                >
                    <Icons.ChevronLeft size={24} />
                </button>
                <h1 className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    Lancer le Streaming
                </h1>
                <div className="w-12 h-12"></div> {/* Espaceur */}
            </div>

            {/* Contenu principal */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-12 overflow-y-auto">
                <div className="w-full max-w-lg space-y-6">
                    
                    {/* Carte du média */}
                    <div className="bg-brand-800/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl text-center">
                        <div className="w-16 h-16 bg-brand-accent/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Icons.Play size={32} className="text-brand-accent ml-0.5" fill="currentColor" />
                        </div>
                        <h2 className="text-white text-base md:text-lg font-bold mb-1 line-clamp-2 leading-tight">
                            {filename}
                        </h2>
                        <p className="text-text-secondary text-xs">Sélectionnez le mode de lecture pour ce fichier</p>
                    </div>

                    {/* Actions de lecture */}
                    <div className="space-y-3">
                        <button 
                            onClick={openVlcAndroid}
                            className="w-full flex items-center justify-center py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold text-base shadow-xl shadow-orange-950/20 transition-all active:scale-[0.98]"
                        >
                            <Icons.ExternalLink size={20} className="mr-2" />
                            Ouvrir avec VLC (Android)
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button 
                                onClick={openVlcUniversal}
                                className="flex items-center justify-center py-3 bg-brand-800/50 hover:bg-brand-800 text-white rounded-xl font-bold border border-white/5 transition-all active:scale-[0.98] text-xs"
                            >
                                <Icons.Play size={16} className="mr-2" />
                                VLC Universel (vlc://)
                            </button>

                            <button 
                                onClick={copyToClipboard}
                                className={`flex items-center justify-center py-3 rounded-xl font-bold transition-all active:scale-[0.98] border border-white/5 text-xs ${
                                    copied ? 'bg-green-600 text-white' : 'bg-brand-800/50 text-white hover:bg-brand-800'
                                }`}
                            >
                                {copied ? <Icons.CheckCircle size={16} className="mr-2" /> : <Icons.Copy size={16} className="mr-2" />}
                                {copied ? 'Lien copié !' : 'Copier le lien direct'}
                            </button>
                        </div>

                        <a 
                            href={streamUrl} 
                            download
                            className="w-full flex items-center justify-center py-3 bg-brand-800/20 hover:bg-brand-800/40 text-text-secondary rounded-xl font-bold border border-white/5 transition-all active:scale-[0.98] text-xs"
                        >
                            <Icons.Download size={16} className="mr-2" />
                            Télécharger le fichier direct
                        </a>
                    </div>

                    {/* Aide en cas de lecteur manquant */}
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                        <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2.5">
                            Si VLC n'est pas encore installé sur votre appareil :
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-xs font-semibold">
                            <a 
                                href="https://play.google.com/store/apps/details?id=org.videolan.vlc" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-brand-accent hover:underline flex items-center"
                            >
                                <Icons.Download size={12} className="mr-1" /> Google Play Store (Android)
                            </a>
                            <span className="hidden sm:inline text-white/20">|</span>
                            <a 
                                href="https://www.videolan.org/vlc/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-brand-accent hover:underline flex items-center"
                            >
                                <Icons.ExternalLink size={12} className="mr-1" /> Site officiel (Windows / Mac)
                            </a>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};