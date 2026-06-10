
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sheets } from '../services/googleSheetsService';
import { LocationAuditRecord } from '../types';
import { SearchIcon, DownloadIcon, ArrowLeftIcon, CalendarIcon, FilterIcon, UserIcon, MapPinIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon, RefreshIcon } from './Icons';
import * as XLSX from 'xlsx';

const LocationAuditReport: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [records, setRecords] = useState<LocationAuditRecord[]>([]);
    
    // Helper to format date in 24h format: DD/MM/YYYY HH:mm:ss (Uruguay Time)
    const formatDateTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('es-UY', {
                timeZone: 'America/Montevideo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(',', '');
        } catch (e) {
            return dateStr;
        }
    };
    // Filters
    const [filters, setFilters] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        location: '',
        user: '',
        local: ''
    });

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const data = await sheets.getLocationAuditRecords(filters);
            
            // Client-side filtering as a safety measure to ensure date range is strictly respected
            // even if the backend returns more data than requested.
            // We use local date comparison to match what the user sees in the UI.
            const filteredData = data.filter(r => {
                const date = new Date(r.FechaHoraAuditoria);
                const recordDateLocal = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                
                if (filters.startDate && recordDateLocal < filters.startDate) return false;
                if (filters.endDate && recordDateLocal > filters.endDate) return false;
                return true;
            });
            
            setRecords(filteredData);
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, []);

    const handleExport = () => {
        if (records.length === 0) return;
        
        const exportData = records.map(record => ({
            'Fecha Hora': formatDateTime(record.FechaHoraAuditoria),
            'Ubicación': record.UbicacionAuditada,
            'Usuario': record.Usuario,
            'Cont. Manhattan': record.ContenedorManhattan || '-',
            'Tipo Cont. Manhattan': record.TipoContenedorManhattan || '-',
            'Cont. Auditado': record.ContenedorAuditado || '-',
            'Tipo Cont. Auditado': record.TipoContenedorAuditado || '-',
            'Tipo Diferencia': record.TipoDiferencia,
            'Estado Auditoria': record.EstadoAuditoria
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "AuditoriaUbicaciones");
        XLSX.writeFile(workbook, `Reporte_Auditoria_Ubicaciones_${filters.startDate}_${filters.endDate}.xlsx`);
    };

    return (
        <div className="p-6 sm:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <button 
                            onClick={() => navigate('/reports')}
                            className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors mb-4 uppercase tracking-widest"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Volver a Reportes
                        </button>
                        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Reporte de Auditoría de Ubicaciones</h1>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={handleExport}
                            disabled={records.length === 0}
                            className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-900/20 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <DownloadIcon className="h-5 w-5" />
                            Exportar Excel
                        </button>
                    </div>
                </div>

                {/* Filters Card */}
                <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-8 shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Fecha de Inicio</label>
                            <input 
                                type="date" 
                                value={filters.startDate}
                                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                                className="w-full bg-zinc-700 border border-zinc-600 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Fecha de Fin</label>
                            <input 
                                type="date" 
                                value={filters.endDate}
                                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                                className="w-full bg-zinc-700 border border-zinc-600 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Ubicación</label>
                            <input 
                                type="text" 
                                value={filters.location}
                                onChange={(e) => setFilters({...filters, location: e.target.value})}
                                className="w-full bg-zinc-700 border border-zinc-600 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all placeholder:text-zinc-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Usuario</label>
                            <input 
                                type="text" 
                                value={filters.user}
                                onChange={(e) => setFilters({...filters, user: e.target.value})}
                                className="w-full bg-zinc-700 border border-zinc-600 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all placeholder:text-zinc-500"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-8">
                        <button 
                            onClick={() => setFilters({
                                startDate: new Date().toISOString().split('T')[0],
                                endDate: new Date().toISOString().split('T')[0],
                                location: '',
                                user: '',
                                local: ''
                            })}
                            className="px-6 py-3 rounded-xl font-bold text-sm bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-all border border-zinc-600"
                        >
                            Limpiar Filtros
                        </button>
                        <button 
                            onClick={fetchRecords}
                            disabled={loading}
                            className="px-10 py-3 rounded-xl font-bold text-sm bg-sky-600 text-white hover:bg-sky-500 transition-all flex items-center gap-2 shadow-lg shadow-sky-900/40 disabled:opacity-50"
                        >
                            {loading ? (
                                <RefreshIcon className="h-5 w-5 animate-spin" />
                            ) : (
                                <SearchIcon className="h-5 w-5" />
                            )}
                            Aplicar Filtros
                        </button>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-zinc-800 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-zinc-700 text-zinc-300">
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Fecha / Hora</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Ubicación</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Usuario</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Cont. Manhattan</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Cont. Auditado</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Diferencia</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="p-20 text-center">
                                            <RefreshIcon className="h-10 w-10 text-sky-500 animate-spin mx-auto mb-4" />
                                            <p className="text-sm text-zinc-500 font-medium">Cargando...</p>
                                        </td>
                                    </tr>
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-20 text-center">
                                            <p className="text-sm text-zinc-500 italic">No se encontraron registros que coincidan con los filtros.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record, idx) => (
                                        <tr key={idx} className="hover:bg-zinc-700/30 transition-colors group">
                                            <td className="p-4 text-xs font-mono text-zinc-400">
                                                {formatDateTime(record.FechaHoraAuditoria)}
                                            </td>
                                            <td className="p-4 text-sm font-bold text-zinc-100">{record.UbicacionAuditada}</td>
                                            <td className="p-4 text-sm text-zinc-400 font-medium">{record.Usuario}</td>
                                            <td className="p-4 text-xs font-mono">
                                                <div className="text-zinc-200 font-bold">{record.ContenedorManhattan || '-'}</div>
                                                <div className="text-[10px] text-zinc-500 uppercase font-bold">{record.TipoContenedorManhattan}</div>
                                            </td>
                                            <td className="p-4 text-xs font-mono">
                                                <div className="text-zinc-200 font-bold">{record.ContenedorAuditado || '-'}</div>
                                                <div className="text-[10px] text-zinc-500 uppercase font-bold">{record.TipoContenedorAuditado}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border ${
                                                    record.TipoDiferencia === 'Sin diferencias' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    record.TipoDiferencia === 'Faltante' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                }`}>
                                                    {record.TipoDiferencia}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${
                                                    record.EstadoAuditoria === 'Sin diferencias' ? 'text-emerald-500' : 'text-rose-500'
                                                }`}>
                                                    {record.EstadoAuditoria}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LocationAuditReport;

