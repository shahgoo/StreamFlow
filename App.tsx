import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Library } from './pages/Library';
import { AppProvider } from './contexts/AppContext';

// Lazy-load secondary pages for lightning-fast initial load & fluid transitions
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Details = lazy(() => import('./pages/Details').then(m => ({ default: m.Details })));
const Player = lazy(() => import('./pages/Player').then(m => ({ default: m.Player })));
const Setup = lazy(() => import('./pages/Setup').then(m => ({ default: m.Setup })));

const PageLoader = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin"></div>
    </div>
);

const App: React.FC = () => {
    return (
        <AppProvider>
            <HashRouter>
                <div className="min-h-screen bg-brand-900 text-white font-sans selection:bg-brand-accent selection:text-black">
                    <div className="pb-20 md:pb-0 md:pl-24">
                        <Suspense fallback={<PageLoader />}>
                            <Routes>
                                <Route path="/" element={<Library />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/view/:id" element={<Details />} />
                                <Route path="/player" element={<Player />} />
                                <Route path="/setup/:config" element={<Setup />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </Suspense>
                    </div>
                    <Navbar />
                </div>
            </HashRouter>
        </AppProvider>
    );
};

export default App;