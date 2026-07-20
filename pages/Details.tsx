import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Magnet } from '../types';
import { Icons } from '../components/Icon';
import { AlldebridService } from '../services/alldebrid';
import { TMDBService, TMDBResult, TMDBSeason } from '../services/tmdb';
import { StorageUtils } from '../utils/storage';
import { parseMagnetName } from '../utils/filename';
import { useApp } from '../contexts/AppContext';
import { WatchHistoryService, WatchProgress } from '../services/watchHistory';

// Extended Magnet type to handle the passed state
interface DetailedMagnet extends Magnet {
    tmdbData?: TMDBResult;
    mediaType?: 'movie' | 'tv';
    groupedMagnets?: Magnet[];
    showName?: string;
}

export const Details: React.FC = () => {
    const { id } = useParams();
    const { adApiKey, tmdbApiKey, firebaseUser } = useApp();
    const { state } = useLocation();
    const navigate = useNavigate();
    
    const [magnet, setMagnet] = useState<DetailedMagnet | null>(state?.magnet || null);
    const [richDetails, setRichDetails] = useState<TMDBResult | null>(null);
    const [similarMedias, setSimilarMedias] = useState<TMDBResult[]>([]);
    const [activeSeason, setActiveSeason] = useState<number | null>(null);
    const [seasonDetails, setSeasonDetails] = useState<TMDBSeason | null>(null);
    const [seasonLoading, setSeasonLoading] = useState(false);
    
    // Playback State
    const [unlocking, setUnlocking] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [historyList, setHistoryList] = useState<Record<string, WatchProgress>>({});

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editType, setEditType] = useState<'movie' | 'tv'>(magnet?.mediaType || 'movie');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
    const [selectedTmdb, setSelectedTmdb] = useState<TMDBResult | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Contrôle Parental
    const [kidsOverride, setKidsOverride] = useState<boolean | undefined>(undefined);
    const kidsMode = useMemo(() => localStorage.getItem('kids_mode') === 'true', []);

    useEffect(() => {
        if (magnet) {
            const override = StorageUtils.getOverride(magnet.id);
            setKidsOverride(override?.kidsFriendlyOverride);
        }
    }, [magnet?.id]);

    const handleKidsOverrideChange = (option: string) => {
        if (!magnet) return;
        let value: boolean | undefined = undefined;
        if (option === 'allow') value = true;
        if (option === 'block') value = false;
        
        setKidsOverride(value);
        
        StorageUtils.saveOverride({
            id: magnet.id,
            kidsFriendlyOverride: value
        });
    };

    // Initial search queries
    useEffect(() => {
        if (magnet) {
            const parsed = parseMagnetName(magnet.filename);
            setSearchQuery(magnet.mediaType === 'tv' ? (magnet.showName || parsed.showName || parsed.title) : parsed.title);
            setEditType(magnet.mediaType || 'movie');
        }
    }, [magnet]);

    // Charger les détails riches TMDB (avec téléchargement prioritaire si non encore présent)
    useEffect(() => {
        const fetchRichDetails = async () => {
            if (!magnet || !tmdbApiKey) return;
            
            try {
                const isTv = magnet.mediaType === 'tv' || !!magnet.groupedMagnets;
                let currentTmdb = magnet.tmdbData;

                // 1. Si les métadonnées TMDB n'ont pas encore été téléchargées, forcer la recherche en priorité !
                if (!currentTmdb) {
                    const overrides = StorageUtils.getOverrides();
                    let override = overrides[magnet.id];
                    if (!override && magnet.groupedMagnets) {
                        for (const gm of magnet.groupedMagnets) {
                            if (overrides[gm.id]?.customTmdbData) {
                                override = overrides[gm.id];
                                break;
                            }
                        }
                    }

                    if (override?.customTmdbData) {
                        currentTmdb = override.customTmdbData;
                        setMagnet(prev => prev ? { ...prev, tmdbData: override.customTmdbData, mediaType: override.type || prev.mediaType } : null);
                    } else {
                        const parsed = parseMagnetName(magnet.filename);
                        const searchTitle = magnet.mediaType === 'tv' ? (magnet.showName || parsed.showName || parsed.title) : parsed.title;
                        const mediaType = magnet.mediaType || parsed.type;
                        
                        let searchResult = await TMDBService.search(tmdbApiKey, searchTitle, mediaType, parsed.year);
                        if (!searchResult && parsed.year && mediaType === 'movie') {
                            searchResult = await TMDBService.search(tmdbApiKey, searchTitle, mediaType);
                        }

                        if (searchResult) {
                            currentTmdb = searchResult;
                            setMagnet(prev => prev ? { ...prev, tmdbData: searchResult } : null);

                            // Mettre à jour le cache local pour la bibliothèque
                            try {
                                const cache = JSON.parse(localStorage.getItem('tmdb_cache') || '{}');
                                const cacheKey = `${mediaType}_${searchTitle}_${parsed.year || ''}`.replace(/\s/g, '').toLowerCase();
                                cache[cacheKey] = searchResult;
                                localStorage.setItem('tmdb_cache', JSON.stringify(cache));
                            } catch (e) {}
                        }
                    }
                }

                // 2. Si on a des métadonnées TMDB, charger les détails enrichis (casting, saisons, saga...)
                if (currentTmdb?.id) {
                    let details: TMDBResult | null = null;
                    if (isTv) {
                        details = await TMDBService.getTVDetails(tmdbApiKey, currentTmdb.id);
                    } else {
                        details = await TMDBService.getMovieDetails(tmdbApiKey, currentTmdb.id);
                    }
                    
                    if (details) {
                        setRichDetails(details);

                        // Mettre à jour le cache local avec les détails enrichis
                        try {
                            const parsed = parseMagnetName(magnet.filename);
                            const searchTitle = magnet.mediaType === 'tv' ? (magnet.showName || parsed.showName || parsed.title) : parsed.title;
                            const mediaType = magnet.mediaType || parsed.type;
                            const cache = JSON.parse(localStorage.getItem('tmdb_cache') || '{}');
                            const cacheKey = `${mediaType}_${searchTitle}_${parsed.year || ''}`.replace(/\s/g, '').toLowerCase();
                            cache[cacheKey] = { ...(cache[cacheKey] || {}), ...details };
                            localStorage.setItem('tmdb_cache', JSON.stringify(cache));
                        } catch (e) {}
                    }
                    
                    // Charger les films/séries similaires
                    const similar = await TMDBService.getSimilar(tmdbApiKey, currentTmdb.id, isTv ? 'tv' : 'movie');
                    setSimilarMedias(similar.slice(0, 6));
                }
            } catch (e) {
                console.error("Impossible de récupérer les détails enrichis TMDB", e);
            }
        };

        fetchRichDetails();
        
        // Charger la progression locale de lecture
        const progressHistory = WatchHistoryService.getLocalHistory();
        setHistoryList(progressHistory);
    }, [magnet?.id, tmdbApiKey]);

    // Charger les détails de la saison active depuis TMDB
    useEffect(() => {
        const fetchSeasonDetails = async () => {
            const tmdbId = richDetails?.id || magnet?.tmdbData?.id;
            if (!tmdbId || !tmdbApiKey || activeSeason === null) {
                setSeasonDetails(null);
                return;
            }
            const isTv = magnet?.mediaType === 'tv' || !!magnet?.groupedMagnets;
            if (!isTv) return;

            setSeasonLoading(true);
            try {
                const details = await TMDBService.getSeasonDetails(tmdbApiKey, tmdbId, activeSeason);
                setSeasonDetails(details);
            } catch (e) {
                console.error('Erreur chargement saison TMDB', e);
                setSeasonDetails(null);
            } finally {
                setSeasonLoading(false);
            }
        };
        fetchSeasonDetails();
    }, [magnet?.tmdbData?.id, richDetails?.id, tmdbApiKey, activeSeason]);

    // Charger la liste des fichiers vidéo du magnet ou des magnets du groupe
    useEffect(() => {
        const fetchFiles = async () => {
            if (!magnet || !adApiKey) return;
            
            try {
                if (magnet.groupedMagnets && magnet.groupedMagnets.length > 0) {
                    const needsLoading = magnet.groupedMagnets.some(m => !m.links || m.links.length === 0);
                    if (needsLoading) {
                        const updatedGrouped = await Promise.all(
                            magnet.groupedMagnets.map(async (m) => {
                                if (!m.links || m.links.length === 0) {
                                    const files = await AlldebridService.getMagnetFiles(adApiKey, m.id);
                                    return { ...m, links: files };
                                }
                                return m;
                            })
                        );
                        setMagnet(prev => prev ? {
                            ...prev,
                            groupedMagnets: updatedGrouped
                        } : null);
                    }
                } else if (!magnet.links || magnet.links.length === 0) {
                    const files = await AlldebridService.getMagnetFiles(adApiKey, magnet.id);
                    setMagnet(prev => prev ? {
                        ...prev,
                        links: files
                    } : null);
                }
            } catch (e) {
                console.error("Failed to fetch magnet files", e);
                setError("Impossible de récupérer la liste des fichiers vidéo depuis Alldebrid.");
            }
        };

        fetchFiles();
    }, [magnet?.id, adApiKey]);

    if (!magnet) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
                <Icons.AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-white font-bold">Torrent introuvable ou inexistant.</p>
                <button onClick={() => navigate('/')} className="btn-glass mt-4 text-sm px-6 py-2">Retourner à la bibliothèque</button>
            </div>
        );
    }

    const videoExtensions = /\.(mkv|mp4|avi|mov|wmv|m4v|webm|flv|mpg|mpeg|3gp|m2ts|ts|vob)$/i;

    // Lire le filtre de qualité global depuis sessionStorage
    const qualityFilter = sessionStorage.getItem('sf_qualityFilter') || 'all';

    const matchesQuality = (filename: string): boolean => {
        if (qualityFilter === 'all') return true;
        const parsed = parseMagnetName(filename);
        if (qualityFilter === '4k') return parsed.quality === '4K';
        if (qualityFilter === '1080p') return parsed.quality === '1080p';
        if (qualityFilter === 'other') return parsed.quality !== '4K' && parsed.quality !== '1080p';
        return true;
    };

    // Trier et grouper les fichiers par saison pour les séries
    const seasons = useMemo(() => {
        const allFiles: { filename: string; link: string; magnetId: number; fileIndex: number; season: number; episode: number }[] = [];
        
        // On traite soit tous les magnets regroupés, soit le magnet actuel
        const magnetsToProcess = magnet.groupedMagnets || [magnet];
        
        magnetsToProcess.forEach(m => {
            if (m.links) {
                m.links.forEach((l, index) => {
                    if (videoExtensions.test(l.filename) && matchesQuality(l.filename)) {
                        const parsed = parseMagnetName(l.filename);
                        allFiles.push({
                            filename: l.filename,
                            link: l.link,
                            magnetId: m.id,
                            fileIndex: index,
                            season: parsed.season ?? 1,
                            episode: parsed.episode ?? 1
                        });
                    }
                });
            }
        });

        // Dédupliquer les épisodes identiques (même saison + même épisode) en gardant le premier trouvé
        const seen = new Set<string>();
        const uniqueFiles = allFiles.filter(f => {
            const key = `s${f.season}e${f.episode}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Grouper par saison
        const groups: Record<number, typeof uniqueFiles> = {};
        uniqueFiles.forEach(f => {
            if (!groups[f.season]) {
                groups[f.season] = [];
            }
            groups[f.season].push(f);
        });

        // Trier les épisodes par numéro dans chaque saison
        const sortedSeasons = Object.entries(groups).map(([seasonNum, episodes]) => {
            const sortedEpisodes = [...episodes].sort((a, b) => a.episode - b.episode);
            return {
                seasonNumber: parseInt(seasonNum, 10),
                episodes: sortedEpisodes
            };
        });

        const sorted = sortedSeasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
        
        // Définir la première saison comme active par défaut si non défini
        if (sorted.length > 0 && activeSeason === null) {
            setActiveSeason(sorted[0].seasonNumber);
        }

        return sorted;
    }, [magnet, activeSeason, qualityFilter]);

    // Fichiers à plat (pour le mode Film simple)
    const filesToShow = useMemo(() => {
        if (magnet.mediaType === 'tv') return [];
        return (magnet.links || [])
            .filter(l => videoExtensions.test(l.filename) && matchesQuality(l.filename))
            .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));
    }, [magnet, qualityFilter]);

    const handlePlay = async (fileObj: { filename: string, link: string, magnetId: number, fileIndex: number }) => {
        if (!adApiKey) return;

        setUnlocking(fileObj.link);
        setError(null);

        try {
            const response = await AlldebridService.unlockLink(adApiKey, fileObj.link);
            if (response.status === 'success') {
                // Charger la progression existante
                const progressKey = `${fileObj.magnetId}_${fileObj.fileIndex}`;
                const progress = historyList[progressKey];

                navigate('/player', { 
                    state: { 
                        streamUrl: response.data.link, 
                        filename: fileObj.filename,
                        tmdbData: richDetails || magnet.tmdbData,
                        magnetId: fileObj.magnetId,
                        fileIndex: fileObj.fileIndex,
                        initialTime: progress?.currentTime || 0
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
        if (!tmdbApiKey) {
            setError("Clé API TMDB requise pour la recherche");
            return;
        }

        setIsSearching(true);
        const results = await TMDBService.searchCandidates(tmdbApiKey, searchQuery, editType);
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
        
        // Recharger les données locales
        if (selectedTmdb) {
            setMagnet(prev => prev ? {
                ...prev,
                mediaType: editType,
                tmdbData: selectedTmdb
            } : null);
            setRichDetails(null);
        }
        
        setIsEditModalOpen(false);
    };

    const parsed = parseMagnetName(magnet.filename);
    const details = richDetails || magnet.tmdbData;
    const posterUrl = TMDBService.getImageUrl(details?.backdrop_path || details?.poster_path, 'w1280');
    const title = details?.title || details?.name || magnet.showName || parsed.title;
    const releaseYear = parsed.year || (details?.release_date || details?.first_air_date)?.substring(0, 4);

    return (
        <div className="min-h-screen bg-brand-900 pb-24 animate-fade-in">
             
             {/* SECTION BACKDROP HD */}
             <div className="relative h-[45vh] md:h-[60vh] w-full overflow-hidden">
                 {/* Scrim dégradé */}
                 <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/40 to-transparent z-10"></div>
                 
                 {posterUrl ? (
                     <img 
                         src={posterUrl} 
                         className="absolute inset-0 w-full h-full object-cover opacity-35"
                         alt="Backdrop"
                     />
                 ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-800 to-brand-900">
                          <div className="w-full h-full flex items-center justify-center text-white/5 text-9xl font-black select-none">
                              {title.substring(0, 1)}
                          </div>
                      </div>
                 )}
                 
                 {/* Actions d'entête */}
                 <div className="absolute top-6 inset-x-6 z-20 flex justify-between">
                     <button 
                         onClick={() => navigate('/')}
                         className="bg-black/50 hover:bg-white/10 text-white backdrop-blur-md p-3.5 rounded-2xl active:scale-95 transition-all shadow-md"
                         title="Retour"
                     >
                         <Icons.ChevronLeft size={24} />
                     </button>
                     
                     <button 
                         onClick={() => setIsEditModalOpen(true)}
                         className="bg-black/50 hover:bg-brand-accent hover:text-black text-white backdrop-blur-md p-3.5 rounded-2xl active:scale-95 transition-all shadow-md"
                         title="Corriger les informations"
                     >
                         <Icons.Settings size={20} />
                     </button>
                 </div>

                 {/* Titre et métadonnées basiques (overlay sur le backdrop) */}
                 <div className="absolute bottom-0 inset-x-6 md:inset-x-12 pb-6 z-20 max-w-4xl">
                     <div className="flex items-center space-x-2.5 mb-2.5">
                         <span className="text-[10px] uppercase font-black px-2 py-1 rounded bg-brand-accent text-black shadow-md tracking-wider">
                              {magnet.mediaType === 'tv' || !!magnet.groupedMagnets ? 'Série' : 'Film'}
                         </span>
                         {releaseYear && (
                             <span className="text-xs text-text-secondary font-semibold">{releaseYear}</span>
                         )}
                         {details?.vote_average ? (
                             <span className="text-xs text-brand-accent font-bold flex items-center bg-brand-accent/15 px-2 py-0.5 rounded border border-brand-accent/20">
                                 ★ {details.vote_average.toFixed(1)}
                             </span>
                         ) : null}
                         <span>•</span>
                         <span className="text-xs text-text-secondary">{(magnet.size / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                     </div>

                     <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight drop-shadow-lg leading-tight line-clamp-2">
                         {title}
                     </h1>
                     
                     {details?.genres && (
                         <div className="flex flex-wrap gap-1.5 mt-2">
                             {details.genres.map((g) => (
                                 <span key={g.id} className="text-[10px] text-text-secondary font-bold bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full">
                                     {g.name}
                                 </span>
                             ))}
                         </div>
                     )}
                 </div>
             </div>

             {/* CONTENU PRINCIPAL */}
             <div className="px-6 md:px-12 max-w-6xl mx-auto mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                 
                 {/* COLONNE GAUCHE (DEUX TIERS) : SYNOPSIS & EPISODES */}
                 <div className="lg:col-span-2 space-y-8">
                     
                     {/* Synopsis */}
                     <div className="bg-brand-800/40 border border-white/5 p-6 rounded-3xl">
                         <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-2">Synopsis</h3>
                         <p className="text-text-primary text-sm md:text-base leading-relaxed font-medium">
                             {details?.overview || "Aucun résumé disponible pour ce contenu."}
                         </p>
                     </div>

                     {/* Épisodes (Séries) ou Fichiers (Films) */}
                     <div className="bg-brand-800/40 border border-white/5 p-6 rounded-3xl">
                         
                         {/* Cas d'une Série : Affichage par Saisons */}
                         {magnet.mediaType === 'tv' || !!magnet.groupedMagnets ? (
                             <div className="space-y-6">
                                 <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                      <h2 className="text-lg font-bold text-white tracking-wide">
                                           Épisodes de la Série
                                      </h2>
                                      <span className="text-xs text-text-secondary font-mono">
                                          {seasons.length} Saison(s)
                                      </span>
                                 </div>

                                 {/* Onglets des Saisons */}
                                 <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar border-b border-white/5">
                                      {seasons.map((s) => (
                                          <button
                                              key={s.seasonNumber}
                                              onClick={() => setActiveSeason(s.seasonNumber)}
                                              className={`flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                                                  activeSeason === s.seasonNumber 
                                                      ? 'bg-brand-accent text-black shadow-md' 
                                                      : 'bg-brand-800 text-text-secondary hover:text-white'
                                              }`}
                                          >
                                              Saison {s.seasonNumber}
                                          </button>
                                      ))}
                                 </div>

                                 {/* Liste des Épisodes de la saison active */}
                                 <div className="space-y-3 mt-4">
                                      {seasonLoading && (
                                          <div className="flex items-center justify-center py-6 text-text-secondary text-xs">
                                              <Icons.RefreshCw className="animate-spin mr-2" size={14} />
                                              Chargement des épisodes...
                                          </div>
                                      )}
                                      {seasons.find(s => s.seasonNumber === activeSeason)?.episodes.map((file, idx) => {
                                          const progressKey = `${file.magnetId}_${file.fileIndex}`;
                                          const progress = historyList[progressKey];
                                          const parsedEp = parseMagnetName(file.filename);
                                          const epNum = parsedEp.episode ?? file.episode;
                                          const tmdbEp = seasonDetails?.episodes?.find(e => e.episode_number === epNum);
                                          const stillUrl = TMDBService.getImageUrl(tmdbEp?.still_path, 'w500');

                                          return (
                                              <div 
                                                  key={idx}
                                                  className="bg-brand-900/60 hover:bg-brand-800 border border-white/5 rounded-2xl overflow-hidden group transition-all"
                                              >
                                                  <div className="flex">
                                                      {/* Vignette de l'épisode */}
                                                      <div className="relative flex-none w-40 md:w-52 aspect-video bg-brand-800">
                                                          {stillUrl ? (
                                                              <img src={stillUrl} alt={tmdbEp?.name || `Épisode ${epNum}`} className="w-full h-full object-cover" />
                                                          ) : (
                                                              <div className="w-full h-full flex items-center justify-center">
                                                                  <Icons.Film size={24} className="text-text-muted" />
                                                              </div>
                                                          )}
                                                          <button
                                                              onClick={() => handlePlay(file)}
                                                              disabled={unlocking === file.link}
                                                              className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                                          >
                                                              {unlocking === file.link ? (
                                                                  <Icons.RefreshCw className="animate-spin h-8 w-8 text-white" />
                                                              ) : (
                                                                  <div className="bg-white/90 rounded-full p-2.5">
                                                                      <Icons.Play size={20} fill="black" className="ml-0.5 text-black" />
                                                                  </div>
                                                              )}
                                                          </button>
                                                          {/* Barre de progression en bas de la vignette */}
                                                          {progress && (
                                                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                                                                  <div className="h-full bg-brand-accent" style={{ width: `${progress.percentage}%` }}></div>
                                                              </div>
                                                          )}
                                                      </div>

                                                      {/* Infos de l'épisode */}
                                                      <div className="flex-1 p-3.5 min-w-0">
                                                          <span className="text-[10px] font-extrabold text-brand-accent uppercase tracking-wider mb-0.5 block">
                                                              Épisode {epNum}{tmdbEp?.runtime ? ` · ${tmdbEp.runtime} min` : ''}
                                                          </span>
                                                          <p className="text-sm font-semibold text-white truncate mb-1" title={tmdbEp?.name || file.filename}>
                                                              {tmdbEp?.name || file.filename}
                                                          </p>
                                                          {tmdbEp?.overview ? (
                                                              <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
                                                                  {tmdbEp.overview}
                                                              </p>
                                                          ) : (
                                                              <p className="text-[10px] text-text-muted truncate">{file.filename}</p>
                                                          )}
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                 </div>
                             </div>
                         ) : (
                             /* Cas d'un Film : Liste simple des vidéos */
                             <div className="space-y-4">
                                 <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                      <h2 className="text-lg font-bold text-white tracking-wide">
                                           Fichier Vidéo
                                      </h2>
                                      <span className="text-xs text-text-secondary font-mono">
                                          {filesToShow.length} fichier(s)
                                      </span>
                                 </div>

                                 {error && (
                                     <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center animate-pulse">
                                         <Icons.AlertCircle className="mr-3" />
                                         {error}
                                     </div>
                                 )}

                                 {filesToShow.length === 0 ? (
                                     <div className="text-center py-10 bg-brand-800/10 rounded-2xl border border-dashed border-white/10">
                                         <Icons.Film className="mx-auto h-10 w-10 text-text-muted mb-2" />
                                         <p className="text-text-secondary text-sm">Aucun fichier vidéo trouvé.</p>
                                     </div>
                                 ) : (
                                     <div className="space-y-3">
                                         {filesToShow.map((file, idx) => {
                                             const progressKey = `${magnet.id}_${idx}`;
                                             const progress = historyList[progressKey];
                                             return (
                                                 <div 
                                                     key={idx}
                                                     className="bg-brand-900/60 hover:bg-brand-800 border border-white/5 rounded-2xl p-4 flex flex-col justify-between group transition-all"
                                                 >
                                                     <div className="flex items-center justify-between mb-3 min-w-0">
                                                         <div className="min-w-0 mr-4 flex items-center">
                                                             <Icons.Film size={18} className="text-brand-accent mr-3 flex-shrink-0" />
                                                             <p className="text-sm font-semibold text-white truncate" title={file.filename}>
                                                                 {file.filename}
                                                             </p>
                                                         </div>
                                                         
                                                         <button
                                                             onClick={() => handlePlay({ filename: file.filename, link: file.link, magnetId: magnet.id, fileIndex: idx })}
                                                             disabled={unlocking === file.link}
                                                             className="flex-none flex items-center justify-center bg-white text-black h-10 w-20 rounded-xl hover:bg-brand-accent hover:scale-105 active:scale-95 transition-all disabled:opacity-50 font-bold text-xs"
                                                         >
                                                             {unlocking === file.link ? (
                                                                 <Icons.RefreshCw className="animate-spin h-4 w-4" />
                                                             ) : (
                                                                 <>
                                                                     <Icons.Play size={12} fill="currentColor" className="mr-1" />
                                                                     Lire
                                                                 </>
                                                             )}
                                                         </button>
                                                     </div>

                                                     {/* Barre de progression si déjà commencé */}
                                                     {progress && (
                                                         <div className="w-full">
                                                             <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                                                 <div className="h-full bg-brand-accent" style={{ width: `${progress.percentage}%` }}></div>
                                                             </div>
                                                             <div className="flex justify-between text-[9px] text-text-secondary mt-1">
                                                                 <span>Reprendre à {Math.floor(progress.currentTime / 60)} min</span>
                                                                 <span>{progress.percentage.toFixed(0)}% vu</span>
                                                             </div>
                                                         </div>
                                                     )}
                                                 </div>
                                             );
                                         })}
                                     </div>
                                 )}
                             </div>
                         )}
                     </div>

                     {/* Films ou Séries Similaires */}
                     {similarMedias.length > 0 && (
                         <div>
                             <h3 className="text-lg font-bold text-white mb-4 tracking-wide">
                                 Recommandations similaires
                             </h3>
                             <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                 {similarMedias.map((s) => {
                                     const poster = TMDBService.getImageUrl(s.poster_path, 'w200');
                                     return (
                                         <div 
                                             key={s.id} 
                                             className="relative aspect-[2/3] rounded-xl overflow-hidden bg-brand-800 border border-white/5 shadow-md"
                                         >
                                             {poster ? (
                                                 <img src={poster} alt={s.title || s.name} className="w-full h-full object-cover" />
                                             ) : (
                                                 <div className="w-full h-full p-2 flex items-center justify-center text-center text-[10px] text-text-secondary">
                                                     {s.title || s.name}
                                                 </div>
                                             )}
                                             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                                                 <span className="text-[9px] text-white truncate w-full font-bold">{s.title || s.name}</span>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>
                     )}

                 </div>

                 {/* COLONNE DROITE (UN TIERS) : INFOS TECHNIQUES & CASTING */}
                 <div className="space-y-8">
                     
                     {/* Infos techniques additionnelles */}
                     <div className="bg-brand-800/40 border border-white/5 p-6 rounded-3xl space-y-4">
                         <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-white/5 pb-2">Informations</h3>
                         
                         <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-semibold">
                             <div className="text-text-secondary">Titre original :</div>
                             <div className="text-white truncate" title={magnet.filename}>{magnet.filename}</div>

                             {details?.runtime && (
                                 <>
                                     <div className="text-text-secondary">Durée :</div>
                                     <div className="text-white">{Math.floor(details.runtime / 60)}h {details.runtime % 60}m</div>
                                 </>
                             )}

                             {details?.number_of_seasons && (
                                 <>
                                     <div className="text-text-secondary">Saisons :</div>
                                     <div className="text-white">{details.number_of_seasons}</div>
                                 </>
                             )}

                             {details?.number_of_episodes && (
                                 <>
                                     <div className="text-text-secondary">Épisodes :</div>
                                     <div className="text-white">{details.number_of_episodes}</div>
                                 </>
                             )}

                             <div className="text-text-secondary">Statut de téléchargement :</div>
                             <div className="text-white capitalize">{magnet.status}</div>
                         </div>

                         {/* Bande annonce bouton */}
                         {details?.videos?.results && details.videos.results.length > 0 && (
                             <a 
                                 href={`https://www.youtube.com/watch?v=${details.videos.results[0].key}`}
                                  target="_blank"
                                 rel="noopener noreferrer"
                                 className="btn-glass w-full flex items-center justify-center font-bold text-xs py-2.5 mt-4"
                             >
                                 <Icons.Play size={12} className="mr-1.5" />
                                 Regarder la Bande-annonce
                             </a>
                         )}
                     </div>

                     {/* CONTRÔLE PARENTAL : MODE ENFANTS OVERRIDE */}
                     {!kidsMode && (
                         <div className="bg-brand-800/40 border border-white/5 p-6 rounded-3xl space-y-4">
                             <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-white/5 pb-2 flex items-center">
                                 <span className="mr-1.5">🧸</span> Autorisation Enfant
                             </h3>
                             
                             <p className="text-[10px] text-gray-400 leading-relaxed">
                                 Décidez manuellement si ce contenu doit figurer ou non dans la bibliothèque de vos enfants en Mode Enfants.
                             </p>
                             
                             <div className="grid grid-cols-3 gap-1 bg-brand-900/60 p-1 rounded-xl">
                                 {[
                                     { id: 'default', label: 'Auto' },
                                     { id: 'allow', label: 'Autoriser' },
                                     { id: 'block', label: 'Masquer' }
                                 ].map(opt => {
                                     const isActive = opt.id === 'default' 
                                         ? kidsOverride === undefined 
                                         : opt.id === 'allow' 
                                             ? kidsOverride === true 
                                             : kidsOverride === false;
                                             
                                     return (
                                         <button
                                             key={opt.id}
                                             onClick={() => handleKidsOverrideChange(opt.id)}
                                             className={`py-2 text-[10px] font-extrabold rounded-lg transition-all ${
                                                 isActive 
                                                     ? opt.id === 'allow' 
                                                         ? 'bg-green-600 text-white shadow-sm'
                                                         : opt.id === 'block'
                                                             ? 'bg-red-600 text-white shadow-sm'
                                                             : 'bg-white text-black shadow-sm'
                                                     : 'text-gray-400 hover:text-white'
                                             }`}
                                         >
                                             {opt.label}
                                         </button>
                                     );
                                 })}
                             </div>
                         </div>
                     )}

                     {/* Casting (Acteurs) */}
                     {details?.credits?.cast && details.credits.cast.length > 0 && (
                         <div className="bg-brand-800/40 border border-white/5 p-6 rounded-3xl">
                             <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-white/5 pb-2 mb-4">Casting</h3>
                             <div className="space-y-4 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                                 {details.credits.cast.slice(0, 10).map((actor) => {
                                     const profile = TMDBService.getImageUrl(actor.profile_path, 'w200');
                                     return (
                                         <div key={actor.id} className="flex items-center space-x-3.5">
                                             {profile ? (
                                                 <img 
                                                     src={profile} 
                                                     alt={actor.name} 
                                                     className="w-10 h-10 rounded-full object-cover border border-white/10"
                                                 />
                                             ) : (
                                                 <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-[10px] font-bold text-text-muted border border-white/10">
                                                     {actor.name.substring(0, 2).toUpperCase()}
                                                 </div>
                                             )}
                                             <div className="min-w-0">
                                                 <p className="text-xs font-bold text-white truncate">{actor.name}</p>
                                                 <p className="text-[10px] text-text-secondary truncate">{actor.character}</p>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>
                     )}

                 </div>

             </div>

            {/* MODALE DE CORRECTION DES INFOS METADONNEES */}
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