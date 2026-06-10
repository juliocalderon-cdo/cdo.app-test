



// FIX: Defined UserRole enum to resolve circular import error.
export enum UserRole {
  OPERADOR_IMPO = 'OPERADOR_IMPO',
  MONITOR_IMPO = 'MONITOR_IMPO',
  TRANSPORTE = 'TRANSPORTE',
  FRESCOS = 'FRESCOS',
  ADMIN = 'ADMIN',
  CALIDAD = 'CALIDAD',
}

export interface User {
  username: string; // Now the primary identifier
  name: string;
  role: UserRole;
  email?: string; // Optional field
  password?: string;
}


export enum DownloadType {
  TATA = 'TATA',
  HYG = 'HYG',
  BAS = 'BAS',
}

export interface Article {
  id: string;
  sku: string;
  barcode?: string;
  description: string;
  quantity: number; // Total quantity from manifest (stock + cross)
  quantityStock: number;
  quantityCross: number;
  madre: string;
}

export enum IlpnType {
  STOCK = 'STOCK',
  CROSS = 'CROSS',
}

// Represents a specific article and its quantity within a single iLPN
export interface iLPNArticle {
  articleId: string; // To link back to the original Article
  sku: string;
  barcode?: string;
  description: string;
  quantity: number; // Quantity of this article in this iLPN
}

export interface iLPN {
  id: string;
  type: IlpnType;
  madre: string;
  articles: iLPNArticle[];
  isClosed: boolean;
  createdAt: string;
  user: string; // Name of the user who created this iLPN
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum TaskType {
  DOWNLOAD = 'DOWNLOAD',
}

export interface DownloadTask {
  id: string;
  taskType: TaskType;
  fileName: string;
  downloadType: DownloadType;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  status: TaskStatus;
  articles: Article[]; // Master list of what needs to be received
  openILPNs: iLPN[];
  closedILPNs: iLPN[];
  analysis?: string;
  user: string;
}

export type SectorDeCarga = 'Secos' | 'Frescos' | 'Bas' | 'Electro' | 'Combinado';
export type SectorDeCargaLetra = 'S' | 'F' | 'B' | 'E';


export interface ManhattanShipment {
  _rowIndex?: number;
  FechaHoraCreacion: string;
  UsuarioCreacion: string;
  'Número de envío': string;
  'Número de envío Manhattan': string;
  'Tráiler': string;
  'Sector de carga': SectorDeCarga;
  'Crear Cita'?: 'SI' | 'NO';
  FechaHoraEnvio?: string;
  'Duracion de carga'?: number;
  Cita?: string;
  'FechaCitado'?: string;

  'Stop 0'?: string;
  'Parada 1'?: string;
  'Stop 1'?: string;
  'Parada 2'?: string;
  'Stop 2'?: string;
  'Parada 3'?: string;
  'Stop 3'?: string;
  'Parada 4'?: string;
  'Stop 4'?: string;
  'Parada 5'?: string;
  'Stop 5'?: string;
  'Parada 6'?: string;
  'Stop 6'?: string;
  'Parada 7'?: string;
  'Stop 7'?: string;
  'Parada 8'?: string;
  'Stop 8'?: string;
  'Parada 9'?: string;
  'Stop 9'?: string;
  'Parada 10'?: string;
  'Stop 10'?: string;
  'Parada 11'?: string;
  'Stop 11'?: string;
  'Parada 12'?: string;
  'Stop 12'?: string;
  'Parada 13'?: string;
  'Stop 13'?: string;
  'Parada 14'?: string;
  'Stop 14'?: string;
  'Parada 15'?: string;
  'Stop 15'?: string;
  
  // Internal properties used for processing
  'Parada 100-Stop 0'?: string;
  'Parada 1-Stop 1'?: string;
  'Parada 2-Stop 2'?: string;
  'Parada 3-Stop 3'?: string;
  'Parada 4-Stop 4'?: string;
  'Parada 5-Stop 5'?: string;
  'Parada 6-Stop 6'?: string;
  'Parada 7-Stop 7'?: string;
  'Parada 8-Stop 8'?: string;
  'Parada 9-Stop 9'?: string;
  'Parada 10-Stop 10'?: string;
  'Parada 11-Stop 11'?: string;
  'Parada 12-Stop 12'?: string;
  'Parada 13-Stop 13'?: string;
  'Parada 14-Stop 14'?: string;
  'Parada 15-Stop 15'?: string;

  [key: string]: any;
}


export interface Olpn {
  OlpnId: string;
  DestinationFacilityId: string;
  PalletId: string;
  CurrentLocationId: string;
  PackerId: string;
  Status?: string; // Added for combination validation
  [key: string]: any; // Allow other properties
}

export interface PackLocation {
  _rowIndex: number;
  sequence: number;
  packLocationId: string;
  type: string;
  store: string;
}

export interface OlpnDistributionLog {
  _rowIndex?: number;
  palletid: string;
  olpnorigenid: string;
  olpndestinoid: string;
  local: string;
  ubicaciondestino: string;
  fechahoraconfirmado: string; // ISO string
  usuario: string;
}

export interface AnalystMemoryEntry {
    fechaAnalisis: string; // ISO String
    tipoCambio: string;
    resultado: 'positivo' | 'negativo' | 'neutro';
    metricasClave: string;
    observaciones: string;
    totalTokens: number;
}

// --- AUDIT TYPES ---
export type AuditSector = 'SECOS' | 'FRESCOS' | 'BAS';

export interface AuditRecord {
    IdInternoAuditoria: string;
    FechaHoraAuditoria: string; // ISO String
    Usuario: string;
    EstadoAuditoria: 'Olpn con diferencias' | 'Olpn sin diferencias';
    Item: string;
    Descripcion: string;
    CantidadManhattan: number;
    CantidadAuditada: number;
    FechaVtoManhattan: string;
    FechaVtoAuditada: string;
    Diferencia: number;
    TipoDiferencia: 'Sobrante en Olpn' | 'Faltante en Olpn' | 'Fechas de vencimiento diferentes' | 'Item no existente en la Olpn' | 'Sin diferencias';
    Recuento: 'SI' | 'NO';
    OlpnId: string;
    
    // Detailed view breakdown
    DetalleOriginal?: string;
    DetalleAuditado?: string;
    DetalleDiferencia?: string;
    
    // Raw JSON breakdown for calculations
    RawOriginal?: string; 
    RawAuditado?: string;
    RawDiferencia?: string;

    // New fields for extended functionality
    Sector: AuditSector;
    PalletIdOriginal: string;
    PalletIdAuditado: string;
    DiferenciaPallet: 'SI' | 'NO';
    PorcentajeCalidad: number | null; // e.g., 95.5 for 95.5%
    Local?: string;
    Ubicacion?: string;
}

export interface LocationAuditRecord {
    IdInternoAuditoria: string;
    FechaHoraAuditoria: string; // ISO String
    Usuario: string;
    EstadoAuditoria: 'Sin diferencias' | 'Con diferencias';
    UbicacionAuditada: string;
    ContenedorManhattan: string;
    TipoContenedorManhattan: 'ILPN' | 'OLPN' | 'N/A';
    ContenedorAuditado: string;
    TipoContenedorAuditado: 'ILPN' | 'OLPN' | 'N/A';
    Local: string;
    TipoDiferencia: 'Sobrante' | 'Faltante' | 'Sin diferencias';
}

export interface ManhattanItemDetail {
    ItemId: string;
    ItemDescription: string;
    PackedQuantity: number;
    ExpirationDate: string | null;
    OlpnDetailId: string;
}

export interface ManhattanItemMaster {
    ItemId: { PK: number | string } | string; // Can be object or string depending on parsing
    ItemCode: { CodeValue: string; CodeType: string }[];
    ItemPackage: { 
        UomId: string; 
        Quantity: number; 
        StandardQuantityUomIdDisplay?: string 
    }[];
    ItemDescription?: string; // Sometimes available in root or needs logic
}

// --- REVERSE LOGISTICS ---

export interface ReverseLogisticsItem {
    BatchNumber: string;
    VendorId: string;
    CountryOfOrigin: string;
    Quantity: string;
    PackQuantity: string;
    InventoryTypeId: string;
    ItemId: string;
    ProductStatusId: string;
    LpnDetailExpDate: string;
    Price: string;
    BatchExpirationDate: string;
    CompletionTime: string;
    PurchaseOrderId: string;
    InventoryAttribute1: string;
    InventoryAttribute2: string;
    InventoryAttribute3: string;
    InventoryAttribute4: string;
    InventoryAttribute5: string;
    LpnDetailMfgDate: string;
}

export interface ReverseLogisticsLpn {
    LpnId: string;
    AsnId: string;
    VendorId: string;
    Items: ReverseLogisticsItem[];
}

// --- AUDIT SESSION TYPES ---
export interface ManhattanItemCache {
    [itemId: string]: {
        description: string;
        uomMap: { [uom: string]: number };
        codeMap: string[];
    };
}

export interface ScannedItemData {
    itemId: string;
    description: string;
    auditQty: number;
    enteredQuantities: { boxes: number; packs: number; units: number };
    auditExpiry: string;
    manhattanQty: number;
    manhattanExpiry: string | null;
    diffType: 'Sin diferencias' | 'Sobrante en Olpn' | 'Faltante en Olpn' | 'Fechas de vencimiento diferentes' | 'Item no existente en la Olpn';
    diffQty: number;
    volumetrics: string;
}


// --- IMPACT ANALYST V2 ---

export interface ImpactMetric {
  TipoProceso: string;
  Indicador: string;
  OrigenDato: string;
}