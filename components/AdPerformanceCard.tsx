
import React, { useState } from 'react';
import { AggregatedAdPerformance } from '../types';

export const AdPerformanceCard: React.FC<{ ad: AggregatedAdPerformance }> = ({ ad }) => {
    const metrics = [
        { label: "ROAS", value: ad.roas.toFixed(2), highlight: true, size: 'large' },
        { label: "Gasto", value: ad.spend.toLocaleString('es-ES', { style: 'currency', currency: ad.currency }) },
        { label: "CPA", value: ad.cpa.toLocaleString('es-ES', { style: 'currency', currency: ad.currency }) },
        { label: "CPM", value: ad.cpm.toLocaleString('es-ES', { style: 'currency', currency: ad.currency }) },
        { label: "CTR", value: `${ad.ctr.toFixed(2)}%` },
    ];
    
    const renderCreativePreview = () => {
        if (ad.isMatched && ad.creativeDataUrl) {
            if (ad.creativeType === 'video') {
                return <video src={ad.creativeDataUrl} className="w-full h-full object-cover" loop autoPlay muted playsInline />;
            }
            return <img src={ad.creativeDataUrl} alt={ad.adName} className="w-full h-full object-cover" />;
        }
        if (ad.isMatched) {
             return (
                <div className="text-brand-text-secondary text-center p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs mt-2 font-semibold">Análisis Vinculado</p>
                </div>
            );
        }
        return (
            <div className="text-brand-text-secondary text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="text-xs mt-2">Creativo no vinculado</p>
            </div>
        );
    };

    return (
        <div className="bg-brand-border/50 rounded-lg overflow-hidden shadow-lg transform transition-all duration-300 hover:shadow-brand-primary/20 hover:-translate-y-1 flex flex-col">
            <div className="w-full aspect-square bg-brand-bg flex items-center justify-center overflow-hidden">
                {renderCreativePreview()}
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <p className="text-sm font-semibold text-brand-text truncate" title={ad.adName}>{ad.adName}</p>
                {ad.inMultipleAdSets && (
                    <p className="text-xs text-brand-text-secondary mt-1">En múltiples Ad-Sets</p>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 flex-grow">
                     {metrics.map(metric => (
                        <div key={metric.label} className={metric.highlight ? 'col-span-2 bg-brand-primary/20 p-2 rounded-md text-center' : 'text-center'}>
                            <p className={`text-xs uppercase tracking-wider ${metric.highlight ? 'text-brand-primary' : 'text-brand-text-secondary'}`}>{metric.label}</p>
                            <p className={`font-bold ${metric.highlight ? 'text-brand-primary text-2xl' : 'text-brand-text text-lg'}`}>{metric.value}</p>
                        </div>
                    ))}
                </div>
                 {ad.creativeDescription && (
                    <div className="mt-4 pt-3 border-t border-brand-border/50">
                        <details className="group">
                            <summary className="list-none flex justify-between items-center cursor-pointer text-sm font-semibold text-brand-text-secondary hover:text-brand-text">
                                Ver Análisis IA
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <p className="mt-2 text-xs text-brand-text-secondary bg-brand-bg p-2 rounded-md whitespace-pre-wrap">{ad.creativeDescription}</p>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
};