import React, { useState } from 'react';
import { useDownloadManagerContext } from '../hooks/useDownloadManager';
import { DownloadTask, TaskStatus, iLPN, iLPNArticle, IlpnType } from '../types';
import { exportTaskToExcel } from '../services/excelGenerator';
import { BarcodePrefix } from './DownloadView';
import { RefreshIcon } from './Icons';

const ReportView: React.FC = () => {
    const { tasks, fetchTasks, isLoading } = useDownloadManagerContext();
    const [selectedTask, setSelectedTask] = useState<DownloadTask | null>(null);
    const [expandedIlpns, setExpandedIlpns] = useState<Set<string>>(new Set());
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    const completedTasks = tasks.filter((t: DownloadTask) => t.status === TaskStatus.COMPLETED);

    const filteredTasks = completedTasks.filter((task: DownloadTask) => {
        if (!startDate && !endDate) return true;
        if (!task.completedAt) return false;

        const completedDate = new Date(task.completedAt);
        completedDate.setHours(0, 0, 0, 0);

        if (startDate) {
            const start = new Date(startDate);
            start.setMinutes(start.getMinutes() + start.getTimezoneOffset()); // Adjust for timezone
            if (completedDate < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setMinutes(end.getMinutes() + end.getTimezoneOffset()); // Adjust for timezone
            if (completedDate > end) return false;
        }
        return true;
    });

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
    };

    const toggleIlpn = (ilpnId: string) => {
        setExpandedIlpns((prev: Set<string>) => {
            const newSet = new Set(prev);
            if (newSet.has(ilpnId)) {
                newSet.delete(ilpnId);
            } else {
                newSet.add(ilpnId);
            }
            return newSet;
        });
    };

    const handleSelectTask = (task: DownloadTask) => {
        setSelectedTask(task);
        setExpandedIlpns(new Set()); // Reset expanded state when a new task is selected
    };
    
    const handleExport = (task: DownloadTask) => {
        try {
            exportTaskToExcel(task);
        } catch (error) {
            console.error("Failed to export task to excel:", error);
            alert("Hubo un error al generar el archivo Excel.");
        }
    }

    return (
        <div className="p-6 sm:p-8">
            <div className="flex justify-between items-start mb-8 gap-4">
                <h1 className="text-3xl font-extrabold text-white">Reporte de Importaciones - Detalle de descargas</h1>
                <button 
                    onClick={() => fetchTasks()} 
                    className="p-3 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-600 flex-shrink-0"
                    disabled={isLoading}
                    title="Actualizar reportes"
                >
                    <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            
            <div className="bg-zinc-800 rounded-xl shadow-lg p-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-zinc-300 mb-1">Fecha de Inicio</label>
                        <input 
                            type="date"
                            id="start-date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-600 rounded-lg bg-zinc-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                        />
                    </div>
                    <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-zinc-300 mb-1">Fecha de Fin</label>
                         <input 
                            type="date"
                            id="end-date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-600 rounded-lg bg-zinc-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                        />
                    </div>
                    <div className="flex items-center">
                         <button 
                            onClick={handleClearFilters}
                            className="w-full sm:w-auto px-4 py-2 bg-zinc-600 text-zinc-200 rounded-lg hover:bg-zinc-500 transition-colors"
                         >
                            Limpiar Filtros
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-800 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-zinc-400">
                        <thead className="text-xs text-zinc-400 uppercase bg-zinc-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">ID Tarea</th>
                                <th scope="col" className="px-6 py-3">Archivo</th>
                                <th scope="col" className="px-6 py-3">Tipo</th>
                                <th scope="col" className="px-6 py-3">Usuario</th>
                                <th scope="col" className="px-6 py-3">Fecha de Finalización</th>
                                <th scope="col" className="px-6 py-3">Total Items</th>
                                <th scope="col" className="px-6 py-3">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.length > 0 ? (
                                filteredTasks.map((task: DownloadTask) => (
                                    <tr key={task.id} className="bg-zinc-800 border-b border-zinc-700 hover:bg-zinc-600/50">
                                        <td className="px-6 py-4 font-medium text-white break-all">{task.id}</td>
                                        <td className="px-6 py-4">{task.fileName}</td>
                                        <td className="px-6 py-4">
                                             <span className="px-2 py-1 text-xs font-semibold rounded-full bg-zinc-900 text-zinc-300">{task.downloadType}</span>
                                        </td>
                                        <td className="px-6 py-4">{task.user}</td>
                                        <td className="px-6 py-4">{task.completedAt ? new Date(task.completedAt).toLocaleString() : 'N/A'}</td>
                                        <td className="px-6 py-4">{task.articles.length}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button onClick={() => handleSelectTask(task)} className="font-medium text-sky-400 hover:underline mr-4">Ver Detalles</button>
                                            <button onClick={() => handleExport(task)} className="font-medium text-green-500 hover:underline">Exportar</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="text-center py-10">No hay tareas que coincidan con los filtros seleccionados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedTask && (() => {
                const operators = Array.from(new Set(selectedTask.closedILPNs.map((i: iLPN) => i.user).filter(Boolean)));

                return (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={() => setSelectedTask(null)}>
                    <div className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-4xl m-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-zinc-700">
                            <h2 className="text-2xl font-bold text-white break-all">Detalle de Tarea: {selectedTask.id}</h2>
                            <p className="text-zinc-400">{selectedTask.fileName}</p>
                        </div>
                        <div className="p-6 overflow-y-auto">
                             <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div><span className="font-bold">Creador Tarea:</span> {selectedTask.user}</div>
                                <div className="md:col-span-2"><span className="font-bold">Operadores:</span> {operators.length > 0 ? operators.join(', ') : 'N/A'}</div>
                                <div><span className="font-bold">Tipo de Descarga:</span> {selectedTask.downloadType}</div>
                                <div><span className="font-bold">Total iLPNs:</span> {selectedTask.closedILPNs.length}</div>
                                <div className="md:col-span-2"><span className="font-bold">Inicio:</span> {selectedTask.startedAt ? new Date(selectedTask.startedAt).toLocaleString() : 'N/A'}</div>
                                <div className="md:col-span-1"><span className="font-bold">Fin:</span> {selectedTask.completedAt ? new Date(selectedTask.completedAt).toLocaleString() : 'N/A'}</div>
                            </div>
                            
                            <h3 className="text-xl font-bold mt-6 mb-4">iLPNs Generados</h3>
                            <div className="space-y-2">
                                {selectedTask.closedILPNs.length > 0 ? selectedTask.closedILPNs.map((ilpn: iLPN) => {
                                    return (
                                        <div key={ilpn.id} className="border border-zinc-700 rounded-lg overflow-hidden">
                                            <div 
                                                className="p-4 flex justify-between items-center cursor-pointer hover:bg-zinc-700/50 transition-colors"
                                                onClick={() => toggleIlpn(ilpn.id)}
                                                role="button"
                                                aria-expanded={expandedIlpns.has(ilpn.id)}
                                            >
                                                <div>
                                                    <p className="font-bold text-zinc-100 break-all">{ilpn.id}</p>
                                                    <p className="font-normal text-sm text-zinc-400 flex items-center gap-2">
                                                        <span>Madre: {ilpn.madre}</span>
                                                        <span>&bull;</span>
                                                        <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${ilpn.type === IlpnType.CROSS ? 'bg-amber-900 text-amber-300' : 'bg-sky-900 text-sky-300'}`}>{ilpn.type}</span>
                                                        <span>&bull;</span>
                                                        <span>{ilpn.articles.reduce((sum: number, a: iLPNArticle) => sum + a.quantity, 0)} cajas</span>
                                                        <span>&bull;</span>
                                                        <span>Usuario: <span className="font-semibold">{ilpn.user || 'N/A'}</span></span>
                                                    </p>
                                                </div>
                                                <svg 
                                                    className={`w-5 h-5 text-zinc-500 transform transition-transform ${expandedIlpns.has(ilpn.id) ? 'rotate-180' : ''}`} 
                                                    xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                            {expandedIlpns.has(ilpn.id) && (
                                                <div className="p-4 border-t border-zinc-700 bg-zinc-800/50">
                                                    <h4 className="font-semibold text-sm mb-2 text-zinc-300">Artículos en este iLPN:</h4>
                                                    <div className="space-y-2">
                                                        {ilpn.articles.map((item: iLPNArticle, index: number) => {
                                                            return (
                                                                <div key={index} className="text-sm p-2 rounded-md bg-zinc-700 flex justify-between items-center gap-2">
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-medium text-zinc-200">{item.sku}</p>
                                                                        <p className="text-xs text-zinc-400 flex items-baseline" title={item.description}>
                                                                            <BarcodePrefix barcode={item.barcode} />
                                                                            <span className="truncate">{item.description}</span>
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right flex-shrink-0">
                                                                        <p className="font-bold text-zinc-200">{item.quantity}</p>
                                                                        <p className="text-xs text-zinc-400">cajas</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                }) : (
                                    <p className="text-zinc-400 text-center py-4">No se generaron iLPNs para esta tarea.</p>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-zinc-700/30 border-t border-zinc-700 text-right">
                            <button onClick={() => setSelectedTask(null)} className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">Cerrar</button>
                        </div>
                    </div>
                </div>
                )
            })()}
        </div>
    );
};

export default ReportView;