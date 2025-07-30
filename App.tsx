
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Placement, Creative, AnalysisResult, FormatGroup, Language, CreativeSet, Client, AnalysisHistoryEntry, AggregatedAdPerformance, User } from './types';
import { PLACEMENTS, META_ADS_GUIDELINES } from './constants';
import { FileUpload } from './components/FileUpload';
import { PlatformSelector } from './components/PlatformSelector';
import { PlatformAnalysisView } from './components/PlatformAnalysisView';
import { LanguageSelector } from './components/LanguageSelector';
import { Navbar } from './components/Navbar';
import { SettingsView } from './components/SettingsView';
import { ControlPanelView } from './components/ControlPanelView';
import { ClientManager } from './components/ClientManager';
import { ClientSelectorModal } from './components/ClientSelectorModal';
import { PerformanceView } from './components/PerformanceView';
import { LoginView } from './components/LoginView';
import { UserManager } from './components/UserManager';
import { ImportView } from './components/ImportView';
import { HelpView } from './components/HelpView';
import { LogView } from './components/LogView';
import db, { dbConnectionStatus, dbTyped } from './database';
import Logger from './Logger';

type View = 'upload' | 'format_selection' | 'format_analysis';
type AppView = 'main' | 'clients' | 'control_panel' | 'settings' | 'performance' | 'users' | 'import' | 'help' | 'logs';

const CACHE_KEY_PREFIX = 'metaAdCreativeAnalysis_';
const CURRENT_CLIENT_KEY = 'current_client_id'; // This can remain in localStorage as it's ephemeral session state
// Temporary flag to bypass the login screen
const DISABLE_LOGIN = true;

const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });

    return {
        inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: file.type,
        },
    };
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const extractFrames = (videoFile: File, numFrames: number = 5): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(videoFile);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const frames: string[] = [];

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const duration = video.duration;
            if (duration === 0) { // Can happen for some formats
                resolve([]);
                return;
            }

            const interval = duration / (numFrames -1);
            let framesExtracted = 0;

            const seekAndCapture = (time: number) => {
                 video.currentTime = time;
            };

            video.onseeked = () => {
                if (context) {
                    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                    frames.push(dataUrl);
                }
                framesExtracted++;
                if (framesExtracted === numFrames) {
                    URL.revokeObjectURL(video.src);
                    resolve(frames);
                } else {
                   seekAndCapture(Math.min(framesExtracted * interval, duration));
                }
            };
            
            seekAndCapture(0);
        };
        
        video.onerror = (e) => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Error loading video file for frame extraction.'));
        };
    });
};

const getFormatAnalysis = async (creativeSet: CreativeSet, formatGroup: FormatGroup, language: Language, context: string): Promise<AnalysisResult | null> => {
    const isSpanish = language === 'es';

    if (!process.env.API_KEY) {
        return { 
            creativeDescription: isSpanish ? "Error: API Key no configurada." : "Error: API Key not set.",
            effectivenessScore: 0,
            effectivenessJustification: isSpanish ? "API Key no configurada." : "API Key not set.",
            clarityScore: 0,
            clarityJustification: isSpanish ? "API Key no configurada." : "API Key not set.",
            textToImageRatio: 0,
            textToImageRatioJustification: isSpanish ? "API Key no configurada." : "API Key not set.",
            funnelStage: "N/A",
            funnelStageJustification: isSpanish ? "API Key no configurada." : "API Key not set.",
            recommendations: [],
            advantagePlusAnalysis: [],
            placementSummaries: [],
            overallConclusion: { 
                headline: isSpanish ? "Error de Configuración" : "Configuration Error",
                checklist: [{ 
                    severity: 'CRITICAL', 
                    text: isSpanish 
                        ? "La API Key de Gemini no está configurada. Por favor, asegúrate de que la variable de entorno API_KEY esté disponible."
                        : "The Gemini API Key is not configured. Please ensure the API_KEY environment variable is available."
                }] 
            },
        };
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const placementsForFormat = PLACEMENTS.filter(p => p.group === formatGroup);
    const placementListForPrompt = placementsForFormat.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');
    const languageInstruction = isSpanish ? 'ESPAÑOL' : 'ENGLISH';
    
    const representativePlacement = placementsForFormat.length > 0 ? placementsForFormat[0] : PLACEMENTS.find(p => p.group === formatGroup);
    const safeZoneTop = representativePlacement?.safeZone.top ?? '14%';
    const safeZoneBottom = representativePlacement?.safeZone.bottom ?? '20%';

    const prompt = `
      **Instrucción Maestra:**
      Actúas como un director de arte y estratega de marketing para Meta Ads, con un ojo extremadamente crítico, amigable y detallista. Tu tarea es realizar un análisis HOLÍSTICO del creativo proporcionado (imagen o secuencia de fotogramas de video) para el grupo de formatos '${formatGroup}'. Tu análisis debe ser específico, accionable y basarse en el creativo y las especificaciones. TODO el texto de tu respuesta debe estar exclusivamente en ${languageInstruction}.

      **Contexto Adicional:**
      ${context}
      
      **Análisis de Video (Si aplica):**
      Si se te proporcionan múltiples imágenes, son fotogramas secuenciales de un video. Analízalos en orden para entender la narrativa y la evolución visual del anuncio. Tu descripción y recomendaciones deben reflejar este flujo.

      **Paso 0: Comprensión del Objetivo del Creativo (ACCIÓN FUNDAMENTAL):**
      Antes de CUALQUIER otra cosa, tu primera acción es entender a fondo qué está vendiendo o qué oferta clave está comunicando el creativo. Identifica el producto, servicio, o mensaje principal. TODO tu análisis posterior (puntuaciones, justificaciones, recomendaciones) debe estar rigurosamente fundamentado en este objetivo central que has identificado. Esta comprensión inicial es la base de un feedback útil y relevante.

      **Ubicaciones a Considerar en tu Análisis para '${formatGroup}':**
      ${placementListForPrompt}

      **TAREAS DE ANÁLISİS OBLIGATORIAS (Basadas en el Paso 0):**
      
      **1. DESCRIPCIÓN DETALLADA DEL CREATIVO (NUEVO Y CRÍTICO):**
      - **creativeDescription**: Describe la imagen o la secuencia de fotogramas de forma precisa y detallada. Menciona los elementos clave (productos, personas, texto principal, ambiente, colores dominantes) y cómo evolucionan si es un video. Esta descripción es fundamental, ya que se usará como contexto para futuros análisis. Sé específico.

      **2. ANÁLISIS ESTRATÉGICO GLOBAL:**
      - **effectivenessJustification**: Para la justificación de efectividad, sé coherente. Si el puntaje es BAJO (<50), la justificación DEBE explicar por qué el creativo falla en comunicar su objetivo principal. Si es ALTO (>=50), debe resaltar cómo logra exitosamente comunicar dicho objetivo.
      - **textToImageRatio**: Al calcular este porcentaje, ignora por completo los subtítulos generados o incrustados que transcriben el audio. Céntrate únicamente en texto gráfico superpuesto, logos o llamadas a la acción que formen parte del diseño.
      - **recommendations**: Proporciona recomendaciones generales para mejorar cómo el creativo comunica su objetivo.

      **3. ANÁLISIS DE ZONAS DE SEGURIDAD (LA TAREA MÁS IMPORTANTE):**
      - **placementSummaries**: Tu MÁXIMA PRIORIDAD. Para el grupo de formatos '${formatGroup}', las zonas seguras son cruciales. La interfaz de usuario (UI) generalmente ocupa el **${safeZoneTop} superior** y el **${safeZoneBottom} inferior** del lienzo en ubicaciones como Stories y Reels. Tu tarea es analizar si algún elemento clave del creativo cae en estas zonas de riesgo.
      Para hacerlo de forma precisa, sigue este proceso mental:
      1.  **Localización de Elementos:** Primero, identifica los elementos más importantes (logo, titular principal, oferta, producto, CTA). Para cada uno, determina su ubicación precisa en el lienzo (ej: "el logo está en la esquina superior izquierda", "la oferta está justo en el centro", "el texto legal está en el borde inferior").
      2.  **Verificación de Zonas de Riesgo:** Ahora, compara la ubicación de cada elemento con las zonas de riesgo que te he indicado (${safeZoneTop} superior y ${safeZoneBottom} inferior).
      3.  **Elaboración del Resumen:** En tu \`summary\`, sé muy específico y literal. Si un elemento como "POR TIEMPO LIMITADO" está claramente en el centro, DEBES reportarlo como "colocado correctamente en una zona segura". Si el logo "MARAN CONCEPT" está en la parte superior, entonces sí debes marcarlo como un riesgo CRÍTICO porque cae dentro del ${safeZoneTop} superior. Tu objetivo es evitar a toda costa los 'falsos positivos' (marcar como riesgoso algo que está en una zona segura). Si no hay problemas, indícalo explícitamente como algo positivo.

      **4. ANÁLISIS DE MEJORAS ADVANTAGE+:**
      - **advantagePlusAnalysis**: Utiliza el documento "Mejoras automáticas de Meta Advantage+" que se te proporciona más abajo para analizar CADA una de las mejoras listadas en el documento. Indica si se recomienda 'ACTIVATE' o si se debe usar con 'CAUTION', y justifica tu respuesta basándote en cómo la mejora potenciaría (o perjudicaría) el objetivo principal del creativo.

      **5. CONCLUSIÓN FINAL:**
      - **overallConclusion**: Un objeto con un 'headline' conciso y un 'checklist' accionable y priorizado, enfocado en el objetivo del creativo.

      **Formato de Salida Obligatorio (JSON ÚNICAMENTE):**
      Debes responder con un único objeto JSON. TODO el texto debe estar en ${languageInstruction}.

      --- DOCUMENTO DE ESPECIFICACIONES (META ADS Y ADVANTAGE+) ---
      ${META_ADS_GUIDELINES}
      --- FIN DEL DOCUMENTO ---
    `;
    
    const analysisSchema = {
        type: Type.OBJECT,
        properties: {
            creativeDescription: { 
                type: Type.STRING,
                description: 'Una descripción detallada del contenido visual del creativo. Menciona elementos clave como productos, personas, texto, ambiente y colores. Esto se usará como contexto para análisis futuros.'
            },
            effectivenessScore: { type: Type.NUMBER },
            effectivenessJustification: { type: Type.STRING },
            clarityScore: { type: Type.NUMBER },
            clarityJustification: { type: Type.STRING },
            textToImageRatio: { type: Type.NUMBER },
            textToImageRatioJustification: { type: Type.STRING },
            funnelStage: { type: Type.STRING, enum: ['TOFU', 'MOFU', 'BOFU'] },
            funnelStageJustification: { type: Type.STRING },
            recommendations: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        headline: { type: Type.STRING },
                        points: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['headline', 'points'],
                },
            },
            advantagePlusAnalysis: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        enhancement: { type: Type.STRING },
                        applicable: { type: Type.STRING, enum: ['ACTIVATE', 'CAUTION'] },
                        justification: { type: Type.STRING },
                    },
                    required: ['enhancement', 'applicable', 'justification'],
                },
            },
            placementSummaries: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        placementId: { type: Type.STRING },
                        summary: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['placementId', 'summary'],
                }
            },
            overallConclusion: {
                type: Type.OBJECT,
                properties: {
                    headline: { type: Type.STRING },
                    checklist: { 
                        type: Type.ARRAY, 
                        items: { 
                            type: Type.OBJECT,
                            properties: {
                                severity: { type: Type.STRING, enum: ['CRITICAL', 'ACTIONABLE', 'POSITIVE'] },
                                text: { type: Type.STRING },
                            },
                            required: ['severity', 'text'],
                        } 
                    },
                },
                required: ['headline', 'checklist'],
            }
        },
        required: [
            'creativeDescription',
            'effectivenessScore', 'effectivenessJustification', 
            'clarityScore', 'clarityJustification',
            'textToImageRatio', 'textToImageRatioJustification',
            'funnelStage', 'funnelStageJustification',
            'recommendations', 'advantagePlusAnalysis', 'placementSummaries', 'overallConclusion'
        ],
    };

    try {
        const parts: ({ text: string; } | { inlineData: { data: string; mimeType: string; }; })[] = [{ text: prompt }];
        const relevantCreative = formatGroup === 'SQUARE_LIKE' ? creativeSet.square : creativeSet.vertical;
        const creativeToAnalyze = relevantCreative || (formatGroup === 'SQUARE_LIKE' ? creativeSet.vertical : creativeSet.square);
        
        if (!creativeToAnalyze) {
            throw new Error("No creative available for analysis.");
        }

        if (creativeToAnalyze.type === 'video') {
            const frames = await extractFrames(creativeToAnalyze.file);
            if (frames.length === 0) {
                 throw new Error("Could not extract frames from video. The file might be corrupted or in an unsupported format.");
            }
            frames.forEach(frameData => {
                parts.push({ inlineData: { data: frameData, mimeType: 'image/jpeg' } });
            });
        } else {
            parts.push(await fileToGenerativePart(creativeToAnalyze.file));
        }

        if (parts.length === 1) { 
             throw new Error("No content was generated for the AI prompt.");
        }
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: analysisSchema,
            },
        });

        if (!response.text) {
             if (response.candidates && response.candidates[0]) {
                const finishReason = response.candidates[0].finishReason;
                let headline, errorMessage;
                switch (finishReason) {
                    case 'SAFETY':
                        headline = isSpanish ? "Respuesta Bloqueada por Seguridad" : "Response Blocked for Safety";
                        errorMessage = isSpanish 
                            ? 'El contenido del creativo puede haber sido identificado como sensible.' 
                            : 'The creative content may have been identified as sensitive.';
                        break;
                    case 'RECITATION':
                         headline = isSpanish ? "Respuesta Bloqueada por Recitación" : "Response Blocked for Recitation";
                         errorMessage = isSpanish 
                            ? 'El contenido es demasiado similar a material protegido por derechos de autor.' 
                            : 'The content is too similar to copyrighted material.';
                        break;
                    case 'MAX_TOKENS':
                         headline = isSpanish ? "Límite de Tokens Alcanzado" : "Token Limit Reached";
                         errorMessage = isSpanish 
                            ? 'Se alcanzó el límite máximo de tokens. Intenta con un creativo más simple.' 
                            : 'The maximum token limit was reached. Try with a simpler creative.';
                        break;
                    default:
                        headline = isSpanish ? "Fallo de Generación" : "Generation Failed";
                        errorMessage = isSpanish 
                            ? `La respuesta de la IA está vacía. Esto puede ocurrir si el modelo no puede procesar el archivo o si la respuesta fue bloqueada por otras razones.`
                            : 'The AI response is empty. This can occur if the model cannot process the file or if the response was blocked for other reasons.';
                }
                return {
                    creativeDescription: "Error", effectivenessScore: 0, effectivenessJustification: "Error", clarityScore: 0, clarityJustification: "Error", textToImageRatio: 0, textToImageRatioJustification: "Error", funnelStage: "Error", funnelStageJustification: "Error", recommendations: [], advantagePlusAnalysis: [], placementSummaries: [],
                    overallConclusion: { headline, checklist: [{ severity: 'CRITICAL', text: errorMessage }] },
                };
            }
            throw new Error(isSpanish 
                ? 'La respuesta de la IA está vacía. Esto puede deberse a que el formato del archivo es inválido (prueba con MP4), el contenido no es claro, o hubo un problema al generar la respuesta estructurada.' 
                : 'The AI response is empty. This might be because the file format is invalid (try MP4), the content is unclear, or there was an issue generating the structured response.');
        }

        const jsonText = response.text.trim();
        const cleanedJson = jsonText.replace(/^```json\n?/, '').replace(/```$/, '');
        return JSON.parse(cleanedJson);

    } catch (error) {
        console.error("Error fetching or parsing Gemini recommendations:", error);
        
        let headline = isSpanish ? "Error de Análisis" : "Analysis Error";
        let errorMessage = isSpanish 
            ? "Hubo un error al generar las recomendaciones."
            : "There was an error generating the recommendations.";

        if (error instanceof Error) {
            errorMessage = error.message;
        }
        
        return {
            creativeDescription: "Error", effectivenessScore: 0, effectivenessJustification: "Error", clarityScore: 0, clarityJustification: "Error", textToImageRatio: 0, textToImageRatioJustification: "Error", funnelStage: "Error", funnelStageJustification: "Error", recommendations: [], advantagePlusAnalysis: [], placementSummaries: [],
            overallConclusion: { headline, checklist: [{ severity: 'CRITICAL', text: errorMessage }] },
        };
    }
};

const getFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const App: React.FC = () => {
    // App State
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [mainView, setMainView] = useState<AppView>('main');
    const [analysisView, setAnalysisView] = useState<View>('upload');
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start true for initial load
    const [isConnecting, setIsConnecting] = useState(true); // For DB connection status

    // Data State
    const [users, setUsers] = useState<User[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryEntry[]>([]);
    const [dbConfig, setDbConfig] = useState({ host: 'postgres.heredia.ar', port: '7777', user: 'supostgres', pass: 'd0pam1na!', database: 'app' });
    const [dbStatus, setDbStatus] = useState<boolean>(false);

    // Creative Analysis State
    const [creativeSet, setCreativeSet] = useState<CreativeSet>({ square: null, vertical: null });
    const [selectedFormatGroup, setSelectedFormatGroup] = useState<FormatGroup | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [language, setLanguage] = useState<Language>('es');

    // Modal/Pending State
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    
    // --- DATABASE & PERSISTENCE ---

    const handleTestConnection = useCallback(async (config: any): Promise<boolean> => {
        setIsConnecting(true);
        Logger.info('Attempting to connect to the database...', config);
        await new Promise(res => setTimeout(res, 1000)); // Simulate connection time
        const success = !!(config.host && config.user && config.pass && config.database && config.port);
        
        dbConnectionStatus.connected = success;
        setDbStatus(success);
        setDbConfig(config);

        if (success) {
            await dbTyped.saveConfig(config);
            Logger.success('Database connection successful and configuration saved.');
        } else {
             Logger.error('Database connection failed.');
        }
        
        setIsConnecting(false);
        return success;
    }, []);

    // Initial load: Get config and connect to DB
    useEffect(() => {
        const initializeApp = async () => {
            Logger.info('Application initializing...');
            setIsConnecting(true);
            const savedConfig = await dbTyped.getConfig();
            const configToTest = savedConfig || dbConfig;
            await handleTestConnection(configToTest);
        };
        initializeApp();
    }, [handleTestConnection]); // eslint-disable-line react-hooks/exhaustive-deps
    
    // Load all data from DB after connection is established
    useEffect(() => {
        const loadDataFromDb = async () => {
            if (dbStatus) {
                Logger.info('Database connection is active. Loading data...');
                setIsLoading(true);
                try {
                    const [loadedUsers, loadedClients, loadedHistory, loggedInUser] = await Promise.all([
                        dbTyped.getUsers(),
                        dbTyped.getClients(),
                        dbTyped.getHistory(),
                        dbTyped.getLoggedInUser()
                    ]);

                    let defaultAdmin: User | undefined;
                    if (loadedUsers.length === 0) {
                        Logger.warn('No users found in DB. Creating default Admin user.');
                        defaultAdmin = { id: crypto.randomUUID(), username: 'Admin', password: 'Admin', role: 'admin' };
                        setUsers([defaultAdmin]);
                        await dbTyped.saveUsers([defaultAdmin]);
                    } else {
                        setUsers(loadedUsers);
                    }

                    setClients(loadedClients);
                    setAnalysisHistory(loadedHistory);
                    Logger.success(`Loaded ${loadedUsers.length} users, ${loadedClients.length} clients, and ${loadedHistory.length} history entries.`);

                    const availableUsers = loadedUsers.length > 0 ? loadedUsers : (defaultAdmin ? [defaultAdmin] : []);
                    if (loggedInUser && availableUsers.some(u => u.id === loggedInUser.id)) {
                        Logger.info(`Found logged in user: ${loggedInUser.username}`);
                        setCurrentUser(loggedInUser);
                        setIsLoggedIn(true);
                    } else if (DISABLE_LOGIN && availableUsers.length > 0) {
                        Logger.info(`Auto login enabled. Using user: ${availableUsers[0].username}`);
                        setCurrentUser(availableUsers[0]);
                        setIsLoggedIn(true);
                        dbTyped.saveLoggedInUser(availableUsers[0]);
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown DB error';
                    Logger.error('Failed to load data from database.', { error: message });
                    alert("Error crítico: No se pudieron cargar los datos de la base de datos.");
                } finally {
                    setIsLoading(false);
                }
            }
        };

        loadDataFromDb();
    }, [dbStatus]);
    
    // Persist data changes to DB
    useEffect(() => { if (dbStatus && users.length > 0) dbTyped.saveUsers(users); }, [users, dbStatus]);
    useEffect(() => { if (dbStatus) dbTyped.saveClients(clients); }, [clients, dbStatus]);
    useEffect(() => { if (dbStatus) dbTyped.saveHistory(analysisHistory); }, [analysisHistory, dbStatus]);

    // --- LOGIC ---
    
    const visibleClients = useMemo(() => {
        if (currentUser?.role === 'admin') return clients;
        if (currentUser) return clients.filter(c => c.userId === currentUser.id);
        return [];
    }, [clients, currentUser]);

    const analysisCounts = useMemo(() => {
        const counts: { [clientId: string]: number } = {};
        clients.forEach(client => { counts[client.id] = 0; });
        analysisHistory.forEach(entry => {
            if (counts[entry.clientId] !== undefined) {
                counts[entry.clientId]++;
            }
        });
        return counts;
    }, [clients, analysisHistory]);

    useEffect(() => {
        const squareUrl = creativeSet.square?.url;
        const verticalUrl = creativeSet.vertical?.url;
        return () => {
            if (squareUrl) URL.revokeObjectURL(squareUrl);
            if (verticalUrl) URL.revokeObjectURL(verticalUrl);
        };
    }, [creativeSet]);
    
    const processPendingFile = useCallback(async (file: File, clientId: string) => {
        setIsLoading(true);
        Logger.info(`Processing file "${file.name}" for client ID: ${clientId}`);
        localStorage.setItem(CURRENT_CLIENT_KEY, clientId); // Session-specific, fine for localStorage
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('image/') ? 'image' : 'video';
        const hash = await getFileHash(file);
        
        const processCreative = (width: number, height: number) => {
            const aspectRatio = width / height;
            const newCreative: Creative = { file, url, type, width, height, format: aspectRatio >= 1 ? 'square' : 'vertical', hash };
            setCreativeSet({ square: newCreative.format === 'square' ? newCreative : null, vertical: newCreative.format === 'vertical' ? newCreative : null });
            setAnalysisView('format_selection');
            setIsLoading(false);
            Logger.success(`Creative "${file.name}" processed. Ready for format selection.`);
        };
        
        if (type === 'image') {
            const element = new Image();
            element.onload = () => processCreative(element.naturalWidth, element.naturalHeight);
            element.onerror = () => {
                const errorMsg = language === 'es' ? 'Error al cargar el archivo de imagen.' : 'Error loading image file.';
                alert(errorMsg);
                Logger.error(errorMsg, {filename: file.name});
                URL.revokeObjectURL(url);
                setIsLoading(false);
            };
            element.src = url;
        } else { // video
            const element = document.createElement('video');
            element.onloadedmetadata = () => processCreative(element.videoWidth, element.videoHeight);
             element.onerror = () => {
                const errorMsg = language === 'es' ? 'Error al cargar el archivo de video.' : 'Error loading video file.';
                alert(errorMsg);
                Logger.error(errorMsg, {filename: file.name});
                URL.revokeObjectURL(url);
                setIsLoading(false);
            };
            element.src = url;
        }

    }, [language]);

    const handleFileUpload = useCallback(async (file: File) => {
        Logger.info(`File upload initiated: ${file.name}`, { size: file.size, type: file.type });
        if (!dbStatus) {
            const errorMsg = language === 'es' ? 'Por favor, configura y prueba la conexión a la base de datos en la pestaña de Configuración antes de subir un archivo.' : 'Please configure and test the database connection in the Settings tab before uploading a file.';
            alert(errorMsg);
            Logger.error('File upload blocked: DB not connected.');
            setMainView('settings');
            return;
        }
         if (visibleClients.length === 0) {
            const errorMsg = language === 'es' ? 'No hay clientes creados. Por favor, crea un cliente en la pestaña de Clientes antes de subir un archivo.' : 'No clients found. Please create a client in the Clients tab before uploading a file.';
            alert(errorMsg);
            Logger.error('File upload blocked: No clients available for current user.');
            setMainView('clients');
            return;
        }

        setIsLoading(true);
        const hash = await getFileHash(file);
        const { name, size } = file;
        Logger.info(`File hash calculated: ${hash}`);
        
        const existingEntry = analysisHistory.find(entry => entry.hash === hash && entry.filename === name && entry.size === size);
        setIsLoading(false);

        if (existingEntry) {
            const clientName = clients.find(c => c.id === existingEntry.clientId)?.name || 'un cliente';
            const msg = `Este creativo ya fue analizado previamente para ${clientName}. Asignando automáticamente.`;
            alert(msg);
            Logger.info(`Found existing analysis for creative.`, { filename: name, clientId: existingEntry.clientId });
            await processPendingFile(file, existingEntry.clientId);
        } else {
            Logger.info(`No existing analysis found. Opening client selection modal.`);
            setPendingFile(file);
            setIsClientModalOpen(true);
        }
    }, [dbStatus, language, clients, visibleClients, analysisHistory, processPendingFile]);


    const handleClientSelected = (clientId: string) => {
        if (pendingFile) {
            Logger.info(`Client ${clientId} selected for pending file "${pendingFile.name}".`);
            processPendingFile(pendingFile, clientId);
        }
        setIsClientModalOpen(false);
        setPendingFile(null);
    };

    const handleFormatSelect = useCallback(async (format: FormatGroup) => {
        if (!creativeSet.square && !creativeSet.vertical) return;
        
        Logger.info(`Format selected for analysis: ${format}`);
        setSelectedFormatGroup(format);
        setAnalysisView('format_analysis');
        setIsLoading(true);
        setAnalysisResult(null);

        const creativeToAnalyze = format === 'SQUARE_LIKE' ? (creativeSet.square || creativeSet.vertical) : (creativeSet.vertical || creativeSet.square);
        if (!creativeToAnalyze) {
            setIsLoading(false); return;
        }
        
        const clientId = localStorage.getItem(CURRENT_CLIENT_KEY);
        const cacheKey = `${CACHE_KEY_PREFIX}${creativeToAnalyze.hash}-${clientId}-${language}-${format}`;
        
        try {
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
                const { result, timestamp } = JSON.parse(cachedData);
                const isExpired = Date.now() - timestamp > 48 * 60 * 60 * 1000;
                
                if (!isExpired) {
                    const msg = language === 'es' ? 'Se encontró un análisis reciente en caché para este creativo (< 48hs). Mostrando resultados guardados.' : 'A recent analysis for this creative (< 48hs) was found in cache. Displaying saved results.';
                    alert(msg);
                    Logger.info(`Using cached analysis for ${creativeToAnalyze.file.name}.`);
                    setAnalysisResult(result);
                    setIsLoading(false);
                    return;
                }
            }
        } catch(e) { Logger.error("Error reading from cache", e); }


        const clientHistory = analysisHistory.filter((h) => h.clientId === clientId).slice(-15);
        const historyContext = clientHistory.map((h) => `File: ${h.filename}\nDate: ${h.date}\nDescription: ${h.description}`).join('\n\n');
        
        const currentClient = clients.find(c => c.id === clientId);
        const clientContext = currentClient ? `Analizando para el cliente: ${currentClient.name} (Moneda: ${currentClient.currency})` : '';

        const fullContext = `
            ${clientContext}

            A continuación se muestran los datos de los últimos creativos analizados para este cliente. Utiliza esta información para identificar patrones, estilos recurrentes o campañas y adaptar tus recomendaciones para que sean más coherentes y estratégicas con el historial de la cuenta.
            ${historyContext || 'No hay historial previo.'}
        `;
        
        Logger.info(`Requesting new AI analysis for ${creativeToAnalyze.file.name}.`);
        const result = await getFormatAnalysis(creativeSet, format, language, fullContext.trim());

        if (result && !result.overallConclusion.headline.toLowerCase().includes('error')) {
            Logger.success(`Successfully analyzed creative "${creativeToAnalyze.file.name}" for format ${format}.`);
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ result, timestamp: Date.now() }));
                 Logger.info('Analysis result saved to cache.');
            } catch (cacheError) {
                Logger.warn('Could not save analysis to cache. Storage might be full.', cacheError);
            }
        
            const MAX_HISTORY_ENTRIES = 50;
            const dataUrl = await fileToBase64(creativeToAnalyze.file);

            const newHistoryEntry: AnalysisHistoryEntry = { 
                clientId: clientId!,
                filename: creativeToAnalyze.file.name,
                hash: creativeToAnalyze.hash,
                size: creativeToAnalyze.file.size,
                date: new Date().toISOString(),
                description: result.creativeDescription,
                dataUrl: dataUrl,
                fileType: creativeToAnalyze.type,
            };
    
            const updatedHistory = [...analysisHistory, newHistoryEntry];
            setAnalysisHistory(updatedHistory.slice(-MAX_HISTORY_ENTRIES));
            Logger.info(`New analysis saved to history.`, newHistoryEntry);
        } else {
             Logger.error(`Analysis failed for creative "${creativeToAnalyze.file.name}" for format ${format}.`, result?.overallConclusion);
        }
        
        setAnalysisResult(result);
        setIsLoading(false);
    }, [creativeSet, language, clients, analysisHistory]);
    
    const handleReset = () => {
        Logger.info('Resetting analysis view.');
        setCreativeSet({ square: null, vertical: null });
        setSelectedFormatGroup(null);
        setAnalysisResult(null);
        setIsLoading(false);
        setAnalysisView('upload');
    };
    
    const handleDeleteClient = async (clientId: string) => {
        if (!window.confirm('¿Seguro que quieres eliminar este cliente?')) return;
        
        if (!window.confirm('CONFIRMACIÓN FINAL: Esta acción es irreversible y eliminará el cliente, todo su historial de análisis y todos sus datos de rendimiento. ¿Continuar?')) return;

        try {
            setIsLoading(true);
            const clientName = clients.find(c => c.id === clientId)?.name || 'N/A';
            Logger.warn(`Initiating deletion of client "${clientName}" (ID: ${clientId}).`);
            
            const updatedClients = clients.filter(c => c.id !== clientId);
            setClients(updatedClients);

            const updatedHistory = analysisHistory.filter(h => h.clientId !== clientId);
            setAnalysisHistory(updatedHistory);

            const perfData = await dbTyped.getPerformanceData();
            delete perfData[clientId];
            await dbTyped.savePerformanceData(perfData);

            // This one can remain in localStorage as it's not core data
            const processedReportsKey = 'processed_reports_hashes';
            const processedHashes = JSON.parse(localStorage.getItem(processedReportsKey) || '{}');
            delete processedHashes[clientId];
            localStorage.setItem(processedReportsKey, JSON.stringify(processedHashes));

            Logger.success(`Client "${clientName}" and all associated data have been deleted.`);
            alert('Cliente y todos sus datos asociados han sido eliminados.');
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            Logger.error("Error cleaning up client data from DB", { error: message, clientId });
            alert('Ocurrió un error al eliminar los datos del cliente.');
        } finally {
            setIsLoading(false);
        }
    };

    const getPerformanceAnalysis = useCallback(async (performanceData: AggregatedAdPerformance[], client: Client): Promise<string> => {
        if (!process.env.API_KEY) {
            return "Error: API Key de Gemini no configurada.";
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
        const dataSummary = performanceData.map(ad => {
            return `
    Anuncio: "${ad.adName}"
    - Gasto: ${ad.spend.toLocaleString('es-ES', { style: 'currency', currency: ad.currency })}
    - Impresiones: ${ad.impressions.toLocaleString('es-ES')}
    - Clics: ${ad.clicks.toLocaleString('es-ES')}
    - CTR: ${ad.ctr.toFixed(2)}%
    - Compras: ${ad.purchases}
    - Valor de Compras: ${ad.purchaseValue.toLocaleString('es-ES', { style: 'currency', currency: ad.currency })}
    - CPA (Coste por Compra): ${ad.cpa.toLocaleString('es-ES', { style: 'currency', currency: ad.currency })}
    - CPM (Coste por Mil Impresiones): ${ad.cpm.toLocaleString('es-ES', { style: 'currency', currency: ad.currency })}
    - ROAS (Retorno de la Inversión): ${ad.roas.toFixed(2)}
    - Descripción del creativo (Análisis IA previo): "${ad.creativeDescription || 'No disponible'}"
    `;
        }).join('\n');
    
        const prompt = `
            **Instrucción Maestra:**
            Actúas como un estratega de medios senior analizando el rendimiento de una campaña publicitaria en Meta para el cliente "${client.name}". Se te proporcionan los datos de rendimiento agregados y el análisis cualitativo de varios anuncios. Tu tarea es generar una conclusión estratégica y accionable. La respuesta debe estar exclusivamente en ESPAÑOL.

            **Datos de Rendimiento a Analizar:**
            ${dataSummary}

            **Tareas:**

            1.  **Conclusión General (2-3 frases):** Empieza con un resumen conciso del rendimiento general. ¿Qué patrón observas? ¿Hay un claro ganador?

            2.  **Identificación de Ganadores ("Top Performers"):**
                - Identifica los 2-3 anuncios con mejor rendimiento, basándote principalmente en el ROAS, pero considerando también el CPA y el Gasto (un anuncio con alto ROAS pero bajo gasto es menos significativo).
                - Para cada ganador, explica **POR QUÉ** crees que funcionó bien. Conecta sus métricas (ej. "su alto CTR sugiere que fue muy llamativo") con su descripción cualitativa (ej. "lo que se alinea con la descripción que indicaba un 'mensaje claro y directo'"). Esta conexión es la parte más importante de tu análisis.

            3.  **Identificación de Perdedores ("Underperformers"):**
                - Identifica 1-2 anuncios con bajo rendimiento (bajo ROAS, CPA alto).
                - De manera similar, explica la posible razón de su bajo rendimiento, conectando las métricas con la descripción del creativo. (ej. "su bajo CTR y alto CPA, a pesar de tener una descripción visualmente atractiva, sugiere que el mensaje no conectó con la audiencia o la oferta no fue clara").

            4.  **Próximos Pasos Estratégicos (Accionables):**
                - Proporciona una lista de 3 a 4 recomendaciones claras y accionables.
                - Ejemplo de recomendaciones:
                    - "Basado en el éxito de [Anuncio Ganador], deberíamos asignar más presupuesto a este creativo y sus variantes."
                    - "Crear nuevas iteraciones inspiradas en [Anuncio Ganador], enfocándonos en [elemento clave del ganador como 'videos cortos' o 'imágenes con personas']."
                    - "Pausar [Anuncio Perdedor] para evitar seguir gastando ineficientemente."
                    - "Testear una nueva hipótesis: dado que los anuncios con [característica X] funcionaron bien, probar [idea Y]."

            **Formato de Salida:**
            Usa Markdown para una fácil lectura. Utiliza títulos, negritas y listas para estructurar tu respuesta. No uses formato JSON.
        `;
    
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            return response.text;
        } catch (error) {
            console.error("Error en el análisis de rendimiento por IA:", error);
            if (error instanceof Error) {
                return `Error al contactar la IA: ${error.message}`;
            }
            return "Ocurrió un error desconocido al generar el análisis.";
        }
    }, []);

    const handleLogin = (username: string, pass: string): boolean => {
        const foundUser = users.find(u => u.username === username && u.password === pass);
        if (foundUser) {
            Logger.success(`User login successful: ${username}`);
            setCurrentUser(foundUser);
            setIsLoggedIn(true);
            dbTyped.saveLoggedInUser(foundUser);
            return true;
        }
        Logger.warn(`User login failed for username: ${username}`);
        return false;
    };

    const handleLogout = () => {
        Logger.info(`User logout: ${currentUser?.username}`);
        setIsLoggedIn(false);
        setCurrentUser(null);
        dbTyped.saveLoggedInUser(null);
        setMainView('main');
        handleReset();
    };

    const renderMainContent = () => {
        if (!currentUser) return null; // Should not happen if logged in
        
        const hasAnyCreative = creativeSet.square || creativeSet.vertical;

        const headerTextConfig = {
            es: {
                upload: 'Sube tu creativo para empezar.',
                format_selection: 'Tu creativo está listo. Elige un grupo de formatos para analizar.',
                format_analysis: `Análisis para Cliente`
            },
            en: {
                upload: 'Upload your creative to get started.',
                format_selection: 'Your creative is ready. Choose a format group to analyze.',
                format_analysis: `Analysis for Client`
            }
        };

        const currentClientId = localStorage.getItem(CURRENT_CLIENT_KEY);
        const currentClient = clients.find(c => c.id === currentClientId);

        const mainContent = (
            <>
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold tracking-tight text-brand-text sm:text-5xl">Meta Ads Creative Assistant</h1>
                    <p className="mt-4 text-lg text-brand-text-secondary">
                        {analysisView === 'format_analysis' ? `${headerTextConfig[language][analysisView]} ${currentClient?.name || ''}` : headerTextConfig[language][analysisView]}
                    </p>
                    {hasAnyCreative && (
                        <div className="mt-6">
                            <button
                                onClick={handleReset}
                                className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2 mx-auto"
                            >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566z" clipRule="evenodd" />
                                </svg>
                                {language === 'es' ? 'Cargar Nuevo Creativo' : 'Upload New Creative'}
                            </button>
                        </div>
                    )}
                </header>
                <main>
                    {analysisView === 'upload' && (
                        <div className="max-w-4xl mx-auto">
                            <LanguageSelector language={language} onLanguageChange={setLanguage} />
                            <FileUpload onFileUpload={handleFileUpload} />
                        </div>
                    )}
                    
                    {analysisView === 'format_selection' && hasAnyCreative && (
                        <PlatformSelector onSelectFormat={handleFormatSelect} />
                    )}

                    {analysisView === 'format_analysis' && selectedFormatGroup && (
                        <PlatformAnalysisView
                            creativeSet={creativeSet}
                            formatGroup={selectedFormatGroup}
                            analysisResult={analysisResult}
                            isLoading={isLoading}
                            onGoBack={() => setAnalysisView('format_selection')}
                        />
                    )}
                </main>
            </>
        );

        const loadingText = isConnecting 
            ? (language === 'es' ? 'Conectando a la base de datos...' : 'Connecting to database...') 
            : (language === 'es' ? 'Analizando...' : 'Analyzing...');

        return (
             <div className="min-h-screen text-brand-text p-4 sm:p-6 lg:p-8">
                <Navbar 
                    currentView={mainView}
                    onNavigate={setMainView}
                    dbStatus={dbStatus}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                />
                
                {(isLoading || isConnecting) && (
                    <div className="fixed inset-0 bg-brand-bg/80 flex items-center justify-center z-50">
                        <div className="flex flex-col items-center gap-4">
                             <svg className="animate-spin h-10 w-10 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-lg font-semibold text-brand-text">{loadingText}</p>
                        </div>
                    </div>
                )}
                
                {mainView === 'main' && mainContent}
                {mainView === 'performance' && <PerformanceView clients={visibleClients} analysisHistory={analysisHistory} getPerformanceAnalysis={getPerformanceAnalysis}/>}
                {mainView === 'settings' && <SettingsView initialConfig={dbConfig} onTestConnection={handleTestConnection} dbStatus={dbStatus} />}
                {mainView === 'control_panel' && currentUser.role === 'admin' && <ControlPanelView />}
                {mainView === 'clients' && <ClientManager clients={clients} setClients={setClients} currentUser={currentUser} analysisCounts={analysisCounts} onDeleteClient={handleDeleteClient} />}
                {mainView === 'import' && currentUser.role === 'admin' && <ImportView clients={clients} setClients={setClients} />}
                {mainView === 'users' && currentUser.role === 'admin' && <UserManager users={users} setUsers={setUsers} currentUser={currentUser} />}
                {mainView === 'help' && <HelpView />}
                {mainView === 'logs' && currentUser.role === 'admin' && <LogView />}
    
                <ClientSelectorModal
                    isOpen={isClientModalOpen}
                    onClose={() => setIsClientModalOpen(false)}
                    clients={visibleClients}
                    onClientSelect={handleClientSelected}
                />
            </div>
        )
    }

    if (!isLoggedIn && !DISABLE_LOGIN) {
        return <LoginView onLogin={handleLogin} />;
    }
    
    return renderMainContent();
};

export default App;