import React, { useEffect, useState, useMemo } from 'react';
import { AlldebridService } from '../services/alldebrid';
import { TMDBService, TMDBResult } from '../services/tmdb';
import { Magnet } from '../types';
import { MagnetCard } from '../components/MagnetCard';
import { Icons } from '../components/Icon';
import { useNavigate } from 'react-router-dom';
import { parseMagnetName } from '../utils/filename';
import { StorageUtils } from '../utils/storage';
import { useApp } from '../contexts/AppContext';

type FilterType = 'all' | 'movie' | 'tv';

interface EnrichedMagnet extends Magnet {
    mediaType: 'movie' | 'tv';
    tmdbData?: TMDBResult;
}

export const Library: React.FC = () => {
    const { adApiKey, tmdbApiKey } = useApp();
    const [magnets, setMagnets] = useState<EnrichedMagnet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<FilterType>('movie');
    const navigate = useNavigate();

    // Define what constitutes a "video" file for filtering magnets
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
                
                // Filter: Only keep magnets that have at least one video file
                const videoMagnets = rawMagnets.filter(m => {
                    if (m.links && m.links.length > 0) {
                        return m.links.some(l => isVideoFile(l.filename));
                    }
                    return true; 
                });

                // 1. Initial Parsing with Overrides check
                const parsedMagnets: EnrichedMagnet[] = videoMagnets.map(m => {
                    const override = overrides[m.id];
                    
                    // If manual override exists for type, use it. Otherwise parse.
                    if (override && override.type) {
                        return { ...m, mediaType: override.type };
                    }

                    const parsed = parseMagnetName(m.filename);
                    return { ...m, mediaType: parsed.type };
                });

                setMagnets(parsedMagnets);
                setError(null);

                // 2. Lazy Fetch Metadata
                if (tmdbApiKey) {
                    enrichWithMetadata(parsedMagnets, tmdbApiKey);
                }

            } else {
                setError(response.error?.message || "Erreur inconnue");
            }
        } catch (e) {
            setError("Erreur de connexion");
        } finally {
            setLoading(false);
        }
    };

    const enrichWithMetadata = async (currentMagnets: EnrichedMagnet[], tmdbKey: string) => {
        const cache = loadCache();
        const overrides = StorageUtils.getOverrides();
        let cacheUpdated = false;
        const newMagnets = [...currentMagnets];

        for (let i = 0; i < newMagnets.length; i++) {
            const m = newMagnets[i];
            const override = overrides[m.id];

            // 1. Check Manual Override first
            if (override && override.customTmdbData) {
                newMagnets[i].tmdbData = override.customTmdbData;
                continue; 
            }

            // 2. Then check cache/API
            const parsed = parseMagnetName(m.filename);
            const cacheKey = `${parsed.type}_${parsed.title}_${parsed.year || ''}`.replace(/\s/g, '');

            if (cache[cacheKey]) {
                newMagnets[i].tmdbData = cache[cacheKey];
            } else {
                // Rate limit spacing
                await new Promise(r => setTimeout(r, 250));
                
                // Use the media type that is currently assigned (might be overridden type)
                const typeToSearch = newMagnets[i].mediaType;

                // Try 1: Specific search with Year
                let result = await TMDBService.search(tmdbKey, parsed.title, typeToSearch, parsed.year);
                
                // Try 2: Fallback without Year
                if (!result && parsed.year) {
                     result = await TMDBService.search(tmdbKey, parsed.title, typeToSearch);
                }

                if (result) {
                    newMagnets[i].tmdbData = result;
                    cache[cacheKey] = result;
                    cacheUpdated = true;
                    if (i % 3 === 0) setMagnets([...newMagnets]);
                }
            }
        }

        if (cacheUpdated) {
            saveCache(cache);
        }
        setMagnets(newMagnets); // Final update
    };

    useEffect(() => {
        fetchMagnets();
    }, [adApiKey, tmdbApiKey]);

    const filteredMagnets = useMemo(() => {
        return magnets.filter(m => {
            const matchesSearch = m.filename.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesTab = activeTab === 'all' ? true : m.mediaType === activeTab;
            return matchesSearch && matchesTab;
        });
    }, [magnets, searchQuery, activeTab]);

    const handleMagnetClick = (magnet: Magnet) => {
        // Pass the enriched magnet (with TMDB data) to details
        const enriched = magnets.find(m => m.id === magnet.id);
        navigate(`/view/${magnet.id}`, { state: { magnet: enriched || magnet } });
    };

    if (error === "Clé API manquante") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
                <div className="bg-brand-800 p-6 rounded-2xl shadow-xl max-w-sm w-full border border-white/5">
                    <Icons.Settings className="w-16 h-16 text-brand-accent mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">Configuration requise</h2>
                    <p className="text-gray-400 mb-6 text-sm">Veuillez entrer votre clé API Alldebrid dans les paramètres pour commencer.</p>
                    <button 
                        onClick={() => navigate('/settings')}
                        className="w-full py-3 bg-brand-accent hover:bg-amber-600 text-black font-bold rounded-lg transition-colors"
                    >
                        Aller aux paramètres
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-24 pt-4 md:pt-8 px-4 md:px-8 max-w-7xl mx-auto min-h-screen">
            {/* Header with Search and Tabs */}
            <div className="sticky top-0 z-40 bg-brand-900/95 backdrop-blur-md pt-2 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-white/5 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 mb-4">
                    <h1 className="text-3xl font-bold tracking-tight text-white hidden md:block">Ma Bibliothèque</h1>
                    
                    {/* Search Bar */}
                    <div className="relative w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Icons.Search className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2.5 border border-transparent rounded-xl leading-5 bg-brand-800 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-brand-800 focus:text-white focus:ring-2 focus:ring-brand-accent transition-all shadow-inner"
                            placeholder="Rechercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 bg-brand-800/50 p-1 rounded-xl max-w-md mx-auto md:mx-0">
                    <button 
                        onClick={() => setActiveTab('movie')}
                        className={`flex-1 flex items-center justify-center py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'movie' ? 'bg-brand-accent text-brand-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Films
                    </button>
                    <button 
                        onClick={() => setActiveTab('tv')}
                        className={`flex-1 flex items-center justify-center py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'tv' ? 'bg-brand-accent text-brand-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Séries
                    </button>
                    <button 
                        onClick={() => setActiveTab('all')}
                        className={`flex-1 flex items-center justify-center py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'all' ? 'bg-brand-accent text-brand-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Tout
                    </button>
                </div>
            </div>

            {/* Content */}
            {loading && magnets.length === 0 ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
                </div>
            ) : error ? (
                <div className="text-center text-red-400 p-8 bg-red-900/20 rounded-xl border border-red-900/50">
                    <Icons.AlertCircle className="mx-auto h-12 w-12 mb-2" />
                    <p>{error}</p>
                    <button onClick={fetchMagnets} className="mt-4 text-white underline text-sm">Réessayer</button>
                </div>
            ) : filteredMagnets.length === 0 ? (
                <div className="text-center text-gray-500 py-20">
                    <div className="bg-brand-800 inline-block p-6 rounded-full mb-4">
                         <Icons.Film className="h-12 w-12 opacity-50" />
                    </div>
                    <p className="text-lg font-medium">Aucun contenu trouvé</p>
                    <p className="text-sm opacity-60">Essayez de changer de filtre ou d'ajouter des torrents sur Alldebrid.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 animate-fade-in">
                    {filteredMagnets.map(magnet => (
                        <MagnetCard 
                            key={magnet.id} 
                            magnet={magnet} 
                            posterPath={magnet.tmdbData?.poster_path}
                            onClick={handleMagnetClick} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
};