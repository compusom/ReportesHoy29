
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Client, PerformanceRecord } from '../types';
import { NewClientsModal } from './NewClientsModal';
import { dbTyped } from '../database';


const getFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        // Handles European format "1.234,56" by removing dots and replacing comma with a dot.
        const cleaned = value.replace(/\./g, '').replace(/,/g, '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

const parseIntNumber = (value: any): number => {
    if (typeof value === 'number') return Math.round(value);
    if (typeof value === 'string') {
        // Handles integers with dot separators "1.234" by removing them.
        // Also truncates any decimals from unexpected float formats.
        const cleaned = value.split(',')[0].replace(/\./g, '');
        const num = parseInt(cleaned, 10);
        return isNaN(num) ? 0 : num;
    }
    return 0;
}

const mapRowToPerformanceRecord = (row: any, clientId: string): PerformanceRecord => ({
    clientId,
    uniqueId: `${row['Nombre de la campaña']}_${row['Nombre del conjunto de anuncios']}_${row['Nombre del anuncio']}_${row['Día']}`,
    campaignName: row['Nombre de la campaña'] || '',
    adSetName: row['Nombre del conjunto de anuncios'] || '',
    adName: row['Nombre del anuncio'] || '',
    day: row['Día'] || '',
    accountName: row['Nombre de la cuenta'] || '',
    imageVideoPresentation: row['Imagen, video y presentación'] || '',
    spend: parseNumber(row['Importe gastado (EUR)']),
    campaignDelivery: row['Entrega de la campaña'] || '',
    adSetDelivery: row['Entrega del conjunto de anuncios'] || '',
    adDelivery: row['Entrega del anuncio'] || '',
    impressions: parseIntNumber(row['Impresiones']),
    reach: parseIntNumber(row['Alcance']),
    frequency: parseNumber(row['Frecuencia']),
    purchases: parseNumber(row['Compras']),
    landingPageViews: parseNumber(row['Visitas a la página de destino']),
    clicksAll: parseIntNumber(row['Clics (todos)']),
    cpm: parseNumber(row['CPM (costo por mil impresiones)']),
    ctrAll: parseNumber(row['CTR (todos)']),
    cpcAll: parseNumber(row['CPC (todos)']),
    videoPlays3s: parseNumber(row['Reproducciones de video de 3 segundos']),
    checkoutsInitiated: parseNumber(row['Pagos iniciados']),
    purchaseRate: parseNumber(row['Porcentaje de compras por visitas a la página de destino']),
    pageLikes: parseNumber(row['Me gusta en Facebook']),
    addsToCart: parseNumber(row['Artículos agregados al carrito']),
    checkoutsInitiatedOnWebsite: parseNumber(row['Pagos iniciados en el sitio web']),
    campaignBudget: (row['Presupuesto de la campaña'] || '').toString(),
    campaignBudgetType: row['Tipo de presupuesto de la campaña'] || '',
    includedCustomAudiences: row['Públicos personalizados incluidos'] || '',
    excludedCustomAudiences: row['Públicos personalizados excluidos'] || '',
    linkClicks: parseIntNumber(row['Clics en el enlace']),
    paymentInfoAdds: parseNumber(row['Información de pago agregada']),
    pageEngagement: parseNumber(row['Interacción con la página']),
    postComments: parseNumber(row['Comentarios de publicaciones']),
    postInteractions: parseNumber(row['Interacciones con la publicación']),
    postReactions: parseNumber(row['Reacciones a publicaciones']),
    postShares: parseNumber(row['Veces que se compartieron las publicaciones']),
    bid: (row['Puja'] || '').toString(),
    bidType: row['Tipo de puja'] || '',
    websiteUrl: row['URL del sitio web'] || '',
    ctrLink: parseNumber(row['CTR (porcentaje de clics en el enlace)']),
    currency: row['Divisa'] || 'EUR',
    purchaseValue: parseNumber(row['Valor de conversión de compras']),
    objective: row['Objetivo'] || '',
    purchaseType: row['Tipo de compra'] || '',
    reportStart: row['Inicio del informe'] || '',
    reportEnd: row['Fin del informe'] || '',
    attention: parseNumber(row['Atencion']),
    desire: parseNumber(row['Deseo']),
    interest: parseNumber(row['Interes']),
    videoPlays25percent: parseNumber(row['Reproducciones de video hasta el 25%']),
    videoPlays50percent: parseNumber(row['Reproducciones de video hasta el 50%']),
    videoPlays75percent: parseNumber(row['Reproducciones de video hasta el 75%']),
    videoPlays95percent: parseNumber(row['Reproducciones de video hasta el 95%']),
    videoPlays100percent: parseNumber(row['Reproducciones de video hasta el 100%']),
    videoPlayRate3s: parseNumber(row['Porcentaje de reproducciones de video de 3 segundos por impresiones']),
    aov: parseNumber(row['AOV']),
    lpViewRate: parseNumber(row['LP View Rate']),
    adcToLpv: parseNumber(row['ADC – LPV']),
    videoCapture: row['Captura de Video'] || '',
    landingConversionRate: parseNumber(row['Tasa de conversión de Landing']),
    percentPurchases: parseNumber(row['% Compras']),
    visualizations: parseNumber(row['Visualizaciones']),
    imageId: (row['Identificador de la imagen'] || '').toString(),
    imageName: row['Nombre de la imagen'] || '',
    cvrLinkClick: parseNumber(row['CVR(Link Click)']),
    videoRetentionProprietary: parseNumber(row['Retencion Video']),
    videoRetentionMeta: parseNumber(row['Retención de video']),
    videoAveragePlayTime: parseNumber(row['Tiempo promedio de reproducción del video']),
    thruPlays: parseNumber(row['ThruPlays']),
    videoPlays: parseNumber(row['Reproducciones de video']),
    videoPlays2sContinuousUnique: parseNumber(row['Reproducciones de video continuas de 2 segundos únicas']),
    ctrUniqueLink: parseNumber(row['CTR único (porcentaje de clics en el enlace)']),
});


interface ImportViewProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}

type Feedback = { type: 'info' | 'success' | 'error', message: string };


export const ImportView: React.FC<ImportViewProps> = ({ clients, setClients }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newAccountNames, setNewAccountNames] = useState<string[]>([]);
    const [pendingData, setPendingData] = useState<any[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processData = async (data: any[], currentClients: Client[]) => {
        setIsProcessing(true);
        setFeedback({ type: 'info', message: "Guardando datos en la base de datos..." });
        try {
            const allPerformanceData = await dbTyped.getPerformanceData();
            
            const recordsByAccountName: { [key: string]: PerformanceRecord[] } = {};

            for (const row of data) {
                const accountName = row['Nombre de la cuenta'];
                if (!accountName) continue;
                if (!recordsByAccountName[accountName]) {
                    recordsByAccountName[accountName] = [];
                }
                const client = currentClients.find(c => c.metaAccountName === accountName);
                if (client) {
                    recordsByAccountName[accountName].push(mapRowToPerformanceRecord(row, client.id));
                }
            }

            for (const accountName in recordsByAccountName) {
                const client = currentClients.find(c => c.metaAccountName === accountName);
                if (client) {
                    const clientData = allPerformanceData[client.id] || [];
                    const existingUniqueIds = new Set(clientData.map(d => d.uniqueId));
                    const newRecords = recordsByAccountName[accountName].filter(r => !existingUniqueIds.has(r.uniqueId));
                    allPerformanceData[client.id] = [...clientData, ...newRecords];
                }
            }
            
            await dbTyped.savePerformanceData(allPerformanceData);
            setFeedback({ type: 'success', message: `Importación completada con éxito. Datos guardados para ${Object.keys(recordsByAccountName).length} cuentas.` });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error desconocido";
            setFeedback({ type: 'error', message: `Error al guardar los datos: ${message}` });
        } finally {
            setIsProcessing(false);
            setPendingData(null);
        }
    }

    const handleFileUpload = async (file: File) => {
        setIsProcessing(true);
        setFeedback({ type: 'info', message: "Procesando reporte..." });
        
        try {
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'buffer' });
            const parsedData = XLSX.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[0]]);
            if (parsedData.length === 0) throw new Error("El archivo Excel está vacío o no se pudo leer.");

            const accountNamesInReport = new Set(parsedData.map(row => row['Nombre de la cuenta']).filter(Boolean));
            const existingClientAccountNames = new Set(clients.map(c => c.metaAccountName).filter(Boolean));

            const newNames = [...accountNamesInReport].filter(name => !existingClientAccountNames.has(name as string));

            if (newNames.length > 0) {
                setNewAccountNames(newNames);
                setPendingData(parsedData);
                setIsModalOpen(true);
            } else {
                await processData(parsedData, clients);
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : "Error inesperado al leer el archivo.";
            setFeedback({ type: 'error', message });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
            // Keep processing true if modal is about to open, otherwise false
             if (newAccountNames.length === 0) {
                setIsProcessing(false);
            }
        }
    };

    const handleCreateNewClients = (accountsToCreate: string[]) => {
        const newClients: Client[] = accountsToCreate.map(name => ({
            id: crypto.randomUUID(),
            name: name,
            logo: `https://avatar.vercel.sh/${name}.png?text=${name.charAt(0)}`,
            currency: 'EUR', // Default currency
            userId: '', // Let App component handle saving with proper logic
            metaAccountName: name
        }));

        const updatedClients = [...clients, ...newClients];
        setClients(updatedClients); // This will trigger a save in App.tsx
        
        if(pendingData) {
            processData(pendingData, updatedClients);
        }

        setIsModalOpen(false);
        setNewAccountNames([]);
        setPendingData(null);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <header className="text-center">
                <h1 className="text-4xl font-bold tracking-tight text-brand-text sm:text-5xl">Importar Reporte Maestro</h1>
                <p className="mt-4 text-lg text-brand-text-secondary">Sube el reporte de Excel con los datos de rendimiento de todas tus cuentas.</p>
            </header>

            <div className="bg-brand-surface rounded-lg p-6 shadow-lg">
                 <div
                    className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors border-brand-border ${isProcessing ? 'cursor-not-allowed bg-brand-bg/50' : 'cursor-pointer hover:border-brand-primary bg-brand-bg'}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                        className="hidden" 
                        accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                        disabled={isProcessing} 
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className={`mx-auto h-12 w-12 ${isProcessing ? 'text-brand-border animate-spin' : 'text-brand-text-secondary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <p className={`mt-4 text-lg font-semibold ${isProcessing ? 'text-brand-text-secondary' : 'text-brand-text'}`}>{isProcessing ? 'Procesando...' : 'Arrastra tu reporte (.xlsx) o haz clic'}</p>
                    <p className="mt-1 text-sm text-brand-text-secondary">La aplicación detectará clientes nuevos y te pedirá confirmación.</p>
                </div>

                {feedback && (
                    <div className={`mt-4 text-center p-3 rounded-md text-sm font-semibold`}
                        style={{ 
                            backgroundColor: feedback.type === 'info' ? '#3B82F620' : feedback.type === 'success' ? '#22C55E20' : '#EF444420',
                            color: feedback.type === 'info' ? '#60A5FA' : feedback.type === 'success' ? '#4ADE80' : '#F87171'
                        }}>
                           {feedback.message}
                    </div>
                )}
            </div>

            <NewClientsModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                newAccountNames={newAccountNames}
                onConfirm={handleCreateNewClients}
            />
        </div>
    );
};
