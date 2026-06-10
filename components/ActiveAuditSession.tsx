




import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../hooks/useAuth';
import { sheets as googleSheetsService } from '../services/googleSheetsService';
import { AuditRecord, AuditSector, ManhattanItemCache, ScannedItemData } from '../types';
import { BarcodeIcon, CheckCircleIcon, XCircleIcon } from './Icons';

// --- NEW HELPER ---
const getQualityColor = (quality: number | null) => {
    if (quality === null) return 'text-zinc-500';
    if (quality >= 95) return 'text-green-400';
    if (quality >= 80) return 'text-yellow-400';
    return 'text-red-400';
};


// --- START: MODALS ---

const ReauditConfirmationModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; auditorName: string; }> = ({ isOpen, onClose, onConfirm, auditorName }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md border border-zinc-700" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-yellow-400"><XCircleIcon className="w-8 h-8" /><h3 className="text-xl font-bold text-white">¡Atención! OLPN ya auditado</h3></div>
                    <p className="text-zinc-300 mb-6 text-base">Este OLPN ya fue auditado por <span className="font-bold text-white">{auditorName}</span>.</p>
                    <p className="text-zinc-300 text-base">¿Desea auditarlo nuevamente?</p>
                    <div className="flex justify-end gap-3 mt-8">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors">Cancelar</button>
                        <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-yellow-600 hover:bg-yellow-700 transition-colors">Auditar de todos modos</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PalletConfirmationModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; expected: string; found: string; }> = ({ isOpen, onClose, onConfirm, expected, found }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md border border-zinc-700" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-yellow-400"><XCircleIcon className="w-8 h-8" /><h3 className="text-xl font-bold text-white">¡Diferencia de Pallet!</h3></div>
                    <p className="text-zinc-300 mb-2 text-base">Se detectó una discrepancia en el ID del pallet.</p>
                    <div className="text-sm space-y-1 bg-zinc-900/50 p-3 rounded-lg border border-zinc-700">
                        <p><span className="font-semibold text-zinc-400">Sistema esperaba:</span> <span className="font-mono text-zinc-200">{expected}</span></p>
                        <p><span className="font-semibold text-zinc-400">Se encontró:</span> <span className="font-mono text-zinc-200">{found}</span></p>
                    </div>
                    <p className="text-zinc-300 mt-6 text-base">¿Desea confirmar esta diferencia y continuar con la auditoría?</p>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors">Cancelar</button>
                        <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-yellow-600 hover:bg-yellow-700 transition-colors">Confirmar y Continuar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper: Maps internal UOM key to display name with proper casing and pluralization
const mapUomName = (uom: string, count: number) => {
    const lower = uom.toLowerCase();
    if (lower.includes('unidad')) return count === 1 ? '1 Unidad' : `${count} Unidades`;
    if (lower.includes('caja')) return count === 1 ? '1 Caja' : `${count} Cajas`;
    if (lower.includes('pack')) return count === 1 ? '1 Pack' : `${count} Packs`;
    return `${count} ${uom}`;
};

// Helper to convert total units back to Boxes/Packs string
const getBreakdownString = (totalUnits: number, uomMap: { [uom: string]: number }): string => {
    if (totalUnits === 0) return "0 Unidades";

    let remaining = Math.abs(totalUnits);
    const parts: string[] = [];
    
    // Sort UOMs by quantity descending (Caja > Pack > Unidad)
    const sortedUoms = Object.entries(uomMap)
        .sort(([, a], [, b]) => b - a);

    for (const [uom, qtyPerUom] of sortedUoms) {
        if (qtyPerUom <= 1) continue;
        const count = Math.floor(remaining / qtyPerUom);
        if (count > 0) {
            parts.push(mapUomName(uom, count));
            remaining %= qtyPerUom;
        }
    }

    if (remaining > 0) {
        parts.push(mapUomName('UNIDAD', remaining));
    }

    const prefix = totalUnits < 0 ? "-" : "";
    return parts.length > 0 ? prefix + parts.join(", ") : "0 Unidades";
};


// Helper to construct JSON breakdown
const getBreakdownObj = (totalUnits: number, uomMap: { [uom: string]: number }) => {
    let remaining = Math.abs(totalUnits);
    const result: any = {};
    
    const sortedUoms = Object.entries(uomMap).sort(([, a], [, b]) => b - a);

    for (const [uom, qtyPerUom] of sortedUoms) {
        if (qtyPerUom <= 1) continue;
        const count = Math.floor(remaining / qtyPerUom);
        if (count > 0) {
            result[uom.toLowerCase()] = count;
            remaining %= qtyPerUom;
        }
    }
    if (remaining > 0) {
        result['unidades'] = remaining;
    }
    return result;
}

// Helper to format date string YYYY-MM-DD to DD/MM/YYYY without timezone conversion
const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
};


// --- MODAL COMPONENT ---
const AuditSummaryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    missingItems: { id: string; desc: string; missing: number; uomMap: { [key: string]: number } }[];
    hasDiffs: boolean;
    quality: number | null;
}> = ({ isOpen, onClose, onConfirm, missingItems, hasDiffs, quality }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md border border-zinc-700" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Finalizar Auditoría</h3>
                    
                    {missingItems.length === 0 && !hasDiffs ? (
                        <div className="flex flex-col items-center text-center py-4">
                            <CheckCircleIcon className="w-16 h-16 text-green-500 mb-4" />
                            <p className="text-zinc-300 text-lg">Todo coincide perfectamente.</p>
                            <p className="text-zinc-400 text-sm">No hay diferencias ni faltantes.</p>
                        </div>
                    ) : (
                        <div>
                             <div className="text-center mb-6">
                                <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Calidad de Auditoría</p>
                                <p className={`text-6xl font-extrabold font-mono tracking-tighter ${getQualityColor(quality)}`}>
                                    {quality !== null ? `${quality}%` : '-'}
                                </p>
                            </div>
                             <div className="flex items-center gap-3 mb-4 text-yellow-400">
                                <XCircleIcon className="w-8 h-8" />
                                <span className="font-bold text-lg">Se detectaron diferencias</span>
                             </div>
                            
                            {missingItems.length > 0 && (
                                <div className="mb-4 bg-zinc-900/50 p-3 rounded-lg max-h-40 overflow-y-auto">
                                    <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Items Faltantes (No escaneados totalmente):</p>
                                    <ul className="space-y-2">
                                        {missingItems.map(item => (
                                            <li key={item.id} className="text-sm flex justify-between gap-4">
                                                <span className="text-zinc-300 truncate pr-2">{item.desc}</span>
                                                <span className="text-red-400 font-bold whitespace-nowrap">Faltan {getBreakdownString(item.missing, item.uomMap)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            
                            <p className="text-zinc-300 text-sm">
                                ¿Desea registrar estas diferencias y cerrar la auditoría?
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-6">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                            Volver
                        </button>
                        <button 
                            onClick={onConfirm}
                            className={`px-6 py-2 rounded-lg text-sm font-bold text-white transition-colors ${missingItems.length > 0 || hasDiffs ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            Confirmar y Guardar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- EXIT CONFIRMATION MODAL ---
const ExitConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md border border-zinc-700" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-red-400">
                        <XCircleIcon className="w-8 h-8" />
                        <h3 className="text-xl font-bold text-white">¿Salir de la auditoría?</h3>
                    </div>
                    <p className="text-zinc-300 mb-6 text-base">
                        Si sale ahora, <span className="font-bold text-white">se perderá todo el progreso</span> contado hasta el momento para este OLPN.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={onConfirm}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                        >
                            Salir sin guardar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ActiveAuditSession: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser } = useAuthContext();
    
    // Setup & State
    const [olpnId, setOlpnId] = useState(location.state?.olpnId || '');
    const isRecount = location.state?.isRecount || false;
    const sector = (location.state?.sector as AuditSector) || 'SECOS';
    const [sessionState, setSessionState] = useState<'SCAN_OLPN' | 'FETCHING_DATA' | 'SCAN_PALLET' | 'AUDITING' | 'FINISHING'>('SCAN_OLPN');
    
    // Data
    const [manhattanOlpnData, setManhattanOlpnData] = useState<any[]>([]); // Raw details from searchManhattanOlpnForAudit
    const [olpnMetadata, setOlpnMetadata] = useState<{ locationId: string, facilityId: string } | null>(null);
    const [originalPalletId, setOriginalPalletId] = useState<string | null>(null);
    const [scannedPalletId, setScannedPalletId] = useState<string>('');
    const [palletDiffConfirmed, setPalletDiffConfirmed] = useState(false);
    const [itemCache, setItemCache] = useState<ManhattanItemCache>({});
    const [auditLog, setAuditLog] = useState<ScannedItemData[]>([]);
    
    // Current Scan Inputs
    const [scannedBarcode, setScannedBarcode] = useState('');
    const [currentAuditItem, setCurrentAuditItem] = useState<{
        id: string; 
        description: string; 
        manhattanQty: number; 
        manhattanExpiry: string | null;
        uomMap: { [uom: string]: number }
    } | null>(null);

    // Modal / Form States
    const [showItemForm, setShowItemForm] = useState(false);
    const [formInputs, setFormInputs] = useState({ boxes: '', packs: '', units: '', expiry: '' });
    const [alertMessage, setAlertMessage] = useState<{type: 'error' | 'warning' | 'success', msg: string} | null>(null);
    const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [isPalletModalOpen, setIsPalletModalOpen] = useState(false);
    const [isReauditModalOpen, setIsReauditModalOpen] = useState(false);
    const [previousAuditor, setPreviousAuditor] = useState('');
    const [palletMismatchDetails, setPalletMismatchDetails] = useState({ expected: '', found: '' });
    const [missingItemsSummary, setMissingItemsSummary] = useState<{ id: string; desc: string; missing: number; uomMap: { [key: string]: number } }[]>([]);
    const [finalQuality, setFinalQuality] = useState<number | null>(null);
    
    // Refs for focus management
    const olpnInputRef = useRef<HTMLInputElement>(null);
    const palletInputRef = useRef<HTMLInputElement>(null);
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (sessionState === 'SCAN_OLPN' && !olpnId) olpnInputRef.current?.focus();
        if (sessionState === 'SCAN_PALLET') palletInputRef.current?.focus();
        if (sessionState === 'AUDITING' && !showItemForm && !isFinishModalOpen && !isExitModalOpen) barcodeInputRef.current?.focus();
    }, [sessionState, showItemForm, olpnId, isFinishModalOpen, isExitModalOpen]);

    // If initiated with an OLPN (recount), auto-start
    useEffect(() => {
        if (olpnId && sessionState === 'SCAN_OLPN') {
            handleOlpnSubmit();
        }
    }, []);

    const updateCacheFromManhattanResponse = (cache: ManhattanItemCache, itemsData: any[]) => {
        itemsData.forEach((mItem: any) => {
            const id = String(mItem.ItemId);
            if (!id) return;
            
            const uomMap: { [uom: string]: number } = { UNIDAD: 1 };
            if (mItem.ItemPackage) {
                mItem.ItemPackage.forEach((pkg: any) => {
                        uomMap[pkg.UomId] = pkg.Quantity; 
                });
            }
            
            // FIX: Explicitly cast CodeValue to string to resolve TypeScript error.
            // @ts-ignore
            const codes = mItem.ItemCode ? mItem.ItemCode.map((c: any) => String(c.CodeValue)) : [id];
            const finalDesc = mItem.ItemDescription || mItem.ShortDescription || cache[id]?.description || "Sin descripción";

            cache[id] = { description: finalDesc, uomMap, codeMap: codes };
        });
        return cache;
    };

    const continueOlpnFetch = async () => {
        setSessionState('FETCHING_DATA');
        try {
            const token = await googleSheetsService.getManhattanToken();
            const olpnResp = await googleSheetsService.searchManhattanOlpnForAudit(token, olpnId);

            if (!olpnResp.success || olpnResp.data.length === 0) {
                setAlertMessage({ type: 'error', msg: `El OLPN ${olpnId} no existe en Manhattan.` });
                setSessionState('SCAN_OLPN');
                return;
            }

            const olpnContainer = olpnResp.data[0];
            const olpnDetailsData = olpnContainer.OlpnDetail || [];
            setOriginalPalletId(olpnContainer.PalletId || null);
            setManhattanOlpnData(olpnDetailsData);
            setOlpnMetadata({
                locationId: olpnContainer.CurrentLocationId || '',
                facilityId: olpnContainer.DestinationFacilityId || ''
            });
            
            const cache: ManhattanItemCache = {};
            olpnDetailsData.forEach((d: any) => {
                const iId = String(d.ItemId);
                if (!cache[iId]) {
                    cache[iId] = { description: d.ItemDescription || "Sin descripción", uomMap: { [d.QuantityUomId || 'UNIDAD']: 1 }, codeMap: [iId] };
                }
            });

            const itemIds: string[] = Array.from(new Set(olpnDetailsData.map((d: any) => String(d.ItemId))));
            if (itemIds.length > 0) {
                try {
                    const itemsResp = await googleSheetsService.searchManhattanItems(token, itemIds);
                    if(itemsResp.success) {
                        updateCacheFromManhattanResponse(cache, itemsResp.data);
                    }
                } catch (ignore) {
                    console.warn("Could not fetch extended item details.");
                }
            }
            
            setItemCache(cache);
            if (sector === 'BAS') {
                setSessionState('SCAN_PALLET');
            } else {
                setSessionState('AUDITING');
            }
        } catch (err) {
            console.error(err);
            setAlertMessage({ type: 'error', msg: "Error de conexión con Manhattan." });
            setSessionState('SCAN_OLPN');
        }
    };
    
    const handleOlpnSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!olpnId) return;
        
        setSessionState('FETCHING_DATA');
        setAlertMessage(null);
        try {
            const existingAudits = await googleSheetsService.getAuditRecords({ olpn: olpnId });
            if (existingAudits.length > 0) {
                const lastAuditor = existingAudits[0].Usuario;
                if (lastAuditor !== currentUser?.name) {
                    setPreviousAuditor(lastAuditor);
                    setIsReauditModalOpen(true);
                    return; 
                }
            }
            await continueOlpnFetch();
        } catch (err) {
            console.error(err);
            setAlertMessage({ type: 'error', msg: "Error al verificar auditorías previas." });
            setSessionState('SCAN_OLPN');
        }
    };

    const handlePalletSubmit = (e?: React.FormEvent, noPallet = false) => {
        e?.preventDefault();
        const pallet = noPallet ? '' : scannedPalletId;
        const palletMismatch = pallet.toUpperCase() !== (originalPalletId || '').toUpperCase();

        if (palletMismatch && !palletDiffConfirmed) {
            const expected = originalPalletId ? `"${originalPalletId}"` : "ningún pallet";
            const found = pallet ? `"${pallet}"` : "se indicó que no tiene pallet";
            setPalletMismatchDetails({ expected, found });
            setIsPalletModalOpen(true);
        } else {
            setSessionState('AUDITING');
        }
    };

    const handleConfirmPalletMismatch = () => {
        setPalletDiffConfirmed(true);
        setSessionState('AUDITING');
        setIsPalletModalOpen(false);
    };

    const handleCancelPalletMismatch = () => {
        setScannedPalletId('');
        palletInputRef.current?.focus();
        setIsPalletModalOpen(false);
    };

    const handleBarcodeScan = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = scannedBarcode.trim();
        if (!code) return;

        setAlertMessage(null);

        let foundItemId: string | null = null;
        let effectiveCache = itemCache; 

        for (const id in itemCache) {
            if (itemCache[id].codeMap.includes(code) || id === code) {
                foundItemId = id;
                break;
            }
        }
        
        if (!foundItemId) {
             try {
                 setAlertMessage({ type: 'warning', msg: "Item no está en OLPN. Buscando detalles..." });
                 const token = await googleSheetsService.getManhattanToken();
                 const resp = await googleSheetsService.searchManhattanItemByBarcode(token, code);
                 if (resp.success && resp.data.length > 0) {
                     const newCache = { ...itemCache };
                     updateCacheFromManhattanResponse(newCache, resp.data);
                     setItemCache(newCache);
                     effectiveCache = newCache;
                     foundItemId = String(resp.data[0].ItemId);
                 } else {
                     setAlertMessage({ type: 'error', msg: `El artículo con código "${code}" no existe en Manhattan.` });
                     setScannedBarcode('');
                     return;
                 }
             } catch (err) {
                 setAlertMessage({ type: 'error', msg: "No se pudo validar el item en Manhattan." });
                 return;
             }
        }

        const cached = effectiveCache[foundItemId!];
        const olpnLines = manhattanOlpnData.filter((d: any) => String(d.ItemId) === foundItemId);
        const totalManhattanQty = olpnLines.reduce((sum: number, line: any) => sum + (line.PackedQuantity || 0), 0);
        const expiry = olpnLines.length > 0 ? olpnLines[0].ExpirationDate : null;

        setCurrentAuditItem({
            id: foundItemId!,
            description: cached?.description || 'Desconocido',
            uomMap: cached?.uomMap || { UNIDAD: 1 },
            manhattanQty: totalManhattanQty,
            manhattanExpiry: expiry
        });
        
        setFormInputs({ boxes: '', packs: '', units: '', expiry: '' });
        setShowItemForm(true);
        setScannedBarcode('');
        setAlertMessage(null);
    };

    const confirmItemAudit = () => {
        if (!currentAuditItem) return;

        const boxes = parseInt(formInputs.boxes || '0');
        const packs = parseInt(formInputs.packs || '0');
        const units = parseInt(formInputs.units || '0');
        
        const uoms = currentAuditItem.uomMap;
        const currentInputQty = 
            (boxes * (uoms['CAJA'] || 0)) + 
            (packs * (uoms['PACK'] || 0)) + 
            (units * (uoms['UNIDAD'] || 1));

        const auditExpiry = formInputs.expiry;
        const manhattanExpiry = currentAuditItem.manhattanExpiry;

        const previouslyAuditedQty = auditLog.filter(l => l.itemId === currentAuditItem.id).reduce((sum, log) => sum + log.auditQty, 0);
        const totalAccumulatedQty = previouslyAuditedQty + currentInputQty;

        let diffType: ScannedItemData['diffType'] = 'Sin diferencias';
        let diffQty = 0;

        if (currentAuditItem.manhattanQty === 0) {
             diffType = 'Item no existente en la Olpn';
             diffQty = totalAccumulatedQty;
        } else if (totalAccumulatedQty > currentAuditItem.manhattanQty) {
             diffType = 'Sobrante en Olpn';
             diffQty = totalAccumulatedQty - currentAuditItem.manhattanQty;
        } else if (manhattanExpiry && auditExpiry && auditExpiry !== manhattanExpiry) {
             diffType = 'Fechas de vencimiento diferentes';
        }
        
        if (diffType !== 'Sin diferencias' && (!alertMessage || alertMessage.type !== 'warning')) {
             setAlertMessage({ type: 'warning', msg: `¡Atención! ${diffType}. Cantidad acumulada: ${totalAccumulatedQty} vs Esperada: ${currentAuditItem.manhattanQty}. Confirme para registrar.` });
             return;
        }

        const volStr = Object.entries(uoms).map(([u, q]) => `${u}: ${q}`).join(', ');
        const newLog: ScannedItemData = {
            itemId: currentAuditItem.id, description: currentAuditItem.description, auditQty: currentInputQty,
            enteredQuantities: { boxes, packs, units }, auditExpiry, manhattanQty: currentAuditItem.manhattanQty,
            manhattanExpiry: currentAuditItem.manhattanExpiry, diffType, diffQty, volumetrics: volStr
        };
        setAuditLog(prev => [...prev, newLog]);
        setShowItemForm(false);
        setCurrentAuditItem(null);
        setAlertMessage({ type: 'success', msg: "Item registrado correctamente." });
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
    };

    const prepareFinishAudit = () => {
        const allManhattanItems: Record<string, number> = manhattanOlpnData.reduce((acc: Record<string, number>, item: any) => {
            const id = String(item.ItemId);
            acc[id] = (acc[id] || 0) + (item.PackedQuantity || 0);
            return acc;
        }, {});
        
        const scannedTotals: Record<string, number> = auditLog.reduce((acc: Record<string, number>, log) => {
            acc[log.itemId] = (acc[log.itemId] || 0) + log.auditQty;
            return acc;
        }, {});

        const missing: {id: string, desc: string, missing: number, uomMap: { [key: string]: number }}[] = [];
        for(const id in allManhattanItems) {
            const totalExpected = allManhattanItems[id];
            const totalScanned = scannedTotals[id] || 0;
            if (totalScanned < totalExpected) {
                 const desc = itemCache[id]?.description || manhattanOlpnData.find(d => String(d.ItemId) === id)?.ItemDescription || 'Desconocido';
                 const uomMap = itemCache[id]?.uomMap || { UNIDAD: 1 };
                 missing.push({ id, desc, missing: totalExpected - totalScanned, uomMap });
            }
        }
        
        const allItemIds = Array.from(new Set([...Object.keys(allManhattanItems), ...Object.keys(scannedTotals)]));

        let totalExpectedUnits = 0;
        let totalAbsoluteQuantityDifference = 0;

        allItemIds.forEach(itemId => {
            const totalManhattanQty = allManhattanItems[itemId] || 0;
            const totalAuditQty = scannedTotals[itemId] || 0;
            const diffQty = totalAuditQty - totalManhattanQty;

            const manhattanLines = manhattanOlpnData.filter(d => String(d.ItemId) === itemId);
            const manhattanExpiry = manhattanLines.length > 0 ? manhattanLines[0].ExpirationDate : '';
            const itemLogs = auditLog.filter(l => l.itemId === itemId);
            const auditExpiry = itemLogs.find(l => l.auditExpiry)?.auditExpiry || '';

            let diffType: AuditRecord['TipoDiferencia'] = 'Sin diferencias';
            if (diffQty > 0) diffType = totalManhattanQty === 0 ? 'Item no existente en la Olpn' : 'Sobrante en Olpn';
            else if (diffQty < 0) diffType = 'Faltante en Olpn';
            else if (manhattanExpiry && auditExpiry && manhattanExpiry !== auditExpiry) diffType = 'Fechas de vencimiento diferentes';

            totalExpectedUnits += totalManhattanQty;
            if (diffType !== 'Fechas de vencimiento diferentes') {
                totalAbsoluteQuantityDifference += Math.abs(diffQty);
            }
        });

        const qualityPercentage = totalExpectedUnits > 0 
            ? parseFloat(Math.max(0, (1 - (totalAbsoluteQuantityDifference / totalExpectedUnits)) * 100).toFixed(2)) 
            : (totalAbsoluteQuantityDifference === 0 ? 100 : 0);
        
        setFinalQuality(qualityPercentage);
        setMissingItemsSummary(missing);
        setIsFinishModalOpen(true);
    };

    const confirmFinishAudit = async () => {
        setIsFinishModalOpen(false);
        setSessionState('FINISHING');

        const auditId = `AUD-${Date.now()}`;
        const now = new Date().toISOString();
        const allItemIds = Array.from(new Set([...manhattanOlpnData.map(d => String(d.ItemId)), ...auditLog.map(l => l.itemId)]));
        
        let hasAnyDiff = false;
        
        const intermediateRecords = allItemIds.map(itemId => {
            const manhattanLines = manhattanOlpnData.filter(d => String(d.ItemId) === itemId);
            const totalManhattanQty = manhattanLines.reduce((sum, l) => sum + (l.PackedQuantity || 0), 0);
            const manhattanExpiry = manhattanLines.length > 0 ? manhattanLines[0].ExpirationDate : '';
            const itemLogs = auditLog.filter(l => l.itemId === itemId);
            const totalAuditQty = itemLogs.reduce((sum, l) => sum + l.auditQty, 0);
            const auditExpiry = itemLogs.find(l => l.auditExpiry)?.auditExpiry || '';
            const diffQty = totalAuditQty - totalManhattanQty;
            let diffType: AuditRecord['TipoDiferencia'] = 'Sin diferencias';
            
            if (diffQty > 0) diffType = totalManhattanQty === 0 ? 'Item no existente en la Olpn' : 'Sobrante en Olpn';
            else if (diffQty < 0) diffType = 'Faltante en Olpn';
            else if (manhattanExpiry && auditExpiry && manhattanExpiry !== auditExpiry) diffType = 'Fechas de vencimiento diferentes';
            
            if (diffType !== 'Sin diferencias') hasAnyDiff = true;

            const totalBoxes = itemLogs.reduce((sum, l) => sum + l.enteredQuantities.boxes, 0);
            const totalPacks = itemLogs.reduce((sum, l) => sum + l.enteredQuantities.packs, 0);
            const totalUnits = itemLogs.reduce((sum, l) => sum + l.enteredQuantities.units, 0);

            return { itemId, totalManhattanQty, totalAuditQty, manhattanExpiry, auditExpiry, diffQty, diffType, enteredQuantities: { boxes: totalBoxes, packs: totalPacks, units: totalUnits }};
        });

        let totalExpectedUnits = 0;
        let totalAbsoluteQuantityDifference = 0;
        intermediateRecords.forEach(r => {
            totalExpectedUnits += r.totalManhattanQty;
            if(r.diffType !== 'Fechas de vencimiento diferentes') totalAbsoluteQuantityDifference += Math.abs(r.diffQty);
        });
        const qualityPercentage = totalExpectedUnits > 0 ? parseFloat(Math.max(0, (1 - (totalAbsoluteQuantityDifference / totalExpectedUnits)) * 100).toFixed(2)) : (totalAbsoluteQuantityDifference === 0 ? 100 : 0);
        
        const finalStatus = hasAnyDiff ? 'Olpn con diferencias' : 'Olpn sin diferencias';
        const records: AuditRecord[] = intermediateRecords.map(data => {
            const uoms = itemCache[data.itemId]?.uomMap || { UNIDAD: 1 };
            const description = itemCache[data.itemId]?.description || "Desconocido";
            // Correct object property order to match sheet columns
            return {
                IdInternoAuditoria: auditId,
                FechaHoraAuditoria: now,
                Sector: sector,
                Usuario: currentUser?.name || 'Unknown',
                EstadoAuditoria: finalStatus,
                Item: data.itemId,
                Descripcion: description,
                CantidadManhattan: data.totalManhattanQty,
                CantidadAuditada: data.totalAuditQty,
                FechaVtoManhattan: data.manhattanExpiry,
                FechaVtoAuditada: data.auditExpiry,
                Diferencia: data.diffQty,
                TipoDiferencia: data.diffType,
                Recuento: isRecount ? 'SI' : 'NO',
                OlpnId: olpnId,
                Local: olpnMetadata?.facilityId || '',
                Ubicacion: olpnMetadata?.locationId || '',
                PalletIdOriginal: originalPalletId || '',
                PalletIdAuditado: sector === 'BAS' ? scannedPalletId : (originalPalletId || ''),
                DiferenciaPallet: palletDiffConfirmed ? 'SI' : 'NO',
                PorcentajeCalidad: qualityPercentage,
                DetalleOriginal: getBreakdownString(data.totalManhattanQty, uoms),
                DetalleAuditado: getBreakdownString(data.totalAuditQty, uoms),
                DetalleDiferencia: getBreakdownString(data.diffQty, uoms),
                RawOriginal: JSON.stringify(getBreakdownObj(data.totalManhattanQty, uoms)),
                RawAuditado: JSON.stringify(data.enteredQuantities),
                RawDiferencia: JSON.stringify(getBreakdownObj(data.diffQty, uoms)),
            };
        });

        try {
            await googleSheetsService.saveAuditRecords(records);
            navigate('/quality/audits', { state: { sector } });
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', msg: "Error al guardar la auditoría. Intente nuevamente." });
            setSessionState('AUDITING');
        }
    };
    
    const handleExitAttempt = () => {
        if (auditLog.length > 0) {
            setIsExitModalOpen(true);
        } else {
            navigate('/quality/audits', { state: { sector } });
        }
    };

    const isConfirmingDifference = alertMessage?.type === 'warning';
    const hasLogDiffs = auditLog.some(l => l.diffType !== 'Sin diferencias');

    return (
        <div className="flex flex-col h-full bg-zinc-900">
             <ReauditConfirmationModal isOpen={isReauditModalOpen} onClose={() => { setIsReauditModalOpen(false); setSessionState('SCAN_OLPN'); setOlpnId(''); }} onConfirm={() => { setIsReauditModalOpen(false); continueOlpnFetch(); }} auditorName={previousAuditor} />
             <PalletConfirmationModal isOpen={isPalletModalOpen} onClose={handleCancelPalletMismatch} onConfirm={handleConfirmPalletMismatch} expected={palletMismatchDetails.expected} found={palletMismatchDetails.found} />
             <AuditSummaryModal isOpen={isFinishModalOpen} onClose={() => setIsFinishModalOpen(false)} onConfirm={confirmFinishAudit} missingItems={missingItemsSummary} hasDiffs={hasLogDiffs} quality={finalQuality} />
             <ExitConfirmationModal isOpen={isExitModalOpen} onClose={() => setIsExitModalOpen(false)} onConfirm={() => { setIsExitModalOpen(false); navigate('/quality/audits', { state: { sector } }); }} />

             <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-700 shadow-md">
                 <div className="p-4 sm:p-6 flex justify-between items-center gap-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-white truncate">Auditoría de Olpn</h1>
                    <div className="flex gap-2">
                        {sessionState === 'AUDITING' && <button onClick={prepareFinishAudit} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm transition-colors shadow-lg"><CheckCircleIcon className="w-5 h-5"/><span className="hidden sm:inline">Finalizar</span></button>}
                        <button onClick={handleExitAttempt} className="text-zinc-400 hover:text-white px-3 py-2 rounded border border-zinc-600 hover:bg-zinc-700 text-sm transition-colors">Salir</button>
                    </div>
                </div>
                {sessionState !== 'SCAN_OLPN' && (
                    <div className="bg-zinc-800 px-4 py-2 border-t border-zinc-700 flex justify-between items-center">
                        <div><span className="text-xs text-zinc-500 font-bold uppercase">OLPN:</span><span className="ml-2 text-sm font-mono font-bold text-sky-400">{olpnId}</span></div>
                        <div><span className="text-xs text-zinc-500 font-bold uppercase">Sector:</span><span className="ml-2 text-sm font-mono font-bold text-sky-400">{sector}</span></div>
                    </div>
                )}
             </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {alertMessage && (
                    <div className={`p-4 mb-6 rounded-lg border flex items-center gap-3 animate-fade-in-down ${alertMessage.type === 'error' ? 'bg-red-900/30 border-red-600 text-red-200' : alertMessage.type === 'warning' ? 'bg-amber-900/30 border-amber-500 text-amber-200' : 'bg-green-900/30 border-green-600 text-green-200'}`}>
                        {alertMessage.type === 'warning' ? <XCircleIcon className="w-6 h-6 flex-shrink-0" /> : <CheckCircleIcon className="w-6 h-6 flex-shrink-0" />}
                        <div><p className="font-bold">{alertMessage.type === 'error' ? 'Error' : alertMessage.type === 'warning' ? 'Atención' : 'Éxito'}</p><p className="text-sm">{alertMessage.msg}</p></div>
                    </div>
                )}

                {sessionState === 'SCAN_OLPN' && (
                    <div className="flex flex-col items-center justify-center py-12"><div className="bg-zinc-800 p-8 rounded-xl shadow-lg w-full max-w-lg text-center"><h2 className="text-2xl font-bold text-white mb-4">Escanear OLPN</h2><form onSubmit={handleOlpnSubmit}><input ref={olpnInputRef} type="text" value={olpnId} onChange={e => setOlpnId(e.target.value.toUpperCase())} placeholder="Escanee el código del OLPN" className="w-full text-center text-xl bg-zinc-900 border-2 border-zinc-600 rounded-lg py-4 focus:border-sky-500 focus:ring-sky-500 mb-6" autoFocus /><button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 rounded-lg text-lg transition-colors">Comenzar Auditoría</button></form></div></div>
                )}
                 {sessionState === 'SCAN_PALLET' && (
                    <div className="flex flex-col items-center justify-center py-12"><div className="bg-zinc-800 p-8 rounded-xl shadow-lg w-full max-w-lg text-center"><h2 className="text-2xl font-bold text-white mb-2">Paso 2: Escanear Pallet (Sector BAS)</h2><p className="text-zinc-400 mb-6">Escanee el pallet que contiene el OLPN <span className="font-mono text-sky-400">{olpnId}</span>.</p><form onSubmit={handlePalletSubmit}><input ref={palletInputRef} type="text" value={scannedPalletId} onChange={e => setScannedPalletId(e.target.value.toUpperCase())} placeholder="Escanee el código del Pallet" className="w-full text-center text-xl bg-zinc-900 border-2 border-zinc-600 rounded-lg py-4 focus:border-sky-500 focus:ring-sky-500 mb-4" autoFocus /><button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 rounded-lg text-lg transition-colors mb-4">Continuar</button><button type="button" onClick={() => handlePalletSubmit(undefined, true)} className="w-full bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-3 rounded-lg text-base transition-colors">El OLPN no está palletizado</button></form></div></div>
                )}
                {sessionState === 'FETCHING_DATA' && (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-400"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-sky-500 mb-4"></div><p className="text-xl">Obteniendo datos de Manhattan...</p></div>
                )}
                {sessionState === 'FINISHING' && (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-400"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-sky-500 mb-4"></div><p className="text-xl">Guardando y finalizando auditoría...</p></div>
                )}
                {sessionState === 'AUDITING' && (
                    <div className="flex flex-col gap-6">
                        {!showItemForm ? (
                            <div className="bg-zinc-800 p-8 rounded-xl shadow-lg border border-zinc-700 text-center"><h3 className="text-xl font-bold text-white mb-6">Escanear Item</h3><form onSubmit={handleBarcodeScan}><div className="relative max-w-md mx-auto"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><BarcodeIcon className="h-6 w-6 text-zinc-400" /></div><input ref={barcodeInputRef} type="text" value={scannedBarcode} onChange={e => setScannedBarcode(e.target.value)} placeholder="Escanee código de barras" className="w-full pl-12 text-center text-lg bg-zinc-900 border border-zinc-600 rounded-lg py-3 focus:border-green-500 focus:ring-green-500" /></div></form><p className="text-zinc-500 text-sm mt-4">Escanee para añadir items o corregir cantidades.</p></div>
                        ) : (
                            <div className="bg-zinc-800 p-6 rounded-xl shadow-lg border border-zinc-600 max-w-2xl mx-auto w-full animate-fade-in">
                                <h3 className="text-xl font-bold text-white mb-1">{currentAuditItem?.description}</h3>
                                <div className="flex justify-between items-baseline mb-4">
                                    <p className="text-sm text-zinc-400 font-mono">{currentAuditItem?.id}</p>
                                    <div className="flex gap-2 text-xs text-zinc-400">
                                        {currentAuditItem?.uomMap && Object.entries(currentAuditItem.uomMap).map(([uom, qty]) => (<span key={uom} className="bg-zinc-700 px-2 py-1 rounded border border-zinc-600">{uom}: {qty}</span>))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div><label className="block text-xs font-bold text-zinc-400 mb-1">Fecha Vto.</label><input type="date" value={formInputs.expiry} onChange={e => setFormInputs({...formInputs, expiry: e.target.value})} className="w-full bg-zinc-700 border border-zinc-500 rounded p-2 text-white disabled:bg-zinc-800 disabled:text-zinc-500" disabled={isConfirmingDifference} /></div>
                                    <div><label className="block text-xs font-bold text-zinc-400 mb-1">Cajas</label><input type="number" value={formInputs.boxes} onChange={e => setFormInputs({...formInputs, boxes: e.target.value})} className="w-full bg-zinc-700 border border-zinc-500 rounded p-2 text-white disabled:bg-zinc-800 disabled:text-zinc-500" placeholder="0" disabled={isConfirmingDifference} /></div>
                                    <div><label className="block text-xs font-bold text-zinc-400 mb-1">Packs</label><input type="number" value={formInputs.packs} onChange={e => setFormInputs({...formInputs, packs: e.target.value})} className="w-full bg-zinc-700 border border-zinc-500 rounded p-2 text-white disabled:bg-zinc-800 disabled:text-zinc-500" placeholder="0" disabled={isConfirmingDifference} /></div>
                                    <div><label className="block text-xs font-bold text-zinc-400 mb-1">Unidades Sueltas</label><input type="number" value={formInputs.units} onChange={e => setFormInputs({...formInputs, units: e.target.value})} className="w-full bg-zinc-700 border border-zinc-500 rounded p-2 text-white disabled:bg-zinc-800 disabled:text-zinc-500" placeholder="0" disabled={isConfirmingDifference} /></div>
                                </div>

                                <div className="flex gap-4 justify-end">
                                    <button onClick={() => { setShowItemForm(false); setAlertMessage(null); setScannedBarcode(''); }} className="bg-zinc-600 hover:bg-zinc-500 text-white px-4 py-2 rounded">Cancelar</button>
                                    <button onClick={confirmItemAudit} className={`px-6 py-2 rounded font-bold text-white transition-colors ${alertMessage?.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}>{alertMessage?.type === 'warning' ? 'Confirmar Diferencia' : 'Confirmar'}</button>
                                </div>
                            </div>
                        )}

                        <div className="mt-4 pb-20"><h4 className="text-sm font-bold text-zinc-500 uppercase mb-2">Items Auditados ({auditLog.length})</h4><div className="space-y-2">
                            {[...auditLog].reverse().map((log, idx) => (
                                <div key={idx} className={`p-3 rounded border flex justify-between items-center ${log.diffType === 'Sin diferencias' ? 'bg-zinc-800 border-zinc-700' : 'bg-red-900/20 border-red-800'}`}>
                                    <div>
                                        <p className="text-sm font-bold text-zinc-200">{log.description}</p>
                                        <p className="text-xs text-zinc-500">{log.itemId}</p>
                                        {log.volumetrics && <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{log.volumetrics}</p>}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-mono text-white">
                                            {log.enteredQuantities.boxes > 0 && <span className="mr-1">{log.enteredQuantities.boxes} Cj</span>}
                                            {log.enteredQuantities.packs > 0 && <span className="mr-1">{log.enteredQuantities.packs} Pk</span>}
                                            {log.enteredQuantities.units > 0 && <span className="mr-1">{log.enteredQuantities.units} Un</span>}
                                            {(log.enteredQuantities.boxes === 0 && log.enteredQuantities.packs === 0 && log.enteredQuantities.units === 0) && <span>0 Un</span>}
                                        </div>
                                        {log.auditExpiry && <p className="text-xs text-zinc-400 mt-0.5">Vto: {formatDateDisplay(log.auditExpiry)}</p>}
                                        {log.diffType !== 'Sin diferencias' && (<p className="text-xs text-red-400 mt-0.5">{log.diffType}</p>)}
                                    </div>
                                </div>
                            ))}
                        </div></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActiveAuditSession;
