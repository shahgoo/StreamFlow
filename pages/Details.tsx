import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Magnet } from '../types';
import { Icons } from '../components/Icon';
import { AlldebridService } from '../services/alldebrid';
import { TMDBService, TMDBResult } from '../services/tmdb';
import { StorageUtils } from '../utils/storage';
import { parseMagnetName } from '../utils/filename';

// Extended Magnet type to handle the passed state
interface DetailedMagnet extends Magnet {
    tmdbData?: TMDBResult;
    mediaType?: 'movie' | 'tv';
}

export const Details: React.FC = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [magnet, setMagnet] = useState<DetailedMagnet | null>(state?.magnet || null);
    
    // Playback State
    const [unlocking, setUnlocking] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editType, setEditType] = useState<'movie' | 'tv'>('movie');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedTmdb, setSelectedTmdb] = useState<TMDBResult | null>(null);

    useEffect(() => {
        if (!magnet) return;
        // Initialize edit state
        const parsed = parseMagnetName(magnet.filename);
        const override = StorageUtils.getOverride(magnet.id);
        
        setEditType(override?.type || magnet.mediaType || parsed.type);
        setSearchQuery(parsed.title);
        
        if (override?.customTmdbData) {
             setMagnet(prev => prev ? ({...prev, tmdbData: override.customTmdbData}) : null);
        }
    }, [magnet?.id]);

    if (!magnet) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-brand-900">
                <Icons.AlertCircle size={48} className="text-red-500 mb-4" />
                <p className="text-white mb-6">Erreur: Contenu non trouvé.</p>
                <button onClick={() => navigate('/')} className="bg-brand-800 px-6 py-2 rounded-lg text-white">
                    Retour à la bibliothèque
                </button>
            </div>
        );
    }

    const handlePlay = async (linkObj: { filename: string, link: string }) => {
        const apiKey = localStorage.getItem('ad_apikey');
        if (!apiKey) return;

        setUnlocking(linkObj.link);
        setError(null);

        try {
            const response = await AlldebridService.unlockLink(apiKey, linkObj.link);
            if (response.status === 'success') {
                navigate('/player', { 
                    state: { 
                        streamUrl: response.data.link, 
                        filename: linkObj.filename,
                        tmdbData: magnet.tmdbData // On passe les infos TMDB pour le fond d'écran du lanceur
                    } 
                });
            } else {
                setError("Impossible de débrider ce lien: " + (response.error?.message || "Erreur"));
            }
        } catch (e) {
            setError("Erreur réseau lors du débridage.");
        } finally {
            setUnlocking(null);
        }
    };

    const handleSearchTMDB = async () => {
        const tmdbKey = localStorage.getItem('tmdb_apikey');
        if (!tmdbKey) {
            setError("Clé API TMDB requise pour la recherche");
            return;
        }

        setIsSearching(true);
        const results = await TMDBService.searchCandidates(tmdbKey, searchQuery, editType);
        setSearchResults(results);
        setIsSearching(false);
    };

    const handleSaveMetadata = () => {
        StorageUtils.saveOverride({
            id: magnet.id,
            type: editType,
            tmdbId: selectedTmdb?.id,
            customTmdbData: selectedTmdb || undefined
        });

        setMagnet(prev => {
            if (!prev) return null;
            return {
                ...prev,
                mediaType: editType,
                tmdbData: selectedTmdb || prev.tmdbData
            };
        });

        setIsEditModalOpen(false);
    };

    // Filter video files
    const videoExtensions = /\.(mkv|mp4|avi|mov|wmv|m4v|webm|flv|mpg|mpeg|3gp|m2ts|ts|vob)$/i;
    const filesToShow = magnet.links
        .filter(l => videoExtensions.test(l.filename))
        .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));

    const posterUrl = TMDBService.getImageUrl(magnet.tmdbData?.backdrop_path || magnet.tmdbData?.poster_path);

    return (
        <div className="min-h-screen bg-brand-900 pb-24">
             {/* Header Image / Back Button */}
            <div className="relative h-64 md:h-96 w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-brand-900 z-10"></div>
                
                {posterUrl ? (
                    <img 
                        src={posterUrl} 
                        className="absolute inset-0 w-full h-full object-cover opacity-40"
                        alt="Backdrop"
                    />
                ) : (
                     <div className="absolute inset-0 bg-brand-800">
                        <div className="w-full h-full flex items-center justify-center text-brand-900 opacity-20 text-9xl font-bold overflow-hidden select-none">
                            {magnet.filename.substring(0, 1)}
                        </div>
                    </div>
                )}
                
                <button 
                    onClick={() => navigate('/')} // Changé navigate(-1) par '/' pour être plus explicite
                    className="absolute top-6 left-4 z-50 bg-black/40 backdrop-blur-md p-3 rounded-full hover:bg-white/20 transition-all active:scale-90"
                >
                    <Icons.ChevronLeft className="text-white" size={24} />
                </button>

                {/* Edit Button */}
                <button 
                    onClick={() => setIsEditModalOpen(true)}
                    className="absolute top-6 right-4 z-50 bg-black/40 backdrop-blur-md p-3 rounded-full hover:bg-brand-accent hover:text-black text-white transition-all shadow-lg active:scale-90"
                    title="Corriger les informations"
                >
                    <Icons.Settings size={20} />
                </button>

                <div className="absolute bottom-0 left-0 p-6 z-20 w-full">
                    <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg break-words leading-tight">
                        {magnet.tmdbData?.title || magnet.tmdbData?.name || magnet.filename}
                    </h1>
                     {magnet.tmdbData?.overview && (
                        <p className="hidden md:block text-gray-300 max-w-2xl mb-4 line-clamp-2 drop-shadow-md">
                            {magnet.tmdbData.overview}
                        </p>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-300">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${magnet.statusCode === 4 ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-brand-accent/20 border-brand-accent/50 text-brand-accent'}`}>
                            {magnet.status}
                        </span>
                        <span className="uppercase border border-white/20 px-2 py-0.5 rounded text-xs">
                             {magnet.mediaType === 'tv' ? 'Série' : 'Film'}
                        </span>
                        <span>{(magnet.size / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                    </div>
                </div>
            </div>

            <div className="px-4 md:px-8 max-w-5xl mx-auto mt-6">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6 flex items-center animate-pulse">
                        <Icons.AlertCircle className="mr-3" />
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                    <h2 className="text-lg font-semibold text-gray-200">
                        Fichiers Vidéo ({filesToShow.length})
                    </h2>
                </div>

                {filesToShow.length === 0 ? (
                    <div className="text-center py-10 bg-brand-800/30 rounded-lg border border-white/5">
                        <Icons.Film className="mx-auto h-12 w-12 text-gray-600 mb-2" />
                        <p className="text-gray-400">Aucun fichier vidéo détecté dans ce torrent.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filesToShow.map((file, idx) => (
                            <div 
                                key={idx} 
                                className="bg-brand-800/50 hover:bg-brand-800 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between group transition-all"
                            >
                                <div className="flex-1 min-w-0 mr-4 mb-3 sm:mb-0">
                                    <div className="flex items-center">
                                        <Icons.Film size={18} className="text-gray-500 mr-3 flex-shrink-0 group-hover:text-brand-accent transition-colors" />
                                        <p className="text-sm md:text-base font-medium text-gray-200 truncate pr-2" title={file.filename}>
                                            {file.filename}
                                        </p>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => handlePlay(file)}
                                    disabled={unlocking === file.link}
                                    className="flex items-center justify-center bg-white text-black px-6 py-3 rounded-xl text-sm font-bold hover:bg-brand-accent hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/20"
                                >
                                    {unlocking === file.link ? (
                                        <div className="flex items-center">
                                            <Icons.RefreshCw className="animate-spin h-4 w-4 mr-2" />
                                            Chargement...
                                        </div>
                                    ) : (
                                        <>
                                            <Icons.Play size={16} className="mr-2" fill="currentColor" />
                                            Lire
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* EDIT METADATA MODAL */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-brand-800 w-full max-w-lg rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Corriger les infos</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-white">
                                <Icons.XCircle size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {/* Type Selector */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Type de média</label>
                                <div className="flex bg-brand-900 rounded-lg p-1">
                                    <button 
                                        onClick={() => setEditType('movie')}
                                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${editType === 'movie' ? 'bg-brand-accent text-black' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Film
                                    </button>
                                    <button 
                                        onClick={() => setEditType('tv')}
                                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${editType === 'tv' ? 'bg-brand-accent text-black' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Série
                                    </button>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Recherche TMDB</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="flex-1 bg-brand-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-brand-accent outline-none"
                                        placeholder="Titre du film ou série..."
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchTMDB()}
                                    />
                                    <button 
                                        onClick={handleSearchTMDB}
                                        disabled={isSearching}
                                        className="bg-brand-700 hover:bg-brand-600 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                                    >
                                        {isSearching ? <Icons.RefreshCw className="animate-spin" /> : <Icons.Search size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Results */}
                            <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                                {searchResults.map(res => (
                                    <div 
                                        key={res.id}
                                        onClick={() => setSelectedTmdb(res)}
                                        className={`relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedTmdb?.id === res.id ? 'border-brand-accent' : 'border-transparent hover:border-white/30'}`}
                                    >
                                        {res.poster_path ? (
                                            <img 
                                                src={TMDBService.getImageUrl(res.poster_path)!} 
                                                alt={res.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-brand-900 flex items-center justify-center p-2 text-center text-xs text-gray-400">
                                                {res.title || res.name}
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[10px] text-white truncate text-center">
                                            {(res.release_date || res.first_air_date)?.substring(0, 4) || 'N/A'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={handleSaveMetadata}
                                className="px-6 py-2 bg-brand-accent text-black font-bold rounded-lg hover:bg-amber-600 shadow-lg"
                            >
                                Sauvegarder
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};