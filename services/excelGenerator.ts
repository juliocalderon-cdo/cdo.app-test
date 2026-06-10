



import * as XLSX_ from 'xlsx';
import { DownloadTask, OlpnDistributionLog, ManhattanShipment, AuditRecord } from '../types';

// Helper function to safely get the XLSX object
const getXLSX = () => {
    const lib = (XLSX_ as any).default || XLSX_;
    if (!lib || !lib.utils) {
         if ((window as any).XLSX) return (window as any).XLSX;
        throw new Error("La librería XLSX no se ha cargado correctamente.");
    }
    return lib;
};

// Helper function to format date specifically for Excel export
// It takes a date string (ISO or YYYY-MM-DD), treats it as local, and outputs DD/MM/YYYY
// This prevents timezone shifts when the browser interprets an ISO string as UTC.
const formatDateForExcel = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    
    // If it's an ISO string (e.g., "2026-09-05T00:00:00" or just "2026-09-05")
    // we take the first 10 characters to get the date part.
    // This assumes the date stored is the intended date, regardless of the time component.
    const datePart = dateStr.substring(0, 10); // YYYY-MM-DD
    
    // Check if valid date format YYYY-MM-DD
    if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
    }
    
    return dateStr; // Fallback
};

export const exportTaskToExcel = (task: DownloadTask) => {
    const XLSX = getXLSX();
    
    // --- Hoja de Resumen ---
    const operators = Array.from(new Set(task.closedILPNs.map(i => i.user).filter(Boolean)));
    const summaryData = [
        ["ID Tarea", task.id],
        ["Tipo de Tarea", "Descarga"],
        ["Archivo de Origen", task.fileName],
        ["Tipo de Descarga", task.downloadType],
        ["Usuario Creador", task.user],
        ["Operadores", operators.join(', ') || 'N/A'],
        ["Fecha de Inicio", task.startedAt ? new Date(task.startedAt).toLocaleString() : "N/A"],
        ["Fecha de Finalización", task.completedAt ? new Date(task.completedAt).toLocaleString() : "N/A"],
        ["Total iLPNs Generados", task.closedILPNs.length],
        ["Total Artículos (SKUs únicos)", task.articles.length],
        ["Total Cajas Procesadas", task.closedILPNs.reduce((sum, ilpn) => sum + ilpn.articles.reduce((s, a) => s + a.quantity, 0), 0)]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 50 }];


    // --- Hoja de Detalle de iLPNs ---
    const detailsData: (string | number)[][] = [];
    const headers = [
        "iLPN ID", "Tipo iLPN", "Madre", "Usuario iLPN", "iLPN Creado", "Artículo SKU", "Descripción", "Cód. Barras", "Cantidad"
    ];
    detailsData.push(headers);

    task.closedILPNs.forEach(ilpn => {
        ilpn.articles.forEach(article => {
            const row: (string | number)[] = [
                ilpn.id,
                ilpn.type,
                ilpn.madre,
                ilpn.user || 'N/A',
                new Date(ilpn.createdAt).toLocaleString(),
                article.sku,
                article.description,
                article.barcode || '',
                article.quantity,
            ];
            detailsData.push(row);
        });
    });

    const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
    wsDetails['!cols'] = [
        { wch: 35 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, 
        { wch: 40 }, { wch: 15 }, { wch: 10 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, wsSummary, "Resumen Tarea");
    XLSX.utils.book_append_sheet(workbook, wsDetails, "Detalle iLPNs");
    
    const safeFileName = task.fileName.replace(/[^a-z0-9]/gi, '_').slice(0, 50);
    XLSX.writeFileXLSX(workbook, `Reporte-${task.id.substring(0, 8)}-${safeFileName}.xlsx`);
};


export const exportOlpnDistributionLogToExcel = (data: OlpnDistributionLog[]) => {
    const XLSX = getXLSX();
    const headers = [
        "Pallet ID", "OLPN Origen", "OLPN Destino", "Local", "Ubicación Destino", "Fecha Confirmado", "Hora Confirmado", "Usuario"
    ];

    const sheetData = [
        headers,
        ...data.map(log => {
            const d = new Date(log.fechahoraconfirmado);
            return [
                log.palletid,
                log.olpnorigenid,
                log.olpndestinoid,
                log.local,
                log.ubicaciondestino,
                d.toLocaleDateString('es-UY'),
                d.toLocaleTimeString('es-UY'),
                log.usuario,
            ];
        })
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
        { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 10 }, 
        { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 20 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Log de Reparto Frescos");
    
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFileXLSX(workbook, `Reporte_Reparto_Frescos_${dateStr}.xlsx`);
};

export const exportManhattanShipmentsToExcel = (shipments: ManhattanShipment[], date: string) => {
    const XLSX = getXLSX();
    const headers = [
        "Nº Envío Manhattan",
        "Nº Envío",
        "Tráiler",
        "Sector de Carga",
        "Fecha de Envío",
        "Hora de Envío",
        "Duración Carga (min)",
        "Cita",
        "Usuario Creación",
        "Fecha Creación",
        "Paradas"
    ];

    const data = shipments.map(s => {
        const fechaEnvio = s.FechaHoraEnvio ? new Date(s.FechaHoraEnvio) : null;
        const fechaCreacion = s.FechaHoraCreacion ? new Date(s.FechaHoraCreacion) : null;
        const paradas = Object.keys(s)
            .filter(k => k.startsWith('Parada '))
            .sort((a, b) => parseInt(a.replace('Parada ', ''), 10) - parseInt(b.replace('Parada ', ''), 10))
            .map(key => s[key])
            .filter(Boolean)
            .join(', ');

        return [
            s['Número de envío Manhattan'],
            s['Número de envío'],
            s['Tráiler'],
            s['Sector de carga'],
            fechaEnvio ? fechaEnvio.toLocaleDateString('es-UY') : 'N/A',
            fechaEnvio ? fechaEnvio.toLocaleTimeString('es-UY') : 'N/A',
            s['Duracion de carga'],
            s.Cita || 'Pendiente',
            s.UsuarioCreacion,
            fechaCreacion ? fechaCreacion.toLocaleString('es-UY') : 'N/A',
            paradas
        ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = [
        { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
        { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 50 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Envíos Manhattan");
    
    XLSX.writeFileXLSX(workbook, `Reporte_Envios_Manhattan_${date}.xlsx`);
};

export const exportAuditsToExcel = (audits: AuditRecord[]) => {
    const XLSX = getXLSX();
    const headers = [
        "ID Auditoría", "Fecha", "Hora", "Sector", "Usuario", "OLPN", "Local", "Ubicacion",
        "Estado", "Calidad (%)",
        "Item", "Descripción", "Cant. Manhattan", "Cant. Auditada", "Diferencia",
        "Detalle Original", "Detalle Auditado", "Detalle Diferencia",
        "Tipo Diferencia", "Vto. Manhattan", "Vto. Auditado", "Recuento",
        "Pallet Original", "Pallet Auditado", "Dif. Pallet"
    ];

    const data = audits.map(record => {
        const dateObj = new Date(record.FechaHoraAuditoria);
        
        const vtoManhattan = formatDateForExcel(record.FechaVtoManhattan);
        const vtoAuditado = formatDateForExcel(record.FechaVtoAuditada);

        return [
            record.IdInternoAuditoria,
            dateObj.toLocaleDateString('es-UY'),
            dateObj.toLocaleTimeString('es-UY'),
            record.Sector,
            record.Usuario,
            record.OlpnId,
            record.Local || '',
            record.Ubicacion || '',
            record.EstadoAuditoria,
            record.PorcentajeCalidad,
            record.Item,
            record.Descripcion,
            record.CantidadManhattan,
            record.CantidadAuditada,
            record.Diferencia,
            record.DetalleOriginal || '',
            record.DetalleAuditado || '',
            record.DetalleDiferencia || '',
            record.TipoDiferencia,
            vtoManhattan,
            vtoAuditado,
            record.Recuento,
            record.PalletIdOriginal || 'N/A',
            record.PalletIdAuditado || 'N/A',
            record.DiferenciaPallet
        ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    
    ws['!cols'] = [
        { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 12 },
        { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 25 }, { wch: 25 }, { wch: 25 },
        { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 25 }, { wch: 25 }, { wch: 10 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Auditorias");
    
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFileXLSX(workbook, `Reporte_Auditorias_${dateStr}.xlsx`);
};

// --- LOOKER REPORTS FOR QUALITY ---

const getTurno = (date: Date): string => {
    const hours = date.getHours();
    if (hours >= 6 && hours < 14) return 'MATUTINO';
    if (hours >= 14 && hours < 22) return 'VESPERTINO';
    return 'NOCTURNO';
};

const getMes = (date: Date): string => {
    const months = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    return months[date.getMonth()];
};

const parseDetalle = (detalle: string | undefined) => {
    const result = { cajas: 0, packs: 0, unidades: 0 };
    if (!detalle) return result;

    // Format: "1 Cj, 2 Pk, 5 Un"
    const parts = detalle.split(',').map(p => p.trim());
    parts.forEach(part => {
        if (part.includes('Cj')) result.cajas = parseInt(part, 10) || 0;
        if (part.includes('Pk')) result.packs = parseInt(part, 10) || 0;
        if (part.includes('Un')) result.unidades = parseInt(part, 10) || 0;
    });
    return result;
};

const parseTotalUnitsFromRecord = (record: AuditRecord) => {
    let cajas = 0;
    let packs = 0;
    let unidades = 0;

    let totalCajasUnits = 0;
    let totalPacksUnits = 0;
    let looseUnits = 0;

    try {
        if (record.RawOriginal) {
            const rawData = JSON.parse(record.RawOriginal);
            
            // rawData is typically the OlpnDetail item from Manhattan
            const itemPackages = rawData?.Item?.ItemPackage || [];
            
            let unitsPerCaja = 1;
            let unitsPerPack = 1;

            // Find UOM quantities
            itemPackages.forEach((pkg: any) => {
                if (pkg.UomId === 'Caja' || pkg.UomId === 'CJ') unitsPerCaja = parseInt(pkg.Quantity, 10) || 1;
                if (pkg.UomId === 'Pack' || pkg.UomId === 'PK') unitsPerPack = parseInt(pkg.Quantity, 10) || 1;
            });

            // Parse DetalleOriginal for the raw counted quantities "X Cj, Y Pk, Z Un"
            const detalleParts = (record.DetalleOriginal || '').split(',').map(p => p.trim());
            detalleParts.forEach(part => {
                const numericPart = part.replace(/[^\d.-]/g, '');
                const num = parseInt(numericPart, 10) || 0;
                
                // Extraer también las conversiones a mano si falló Manhattan
                if (part.includes('Cj')) cajas = num;
                if (part.includes('Pk')) packs = num;
                if (part.includes('Un')) looseUnits = num;
            });

            totalCajasUnits = cajas * unitsPerCaja;
            totalPacksUnits = packs * unitsPerPack;
            unidades = totalCajasUnits + totalPacksUnits + looseUnits;

        } else {
             // Fallback if RawOriginal is not available
             const detail = parseDetalle(record.DetalleOriginal);
             cajas = detail.cajas || 0;
             packs = detail.packs || 0;
             unidades = detail.unidades || 0; // Will just be the loose units in fallback
        }
    } catch(e) {
        console.error("Error parsing record detail for export:", e);
        const detail = parseDetalle(record.DetalleOriginal);
        cajas = detail.cajas || 0;
        packs = detail.packs || 0;
        unidades = detail.unidades || 0;
    }

    return { cajas, packs, unidades };
};

export const exportSecosLookerReport = (audits: AuditRecord[]) => {
    const XLSX = getXLSX();
    const headers = [
        "MES", "FECHA", "U. NEGOCIO", "UBICACIÓN", "Tipo de Ubicación", "ITEM", "DESCRIPCIÓN",
        "CAJAS", "PACKS", "UNIDADES", "OLPN", "OLPN.1", "Pallet", "Estado de Calidad",
        "FECHA DE VENCIMIENTO", "Lote", "DESTINO", "SECTOR", "TURNO", "AUDITOR",
        "DIFERENCIA", "MOTIVO", "UNIDADES C/DIF", "RESPONSABLE", "PTL UNIDADES?",
        "VALIDADO CON", "COMENTARIOS"
    ];

    const data = audits.map(record => {
        const dateObj = new Date(record.FechaHoraAuditoria);
        const detail = parseTotalUnitsFromRecord(record);
        
        let fechaVencimiento = formatDateForExcel(record.FechaVtoAuditada);
        if (!fechaVencimiento || fechaVencimiento.trim() === '') {
            if (record.FechaVtoManhattan) {
                fechaVencimiento = 'Dato no ingresado';
            } else {
                fechaVencimiento = '';
            }
        }

        return [
            getMes(dateObj),
            dateObj.toLocaleDateString('es-UY'),
            record.Sector,
            record.Ubicacion || '',
            '', // Tipo de Ubicación (vacio)
            record.Item,
            record.Descripcion,
            detail.cajas,
            detail.packs,
            detail.unidades,
            record.OlpnId,
            record.OlpnId, // OLPN.1
            record.PalletIdAuditado ? record.PalletIdAuditado : (record.PalletIdOriginal ? 'Dato no ingresado' : ''),
            '', // Estado de Calidad (vacio)
            fechaVencimiento,
            '', // Lote (vacio)
            record.Local || '',
            '', // SECTOR (vacio)
            getTurno(dateObj),
            record.Usuario,
            record.TipoDiferencia,
            '', // MOTIVO (vacio)
            record.Diferencia,
            '', // RESPONSABLE (vacio)
            '', // PTL UNIDADES? (vacio)
            '', // VALIDADO CON (vacio)
            ''  // COMENTARIOS (vacio)
        ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Secos Looker");
    
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFileXLSX(workbook, `Reporte_Secos_Looker_${dateStr}.xlsx`);
};

export const exportFrescosLookerReport = (audits: AuditRecord[]) => {
    const XLSX = getXLSX();
    const headers = [
        "MES", "Fecha", "CÁMARA", "UBICACIÓN", "LPN", "ITEM", "DESCRIPCIÓN",
        "UNIDADES", "CAJAS", "PACKS", "PESO", "DESTINO", "TURNO", "AUDITOR",
        "DIFERENCIA", "UNIDADES C/DIF", "MOTIVO", "RESPONSABLE", "SUPERIOR OPERATIVA",
        "COMENTARIOS"
    ];

    const data = audits.map(record => {
        const dateObj = new Date(record.FechaHoraAuditoria);
        const detail = parseTotalUnitsFromRecord(record);
        
        return [
            getMes(dateObj),
            dateObj.toLocaleDateString('es-UY'),
            '', // CÁMARA (vacio)
            record.Ubicacion || '',
            record.OlpnId,
            record.Item,
            record.Descripcion,
            detail.unidades,
            detail.cajas,
            detail.packs,
            '', // PESO (vacio)
            record.Local || '',
            getTurno(dateObj),
            record.Usuario,
            record.TipoDiferencia,
            record.Diferencia,
            '', // MOTIVO (vacio)
            '', // RESPONSABLE (vacio)
            '', // SUPERIOR OPERATIVA (vacio)
            ''  // COMENTARIOS (vacio)
        ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Frescos Looker");
    
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFileXLSX(workbook, `Reporte_Frescos_Looker_${dateStr}.xlsx`);
};
