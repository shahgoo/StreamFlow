import React, { useEffect, useState } from 'react';
import { Icons } from './Icon';
import { TMDBService, TMDBResult } from '../services/tmdb';
import { parseMagnetName } from '../utils/filename';

interface HeroBannerProps {
    mediaItems: any[];
    onPlayClick: (magnet: any) => void;
    onDetailsClick: (magnet: any) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ mediaItems, onPlayClick, onDetailsClick }) => {
    const [featuredItem, setFeaturedItem] = useState<any | null>(null);

    useEffect(() => {
        // Filtrer les films/séries qui ont un backdrop TMDB
        const itemsWithBackdrop = mediaItems.filter(
            (item) => item.tmdbData && item.tmdbData.backdrop_path
        );

        if (itemsWithBackdrop.length > 0) {
            // Sélectionner un film au hasard
            const randomIdx = Math.floor(Math.random() * itemsWithBackdrop.length);
            setFeaturedItem(itemsWithBackdrop[randomIdx]);
        } else if (mediaItems.length > 0) {
            // Fallback sur le premier item sans backdrop
            setFeaturedItem(mediaItems[0]);
        } else {
            setFeaturedItem(null);
        }
    }, [mediaItems]);

    if (!featuredItem) return null;

    const tmdb: TMDBResult = featuredItem.tmdbData || {};
    const parsed = parseMagnetName(featuredItem.filename);
    const title = tmdb.title || tmdb.name || parsed.title;
    const year = parsed.year || (tmdb.release_date || tmdb.first_air_date)?.substring(0, 4);
    const backdropUrl = TMDBService.getImageUrl(tmdb.backdrop_path, 'w1280');

    return (
        <div className="relative w-full h-[55vh] md:h-[65vh] rounded-3xl overflow-hidden mb-8 group shadow-2xl border border-white/5 animate-fade-in">
            {/* Image de fond avec effet de zoom et fondu */}
            {backdropUrl ? (
                <div className="absolute inset-0">
                    <img 
                        src={backdropUrl} 
                        alt={title} 
                        className="w-full h-full object-cover opacity-35 group-hover:scale-105 transition-transform duration-[10s] ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/60 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-transparent to-transparent hidden md:block"></div>
                </div>
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-brand-800 to-brand-900"></div>
            )}

            {/* Contenu textuel et actions */}
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 z-10 max-w-2xl">
                {/* Badges de catégorie et qualité */}
                <div className="flex items-center space-x-2 mb-3">
                    <span className="text-[10px] font-bold tracking-widest text-brand-accent uppercase bg-brand-accent/10 px-2.5 py-1 rounded-lg border border-brand-accent/20">
                        À l'affiche
                    </span>
                    {year && (
                        <span className="text-xs text-text-secondary font-medium">
                            {year}
                        </span>
                    )}
                    {parsed.quality && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-text-primary">
                            {parsed.quality}
                        </span>
                    )}
                </div>

                {/* Titre */}
                <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight drop-shadow-md mb-3 line-clamp-2">
                    {title}
                </h1>

                {/* Synopsis */}
                {tmdb.overview && (
                    <p className="text-text-secondary text-sm md:text-base leading-relaxed mb-6 line-clamp-3 md:line-clamp-4 drop-shadow-sm font-medium">
                        {tmdb.overview}
                    </p>
                )}

                {/* Actions */}
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => onPlayClick(featuredItem)}
                        className="btn-primary flex items-center justify-center font-bold px-8 py-3.5"
                    >
                        <Icons.Play size={20} className="mr-2" fill="currentColor" />
                        Lire maintenant
                    </button>
                    <button 
                        onClick={() => onDetailsClick(featuredItem)}
                        className="btn-glass flex items-center justify-center font-semibold px-6 py-3.5 hover:bg-white/10"
                    >
                        Infos
                    </button>
                </div>
            </div>
        </div>
    );
};
