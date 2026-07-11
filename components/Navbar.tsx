import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icons } from './Icon';

export const Navbar: React.FC = () => {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { path: '/', icon: Icons.Film, label: 'Bibliothèque' },
        { path: '/settings', icon: Icons.Settings, label: 'Paramètres' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto bg-brand-900/90 backdrop-blur-md border-t md:border-b md:border-t-0 border-white/10 z-50 safe-area-pb">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-around md:justify-start md:space-x-8 h-16 items-center">
                    <div className="hidden md:block font-bold text-xl text-brand-accent tracking-tighter mr-8">
                        StreamFlow
                    </div>
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-2 px-4 py-2 rounded-lg transition-colors ${
                                isActive(item.path) 
                                    ? 'text-brand-accent' 
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <item.icon size={24} strokeWidth={isActive(item.path) ? 2.5 : 2} />
                            <span className="text-xs md:text-sm font-medium">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
};