import React, { useMemo } from 'react';
import { Magnet } from '../types';
import { Icons } from './Icon';
import { TMDBService } from '../services/tmdb';
import { parseMagnetName, isVideoFile } from '../utils/filename';
import { StorageUtils } from '../utils/storage';
import { SagaCollagePoster } from './SagaCollagePoster';

interface MagnetCardProps {
    magnet: Magnet;
    posterPath?: string | null;
    onClick: (magnet: Magnet) => void;
}

export const MagnetCard: React.FC<MagnetCardProps> = ({ magnet, posterPath, onClick }) => {
    const parsed = parseMagnetName(magnet.filename);
    const displayName = parsed.title;
    const isReady = magnet.statusCode === 4;
    
    // Gradient de fallback déterministe pour les torrents sans affiche TMDB
    const stringToColor = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    };
    
    const fallbackGradient = `linear-gradient(135deg, ${stringToColor(magnet.filename)}80 0%, #06080F 100%)`;
    const posterUrl = TMDBService.getImageUrl(posterPath, 'w500');

    // Fichiers vidéo contenus dans le magnet
    const videoFiles = useMemo(() => {
        return (magnet.links || []).filter(l => isVideoFile(l.filename));
    }, [magnet.links]);

    // Récupérer les affiches des vidéos individuelles si pas d'affiche principale
    const collagePosters = useMemo(() => {
        if (posterUrl || videoFiles.length < 2) return [];

        const cache = JSON.parse(localStorage.getItem('tmdb_cache') || '{}');
        const posters: string[] = [];

        for (const file of videoFiles) {
            // Check override first
            const override = StorageUtils.getFileOverride(magnet.id, file.filename);
            if (override?.poster_path || override?.backdrop_path) {
                const url = TMDBService.getImageUrl(override.poster_path || override.backdrop_path, 'w500');
                if (url && !posters.includes(url)) posters.push(url);
                continue;
            }

            // Check cache by parsed name
            const p = parseMagnetName(file.filename);
            const cacheKey = `movie_${p.title}_${p.year || ''}`.replace(/\s/g, '').toLowerCase();
            const cached = cache[cacheKey];
            if (cached && (cached.poster_path || cached.backdrop_path)) {
                const url = TMDBService.getImageUrl(cached.poster_path || cached.backdrop_path, 'w500');
                if (url && !posters.includes(url)) posters.push(url);
            }

            if (posters.length >= 4) break;
        }

        return posters;
    }, [posterUrl, videoFiles, magnet.id]);

    return (
        <div 
            onClick={() => onClick(magnet)}
            className="group relative bg-brand-800 rounded-2xl overflow-hidden shadow-lg cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-glow-accent-lg hover:ring-2 hover:ring-brand-accent/70 aspect-[2/3] animate-fade-in"
        >
            {/* Affiche de fond, Collage de saga ou dégradé de fallback */}
            {posterUrl ? (
                <div className="absolute inset-0 w-full h-full bg-brand-900">
                     <img 
                        src={posterUrl} 
                        alt={displayName} 
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-90 group-hover:opacity-100" 
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent"></div>
                </div>
            ) : collagePosters.length >= 2 ? (
                <SagaCollagePoster
                    posters={collagePosters}
                    count={videoFiles.length}
                    title={displayName}
                    showBadge={false}
                />
            ) : (
                <div 
                    className="absolute inset-0 w-full h-full bg-cover bg-center transition-all duration-500 group-hover:scale-105 opacity-85 group-hover:opacity-100"
                    style={{ background: fallbackGradient }}
                >
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                         <div className="w-12 h-12 rounded-full bg-brand-accent/10 flex items-center justify-center mb-3">
                              {parsed.type === 'tv' ? <Icons.Film className="text-brand-accent" size={24} /> : <Icons.Play className="text-brand-accent ml-0.5" size={24} fill="currentColor" />}
                         </div>
                         <span className="text-white font-bold text-center text-sm md:text-base drop-shadow-md break-words line-clamp-3 px-2">
                            {displayName}
                         </span>
                         {parsed.year && (
                             <span className="text-[10px] text-text-secondary mt-1 bg-white/5 px-2 py-0.5 rounded-full">
                                 {parsed.year}
                             </span>
                         )}
                    </div>
                </div>
            )}

            {/* Badges de Qualité ou de Nombre de Vidéos */}
            <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 max-w-[70%]">
                {videoFiles.length > 1 && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-brand-accent text-black uppercase tracking-wider shadow-md">
                        {videoFiles.length} vidéo{videoFiles.length > 1 ? 's' : ''}
                    </span>
                )}
                {parsed.quality && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-white border border-white/10 uppercase tracking-wider">
                        {parsed.quality}
                    </span>
                )}
                {parsed.dolbyVision && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-600/80 backdrop-blur-md text-white uppercase tracking-wider">
                        DV
                    </span>
                )}
                {parsed.hdr && !parsed.dolbyVision && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-600/80 backdrop-blur-md text-white uppercase tracking-wider">
                        HDR
                    </span>
                )}
            </div>

            {/* Icone de Status (En haut à droite) */}
            <div className="absolute top-2 right-2 z-10">
                {isReady ? (
                    <div className="bg-brand-accent text-black p-2 rounded-xl shadow-md backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                        <Icons.Play size={12} fill="currentColor" />
                    </div>
                ) : (
                    <div className="bg-black/60 text-brand-accent p-2 rounded-xl shadow-md animate-spin backdrop-blur-md">
                         <Icons.RefreshCw size={12} />
                    </div>
                )}
            </div>

            {/* Overlay d'informations au bas */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 flex flex-col justify-end p-3.5 z-10 pointer-events-none">
                 <p className="text-white text-xs md:text-sm font-bold truncate drop-shadow-md tracking-wide group-hover:text-brand-accent transition-colors duration-200">
                     {displayName}
                 </p>
                 <div className="flex items-center space-x-1.5 text-[10px] text-text-secondary mt-1 font-medium tracking-wide drop-shadow-sm">
                     {parsed.type === 'tv' && parsed.season !== undefined && (
                         <span className="text-brand-accent font-semibold">
                             S{parsed.season.toString().padStart(2, '0')}
                             {parsed.episode !== undefined && `E${parsed.episode.toString().padStart(2, '0')}`}
                         </span>
                     )}
                     {parsed.type === 'tv' && parsed.season !== undefined && <span>•</span>}
                     <span>{(magnet.size / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                 </div>
            </div>
        </div>
    );
};
