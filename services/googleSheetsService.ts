

import { DownloadTask, User, UserRole, PackLocation, Olpn, OlpnDistributionLog, ManhattanShipment, AnalystMemoryEntry, AuditRecord, ImpactMetric, LocationAuditRecord } from '../types';

// This 'google' object is only available in the Apps Script environment.
declare const google: any;

export interface ImpactFilterOptions {
  unidadesNegocio: string[];
  zonas: string[];
  tiposPicking: string[];
}

// --- START: Manhattan API Response Types ---
export interface ManhattanApiFailure {
  shipmentId?: string;
  appointmentId?: string;
  message: string;
  record: any;
}

export interface ManhattanApiResponse {
    successCount: number;
    failureCount: number;
    totalCount: number;
    failures: ManhattanApiFailure[];
    createdAppointments?: any[]; // Optional, for shipment creation response
}
// --- END: Manhattan API Response Types ---


// --- SERVICE INTERFACE ---
// Defines a common interface for both real and mock services.
interface IGoogleSheetsService {
    login(username: string, password: string): Promise<User | null>;
    logout(): Promise<void>;
    getUsers(): Promise<User[]>;
    addUser(user: User): Promise<User>;
    updateUser(user: User): Promise<User>;
    deleteUser(username: string): Promise<{ username: string }>;
    getTasks(): Promise<DownloadTask[]>; // Restored to simple array
    addTasks(tasks: DownloadTask[]): Promise<DownloadTask[]>;
    updateTask(task: DownloadTask): Promise<DownloadTask>;
    getPackLocationDetails(): Promise<PackLocation[]>;
    getManhattanToken(): Promise<string>;
    searchManhattanOlpn(token: string, palletId: string): Promise<Olpn[]>;
    combineOlpns(token: string, sourceOlpnId: string, destinationOlpnId: string): Promise<any>;
    logOlpnDistribution(logEntry: Omit<OlpnDistributionLog, '_rowIndex' | 'fechahoraconfirmado'>): Promise<void>;
    getOlpnDistributionLog(filters: Partial<Pick<OlpnDistributionLog, 'palletid' | 'usuario' | 'olpnorigenid' | 'olpndestinoid' | 'local' | 'ubicaciondestino'>> & { startDate?: string; endDate?: string }): Promise<OlpnDistributionLog[]>;
    getManhattanShipments(date: string): Promise<ManhattanShipment[]>;
    addManhattanShipments(shipments: Omit<ManhattanShipment, '_rowIndex' | 'FechaHoraCreacion' | 'UsuarioCreacion' | 'Número de envío Manhattan'>[], user: string): Promise<ManhattanApiResponse>;
    createManhattanAppointments(shipments: ManhattanShipment[], user: string): Promise<ManhattanApiResponse>;
    getAppConfig(): Promise<{ version: string; ambiente: string; }>;
    getAnalystMemory(): Promise<AnalystMemoryEntry[]>;
    addAnalystMemoryEntry(entry: Omit<AnalystMemoryEntry, 'fechaAnalisis'>): Promise<AnalystMemoryEntry>;
    callGeminiAgent(payload: { history: any[], systemInstruction: string, newMessage: string }): Promise<{ text: string; totalTokens: number; }>;
    analyzeWithGemini(prompt: string): Promise<{ text: string; totalTokens: number; }>;
    
    // --- AUDIT METHODS ---
    searchManhattanOlpnForAudit(token: string, olpnId: string): Promise<{ success: boolean; data: any[] }>;
    searchManhattanItems(token: string, itemIds: string[]): Promise<{ success: boolean; data: any[] }>;
    searchManhattanItemByBarcode(token: string, barcode: string): Promise<{ success: boolean; data: any[] }>;
    getAuditRecords(filters: any): Promise<AuditRecord[]>;
    saveAuditRecords(records: AuditRecord[]): Promise<void>;
    
    // --- LOCATION AUDIT METHODS ---
    searchManhattanLocation(token: string, barcode: string): Promise<string | null>;
    searchManhattanIlpnsInLocation(token: string, locationId: string): Promise<string[]>;
    searchManhattanOlpnsInLocation(token: string, locationId: string): Promise<string[]>;
    getLocationAuditRecords(filters: { startDate: string; endDate: string; location?: string; user?: string; local?: string }): Promise<LocationAuditRecord[]>;
    saveLocationAuditRecords(records: LocationAuditRecord[]): Promise<void>;

    // --- REVERSE LOGISTICS ---
    processReverseLogistics(token: string, payload: any): Promise<any>;

    // --- IMPACT ANALYST V2 ---
    getImpactMetrics(): Promise<ImpactMetric[]>;
    getFilterOptions(processName: string): Promise<ImpactFilterOptions>;
    getImpactAnalysisData(processName: string, changeDate: string, filters?: any): Promise<any[]>;
    getAnalystV2Prompt(processName: string, changeDate: string, selectedIndicators: ImpactMetric[], data: any[], filterContext: string): Promise<string>;
}

// Helper function to normalize a user object from the backend
const normalizeUser = (userFromBackend: any): User | null => {
    if (!userFromBackend) {
        return null;
    }

    const username = userFromBackend.username || userFromBackend.Username;

    // The username is the absolute minimum requirement. If it's missing, we can't use the record.
    if (!username) {
        console.warn("Skipping user record from backend due to missing username:", userFromBackend);
        return null;
    }

    const user: User = {
        username: username,
        // If name is missing, default to the username to ensure visibility in the UI.
        name: userFromBackend.name || userFromBackend.Name || username,
        // Default to a basic role if missing to prevent filtering out the user.
        role: userFromBackend.role || userFromBackend.Role || UserRole.OPERADOR_IMPO,
        email: userFromBackend.email || userFromBackend.Email || '',
    };
    
    return user;
};


// --- PRODUCTION SERVICE ---
// Communicates with the real Google Apps Script backend. Used in production builds.
class GoogleSheetsService implements IGoogleSheetsService {
    private manhattanToken: string | null = null;
    private manhattanTokenExpiresAt: number = 0; // Store expiration time in milliseconds

    private serverRequest(action: string, payload?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            google.script.run
                .withSuccessHandler((response: { success: boolean, data?: any, message?: string }) => {
                    if (response.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response.message || 'An unknown error occurred in the backend.'));
                    }
                })
                .withFailureHandler((error: Error) => {
                    reject(error);
                })
                .apiGateway({ action, payload });
        });
    }
    
    // Dedicated server request for user management, pointing to a different backend endpoint.
    private userServerRequest(action: string, payload?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            google.script.run
                .withSuccessHandler((response: { success: boolean, data?: any, message?: string }) => {
                    if (response.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response.message || 'An unknown error occurred in the user management backend.'));
                    }
                })
                .withFailureHandler((error: Error) => {
                    reject(error);
                })
                .userApiGateway({ action, payload }); // This calls the new, separate backend function for users.
        });
    }

    async login(username: string, password: string): Promise<User | null> {
        const userFromBackend = await this.userServerRequest('login', { username, password });
        return normalizeUser(userFromBackend);
    }

    async logout(): Promise<void> {
        // No server-side action needed for simple password auth
        return Promise.resolve();
    }

    async getUsers(): Promise<User[]> {
        const responseData = await this.userServerRequest('getUsers');
        
        let usersFromBackend: any[] = [];

        // Make the response handling very robust to find the user array.
        if (Array.isArray(responseData)) {
            // Case 1: The response data is the array itself.
            usersFromBackend = responseData;
        } else if (responseData && typeof responseData === 'object') {
            // Case 2: The response data is an object. Look for a property that is an array.
            // Prioritize common keys like 'users' or 'data'.
            if (Array.isArray(responseData.users)) {
                usersFromBackend = responseData.users;
            } else if (Array.isArray(responseData.data)) {
                usersFromBackend = responseData.data;
            } else {
                // As a last resort, find the first property that is an array.
                const arrayInData = Object.values(responseData).find(value => Array.isArray(value));
                if (arrayInData && Array.isArray(arrayInData)) {
                    usersFromBackend = arrayInData;
                }
            }
        }
    
        if (!Array.isArray(usersFromBackend)) {
            console.error("Could not find a user array in the backend response.", responseData);
            return [];
        }

        return usersFromBackend
            .map(user => normalizeUser(user))
            .filter((u): u is User => u !== null);
    }
    
    async addUser(user: User): Promise<User> {
        return this.userServerRequest('addUser', user);
    }
    async updateUser(user: User): Promise<User> {
        return this.userServerRequest('updateUser', user);
    }
    async deleteUser(username: string): Promise<{ username: string }> {
        return this.userServerRequest('deleteUser', { username });
    }
    async getTasks(): Promise<DownloadTask[]> {
        const tasks = await this.serverRequest('getTasks');
        return Array.isArray(tasks) ? tasks : [];
    }
    async addTasks(tasks: DownloadTask[]): Promise<DownloadTask[]> {
        return this.serverRequest('addTasks', tasks);
    }
    async updateTask(task: DownloadTask): Promise<DownloadTask> {
        return this.serverRequest('updateTask', task);
    }
    
    async getPackLocationDetails(): Promise<PackLocation[]> {
        const data = await this.serverRequest('getPackLocationDetails');
        return Array.isArray(data) ? data : [];
    }
    async getManhattanToken(): Promise<string> {
        // Check if token is valid and not expired (with a 60-second buffer for safety)
        if (this.manhattanToken && Date.now() < this.manhattanTokenExpiresAt - 60000) {
            console.log("Reusing cached Manhattan token.");
            return this.manhattanToken!;
        }

        console.log("Fetching new Manhattan token from backend.");
        // Assuming the backend returns { access_token: "...", expires_in: 3600, ... }
        const tokenResponse = await this.serverRequest('getManhattanToken');
        
        if (tokenResponse && tokenResponse.access_token && tokenResponse.expires_in) {
            this.manhattanToken = tokenResponse.access_token;
            // expires_in is in seconds, convert to milliseconds and add to current time
            this.manhattanTokenExpiresAt = Date.now() + (tokenResponse.expires_in * 1000);
            
            return this.manhattanToken!;
        }

        // If the response is not as expected, throw a clear error.
        throw new Error("No se pudo obtener un token de Manhattan válido desde el backend.");
    }
    async searchManhattanOlpn(token: string, palletId: string): Promise<Olpn[]> {
        const response = await this.serverRequest('searchManhattanOlpn', { token, palletId });
        
        // --- FIX ---
        // Handle potential inconsistencies in the API response key ('Data' vs 'data').
        if (response && Array.isArray(response.Data)) {
            return response.Data;
        }
        if (response && Array.isArray(response.data)) {
            return response.data;
        }
        return []; // Return empty array if neither is found.
    }
    async combineOlpns(token: string, sourceOlpnId: string, destinationOlpnId: string): Promise<any> {
        return this.serverRequest('combineManhattanOlpns', { token, sourceOlpnId, destinationOlpnId });
    }
    async logOlpnDistribution(logEntry: Omit<OlpnDistributionLog, '_rowIndex' | 'fechahoraconfirmado'>): Promise<void> {
        await this.serverRequest('addOlpnDistributionLog', logEntry);
    }

    async getOlpnDistributionLog(filters: any): Promise<OlpnDistributionLog[]> {
        const data = await this.serverRequest('getOlpnDistributionLog', filters);
        return Array.isArray(data) ? data : [];
    }
    
    async getManhattanShipments(date: string): Promise<ManhattanShipment[]> {
        const data = await this.serverRequest('getManhattanShipments', { date });
        return Array.isArray(data) ? data : [];
    }
    
    async addManhattanShipments(shipments: Omit<ManhattanShipment, '_rowIndex' | 'FechaHoraCreacion' | 'UsuarioCreacion' | 'Número de envío Manhattan'>[], user: string): Promise<ManhattanApiResponse> {
        return this.serverRequest('addManhattanShipments', { shipments, user });
    }

    async createManhattanAppointments(shipments: ManhattanShipment[], user: string): Promise<ManhattanApiResponse> {
        return this.serverRequest('createManhattanAppointments', { shipments, user });
    }

    async getAppConfig(): Promise<{ version: string; ambiente: string; }> {
        return this.serverRequest('getAppConfig');
    }

    async getAnalystMemory(): Promise<AnalystMemoryEntry[]> {
        const memory = await this.serverRequest('getAnalystMemory');
        return Array.isArray(memory) ? memory : [];
    }

    async addAnalystMemoryEntry(entry: Omit<AnalystMemoryEntry, 'fechaAnalisis'>): Promise<AnalystMemoryEntry> {
        return this.serverRequest('addAnalystMemoryEntry', entry);
    }

    async callGeminiAgent(payload: { history: any[]; systemInstruction: string; newMessage: string; }): Promise<{ text: string; totalTokens: number; }> {
        const response = await this.serverRequest('callGeminiAgent', payload);
        // Normalize: handle if backend returns string or object
        if (typeof response === 'string') return { text: response, totalTokens: 0 };
        return { text: response.text || '', totalTokens: response.totalTokens || 0 };
    }

    async analyzeWithGemini(prompt: string): Promise<{ text: string; totalTokens: number; }> {
        const response = await this.serverRequest('analyzeWithGemini', { prompt });
        // Normalize: handle if backend returns string or object
        if (typeof response === 'string') return { text: response, totalTokens: 0 };
        return { text: response.text || '', totalTokens: response.totalTokens || 0 };
    }

    async searchManhattanOlpnForAudit(token: string, olpnId: string): Promise<{ success: boolean; data: any[] }> {
        return this.serverRequest('searchManhattanOlpnForAudit', { token, olpnId });
    }
    async searchManhattanItems(token: string, itemIds: string[]): Promise<{ success: boolean; data: any[] }> {
        return this.serverRequest('searchManhattanItems', { token, itemIds });
    }
    async searchManhattanItemByBarcode(token: string, barcode: string): Promise<{ success: boolean; data: any[] }> {
        return this.serverRequest('searchManhattanItemByBarcode', { token, barcode });
    }
    async getAuditRecords(filters: any): Promise<AuditRecord[]> {
        const data = await this.serverRequest('getAuditRecords', filters);
        return Array.isArray(data) ? data : [];
    }
    async saveAuditRecords(records: AuditRecord[]): Promise<void> {
        return this.serverRequest('saveAuditRecords', { records });
    }
    
    async searchManhattanLocation(token: string, barcode: string): Promise<string | null> {
        const response = await this.serverRequest('searchManhattanLocation', { token, barcode });
        if (response && response.success && response.data && response.data.length > 0) {
            return response.data[0].LocationId;
        }
        return null;
    }

    async searchManhattanIlpnsInLocation(token: string, locationId: string): Promise<string[]> {
        const response = await this.serverRequest('searchManhattanIlpnsInLocation', { token, locationId });
        if (response && response.success && Array.isArray(response.data)) {
            return response.data.map((item: any) => item.IlpnId);
        }
        return [];
    }

    async searchManhattanOlpnsInLocation(token: string, locationId: string): Promise<string[]> {
        const response = await this.serverRequest('searchManhattanOlpnsInLocation', { token, locationId });
        if (response && response.success && Array.isArray(response.data)) {
            return response.data.map((item: any) => item.OlpnId);
        }
        return [];
    }

    async getLocationAuditRecords(filters: any): Promise<LocationAuditRecord[]> {
        const data = await this.serverRequest('getLocationAuditRecords', filters);
        return Array.isArray(data) ? data : [];
    }

    async saveLocationAuditRecords(records: LocationAuditRecord[]): Promise<void> {
        return this.serverRequest('saveLocationAuditRecords', { records });
    }

    async processReverseLogistics(token: string, payload: any): Promise<any> {
        return this.serverRequest('processReverseLogistics', { token, payload });
    }

    async getImpactMetrics(): Promise<ImpactMetric[]> {
        return this.serverRequest('getImpactMetrics');
    }

    async getFilterOptions(processName: string): Promise<ImpactFilterOptions> {
        try {
            const options = await this.serverRequest('getImpactFilterOptions', { processName });
            return {
                unidadesNegocio: Array.isArray(options?.unidadesNegocio) ? options.unidadesNegocio : [],
                zonas: Array.isArray(options?.zonas) ? options.zonas : [],
                tiposPicking: Array.isArray(options?.tiposPicking) ? options.tiposPicking : []
            };
        } catch (e) {
            // Fallback robusto para evitar que la UI falle si el backend no está listo
            console.warn("Backend getImpactFilterOptions failed, using Picking defaults if applicable.");
            if (processName === 'PICKING') {
                return {
                    unidadesNegocio: ['TATA', 'HYG', 'BAS'],
                    zonas: ['A', 'B', 'C', 'D', 'E'],
                    tiposPicking: ['Standard', 'Voz', 'RFID']
                };
            }
            return { unidadesNegocio: [], zonas: [], tiposPicking: [] };
        }
    }

    async getImpactAnalysisData(processName: string, changeDate: string, filters?: any): Promise<any[]> {
        return this.serverRequest('getImpactAnalysisData', { processName, changeDate, filters });
    }

    async getAnalystV2Prompt(processName: string, changeDate: string, selectedIndicators: ImpactMetric[], data: any[], filterContext: string): Promise<string> {
        return this.serverRequest('getAnalystV2Prompt', { processName, changeDate, selectedIndicators, data, filterContext });
    }
}


// --- MOCK SERVICE ---
// Simulates the backend for local development (`npm run dev`) using an in-memory database.
class MockGoogleSheetsService implements IGoogleSheetsService {
    private mockManhattanToken: string | null = null;
    private mockManhattanTokenExpiresAt: number = 0;

    private mockDb: { 
        users: any[], 
        tasks: DownloadTask[], 
        packLocations: PackLocation[], 
        olpnDistributionLog: OlpnDistributionLog[], 
        enviosExpeManhattan: ManhattanShipment[], 
        citasExpeManhattan: any[], 
        memoriaAnalistaImpactoOper: AnalystMemoryEntry[],
        auditoriaOlpns: AuditRecord[],
        auditoriaUbicaciones: LocationAuditRecord[]
    } = {
        users: [
            { username: 'admin', name: 'Admin User', role: UserRole.ADMIN, password: 'admin', email: 'admin@example.com' },
            { username: 'julio.calderon', name: 'Julio Calderón', role: UserRole.ADMIN, password: 1234, email: 'julio.calderon@gdn.com.uy' },
            { username: 'operador', name: 'Operator User', role: UserRole.OPERADOR_IMPO, password: 'password123' },
            { username: 'monitor', name: 'Monitor User', role: UserRole.MONITOR_IMPO, password: 'password123', email: 'monitor@example.com' },
            { username: 'frescos', name: 'Frescos User', role: UserRole.FRESCOS, password: 'password123' },
            { username: 'calidad', name: 'Quality User', role: UserRole.CALIDAD, password: 'password123' },
        ],
        tasks: [],
        packLocations: [
            { _rowIndex: 1, sequence: 1, packLocationId: 'MS-CS-01108', type: 'Flowrack', store: '101' },
            { _rowIndex: 2, sequence: 2, packLocationId: 'MS-CS-01204', type: 'Flowrack', store: '102' },
            { _rowIndex: 3, sequence: 3, packLocationId: 'MS-CS-01205', type: 'Flowrack', store: '103' },
        ],
        olpnDistributionLog: [
            { _rowIndex: 1, palletid: 'PA0100000001243551', olpnorigenid: 'PTL000000000009019', olpndestinoid: 'PTL000000000008009', local: '101', ubicaciondestino: 'MS-CS-01108', fechahoraconfirmado: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), usuario: 'frescos' },
            { _rowIndex: 2, palletid: 'PA0100000001243551', olpnorigenid: 'PTL000000000009020', olpndestinoid: 'PTL000000000008010', local: '102', ubicaciondestino: 'MS-CS-01204', fechahoraconfirmado: new Date().toISOString(), usuario: 'frescos' },
        ],
        enviosExpeManhattan: [],
        citasExpeManhattan: [],
        memoriaAnalistaImpactoOper: [
            {
                fechaAnalisis: new Date('2023-09-20T10:00:00Z').toISOString(),
                tipoCambio: 'Reasignación de zonas de picking A-B',
                resultado: 'positivo',
                metricasClave: 'Productividad +7%',
                observaciones: 'Análisis basado en reportes de Septiembre.',
                totalTokens: 150,
            }
        ],
        auditoriaOlpns: [],
        auditoriaUbicaciones: [
            {
                IdInternoAuditoria: 'AUD-LOC-1773513971899',
                FechaHoraAuditoria: '2026-03-14T18:46:11.899Z',
                Usuario: 'Julio Calderón',
                EstadoAuditoria: 'Sin diferencias',
                UbicacionAuditada: 'CL01025',
                ContenedorManhattan: 'ILPN0000000000001086',
                TipoContenedorManhattan: 'ILPN',
                ContenedorAuditado: 'ILPN0000000000001086',
                TipoContenedorAuditado: 'ILPN',
                Local: 'CDO',
                TipoDiferencia: 'Sin diferencias'
            },
            {
                IdInternoAuditoria: 'AUD-LOC-1773513971899',
                FechaHoraAuditoria: '2026-03-14T18:46:11.899Z',
                Usuario: 'Julio Calderón',
                EstadoAuditoria: 'Sin diferencias',
                UbicacionAuditada: 'CL01025',
                ContenedorManhattan: 'ILPN0000000000025874',
                TipoContenedorManhattan: 'ILPN',
                ContenedorAuditado: 'ILPN0000000000025874',
                TipoContenedorAuditado: 'ILPN',
                Local: 'CDO',
                TipoDiferencia: 'Sin diferencias'
            },
            {
                IdInternoAuditoria: 'AUD-LOC-1773513971899',
                FechaHoraAuditoria: '2026-03-14T18:46:11.899Z',
                Usuario: 'Julio Calderón',
                EstadoAuditoria: 'Sin diferencias',
                UbicacionAuditada: 'CL01025',
                ContenedorManhattan: 'PA0100000002769614',
                TipoContenedorManhattan: 'ILPN',
                ContenedorAuditado: 'PA0100000002769614',
                TipoContenedorAuditado: 'ILPN',
                Local: 'CDO',
                TipoDiferencia: 'Sin diferencias'
            },
            {
                IdInternoAuditoria: 'AUD-LOC-1773513971899',
                FechaHoraAuditoria: '2026-03-14T18:46:11.899Z',
                Usuario: 'Julio Calderón',
                EstadoAuditoria: 'Sin diferencias',
                UbicacionAuditada: 'CL01025',
                ContenedorManhattan: 'ILPN000003132656',
                TipoContenedorManhattan: 'ILPN',
                ContenedorAuditado: 'ILPN000003132656',
                TipoContenedorAuditado: 'ILPN',
                Local: 'CDO',
                TipoDiferencia: 'Sin diferencias'
            },
            {
                IdInternoAuditoria: 'AUD-LOC-1773513971899',
                FechaHoraAuditoria: '2026-03-14T18:46:11.899Z',
                Usuario: 'Julio Calderón',
                EstadoAuditoria: 'Sin diferencias',
                UbicacionAuditada: 'CL01025',
                ContenedorManhattan: 'ILPN0000165156565',
                TipoContenedorManhattan: 'ILPN',
                ContenedorAuditado: 'ILPN0000165156565',
                TipoContenedorAuditado: 'ILPN',
                Local: 'CDO',
                TipoDiferencia: 'Sin diferencias'
            },
            {
                IdInternoAuditoria: 'AUD-LOC-1773513971899',
                FechaHoraAuditoria: '2026-03-14T18:46:11.899Z',
                Usuario: 'Julio Calderón',
                EstadoAuditoria: 'Sin diferencias',
                UbicacionAuditada: 'CL01025',
                ContenedorManhattan: 'OLPN0000000000001504',
                TipoContenedorManhattan: 'OLPN',
                ContenedorAuditado: 'OLPN0000000000001504',
                TipoContenedorAuditado: 'OLPN',
                Local: 'CDO',
                TipoDiferencia: 'Sin diferencias'
            },
            {
                IdInternoAuditoria: 'AUD-LOC-1773514378983',
                FechaHoraAuditoria: '2026-03-14T18:52:58.983Z',
                Usuario: 'Julio Calderón',
                EstadoAuditoria: 'Con diferencias',
                UbicacionAuditada: 'CL01025',
                ContenedorManhattan: 'ILPN0000000000001086',
                TipoContenedorManhattan: 'ILPN',
                ContenedorAuditado: '',
                TipoContenedorAuditado: 'N/A',
                Local: 'CDO',
                TipoDiferencia: 'Faltante'
            },
            {
                IdInternoAuditoria: 'AUD-LOC-1773514378983',
                FechaHoraAuditoria: '2026-03-14T18:52:58.983Z',
                Usuario: 'Julio Calderón',
                EstadoAuditoria: 'Con diferencias',
                UbicacionAuditada: 'CL01025',
                ContenedorManhattan: 'ILPN0000000000025874',
                TipoContenedorManhattan: 'ILPN',
                ContenedorAuditado: '',
                TipoContenedorAuditado: 'N/A',
                Local: 'CDO',
                TipoDiferencia: 'Faltante'
            }
        ]
    };
    private delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    
    async login(username: string, password: string): Promise<User | null> {
        await this.delay(500);
        console.log(`[MOCK] login attempt for: ${username}`);
        const user = this.mockDb.users.find(u => u.username.toLowerCase() === username.toLowerCase());

        // Robustly compare password by casting both to string, preventing type mismatch issues (e.g., 1234 vs "1234").
        if (!user || String(user.password) !== String(password)) {
            console.log(`[MOCK] Login failed for user: ${username}. User found: ${!!user}. Password match: ${user ? String(user.password) === String(password) : 'N/A'}`);
            return null;
        }
        
        const { password: _, ...userToReturn } = user;
        return JSON.parse(JSON.stringify(userToReturn));
    }

    async logout(): Promise<void> {
        await this.delay(100);
        console.log('[MOCK] logout called.');
        return Promise.resolve();
    }

    async getUsers(): Promise<User[]> {
        await this.delay(200);
        console.log('[MOCK] getUsers called');
        // Return users without their passwords
        return JSON.parse(JSON.stringify(this.mockDb.users.map(({ password, ...rest}) => rest)));
    }

    async addUser(user: User): Promise<User> {
        await this.delay(300);
        if (this.mockDb.users.some(u => u.username.toLowerCase() === user.username.toLowerCase())) {
            throw new Error(`[MOCK] User '${user.username}' already exists.`);
        }
        if (!user.password) {
            throw new Error(`[MOCK] Password is required to create a new user.`);
        }
        const newUser = { ...user };
        this.mockDb.users.push(newUser);
        console.log('[MOCK] addUser:', newUser);
        const { password, ...userToReturn } = newUser;
        return userToReturn;
    }
    async updateUser(user: User): Promise<User> {
        await this.delay(300);
        const index = this.mockDb.users.findIndex(u => u.username.toLowerCase() === user.username.toLowerCase());
        if (index === -1) throw new Error(`[MOCK] User '${user.username}' not found.`);
        
        // Update fields, but only update password if a new one is provided
        const existingUser = this.mockDb.users[index];
        existingUser.name = user.name;
        existingUser.role = user.role;
        existingUser.email = user.email;
        if (user.password) {
            existingUser.password = user.password;
        }
        
        console.log('[MOCK] updateUser:', existingUser);
        const { password, ...userToReturn } = existingUser;
        return userToReturn;
    }
    async deleteUser(username: string): Promise<{ username: string }> {
        await this.delay(300);
        this.mockDb.users = this.mockDb.users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
        console.log(`[MOCK] deleteUser: ${username}`);
        return { username };
    }
    async getTasks(): Promise<DownloadTask[]> {
        await this.delay(400);
        console.log('[MOCK] getTasks called');
        return JSON.parse(JSON.stringify(this.mockDb.tasks));
    }
    async addTasks(tasks: DownloadTask[]): Promise<DownloadTask[]> {
        await this.delay(300);
        this.mockDb.tasks.push(...JSON.parse(JSON.stringify(tasks)));
        console.log('[MOCK] addTasks:', tasks);
        return tasks;
    }
    async updateTask(task: DownloadTask): Promise<DownloadTask> {
        await this.delay(100);
        const index = this.mockDb.tasks.findIndex(t => t.id === task.id);
        const taskCopy = JSON.parse(JSON.stringify(task));
        if (index > -1) {
            this.mockDb.tasks[index] = taskCopy;
        } else {
            this.mockDb.tasks.push(taskCopy);
        }
        console.log('[MOCK] updateTask:', task.id);
        return task;
    }

    async getPackLocationDetails(): Promise<PackLocation[]> {
        await this.delay(200);
        console.log('[MOCK] getPackLocationDetails called');
        return JSON.parse(JSON.stringify(this.mockDb.packLocations));
    }
    async getManhattanToken(): Promise<string> {
        await this.delay(300);
        if (this.mockManhattanToken && Date.now() < this.mockManhattanTokenExpiresAt - 60000) {
            console.log('[MOCK] Reusing cached Manhattan token.');
            return this.mockManhattanToken!;
        }
        console.log('[MOCK] getManhattanToken called - generating new mock token.');
        this.mockManhattanToken = `mock-access-token-${Date.now()}`;
        this.mockManhattanTokenExpiresAt = Date.now() + 3600 * 1000; // Mock 1 hour expiration
        return this.mockManhattanToken!;
    }
    async searchManhattanOlpn(token: string, palletId: string): Promise<Olpn[]> {
        await this.delay(500);
        console.log(`[MOCK] searchManhattanOlpn called for pallet: ${palletId} with token (length: ${token?.length || 0})`);
        
        if (palletId.toUpperCase() === 'PA0100000001243551') {
             const mockOlpns: Olpn[] = [
                { OlpnId: 'PTL000000000009019', DestinationFacilityId: '101', PalletId: palletId, CurrentLocationId: 'MOCK_LOC_A', PackerId: 'packer.one', Status: '7200' },
                { OlpnId: 'PTL000000000009020', DestinationFacilityId: '102', PalletId: palletId, CurrentLocationId: 'MOCK_LOC_B', PackerId: 'packer.one', Status: '7200' },
                { OlpnId: 'PTL000000000009021', DestinationFacilityId: '103', PalletId: palletId, CurrentLocationId: 'MOCK_LOC_C', PackerId: 'packer.two', Status: '7200' },
            ];
            return JSON.parse(JSON.stringify({ Data: mockOlpns })).Data;
        }
        return [];
    }
     async combineOlpns(token: string, sourceOlpnId: string, destinationOlpnId: string): Promise<any> {
        await this.delay(1000);
        console.log(`[MOCK] combineOlpns called for source: ${sourceOlpnId}, destination: ${destinationOlpnId}, with token (length ${token?.length || 0})`);
        
        if (destinationOlpnId.toUpperCase() === 'WRONGSTORE') {
            throw new Error('Error: Los OLPNs no pertenecen a la misma tienda.');
        }
        if (destinationOlpnId.toUpperCase() === 'BADSTATUS') {
             throw new Error('Error: El OLPN de destino tiene un estado inválido (5000).');
        }
        
        return { success: true, message: 'Combination successful' };
    }
     async logOlpnDistribution(logEntry: Omit<OlpnDistributionLog, '_rowIndex' | 'fechahoraconfirmado'>): Promise<void> {
        await this.delay(100);
        const newLog: OlpnDistributionLog = {
            ...logEntry,
            _rowIndex: this.mockDb.olpnDistributionLog.length + 1,
            fechahoraconfirmado: new Date().toISOString()
        };
        this.mockDb.olpnDistributionLog.push(newLog);
        console.log('[MOCK] logOlpnDistribution:', newLog);
    }
    async getOlpnDistributionLog(filters: any): Promise<OlpnDistributionLog[]> {
        await this.delay(500);
        console.log('[MOCK] getOlpnDistributionLog with filters:', filters);

        let filteredData = [...this.mockDb.olpnDistributionLog];

        if (filters.startDate) {
            const start = new Date(filters.startDate);
            start.setMinutes(start.getMinutes() + start.getTimezoneOffset());
            filteredData = filteredData.filter(log => new Date(log.fechahoraconfirmado) >= start);
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setMinutes(end.getMinutes() + end.getTimezoneOffset());
            end.setHours(23, 59, 59, 999); // Include the whole end day
            filteredData = filteredData.filter(log => new Date(log.fechahoraconfirmado) <= end);
        }
        if (filters.palletid) {
            filteredData = filteredData.filter(log => log.palletid.toLowerCase().includes(filters.palletid.toLowerCase()));
        }
        if (filters.usuario) {
            filteredData = filteredData.filter(log => log.usuario.toLowerCase().includes(filters.usuario.toLowerCase()));
        }
        if (filters.olpnorigenid) {
            filteredData = filteredData.filter(log => log.olpnorigenid.toLowerCase().includes(filters.olpnorigenid.toLowerCase()));
        }
        if (filters.olpndestinoid) {
            filteredData = filteredData.filter(log => log.olpndestinoid.toLowerCase().includes(filters.olpndestinoid.toLowerCase()));
        }
        if (filters.local) {
            filteredData = filteredData.filter(log => String(log.local || '').toLowerCase().includes(filters.local.toLowerCase()));
        }
        if (filters.ubicaciondestino) {
            filteredData = filteredData.filter(log => String(log.ubicaciondestino || '').toLowerCase().includes(filters.ubicaciondestino.toLowerCase()));
        }

        return JSON.parse(JSON.stringify(filteredData));
    }
    
    async getManhattanShipments(date: string): Promise<ManhattanShipment[]> {
        await this.delay(500);
        console.log(`[MOCK] getManhattanShipments for date: ${date}`);
        const [year, month, day] = date.split('-');
        
        const filtered = this.mockDb.enviosExpeManhattan.filter(s => {
          const d = new Date(s.FechaHoraCreacion);
          const dYear = d.getFullYear();
          const dMonth = d.getMonth() + 1;
          const dDay = d.getDate();
          return String(dYear) === year && String(dMonth) === month && String(dDay) === day;
        });
        return JSON.parse(JSON.stringify(filtered));
    }
    
    async addManhattanShipments(shipments: Omit<ManhattanShipment, '_rowIndex' | 'FechaHoraCreacion' | 'UsuarioCreacion' | 'Número de envío Manhattan'>[], user: string): Promise<ManhattanApiResponse> {
        await this.delay(1200);
        console.log(`[MOCK] addManhattanShipments by user: ${user}`);
        
        const shouldFail = shipments.some(s => s['Tráiler']?.toUpperCase().includes('FAIL'));
        if (shouldFail) {
             return {
                successCount: 0,
                failureCount: shipments.length,
                totalCount: shipments.length,
                failures: shipments.map(s => ({
                    shipmentId: `${s['Número de envío']}-S-1`, 
                    message: "Stop sequence numbers are not valid for shipment.",
                    record: s
                }))
             };
        }

        shipments.forEach((s, i) => {
          const newShipment: ManhattanShipment = {
            ...(s as ManhattanShipment),
            _rowIndex: this.mockDb.enviosExpeManhattan.length + i + 1,
            FechaHoraCreacion: new Date().toISOString(),
            UsuarioCreacion: user,
            'Número de envío Manhattan': `${s['Número de envío']}-${s['Sector de carga'].charAt(0)}-${i+1}` 
          };
          this.mockDb.enviosExpeManhattan.push(newShipment);
        });

        return {
            successCount: shipments.length,
            failureCount: 0,
            totalCount: shipments.length,
            failures: []
        };
    }

    async createManhattanAppointments(shipments: ManhattanShipment[], user: string): Promise<ManhattanApiResponse> {
        await this.delay(1000);
        const shipmentIds = shipments.map(s => s['Número de envío Manhattan']);
        console.log(`[MOCK] createManhattanAppointments for ${shipmentIds.length} shipments by ${user}`);

        shipmentIds.forEach(id => {
            const index = this.mockDb.enviosExpeManhattan.findIndex(s => s['Número de envío Manhattan'] === id);
            if (index !== -1) {
                this.mockDb.enviosExpeManhattan[index].Cita = `EXP_MOCK_${Date.now()}`;
            }
        });

        if (shipments.some(s => s['Tráiler']?.toUpperCase().includes('FAIL_APPOINTMENT'))) {
             return {
                successCount: 0,
                failureCount: shipments.length,
                totalCount: shipments.length,
                failures: shipments.map(s => ({
                    appointmentId: 'Unknown',
                    message: "Appointment Id already exists",
                    record: s
                }))
             };
        }

        return {
            successCount: shipments.length,
            failureCount: 0,
            totalCount: shipments.length,
            failures: [],
            createdAppointments: shipments.map(s => ({ AppointmentId: `EXP_MOCK_${s['Número de envío']}`}))
        };
    }

    async getAppConfig(): Promise<{ version: string; ambiente: string; }> {
        await this.delay(50);
        console.log('[MOCK] getAppConfig called');
        return { version: '1.0.0-dev', ambiente: 'Desarrollo' };
    }

    async getAnalystMemory(): Promise<AnalystMemoryEntry[]> {
        await this.delay(400);
        console.log('[MOCK] getAnalystMemory called');
        return JSON.parse(JSON.stringify(this.mockDb.memoriaAnalistaImpactoOper));
    }
    
    async addAnalystMemoryEntry(entry: Omit<AnalystMemoryEntry, 'fechaAnalisis'>): Promise<AnalystMemoryEntry> {
        await this.delay(300);
        const newEntry: AnalystMemoryEntry = {
            ...entry,
            fechaAnalisis: new Date().toISOString()
        };
        this.mockDb.memoriaAnalistaImpactoOper.push(newEntry);
        console.log('[MOCK] addAnalystMemoryEntry:', newEntry);
        return newEntry;
    }

    async callGeminiAgent(payload: { history: any[]; systemInstruction: string; newMessage: string; }): Promise<{ text: string; totalTokens: number; }> {
        await this.delay(1000);
        const mockTokens = JSON.stringify(payload).length / 4;
        if (payload.newMessage.includes('implementó')) {
            return { text: 'Entendido. Para analizar el impacto, por favor, carga los reportes de productividad. [AWAIT_FILES]', totalTokens: 25 + mockTokens };
        }
        if (payload.newMessage.includes('JSON')) {
            return { text: 'Basado en el análisis de los archivos, se observa una mejora del 10% en la productividad.\n\n[SAVE_MEMORY]\n{"tipoCambio": "Mock Change","resultado": "positivo","metricasClave": "Productividad +10%","observaciones": "Mock analysis based on provided file."}', totalTokens: 150 + mockTokens };
        }
        return { text: 'Soy un agente de IA de prueba. ¿En qué puedo ayudarte?', totalTokens: 20 + mockTokens };
    }

    async analyzeWithGemini(prompt: string): Promise<{ text: string, totalTokens: number }> {
        await this.delay(800);
        console.log('[MOCK] analyzeWithGemini prompt:', prompt);
        return { 
            text: 'Este es un resumen de análisis simulado.\n\n[SAVE_MEMORY]\n{"tipoCambio": "Cambio V2 Simulada", "resultado": "positivo", "metricasClave": "Productividad +12%", "observaciones": "Simulación"}', 
            totalTokens: 200 
        };
    }

    // --- AUDIT MOCKS ---
    async searchManhattanOlpnForAudit(token: string, olpnId: string): Promise<{ success: boolean; data: any[] }> {
        await this.delay(600);
        console.log(`[MOCK] searchManhattanOlpnForAudit: ${olpnId} with token: ${token}`);

        if (olpnId === 'PTL000000000009044') { // For re-audit test
            const mockResponse = {
                "success": true,
                "data": [
                    {
                        "PalletId": "PA0100000005394601",
                        "OlpnDetail": [
                            { "ItemId": "1000050206", "ItemDescription": "ACEITE DE MAIZ ARCOR 1.00 L", "PackedQuantity": 20.0000, "ExpirationDate": "2026-09-05" },
                            { "ItemId": "1000050205", "ItemDescription": "ACEITE DE OLIVA CORTE ITALIANO COLINAS DE GA 250.00 ML", "PackedQuantity": 2.0000, "ExpirationDate": "2026-09-05" },
                        ],
                    }
                ]
            };
            return mockResponse;
        } 
        if (olpnId === 'PTL000000000744408') { // BAS Test with Pallet
             return { success: true, data: [{ PalletId: "PA0100000005394601", OlpnDetail: [] }] };
        }
        if (olpnId === 'PTL000000000NOBAS') { // BAS Test without Pallet
             return { success: true, data: [{ PalletId: null, OlpnDetail: [] }] };
        }
        
        return { success: true, data: [] }; // Not found
    }

    async searchManhattanItems(token: string, itemIds: string[]): Promise<{ success: boolean; data: any[] }> {
        await this.delay(800);
        console.log(`[MOCK] searchManhattanItems:`, itemIds, `Token: ${token}`);
        
        // JSON Data provided in prompt
        const mockResponse = {
            "success": true,
            "header": {
                "totalCount": "2",
                "page": 0,
                "size": 2000
            },
            "data": [
                 {
                    "ItemCode": [
                        { "CodeValue": "2302501150009", "CodeType": "EAN13" },
                        { "CodeValue": "7730951080105", "CodeType": "EAN13" },
                        { "CodeValue": "250115000", "CodeType": "LIN" },
                        { "CodeValue": "7730114200098", "CodeType": "EAN13" } // Added specifically for test case
                    ],
                    "ItemPackage": [
                        { "UomId": "PACK", "Quantity": 6.0000 },
                        { "UomId": "CAJA", "Quantity": 12.0000 }, 
                        { "UomId": "UNIDAD", "Quantity": 1.0000 }
                    ],
                    "ItemId": "1000050205",
                    "ItemDescription": "ACEITE DE OLIVA CORTE ITALIANO"
                },
                {
                    "ItemCode": [
                        { "CodeValue": "7790580160807", "CodeType": "EAN13" },
                        { "CodeValue": "7790580108106", "CodeType": "EAN13" },
                        { "CodeValue": "2302501160008", "CodeType": "EAN13" },
                        { "CodeValue": "250116000", "CodeType": "LIN" }
                    ],
                    "ItemPackage": [
                        { "UomId": "PACK", "Quantity": 12.0000 },
                        { "UomId": "CAJA", "Quantity": 12.0000 },
                        { "UomId": "UNIDAD", "Quantity": 1.0000 }
                    ],
                    "ItemId": "1000050206",
                    "ItemDescription": "ACEITE DE MAIZ ARCOR"
                }
            ],
            "statusCode": "OK"
        };
        
        // Filter mock data to only return requested items by ID OR Code
        const filteredData = mockResponse.data.filter(item => 
            itemIds.includes(item.ItemId) || 
            item.ItemCode.some(c => itemIds.includes(c.CodeValue))
        );
        return { success: true, data: filteredData };
    }

    async searchManhattanItemByBarcode(token: string, barcode: string): Promise<{ success: boolean; data: any[] }> {
        // Mock implementation leveraging searchManhattanItems with code filtering logic
        await this.delay(600);
        console.log(`[MOCK] searchManhattanItemByBarcode: ${barcode}`);
        return this.searchManhattanItems(token, [barcode]);
    }

    async getAuditRecords(filters: any): Promise<AuditRecord[]> {
        await this.delay(400);
        console.log('[MOCK] getAuditRecords', filters);
        
        let results = [...this.mockDb.auditoriaOlpns];

        if (filters.startDate) {
             const start = new Date(filters.startDate);
             results = results.filter(r => new Date(r.FechaHoraAuditoria) >= start);
        }
        if (filters.endDate) {
             const end = new Date(filters.endDate);
             end.setHours(23, 59, 59);
             results = results.filter(r => new Date(r.FechaHoraAuditoria) <= end);
        }
        if (filters.olpn) {
            results = results.filter(r => r.OlpnId.toLowerCase().includes(filters.olpn.toLowerCase()));
        }
        if (filters.usuario) {
             results = results.filter(r => r.Usuario.toLowerCase().includes(filters.usuario.toLowerCase()));
        }
        if (filters.tipoDiferencia) {
             results = results.filter(r => r.TipoDiferencia === filters.tipoDiferencia);
        }
        if (filters.recuento) {
             results = results.filter(r => r.Recuento === filters.recuento);
        }
        if (filters.sector) {
            results = results.filter(r => r.Sector === filters.sector);
        }

        return JSON.parse(JSON.stringify(results));
    }

    async saveAuditRecords(records: AuditRecord[]): Promise<void> {
        await this.delay(500);
        console.log('[MOCK] saveAuditRecords', records);
        this.mockDb.auditoriaOlpns.push(...records);
    }

    async searchManhattanLocation(_token: string, barcode: string): Promise<string | null> {
        await this.delay(500);
        console.log(`[MOCK] searchManhattanLocation: ${barcode}`);
        if (barcode === 'CL01025') return 'CL-01025';
        if (barcode === 'CL01040') return 'CL-01040';
        return null;
    }

    async searchManhattanIlpnsInLocation(_token: string, locationId: string): Promise<string[]> {
        await this.delay(500);
        console.log(`[MOCK] searchManhattanIlpnsInLocation: ${locationId}`);
        if (locationId === 'CL-01025') {
            return ["ILPN0000000000001086", "ILPN0000000000025874", "PA0100000002769614"];
        }
        return [];
    }

    async searchManhattanOlpnsInLocation(_token: string, locationId: string): Promise<string[]> {
        await this.delay(500);
        console.log(`[MOCK] searchManhattanOlpnsInLocation: ${locationId}`);
        if (locationId === 'CL-01040' || locationId === 'CL-01025') {
            return ["ILPN00000000594980", "ILPN00000000594981"];
        }
        return [];
    }

    async getLocationAuditRecords(filters: any): Promise<LocationAuditRecord[]> {
        await this.delay(400);
        console.log('[MOCK] getLocationAuditRecords', filters);
        
        // Use persisted data if available
        let results = [...this.mockDb.auditoriaUbicaciones];
        
        return results.filter(r => {
            // Extract only the date part for comparison to avoid timezone/time issues
            const recordDate = r.FechaHoraAuditoria.split('T')[0];
            
            if (filters.startDate && recordDate < filters.startDate) return false;
            if (filters.endDate && recordDate > filters.endDate) return false;
            if (filters.location && !r.UbicacionAuditada.toLowerCase().includes(filters.location.toLowerCase())) return false;
            if (filters.user && !r.Usuario.toLowerCase().includes(filters.user.toLowerCase())) return false;
            return true;
        });
    }

    async saveLocationAuditRecords(records: LocationAuditRecord[]): Promise<void> {
        await this.delay(500);
        console.log('[MOCK] saveLocationAuditRecords', records);
        this.mockDb.auditoriaUbicaciones.push(...records);
    }

    async processReverseLogistics(_token: string, payload: any): Promise<any> {
        await this.delay(800);
        console.log('[MOCK] processReverseLogistics payload:', payload);
        return { success: true, data: { MessageId: `MOCK-RECV-${Date.now()}` }, statusCode: "OK" };
    }

    async getImpactMetrics(): Promise<ImpactMetric[]> {
        await this.delay(200);
        return [
            { TipoProceso: 'PICKING', Indicador: 'Productividad por bultos', OrigenDato: 'BULTOS_TOTALES / HORAS_TOTALES / CANT_USUARIOS' },
            { TipoProceso: 'PICKING', Indicador: 'Bultos totales por tarea', OrigenDato: 'BULTOS_TOTALES / CANT_TAREAS' },
        ];
    }

    async getFilterOptions(processName: string): Promise<ImpactFilterOptions> {
        await this.delay(400);
        if (processName === 'PICKING') {
            return {
                unidadesNegocio: ['TATA', 'HYG', 'BAS'],
                zonas: ['A', 'B', 'C', 'D', 'E'],
                tiposPicking: ['Standard', 'Voz', 'RFID']
            };
        }
        return { unidadesNegocio: [], zonas: [], tiposPicking: [] };
    }

    async getImpactAnalysisData(_processName: string, _changeDate: string, _filters?: any): Promise<any[]> {
        await this.delay(500);
        return [
            { FECHA: '2023-01-01', BULTOS_TOTALES: 100, HORAS_TOTALES: 8, CANT_USUARIOS: 1 },
            { FECHA: '2023-05-01', BULTOS_TOTALES: 120, HORAS_TOTALES: 8, CANT_USUARIOS: 1 },
        ];
    }

    async getAnalystV2Prompt(processName: string, _changeDate: string, _selectedIndicators: ImpactMetric[], _data: any[], _filterContext: string): Promise<string> {
        await this.delay(100);
        return "Análisis de impacto simulado para " + processName;
    }
}


// --- EXPORT LOGIC ---
// We determine the environment at runtime by checking for the existence of the
// Google Apps Script `google.script.run` object.
let serviceInstance: IGoogleSheetsService;

const isProduction = typeof google !== 'undefined' && google.script && google.script.run;

if (isProduction) {
  // We are in the Google Apps Script environment.
  serviceInstance = new GoogleSheetsService();
} else {
  // We are in a local development environment (e.g., `vite dev`).
  console.log("Running in development mode. Using Mock Google Sheets Service.");
  serviceInstance = new MockGoogleSheetsService();
}

export const sheets = serviceInstance;