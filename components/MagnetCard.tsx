import React from 'react';
import { Magnet } from '../types';
import { Icons } from './Icon';
import { TMDBService } from '../services/tmdb';

interface MagnetCardProps {
    magnet: Magnet;
    posterPath?: string | null;
    onClick: (magnet: Magnet) => void;
}

// Helper to clean filenames for display (fallback)
const cleanName = (name: string) => {
    return name
        .replace(/\./g, ' ')
        .replace(/(1080p|720p|2160p|4k|bluray|x264|x265|hevc|web-dl|hdr).*/i, '')
        .trim();
};

// Generate a deterministic color gradient based on string
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

export const MagnetCard: React.FC<MagnetCardProps> = ({ magnet, posterPath, onClick }) => {
    const displayName = cleanName(magnet.filename);
    const isReady = magnet.statusCode === 4;
    
    const fallbackGradient = `linear-gradient(135deg, ${stringToColor(magnet.filename)}AA 0%, #1e293b 100%)`;
    const posterUrl = TMDBService.getImageUrl(posterPath);

    return (
        <div 
            onClick={() => onClick(magnet)}
            className="group relative bg-brand-800 rounded-xl overflow-hidden shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:ring-2 hover:ring-brand-accent/50 aspect-[2/3]"
        >
            {/* Poster or Gradient Placeholder */}
            {posterUrl ? (
                <div className="absolute inset-0 w-full h-full bg-brand-900">
                     <img 
                        src={posterUrl} 
                        alt={displayName} 
                        loading="lazy"
                        className="w-full h-full object-cover transition-opacity duration-300 opacity-90 group-hover:opacity-100" 
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                </div>
            ) : (
                <div 
                    className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity opacity-80 group-hover:opacity-100"
                    style={{ background: fallbackGradient }}
                >
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                         <span className="text-white font-bold text-center text-lg drop-shadow-md break-words line-clamp-4">
                            {displayName}
                         </span>
                    </div>
                </div>
            )}

            {/* Status Overlay */}
            <div className="absolute top-2 right-2 z-10">
                {isReady ? (
                    <div className="bg-green-500/90 text-white p-1.5 rounded-full shadow-sm backdrop-blur-md">
                        <Icons.Play size={12} fill="currentColor" />
                    </div>
                ) : (
                    <div className="bg-yellow-500/90 text-white p-1.5 rounded-full shadow-sm animate-pulse backdrop-blur-md">
                         <Icons.RefreshCw size={12} />
                    </div>
                )}
            </div>

            {/* Bottom Info */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/60 to-transparent flex flex-col justify-end p-3 z-10 pointer-events-none">
                 <p className="text-white text-xs font-semibold truncate opacity-100 shadow-black drop-shadow-md">{displayName}</p>
                 <p className="text-gray-300 text-[10px] mt-0.5 uppercase tracking-wide font-medium">
                    {magnet.status} • {(magnet.size / 1024 / 1024 / 1024).toFixed(2)} GB
                 </p>
            </div>
        </div>
    );
};