import { Client, AnalysisHistoryEntry, User, PerformanceRecord } from './types';

const ARTIFICIAL_DELAY_MS = 400;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type DbConnectionStatus = {
    connected: boolean;
};

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

const simulateQuery = <T>(action: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            action().then(resolve).catch(reject);
        }, ARTIFICIAL_DELAY_MS);
    });
};

async function post<T>(url: string, body: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`API error: ${res.statusText}`);
    }
    return res.json();
}

const db = {
    async select<T>(table: string, defaultValue: T): Promise<T> {
        if (table !== 'config') {
            checkConnection();
        }
        console.log(`[DB] Executing: SELECT * FROM ${table};`);
        return simulateQuery(() =>
            post<T | null>('/select', { table }).catch(() => defaultValue).then(data => data ?? defaultValue)
        );
    },

    async update(table: string, data: any): Promise<void> {
        if (table !== 'config') {
            checkConnection();
        }
        console.log(`[DB] Executing: UPDATE ${table} with new data...`);
        return simulateQuery(() => post('/update', { table, data }).then(() => {}));
    },

    async clearTable(table: string): Promise<void> {
        checkConnection();
        console.log(`[DB] Executing: DELETE FROM ${table};`);
        return simulateQuery(() => post('/clearTable', { table }).then(() => {}));
    },

    async clearAllData(): Promise<void> {
        checkConnection();
        console.log(`[DB] Executing: CLEAR ALL USER DATA;`);
        return simulateQuery(() => post('/clearAllData', {}).then(() => {}));
    },

    async factoryReset(): Promise<void> {
        console.log(`[DB] Executing: FACTORY RESET;`);
        return simulateQuery(() => post('/factoryReset', {}).then(() => {}));
    }
};

export default db;

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
