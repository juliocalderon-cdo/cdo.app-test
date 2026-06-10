
import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { sheets as googleSheetsService } from '../services/googleSheetsService';
import { useAuthContext } from '../hooks/useAuth';
import { ReverseLogisticsItem } from '../types';
import { UploadIcon, RefreshIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon, DocumentIcon, ChevronDownIcon, BoxIcon, TruckIcon, HomeIcon } from './Icons';

interface ProcessResult {
    success: number;
    failed: { lpn: string; error: string }[];
}

// Estructura para la agrupación jerárquica
interface GroupedASN {
    asnId: string;
    vendorId: string;
    lpns: Record<string, ReverseLogisticsItem[]>;
}

const findExcelProp = (row: any, keys: string[]): any => {
    const normalize = (s: string) => String(s).toLowerCase().replace(/[\s_]/g, '');
    const normalizedKeys = keys.map(normalize);
    
    for (const actualKey in row) {
        if (normalizedKeys.includes(normalize(actualKey))) {
            return row[actualKey];
        }
    }
    return undefined;
};

const ReverseLogisticsView: React.FC = () => {
    const { currentUser } = useAuthContext();
    const [groupedData, setGroupedData] = useState<Record<string, GroupedASN>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<ProcessResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estados para controlar qué desplegables están abiertos
    const [expandedAsns, setExpandedAsns] = useState<Set<string>>(new Set());
    const [expandedLpns, setExpandedLpns] = useState<Set<string>>(new Set());

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setGroupedData({});
        setResult(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Validación: Solo una hoja permitida
                if (workbook.SheetNames.length !== 1) {
                    setError("El archivo Excel debe contener exactamente una hoja. Por favor, corrija el archivo y vuelva a intentarlo.");
                    setIsLoading(false);
                    // Limpiamos el input para permitir re-subida del mismo archivo corregido
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }

                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

                const tempGroups: Record<string, GroupedASN> = {};

                rows.forEach(row => {
                    const lpnId = String(findExcelProp(row, ['CARTON', 'LPN', 'ILPN']) || '').trim();
                    const local = String(findExcelProp(row, ['TIENDA_ORIGEN', 'LOCAL', 'VENDOR']) || '').trim();
                    let asn = String(findExcelProp(row, ['BOL_NO', 'BOL_ESPERADA', 'BOL', 'ASN']) || '').trim();
                    const itemId = String(findExcelProp(row, ['ITEM', 'SKU', 'ARTICULO']) || '').trim();
                    const cantidad = String(findExcelProp(row, ['CANT_ESPERADA', 'CANTIDAD', 'QTY']) || '0').trim();
                    
                    if (asn.startsWith("'")) asn = asn.slice(1);
                    if (!lpnId || !local || !asn || !itemId) return;

                    if (!tempGroups[asn]) {
                        tempGroups[asn] = { asnId: asn, vendorId: local, lpns: {} };
                    }
                    if (!tempGroups[asn].lpns[lpnId]) {
                        tempGroups[asn].lpns[lpnId] = [];
                    }

                    tempGroups[asn].lpns[lpnId].push({
                        "BatchNumber": "",
                        "VendorId": local,
                        "CountryOfOrigin": "",
                        "Quantity": cantidad,
                        "PackQuantity": "",
                        "InventoryTypeId": "",
                        "ItemId": itemId,
                        "ProductStatusId": "",
                        "LpnDetailExpDate": "",
                        "Price": "",
                        "BatchExpirationDate": "",
                        "CompletionTime": new Date().toISOString().slice(0, 19),
                        "PurchaseOrderId": "",
                        "InventoryAttribute1": "",
                        "InventoryAttribute2": "",
                        "InventoryAttribute3": "",
                        "InventoryAttribute4": "",
                        "InventoryAttribute5": "",
                        "LpnDetailMfgDate": ""
                    });
                });

                if (Object.keys(tempGroups).length === 0) {
                    setError("No se encontraron datos válidos. Verifique las columnas CARTON, TIENDA_ORIGEN, BOL, ITEM y CANT_ESPERADA.");
                    if (fileInputRef.current) fileInputRef.current.value = '';
                } else {
                    setGroupedData(tempGroups);
                }
            } catch (err) {
                setError("Error al procesar el archivo Excel.");
                if (fileInputRef.current) fileInputRef.current.value = '';
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Cálculos para el resumen
    const stats = useMemo(() => {
        const asns = Object.keys(groupedData);
        const locales = new Set(Object.values(groupedData).map(g => g.vendorId));
        let totalLpns = 0;
        asns.forEach(asn => {
            totalLpns += Object.keys(groupedData[asn].lpns).length;
        });
        return { totalAsns: asns.length, totalLocales: locales.size, totalLpns };
    }, [groupedData]);

    const toggleAsn = (asn: string) => {
        setExpandedAsns(prev => {
            const next = new Set(prev);
            if (next.has(asn)) next.delete(asn); else next.add(asn);
            return next;
        });
    };

    const toggleLpn = (lpn: string) => {
        setExpandedLpns(prev => {
            const next = new Set(prev);
            if (next.has(lpn)) next.delete(lpn); else next.add(lpn);
            return next;
        });
    };

    const handleImpactManhattan = async () => {
        if (stats.totalLpns === 0 || !currentUser) return;

        setIsProcessing(true);
        setProgress(0);
        const successes: number[] = [];
        const failures: { lpn: string; error: string }[] = [];

        try {
            const token = await googleSheetsService.getManhattanToken();
            let processedCount = 0;

            for (const asnId in groupedData) {
                const asnGroup = groupedData[asnId];
                for (const lpnId in asnGroup.lpns) {
                    const items = asnGroup.lpns[lpnId];
                    
                    const payload = {
                        "EndpointId": "TATA_RECV_ILPN",
                        "header": { "Organization": "1001", "Location": "100", "BusinessUnit": "1002" },
                        "Message": {
                            "MessageType": "TATA_RECV_ILPN",
                            "contextLocation": "100",
                            "contextBusinessUnit": "1002",
                            "contextOrg": "1001",
                            "contextUser": "Mherfid",
                            "LpnId": lpnId,
                            "AsnId": asnId,
                            "UserInputLineItemList": items,
                            "CriteriaId": "TATA_RECEP_RFID",
                            "TransactionId": "RECEPCIONRFID"
                        },
                        "IncludeRequest": false
                    };

                    try {
                        const response = await googleSheetsService.processReverseLogistics(token, payload);
                        if (response.success || response.statusCode === "OK") {
                            successes.push(1);
                        } else {
                            failures.push({ lpn: lpnId, error: response.message || "Error Manhattan" });
                        }
                    } catch (err) {
                        failures.push({ lpn: lpnId, error: "Error de red" });
                    }
                    processedCount++;
                    setProgress(Math.round((processedCount / stats.totalLpns) * 100));
                }
            }

            setResult({ success: successes.length, failed: failures });
            setGroupedData({});
        } catch (err) {
            setError("Error al obtener token de Manhattan.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setGroupedData({});
        setResult(null);
        setError(null);
        setExpandedAsns(new Set());
        setExpandedLpns(new Set());
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="p-6 sm:p-8">
            <div className="flex justify-between items-start mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white">Recepción Logística Inversa</h1>
                    <p className="text-zinc-400 mt-2">Recepción masiva agrupada por ASN e iLPN.</p>
                </div>
                {stats.totalLpns > 0 && (
                    <button onClick={handleReset} className="p-3 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 border border-zinc-600 transition-colors">
                        Nueva Carga
                    </button>
                )}
            </div>

            {stats.totalLpns === 0 && !result && !isProcessing && (
                <div className="bg-zinc-800 p-10 rounded-xl shadow-lg border border-zinc-700 text-center max-w-2xl mx-auto">
                    <DocumentIcon className="w-16 h-16 text-sky-400 mx-auto mb-6" />
                    <h2 className="text-xl font-bold text-white mb-2">Cargar archivo Excel</h2>
                    <p className="text-zinc-400 mb-6 text-sm">Agrupación automática por BOL.</p>
                    
                    <div className="mb-8 p-4 bg-amber-900/30 border-l-4 border-amber-500 text-amber-200 rounded-lg flex items-start gap-3 text-left">
                        <XCircleIcon className="w-6 h-6 flex-shrink-0 text-amber-400 mt-0.5" />
                        <p className="text-sm">
                            <span className="font-bold block mb-1 uppercase tracking-tight">¡Atención Importante!</span>
                            Debe tener cuidado de <span className="font-bold underline">no subir un excel filtrado</span>, ya que esto podría impactar inventario de forma errónea en Manhattan. Asegúrese de que el archivo contenga <span className="font-bold">exactamente una hoja</span>.
                        </p>
                    </div>

                    <label className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-8 rounded-lg cursor-pointer transition-all shadow-lg hover:shadow-sky-900/20">
                        <UploadIcon className="w-5 h-5" />
                        <span>Seleccionar Archivo</span>
                        <input 
                            ref={fileInputRef} 
                            type="file" 
                            accept=".xlsx" 
                            className="hidden" 
                            onChange={handleFileUpload} 
                            disabled={isLoading} 
                        />
                    </label>

                    {isLoading && (
                        <div className="mt-6 flex flex-col items-center">
                            <RefreshIcon className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                            <p className="text-zinc-400">Analizando datos...</p>
                        </div>
                    )}
                    {error && <div className="mt-6 p-4 bg-red-900/30 border border-red-800 text-red-300 rounded-lg text-sm">{error}</div>}
                </div>
            )}

            {stats.totalLpns > 0 && !isProcessing && !result && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700 flex items-center gap-4">
                            <div className="p-3 bg-sky-900/30 rounded-lg"><TruckIcon className="w-6 h-6 text-sky-400"/></div>
                            <div><p className="text-xs font-bold text-zinc-500 uppercase">ASNs</p><p className="text-2xl font-bold text-white">{stats.totalAsns}</p></div>
                        </div>
                        <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700 flex items-center gap-4">
                            <div className="p-3 bg-amber-900/30 rounded-lg"><BoxIcon className="w-6 h-6 text-amber-400"/></div>
                            <div><p className="text-xs font-bold text-zinc-500 uppercase">iLPNs</p><p className="text-2xl font-bold text-white">{stats.totalLpns}</p></div>
                        </div>
                        <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700 flex items-center gap-4">
                            <div className="p-3 bg-teal-900/30 rounded-lg"><HomeIcon className="w-6 h-6 text-teal-400"/></div>
                            <div><p className="text-xs font-bold text-zinc-500 uppercase">Locales</p><p className="text-2xl font-bold text-white">{stats.totalLocales}</p></div>
                        </div>
                        <button onClick={handleImpactManhattan} className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                            <CheckCircleIcon className="w-5 h-5" />
                            <span>Impactar Manhattan</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        {Object.values(groupedData).map((asnGroup) => (
                            <div key={asnGroup.asnId} className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-md">
                                <div 
                                    onClick={() => toggleAsn(asnGroup.asnId)}
                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-700/50 transition-colors bg-zinc-700/20"
                                >
                                    <div className="flex items-center gap-4">
                                        <ChevronDownIcon className={`w-5 h-5 text-zinc-500 transition-transform ${expandedAsns.has(asnGroup.asnId) ? '' : '-rotate-90'}`} />
                                        <div>
                                            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">ASN (BOL):</span>
                                            <h3 className="text-lg font-bold text-white font-mono">{asnGroup.asnId}</h3>
                                        </div>
                                        <div className="ml-4 px-3 py-1 bg-zinc-900 rounded-full border border-zinc-600">
                                            <span className="text-xs text-zinc-400">Tienda: </span>
                                            <span className="text-xs font-bold text-zinc-100">{asnGroup.vendorId}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-zinc-500 uppercase font-bold">iLPNs en este ASN</p>
                                        <p className="text-sm font-bold text-zinc-300">{Object.keys(asnGroup.lpns).length}</p>
                                    </div>
                                </div>

                                {expandedAsns.has(asnGroup.asnId) && (
                                    <div className="p-4 bg-zinc-900/30 border-t border-zinc-700 space-y-3">
                                        {Object.entries(asnGroup.lpns).map(([lpnId, items]) => (
                                            <div key={lpnId} className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
                                                <div 
                                                    onClick={() => toggleLpn(lpnId)}
                                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-700 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <ChevronDownIcon className={`w-4 h-4 text-zinc-500 transition-transform ${expandedLpns.has(lpnId) ? '' : '-rotate-90'}`} />
                                                        <BoxIcon className="w-4 h-4 text-amber-500" />
                                                        <span className="font-mono text-zinc-100 font-bold">{lpnId}</span>
                                                    </div>
                                                    <span className="text-xs font-bold bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">
                                                        {items.length} Ítems
                                                    </span>
                                                </div>
                                                
                                                {expandedLpns.has(lpnId) && (
                                                    <div className="px-3 pb-3 border-t border-zinc-700/50">
                                                        <table className="w-full text-xs text-left text-zinc-400 mt-2">
                                                            <thead className="text-zinc-500 uppercase">
                                                                <tr>
                                                                    <th className="py-2">Item</th>
                                                                    <th className="py-2 text-right">Cant. Esperada</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {items.map((item, idx) => (
                                                                    <tr key={idx} className="border-t border-zinc-700/30">
                                                                        <td className="py-2 font-mono">{item.ItemId}</td>
                                                                        <td className="py-2 text-right font-bold text-zinc-200">{item.Quantity}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="bg-zinc-800 p-12 rounded-xl shadow-lg border border-zinc-700 text-center max-w-2xl mx-auto">
                    <ArrowPathIcon className="w-16 h-16 text-sky-500 animate-spin mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-white mb-2">Impactando Manhattan</h2>
                    <p className="text-zinc-400 mb-8">Procesando {stats.totalLpns} iLPNs...</p>
                    <div className="w-full bg-zinc-700 h-4 rounded-full overflow-hidden mb-2">
                        <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-sm font-bold text-sky-400">{progress}% completado</p>
                </div>
            )}

            {result && (
                <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                    <div className={`p-8 rounded-xl border shadow-xl text-center ${result.failed.length === 0 ? 'bg-green-900/20 border-green-700' : 'bg-amber-900/20 border-amber-700'}`}>
                        {result.failed.length === 0 ? <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" /> : <XCircleIcon className="w-16 h-16 text-amber-500 mx-auto mb-4" />}
                        <h2 className="text-3xl font-bold text-white mb-2">Proceso Finalizado</h2>
                        <p className="text-zinc-300 text-lg">Se impactaron <span className="text-green-400 font-bold">{result.success}</span> iLPNs con éxito.</p>
                        {result.failed.length > 0 && <p className="text-amber-400 mt-1">Errores en <span className="font-bold">{result.failed.length}</span> iLPNs.</p>}
                        <button onClick={handleReset} className="mt-8 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-all">Volver a Empezar</button>
                    </div>

                    {result.failed.length > 0 && (
                        <div className="bg-zinc-800 rounded-xl border border-zinc-700 overflow-hidden shadow-lg">
                            <div className="bg-red-900/30 px-6 py-4 border-b border-zinc-700"><h3 className="text-lg font-bold text-red-200">Detalle de Fallos</h3></div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-zinc-400">
                                    <thead className="text-xs text-zinc-400 uppercase bg-zinc-700"><tr><th className="px-6 py-3">iLPN</th><th className="px-6 py-3">Error</th></tr></thead>
                                    <tbody>
                                        {result.failed.map((fail, idx) => (
                                            <tr key={idx} className="border-b border-zinc-700"><td className="px-6 py-4 font-mono font-bold text-zinc-200">{fail.lpn}</td><td className="px-6 py-4 text-red-300">{fail.error}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReverseLogisticsView;
