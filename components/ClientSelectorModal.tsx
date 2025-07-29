
import React, { useEffect, useState } from 'react';
import { Client } from '../types';

interface ClientSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    onClientSelect: (clientId: string) => void;
}

export const ClientSelectorModal: React.FC<ClientSelectorModalProps> = ({ isOpen, onClose, clients, onClientSelect }) => {
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            // Pre-select the first client if available
            if (clients.length > 0) {
                setSelectedClientId(clients[0].id);
            }
        }
    }, [isOpen, clients]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    const handleSubmit = () => {
        if(selectedClientId) {
            onClientSelect(selectedClientId);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="relative bg-brand-surface rounded-lg shadow-xl p-8 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold text-brand-text mb-4">Asignar Creativo a Cliente</h2>
                <p className="text-brand-text-secondary mb-6">
                    Selecciona el cliente para el cual estás subiendo este creativo. Esto es necesario para guardar el análisis en cache correctamente.
                </p>

                {clients.length > 0 ? (
                    <div className="space-y-4">
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-3 focus:ring-brand-primary focus:border-brand-primary"
                        >
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>
                                    {client.name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handleSubmit}
                            disabled={!selectedClientId}
                            className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Confirmar y Analizar
                        </button>
                    </div>
                ) : (
                     <p className="text-yellow-400 bg-yellow-500/10 p-4 rounded-md text-center">No tienes clientes asignados. Por favor, crea uno en la pestaña de 'Clientes'.</p>
                )}

                 <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-brand-text-secondary hover:text-brand-text transition-colors"
                    aria-label="Cerrar modal"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};