import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Library } from './pages/Library';
import { Settings } from './pages/Settings';
import { Details } from './pages/Details';
import { Player } from './pages/Player';
import { Setup } from './pages/Setup';
import { AppProvider } from './contexts/AppContext';

const App: React.FC = () => {
    return (
        <AppProvider>
            <HashRouter>
                <div className="min-h-screen bg-brand-900 text-white font-sans selection:bg-brand-accent selection:text-black">
                    <div className="pb-16 md:pb-0 md:pt-16">
                        <Routes>
                            <Route path="/" element={<Library />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/view/:id" element={<Details />} />
                            <Route path="/player" element={<Player />} />
                            <Route path="/setup/:config" element={<Setup />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </div>
                    <Navbar />
                </div>
            </HashRouter>
        </AppProvider>
    );
};

export default App;