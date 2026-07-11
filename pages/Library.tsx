import React, { useEffect, useState, useMemo } from 'react';
import { AlldebridService } from '../services/alldebrid';
import { TMDBService, TMDBResult } from '../services/tmdb';
import { Magnet } from '../types';
import { MagnetCard } from '../components/MagnetCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { HeroBanner } from '../components/HeroBanner';
import { Icons } from '../components/Icon';
import { useNavigate } from 'react-router-dom';
import { parseMagnetName } from '../utils/filename';
import { StorageUtils } from '../utils/storage';
import { useApp } from '../contexts/AppContext';
import { WatchHistoryService, WatchProgress } from '../services/watchHistory';

type FilterType = 'all' | 'movie' | 'tv';

export interface EnrichedMagnet extends Magnet {
    mediaType: 'movie' | 'tv';
    tmdbData?: TMDBResult;
    groupedMagnets?: Magnet[];
    showName?: string;
}

export const Library: React.FC = () => {
    const { adApiKey, tmdbApiKey, firebaseUser } = useApp();
    const [magnets, setMagnets] = useState<EnrichedMagnet[]>([]);
    const [continueWatching, setContinueWatching] = useState<WatchProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [metadataLoading, setMetadataLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<FilterType>('movie');
    const navigate = useNavigate();

    // Filtre des fichiers vidéo valides
    const isVideoFile = (filename: string) => {
        return /\.(mkv|mp4|avi|mov|wmv|m4v|webm|flv|mpg|mpeg|3gp|m2ts|ts|vob)$/i.test(filename);
    };

    const loadCache = (): Record<string, TMDBResult> => {
        try {
            return JSON.parse(localStorage.getItem('tmdb_cache') || '{}');
        } catch {
            return {};
        }
    };

    const saveCache = (newCache: Record<string, TMDBResult>) => {
        localStorage.setItem('tmdb_cache', JSON.stringify(newCache));
    };

    const loadContinueWatching = async () => {
        if (adApiKey) {
            const list = await WatchHistoryService.getContinueWatchingList(!!firebaseUser);
            setContinueWatching(list);
        }
    };

    const fetchMagnets = async () => {
        if (!adApiKey) {
            setError("Clé API manquante");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await AlldebridService.getMagnets(adApiKey);
            
            if (response.status === 'success') {
                const rawMagnets = response.data.magnets;
                const overrides = StorageUtils.getOverrides();
                
                // 1. Filtrer pour ne garder que les torrents contenant au moins une vidéo
                const videoMagnets = rawMagnets.filter(m => {
                    if (m.links && m.links.length > 0) {
                        return m.links.some(l => isVideoFile(l.filename));
                    }
                    return true; 
                });

                // 2. Parser le type et grouper par série
                const movieMagnets: EnrichedMagnet[] = [];
                const tvGroups: Record<string, Magnet[]> = {};

                videoMagnets.forEach(m => {
                    const override = overrides[m.id];
                    const mediaType = override?.type || parseMagnetName(m.filename).type;

                    if (mediaType === 'tv') {
                        const parsed = parseMagnetName(m.filename);
                        const key = parsed.showName?.toLowerCase() || parsed.title.toLowerCase();
                        if (!tvGroups[key]) tvGroups[key] = [];
                        tvGroups[key].push(m);
                    } else {
                        movieMagnets.push({
                            ...m,
                            mediaType: 'movie'
                        });
                    }
                });

                // Convertir les groupes TV en items virtuels
                const tvMagnets: EnrichedMagnet[] = Object.entries(tvGroups).map(([showKey, group]) => {
                    // Trier du plus ancien au plus récent (S01 -> S02, etc.)
                    const sortedGroup = [...group].sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));
                    const first = sortedGroup[0];
                    const parsed = parseMagnetName(first.filename);
                    
                    return {
                        ...first,
                        mediaType: 'tv',
                        showName: parsed.showName || parsed.title,
                        groupedMagnets: sortedGroup,
                        // Somme des tailles du groupe
                        size: group.reduce((acc, item) => acc + item.size, 0)
                    };
                });

                const combinedList = [...movieMagnets, ...tvMagnets];
                setMagnets(combinedList);
                setError(null);
                setLoading(false);

                // 3. Charger les métadonnées de manière asynchrone
                if (tmdbApiKey) {
                    enrichWithMetadata(combinedList, tmdbApiKey);
                }

            } else {
                setError(response.error?.message || "Erreur de chargement d'Alldebrid");
                setLoading(false);
            }
        } catch (e) {
            setError("Erreur de connexion réseau");
            setLoading(false);
        }
    };

    const enrichWithMetadata = async (currentItems: EnrichedMagnet[], tmdbKey: string) => {
        setMetadataLoading(true);
        const cache = loadCache();
        const overrides = StorageUtils.getOverrides();
        let cacheUpdated = false;
        const newItems = [...currentItems];

        for (let i = 0; i < newItems.length; i++) {
            const item = newItems[i];
            const override = overrides[item.id];

            // A. Override manuel
            if (override && override.customTmdbData) {
                newItems[i].tmdbData = override.customTmdbData;
                continue; 
            }

            // B. Lecture du cache ou recherche TMDB
            const parsed = parseMagnetName(item.filename);
            const searchTitle = item.mediaType === 'tv' ? (item.showName || parsed.showName || parsed.title) : parsed.title;
            const cacheKey = `${item.mediaType}_${searchTitle}_${parsed.year || ''}`.replace(/\s/g, '').toLowerCase();

            if (cache[cacheKey]) {
                newItems[i].tmdbData = cache[cacheKey];
            } else {
                // Rate limit spacing
                await new Promise(r => setTimeout(r, 150));
                
                // Recherche sur TMDB
                let result = await TMDBService.search(tmdbKey, searchTitle, item.mediaType, parsed.year);
                
                // Essai alternatif sans l'année pour les films
                if (!result && parsed.year && item.mediaType === 'movie') {
                    result = await TMDBService.search(tmdbKey, searchTitle, item.mediaType);
                }

                if (result) {
                    newItems[i].tmdbData = result;
                    cache[cacheKey] = result;
                    cacheUpdated = true;
                    // Mise à jour de l'UI progressive
                    if (i % 2 === 0) setMagnets([...newItems]);
                }
            }
        }

        if (cacheUpdated) {
            saveCache(cache);
        }
        setMagnets(newItems);
        setMetadataLoading(false);
    };

    useEffect(() => {
        fetchMagnets();
    }, [adApiKey, tmdbApiKey]);

    useEffect(() => {
        loadContinueWatching();
    }, [firebaseUser, magnets]);

    const filteredMagnets = useMemo(() => {
        return magnets.filter(m => {
            const parsed = parseMagnetName(m.filename);
            const titleToCheck = m.tmdbData?.title || m.tmdbData?.name || m.showName || parsed.title;
            const matchesSearch = titleToCheck.toLowerCase().includes(searchQuery.toLowerCase()) || m.filename.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesTab = activeTab === 'all' ? true : m.mediaType === activeTab;
            return matchesSearch && matchesTab;
        });
    }, [magnets, searchQuery, activeTab]);

    const handleMagnetClick = (magnet: EnrichedMagnet) => {
        navigate(`/view/${magnet.id}`, { state: { magnet } });
    };

    const handlePlayContinueWatching = (progress: WatchProgress) => {
        navigate('/player', { 
            state: { 
                streamUrl: progress.currentTime.toString(), // Sera débridé dans Player ou Details
                filename: progress.filename,
                tmdbData: progress.tmdbData,
                magnetId: progress.magnetId,
                fileIndex: progress.fileIndex
            } 
        });
    };

    // Écran de clé API manquante
    if (error === "Clé API manquante") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
                <div className="bg-brand-800 p-8 rounded-3xl shadow-xl max-w-sm w-full border border-white/5">
                    <div className="w-16 h-16 rounded-full bg-brand-accent/10 flex items-center justify-center mx-auto mb-4">
                        <Icons.Settings className="w-8 h-8 text-brand-accent animate-spin-slow" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Configuration requise</h2>
                    <p className="text-text-secondary mb-6 text-sm">Veuillez entrer votre clé API Alldebrid dans les paramètres pour commencer.</p>
                    <button 
                        onClick={() => navigate('/settings')}
                        className="btn-primary w-full py-3.5"
                    >
                        Aller aux paramètres
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-24 pt-4 md:pt-8 px-4 md:px-8 max-w-7xl mx-auto min-h-screen">
            
            {/* Barre collante de Recherche et Onglets */}
            <div className="sticky top-0 z-40 bg-brand-900/95 backdrop-blur-md pt-2 pb-4 border-b border-white/5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-extrabold tracking-tight text-white hidden md:block">StreamFlow</h1>
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Onglets adaptatifs */}
                    <div className="flex bg-brand-800/60 p-1 rounded-xl flex-1 md:flex-initial">
                        <button 
                            onClick={() => setActiveTab('movie')}
                            className={`flex-1 md:px-6 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${activeTab === 'movie' ? 'bg-brand-accent text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            Films
                        </button>
                        <button 
                            onClick={() => setActiveTab('tv')}
                            className={`flex-1 md:px-6 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${activeTab === 'tv' ? 'bg-brand-accent text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            Séries
                        </button>
                        <button 
                            onClick={() => setActiveTab('all')}
                            className={`flex-1 md:px-6 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${activeTab === 'all' ? 'bg-brand-accent text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            Tout
                        </button>
                    </div>

                    {/* Barre de recherche */}
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Icons.Search className="h-4 w-4 text-text-muted" />
                        </div>
                        <input
                            type="text"
                            className="glass-input block w-full pl-9 pr-3 py-2 rounded-xl text-xs md:text-sm"
                            placeholder="Rechercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Chargement initial */}
            {loading ? (
                <div className="space-y-8">
                    <div className="h-[55vh] w-full bg-brand-800 rounded-3xl animate-pulse"></div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
                    </div>
                </div>
            ) : error ? (
                <div className="text-center text-red-400 p-8 bg-red-900/10 rounded-2xl border border-red-900/30 max-w-md mx-auto mt-12">
                    <Icons.AlertCircle className="mx-auto h-12 w-12 mb-3 text-red-500" />
                    <p className="font-semibold mb-2">{error}</p>
                    <button onClick={fetchMagnets} className="btn-glass text-xs px-4 py-2 mt-2">Réessayer</button>
                </div>
            ) : (
                <div className="animate-fade-in">
                    
                    {/* Affiche Héro (films avec backdrop TMDB uniquement) */}
                    {activeTab === 'movie' && searchQuery === '' && (
                        <HeroBanner 
                            mediaItems={magnets.filter(m => m.mediaType === 'movie')}
                            onPlayClick={handleMagnetClick}
                            onDetailsClick={handleMagnetClick}
                        />
                    )}

                    {/* Section "Reprendre la lecture" (Continue Watching) */}
                    {continueWatching.length > 0 && searchQuery === '' && (
                        <div className="mb-10">
                            <h2 className="text-lg md:text-xl font-extrabold text-white mb-4 tracking-wide flex items-center">
                                <Icons.Play size={18} className="mr-2 text-brand-accent" fill="currentColor" />
                                Reprendre la lecture
                            </h2>
                            <div className="flex space-x-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 md:-mx-8 md:px-8 snap-x">
                                {continueWatching.map((item, idx) => {
                                    const poster = TMDBService.getImageUrl(item.tmdbData?.poster_path || item.tmdbData?.backdrop_path, 'w200');
                                    return (
                                        <div 
                                            key={idx}
                                            onClick={() => navigate(`/view/${item.magnetId}`, { state: { magnet: magnets.find(m => m.id === item.magnetId) } })}
                                            className="relative flex-none w-44 aspect-[2/3] bg-brand-800 rounded-xl overflow-hidden cursor-pointer shadow-lg transform transition-transform duration-300 hover:scale-[1.03] snap-start border border-white/5"
                                        >
                                            {poster ? (
                                                <img src={poster} alt={item.filename} className="w-full h-full object-cover opacity-80" />
                                            ) : (
                                                <div className="w-full h-full bg-brand-700 flex items-center justify-center p-3 text-center text-xs font-bold">
                                                    {item.filename}
                                                </div>
                                            )}
                                            {/* Gradient Scrim */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                                            
                                            {/* Titre et épisode */}
                                            <div className="absolute inset-x-0 bottom-0 p-3">
                                                <p className="text-white text-xs font-bold truncate">{item.tmdbData?.title || item.tmdbData?.name || item.filename}</p>
                                                {/* Barre de progression de lecture */}
                                                <div className="w-full h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-brand-accent rounded-full" 
                                                        style={{ width: `${item.percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Grille principale des médias */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg md:text-xl font-extrabold text-white tracking-wide">
                            {activeTab === 'movie' ? 'Tous les Films' : activeTab === 'tv' ? 'Toutes les Séries' : 'Tous les Fichiers'}
                        </h2>
                        {metadataLoading && (
                            <span className="text-[10px] text-text-muted flex items-center">
                                <Icons.RefreshCw size={10} className="animate-spin mr-1.5" />
                                Enrichissement des affiches...
                            </span>
                        )}
                    </div>

                    {filteredMagnets.length === 0 ? (
                        <div className="text-center text-text-secondary py-20 bg-brand-800/20 rounded-3xl border border-white/5 max-w-xl mx-auto">
                            <div className="bg-brand-800 inline-flex p-6 rounded-full mb-4">
                                 <Icons.Film className="h-10 w-10 opacity-55 text-brand-accent" />
                            </div>
                            <p className="text-lg font-bold text-white mb-1">Aucun média trouvé</p>
                            <p className="text-sm opacity-60 px-4">Modifiez vos filtres ou ajoutez des torrents sur votre compte Alldebrid.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                            {filteredMagnets.map((item) => (
                                <MagnetCard 
                                    key={item.id} 
                                    magnet={item} 
                                    posterPath={item.tmdbData?.poster_path}
                                    onClick={handleMagnetClick} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};