import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icon';
import { AlldebridService } from '../services/alldebrid';
import { TMDBService } from '../services/tmdb';
import { useApp } from '../contexts/AppContext';

type ApiStatus = 'idle' | 'checking' | 'valid' | 'invalid';

export const Settings: React.FC = () => {
    const {
        adApiKey,
        tmdbApiKey,
        savedPin: contextPin,
        isLocked: contextLocked,
        setAdApiKey,
        setTmdbApiKey,
        setSavedPin,
        logoutAlldebrid,
        logoutTmdb
    } = useApp();

    // Auth State
    const [isLocked, setIsLocked] = useState(contextLocked);
    const [pinInput, setPinInput] = useState('');
    const [authError, setAuthError] = useState(false);

    // Settings State
    const [apiKey, setApiKey] = useState(adApiKey);
    const [tmdbKey, setTmdbKey] = useState(tmdbApiKey);
    const [savedPin, setSavedPinState] = useState(contextPin);
    
    // UI State
    const [adStatus, setAdStatus] = useState<ApiStatus>('idle');
    const [tmdbStatus, setTmdbStatus] = useState<ApiStatus>('idle');
    const [saved, setSaved] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [newPin, setNewPin] = useState('');

    useEffect(() => {
        if (contextPin) {
            setSavedPinState(contextPin);
            setIsLocked(contextLocked);
        } else {
            setSavedPinState('');
            setIsLocked(false);
        }
    }, [contextPin, contextLocked]);

    useEffect(() => {
        if (adApiKey) {
            setApiKey(adApiKey);
            verifyAlldebrid(adApiKey);
        } else {
            setApiKey('');
            setAdStatus('idle');
        }
    }, [adApiKey]);

    useEffect(() => {
        if (tmdbApiKey) {
            setTmdbKey(tmdbApiKey);
            verifyTmdb(tmdbApiKey);
        } else {
            setTmdbKey('');
            setTmdbStatus('idle');
        }
    }, [tmdbApiKey]);

    const handleUnlock = () => {
        if (pinInput === savedPin) {
            setIsLocked(false);
            setAuthError(false);
        } else {
            setAuthError(true);
            setPinInput('');
        }
    };

    const handleSetPin = () => {
        if (newPin.length === 4) {
            setSavedPin(newPin);
            setSavedPinState(newPin);
            setNewPin('');
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    const handleRemovePin = () => {
        setSavedPin('');
        setSavedPinState('');
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const verifyAlldebrid = async (key: string) => {
        if (!key) return;
        setAdStatus('checking');
        const isValid = await AlldebridService.verifyKey(key);
        setAdStatus(isValid ? 'valid' : 'invalid');
    };

    const verifyTmdb = async (key: string) => {
        if (!key) return;
        setTmdbStatus('checking');
        const isValid = await TMDBService.verifyKey(key);
        setTmdbStatus(isValid ? 'valid' : 'invalid');
    };

    const handleSave = async () => {
        let hasChanges = false;
        
        if (apiKey.trim() !== adApiKey) {
            setAdApiKey(apiKey.trim());
            await verifyAlldebrid(apiKey.trim());
            hasChanges = true;
        }
        
        if (tmdbKey.trim() !== tmdbApiKey) {
            setTmdbApiKey(tmdbKey.trim());
            await verifyTmdb(tmdbKey.trim());
            hasChanges = true;
        }
        
        if (hasChanges) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    const handleLogout = () => {
        logoutAlldebrid();
        setApiKey('');
        setAdStatus('idle');
    };

    const handleClearTmdb = () => {
        logoutTmdb();
        setTmdbKey('');
        setTmdbStatus('idle');
    };

    const generateShareLink = () => {
        if (!apiKey) return;
        
        const config = {
            ad_apikey: apiKey,
            tmdb_apikey: tmdbKey || undefined
        };
        
        // Create base64 string
        const base64Config = btoa(JSON.stringify(config));
        // Use HashRouter format
        const link = `${window.location.origin}${window.location.pathname}#/setup/${base64Config}`;
        
        setGeneratedLink(link);
        setShowShare(true);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const StatusIcon = ({ status }: { status: ApiStatus }) => {
        if (status === 'checking') return <Icons.RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />;
        if (status === 'valid') return <Icons.CheckCircle className="h-5 w-5 text-green-500" />;
        if (status === 'invalid') return <Icons.XCircle className="h-5 w-5 text-red-500" />;
        return <div className="h-5 w-5 rounded-full border-2 border-gray-600"></div>;
    };

    // LOCKED VIEW
    if (isLocked) {
        return (
            <div className="min-h-screen pt-20 px-4 flex flex-col items-center max-w-md mx-auto">
                <div className="bg-brand-800 p-8 rounded-2xl shadow-2xl border border-white/5 w-full text-center">
                    <div className="mx-auto bg-brand-900 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                        <Icons.Lock size={32} className="text-brand-accent" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Paramètres verrouillés</h2>
                    <p className="text-gray-400 text-sm mb-6">Entrez votre code PIN pour accéder à la configuration.</p>
                    
                    <div className="flex justify-center space-x-2 mb-6">
                         {[0, 1, 2, 3].map((_, i) => (
                             <div 
                                key={i} 
                                className={`w-4 h-4 rounded-full border border-gray-600 transition-all ${pinInput.length > i ? 'bg-brand-accent border-brand-accent' : 'bg-transparent'}`}
                             ></div>
                         ))}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button 
                                key={num}
                                onClick={() => {
                                    if (pinInput.length < 4) setPinInput(prev => prev + num);
                                }}
                                className="h-12 bg-brand-900 rounded-lg text-lg font-bold hover:bg-brand-700 transition-colors"
                            >
                                {num}
                            </button>
                        ))}
                        <button 
                            onClick={() => setPinInput('')}
                            className="h-12 flex items-center justify-center text-gray-400 hover:text-white"
                        >
                            Effacer
                        </button>
                        <button 
                            onClick={() => {
                                if (pinInput.length < 4) setPinInput(prev => prev + '0');
                            }}
                             className="h-12 bg-brand-900 rounded-lg text-lg font-bold hover:bg-brand-700 transition-colors"
                        >
                            0
                        </button>
                        <button 
                            onClick={handleUnlock}
                            className="h-12 bg-brand-accent text-black rounded-lg text-lg font-bold hover:bg-amber-600 transition-colors flex items-center justify-center"
                        >
                            <Icons.Check size={20} />
                        </button>
                    </div>
                    
                    {authError && <p className="text-red-400 text-sm animate-pulse">Code PIN incorrect</p>}
                </div>
            </div>
        );
    }

    // UNLOCKED VIEW
    return (
        <div className="min-h-screen pt-4 px-4 md:px-8 max-w-3xl mx-auto pb-24">
            <h1 className="text-3xl font-bold text-white mb-8">Paramètres</h1>

            {/* Status Dashboard */}
            <div className="bg-brand-800 rounded-xl p-6 shadow-lg border border-white/5 mb-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">État des Services</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-brand-900 rounded-lg border border-white/5">
                        <div className="flex items-center">
                            <div className={`p-2 rounded-full mr-3 ${adStatus === 'valid' ? 'bg-green-500/10' : 'bg-gray-700/50'}`}>
                                <Icons.Settings className={`h-5 w-5 ${adStatus === 'valid' ? 'text-green-500' : 'text-gray-400'}`} />
                            </div>
                            <div>
                                <p className="font-medium text-white">Alldebrid</p>
                                <p className="text-xs text-gray-500">Source principale des fichiers</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                             <span className={`text-xs font-bold px-2 py-1 rounded ${
                                 adStatus === 'valid' ? 'text-green-400 bg-green-900/20' : 
                                 adStatus === 'invalid' ? 'text-red-400 bg-red-900/20' : 'text-gray-500'
                             }`}>
                                 {adStatus === 'valid' ? 'CONNECTÉ' : adStatus === 'invalid' ? 'ERREUR' : 'NON CONFIGURÉ'}
                             </span>
                             <StatusIcon status={adStatus} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-brand-900 rounded-lg border border-white/5">
                        <div className="flex items-center">
                             <div className={`p-2 rounded-full mr-3 ${tmdbStatus === 'valid' ? 'bg-blue-500/10' : 'bg-gray-700/50'}`}>
                                <Icons.Film className={`h-5 w-5 ${tmdbStatus === 'valid' ? 'text-blue-500' : 'text-gray-400'}`} />
                            </div>
                            <div>
                                <p className="font-medium text-white">TheMovieDB</p>
                                <p className="text-xs text-gray-500">Pochettes et métadonnées</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                             <span className={`text-xs font-bold px-2 py-1 rounded ${
                                 tmdbStatus === 'valid' ? 'text-green-400 bg-green-900/20' : 
                                 tmdbStatus === 'invalid' ? 'text-red-400 bg-red-900/20' : 'text-gray-500'
                             }`}>
                                 {tmdbStatus === 'valid' ? 'ACTIF' : tmdbStatus === 'invalid' ? 'ERREUR' : 'INACTIF'}
                             </span>
                             <StatusIcon status={tmdbStatus} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Inputs Section */}
            <div className="space-y-6">
                
                {/* Alldebrid Input */}
                <div className="bg-brand-800 rounded-xl p-6 shadow-lg border border-white/5">
                    <label className="flex items-center text-lg font-semibold text-white mb-4">
                        <Icons.Key className="mr-2 text-brand-accent" size={20} />
                        Configuration Alldebrid
                    </label>
                    <div className="relative">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => {
                                setApiKey(e.target.value);
                                setAdStatus('idle'); // Reset status on edit
                            }}
                            placeholder="Entrez votre clé API Alldebrid"
                            className="w-full bg-brand-900 border border-gray-700 rounded-lg pl-4 pr-12 py-3 text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all"
                        />
                        <div className="absolute right-3 top-3">
                             <StatusIcon status={adStatus} />
                        </div>
                    </div>
                    {apiKey && (
                        <div className="mt-2 flex justify-end">
                            <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 flex items-center">
                                <Icons.Trash2 size={12} className="mr-1" /> Supprimer la clé
                            </button>
                        </div>
                    )}
                </div>

                {/* TMDB Input */}
                <div className="bg-brand-800 rounded-xl p-6 shadow-lg border border-white/5">
                    <label className="flex items-center text-lg font-semibold text-white mb-4">
                        <Icons.Key className="mr-2 text-blue-400" size={20} />
                        Configuration TMDB
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={tmdbKey}
                            onChange={(e) => {
                                setTmdbKey(e.target.value);
                                setTmdbStatus('idle'); // Reset status on edit
                            }}
                            placeholder="Entrez votre clé API TMDB (Optionnel)"
                            className="w-full bg-brand-900 border border-gray-700 rounded-lg pl-4 pr-12 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        />
                         <div className="absolute right-3 top-3">
                             <StatusIcon status={tmdbStatus} />
                        </div>
                    </div>
                    {tmdbKey && (
                        <div className="mt-2 flex justify-end">
                            <button onClick={handleClearTmdb} className="text-xs text-red-400 hover:text-red-300 flex items-center">
                                <Icons.Trash2 size={12} className="mr-1" /> Supprimer la clé
                            </button>
                        </div>
                    )}
                </div>

                {/* Family Sharing */}
                <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-xl p-6 shadow-lg border border-indigo-500/20">
                    <label className="flex items-center text-lg font-semibold text-white mb-2">
                        <Icons.Share2 className="mr-2 text-indigo-400" size={20} />
                        Configuration Familiale
                    </label>
                    <p className="text-sm text-gray-300 mb-4">
                        Générez un lien d'installation pour configurer automatiquement l'application sur les appareils de votre famille sans partager vos clés manuellement.
                    </p>
                    
                    {!showShare ? (
                        <button 
                            onClick={generateShareLink}
                            disabled={!apiKey}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            Créer un lien d'installation
                        </button>
                    ) : (
                        <div className="bg-brand-900 p-3 rounded-lg border border-white/10 animate-fade-in">
                            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-bold">Lien magique</p>
                            <div className="flex items-center space-x-2">
                                <input 
                                    readOnly 
                                    value={generatedLink} 
                                    className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 font-mono"
                                />
                                <button 
                                    onClick={copyToClipboard}
                                    className={`p-2 rounded-lg transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                                >
                                    {copied ? <Icons.Check size={16} /> : <Icons.Copy size={16} />}
                                </button>
                            </div>
                            <p className="text-xs text-indigo-300 mt-2">Envoyez ce lien sur l'appareil cible. Il suffit de l'ouvrir pour configurer l'application.</p>
                        </div>
                    )}
                </div>

                {/* Security PIN */}
                <div className="bg-brand-800 rounded-xl p-6 shadow-lg border border-white/5">
                    <label className="flex items-center text-lg font-semibold text-white mb-4">
                        {savedPin ? <Icons.Lock className="mr-2 text-red-400" size={20} /> : <Icons.Unlock className="mr-2 text-gray-400" size={20} />}
                        Sécurité Parental
                    </label>
                    
                    {savedPin ? (
                        <div className="flex items-center justify-between bg-brand-900 p-4 rounded-lg">
                            <div>
                                <p className="text-white font-medium">Paramètres protégés</p>
                                <p className="text-xs text-gray-500">Un code PIN est requis pour accéder à cette page.</p>
                            </div>
                            <button 
                                onClick={handleRemovePin}
                                className="px-3 py-1.5 border border-red-500/50 text-red-400 rounded-lg text-sm hover:bg-red-500/10"
                            >
                                Désactiver
                            </button>
                        </div>
                    ) : (
                        <div>
                            <p className="text-sm text-gray-400 mb-3">Définissez un code PIN à 4 chiffres pour empêcher la modification de ces réglages.</p>
                            <div className="flex space-x-2">
                                <input 
                                    type="number" 
                                    maxLength={4}
                                    placeholder="0000"
                                    value={newPin}
                                    onChange={(e) => setNewPin(e.target.value.slice(0, 4))}
                                    className="w-24 bg-brand-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-center tracking-widest outline-none focus:border-brand-accent"
                                />
                                <button 
                                    onClick={handleSetPin}
                                    disabled={newPin.length !== 4}
                                    className="px-4 py-2 bg-brand-700 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
                                >
                                    Activer
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            <button
                onClick={handleSave}
                className={`w-full mt-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95 flex items-center justify-center ${
                    saved 
                    ? 'bg-green-600 text-white' 
                    : 'bg-brand-accent hover:bg-amber-600 text-black'
                }`}
            >
                {saved ? (
                    <>
                        <Icons.CheckCircle className="mr-2" /> Paramètres enregistrés
                    </>
                ) : (
                    'Sauvegarder tout'
                )}
            </button>
            
            <div className="text-center text-gray-600 text-sm mt-12 pb-8">
                <p>StreamFlow v1.3.0 Family</p>
            </div>
        </div>
    );
};