import * as XLSX_ from 'xlsx';
import { Article, ManhattanShipment, SectorDeCarga, DownloadType } from '../types';

// Helper function to safely get the XLSX object, handling different module loading scenarios (ESM/CommonJS)
// This prevents "Cannot read properties of undefined (reading 'utils')" by resolving the object at runtime.
const getXLSX = () => {
    const lib = (XLSX_ as any).default || XLSX_;
    if (!lib || !lib.utils) {
        // Try to fallback or throw a clear error
        if ((window as any).XLSX) return (window as any).XLSX; 
        throw new Error("La librería XLSX no se ha cargado correctamente. Por favor recargue la página.");
    }
    return lib;
};

// Helper to convert Excel serial date to JS Date
const excelSerialDateToJSDate = (serial: number): Date => {
    return new Date(Date.UTC(0, 0, serial - 1));
};

// Simple UUID generator to avoid dependency on crypto.randomUUID() which requires a secure context (HTTPS)
const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Helper function to find a property in an object with case-insensitivity and trimming
const findProp = (obj: any, propNames: string[]): any => {
    // 1. Exact match check
    for (const name of propNames) {
        if (obj[name] !== undefined) return obj[name];
    }
    
    // 2. Normalized match (trim whitespace and lowercase)
    // This fixes issues where Excel headers have hidden spaces like "Item " or " SKU"
    const normalize = (s: string) => s.toLowerCase().trim();
    const normalizedPropNames = propNames.map(normalize);
    
    for (const key in obj) {
        if (normalizedPropNames.includes(normalize(key))) {
            return obj[key];
        }
    }
    return undefined;
};

const sheetNameMapping: Record<DownloadType, string> = {
    [DownloadType.TATA]: 'TATA_1',
    [DownloadType.HYG]: 'HYG_2',
    [DownloadType.BAS]: 'BAS_3',
};

interface ParseResult {
    articles: Article[];
    fileName: string;
}

export const parseExcelFile = async (file: File, downloadType: DownloadType): Promise<ParseResult> => {
    const XLSX = getXLSX();
    const data = await file.arrayBuffer();
    // type: 'array' is crucial for robust parsing of both binary Excel and text-based CSV in browser environments
    const workbook = XLSX.read(data, { type: 'array' });
    
    const targetSheetName = sheetNameMapping[downloadType];
    // Find sheet case-insensitive
    const actualSheetName = workbook.SheetNames.find((name: string) => name.toUpperCase() === targetSheetName.toUpperCase());

    if (!actualSheetName) {
        // Fallback logic: if specific sheet not found, try first sheet but warn, or throw error if strict.
        // User requirements imply strictness, but for CSVs usually there is only 'Sheet1'. 
        // If it's a CSV, workbook.SheetNames[0] is usually the way.
        if (file.name.endsWith('.csv') || workbook.SheetNames.length === 1) {
             // Proceed with first sheet
             console.warn(`Hoja "${targetSheetName}" no encontrada. Usando "${workbook.SheetNames[0]}" por defecto.`);
        } else {
             throw new Error(`La hoja "${targetSheetName}" no fue encontrada en el archivo Excel. Hojas disponibles: ${workbook.SheetNames.join(', ')}`);
        }
    }

    const sheetToUse = actualSheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetToUse];
    
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (!jsonData || jsonData.length === 0) {
        throw new Error(`La hoja "${sheetToUse}" está vacía o no tiene el formato esperado.`);
    }

    // Debug log to check headers of the first row
    if (jsonData.length > 0) {
        console.log("Headers detected in row 1:", Object.keys(jsonData[0]));
    }

    const articles: Article[] = jsonData.map((row, index): Article | null => {
        const sku = findProp(row, ['Item', 'SKU', 'ARTICULO']);
        const description = findProp(row, ['Description', 'descripcion', 'descripción', 'Descripción']);
        const madre = findProp(row, ['Madre', 'MADRE']);
        const barcode = findProp(row, ['Código de Barras', 'Barcode', 'COD_BARRA']);
        
        // --- QUANTITY LOGIC ---
        const crossVal = findProp(row, ['Cajas Cross', 'CAJAS CROSS']);
        const stockVal = findProp(row, ['Cajas Stock', 'CAJAS STOCK']);

        const quantityCross = crossVal !== undefined ? Number(crossVal) : 0;
        const quantityStock = stockVal !== undefined ? Number(stockVal) : 0;
        
        // Prioritize calculated total from stock+cross columns.
        // If those columns are missing, check for a generic 'Cajas' or 'Cantidad' column (legacy support)
        let totalQuantity = quantityStock + quantityCross;
        
        if (totalQuantity === 0) {
             const genericQty = findProp(row, ['Cajas', 'CANTIDAD', 'QTY']);
             if (genericQty) {
                 totalQuantity = Number(genericQty);
                 // Default to stock if generic quantity found and no split provided
                 if (quantityStock === 0 && quantityCross === 0) {
                     // Legacy logic: Check DESTINO column
                     const destino = String(row['DESTINO'] || 'STOCK').toUpperCase().trim();
                     if (destino === 'CROSS') {
                         return {
                             id: generateUUID(),
                             sku: String(sku).trim(),
                             barcode: barcode ? String(barcode).trim() : undefined,
                             description: String(description).trim(),
                             quantity: totalQuantity,
                             quantityStock: 0,
                             quantityCross: totalQuantity,
                             madre: String(madre || '').trim(),
                         };
                     } else {
                         return {
                             id: generateUUID(),
                             sku: String(sku).trim(),
                             barcode: barcode ? String(barcode).trim() : undefined,
                             description: String(description).trim(),
                             quantity: totalQuantity,
                             quantityStock: totalQuantity,
                             quantityCross: 0,
                             madre: String(madre || '').trim(),
                         };
                     }
                 }
             }
        }

        if (sku === undefined || description === undefined || totalQuantity === 0) {
            if (!(sku === undefined && description === undefined && totalQuantity === 0)) {
                // Only warn if it's not a completely empty row
                console.warn(`Skipping row ${index + 2} in sheet "${sheetToUse}". Missing: SKU=${!!sku}, Desc=${!!description}, Qty=${totalQuantity > 0}.`);
            }
            return null;
        }

        return {
            id: generateUUID(),
            sku: String(sku).trim(),
            barcode: barcode ? String(barcode).trim() : undefined,
            description: String(description).trim(),
            quantity: totalQuantity,
            quantityStock: quantityStock,
            quantityCross: quantityCross,
            madre: String(madre || '').trim(),
        };
    }).filter((article): article is Article => article !== null && Boolean(article.sku));

    return {
        articles,
        fileName: file.name,
    };
};

interface ManhattanParseResult {
    shipments: Omit<ManhattanShipment, '_rowIndex' | 'FechaHoraCreacion' | 'UsuarioCreacion' | 'Número de envío Manhattan'>[];
    fileName: string;
}

export const parseManhattanShipmentsExcel = async (file: File): Promise<ManhattanParseResult> => {
    const XLSX = getXLSX();
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

    const shipments: Omit<ManhattanShipment, '_rowIndex' | 'FechaHoraCreacion' | 'UsuarioCreacion' | 'Número de envío Manhattan'>[] = [];

    json.forEach((row: any, index: number) => {
        try {
            const numeroEnvio = String(row['Número de envío'] || '').trim();
            if (!numeroEnvio) throw new Error("La columna 'Número de envío' es obligatoria.");

            const trailer = String(row['Tráiler'] || '').trim();
            if (!trailer) throw new Error("La columna 'Tráiler' es obligatoria.");
            
            // VALIDACIÓN: Tráiler sin caracteres especiales ni tildes (solo letras, números, espacios y guiones)
            if (!/^[a-zA-Z0-9\s-]+$/.test(trailer)) {
                throw new Error(`El Tráiler '${trailer}' contiene caracteres inválidos. Solo se permiten letras sin tilde, números, espacios y guiones.`);
            }

            const sectorCargaRaw = String(row['Sector de carga'] || '').trim();
             if (!sectorCargaRaw) throw new Error("La columna 'Sector de carga' es obligatoria.");
            
            const validSectors: SectorDeCarga[] = ['Secos', 'Frescos', 'Bas', 'Electro', 'Combinado'];
            if (!validSectors.includes(sectorCargaRaw as SectorDeCarga)) {
                throw new Error(`Sector de carga '${sectorCargaRaw}' no es válido.`);
            }

            const fechaValue = row['Fecha'];
            const horaValue = row['Hora'];
            
            if (!fechaValue) throw new Error("La columna 'Fecha' es obligatoria.");
            if (!horaValue) throw new Error("La columna 'Hora' es obligatoria.");

            let year: number, month: number, day: number;
            if (typeof fechaValue === 'number') { 
                const fecha = excelSerialDateToJSDate(fechaValue);
                year = fecha.getUTCFullYear();
                month = fecha.getUTCMonth();
                day = fecha.getUTCDate();
            } else if (typeof fechaValue === 'string' && fechaValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                const parts = fechaValue.split('/');
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                year = parseInt(parts[2], 10);
                if (isNaN(day) || isNaN(month) || isNaN(year)) throw new Error(`Fecha inválida.`);
            } else {
                throw new Error(`Formato de fecha no reconocido.`);
            }

            let hours: number, minutes: number;
            if (typeof horaValue === 'number') {
                const totalSecondsInDay = Math.round(horaValue * 24 * 60 * 60);
                hours = Math.floor(totalSecondsInDay / 3600) % 24;
                minutes = Math.floor((totalSecondsInDay % 3600) / 60);
            } else if (typeof horaValue === 'string' && horaValue.match(/^\d{1,2}:\d{2}$/)) {
                const timeParts = horaValue.split(':');
                hours = parseInt(timeParts[0], 10);
                minutes = parseInt(timeParts[1], 10);
                if (isNaN(hours) || isNaN(minutes)) throw new Error(`Hora inválida.`);
            } else {
                    throw new Error(`Formato de hora no reconocido.`);
            }

            const combinedDate = new Date(year, month, day, hours, minutes);
            const fechaHoraEnvio = combinedDate.toISOString();
            
            const duracionValue = row['Duracion de carga'] || row['Duración de carga'];
             if (duracionValue === undefined || duracionValue === '') throw new Error("La columna 'Duracion de carga' es obligatoria.");
            
            const parsedDuracion = parseInt(String(duracionValue), 10);
            if (isNaN(parsedDuracion) || parsedDuracion <= 0) throw new Error(`Duración de carga inválida.`);
            const duracionCarga = parsedDuracion;

            const crearCitaRaw = String(row['Crear Cita'] || '').trim().toUpperCase();
            if (!crearCitaRaw) throw new Error("La columna 'Crear Cita' es obligatoria.");
            const crearCita = crearCitaRaw as 'SI' | 'NO';

            const baseShipmentData: Omit<ManhattanShipment, '_rowIndex' | 'FechaHoraCreacion' | 'UsuarioCreacion' | 'Número de envío Manhattan' | 'Sector de carga'> = {
                'Número de envío': numeroEnvio,
                'Tráiler': trailer,
                'Crear Cita': crearCita,
                FechaHoraEnvio: fechaHoraEnvio,
                'Duracion de carga': duracionCarga,
            };

            let hasAtLeastOneStop = false;
            // Set para controlar duplicados dentro del mismo envío
            const stopsFound = new Set<string>();

            for (let i = 1; i <= 15; i++) {
                const paradaKey = `Parada ${i}`;
                const paradaValue = String(row[paradaKey] || '').trim();
                if (paradaValue) {
                    if (stopsFound.has(paradaValue)) {
                        throw new Error(`La parada '${paradaValue}' está duplicada en el envío. No se permiten paradas repetidas.`);
                    }
                    stopsFound.add(paradaValue);
                    (baseShipmentData as any)[paradaKey] = paradaValue;
                    hasAtLeastOneStop = true;
                }
            }
            
            if (!hasAtLeastOneStop) throw new Error("Debe especificarse al menos una 'Parada'.");

            if (sectorCargaRaw === 'Combinado') {
                shipments.push({ ...baseShipmentData, 'Sector de carga': 'Secos' });
                shipments.push({ ...baseShipmentData, 'Sector de carga': 'Frescos' });
            } else {
                shipments.push({ ...baseShipmentData, 'Sector de carga': sectorCargaRaw as SectorDeCarga });
            }

        } catch (e) {
            throw new Error(`Error en fila ${index + 2}: ${(e as Error).message}`);
        }
    });

    return { shipments, fileName: file.name };
};

export const parseExcelToCSV = async (file: File): Promise<string> => {
    const XLSX = getXLSX();
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';', RS: '\n' });
    return csv;
};

export interface DataProcessingInstructions {
    keepColumns: string[];
    calculatedMetrics: {
        name: string;
        operation: 'DIVIDE' | 'MULTIPLY' | 'ADD' | 'SUBTRACT';
        operand1: string; 
        operand2: string; 
    }[];
}

export const getHeadersAndSample = async (file: File): Promise<{ headers: string[]; sample: any[] }> => {
    const XLSX = getXLSX();
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const headers: string[] = [];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const C = range.e.c + 1;
    for (let c = 0; c < C; ++c) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c })];
        headers.push(cell && cell.v ? String(cell.v) : `UNKNOWN_${c}`);
    }

    const json = XLSX.utils.sheet_to_json(worksheet, { header: headers, range: 1, defval: '' });
    const sample = json.slice(0, 3);

    return { headers, sample };
};

export const processExcelWithInstructions = async (file: File, instructions: DataProcessingInstructions): Promise<string> => {
    const XLSX = getXLSX();
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: 0 });

    const processedData = json.map((row: any) => {
        const newRow: any = {};

        instructions.keepColumns.forEach(col => {
            if (row[col] !== undefined) {
                newRow[col] = row[col];
            }
        });

        instructions.calculatedMetrics.forEach(metric => {
            const val1 = parseFloat(row[metric.operand1]);
            const val2 = parseFloat(row[metric.operand2]);
            
            if (isNaN(val1) || isNaN(val2)) {
                newRow[metric.name] = '';
                return;
            }

            let result = 0;
            switch (metric.operation) {
                case 'ADD': result = val1 + val2; break;
                case 'SUBTRACT': result = val1 - val2; break;
                case 'MULTIPLY': result = val1 * val2; break;
                case 'DIVIDE': result = val2 !== 0 ? val1 / val2 : 0; break;
            }
            newRow[metric.name] = Math.round(result * 100) / 100;
        });

        return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(processedData);
    return XLSX.utils.sheet_to_csv(ws, { FS: ';', RS: '\n' });
};