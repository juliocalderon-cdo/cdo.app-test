
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../hooks/useAuth';
import { sheets } from '../services/googleSheetsService';
import { LocationAuditRecord, UserRole } from '../types';
import { ClipboardListIcon, SearchIcon, CheckCircleIcon, AlertTriangleIcon, ArrowLeftIcon, ScanIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

const LocationAuditSession: React.FC = () => {
    const { currentUser } = useAuthContext();
    const navigate = useNavigate();
    const [step, setStep] = useState<'location-scan' | 'container-scan' | 'summary'>('location-scan');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Location Info
    const [locationBarcode, setLocationBarcode] = useState('');
    const [locationId, setLocationId] = useState<string | null>(null);
    const [manhattanContainers, setManhattanContainers] = useState<{ id: string, type: 'ILPN' | 'OLPN' }[]>([]);
    
    // Scanning Info
    const [scannedBarcode, setScannedBarcode] = useState('');
    const [scannedContainers, setScannedContainers] = useState<{ id: string, type: 'ILPN' | 'OLPN' | 'N/A' }[]>([]);
    
    // Alerts and Modals
    const [alert, setAlert] = useState<{
        title: string;
        message: string;
        type: 'warning' | 'error' | 'info';
        onAccept: () => void;
        onCancel?: () => void;
    } | null>(null);
    
    // Re-audit alert
    const [showReauditAlert, setShowReauditAlert] = useState(false);
    const [lastAuditor, setLastAuditor] = useState<string | null>(null);

    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const containerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (step === 'location-scan' && barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        } else if (step === 'container-scan' && containerInputRef.current) {
            containerInputRef.current.focus();
        }
    }, [step]);

    const handleLocationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!locationBarcode.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const token = await sheets.getManhattanToken();
            if (!token) throw new Error('Error al obtener token de Manhattan');

            // 1. Search Location ID
            const locId = await sheets.searchManhattanLocation(token, locationBarcode);
            if (!locId) {
                throw new Error('Ubicación no encontrada en Manhattan');
            }
            setLocationId(locId);

            // 2. Check if audited today
            const today = new Date().toISOString().split('T')[0];
            const previousRecords = await sheets.getLocationAuditRecords({ 
                startDate: today, 
                endDate: today,
                location: locId 
            });

            if (previousRecords.length > 0 && !showReauditAlert) {
                setLastAuditor(previousRecords[0].Usuario);
                setShowReauditAlert(true);
                setLoading(false);
                return;
            }

            // 3. Search Containers
            const [ilpns, olpns] = await Promise.all([
                sheets.searchManhattanIlpnsInLocation(token, locId),
                sheets.searchManhattanOlpnsInLocation(token, locId)
            ]);

            const combined = [
                ...ilpns.map((id: string) => ({ id, type: 'ILPN' as const })),
                ...olpns.map((id: string) => ({ id, type: 'OLPN' as const }))
            ];

            setManhattanContainers(combined);
            setStep('container-scan');
            setShowReauditAlert(false);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Error al procesar la ubicación';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleContainerScan = (e: React.FormEvent) => {
        e.preventDefault();
        const barcode = scannedBarcode.trim();
        if (!barcode) return;

        // Check if already scanned
        if (scannedContainers.some(c => c.id === barcode)) {
            setAlert({
                title: 'Contenedor ya escaneado',
                message: `El usuario ya escaneó ese OLPN: ${barcode}`,
                type: 'warning',
                onAccept: () => setAlert(null)
            });
            setScannedBarcode('');
            return;
        }

        // Determine type
        const manhattanMatch = manhattanContainers.find(c => c.id === barcode);
        const type = manhattanMatch ? manhattanMatch.type : (barcode.startsWith('OLPN') ? 'OLPN' : 'ILPN');

        // If not in Manhattan, show alert
        if (!manhattanMatch) {
            setAlert({
                title: 'Contenedor no encontrado',
                message: `El contenedor ${barcode} no está registrado en esta ubicación en Manhattan.`,
                type: 'error',
                onAccept: () => {
                    setScannedContainers(prev => [...prev, { id: barcode, type }]);
                    setAlert(null);
                }
            });
        } else {
            setScannedContainers(prev => [...prev, { id: barcode, type }]);
        }
        
        setScannedBarcode('');
    };

    const handleFinalizeClick = () => {
        setAlert({
            title: '¿Finalizar Auditoría?',
            message: '¿Está seguro de que desea finalizar y registrar los resultados de esta auditoría?',
            type: 'info',
            onAccept: () => {
                setAlert(null);
                finalizeAudit();
            },
            onCancel: () => setAlert(null)
        });
    };

    const handleCancelClick = () => {
        setAlert({
            title: '¿Cancelar Auditoría?',
            message: 'Se perderán todos los datos escaneados. ¿Desea continuar?',
            type: 'warning',
            onAccept: () => {
                setAlert(null);
                resetAudit();
            },
            onCancel: () => setAlert(null)
        });
    };

    const finalizeAudit = async () => {
        setLoading(true);
        setError(null);

        try {
            const auditId = `AUD-LOC-${Date.now()}`;
            const now = new Date().toISOString();
            const userName = currentUser?.name || 'Usuario Desconocido';
            const local = 'CDO'; // Default or from config if available

            const records: LocationAuditRecord[] = [];
            
            // 1. Find Faltantes (In Manhattan but not scanned)
            manhattanContainers.forEach(m => {
                const scanned = scannedContainers.find(s => s.id === m.id);
                if (!scanned) {
                    records.push({
                        IdInternoAuditoria: auditId,
                        FechaHoraAuditoria: now,
                        Usuario: userName,
                        EstadoAuditoria: 'Con diferencias',
                        UbicacionAuditada: locationId || locationBarcode,
                        ContenedorManhattan: m.id,
                        TipoContenedorManhattan: m.type,
                        ContenedorAuditado: '',
                        TipoContenedorAuditado: 'N/A',
                        Local: local,
                        TipoDiferencia: 'Faltante'
                    });
                }
            });

            // 2. Find Sobrantes (Scanned but not in Manhattan)
            scannedContainers.forEach(s => {
                const inManhattan = manhattanContainers.find(m => m.id === s.id);
                if (!inManhattan) {
                    records.push({
                        IdInternoAuditoria: auditId,
                        FechaHoraAuditoria: now,
                        Usuario: userName,
                        EstadoAuditoria: 'Con diferencias',
                        UbicacionAuditada: locationId || locationBarcode,
                        ContenedorManhattan: '',
                        TipoContenedorManhattan: 'N/A',
                        ContenedorAuditado: s.id,
                        TipoContenedorAuditado: s.type,
                        Local: local,
                        TipoDiferencia: 'Sobrante'
                    });
                }
            });

            // 3. Find Matches (Sin diferencias)
            scannedContainers.forEach(s => {
                const inManhattan = manhattanContainers.find(m => m.id === s.id);
                if (inManhattan) {
                    records.push({
                        IdInternoAuditoria: auditId,
                        FechaHoraAuditoria: now,
                        Usuario: userName,
                        EstadoAuditoria: records.length > 0 ? 'Con diferencias' : 'Sin diferencias',
                        UbicacionAuditada: locationId || locationBarcode,
                        ContenedorManhattan: inManhattan.id,
                        TipoContenedorManhattan: inManhattan.type,
                        ContenedorAuditado: s.id,
                        TipoContenedorAuditado: s.type,
                        Local: local,
                        TipoDiferencia: 'Sin diferencias'
                    });
                }
            });

            // If no records (empty location and nothing scanned), create one record to mark it as audited
            if (records.length === 0) {
                records.push({
                    IdInternoAuditoria: auditId,
                    FechaHoraAuditoria: now,
                    Usuario: userName,
                    EstadoAuditoria: 'Sin diferencias',
                    UbicacionAuditada: locationId || locationBarcode,
                    ContenedorManhattan: 'N/A',
                    TipoContenedorManhattan: 'N/A',
                    ContenedorAuditado: 'N/A',
                    TipoContenedorAuditado: 'N/A',
                    Local: local,
                    TipoDiferencia: 'Sin diferencias'
                });
            }

            // Update EstadoAuditoria for all records if any difference was found
            const hasDifferences = records.some(r => r.TipoDiferencia !== 'Sin diferencias');
            records.forEach(r => {
                r.EstadoAuditoria = hasDifferences ? 'Con diferencias' : 'Sin diferencias';
            });

            await sheets.saveLocationAuditRecords(records);
            setStep('summary');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Error al guardar la auditoría';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const resetAudit = () => {
        setStep('location-scan');
        setLocationBarcode('');
        setLocationId(null);
        setManhattanContainers([]);
        setScannedContainers([]);
        setScannedBarcode('');
        setError(null);
        setShowReauditAlert(false);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/')}
                            className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                        >
                            <ArrowLeftIcon className="h-6 w-6 text-zinc-400" />
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold">Auditoría de Ubicaciones</h1>
                            <p className="text-zinc-400 text-xs sm:text-sm">Validación de inventario en tiempo real</p>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* Step 1: Location Scan */}
                    {step === 'location-scan' && (
                        <motion.div 
                            key="step1"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl"
                        >
                            <div className="flex flex-col items-center text-center mb-8">
                                <div className="h-20 w-20 bg-sky-900/20 rounded-full flex items-center justify-center mb-6">
                                    <ScanIcon className="h-10 w-10 text-sky-400" />
                                </div>
                                <h2 className="text-xl font-semibold mb-2">Escanee la Ubicación</h2>
                                <p className="text-zinc-400 max-w-md">
                                    Ingrese o escanee el código de barras de la ubicación que desea auditar.
                                </p>
                            </div>

                            <form onSubmit={handleLocationSubmit} className="max-w-md mx-auto">
                                <div className="relative mb-6">
                                    <input
                                        ref={barcodeInputRef}
                                        type="text"
                                        value={locationBarcode}
                                        onChange={(e) => setLocationBarcode(e.target.value.toUpperCase())}
                                        placeholder="CÓDIGO DE UBICACIÓN"
                                        className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-xl px-6 py-4 text-2xl font-mono text-center tracking-widest focus:border-sky-500 focus:outline-none transition-colors"
                                        disabled={loading}
                                    />
                                    <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-zinc-500" />
                                </div>

                                {error && (
                                    <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-xl mb-6 flex items-start gap-3">
                                        <AlertTriangleIcon className="h-5 w-5 shrink-0 mt-0.5" />
                                        <p className="text-sm">{error}</p>
                                    </div>
                                )}

                                {showReauditAlert && (
                                    <div className="bg-amber-900/20 border border-amber-500/50 text-amber-400 p-6 rounded-xl mb-6">
                                        <div className="flex items-start gap-3 mb-4">
                                            <AlertTriangleIcon className="h-6 w-6 shrink-0" />
                                            <div>
                                                <h3 className="font-bold">Ubicación ya auditada hoy</h3>
                                                <p className="text-sm opacity-90">
                                                    Esta ubicación fue auditada hoy por: <span className="font-bold underline">{lastAuditor}</span>.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowReauditAlert(false);
                                                    handleLocationSubmit({ preventDefault: () => {} } as any);
                                                }}
                                                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg transition-colors"
                                            >
                                                Auditar de nuevo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowReauditAlert(false)}
                                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2 rounded-lg transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !locationBarcode.trim()}
                                    className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>Continuar</>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* Step 2: Container Scan */}
                    {step === 'container-scan' && (
                        <motion.div 
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                        >
                            {/* Left Column: Scanning Input */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-bold text-sky-400 mb-1">Ubicación: {locationId || locationBarcode}</h3>
                                        <p className="text-xs text-zinc-500 font-mono">Código escaneado: {locationBarcode}</p>
                                    </div>

                                    <form onSubmit={handleContainerScan} className="mb-6">
                                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Escanee Contenedor</label>
                                        <div className="relative">
                                            <input
                                                ref={containerInputRef}
                                                type="text"
                                                value={scannedBarcode}
                                                onChange={(e) => setScannedBarcode(e.target.value.toUpperCase())}
                                                placeholder="ILPN / OLPN"
                                                className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-xl px-4 py-3 font-mono text-lg focus:border-sky-500 focus:outline-none transition-colors"
                                                disabled={loading}
                                            />
                                            <ScanIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                        </div>
                                    </form>

                                    <div className="space-y-3">
                                        <button
                                            onClick={handleFinalizeClick}
                                            disabled={loading}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                                        >
                                            {loading ? (
                                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>Finalizar Auditoría</>
                                            )}
                                        </button>
                                        <button
                                            onClick={handleCancelClick}
                                            disabled={loading}
                                            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-3 rounded-xl transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
 
                                {/* Stats Card */}
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Resumen de Escaneo</h4>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50 flex justify-between items-center">
                                            <p className="text-xs text-zinc-500">Escaneados</p>
                                            <p className="text-2xl font-bold text-sky-400">{scannedContainers.length}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Scanned List */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-[400px] lg:h-[500px]">
                                    <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                                        <h3 className="font-bold flex items-center gap-2 text-sm sm:text-base">
                                            <ClipboardListIcon className="h-5 w-5 text-sky-400" />
                                            Contenedores Escaneados
                                        </h3>
                                        <span className="text-xs font-mono text-zinc-500">
                                            Total: {scannedContainers.length}
                                        </span>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                        {scannedContainers.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50">
                                                <ScanIcon className="h-12 w-12 mb-4" />
                                                <p>No hay contenedores escaneados aún</p>
                                            </div>
                                        ) : (
                                            [...scannedContainers].reverse().map((container, idx) => {
                                                const isExpected = manhattanContainers.some(m => m.id === container.id);
                                                return (
                                                    <motion.div 
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        key={container.id}
                                                        className={`flex items-center justify-between p-4 rounded-xl border ${
                                                            isExpected 
                                                            ? 'bg-zinc-800/30 border-zinc-700/50' 
                                                            : 'bg-amber-900/10 border-amber-500/30'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                                                isExpected ? 'bg-sky-900/20 text-sky-400' : 'bg-amber-900/20 text-amber-400'
                                                            }`}>
                                                                <ScanIcon className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="font-mono font-bold text-zinc-200">{container.id}</p>
                                                                <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">{container.type}</p>
                                                            </div>
                                                        </div>
                                                        {!isExpected && (
                                                            <div className="flex items-center gap-1 text-amber-500 text-[10px] font-bold uppercase">
                                                                <AlertTriangleIcon className="h-3 w-3" />
                                                                No en Manhattan
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Summary */}
                    {step === 'summary' && (
                        <motion.div 
                            key="summary"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-10 shadow-2xl text-center"
                        >
                            <div className="h-16 w-16 sm:h-20 sm:w-20 bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircleIcon className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-400" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Auditoría Finalizada</h2>
                            <p className="text-zinc-400 text-sm sm:text-base mb-6 max-w-md mx-auto">
                                Los resultados de la auditoría para la ubicación <span className="text-white font-bold">{locationId || locationBarcode}</span> han sido registrados correctamente.
                            </p>
 
                            <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-8 max-w-2xl mx-auto">
                                <div className="bg-zinc-800/50 p-3 sm:p-4 rounded-xl border border-zinc-700/50">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Manhattan</p>
                                    <p className="text-xl sm:text-2xl font-bold text-white">{manhattanContainers.length}</p>
                                </div>
                                <div className="bg-zinc-800/50 p-3 sm:p-4 rounded-xl border border-zinc-700/50">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Escaneados</p>
                                    <p className="text-xl sm:text-2xl font-bold text-sky-400">{scannedContainers.length}</p>
                                </div>
                                <div className="bg-zinc-800/50 p-3 sm:p-4 rounded-xl border border-zinc-700/50">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Diferencias</p>
                                    <p className={`text-xl sm:text-2xl font-bold ${
                                        manhattanContainers.length === scannedContainers.length && 
                                        scannedContainers.every(s => manhattanContainers.some(m => m.id === s.id))
                                        ? 'text-emerald-400' : 'text-amber-400'
                                    }`}>
                                        {Math.abs(manhattanContainers.length - scannedContainers.length) + 
                                         scannedContainers.filter(s => !manhattanContainers.some(m => m.id === s.id)).length}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button
                                    onClick={resetAudit}
                                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-sky-900/20"
                                >
                                    Nueva Auditoría
                                </button>
                                <button
                                    onClick={() => navigate('/')}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-8 py-4 rounded-xl transition-colors"
                                >
                                    Volver al Inicio
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
 
                {/* Global Alert Modal */}
                <AnimatePresence>
                    {alert && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-lg ${
                                        alert.type === 'error' ? 'bg-red-900/20 text-red-400' :
                                        alert.type === 'warning' ? 'bg-amber-900/20 text-amber-400' :
                                        'bg-sky-900/20 text-sky-400'
                                    }`}>
                                        <AlertTriangleIcon className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-lg font-bold">{alert.title}</h3>
                                </div>
                                <p className="text-zinc-400 mb-8">{alert.message}</p>
                                <div className="flex gap-3">
                                    {alert.onCancel && (
                                        <button
                                            onClick={alert.onCancel}
                                            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                    <button
                                        onClick={alert.onAccept}
                                        className={`flex-1 font-bold py-3 rounded-xl transition-colors ${
                                            alert.type === 'error' ? 'bg-red-600 hover:bg-red-500 text-white' :
                                            alert.type === 'warning' ? 'bg-amber-600 hover:bg-amber-500 text-white' :
                                            'bg-sky-600 hover:bg-sky-500 text-white'
                                        }`}
                                    >
                                        Aceptar
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default LocationAuditSession;
