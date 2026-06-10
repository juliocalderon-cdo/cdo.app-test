




import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { sheets as googleSheetsService } from '../services/googleSheetsService';
import { AuditRecord, AuditSector } from '../types';
import { RefreshIcon, PlayIcon, EyeIcon, CheckCircleIcon, DownloadIcon, ChevronDownIcon, ChevronUpIcon, FilterIcon, XCircleIcon } from './Icons';
import { exportAuditsToExcel } from '../services/excelGenerator';

// Helper to display dates without timezone shifts
const formatDateDisplay = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    if (dateStr.includes('T')) return new Date(dateStr).toLocaleDateString('es-UY');
    
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
};

// Helper to format breakdown object into a string like "1 Cj, 2 Pk, 5 Un"
const formatBreakdown = (totals: { cajas: number, packs: number, unidades: number }): string => {
    const parts = [];
    if (totals.cajas > 0) parts.push(`${totals.cajas} Cj`);
    if (totals.packs > 0) parts.push(`${totals.packs} Pk`);
    if (totals.unidades > 0) parts.push(`${totals.unidades} Un`);
    
    return parts.length > 0 ? parts.join(', ') : '0 Un';
};

// --- MODAL COMPONENT ---
const AuditDifferencesModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    auditRecords: AuditRecord[];
    olpnId: string;
}> = ({ isOpen, onClose, auditRecords, olpnId }) => {
    if (!isOpen) return null;

    const itemsWithDifferences = auditRecords.filter(r => r.TipoDiferencia !== 'Sin diferencias');
    const headerRecord = auditRecords[0] || null;
    const hasPalletDifference = headerRecord?.DiferenciaPallet === 'SI';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-zinc-800 rounded-xl shadow-2xl w-full max-w-4xl border border-zinc-700 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-zinc-700 flex justify-between items-center">
                    <div>
                         <h3 className="text-xl font-bold text-white">Diferencias en {olpnId}</h3>
                         <p className="text-sm text-zinc-400">Total ítems con diferencias: {itemsWithDifferences.length}</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl font-bold leading-none">&times;</button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    {hasPalletDifference && (
                        <div className="mb-6 p-4 bg-yellow-900/30 border-l-4 border-yellow-500 rounded-md text-yellow-200">
                            <p className="font-bold text-base mb-2">¡Atención! Se detectó una diferencia de pallet.</p>
                            <div className="text-sm space-y-1">
                                <p><span className="font-sans font-semibold text-zinc-400">Original (Sistema): </span><span className="font-mono">{headerRecord.PalletIdOriginal || 'N/A'}</span></p>
                                <p><span className="font-sans font-semibold text-zinc-400">Auditado (Contado):  </span><span className="font-mono">{headerRecord.PalletIdAuditado || 'N/A'}</span></p>
                            </div>
                        </div>
                    )}

                    {itemsWithDifferences.length === 0 && !hasPalletDifference ? (
                         <div className="text-center py-8">
                             <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                             <p className="text-zinc-300">No se encontraron diferencias en este OLPN.</p>
                         </div>
                    ) : (
                        itemsWithDifferences.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-zinc-400 min-w-[600px]">
                                    <thead className="text-xs text-zinc-400 uppercase bg-zinc-700">
                                        <tr>
                                            <th className="px-4 py-3">Item / Descripción</th>
                                            <th className="px-4 py-3 text-right">Cant. Original</th>
                                            <th className="px-4 py-3 text-right">Cant. Auditada</th>
                                            <th className="px-4 py-3 text-right">Diferencia</th>
                                            <th className="px-4 py-3">Vencimientos (M/A)</th>
                                            <th className="px-4 py-3">Tipo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemsWithDifferences.map((record, idx) => (
                                            <tr key={idx} className="bg-zinc-800 border-b border-zinc-700 hover:bg-zinc-700/50">
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-zinc-200">{record.Item}</p>
                                                    <p className="text-xs text-zinc-500 truncate max-w-[200px]" title={record.Descripcion}>{record.Descripcion}</p>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-zinc-300">
                                                    {record.DetalleOriginal || `${record.CantidadManhattan} Un`}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-white">
                                                    {record.DetalleAuditado || `${record.CantidadAuditada} Un`}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold">
                                                    <span className={record.Diferencia === 0 ? 'text-zinc-400' : 'text-red-400'}>
                                                        {record.DetalleDiferencia || (record.Diferencia > 0 ? `+${record.Diferencia}` : record.Diferencia)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    <span>{formatDateDisplay(record.FechaVtoManhattan) || 'N/A'}</span> /
                                                    <span className={record.FechaVtoManhattan && !record.FechaVtoAuditada ? 'text-yellow-400 font-bold' : ''}>
                                                    {record.FechaVtoAuditada ? formatDateDisplay(record.FechaVtoAuditada) : (record.FechaVtoManhattan ? ' Dato no ingresado' : ' N/A')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-1 text-xs rounded bg-red-900/30 text-red-300 border border-red-800/50 block w-fit">
                                                        {record.TipoDiferencia}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                         ) : null
                    )}
                </div>

                <div className="p-4 bg-zinc-700/30 border-t border-zinc-700 text-right">
                    <button onClick={onClose} className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">Cerrar</button>
                </div>
            </div>
        </div>
    );
};

const QualityAuditsDashboard: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const selectedSector = location.state?.sector as AuditSector | undefined;

    const [audits, setAudits] = useState<AuditRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAuditKey, setSelectedAuditKey] = useState<string | null>(null);
    const [alertMessage, setAlertMessage] = useState<{ type: 'error' | 'warning' | 'success', msg: string } | null>(null);
    
    // UI State for Responsive Design
    const [showFilters, setShowFilters] = useState(false);

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        olpn: '',
        usuario: '',
        tipoDiferencia: '',
        recuento: '',
    });

    const fetchAudits = useCallback(async (filtersOverride?: typeof filters) => {
        if (!selectedSector) return;
        setIsLoading(true);
        try {
            const activeFilters = {
                ...(filtersOverride || filters),
                sector: selectedSector,
            };
            const data = await googleSheetsService.getAuditRecords(activeFilters);
            setAudits(data);
        } catch (error) {
            console.error("Error fetching audits:", error);
        } finally {
            setIsLoading(false);
        }
    }, [filters, selectedSector]);

    useEffect(() => {
        if (!selectedSector) {
            navigate('/quality/select-sector', { replace: true });
        } else {
            fetchAudits();
        }
    }, [selectedSector, navigate]); 

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const handleClearFilters = () => {
        const defaultFilters = {
            startDate: '', 
            endDate: '',
            olpn: '',
            usuario: '',
            tipoDiferencia: '',
            recuento: '',
        };
        setFilters(defaultFilters);
        fetchAudits(defaultFilters); 
    };

    const handleStartAudit = () => {
        navigate('/quality/audit-session', { state: { sector: selectedSector } });
    };

    const handleRecount = (olpnId: string) => {
        if (selectedSector) {
            navigate('/quality/audit-session', { state: { olpnId, isRecount: true, sector: selectedSector } });
        }
    };

    const handleExport = () => {
        setAlertMessage(null);
        if (audits.length === 0) {
            setAlertMessage({ type: 'warning', msg: "No hay registros para exportar." });
            return;
        }
        exportAuditsToExcel(audits);
        setAlertMessage({ type: 'success', msg: "Exportación completada." });
    };

    // Grouping Logic: Group by Audit ID
    const groupedAudits = audits.reduce((acc, curr) => {
        const key = curr.IdInternoAuditoria || `${curr.OlpnId}_${curr.FechaHoraAuditoria}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(curr);
        return acc;
    }, {} as Record<string, AuditRecord[]>);
    
    const uniqueAuditKeys = Object.keys(groupedAudits).sort((a, b) => {
         const dateA = new Date(groupedAudits[a][0].FechaHoraAuditoria).getTime();
         const dateB = new Date(groupedAudits[b][0].FechaHoraAuditoria).getTime();
         return dateB - dateA; // Newest first
    });
    
    const getQualityColor = (quality: number | null) => {
        if (quality === null) return 'text-zinc-500';
        if (quality >= 95) return 'text-green-400';
        if (quality >= 80) return 'text-yellow-400';
        return 'text-red-400';
    };

    if (!selectedSector) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-500"></div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8">
            <AuditDifferencesModal 
                isOpen={!!selectedAuditKey}
                onClose={() => setSelectedAuditKey(null)}
                olpnId={selectedAuditKey ? groupedAudits[selectedAuditKey][0].OlpnId : ''}
                auditRecords={selectedAuditKey ? groupedAudits[selectedAuditKey] : []}
            />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                     <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Auditoría de OLPNS - Sector {selectedSector}</h1>
                     <p className="text-zinc-400 mt-1 text-sm sm:text-base">Control de calidad y verificación de stock.</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <button onClick={handleStartAudit} className="flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-700 transition-colors shadow-lg hover:shadow-sky-900/20 flex-1 md:flex-none min-w-[160px]">
                        <PlayIcon className="w-5 h-5" />
                        <span className="whitespace-nowrap">Iniciar Auditoría</span>
                    </button>
                </div>
            </div>

            {alertMessage && (
                <div className={`p-4 mb-6 rounded-lg border flex items-center justify-between gap-3 animate-fade-in-down ${alertMessage.type === 'error' ? 'bg-red-900/30 border-red-600 text-red-200' : alertMessage.type === 'warning' ? 'bg-amber-900/30 border-amber-500 text-amber-200' : 'bg-green-900/30 border-green-600 text-green-200'}`}>
                    <div className="flex items-center gap-3">
                        {alertMessage.type === 'warning' ? <XCircleIcon className="w-6 h-6 flex-shrink-0" /> : <CheckCircleIcon className="w-6 h-6 flex-shrink-0" />}
                        <div><p className="font-bold">{alertMessage.type === 'error' ? 'Error' : alertMessage.type === 'warning' ? 'Atención' : 'Éxito'}</p><p className="text-sm">{alertMessage.msg}</p></div>
                    </div>
                    <button onClick={() => setAlertMessage(null)} className="text-current opacity-50 hover:opacity-100">&times;</button>
                </div>
            )}

            {/* --- FILTERS SECTION --- */}
            <div className="bg-zinc-800 rounded-xl shadow-lg mb-6 border border-zinc-700 overflow-hidden">
                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className="w-full flex justify-between items-center p-4 text-zinc-300 hover:bg-zinc-700/50 transition-colors md:hidden"
                >
                    <span className="flex items-center gap-2 font-bold"><FilterIcon className="w-5 h-5"/> Filtros</span>
                    {showFilters ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                </button>
                
                <div className={`p-5 space-y-4 ${showFilters ? 'block' : 'hidden'} md:block`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 mb-1">Fecha Inicio</label>
                            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 mb-1">Fecha Fin</label>
                            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 mb-1">OLPN</label>
                            <input type="text" name="olpn" value={filters.olpn} onChange={handleFilterChange} placeholder="Filtrar por OLPN..." className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-sm text-white placeholder-zinc-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 mb-1">Usuario</label>
                            <input type="text" name="usuario" value={filters.usuario} onChange={handleFilterChange} placeholder="Filtrar por usuario..." className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-sm text-white placeholder-zinc-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 mb-1">Tipo Diferencia</label>
                            <select name="tipoDiferencia" value={filters.tipoDiferencia} onChange={handleFilterChange} className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-sm text-white">
                                <option value="">Todas</option>
                                <option value="Sobrante en Olpn">Sobrante</option>
                                <option value="Faltante en Olpn">Faltante</option>
                                <option value="Fechas de vencimiento diferentes">Fechas Dif.</option>
                                <option value="Item no existente en la Olpn">Item Nuevo</option>
                                <option value="Sin diferencias">Sin Diferencias</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 mb-1">Recuento</label>
                            <select name="recuento" value={filters.recuento} onChange={handleFilterChange} className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-sm text-white">
                                <option value="">Todos</option>
                                <option value="SI">Sí</option>
                                <option value="NO">No</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                         <div className="flex gap-3">
                            <button onClick={handleExport} disabled={audits.length === 0} className="flex items-center gap-2 text-sm bg-green-800/50 hover:bg-green-700 text-green-300 hover:text-white px-4 py-2 rounded-lg border border-green-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><DownloadIcon className="w-4 h-4" /> Exportar</button>
                             <button onClick={() => fetchAudits()} className="flex items-center gap-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-4 py-2 rounded-lg border border-zinc-600 transition-colors"><RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Actualizar</button>
                         </div>
                        <div className="flex gap-3">
                            <button onClick={handleClearFilters} className="bg-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm hover:bg-zinc-600 transition-colors border border-zinc-600">Ver todo</button>
                            <button onClick={() => fetchAudits(filters)} className="bg-sky-600 text-white font-bold px-5 py-2 rounded text-sm hover:bg-sky-700 transition-colors">Aplicar Filtros</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- LIST SECTION --- */}
            {isLoading ? (
                <div className="bg-zinc-800 rounded-xl shadow-lg border border-zinc-700 p-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-500 mx-auto mb-2"></div>
                    <p className="text-zinc-400">Cargando auditorías...</p>
                </div>
            ) : uniqueAuditKeys.length === 0 ? (
                <div className="bg-zinc-800 rounded-xl shadow-lg border border-zinc-700 p-10 text-center">
                    <p className="text-zinc-400">No se encontraron auditorías con los filtros actuales.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {uniqueAuditKeys.map(key => {
                        const group = groupedAudits[key];
                        const header = group[0];
                        const hasDifferences = group.some(r => r.TipoDiferencia !== 'Sin diferencias');
                        const canRecount = hasDifferences && header.Recuento === 'NO';
                        const quality = header.PorcentajeCalidad;

                        const aggregatedTotals = group.reduce((acc, record) => {
                            try {
                                const audited = JSON.parse(record.RawAuditado || '{}');
                                acc.audited.cajas += audited.boxes || 0;
                                acc.audited.packs += audited.packs || 0;
                                acc.audited.unidades += audited.units || 0;
                            } catch (e) { /* Ignore parsing errors */ }

                            try {
                                const original = JSON.parse(record.RawOriginal || '{}');
                                acc.original.cajas += original.caja || 0;
                                acc.original.packs += original.pack || 0;
                                acc.original.unidades += original.unidades || 0;
                            } catch (e) { /* Ignore parsing errors */ }
                            
                            return acc;
                        }, {
                            audited: { cajas: 0, packs: 0, unidades: 0 },
                            original: { cajas: 0, packs: 0, unidades: 0 }
                        });

                        const auditedBreakdown = formatBreakdown(aggregatedTotals.audited);
                        const manhattanBreakdown = formatBreakdown(aggregatedTotals.original);

                        return (
                             <div key={key} className="bg-zinc-800 rounded-xl shadow-lg border border-zinc-700">
                                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-4">
                                            <div className="text-center pr-4 border-r border-zinc-700">
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">% Calidad</p>
                                                <span className={`font-mono font-extrabold text-2xl ${getQualityColor(quality)}`}>{quality !== null ? `${quality}%` : '-'}</span>
                                            </div>
                                            <div>
                                                <h3 className="font-mono font-bold text-white text-lg">{header.OlpnId}</h3>
                                                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                                                    <span>{header.Sector}</span>
                                                    {header.Recuento === 'SI' && <span className="px-1.5 py-0.5 font-bold bg-purple-900 text-purple-300 rounded">RECUENTO</span>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                                                    <span className={`px-2 py-0.5 rounded-full font-bold ${header.EstadoAuditoria === 'Olpn con diferencias' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50' : 'bg-green-900/50 text-green-300 border border-green-700/50'}`}>
                                                        {header.EstadoAuditoria.replace('Olpn ', '')}
                                                    </span>
                                                    <span className="text-zinc-600 hidden sm:inline">|</span>
                                                    <div className="w-full sm:w-auto flex flex-wrap gap-x-3 gap-y-1">
                                                        <span className="text-zinc-400">Auditado: <span className="font-bold text-white">{auditedBreakdown}</span></span>
                                                        <span className="text-zinc-400">Sistema: <span className="font-bold text-white">{manhattanBreakdown}</span></span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-auto mt-4 sm:mt-0 flex-shrink-0 flex sm:flex-col items-end sm:text-right">
                                        <div className="flex-1 sm:flex-auto">
                                            <p className="text-sm text-zinc-200">{header.Usuario}</p>
                                            <p className="text-xs text-zinc-500">{new Date(header.FechaHoraAuditoria).toLocaleString('es-UY')}</p>
                                        </div>
                                        <div className="flex gap-2 mt-0 sm:mt-2">
                                             <button onClick={() => setSelectedAuditKey(key)} className="inline-flex items-center justify-center gap-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded-md border border-zinc-600 transition-colors"><EyeIcon className="w-4 h-4"/> Ver</button>
                                             <button onClick={() => handleRecount(header.OlpnId)} disabled={!canRecount} className={`inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-md border transition-colors ${canRecount ? 'bg-sky-900/30 hover:bg-sky-800/40 text-sky-300 border-sky-800/50 cursor-pointer' : 'bg-zinc-800 text-zinc-600 border-zinc-700 cursor-not-allowed'}`}><RefreshIcon className="w-4 h-4"/> Recontar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default QualityAuditsDashboard;
