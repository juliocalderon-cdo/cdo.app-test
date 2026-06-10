import React, { useState, useEffect, useCallback } from 'react';
import { sheets as googleSheetsService, ManhattanApiFailure } from '../services/googleSheetsService';
import { ManhattanShipment } from '../types';
import { useAuthContext } from '../hooks/useAuth';
import { RefreshIcon, TruckIcon, UploadIcon, DownloadIcon, EyeIcon, CheckCircleIcon, XCircleIcon } from './Icons';
import { utils, writeFileXLSX } from 'xlsx';
import { exportManhattanShipmentsToExcel } from '../services/excelGenerator';

// --- START: MODAL COMPONENTS ---

const ProcessingModal: React.FC = () => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col justify-center items-center z-50 p-4">
        <div className="w-full max-w-md text-center">
            <svg className="animate-spin h-12 w-12 text-sky-500 mx-auto" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h3 className="text-xl font-bold text-white mt-4">Procesando</h3>
            <p className="text-zinc-300 mb-6">Creando envíos y citas. Esto puede tardar unos segundos.</p>
            {/* Progress bar */}
            <div className="w-full bg-zinc-700 rounded-full h-4 overflow-hidden relative">
                 <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-sky-600 to-sky-400 w-full animate-indeterminate-progress"></div>
            </div>
            <style>{`
                @keyframes indeterminate-progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-indeterminate-progress {
                    animation: indeterminate-progress 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    </div>
);

interface ProcessResult {
    shipments: { success: number; failures: ManhattanApiFailure[] };
    appointments: { success: number; failures: ManhattanApiFailure[] };
}

const ResultsModal: React.FC<{ result: ProcessResult; onClose: () => void }> = ({ result, onClose }) => {
    const totalSuccess = result.shipments.success + result.appointments.success;
    const totalFailures = result.shipments.failures.length + result.appointments.failures.length;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-zinc-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Resultados de la Carga</h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        <div className={`p-4 rounded-lg flex items-center gap-4 ${totalSuccess > 0 ? 'bg-green-900/50' : 'bg-zinc-700/50'}`}>
                            <CheckCircleIcon className={`w-8 h-8 flex-shrink-0 ${totalSuccess > 0 ? 'text-green-400' : 'text-zinc-500'}`} />
                            <div>
                                <p className="text-2xl font-bold text-white">{totalSuccess}</p>
                                <p className="text-sm text-zinc-300">Operaciones Exitosas</p>
                            </div>
                        </div>
                         <div className={`p-4 rounded-lg flex items-center gap-4 ${totalFailures > 0 ? 'bg-red-900/50' : 'bg-zinc-700/50'}`}>
                            <XCircleIcon className={`w-8 h-8 flex-shrink-0 ${totalFailures > 0 ? 'text-red-400' : 'text-zinc-500'}`} />
                            <div>
                                <p className="text-2xl font-bold text-white">{totalFailures}</p>
                                <p className="text-sm text-zinc-300">Operaciones Fallidas</p>
                            </div>
                        </div>
                    </div>

                    {(result.shipments.failures.length > 0 || result.appointments.failures.length > 0) && (
                        <div>
                            <h4 className="font-bold text-lg text-zinc-200 mb-2">Detalle de Fallos:</h4>
                            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                                {result.shipments.failures.map((f, i) => (
                                    <div key={`sf-${i}`} className="text-sm p-3 bg-zinc-700/60 rounded-md">
                                        <p className="font-semibold text-red-400">
                                            <span className="font-mono bg-zinc-900 px-1 rounded-sm">{f.shipmentId || 'Envío Desconocido'}</span>
                                        </p>
                                        <p className="text-zinc-300 mt-1">{f.message}</p>
                                    </div>
                                ))}
                                {result.appointments.failures.map((f, i) => (
                                    <div key={`af-${i}`} className="text-sm p-3 bg-zinc-700/60 rounded-md">
                                        <p className="font-semibold text-red-400">
                                            <span className="font-mono bg-zinc-900 px-1 rounded-sm">{f.appointmentId || 'Cita Desconocida'}</span>
                                        </p>
                                        <p className="text-zinc-300 mt-1">{f.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {totalFailures === 0 && (
                        <p className="text-center text-green-400 mt-4">¡Todas las operaciones se completaron exitosamente!</p>
                    )}
                </div>
                <div className="p-4 bg-zinc-700/30 border-t border-zinc-700 text-right">
                    <button onClick={onClose} className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">Cerrar</button>
                </div>
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---
const ManhattanShipmentsView: React.FC = () => {
    const { currentUser } = useAuthContext();
    const [shipments, setShipments] = useState<ManhattanShipment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [processingResult, setProcessingResult] = useState<ProcessResult | null>(null);

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [shipmentNumberFilter, setShipmentNumberFilter] = useState('');
    
    const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
    const [shipmentToView, setShipmentToView] = useState<ManhattanShipment | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    const fetchShipments = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await googleSheetsService.getManhattanShipments(selectedDate);
            const validShipments = data.filter(s => s && s['Número de envío Manhattan']);
            setShipments(validShipments);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error al cargar los envíos');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchShipments();
    }, [fetchShipments]);
    
    const handleFileUpload = async (file: File) => {
        if (!file || !currentUser) return;
        
        setIsProcessing(true);
        setProcessingResult(null);
        
        try {
            const { parseManhattanShipmentsExcel } = await import('../services/mockExcelParser');
            const { shipments: parsedShipments } = await parseManhattanShipmentsExcel(file);

            if (parsedShipments.length === 0) {
                throw new Error("El archivo no contiene envíos válidos o está vacío.");
            }
            
            const response = await googleSheetsService.addManhattanShipments(parsedShipments, currentUser.name);
            
            const shipmentFailures = response.failures.filter(f => f.shipmentId);
            const appointmentFailures = response.failures.filter(f => f.appointmentId);
            const appointmentSuccessCount = response.createdAppointments 
                ? new Set(response.createdAppointments.map((c: any) => c.AppointmentId)).size 
                : 0;

            setProcessingResult({
                shipments: { success: response.successCount, failures: shipmentFailures },
                appointments: { success: appointmentSuccessCount, failures: appointmentFailures }
            });
            await fetchShipments();

        } catch (err) {
            setProcessingResult({
                 shipments: { success: 0, failures: [{ message: (err as Error).message, record: {} }] },
                 appointments: { success: 0, failures: [] }
            });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleCreateAppointments = async () => {
        if (selectedShipments.size === 0 || !currentUser) return;
        
        setIsProcessing(true);
        setIsConfirmModalOpen(false);
        setProcessingResult(null);
        
        try {
            const shipmentObjects = shipments.filter(s => selectedShipments.has(s['Número de envío Manhattan']));
            const response = await googleSheetsService.createManhattanAppointments(shipmentObjects, currentUser.name);
            
            setProcessingResult({
                shipments: { success: 0, failures: [] },
                appointments: { success: response.successCount, failures: response.failures }
            });
            setSelectedShipments(new Set());
            await fetchShipments();
        } catch (err) {
             setProcessingResult({
                 shipments: { success: 0, failures: [] },
                 appointments: { success: 0, failures: [{ message: (err as Error).message, record: {} }] }
            });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDownloadTemplate = () => {
        const headers = [
            "Número de envío", "Tráiler", "Sector de carga", 
            "Fecha", "Hora", "Duracion de carga", "Crear Cita",
            "Parada 1", "Parada 2", "Parada 3", "Parada 4", "Parada 5",
            "Parada 6", "Parada 7", "Parada 8", "Parada 9", "Parada 10",
            "Parada 11", "Parada 12", "Parada 13", "Parada 14", "Parada 15"
        ];
        const ws = utils.aoa_to_sheet([headers]);
        const addComment = (cellRef: string, text: string) => {
            if (!ws[cellRef]) return;
            ws[cellRef].c = ws[cellRef].c || [];
            ws[cellRef].c.push({ a: "Guía", t: text.replace(/\n/g, '\r\n') });
        };
        addComment('C1', 'Valores posibles:\nSecos, Frescos, Bas, Electro o Combinado');
        addComment('D1', 'Formato de fecha requerido: DD/MM/AAAA');
        addComment('E1', 'Formato de hora requerido: HH:MM');
        addComment('F1', 'Duración de la carga en minutos.\nEjemplo: 60');
        addComment('G1', 'Indica si se debe crear una cita automáticamente.\nValores permitidos: SI o NO');
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Plantilla de Envíos");
        writeFileXLSX(wb, "Plantilla_Envios_Manhattan.xlsx");
    };

    const handleExportExcel = () => {
        if (filteredShipments.length > 0) {
            exportManhattanShipmentsToExcel(filteredShipments, selectedDate);
        } else {
            alert("No hay envíos para exportar con los filtros actuales.");
        }
    };

    const toggleSelection = (manhattanId: string) => {
        setSelectedShipments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(manhattanId)) newSet.delete(manhattanId); else newSet.add(manhattanId);
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedShipments.size > 0) setSelectedShipments(new Set());
        else setSelectedShipments(new Set(filteredShipments.filter(s => !s.Cita).map(s => s['Número de envío Manhattan'])));
    };

    const filteredShipments = shipments
        .filter(s => !shipmentNumberFilter || String(s['Número de envío'] || '').includes(shipmentNumberFilter))
        .sort((a, b) => {
            const dateA = a.FechaHoraEnvio ? new Date(a.FechaHoraEnvio).getTime() : 0;
            const dateB = b.FechaHoraEnvio ? new Date(b.FechaHoraEnvio).getTime() : 0;
            if (dateA !== dateB) return dateA - dateB;

            const idA = a['Número de envío Manhattan'] || '';
            const idB = b['Número de envío Manhattan'] || '';
            return idA.localeCompare(idB);
        });

    const canCreateAppointment = selectedShipments.size > 0 && Array.from(selectedShipments).every(id => !shipments.find(s => s['Número de envío Manhattan'] === id)?.Cita);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {/* --- Modals --- */}
            {isProcessing && <ProcessingModal />}
            {processingResult && <ResultsModal result={processingResult} onClose={() => setProcessingResult(null)} />}
            {shipmentToView && (
                 <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={() => setShipmentToView(null)}>
                    <div className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-zinc-700">
                            <h3 className="text-xl font-bold text-white">Detalle del Envío</h3>
                            <p className="text-sm text-sky-400 font-mono break-all">{shipmentToView['Número de envío Manhattan']}</p>
                        </div>
                        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div className="bg-zinc-700/50 p-3 rounded-md"><p className="text-xs text-zinc-400">Nº Envío</p><p className="font-semibold text-zinc-100">{shipmentToView['Número de envío']}</p></div>
                            <div className="bg-zinc-700/50 p-3 rounded-md"><p className="text-xs text-zinc-400">Tráiler</p><p className="font-semibold text-zinc-100">{shipmentToView['Tráiler']}</p></div>
                            <div className="bg-zinc-700/50 p-3 rounded-md"><p className="text-xs text-zinc-400">Sector</p><p className="font-semibold text-zinc-100">{shipmentToView['Sector de carga']}</p></div>
                            <div className="bg-zinc-700/50 p-3 rounded-md"><p className="text-xs text-zinc-400">Fecha Hora Envío</p><p className="font-semibold text-zinc-100">{shipmentToView.FechaHoraEnvio ? new Date(shipmentToView.FechaHoraEnvio).toLocaleString() : 'N/A'}</p></div>
                            <div className="bg-zinc-700/50 p-3 rounded-md"><p className="text-xs text-zinc-400">Duración (min)</p><p className="font-semibold text-zinc-100">{shipmentToView['Duracion de carga'] || 'N/A'}</p></div>
                            <div className="bg-zinc-700/50 p-3 rounded-md"><p className="text-xs text-zinc-400">Cita</p><p className="font-semibold text-zinc-100">{shipmentToView.Cita || 'Pendiente'}</p></div>
                            <div className="sm:col-span-2 bg-zinc-700/50 p-3 rounded-md"><p className="text-xs text-zinc-400 mb-1">Paradas</p><p className="font-semibold text-zinc-100">{Object.keys(shipmentToView).filter(k => k.startsWith('Parada ')).sort((a, b) => parseInt(a.replace('Parada ', ''), 10) - parseInt(b.replace('Parada ', ''), 10)).map(key => shipmentToView[key]).filter(Boolean).join(', ') || 'Sin paradas'}</p></div>
                        </div>
                        <div className="p-4 bg-zinc-700/30 border-t border-zinc-700 text-right"><button onClick={() => setShipmentToView(null)} className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">Cerrar</button></div>
                    </div>
                </div>
            )}
            {isConfirmModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={() => setIsConfirmModalOpen(false)}>
                    <div className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white">Confirmar Creación de Citas</h3>
                            <p className="mt-4 text-zinc-400">Se crearán citas para los <span className="font-bold text-white">{selectedShipments.size}</span> envíos seleccionados. ¿Desea continuar?</p>
                        </div>
                        <div className="p-4 bg-zinc-700/50 flex justify-end gap-3 rounded-b-lg">
                            <button onClick={() => setIsConfirmModalOpen(false)} className="px-5 py-2 text-sm font-medium rounded-md border border-zinc-600">Cancelar</button>
                            <button onClick={handleCreateAppointments} className="px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md">{isProcessing ? 'Creando...' : 'Confirmar'}</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-wrap justify-between items-start mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white">Envíos y Citas Manhattan</h1>
                    <p className="text-lg text-zinc-400 mt-1">Cargue y gestione los envíos para la expedición.</p>
                </div>
            </div>
            <div className="mb-6 p-4 bg-zinc-800 rounded-xl shadow-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="min-h-[76px]">
                        <h3 className="text-base font-bold text-zinc-200 mb-2">Cargar Nuevo Archivo</h3>
                         <div className="flex items-center gap-2">
                            <label className={`flex items-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition-colors ${isProcessing ? 'bg-zinc-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700 cursor-pointer'}`}>
                                <UploadIcon className="w-5 h-5" />
                                <span>Seleccionar Excel</span>
                                <input id="shipment-file-upload" type="file" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} accept=".xlsx, .xls" disabled={isProcessing} key={Date.now()} />
                            </label>
                             <button onClick={handleDownloadTemplate} title="Descargar plantilla" className="p-2 text-zinc-400 hover:text-sky-400 transition-colors"><DownloadIcon className="w-5 h-5"/></button>
                         </div>
                    </div>
                    <div>
                        <label htmlFor="shipment-date" className="block text-sm font-medium text-zinc-300 mb-1">Fecha de Envío</label>
                        <input type="date" id="shipment-date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full px-3 py-2 border border-zinc-600 rounded-lg bg-zinc-700" />
                    </div>
                     <div>
                        <label htmlFor="shipment-number" className="block text-sm font-medium text-zinc-300 mb-1">Nº Envío</label>
                        <input type="text" id="shipment-number" value={shipmentNumberFilter} onChange={e => setShipmentNumberFilter(e.target.value)} placeholder="Buscar por número..." className="w-full px-3 py-2 border border-zinc-600 rounded-lg bg-zinc-700" />
                    </div>
                </div>
            </div>
             <div className={`transition-all duration-300 mb-4 ${selectedShipments.size > 0 ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                <div className="p-3 bg-zinc-700 rounded-lg flex justify-between items-center">
                    <span className="text-sm font-medium">{selectedShipments.size} envío(s) seleccionado(s)</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShipmentToView(shipments.find(s => s['Número de envío Manhattan'] === Array.from(selectedShipments)[0]) || null)} disabled={selectedShipments.size !== 1} className="flex items-center gap-2 text-sm bg-zinc-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-zinc-500 disabled:bg-zinc-800 disabled:text-zinc-500"><EyeIcon className="w-4 h-4"/> Ver Detalle</button>
                         <button onClick={() => setIsConfirmModalOpen(true)} disabled={!canCreateAppointment || isProcessing} className="flex items-center gap-2 text-sm bg-green-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-500"><TruckIcon className="w-4 h-4"/> Crear Cita</button>
                    </div>
                </div>
            </div>
            <div className="bg-zinc-800 rounded-xl shadow-lg overflow-hidden">
                <div className="p-4 flex justify-between items-center border-b border-zinc-700 bg-zinc-700/50">
                    <h2 className="text-lg font-bold">Envíos del {new Date(selectedDate + 'T00:00:00').toLocaleDateString()}</h2>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleExportExcel}
                            disabled={filteredShipments.length === 0}
                            className="flex items-center gap-2 text-sm bg-green-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-zinc-600 disabled:cursor-not-allowed"
                            title="Exportar a Excel"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            <span>Exportar</span>
                        </button>
                        <button onClick={fetchShipments} disabled={isLoading || isProcessing} className="p-2 rounded-full hover:bg-zinc-600" title="Refrescar lista"><RefreshIcon className={`w-5 h-5 ${isLoading || isProcessing ? 'animate-spin' : ''}`}/></button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-zinc-400">
                        <thead className="text-xs text-zinc-400 uppercase bg-zinc-700">
                            <tr>
                                <th scope="col" className="p-4"><input type="checkbox" onChange={toggleSelectAll} checked={selectedShipments.size > 0 && selectedShipments.size === filteredShipments.filter(s => !s.Cita).length} className="rounded border-zinc-500 bg-zinc-900 text-sky-600 focus:ring-sky-500" /></th>
                                <th scope="col" className="px-6 py-3">Nro. Envío Manhattan</th>
                                <th scope="col" className="px-6 py-3">Nro. Envío</th>
                                <th scope="col" className="px-6 py-3">Tráiler</th>
                                <th scope="col" className="px-6 py-3">Sector</th>
                                <th scope="col" className="px-6 py-3">Fecha Hora Envío</th>
                                <th scope="col" className="px-6 py-3">Cita</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} className="text-center py-10">Cargando envíos...</td></tr>
                            ) : filteredShipments.length > 0 ? (
                                filteredShipments.map(s => (
                                    <tr key={s._rowIndex} onClick={() => toggleSelection(s['Número de envío Manhattan'])} className={`border-b border-zinc-700 transition-colors cursor-pointer ${selectedShipments.has(s['Número de envío Manhattan']) ? 'bg-sky-900/50' : 'hover:bg-zinc-700/50'}`}>
                                        <td className="p-4">
                                            <input 
                                                type="checkbox" 
                                                onChange={(e) => { e.stopPropagation(); toggleSelection(s['Número de envío Manhattan'])}} 
                                                checked={selectedShipments.has(s['Número de envío Manhattan'])} 
                                                className="rounded border-zinc-500 bg-zinc-900 text-sky-600 focus:ring-sky-500 pointer-events-none" 
                                            />
                                        </td>
                                        <td className="px-6 py-4 font-mono font-semibold text-sky-400">{s['Número de envío Manhattan']}</td>
                                        <td className="px-6 py-4 font-medium text-zinc-200">{s['Número de envío']}</td>
                                        <td className="px-6 py-4">{s['Tráiler']}</td>
                                        <td className="px-6 py-4">{s['Sector de carga']}</td>
                                        <td className="px-6 py-4">{s.FechaHoraEnvio ? new Date(s.FechaHoraEnvio).toLocaleString() : 'N/A'}</td>
                                        <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-bold rounded-full ${s.Cita ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>{s.Cita || 'Pendiente'}</span></td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={7} className="text-center py-10">No se encontraron envíos para los filtros seleccionados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ManhattanShipmentsView;
