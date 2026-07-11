import React from 'react';

export const SkeletonCard: React.FC = () => {
    return (
        <div className="relative bg-brand-800 rounded-2xl overflow-hidden aspect-[2/3] w-full animate-pulse border border-white/5">
            {/* Poster area placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-700/50 to-brand-800/80"></div>
            
            {/* Top badges placeholder */}
            <div className="absolute top-2 left-2 flex gap-1 w-1/2">
                <div className="h-4 w-12 bg-white/10 rounded"></div>
                <div className="h-4 w-8 bg-white/10 rounded"></div>
            </div>

            {/* Top right icon placeholder */}
            <div className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-white/10"></div>

            {/* Bottom info placeholders */}
            <div className="absolute inset-x-0 bottom-0 p-3.5 flex flex-col space-y-2">
                <div className="h-4 w-3/4 bg-white/10 rounded-md"></div>
                <div className="h-3 w-1/2 bg-white/10 rounded-md"></div>
            </div>
        </div>
    );
};
