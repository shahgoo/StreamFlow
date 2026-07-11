import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icons } from './Icon';

export const Navbar: React.FC = () => {
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/' || location.pathname.startsWith('/view/');
        }
        return location.pathname === path;
    };

    const navItems = [
        { path: '/', icon: Icons.Film, label: 'Bibliothèque' },
        { path: '/settings', icon: Icons.Settings, label: 'Paramètres' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-0 md:right-auto md:w-24 z-50 glass-panel md:border-r md:border-t-0 border-t border-white/10 md:flex md:flex-col md:items-center md:py-8 safe-area-pb">
            {/* Logo StreamFlow uniquement visible sur tablette en haut */}
            <div className="hidden md:flex flex-col items-center mb-12">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-accent to-amber-600 flex items-center justify-center shadow-lg shadow-brand-glow">
                    <Icons.Play size={24} className="text-black ml-0.5" fill="currentColor" />
                </div>
                <span className="text-[10px] uppercase font-bold text-brand-accent tracking-widest mt-2">Flow</span>
            </div>

            {/* Liens de navigation */}
            <div className="flex justify-around md:flex-col md:space-y-6 md:justify-start w-full px-2 md:px-0">
                {navItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`relative flex flex-col items-center justify-center py-3 px-1 md:py-4 md:w-20 md:mx-auto rounded-2xl transition-all duration-300 ${
                                active 
                                    ? 'text-brand-accent bg-white/5 md:shadow-inner' 
                                    : 'text-gray-400 hover:text-text-primary hover:bg-white/5'
                            }`}
                        >
                            {/* Petit indicateur lumineux actif sur le côté pour tablette */}
                            {active && (
                                <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-brand-accent rounded-r-md hidden md:block" />
                            )}
                            <item.icon 
                                size={24} 
                                strokeWidth={active ? 2.5 : 2} 
                                className={`transition-transform duration-300 ${active ? 'scale-105' : 'group-hover:scale-105'}`} 
                            />
                            <span className="text-[10px] md:text-xs font-semibold mt-1 tracking-wide text-center">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>

            {/* Version / Infos en bas pour tablette */}
            <div className="hidden md:block mt-auto text-center">
                <span className="text-[9px] text-text-muted font-mono">v1.3.0</span>
            </div>
        </nav>
    );
};