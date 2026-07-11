import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icon';

interface VideoPlayerProps {
    streamUrl: string;
    filename: string;
    magnetId: number;
    fileIndex: number;
    initialTime?: number;
    onClose: () => void;
    onProgressUpdate?: (time: number, duration: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    streamUrl,
    filename,
    magnetId,
    fileIndex,
    initialTime = 0,
    onClose,
    onProgressUpdate
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // UI States
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Auto-hide controls timer
    const controlsTimeoutRef = useRef<number | null>(null);

    // Initial setup and resume time
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleCanPlay = () => {
            setIsLoading(false);
            if (initialTime > 0 && video.currentTime === 0) {
                // S'assurer de ne reprendre que si le fichier est au début
                video.currentTime = Math.min(initialTime, video.duration - 5);
            }
            video.play().catch(() => {});
        };

        const handlePlayState = () => setIsPlaying(true);
        const handlePauseState = () => setIsPlaying(false);
        
        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (onProgressUpdate && video.duration) {
                onProgressUpdate(video.currentTime, video.duration);
            }
        };

        const handleDurationChange = () => {
            setDuration(video.duration);
        };

        const handleWaiting = () => setIsLoading(true);
        const handlePlaying = () => setIsLoading(false);
        
        const handleError = () => {
            console.error("Erreur de décodage vidéo HTML5");
            setHasError(true);
            setIsLoading(false);
        };

        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('play', handlePlayState);
        video.addEventListener('pause', handlePauseState);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('error', handleError);

        // Load the stream URL
        video.src = streamUrl;
        video.load();

        return () => {
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('play', handlePlayState);
            video.removeEventListener('pause', handlePauseState);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('error', handleError);
            
            // Clean src to free up memory
            video.removeAttribute('src');
            video.load();
        };
    }, [streamUrl]);

    // Handle full screen state change
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Raccourcis clavier
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const video = videoRef.current;
            if (!video) return;

            resetControlsTimeout();

            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    seekRelative(-10);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    seekRelative(10);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    adjustVolume(0.1);
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    adjustVolume(-0.1);
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'escape':
                    e.preventDefault();
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    } else {
                        onClose();
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, volume, isMuted]);

    const resetControlsTimeout = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            window.clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = window.setTimeout(() => {
            if (isPlaying) {
                setShowControls(false);
            }
        }, 3000);
    };

    const handleMouseMove = () => {
        resetControlsTimeout();
    };

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.pause();
        } else {
            video.play().catch(() => {});
        }
    };

    const seekRelative = (seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration));
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;
        const newTime = parseFloat(e.target.value);
        video.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const adjustVolume = (delta: number) => {
        const video = videoRef.current;
        if (!video) return;
        const newVol = Math.max(0, Math.min(volume + delta, 1));
        video.volume = newVol;
        setVolume(newVol);
        setIsMuted(newVol === 0);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;
        const newVol = parseFloat(e.target.value);
        video.volume = newVol;
        setVolume(newVol);
        setIsMuted(newVol === 0);
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        const nextMute = !isMuted;
        video.muted = nextMute;
        setIsMuted(nextMute);
    };

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;

        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    };

    const handlePlaybackRateChange = () => {
        const video = videoRef.current;
        if (!video) return;
        const rates = [1, 1.25, 1.5, 1.75, 2];
        const currentIdx = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIdx + 1) % rates.length];
        video.playbackRate = nextRate;
        setPlaybackRate(nextRate);
    };

    const formatTime = (timeInSeconds: number) => {
        if (isNaN(timeInSeconds)) return "00:00";
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = Math.floor(timeInSeconds % 60);

        const pad = (num: number) => num.toString().padStart(2, '0');

        if (hours > 0) {
            return `${hours}:${pad(minutes)}:${pad(seconds)}`;
        }
        return `${pad(minutes)}:${pad(seconds)}`;
    };

    // Liens VLC externes (fallback)
    const openVlcAndroid = () => {
        const cleanUrl = streamUrl.trim();
        const intentUrl = `intent:${cleanUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=org.videolan.vlc;S.title=${encodeURIComponent(filename)};end`;
        window.location.href = intentUrl;
    };

    const openVlcUniversal = () => {
        window.location.href = `vlc://${streamUrl.trim()}`;
    };

    return (
        <div 
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            className="fixed inset-0 bg-black z-[200] flex items-center justify-center select-none overflow-hidden"
        >
            {/* Élément HTML5 Video */}
            <video 
                ref={videoRef}
                onClick={togglePlay}
                className="w-full h-full object-contain cursor-pointer"
                playsInline
            />

            {/* Spinner de Chargement */}
            {isLoading && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30 pointer-events-none">
                    <div className="w-16 h-16 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin"></div>
                </div>
            )}

            {/* ÉCRAN D'ERREUR CODEC / FALLBACK VLC */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-brand-900/95 z-40 p-6 text-center animate-fade-in">
                    <div className="max-w-md w-full bg-brand-800/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                        <div className="w-16 h-16 bg-orange-500/20 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Icons.AlertCircle size={36} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Format non supporté</h3>
                        <p className="text-text-secondary text-sm mb-6 leading-relaxed">
                            Ce format vidéo ou audio (ex: MKV, DTS) n'est pas lisible directement dans le navigateur. Ouvrez-le avec VLC pour Android pour démarrer la lecture instantanément.
                        </p>
                        <div className="space-y-3">
                            <button 
                                onClick={openVlcAndroid}
                                className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold text-base shadow-lg shadow-orange-950/20 active:scale-95 transition-all"
                            >
                                Ouvrir avec VLC (Android)
                            </button>
                            <button 
                                onClick={openVlcUniversal}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-semibold transition-all"
                            >
                                Utiliser le lien universel VLC (vlc://)
                            </button>
                            <button 
                                onClick={onClose}
                                className="w-full py-2 text-text-muted hover:text-text-secondary text-xs transition-colors"
                            >
                                Retour aux détails
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTROLES DE LECTURE (GLASSMORPHISM) */}
            <div 
                className={`absolute inset-x-0 bottom-0 p-6 md:p-8 flex flex-col space-y-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 z-20 ${
                    showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
            >
                {/* Ligne 1 : Nom de la vidéo et bouton fermer */}
                <div className="flex items-center justify-between text-white mb-2">
                    <div className="flex items-center space-x-4 min-w-0 mr-4">
                        <button 
                            onClick={onClose}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                            title="Fermer"
                        >
                            <Icons.ChevronLeft size={24} />
                        </button>
                        <h2 className="font-semibold text-sm md:text-base truncate drop-shadow-md">
                            {filename}
                        </h2>
                    </div>

                    <div className="flex items-center space-x-2">
                        {/* Redirection VLC rapide */}
                        <button 
                            onClick={openVlcAndroid}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-orange-600/90 hover:bg-orange-500 text-xs font-bold rounded-lg border border-orange-500/20 shadow"
                            title="Basculer vers VLC"
                        >
                            <Icons.ExternalLink size={12} />
                            <span className="hidden sm:inline">VLC</span>
                        </button>
                    </div>
                </div>

                {/* Ligne 2 : Barre de progression */}
                <div className="flex items-center space-x-4">
                    <span className="text-xs font-medium font-mono text-gray-300 w-12 text-right">
                        {formatTime(currentTime)}
                    </span>
                    <input 
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleProgressChange}
                        className="flex-1 accent-brand-accent bg-white/20 h-1 rounded-full cursor-pointer hover:h-1.5 transition-all"
                    />
                    <span className="text-xs font-medium font-mono text-gray-300 w-12">
                        {formatTime(duration)}
                    </span>
                </div>

                {/* Ligne 3 : Contrôles de lecture */}
                <div className="flex items-center justify-between">
                    {/* Partie gauche : Play, reculer/avancer */}
                    <div className="flex items-center space-x-6 text-white">
                        <button onClick={() => seekRelative(-10)} className="hover:text-brand-accent transition-colors p-1" title="-10s">
                            <span className="text-xs font-bold leading-none flex items-center justify-center w-8 h-8 rounded-full border border-white/10 hover:bg-white/5">
                                -10
                            </span>
                        </button>

                        <button 
                            onClick={togglePlay} 
                            className="bg-brand-accent text-black p-3.5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-glow"
                            title={isPlaying ? "Pause" : "Lecture"}
                        >
                            {isPlaying ? <span className="block w-4 h-4 font-bold border-l-4 border-r-4 border-black box-border"></span> : <Icons.Play size={16} fill="currentColor" className="ml-0.5" />}
                        </button>

                        <button onClick={() => seekRelative(10)} className="hover:text-brand-accent transition-colors p-1" title="+10s">
                            <span className="text-xs font-bold leading-none flex items-center justify-center w-8 h-8 rounded-full border border-white/10 hover:bg-white/5">
                                +10
                            </span>
                        </button>
                    </div>

                    {/* Partie droite : Volume, Vitesse, Plein écran */}
                    <div className="flex items-center space-x-6 text-white">
                        {/* Contrôle de volume */}
                        <div className="flex items-center space-x-2 group/volume">
                            <button onClick={toggleMute} className="hover:text-brand-accent transition-colors" title={isMuted ? "Activer le son" : "Couper le son"}>
                                {isMuted ? <Icons.VolumeX size={20} /> : <Icons.Volume2 size={20} />}
                            </button>
                            <input 
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-0 opacity-0 group-hover/volume:w-16 group-hover/volume:opacity-100 accent-brand-accent h-1 rounded-full cursor-pointer transition-all duration-300"
                            />
                        </div>

                        {/* Vitesse de lecture */}
                        <button 
                            onClick={handlePlaybackRateChange}
                            className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 tracking-wider"
                            title="Vitesse de lecture"
                        >
                            {playbackRate === 1 ? '1.0x' : `${playbackRate}x`}
                        </button>

                        {/* Plein écran */}
                        <button 
                            onClick={toggleFullscreen}
                            className="hover:text-brand-accent transition-colors"
                            title="Plein écran"
                        >
                            <Icons.ExternalLink size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
