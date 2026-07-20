import React, { useState, useMemo } from 'react';
import { EnrichedMagnet } from '../types';
import { StorageUtils, CustomCollection } from '../utils/storage';
import { Icons } from './Icon';
import { parseMagnetName } from '../utils/filename';
import { TMDBService } from '../services/tmdb';

interface CreateCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    allMagnets: EnrichedMagnet[];
    onCollectionCreated: () => void;
}

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
    isOpen,
    onClose,
    allMagnets,
    onCollectionCreated
}) => {
    const [collectionName, setCollectionName] = useState('');
    const [selectedMagnetIds, setSelectedMagnetIds] = useState<number[]>([]);
    const [searchFilter, setSearchFilter] = useState('');

    const firstSelectedMagnet = useMemo(() => {
        if (selectedMagnetIds.length === 0) return null;
        return allMagnets.find(m => m.id === selectedMagnetIds[0]) || null;
    }, [selectedMagnetIds, allMagnets]);

    // Propositions automatiques basées sur le 1er élément sélectionné
    const suggestedMagnets = useMemo(() => {
        if (!firstSelectedMagnet) return [];
        return StorageUtils.suggestRelatedMagnets(firstSelectedMagnet, allMagnets);
    }, [firstSelectedMagnet, allMagnets]);

    if (!isOpen) return null;

    const toggleMagnetSelection = (id: number) => {
        setSelectedMagnetIds(prev => 
            prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
        );
    };

    const addAllSuggestions = () => {
        const suggIds = suggestedMagnets.map(m => m.id);
        setSelectedMagnetIds(prev => Array.from(new Set([...prev, ...suggIds])));
    };

    const handleSave = () => {
        if (!collectionName.trim()) return;

        const newCollection: CustomCollection = {
            id: 'custom_' + Date.now(),
            name: collectionName.trim(),
            magnetIds: selectedMagnetIds,
            createdAt: Date.now()
        };

        StorageUtils.saveCustomCollection(newCollection);
        onCollectionCreated();
        onClose();
        setCollectionName('');
        setSelectedMagnetIds([]);
    };

    const filteredList = allMagnets.filter(m => {
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        const parsed = parseMagnetName(m.filename);
        const title = (m.tmdbData?.title || m.tmdbData?.name || parsed.title || '').toLowerCase();
        return title.includes(q) || m.filename.toLowerCase().includes(q);
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-brand-900 border border-white/10 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                
                {/* En-tête */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 rounded-2xl bg-brand-accent/10 text-brand-accent">
                            <Icons.FolderPlus size={22} />
                        </div>
                        <h3 className="text-xl font-extrabold text-white">Créer une Collection sur-mesure</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5">
                        <Icons.XCircle size={20} />
                    </button>
                </div>

                {/* Corps */}
                <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
                    {/* Nom de la collection */}
                    <div>
                        <label className="block text-xs font-extrabold text-text-muted uppercase tracking-wider mb-2">
                            Nom de la Collection
                        </label>
                        <input
                            type="text"
                            value={collectionName}
                            onChange={(e) => setCollectionName(e.target.value)}
                            placeholder="ex: Saga Spiderman, Collection Western..."
                            className="glass-input block w-full px-4 py-3 rounded-2xl text-sm font-bold text-white placeholder-text-muted"
                        />
                    </div>

                    {/* Suggestions automatiques basées sur le 1er élément */}
                    {firstSelectedMagnet && suggestedMagnets.length > 0 && (
                        <div className="bg-brand-800/60 border border-brand-accent/30 p-4 rounded-2xl animate-fade-in">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-extrabold text-brand-accent uppercase tracking-wider flex items-center gap-1.5">
                                    <Icons.Star size={14} />
                                    Suggestions pour "{collectionName || 'votre collection'}" ({suggestedMagnets.length})
                                </span>
                                <button
                                    onClick={addAllSuggestions}
                                    className="text-[11px] font-bold text-black bg-brand-accent hover:bg-white px-3 py-1 rounded-xl transition-all shadow-sm"
                                >
                                    Tout ajouter (+{suggestedMagnets.length})
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {suggestedMagnets.map(m => {
                                    const parsed = parseMagnetName(m.filename);
                                    const title = m.tmdbData?.title || m.tmdbData?.name || parsed.title;
                                    const isSelected = selectedMagnetIds.includes(m.id);
                                    return (
                                        <div
                                            key={m.id}
                                            onClick={() => toggleMagnetSelection(m.id)}
                                            className={`p-2 rounded-xl border cursor-pointer flex items-center space-x-2 transition-all ${
                                                isSelected 
                                                ? 'bg-brand-accent/15 border-brand-accent text-white font-bold' 
                                                : 'bg-brand-900/50 border-white/5 text-gray-300 hover:border-white/20'
                                            }`}
                                        >
                                            <input type="checkbox" checked={isSelected} readOnly className="rounded accent-brand-accent" />
                                            <span className="text-xs truncate">{title}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Sélection des éléments */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-extrabold text-text-muted uppercase tracking-wider">
                                Sélectionner les vidéos ({selectedMagnetIds.length} sélectionnée{selectedMagnetIds.length > 1 ? 's' : ''})
                            </label>
                            <input
                                type="text"
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                placeholder="Filtrer la liste..."
                                className="glass-input text-xs px-3 py-1.5 rounded-xl w-48"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                            {filteredList.map(m => {
                                const parsed = parseMagnetName(m.filename);
                                const title = m.tmdbData?.title || m.tmdbData?.name || parsed.title;
                                const isSelected = selectedMagnetIds.includes(m.id);
                                const poster = TMDBService.getImageUrl(m.tmdbData?.poster_path || m.tmdbData?.backdrop_path, 'w200');

                                return (
                                    <div
                                        key={m.id}
                                        onClick={() => toggleMagnetSelection(m.id)}
                                        className={`p-2 rounded-2xl border cursor-pointer flex items-center space-x-3 transition-all ${
                                            isSelected 
                                            ? 'bg-brand-accent/20 border-brand-accent text-white' 
                                            : 'bg-brand-800/40 border-white/5 text-gray-400 hover:text-white hover:bg-brand-800'
                                        }`}
                                    >
                                        <div className="w-8 h-12 bg-brand-900 rounded-lg flex-none overflow-hidden relative">
                                            {poster ? (
                                                <img src={poster} alt={title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Icons.Film size={12} className="text-text-muted" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-white truncate">{title}</p>
                                            <p className="text-[10px] text-text-muted truncate">{m.filename}</p>
                                        </div>
                                        <input type="checkbox" checked={isSelected} readOnly className="rounded accent-brand-accent" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Pied de modale */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-text-muted">{selectedMagnetIds.length} élément(s) dans cette collection</span>
                    <div className="flex space-x-3">
                        <button onClick={onClose} className="btn-glass px-5 py-2.5 text-xs font-bold">Annuler</button>
                        <button
                            onClick={handleSave}
                            disabled={!collectionName.trim() || selectedMagnetIds.length === 0}
                            className="btn-primary px-6 py-2.5 text-xs font-extrabold disabled:opacity-50"
                        >
                            Enregistrer la Collection
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
