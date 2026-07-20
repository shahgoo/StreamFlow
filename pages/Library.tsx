import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { EnrichedMagnet, TMDBResult } from '../types';
import { AlldebridService } from '../services/alldebrid';
import { TMDBService } from '../services/tmdb';
import { parseMagnetName, isVideoFile } from '../utils/filename';
import { StorageUtils, CustomCollection } from '../utils/storage';
import { MagnetCard } from '../components/MagnetCard';
import { HeroBanner } from '../components/HeroBanner';
import { SagaCollagePoster } from '../components/SagaCollagePoster';
import { CreateCollectionModal } from '../components/CreateCollectionModal';
import { Icons } from '../components/Icon';

interface HistoryProgress {
    currentTime: number;
    duration: number;
    percentage: number;
    timestamp: number;
}

interface ContinueWatchingItem {
    magnetId: number;
    filename: string;
    percentage: number;
    currentTime: number;
    tmdbData?: TMDBResult;
}

interface SagaGroup {
    collectionId: number;
    name: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    items: EnrichedMagnet[];
}

const CACHE_KEY = 'tmdb_cache';
const ENRICHED_CACHE_KEY = 'sf_enriched_library_cache';
const ENRICHED_CACHE_TIME = 'sf_enriched_library_time';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 Heures

export const Library: React.FC = () => {
    const navigate = useNavigate();

    // Recharger la recherche persistée depuis sessionStorage pour ne pas perdre les résultats au retour
    const [searchQuery, setSearchQueryState] = useState(() => {
        return sessionStorage.getItem('sf_searchQuery') || '';
    });

    const setSearchQuery = (query: string) => {
        setSearchQueryState(query);
        sessionStorage.setItem('sf_searchQuery', query);
    };

    const [activeTab, setActiveTab] = useState<'movie' | 'tv' | 'all' | 'favorites'>('movie');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [activeSagaId, setActiveSagaId] = useState<number | null>(null);
    const [activeCustomCollectionId, setActiveCustomCollectionId] = useState<string | null>(null);
    
    const [magnets, setMagnets] = useState<EnrichedMagnet[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [metadataLoading, setMetadataLoading] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);

    // Collections sur-mesure & Modale de création
    const [customCollections, setCustomCollections] = useState<CustomCollection[]>(() => StorageUtils.getCustomCollections());
    const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState<boolean>(false);

    // Mode Enfants
    const kidsMode = useMemo(() => localStorage.getItem('kids_mode') === 'true', []);
    const savedPin = useMemo(() => localStorage.getItem('kids_mode_pin') || '', []);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState(false);

    // Filtre de qualité global
    const [qualityFilter, setQualityFilter] = useState<string>(() => {
        return sessionStorage.getItem('sf_qualityFilter') || 'all';
    });

    const handleQualityFilterChange = (filter: string) => {
        setQualityFilter(filter);
        sessionStorage.setItem('sf_qualityFilter', filter);
    };

    const { adApiKey: contextAdKey, tmdbApiKey: contextTmdbKey } = useApp();
    const adApiKey = contextAdKey || localStorage.getItem('ad_apikey') || localStorage.getItem('ad_api_key') || '';
    const tmdbApiKey = contextTmdbKey || localStorage.getItem('tmdb_apikey') || localStorage.getItem('tmdb_api_key') || '';

    const loadCache = (): Record<string, TMDBResult> => {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        } catch (e) {
            return {};
        }
    };

    const saveCache = (cache: Record<string, TMDBResult>) => {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch (e) {}
    };

    const getCacheKey = (item: EnrichedMagnet) => {
        const parsed = parseMagnetName(item.filename);
        const searchTitle = item.mediaType === 'tv' ? (item.showName || parsed.showName || parsed.title) : parsed.title;
        return `${item.mediaType}_${searchTitle || ''}_${parsed.year || ''}`.replace(/\s/g, '').toLowerCase();
    };

    const saveEnrichedCache = (items: EnrichedMagnet[]) => {
        try {
            localStorage.setItem(ENRICHED_CACHE_KEY, JSON.stringify(items));
            localStorage.setItem(ENRICHED_CACHE_TIME, Date.now().toString());
        } catch (e) {}
    };

    const loadEnrichedCache = (): { items: EnrichedMagnet[]; timestamp: number } | null => {
        try {
            const data = localStorage.getItem(ENRICHED_CACHE_KEY);
            const time = localStorage.getItem(ENRICHED_CACHE_TIME);
            if (data && time) {
                return { items: JSON.parse(data), timestamp: parseInt(time, 10) };
            }
        } catch (e) {}
        return null;
    };

    useEffect(() => {
        if (!adApiKey) {
            setError("Clé API manquante");
            setLoading(false);
            return;
        }

        const cached = loadEnrichedCache();
        const isCacheFresh = cached && (Date.now() - cached.timestamp < CACHE_TTL);

        if (isCacheFresh) {
            setMagnets(cached.items);
            setLoading(false);
        } else {
            fetchLibrary(false);
        }
    }, [adApiKey]);

    // Charger l'historique de lecture au montage & synchro au retour de Details
    const loadContinueWatching = () => {
        try {
            const historyObj: Record<string, HistoryProgress> = JSON.parse(localStorage.getItem('streamflow_history') || '{}');
            const items: ContinueWatchingItem[] = [];

            Object.entries(historyObj).forEach(([key, val]) => {
                if (val.percentage > 2 && val.percentage < 95) {
                    const [magnetIdStr, fileIndexStr] = key.split('_');
                    const magnetId = parseInt(magnetIdStr, 10);
                    const magnet = magnets.find(m => m.id === magnetId);
                    
                    let filename = magnet ? magnet.filename : 'Vidéo';
                    if (magnet && magnet.links && magnet.links[parseInt(fileIndexStr, 10)]) {
                        filename = magnet.links[parseInt(fileIndexStr, 10)].filename;
                    }

                    items.push({
                        magnetId,
                        filename,
                        percentage: val.percentage,
                        currentTime: val.currentTime,
                        tmdbData: magnet?.tmdbData
                    });
                }
            });

            items.sort((a, b) => b.percentage - a.percentage);
            setContinueWatching(items.slice(0, 8));
        } catch (e) {}
    };

    useEffect(() => {
        if (magnets.length > 0) {
            loadContinueWatching();
        }
    }, [magnets]);

    const handleManualRefresh = () => {
        setIsRefreshing(true);
        fetchLibrary(true);
    };

    const fetchLibrary = async (silent = false) => {
        if (!adApiKey) return;
        if (!silent) setLoading(true);

        try {
            // Récupérer simultanément Magnets et Liens débridés enregistrés
            const [magnetsRes, savedLinksRes] = await Promise.all([
                AlldebridService.getMagnets(adApiKey),
                AlldebridService.getSavedLinks(adApiKey)
            ]);

            if (magnetsRes.status === 'success') {
                let allItems: EnrichedMagnet[] = magnetsRes.data.magnets.map(m => {
                    const parsed = parseMagnetName(m.filename);
                    return { ...m, mediaType: parsed.type, showName: parsed.showName };
                });

                // Fusionner les Saved Links qui ne font pas partie des Magnets
                if (savedLinksRes.status === 'success' && savedLinksRes.data.links) {
                    const existingFilenames = new Set(allItems.map(m => m.filename.toLowerCase()));
                    
                    savedLinksRes.data.links.forEach(link => {
                        if (isVideoFile(link.filename) && !existingFilenames.has(link.filename.toLowerCase())) {
                            const parsed = parseMagnetName(link.filename);
                            allItems.push({
                                id: link.id,
                                filename: link.filename,
                                size: link.size,
                                hash: link.id.toString(),
                                status: 'Ready',
                                statusCode: 4,
                                downloaded: link.size,
                                uploaded: 0,
                                seeders: 0,
                                downloadSpeed: 0,
                                uploadSpeed: 0,
                                uploadDate: link.uploadDate || Date.now() / 1000,
                                completionDate: link.uploadDate || Date.now() / 1000,
                                links: [{ filename: link.filename, link: link.link }],
                                mediaType: parsed.type,
                                showName: parsed.showName
                            });
                        }
                    });
                }

                // Regrouper les torrents d'une même série TV
                const groupedMagnets: EnrichedMagnet[] = [];
                const seriesMap: Record<string, EnrichedMagnet[]> = {};

                allItems.forEach(m => {
                    if (m.mediaType === 'tv' && m.showName) {
                        const key = m.showName.toLowerCase();
                        if (!seriesMap[key]) seriesMap[key] = [];
                        seriesMap[key].push(m);
                    } else {
                        groupedMagnets.push(m);
                    }
                });

                Object.values(seriesMap).forEach(seriesList => {
                    if (seriesList.length === 1) {
                        groupedMagnets.push(seriesList[0]);
                    } else {
                        seriesList.sort((a, b) => (a.uploadDate || 0) - (b.uploadDate || 0));
                        const primary = { ...seriesList[0] };
                        primary.groupedMagnets = seriesList;
                        groupedMagnets.push(primary);
                    }
                });

                setMagnets(groupedMagnets);
                saveEnrichedCache(groupedMagnets);

                if (tmdbApiKey) {
                    enrichWithMetadata(groupedMagnets, tmdbApiKey);
                }
            } else {
                setError("Impossible de charger la bibliothèque");
            }
        } catch (e) {
            setError("Erreur de connexion");
        } finally {
            if (!silent) setLoading(false);
            setIsRefreshing(false);
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

            // Chercher un override
            let override = overrides[item.id];
            if (!override && item.groupedMagnets) {
                for (const gm of item.groupedMagnets) {
                    if (overrides[gm.id]?.customTmdbData) {
                        override = overrides[gm.id];
                        break;
                    }
                }
            }

            if (override && override.customTmdbData) {
                newItems[i].tmdbData = override.customTmdbData;
                if (override.type) newItems[i].mediaType = override.type;
                continue;
            }

            const cacheKey = getCacheKey(item);
            const cachedEntry = cache[cacheKey];

            if (cachedEntry && (cachedEntry as any).notFound) {
                continue;
            }

            const needsCollectionLookup = item.mediaType === 'movie' && cachedEntry && cachedEntry.belongs_to_collection === undefined;

            if (cachedEntry && !needsCollectionLookup) {
                newItems[i].tmdbData = cachedEntry;
            } else {
                await new Promise(r => setTimeout(r, 120));
                const parsed = parseMagnetName(item.filename);
                const searchTitle = item.mediaType === 'tv' ? (item.showName || parsed.showName || parsed.title) : parsed.title;

                let result = (cachedEntry && !needsCollectionLookup) ? cachedEntry : await TMDBService.search(tmdbKey, searchTitle, item.mediaType, parsed.year);

                if (!result && parsed.year && item.mediaType === 'movie') {
                    result = await TMDBService.search(tmdbKey, searchTitle, item.mediaType);
                }

                // Fallback pour les packs/collections de films : essayer avec le titre du premier fichier vidéo
                if (!result && item.mediaType === 'movie' && item.links && item.links.length > 0) {
                    const firstVideo = item.links.find(l => isVideoFile(l.filename));
                    if (firstVideo) {
                        const parsedFile = parseMagnetName(firstVideo.filename);
                        if (parsedFile.title && parsedFile.title.toLowerCase() !== (searchTitle || '').toLowerCase()) {
                            result = await TMDBService.search(tmdbKey, parsedFile.title, 'movie', parsedFile.year);
                            if (!result && parsedFile.year) {
                                result = await TMDBService.search(tmdbKey, parsedFile.title, 'movie');
                            }
                        }
                    }
                }

                if (result && item.mediaType === 'movie') {
                    const details = await TMDBService.getMovieDetails(tmdbKey, result.id);
                    if (details) {
                        result = { ...result, ...details };
                    } else {
                        result = { ...result, belongs_to_collection: null };
                    }
                }

                if (result) {
                    newItems[i].tmdbData = result;
                    cache[cacheKey] = result;
                    cacheUpdated = true;
                } else {
                    cache[cacheKey] = { id: 0, notFound: true } as any;
                    cacheUpdated = true;
                }

                if (i % 2 === 0 || i === newItems.length - 1) {
                    setMagnets([...newItems]);
                }
            }
        }

        if (cacheUpdated) {
            saveCache(cache);
        }
        setMagnets(newItems);
        saveEnrichedCache(newItems);
        setMetadataLoading(false);
    };

    // Filtrage dynamique de la grille
    const filteredMagnets = useMemo(() => {
        return magnets.filter(m => {
            const parsed = parseMagnetName(m.filename);

            // 1. Filtrage par recherche texte
            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase().trim();
                const title = (m.tmdbData?.title || m.tmdbData?.name || parsed.showName || parsed.title || m.filename).toLowerCase();
                const matchesTitle = title.includes(q);
                const matchesFile = m.filename.toLowerCase().includes(q);
                const sagaName = m.tmdbData?.belongs_to_collection?.name?.toLowerCase() || '';
                const matchesSaga = sagaName.includes(q);

                if (!matchesTitle && !matchesFile && !matchesSaga) return false;
            }

            // 2. Filtrage par Onglet
            if (activeTab === 'movie' && m.mediaType !== 'movie') return false;
            if (activeTab === 'tv' && m.mediaType !== 'tv') return false;
            if (activeTab === 'favorites' && !StorageUtils.isFavorite(m.id)) return false;

            // 3. Mode Enfants
            if (kidsMode) {
                const isKidsOverride = m.id ? StorageUtils.getOverride(m.id)?.kidsOverride : undefined;
                if (isKidsOverride === false) return false;

                if (isKidsOverride !== true) {
                    const genreIds = m.tmdbData?.genre_ids || (m.tmdbData?.genres ? m.tmdbData.genres.map(g => g.id) : []);
                    const isAnimationOrFamily = genreIds.some(id => [16, 10751, 10762].includes(id));
                    const isAdultOrAction = genreIds.some(id => [27, 80, 53, 10752, 18, 28].includes(id));
                    if (!isAnimationOrFamily || isAdultOrAction) return false;
                }
            }

            // 4. Filtrage par Qualité
            if (qualityFilter !== 'all') {
                if (qualityFilter === '4k' && parsed.quality !== '4K') return false;
                if (qualityFilter === '1080p' && parsed.quality !== '1080p') return false;
                if (qualityFilter === 'other' && (parsed.quality === '4K' || parsed.quality === '1080p')) return false;
            }

            // 5. Filtrage par Catégorie de genre
            if (!kidsMode && activeCategory !== 'all') {
                const genreIds = m.tmdbData?.genre_ids || (m.tmdbData?.genres ? m.tmdbData.genres.map(g => g.id) : []);
                let matchesCategory = false;
                if (activeCategory === 'action') matchesCategory = genreIds.some(id => [28, 12, 10759].includes(id));
                else if (activeCategory === 'comedy') matchesCategory = genreIds.some(id => [35].includes(id));
                else if (activeCategory === 'animation') matchesCategory = genreIds.some(id => [16].includes(id));
                else if (activeCategory === 'kids') matchesCategory = genreIds.some(id => [10751, 10762].includes(id));

                if (!matchesCategory) return false;
            }

            // 6. Filtrage par Saga sélectionnée
            if (activeSagaId !== null) {
                if (m.tmdbData?.belongs_to_collection?.id !== activeSagaId) return false;
            }

            // 7. Filtrage par Collection Personnalisée sélectionnée
            if (activeCustomCollectionId !== null) {
                const customCol = customCollections.find(c => c.id === activeCustomCollectionId);
                if (!customCol || !customCol.magnetIds.includes(m.id)) return false;
            }

            return true;
        });
    }, [magnets, searchQuery, activeTab, activeCategory, qualityFilter, kidsMode, activeSagaId, activeCustomCollectionId, customCollections]);

    // Sagas TMDB
    const sagaGroups = useMemo<SagaGroup[]>(() => {
        const groups: Record<string, SagaGroup> = {};

        magnets.forEach(m => {
            if (m.mediaType !== 'movie') return;
            const collection = m.tmdbData?.belongs_to_collection;
            if (!collection) return;

            const key = String(collection.id);
            if (!groups[key]) {
                groups[key] = {
                    collectionId: collection.id,
                    name: collection.name,
                    posterPath: collection.poster_path,
                    backdropPath: collection.backdrop_path,
                    items: []
                };
            }
            groups[key].items.push(m);
        });

        return Object.values(groups)
            .filter(g => g.items.length >= 2)
            .sort((a, b) => b.items.length - a.items.length);
    }, [magnets]);

    // Filtrage des sagas par recherche
    const filteredSagaGroups = useMemo(() => {
        if (!searchQuery.trim()) return sagaGroups;
        const q = searchQuery.toLowerCase().trim();
        return sagaGroups.filter(saga => {
            const matchName = saga.name.toLowerCase().includes(q);
            const matchItems = saga.items.some(m => {
                const parsed = parseMagnetName(m.filename);
                const title = m.tmdbData?.title || m.tmdbData?.name || parsed.title;
                return title.toLowerCase().includes(q) || m.filename.toLowerCase().includes(q);
            });
            return matchName || matchItems;
        });
    }, [sagaGroups, searchQuery]);

    const activeSaga = useMemo(
        () => sagaGroups.find(g => g.collectionId === activeSagaId) || null,
        [sagaGroups, activeSagaId]
    );

    const activeCustomCollection = useMemo(
        () => customCollections.find(c => c.id === activeCustomCollectionId) || null,
        [customCollections, activeCustomCollectionId]
    );

    const handleMagnetClick = (magnet: EnrichedMagnet) => {
        navigate(`/view/${magnet.id}`, { state: { magnet } });
    };

    if (error === "Clé API manquante") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
                <div className="bg-brand-800 p-8 rounded-3xl shadow-xl max-w-sm w-full border border-white/5">
                    <div className="w-16 h-16 rounded-full bg-brand-accent/10 flex items-center justify-center mx-auto mb-4">
                        <Icons.Settings className="w-8 h-8 text-brand-accent animate-spin-slow" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Configuration requise</h2>
                    <p className="text-text-secondary mb-6 text-sm">Veuillez entrer votre clé API Alldebrid dans les paramètres pour commencer.</p>
                    <button onClick={() => navigate('/settings')} className="btn-primary w-full py-3.5">
                        Aller aux paramètres
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-24 pt-4 md:pt-8 px-4 md:px-8 max-w-7xl mx-auto min-h-screen">

            {/* Section recherche & Onglets */}
            <div className="sticky top-0 z-40 bg-brand-900/95 backdrop-blur-md pt-2 pb-4 border-b border-white/5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-extrabold tracking-tight text-white hidden md:block">StreamFlow</h1>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Onglets */}
                    <div className="flex bg-brand-800/60 p-1 rounded-xl flex-1 md:flex-initial overflow-x-auto">
                        <button
                            onClick={() => { setActiveTab('movie'); setActiveSagaId(null); setActiveCustomCollectionId(null); }}
                            className={`flex-1 md:px-5 py-2 text-xs md:text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'movie' ? 'bg-brand-accent text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            Films
                        </button>
                        <button
                            onClick={() => { setActiveTab('tv'); setActiveSagaId(null); setActiveCustomCollectionId(null); }}
                            className={`flex-1 md:px-5 py-2 text-xs md:text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'tv' ? 'bg-brand-accent text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            Séries
                        </button>
                        <button
                            onClick={() => { setActiveTab('all'); setActiveSagaId(null); setActiveCustomCollectionId(null); }}
                            className={`flex-1 md:px-5 py-2 text-xs md:text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'all' ? 'bg-brand-accent text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            Tout
                        </button>
                        <button
                            onClick={() => { setActiveTab('favorites'); setActiveSagaId(null); setActiveCustomCollectionId(null); }}
                            className={`flex-1 md:px-5 py-2 text-xs md:text-sm font-bold rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${activeTab === 'favorites' ? 'bg-red-500 text-white shadow-md' : 'text-gray-400 hover:text-red-400'}`}
                        >
                            <Icons.Heart size={14} fill={activeTab === 'favorites' ? "currentColor" : "none"} />
                            <span>Favoris</span>
                        </button>
                    </div>

                    {/* Recherche */}
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Icons.Search className="h-4 w-4 text-text-muted" />
                        </div>
                        <input
                            type="text"
                            className="glass-input block w-full pl-9 pr-8 py-2 rounded-xl text-xs md:text-sm"
                            placeholder="Rechercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                            >
                                <Icons.XCircle size={14} />
                            </button>
                        )}
                    </div>

                    {/* Bouton Actualiser */}
                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="flex items-center justify-center h-9 w-9 rounded-xl bg-brand-800/60 border border-white/5 text-text-secondary hover:text-white hover:bg-brand-700 transition-all disabled:opacity-50"
                        title="Actualiser la bibliothèque"
                    >
                        <Icons.RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* BARRE DE FILTRES AVANCÉS & CATÉGORIES */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-brand-800/30 p-4 rounded-2xl border border-white/5 animate-fade-in">
                <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
                    <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider mr-2">Catégories :</span>
                    {kidsMode ? (
                        <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center">
                            👶 Mode Enfants Activé (Filtre Jeunesse)
                        </span>
                    ) : (
                        <div className="flex space-x-1.5">
                            {[
                                { id: 'all', label: 'Tout' },
                                { id: 'action', label: '⚔️ Action & Aventure' },
                                { id: 'comedy', label: '😂 Comédie' },
                                { id: 'animation', label: '🎨 Animation' },
                                { id: 'kids', label: '🧸 Jeunesse' }
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                                        activeCategory === cat.id
                                        ? 'bg-white text-black font-extrabold shadow-sm'
                                        : 'bg-brand-900/60 text-gray-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Filtres de Qualité */}
                    <div className="flex items-center bg-brand-900/60 rounded-xl border border-white/5 p-0.5">
                        {[
                            { id: 'all', label: 'Tout' },
                            { id: '4k', label: '4K' },
                            { id: '1080p', label: '1080p' },
                            { id: 'other', label: 'Autres' }
                        ].map(q => (
                            <button
                                key={q.id}
                                onClick={() => handleQualityFilterChange(q.id)}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                    qualityFilter === q.id
                                    ? 'bg-brand-accent text-black shadow-sm'
                                    : 'text-text-muted hover:text-white'
                                }`}
                            >
                                {q.label}
                            </button>
                        ))}
                    </div>

                    {/* Bouton Créer une collection sur-mesure */}
                    <button
                        onClick={() => setIsCreateCollectionOpen(true)}
                        className="bg-brand-accent/15 hover:bg-brand-accent hover:text-black text-brand-accent border border-brand-accent/30 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                        title="Créer une collection sur mesure"
                    >
                        <Icons.FolderPlus size={14} />
                        <span>+ Collection</span>
                    </button>
                </div>
            </div>

            {/* GRILLE OU ÉCRAN DE CHARGEMENT */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24">
                    <Icons.RefreshCw className="w-10 h-10 text-brand-accent animate-spin mb-4" />
                    <p className="text-white font-bold text-sm">Chargement de votre bibliothèque...</p>
                </div>
            ) : (
                <div>

                    {/* Affiche Héro (si aucun filtre actif) */}
                    {activeTab === 'movie' && searchQuery === '' && activeCategory === 'all' && !kidsMode && activeSagaId === null && activeCustomCollectionId === null && (
                        <HeroBanner
                            mediaItems={magnets.filter(m => m.mediaType === 'movie')}
                            onPlayClick={handleMagnetClick}
                            onDetailsClick={handleMagnetClick}
                        />
                    )}

                    {/* Section "Reprendre la lecture" */}
                    {continueWatching.length > 0 && searchQuery === '' && activeSagaId === null && activeCustomCollectionId === null && (
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
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                                            <div className="absolute inset-x-0 bottom-0 p-3">
                                                <p className="text-white text-xs font-bold truncate">{item.tmdbData?.title || item.tmdbData?.name || item.filename}</p>
                                                <div className="w-full h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
                                                    <div className="h-full bg-brand-accent rounded-full" style={{ width: `${item.percentage}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Section "Sagas & Collections" (y compris pendant une recherche !) */}
                    {activeTab === 'movie' && (filteredSagaGroups.length > 0 || customCollections.length > 0) && activeCategory === 'all' && !kidsMode && activeSagaId === null && activeCustomCollectionId === null && (
                        <div className="mb-10">
                            <h2 className="text-lg md:text-xl font-extrabold text-white mb-4 tracking-wide flex items-center justify-between">
                                <span className="flex items-center">
                                    <Icons.Film size={18} className="mr-2 text-brand-accent" />
                                    {searchQuery ? "Sagas & Collections correspondant à votre recherche" : "Sagas & Collections"}
                                </span>
                            </h2>
                            <div className="flex space-x-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 md:-mx-8 md:px-8 snap-x">
                                {/* Collections sur-mesure de l'utilisateur */}
                                {customCollections.map((col) => {
                                    const colItems = magnets.filter(m => col.magnetIds.includes(m.id));
                                    const colPosters = colItems
                                        .map(item => TMDBService.getImageUrl(item.tmdbData?.poster_path || item.tmdbData?.backdrop_path, 'w500'))
                                        .filter(Boolean) as string[];

                                    return (
                                        <div
                                            key={col.id}
                                            onClick={() => setActiveCustomCollectionId(col.id)}
                                            className="group relative flex-none w-44 aspect-[2/3] bg-brand-800 rounded-xl overflow-hidden cursor-pointer shadow-lg transform transition-transform duration-300 hover:scale-[1.03] snap-start border border-brand-accent/40"
                                        >
                                            <SagaCollagePoster
                                                posters={colPosters}
                                                count={col.magnetIds.length}
                                                title={col.name}
                                                showBadge={false}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent"></div>
                                            <div className="absolute top-2 left-2 z-10 bg-brand-accent text-black text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                                                Collection
                                            </div>
                                            <div className="absolute inset-x-0 bottom-0 p-3 z-10">
                                                <p className="text-white text-xs font-bold truncate">{col.name}</p>
                                                <span className="text-[10px] text-brand-accent font-semibold">{col.magnetIds.length} élément(s)</span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Sagas TMDB */}
                                {filteredSagaGroups.map((saga) => {
                                    const poster = TMDBService.getImageUrl(saga.posterPath || saga.backdropPath, 'w500');
                                    const sagaPosters = saga.items
                                        .map(item => TMDBService.getImageUrl(item.tmdbData?.poster_path || item.tmdbData?.backdrop_path, 'w500'))
                                        .filter(Boolean) as string[];

                                    return (
                                        <div
                                            key={saga.collectionId}
                                            onClick={() => setActiveSagaId(saga.collectionId)}
                                            className="group relative flex-none w-44 aspect-[2/3] bg-brand-800 rounded-xl overflow-hidden cursor-pointer shadow-lg transform transition-transform duration-300 hover:scale-[1.03] snap-start border border-white/5"
                                        >
                                            {poster ? (
                                                <img src={poster} alt={saga.name} className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <SagaCollagePoster
                                                    posters={sagaPosters}
                                                    count={saga.items.length}
                                                    title={saga.name}
                                                    showBadge={false}
                                                />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent"></div>
                                            <div className="absolute inset-x-0 bottom-0 p-3 z-10">
                                                <p className="text-white text-xs font-bold truncate">{saga.name}</p>
                                                <span className="text-[10px] text-brand-accent font-semibold">{saga.items.length} films</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Bandeau de retour lorsqu'une Saga ou Collection est sélectionnée */}
                    {(activeSaga || activeCustomCollection) && (
                        <div className="flex items-center justify-between mb-6 bg-brand-800/40 border border-brand-accent/30 rounded-2xl px-5 py-3.5 animate-fade-in shadow-lg">
                            <div className="flex items-center">
                                <button
                                    onClick={() => { setActiveSagaId(null); setActiveCustomCollectionId(null); }}
                                    className="mr-3.5 p-2 rounded-xl bg-brand-accent text-black hover:bg-white transition-all font-bold text-xs flex items-center gap-1"
                                    aria-label="Retour"
                                >
                                    <Icons.ChevronLeft size={16} />
                                    <span>Retour à la liste</span>
                                </button>
                                <div>
                                    <p className="text-[10px] text-brand-accent uppercase tracking-wider font-extrabold">
                                        {activeCustomCollection ? "Collection sur-mesure" : "Saga TMDB"}
                                    </p>
                                    <p className="text-white font-extrabold text-base">{activeSaga ? activeSaga.name : activeCustomCollection?.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-text-secondary font-bold">
                                    {activeSaga ? activeSaga.items.length : activeCustomCollection?.magnetIds.length} vidéo(s)
                                </span>
                                {activeCustomCollection && (
                                    <button
                                        onClick={() => {
                                            StorageUtils.deleteCustomCollection(activeCustomCollection.id);
                                            setCustomCollections(StorageUtils.getCustomCollections());
                                            setActiveCustomCollectionId(null);
                                        }}
                                        className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl font-bold transition-all"
                                    >
                                        Supprimer la collection
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Grille principale des médias */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg md:text-xl font-extrabold text-white tracking-wide">
                            {activeSaga
                                ? activeSaga.name
                                : activeCustomCollection
                                    ? activeCustomCollection.name
                                    : activeTab === 'favorites'
                                        ? 'Mes Favoris ❤️'
                                        : kidsMode
                                            ? 'Bibliothèque Jeunesse'
                                            : activeTab === 'movie'
                                                ? 'Tous les Films'
                                                : activeTab === 'tv'
                                                    ? 'Toutes les Séries'
                                                    : 'Tous les Fichiers'}
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
                            <p className="text-sm opacity-60 px-4">
                                {activeTab === 'favorites' 
                                    ? "Vous n'avez pas encore ajouté de médias à vos favoris. Cliquez sur le cœur d'une carte pour l'ajouter."
                                    : "Modifiez vos filtres ou effectuez une recherche."}
                            </p>
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

            {/* MODALE DE CRÉATION DE COLLECTION SUR MESURE */}
            <CreateCollectionModal
                isOpen={isCreateCollectionOpen}
                onClose={() => setIsCreateCollectionOpen(false)}
                allMagnets={magnets}
                onCollectionCreated={() => setCustomCollections(StorageUtils.getCustomCollections())}
            />

        </div>
    );
};
