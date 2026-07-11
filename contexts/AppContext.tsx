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
    const [adApiKey, setAdApiKeyInternal] = useState('');
    const [tmdbApiKey, setTmdbApiKeyInternal] = useState('');
    const [savedPin, setSavedPinInternal] = useState('');
    const [isLocked, setIsLocked] = useState(false);

    // Firebase Auth State
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [firebaseLoading, setFirebaseLoading] = useState(true);
    const [firebaseConfigured, setFirebaseConfigured] = useState(isFirebaseConfigured());

    // Load initial local config
    useEffect(() => {
        const storedAd = localStorage.getItem('ad_apikey') || '';
        const storedTmdb = localStorage.getItem('tmdb_apikey') || '';
        const storedPin = localStorage.getItem('settings_pin') || '';

        if (storedAd) setAdApiKeyInternal(storedAd);
        if (storedTmdb) setTmdbApiKeyInternal(storedTmdb);
        if (storedPin) {
            setSavedPinInternal(storedPin);
            setIsLocked(true);
        }
    }, []);

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
        localStorage.setItem('ad_apikey', key);
        setAdApiKeyInternal(key);
        if (firebaseUser) {
            FirebaseService.saveDoc('config', 'keys', { adApiKey: key });
        }
    };

    const setTmdbApiKey = (key: string) => {
        localStorage.setItem('tmdb_apikey', key);
        setTmdbApiKeyInternal(key);
        if (firebaseUser) {
            FirebaseService.saveDoc('config', 'keys', { tmdbApiKey: key });
        }
    };

    const setSavedPin = (pin: string) => {
        if (pin) {
            localStorage.setItem('settings_pin', pin);
            setSavedPinInternal(pin);
            setIsLocked(true);
        } else {
            localStorage.removeItem('settings_pin');
            setSavedPinInternal('');
            setIsLocked(false);
        }
        if (firebaseUser) {
            FirebaseService.saveDoc('config', 'keys', { savedPin: pin });
        }
    };

    const logoutAlldebrid = () => {
        localStorage.removeItem('ad_apikey');
        setAdApiKeyInternal('');
        if (firebaseUser) {
            FirebaseService.saveDoc('config', 'keys', { adApiKey: '' });
        }
    };

    const logoutTmdb = () => {
        localStorage.removeItem('tmdb_apikey');
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
            setAdApiKeyInternal(cleanAd);
        }
        if (cleanTmdb) {
            localStorage.setItem('tmdb_apikey', cleanTmdb);
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
        setFirebaseConfigured(isFirebaseConfigured());
        if (isFirebaseConfigured()) {
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
