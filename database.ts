
import { Client, AnalysisHistoryEntry, User, PerformanceRecord } from './types';

// A simulated database client for a more realistic feel.
// In a real-world scenario, this would be a backend API client.
// This simulation uses localStorage as its data store.

const ARTIFICIAL_DELAY_MS = 400;

type DbConnectionStatus = {
    connected: boolean;
};

// This state is controlled by the App component
export const dbConnectionStatus: DbConnectionStatus = {
    connected: false,
};

const checkConnection = () => {
    if (!dbConnectionStatus.connected) {
        const errorMsg = 'Database not connected. Please check configuration in Settings.';
        console.error(`[DB] ${errorMsg}`);
        throw new Error(errorMsg);
    }
};

const simulateQuery = <T>(action: () => T): Promise<T> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                // Connection is checked inside the action to allow config to be read before connection.
                const result = action();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }, ARTIFICIAL_DELAY_MS);
    });
};

const db = {
    async select<T>(table: string, defaultValue: T): Promise<T> {
        // Allow reading config before connection is established
        if (table !== 'config') {
            checkConnection();
        }
        console.log(`[DB] Executing: SELECT * FROM ${table};`);
        return simulateQuery(() => {
            try {
                const data = localStorage.getItem(`db_${table}`);
                return data ? JSON.parse(data) : defaultValue;
            } catch (e) {
                console.error(`[DB] Error parsing table ${table}:`, e);
                return defaultValue;
            }
        });
    },

    async update(table: string, data: any): Promise<void> {
        // Allow writing config before connection is established
        if (table !== 'config') {
            checkConnection();
        }
        console.log(`[DB] Executing: UPDATE ${table} with new data...`);
        return simulateQuery(() => {
             try {
                localStorage.setItem(`db_${table}`, JSON.stringify(data));
            } catch (e) {
                console.error(`[DB] Error writing to table ${table}:`, e);
                if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
                    alert(`Error: El almacenamiento está lleno. No se pudieron guardar los datos en la tabla "${table}". Libere espacio desde el Panel de Control.`);
                }
            }
        });
    },

    async clearTable(table: string): Promise<void> {
        checkConnection();
        console.log(`[DB] Executing: DELETE FROM ${table};`);
        return simulateQuery(() => {
            localStorage.removeItem(`db_${table}`);
        });
    },

    async clearAllData(): Promise<void> {
        checkConnection();
        console.log(`[DB] Executing: CLEAR ALL USER DATA;`);
        return simulateQuery(() => {
            const keysToClear = [
                'db_clients',
                'db_analysis_history',
                'db_users',
                'db_performance_data',
                'db_processed_reports_hashes',
                'current_client_id',
                'logged_in_user_data'
            ];
            
            keysToClear.forEach(key => localStorage.removeItem(key));
            
            // Clear all analysis cache keys
            Object.keys(localStorage).forEach(key => {
                 if (key.startsWith('metaAdCreativeAnalysis_')) {
                    localStorage.removeItem(key);
                 }
            });
        });
    },
    
    async factoryReset(): Promise<void> {
        // No connection check needed for a full reset
        console.log(`[DB] Executing: FACTORY RESET;`);
        return simulateQuery(() => {
            localStorage.clear();
        });
    }
};

export default db;

// Type-safe wrappers for convenience
export const dbTyped = {
    getUsers: () => db.select<User[]>('users', []),
    saveUsers: (users: User[]) => db.update('users', users),
    
    getClients: () => db.select<Client[]>('clients', []),
    saveClients: (clients: Client[]) => db.update('clients', clients),

    getHistory: () => db.select<AnalysisHistoryEntry[]>('analysis_history', []),
    saveHistory: (history: AnalysisHistoryEntry[]) => db.update('analysis_history', history),

    getPerformanceData: () => db.select<{[key: string]: PerformanceRecord[]}>('performance_data', {}),
    savePerformanceData: (data: {[key:string]: PerformanceRecord[]}) => db.update('performance_data', data),

    getLoggedInUser: () => db.select<User | null>('logged_in_user', null),
    saveLoggedInUser: (user: User | null) => db.update('logged_in_user', user),

    getConfig: () => db.select<any>('config', null),
    saveConfig: (config: any) => db.update('config', config)
};
