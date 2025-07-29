import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Client, PerformanceRecord, AnalysisHistoryEntry, LastUploadInfo, AggregatedAdPerformance } from '../types';
import { AdPerformanceCard } from './AdPerformanceCard';
import { DateRangePicker } from './DateRangePicker';
import { AiAnalysisModal } from './AiAnalysisModal';
import { dbTyped } from '../database';
import Logger from '../Logger';

type FilterMode = 'todos' | 'vinculados' | 'top 10';
type DisplayMode = 'table' | 'cards';

const getFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const extractFilename = (fullName: string): string => {
    if (!fullName) return 'N/A';
    // This simple strategy handles cases like "filename.png_105 (hash...)"
    // and "filename.mov (id...)" by splitting at the first space followed by an opening parenthesis or at the first underscore.
    const parts = fullName.split(/_|\s\(/);
    if (parts[0].toLowerCase().endsWith('.png') || parts[0].toLowerCase().endsWith('.mov') || parts[0].toLowerCase().endsWith('.mp4') || parts[0].toLowerCase().endsWith('.jpg')) {
        return parts[0];
    }
    return fullName;
};

const AggregatedPerformanceTable: React.FC<{ data: AggregatedAdPerformance[], onLinkCreative: (file: File, adName: string) => void }> = ({ data, onLinkCreative }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [linkingAdName, setLinkingAdName] = useState<string | null>(null);

    const handleLinkClick = (adName: string) => {
        setLinkingAdName(adName);
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && linkingAdName) {
            onLinkCreative(file, linkingAdName);
        }
        // Reset for next use
        if(event.target) event.target.value = '';
        setLinkingAdName(null);
    };

    if (data.length === 0) {
        return <p className="text-brand-text-secondary text-center py-8">No hay datos de rendimiento para el rango de fechas y filtro seleccionado.</p>;
    }
    
    const headers = ['Creativo', 'Anuncio', 'Nombre de Archivo', 'Gasto', 'ROAS', 'CPA', 'CPM', 'CTR', 'Compras', 'Impresiones', 'Acción'];

    return (
        <div className="overflow-x-auto bg-brand-bg rounded-lg">
             <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,video/*"
            />
            <table className="w-full text-sm text-left text-brand-text-secondary">
                <thead className="text-xs text-brand-text uppercase bg-brand-surface">
                    <tr>
                        {headers.map(h => <th key={h} scope="col" className="px-4 py-3 whitespace-nowrap">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row) => (
                        <tr key={row.adName} className="bg-brand-surface border-b border-brand-border hover:bg-brand-border/50">
                            <td className="px-4 py-3">
                                <div className="w-16 h-16 bg-brand-bg rounded-md flex items-center justify-center overflow-hidden">
                                {row.isMatched && row.creativeDataUrl ? (
                                    row.creativeType === 'video' ? (
                                        <video src={row.creativeDataUrl} className="w-full h-full object-cover" loop autoPlay muted playsInline />
                                    ) : (
                                        <img src={row.creativeDataUrl} alt={row.adName} className="w-full h-full object-cover" />
                                    )
                                ) : (
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-border" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                )}
                                </div>
                            </td>
                            <td className="px-4 py-3 truncate max-w-xs font-medium text-brand-text">
                                <div className="flex items-center gap-2">
                                    <span>{row.adName}</span>
                                    {row.inMultipleAdSets && (
                                        <span title="Este anuncio se encuentra en múltiples conjuntos de anuncios.">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                            </svg>
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-3 truncate max-w-sm text-brand-text-secondary">{extractFilename(row.imageVideoPresentation)}</td>
                            <td className="px-4 py-3">{row.spend.toLocaleString('es-ES', { style: 'currency', currency: row.currency })}</td>
                            <td className="px-4 py-3 font-semibold text-brand-text">{row.roas.toFixed(2)}</td>
                            <td className="px-4 py-3">{row.cpa.toLocaleString('es-ES', { style: 'currency', currency: row.currency })}</td>
                            <td className="px-4 py-3">{row.cpm.toLocaleString('es-ES', { style: 'currency', currency: row.currency })}</td>
                            <td className="px-4 py-3">{`${row.ctr.toFixed(2)}%`}</td>
                            <td className="px-4 py-3">{row.purchases}</td>
                            <td className="px-4 py-3">{row.impressions}</td>
                            <td className="px-4 py-3">
                                {!row.isMatched && (
                                    <button
                                        onClick={() => handleLinkClick(row.adName)}
                                        className="bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/40 text-xs font-bold py-1 px-2 rounded-md transition-colors"
                                    >
                                        Vincular
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length === 3) {
        // DD/MM/YYYY
        const [day, month, year] = parts.map(Number);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return new Date(year, month - 1, day);
        }
    }
    // Try parsing directly for YYYY-MM-DD or other formats
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
}

interface PerformanceViewProps {
    clients: Client[]; 
    analysisHistory: AnalysisHistoryEntry[];
    getPerformanceAnalysis: (data: AggregatedAdPerformance[], client: Client) => Promise<string>;
}

type View = 'list' | 'detail';


export const PerformanceView: React.FC<PerformanceViewProps> = ({ clients, analysisHistory, getPerformanceAnalysis }) => {
    const [view, setView] = useState<View>('list');
    const [filterMode, setFilterMode] = useState<FilterMode>('todos');
    const [displayMode, setDisplayMode] = useState<DisplayMode>('table');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [allPerformanceData, setAllPerformanceData] = useState<{ [key: string]: PerformanceRecord[] }>({});
    const [isLoadingData, setIsLoadingData] = useState(true);
    const bulkLinkFileInputRef = useRef<HTMLInputElement>(null);
    
    // Date range state
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const [startDate, setStartDate] = useState(sevenDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    
    // AI Analysis Modal State
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [analysisContent, setAnalysisContent] = useState('');
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

    useEffect(() => {
        setIsLoadingData(true);
        Logger.info("PerformanceView: Loading performance data from DB.");
        dbTyped.getPerformanceData()
            .then(data => {
                setAllPerformanceData(data);
                Logger.success("PerformanceView: Performance data loaded successfully.");
            })
            .catch(err => {
                Logger.error("PerformanceView: Failed to load performance data.", err);
            })
            .finally(() => setIsLoadingData(false));
    }, []);

    const matchCreativeToHistory = useCallback((record: PerformanceRecord, history: AnalysisHistoryEntry[]) => {
        const clientHistory = history.filter(h => h.clientId === record.clientId);
        if (clientHistory.length === 0) return null;

        return clientHistory.find(h => {
             const historyFilenameLower = h.filename.toLowerCase();
             // @ts-ignore
             const recordLinkedHash = record.linkedFileHash;

             // Strategy 1 (Highest Priority): Manually linked hash
             if (recordLinkedHash && h.hash === recordLinkedHash) {
                 Logger.debug(`Link found for Ad "${record.adName}" via Manual Hash Match.`, { historyFile: h.filename, recordHash: recordLinkedHash });
                 return true;
             }

            // Strategy 2 (Main): Report's complex name contains original filename (case-insensitive)
            if (record.imageVideoPresentation && record.imageVideoPresentation.toLowerCase().includes(historyFilenameLower)) {
                 Logger.debug(`Link found for Ad "${record.adName}" via Substring Match.`, { historyFile: h.filename, reportName: record.imageVideoPresentation });
                return true;
            }

            return false;
        });
    }, []);

    const filteredPerformanceData = useMemo(() => {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        const filtered: { [key: string]: PerformanceRecord[] } = {};
        for (const clientId in allPerformanceData) {
            filtered[clientId] = allPerformanceData[clientId].filter(record => {
                const recordDate = parseDate(record.day);
                if (!recordDate) return false;
                return recordDate >= start && recordDate <= end;
            });
        }
        return filtered;
    }, [allPerformanceData, startDate, endDate]);

    const clientSummaries = useMemo(() => {
        return clients.map(client => {
            const data = filteredPerformanceData[client.id] || [];
            if (data.length === 0) {
                return { ...client, gastoTotal: 0, comprasTotales: 0, roas: 0, totalAds: 0, matchedCount: 0 };
            }
            const gastoTotal = data.reduce((acc, row) => acc + (row.spend || 0), 0);
            const valorTotal = data.reduce((acc, row) => acc + (row.purchaseValue || 0), 0);
            const roas = gastoTotal > 0 ? valorTotal / gastoTotal : 0;
            
            const adsByName = data.reduce((acc, record) => {
                const adName = record.adName;
                if (!acc[adName]) acc[adName] = [];
                acc[adName].push(record);
                return acc;
            }, {} as Record<string, PerformanceRecord[]>);

            const uniqueAds = Object.keys(adsByName);
            
            const matchedCount = uniqueAds.filter(adName => {
                const firstRecord = adsByName[adName][0];
                return !!matchCreativeToHistory(firstRecord, analysisHistory);
            }).length;

            return {
                ...client,
                gastoTotal,
                roas,
                totalAds: uniqueAds.length,
                matchedCount
            };
        });
    }, [clients, filteredPerformanceData, analysisHistory, matchCreativeToHistory]);

    const aggregatedClientData = useMemo<AggregatedAdPerformance[]>(() => {
        if (!selectedClient) return [];
        const performanceData = filteredPerformanceData[selectedClient.id] || [];
        Logger.info(`Aggregating data for client "${selectedClient.name}" with ${performanceData.length} records in range.`);
        
        if (performanceData.length === 0) return [];

        const adsByName = performanceData.reduce((acc, record) => {
            if (!record.adName) return acc;
            if (!acc[record.adName]) acc[record.adName] = [];
            acc[record.adName].push(record);
            return acc;
        }, {} as Record<string, PerformanceRecord[]>);
        
        Logger.info(`Found ${Object.keys(adsByName).length} unique ad names to aggregate.`);

        const allAggregated = Object.entries(adsByName).map(([adName, records]) => {
            const totals = records.reduce((acc, r) => {
                acc.spend += r.spend || 0;
                acc.purchases += r.purchases || 0;
                acc.purchaseValue += r.purchaseValue || 0;
                acc.impressions += r.impressions || 0;
                acc.clicks += r.clicksAll || 0;
                return acc;
            }, { spend: 0, purchases: 0, purchaseValue: 0, impressions: 0, clicks: 0 });

            const roas = totals.spend > 0 ? totals.purchaseValue / totals.spend : 0;
            const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;
            const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
            const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            
            const firstRecord = records[0];
            const match = matchCreativeToHistory(firstRecord, analysisHistory);
            const inMultipleAdSets = new Set(records.map(r => r.adSetName)).size > 1;

            return {
                adName,
                imageVideoPresentation: firstRecord.imageVideoPresentation,
                spend: totals.spend,
                purchases: totals.purchases,
                purchaseValue: totals.purchaseValue,
                impressions: totals.impressions,
                clicks: totals.clicks,
                roas, cpa, cpm, ctr,
                isMatched: !!match,
                creativeDescription: match?.description,
                currency: selectedClient.currency,
                inMultipleAdSets,
                creativeDataUrl: match?.dataUrl,
                creativeType: match?.fileType
            };
        }).sort((a,b) => b.spend - a.spend);

        Logger.success(`Aggregation complete. Total ads: ${allAggregated.length}`);
        if (filterMode === 'vinculados') {
            return allAggregated.filter(ad => ad.isMatched);
        }
        if (filterMode === 'top 10') {
            return allAggregated.sort((a,b) => b.roas - a.roas).slice(0, 10);
        }
        return allAggregated;

    }, [selectedClient, filteredPerformanceData, analysisHistory, filterMode, matchCreativeToHistory]);
    
    const hasLinkedAds = useMemo(() => aggregatedClientData.some(ad => ad.isMatched), [aggregatedClientData]);
    
    const handleDateChange = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
    };

    const handleClientSelect = (client: Client) => {
        setSelectedClient(client);
        setDisplayMode('table');
        setFilterMode('todos');
        setView('detail');
    };
    
    const handleAiAnalysis = async () => {
        if (!selectedClient) return;
        const dataToAnalyze = aggregatedClientData.filter(ad => ad.isMatched);
        if (dataToAnalyze.length === 0) {
            alert("No hay anuncios vinculados en el período seleccionado para analizar.");
            return;
        }

        setIsAnalysisLoading(true);
        setIsAnalysisModalOpen(true);
        setAnalysisContent('');

        const result = await getPerformanceAnalysis(dataToAnalyze, selectedClient);
        
        setAnalysisContent(result);
        setIsAnalysisLoading(false);
    }

    const handleLinkCreativeToFile = useCallback(async (file: File, adName: string) => {
        if (!selectedClient) return;

        Logger.info(`Manually linking file "${file.name}" to ad "${adName}"...`);
        setIsLoadingData(true);
        try {
            const hash = await getFileHash(file);
            Logger.info(`File hash for manual link: ${hash}`);
            
            const updatedClientData = allPerformanceData[selectedClient.id].map(record => {
                if (record.adName === adName) {
                    return {
                        ...record,
                        // @ts-ignore
                        linkedFileName: file.name,
                        // @ts-ignore
                        linkedFileHash: hash,
                    };
                }
                return record;
            });

            const newAllData = { ...allPerformanceData, [selectedClient.id]: updatedClientData };
            setAllPerformanceData(newAllData);
            await dbTyped.savePerformanceData(newAllData);
            Logger.success(`Successfully linked file "${file.name}" to ad "${adName}".`);
            alert(`Creativo "${file.name}" vinculado permanentemente al anuncio "${adName}".`);

        } catch (error) {
            Logger.error(`Error linking creative: ${file.name} to ${adName}`, error);
            alert("Ocurrió un error al intentar vincular el creativo.");
        } finally {
            setIsLoadingData(false);
        }
    }, [selectedClient, allPerformanceData]);

    const handleBulkLink = async (files: FileList) => {
        if (!files || files.length === 0 || !selectedClient) return;
        
        Logger.info(`Starting bulk link process for ${files.length} files for client "${selectedClient.name}".`);
        setIsLoadingData(true);
        let linkedCount = 0;
        try {
            const fileMap = new Map<string, { hash: string; name: string }>();
            for (const file of Array.from(files)) {
                const hash = await getFileHash(file);
                fileMap.set(file.name.toLowerCase(), { hash, name: file.name });
            }
            Logger.debug("Hashed all files for bulk linking.", { count: fileMap.size });

            const currentClientData = [...(allPerformanceData[selectedClient.id] || [])];
            const adNamesToUpdate = new Map<string, { hash: string; name: string }>();

            const unlinkedAds = aggregatedClientData.filter(ad => !ad.isMatched);
            Logger.info(`Found ${unlinkedAds.length} unlinked ads to check against.`);

            for (const ad of unlinkedAds) {
                for (const [fileNameLower, fileInfo] of fileMap.entries()) {
                    if (ad.imageVideoPresentation && ad.imageVideoPresentation.toLowerCase().includes(fileNameLower)) {
                        adNamesToUpdate.set(ad.adName, fileInfo);
                        Logger.debug(`Found match for bulk link: Ad "${ad.adName}" <-> File "${fileInfo.name}"`);
                        break; 
                    }
                }
            }
            
            linkedCount = adNamesToUpdate.size;
            Logger.info(`${linkedCount} potential new links found.`);

            if (linkedCount > 0) {
                const updatedClientData = currentClientData.map(record => {
                    if (adNamesToUpdate.has(record.adName)) {
                        const linkInfo = adNamesToUpdate.get(record.adName)!;
                        return { ...record, linkedFileName: linkInfo.name, linkedFileHash: linkInfo.hash };
                    }
                    return record;
                });

                const newAllData = { ...allPerformanceData, [selectedClient.id]: updatedClientData };
                setAllPerformanceData(newAllData);
                await dbTyped.savePerformanceData(newAllData);
                Logger.success(`Bulk link successful. ${linkedCount} ads updated.`);
            }
            alert(`${linkedCount} de ${files.length} creativos han sido vinculados con éxito.`);

        } catch (error) {
             Logger.error("Error during bulk link:", error);
            alert("Ocurrió un error durante la vinculación masiva.");
        } finally {
            if (bulkLinkFileInputRef.current) bulkLinkFileInputRef.current.value = "";
            setIsLoadingData(false);
        }
    };


    if (view === 'list') {
        return (
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-brand-text">Rendimiento por Cliente</h2>
                        <p className="text-brand-text-secondary mt-1">Selecciona un cliente para ver el detalle de sus anuncios.</p>
                    </div>
                    <DateRangePicker onDateChange={handleDateChange} initialStartDate={startDate} initialEndDate={endDate} />
                </header>

                {isLoadingData ? (
                    <div className="text-center py-16">
                        <svg className="animate-spin h-8 w-8 text-brand-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="mt-4 text-brand-text-secondary">Cargando datos de rendimiento...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {clientSummaries.map(client => (
                            <button
                                key={client.id}
                                onClick={() => handleClientSelect(client)}
                                className="bg-brand-surface p-4 rounded-lg shadow-md hover:shadow-xl hover:shadow-brand-primary/20 transition-all text-left flex flex-col items-start"
                            >
                                <div className="flex items-center gap-3 w-full mb-4">
                                    <img src={client.logo} alt={client.name} className="h-10 w-10 rounded-full bg-brand-border" />
                                    <h3 className="font-bold text-brand-text flex-1 truncate">{client.name}</h3>
                                </div>
                                <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <div className="text-brand-text-secondary">Gasto Total:</div>
                                    <div className="font-semibold text-brand-text text-right">{client.gastoTotal.toLocaleString('es-ES', { style: 'currency', currency: client.currency })}</div>
                                    
                                    <div className="text-brand-text-secondary">ROAS:</div>
                                    <div className="font-semibold text-brand-text text-right">{client.roas.toFixed(2)}</div>

                                    <div className="text-brand-text-secondary">Anuncios:</div>
                                    <div className="font-semibold text-brand-text text-right">{client.totalAds}</div>

                                    <div className="text-brand-text-secondary">Anuncios Vinculados:</div>
                                    <div className="font-semibold text-brand-text text-right">{client.matchedCount} / {client.totalAds}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    
    if (view === 'detail' && selectedClient) {
        return (
            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
                <input
                    type="file"
                    ref={bulkLinkFileInputRef}
                    onChange={(e) => handleBulkLink(e.target.files!)}
                    className="hidden"
                    accept="image/*,video/*"
                    multiple
                />
                <header>
                    <button onClick={() => setView('list')} className="mb-4 flex items-center gap-2 text-sm text-brand-text-secondary hover:text-brand-text">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Volver a la lista de clientes
                    </button>
                     <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <img src={selectedClient.logo} alt={selectedClient.name} className="h-12 w-12 rounded-full bg-brand-border" />
                            <div>
                                <h2 className="text-2xl font-bold text-brand-text">Rendimiento de {selectedClient.name}</h2>
                                <p className="text-brand-text-secondary">Datos del {new Date(startDate).toLocaleDateString('es-ES')} al {new Date(endDate).toLocaleDateString('es-ES')}</p>
                            </div>
                        </div>
                         <DateRangePicker onDateChange={handleDateChange} initialStartDate={startDate} initialEndDate={endDate} />
                    </div>
                </header>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-brand-surface rounded-lg shadow-md">
                     <div className="flex items-center flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-semibold text-brand-text-secondary">Filtro:</span>
                            <div className="flex rounded-lg bg-brand-border p-1">
                                <button onClick={() => setFilterMode('todos')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${filterMode === 'todos' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}>Todos</button>
                                <button onClick={() => setFilterMode('vinculados')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${filterMode === 'vinculados' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}>Vinculados</button>
                                <button onClick={() => setFilterMode('top 10')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${filterMode === 'top 10' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}>Top 10</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-brand-text-secondary">Vista:</span>
                            <div className="flex rounded-lg bg-brand-border p-1">
                                <button onClick={() => setDisplayMode('table')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${displayMode === 'table' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}>Tabla</button>
                                <button onClick={() => setDisplayMode('cards')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${displayMode === 'cards' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}>Tarjetas</button>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 self-end md:self-center">
                         <button 
                            onClick={() => bulkLinkFileInputRef.current?.click()}
                            disabled={isLoadingData}
                            title={'Vincular masivamente creativos a anuncios no vinculados'}
                            className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M12.586 3l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a4 4 0 10-5.656-5.656l-6.586 6.586a6 6 0 108.484 8.484l6.586-6.586a8 8 0 10-11.312-11.312l-1.172 1.172a1 1 0 001.414 1.414l1.172-1.172z" />
                            </svg>
                            <span>Subida Masiva</span>
                        </button>
                        <button 
                            onClick={handleAiAnalysis}
                            disabled={!hasLinkedAds || isAnalysisLoading}
                            title={!hasLinkedAds ? 'Se requiere al menos un anuncio vinculado con un análisis para generar la conclusión.' : 'Generar análisis de IA'}
                            className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span>{isAnalysisLoading ? 'Analizando...' : 'Conclusión de IA'}</span>
                        </button>
                    </div>
                </div>
                
                <div>
                    {displayMode === 'table' ? (
                        <AggregatedPerformanceTable data={aggregatedClientData} onLinkCreative={handleLinkCreativeToFile} />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {aggregatedClientData.length > 0 
                                ? aggregatedClientData.map(ad => <AdPerformanceCard key={ad.adName} ad={ad} />)
                                : <p className="text-brand-text-secondary text-center py-8 col-span-full">No hay datos de rendimiento para la selección actual.</p>
                            }
                        </div>
                    )}
                </div>

                <AiAnalysisModal 
                    isOpen={isAnalysisModalOpen}
                    onClose={() => setIsAnalysisModalOpen(false)}
                    isLoading={isAnalysisLoading}
                    analysisText={analysisContent}
                />
            </div>
        );
    }
    
    return null;
};