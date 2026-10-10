import React, { createContext, useContext, useState, useEffect } from 'react';
import { FirebaseService, isFirebaseConfigured } from '../services/firebase';
import { User } from 'firebase/auth';

interface AppContextType {
    adApiKey: string;
    tmdbApiKey: string;
    isLocked: boolean;
    savedPin: string;
    firebaseUser: User | null;
    firebaseLoading: boolean;
    firebaseConfigured: boolean;
    setAdApiKey: (key: string) => void;
    setTmdbApiKey: (key: string) => void;
    setSavedPin: (pin: string) => void;
    setIsLocked: (locked: boolean) => void;
    logoutAlldebrid: () => void;
    logoutTmdb: () => void;
    saveConfig: (adKey: string, tmdbKey: string) => Promise<void>;
    syncWithFirebase: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [adApiKey, setAdApiKeyInternal] = useState<string>(() => {
        return (localStorage.getItem('ad_apikey') || localStorage.getItem('ad_api_key') || '').trim();
    });
    const [tmdbApiKey, setTmdbApiKeyInternal] = useState<string>(() => {
        return (localStorage.getItem('tmdb_apikey') || localStorage.getItem('tmdb_api_key') || '').trim();
    });
    const [savedPin, setSavedPinInternal] = useState<string>(() => {
        return (localStorage.getItem('settings_pin') || '').trim();
    });
    const [isLocked, setIsLocked] = useState<boolean>(() => {
        return !!localStorage.getItem('settings_pin');
    });

    // Firebase Auth State
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [firebaseLoading, setFirebaseLoading] = useState(true);
    const [firebaseConfigured, setFirebaseConfigured] = useState(isFirebaseConfigured());

    // Sync any legacy storage format on mount once
    useEffect(() => {
        if (adApiKey) {
            localStorage.setItem('ad_apikey', adApiKey);
            localStorage.setItem('ad_api_key', adApiKey);
        }
        if (tmdbApiKey) {
            localStorage.setItem('tmdb_apikey', tmdbApiKey);
            localStorage.setItem('tmdb_api_key', tmdbApiKey);
        }
    }, [adApiKey, tmdbApiKey]);

    // Setup Firebase Auth listener if configured
    useEffect(() => {
        setFirebaseConfigured(isFirebaseConfigured());
        if (!isFirebaseConfigured()) {
            setFirebaseLoading(false);
            return;
        }

        const unsubscribe = FirebaseService.onAuthStateChanged(async (user) => {
            setFirebaseUser(user);
            setFirebaseLoading(false);

            if (user) {
                // If logged in, fetch keys from Firestore (gives cloud backup priority)
                try {
                    const cloudConfig = await FirebaseService.getDoc('config', 'keys');
                    if (cloudConfig) {
                        if (cloudConfig.adApiKey && cloudConfig.adApiKey !== adApiKey) {
                            localStorage.setItem('ad_apikey', cloudConfig.adApiKey);
                            setAdApiKeyInternal(cloudConfig.adApiKey);
                        }
                        if (cloudConfig.tmdbApiKey && cloudConfig.tmdbApiKey !== tmdbApiKey) {
                            localStorage.setItem('tmdb_apikey', cloudConfig.tmdbApiKey);
                            setTmdbApiKeyInternal(cloudConfig.tmdbApiKey);
                        }
                        if (cloudConfig.savedPin && cloudConfig.savedPin !== savedPin) {
                            localStorage.setItem('settings_pin', cloudConfig.savedPin);
                            setSavedPinInternal(cloudConfig.savedPin);
                            setIsLocked(true);
                        }
                    } else if (adApiKey || tmdbApiKey || savedPin) {
                        // If no cloud config but local keys exist, back them up to Firestore
                        await FirebaseService.saveDoc('config', 'keys', {
                            adApiKey,
                            tmdbApiKey,
                            savedPin
                        });
                    }
                } catch (e) {
                    console.error("Erreur de synchronisation initiale avec Firebase:", e);
                }
            }
        });

        // Trigger anonymous login
        FirebaseService.loginAnonymously();

        return () => unsubscribe();
    }, [firebaseConfigured]);

    const setAdApiKey = (key: string) => {
        const clean = key.trim();
        localStorage.setItem('ad_apikey', clean);
        localStorage.setItem('ad_api_key', clean);
        setAdApiKeyInternal(clean);
        if (firebaseUser) {
            FirebaseService.saveDoc('config', 'keys', { adApiKey: clean });
        }
    };

    const setTmdbApiKey = (key: string) => {
        const clean = key.trim();
        localStorage.setItem('tmdb_apikey', clean);
        localStorage.setItem('tmdb_api_key', clean);
        setTmdbApiKeyInternal(clean);
        if (firebaseUser) {
            FirebaseService.saveDoc('config', 'keys', { tmdbApiKey: clean });
        }
    };

    const setSavedPin = (pin: string) => {
        const clean = pin.trim();
        if (clean) {
            localStorage.setItem('settings_pin', clean);
            setSavedPinInternal(clean);
            setIsLocked(true);
        } else {
            localStorage.removeItem('settings_pin');
            setSavedPinInternal('');
            setIsLocked(false);
        }
        if (firebaseUser) {
            FirebaseService.saveDoc('config', 'keys', { savedPin: clean });
        }
    };

    const logoutAlldebrid = () => {
        localStorage.removeItem('ad_apikey');
        localStorage.removeItem('ad_api_key');
        setAdApiKeyInternal('');
        if (firebaseUser) {
            FirebaseService.saveDoc('config', 'keys', { adApiKey: '' });
        }
    };

    const logoutTmdb = () => {
        localStorage.removeItem('tmdb_apikey');
        localStorage.removeItem('tmdb_api_key');
        setTmdbApiKeyInternal('');
        if (firebaseUser) {
            FirebaseService.saveDoc('config', 'keys', { tmdbApiKey: '' });
        }
    };

    const saveConfig = async (adKey: string, tmdbKey: string) => {
        const cleanAd = adKey.trim();
        const cleanTmdb = tmdbKey.trim();

        if (cleanAd) {
            localStorage.setItem('ad_apikey', cleanAd);
            localStorage.setItem('ad_api_key', cleanAd);
            setAdApiKeyInternal(cleanAd);
        }
        if (cleanTmdb) {
            localStorage.setItem('tmdb_apikey', cleanTmdb);
            localStorage.setItem('tmdb_api_key', cleanTmdb);
            setTmdbApiKeyInternal(cleanTmdb);
        }

        if (firebaseUser) {
            await FirebaseService.saveDoc('config', 'keys', {
                adApiKey: cleanAd || adApiKey,
                tmdbApiKey: cleanTmdb || tmdbApiKey,
                savedPin
            });
        }
    };

    const syncWithFirebase = async () => {
        FirebaseService.reinit({
            apiKey: localStorage.getItem('fb_apikey') || '',
            authDomain: localStorage.getItem('fb_authdomain') || '',
            projectId: localStorage.getItem('fb_projectid') || '',
            storageBucket: localStorage.getItem('fb_storagebucket') || '',
            messagingSenderId: localStorage.getItem('fb_messagingid') || '',
            appId: localStorage.getItem('fb_appid') || ''
        });
        const configured = isFirebaseConfigured();
        setFirebaseConfigured(configured);
        if (configured) {
            const user = await FirebaseService.loginAnonymously();
            if (user) {
                setFirebaseUser(user);
                await FirebaseService.saveDoc('config', 'keys', {
                    adApiKey,
                    tmdbApiKey,
                    savedPin
                });
            }
        }
    };

    return (
        <AppContext.Provider value={{
            adApiKey,
            tmdbApiKey,
            isLocked,
            savedPin,
            firebaseUser,
            firebaseLoading,
            firebaseConfigured,
            setAdApiKey,
            setTmdbApiKey,
            setSavedPin,
            setIsLocked,
            logoutAlldebrid,
            logoutTmdb,
            saveConfig,
            syncWithFirebase
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp doit être utilisé dans un AppProvider');
    }
    return context;
};
