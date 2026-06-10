import React, { useState, useEffect, useCallback } from 'react';
import { sheets as googleSheetsService } from '../services/googleSheetsService';
import { OlpnDistributionLog } from '../types';
import { RefreshIcon } from './Icons';
import { exportOlpnDistributionLogToExcel } from '../services/excelGenerator';

const FrescosDistributionReport: React.FC = () => {
    const [logData, setLogData] = useState<OlpnDistributionLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // FIX: Use local time for "today" default to ensure current day's data is visible.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        palletid: '',
        usuario: '',
        olpnorigenid: '',
        olpndestinoid: '',
        local: '',
        ubicaciondestino: '',
    });

    const fetchLogData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Create a clean filter object for the API call
            const apiFilters = {
                ...filters,
                // Ensure empty strings are not sent if dates are cleared
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined,
            };
            const data = await googleSheetsService.getOlpnDistributionLog(apiFilters);
            setLogData(data);
        } catch (err) {
            console.error("Failed to fetch OLPN distribution log:", err);
            setError("No se pudo cargar el registro de reparto.");
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchLogData();
    }, []); // Fetch on initial load with default (today's) filters

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleClearFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            palletid: '',
            usuario: '',
            olpnorigenid: '',
            olpndestinoid: '',
            local: '',
            ubicaciondestino: '',
        });
    };
    
    // We trigger the search on button click instead of automatically on filter change
    const handleApplyFilters = () => {
        fetchLogData();
    };

    const handleExport = () => {
        try {
            exportOlpnDistributionLogToExcel(logData);
        } catch (error) {
            console.error("Failed to export to excel:", error);
            alert("Hubo un error al generar el archivo Excel.");
        }
    };
    
    const inputClass = "w-full px-3 py-2 border border-zinc-600 rounded-lg bg-zinc-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition";

    return (
        <div className="p-6 sm:p-8">
            <div className="flex flex-wrap justify-between items-start mb-8 gap-4">
                <h1 className="text-3xl font-extrabold text-white">Reporte de Reparto de OLPNs - Frescos</h1>
                <button 
                    onClick={fetchLogData} 
                    className="p-3 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-600 flex-shrink-0"
                    disabled={isLoading}
                    title="Actualizar reporte"
                >
                    <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            
            <div className="bg-zinc-800 rounded-xl shadow-lg p-4 mb-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                     <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-zinc-300 mb-1">Fecha de Inicio</label>
                        <input type="date" id="start-date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-zinc-300 mb-1">Fecha de Fin</label>
                        <input type="date" id="end-date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className={inputClass} />
                    </div>
                     <div>
                        <label htmlFor="palletid" className="block text-sm font-medium text-zinc-300 mb-1">Pallet ID</label>
                        <input type="text" id="palletid" name="palletid" value={filters.palletid} onChange={handleFilterChange} className={inputClass} placeholder="Filtrar por pallet..." />
                    </div>
                     <div>
                        <label htmlFor="usuario" className="block text-sm font-medium text-zinc-300 mb-1">Nombre de Usuario</label>
                        <input type="text" id="usuario" name="usuario" value={filters.usuario} onChange={handleFilterChange} className={inputClass} placeholder="Filtrar por usuario..." />
                    </div>
                    <div>
                        <label htmlFor="local" className="block text-sm font-medium text-zinc-300 mb-1">Local</label>
                        <input type="text" id="local" name="local" value={filters.local} onChange={handleFilterChange} className={inputClass} placeholder="Filtrar por local..." />
                    </div>
                    <div>
                        <label htmlFor="ubicaciondestino" className="block text-sm font-medium text-zinc-300 mb-1">Ubicación</label>
                        <input type="text" id="ubicaciondestino" name="ubicaciondestino" value={filters.ubicaciondestino} onChange={handleFilterChange} className={inputClass} placeholder="Filtrar por ubicación..." />
                    </div>
                    <div>
                        <label htmlFor="olpnorigenid" className="block text-sm font-medium text-zinc-300 mb-1">OLPN Origen</label>
                        <input type="text" id="olpnorigenid" name="olpnorigenid" value={filters.olpnorigenid} onChange={handleFilterChange} className={inputClass} placeholder="Filtrar por OLPN origen..." />
                    </div>
                    <div>
                        <label htmlFor="olpndestinoid" className="block text-sm font-medium text-zinc-300 mb-1">OLPN Destino</label>
                        <input type="text" id="olpndestinoid" name="olpndestinoid" value={filters.olpndestinoid} onChange={handleFilterChange} className={inputClass} placeholder="Filtrar por OLPN destino..." />
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                    <button onClick={handleClearFilters} className="px-4 py-2 bg-zinc-600 text-zinc-200 rounded-lg hover:bg-zinc-500 transition-colors">Limpiar Filtros</button>
                    <button onClick={handleApplyFilters} disabled={isLoading} className="px-5 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors disabled:bg-sky-800 disabled:cursor-wait">Aplicar Filtros</button>
                </div>
            </div>
             <div className="flex justify-end mb-4">
                <button onClick={handleExport} disabled={logData.length === 0} className="bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-700 transition-colors disabled:bg-zinc-600 disabled:cursor-not-allowed">Exportar a Excel</button>
            </div>

            <div className="bg-zinc-800 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-zinc-400">
                        <thead className="text-xs text-zinc-400 uppercase bg-zinc-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">Fecha</th>
                                <th scope="col" className="px-6 py-3">Hora</th>
                                <th scope="col" className="px-6 py-3">Pallet ID</th>
                                <th scope="col" className="px-6 py-3">OLPN Origen</th>
                                <th scope="col" className="px-6 py-3">OLPN Destino</th>
                                <th scope="col" className="px-6 py-3">Local</th>
                                <th scope="col" className="px-6 py-3">Ubicación</th>
                                <th scope="col" className="px-6 py-3">Usuario</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={8} className="text-center py-10">Cargando datos...</td></tr>
                            ) : error ? (
                                <tr><td colSpan={8} className="text-center py-10 text-red-400">{error}</td></tr>
                            ) : logData.length > 0 ? (
                                logData.map((log, index) => (
                                    <tr key={log._rowIndex || index} className="bg-zinc-800 border-b border-zinc-700 hover:bg-zinc-600/50">
                                        <td className="px-6 py-4 whitespace-nowrap">{log.fechahoraconfirmado ? new Date(log.fechahoraconfirmado).toLocaleDateString('es-UY') : 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{log.fechahoraconfirmado ? new Date(log.fechahoraconfirmado).toLocaleTimeString('es-UY') : 'N/A'}</td>
                                        <td className="px-6 py-4 font-mono">{log.palletid}</td>
                                        <td className="px-6 py-4 font-mono">{log.olpnorigenid}</td>
                                        <td className="px-6 py-4 font-mono">{log.olpndestinoid}</td>
                                        <td className="px-6 py-4">{log.local}</td>
                                        <td className="px-6 py-4">{log.ubicaciondestino}</td>
                                        <td className="px-6 py-4 font-medium text-white">{log.usuario}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={8} className="text-center py-10">No se encontraron registros que coincidan con los filtros.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FrescosDistributionReport;