import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, deleteDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localStorage.getItem('fb_apikey') || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localStorage.getItem('fb_authdomain') || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localStorage.getItem('fb_projectid') || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localStorage.getItem('fb_storagebucket') || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localStorage.getItem('fb_messagingid') || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || localStorage.getItem('fb_appid') || '',
};

// Vérifie si la configuration minimale est présente
export const isFirebaseConfigured = () => {
    return !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
};

let app: any = null;
let db: any = null;
let auth: any = null;

const initFirebase = () => {
    if (isFirebaseConfigured() && !app) {
        try {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
        } catch (error) {
            console.error("Erreur d'initialisation Firebase:", error);
        }
    }
};

// Initialiser au chargement si possible
initFirebase();

export const FirebaseService = {
    /**
     * Initialise Firebase dynamiquement (utile si les clés sont entrées dans les paramètres)
     */
    reinit: (config: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId: string;
        appId: string;
    }) => {
        localStorage.setItem('fb_apikey', config.apiKey);
        localStorage.setItem('fb_authdomain', config.authDomain);
        localStorage.setItem('fb_projectid', config.projectId);
        localStorage.setItem('fb_storagebucket', config.storageBucket);
        localStorage.setItem('fb_messagingid', config.messagingSenderId);
        localStorage.setItem('fb_appid', config.appId);

        firebaseConfig.apiKey = config.apiKey;
        firebaseConfig.authDomain = config.authDomain;
        firebaseConfig.projectId = config.projectId;
        firebaseConfig.storageBucket = config.storageBucket;
        firebaseConfig.messagingSenderId = config.messagingSenderId;
        firebaseConfig.appId = config.appId;

        app = null;
        db = null;
        auth = null;
        initFirebase();
    },

    /**
     * Connexion anonyme
     */
    loginAnonymously: (): Promise<User | null> => {
        initFirebase();
        if (!auth) return Promise.resolve(null);

        return new Promise((resolve) => {
            signInAnonymously(auth)
                .then((result) => {
                    resolve(result.user);
                })
                .catch((error) => {
                    console.error("Erreur de connexion anonyme Firebase:", error);
                    resolve(null);
                });
        });
    },

    /**
     * Écoute l'état de l'authentification
     */
    onAuthStateChanged: (callback: (user: User | null) => void) => {
        initFirebase();
        if (!auth) {
            callback(null);
            return () => {};
        }
        return onAuthStateChanged(auth, callback);
    },

    /**
     * Enregistre un document Firestore
     */
    saveDoc: async (collectionName: string, docId: string, data: any): Promise<boolean> => {
        initFirebase();
        if (!db || !auth?.currentUser) return false;

        try {
            const userDocRef = doc(db, 'users', auth.currentUser.uid, collectionName, docId);
            await setDoc(userDocRef, {
                ...data,
                updatedAt: Date.now()
            }, { merge: true });
            return true;
        } catch (e) {
            console.error(`Erreur d'écriture dans ${collectionName}/${docId} :`, e);
            return false;
        }
    },

    /**
     * Charge un document Firestore
     */
    getDoc: async (collectionName: string, docId: string): Promise<any | null> => {
        initFirebase();
        if (!db || !auth?.currentUser) return null;

        try {
            const userDocRef = doc(db, 'users', auth.currentUser.uid, collectionName, docId);
            const snapshot = await getDoc(userDocRef);
            if (snapshot.exists()) {
                return snapshot.data();
            }
            return null;
        } catch (e) {
            console.error(`Erreur de lecture de ${collectionName}/${docId} :`, e);
            return null;
        }
    },

    /**
     * Supprime un document Firestore
     */
    deleteDoc: async (collectionName: string, docId: string): Promise<boolean> => {
        initFirebase();
        if (!db || !auth?.currentUser) return false;

        try {
            const userDocRef = doc(db, 'users', auth.currentUser.uid, collectionName, docId);
            await deleteDoc(userDocRef);
            return true;
        } catch (e) {
            console.error(`Erreur de suppression de ${collectionName}/${docId} :`, e);
            return false;
        }
    },

    /**
     * Charge toute une collection pour l'utilisateur connecté
     */
    getCollection: async (collectionName: string): Promise<any[]> => {
        initFirebase();
        if (!db || !auth?.currentUser) return [];

        try {
            const colRef = collection(db, 'users', auth.currentUser.uid, collectionName);
            const snapshot = await getDocs(query(colRef));
            const items: any[] = [];
            snapshot.forEach((d) => {
                items.push({ id: d.id, ...d.data() });
            });
            return items;
        } catch (e) {
            console.error(`Erreur de récupération de la collection ${collectionName} :`, e);
            return [];
        }
    }
};
