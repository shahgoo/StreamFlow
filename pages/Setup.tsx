import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icon';
import { AlldebridService } from '../services/alldebrid';

export const Setup: React.FC = () => {
    const { config } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Analyse de la configuration...');

    useEffect(() => {
        const applyConfig = async () => {
            if (!config) {
                setStatus('error');
                setMessage("Lien de configuration invalide.");
                return;
            }

            try {
                // Decode base64 config
                const decoded = atob(config);
                const settings = JSON.parse(decoded);

                if (!settings.ad_apikey) {
                    throw new Error("Configuration incomplète.");
                }

                // Verify Key
                setMessage("Vérification de la clé Alldebrid...");
                const isValid = await AlldebridService.verifyKey(settings.ad_apikey);

                if (isValid) {
                    localStorage.setItem('ad_apikey', settings.ad_apikey);
                    if (settings.tmdb_apikey) {
                        localStorage.setItem('tmdb_apikey', settings.tmdb_apikey);
                    }
                    setStatus('success');
                    setMessage("Configuration terminée avec succès !");
                } else {
                    setStatus('error');
                    setMessage("La clé Alldebrid dans ce lien n'est plus valide.");
                }

            } catch (e) {
                setStatus('error');
                setMessage("Impossible de lire le lien de configuration.");
            }
        };

        applyConfig();
    }, [config]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-brand-900">
            <div className="bg-brand-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-white/5 text-center">
                
                {status === 'loading' && (
                    <>
                        <div className="relative mx-auto w-16 h-16 mb-6">
                            <div className="absolute inset-0 border-4 border-brand-accent/30 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <h2 className="text-xl font-bold mb-2">Installation</h2>
                        <p className="text-gray-400">{message}</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="mx-auto w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6">
                            <Icons.CheckCircle size={32} />
                        </div>
                        <h2 className="text-xl font-bold mb-2 text-white">C'est prêt !</h2>
                        <p className="text-gray-400 mb-8">L'application a été configurée pour votre appareil.</p>
                        <button 
                            onClick={() => navigate('/')}
                            className="w-full py-3 bg-brand-accent hover:bg-amber-600 text-black font-bold rounded-xl transition-all shadow-lg transform active:scale-95"
                        >
                            Accéder à la bibliothèque
                        </button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="mx-auto w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
                            <Icons.XCircle size={32} />
                        </div>
                        <h2 className="text-xl font-bold mb-2 text-white">Erreur</h2>
                        <p className="text-gray-400 mb-8">{message}</p>
                        <button 
                            onClick={() => navigate('/settings')}
                            className="w-full py-3 bg-brand-800 border border-white/10 hover:bg-brand-700 text-white font-bold rounded-xl transition-all"
                        >
                            Aller aux paramètres
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};