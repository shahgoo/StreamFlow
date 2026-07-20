import React from 'react';
import { Icons } from './Icon';

interface SagaCollagePosterProps {
    posters: string[];
    count: number;
    title: string;
    className?: string;
    showBadge?: boolean;
}

export const SagaCollagePoster: React.FC<SagaCollagePosterProps> = ({
    posters,
    count,
    title,
    className = "w-full h-full",
    showBadge = true
}) => {
    const validPosters = posters.filter(Boolean).slice(0, 4);

    if (validPosters.length === 0) {
        return (
            <div className={`relative ${className} bg-gradient-to-br from-brand-800 to-brand-950 flex flex-col items-center justify-center p-3 text-center`}>
                <Icons.Film size={28} className="text-brand-accent mb-2" />
                <span className="text-white text-xs font-bold line-clamp-2">{title}</span>
                {showBadge && count > 0 && (
                    <span className="absolute top-2 right-2 bg-brand-accent text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-md uppercase tracking-wider">
                        {count} vidéo{count > 1 ? 's' : ''}
                    </span>
                )}
            </div>
        );
    }

    const gridLayout = 
        validPosters.length === 1 ? 'grid-cols-1 grid-rows-1' :
        validPosters.length === 2 ? 'grid-cols-2 grid-rows-1' :
        'grid-cols-2 grid-rows-2';

    return (
        <div className={`relative ${className} bg-brand-950 overflow-hidden group`}>
            {/* Grid 2x2 ou 2x1 */}
            <div className={`grid ${gridLayout} w-full h-full gap-0.5`}>
                {validPosters.map((url, idx) => (
                    <div key={idx} className="relative w-full h-full overflow-hidden bg-brand-900">
                        <img 
                            src={url} 
                            alt={`${title} ${idx + 1}`} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100" 
                            loading="lazy"
                        />
                    </div>
                ))}
            </div>

            {/* Gradient d'ombrage */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>

            {/* Badge affichant le nombre de vidéos */}
            {showBadge && count > 0 && (
                <div className="absolute top-2 right-2 z-10">
                    <span className="bg-black/80 backdrop-blur-md text-brand-accent border border-brand-accent/40 text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-wider">
                        <Icons.Film size={10} />
                        {count} vidéo{count > 1 ? 's' : ''}
                    </span>
                </div>
            )}
        </div>
    );
};
