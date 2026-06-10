
import React, { useState } from 'react';
import { sheets as googleSheetsService } from '../services/googleSheetsService';
import { AuditRecord, UserRole } from '../types';
import { RefreshIcon, DownloadIcon, CheckCircleIcon, XCircleIcon } from './Icons';
import { exportSecosLookerReport, exportFrescosLookerReport } from '../services/excelGenerator';
import { useAuthContext } from '../hooks/useAuth';

interface QualityLookerReportsProps {
    reportType: 'secos' | 'frescos';
}

const QualityLookerReports: React.FC<QualityLookerReportsProps> = ({ reportType }) => {
    const { currentUser } = useAuthContext();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [alertMessage, setAlertMessage] = useState<{ type: 'error' | 'warning' | 'success', msg: string } | null>(null);

    const reportTitle = reportType === 'secos' 
        ? "Secos - Auditoria Olpns (Looker)" 
        : "Frescos - Auditoria Olpns (Looker)";

    const handleDownload = async () => {
        setAlertMessage(null);
        if (!startDate || !endDate) {
            setAlertMessage({ type: 'warning', msg: "Por favor, seleccione un rango de fechas obligatorio." });
            return;
        }

        setIsLoading(true);
        try {
            const sectors = reportType === 'secos' ? ['SECOS', 'BAS'] : ['FRESCOS'];
            
            // Fetch records for each sector and combine them
            let allRecords: AuditRecord[] = [];
            for (const sector of sectors) {
                const data = await googleSheetsService.getAuditRecords({
                    startDate,
                    endDate,
                    sector: sector as any
                });
                allRecords = [...allRecords, ...data];
            }

            if (allRecords.length === 0) {
                setAlertMessage({ type: 'warning', msg: "No se encontraron registros para el rango de fechas seleccionado." });
                return;
            }

            if (reportType === 'secos') {
                exportSecosLookerReport(allRecords);
            } else {
                exportFrescosLookerReport(allRecords);
            }
            setAlertMessage({ type: 'success', msg: "Reporte generado con éxito." });
        } catch (error) {
            console.error("Error generating report:", error);
            setAlertMessage({ type: 'error', msg: "Hubo un error al generar el reporte." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 sm:p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-white">{reportTitle}</h1>
                <p className="text-zinc-400 mt-2">Descargue el reporte en formato compatible con Looker Studio.</p>
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

            <div className="bg-zinc-800 rounded-xl shadow-lg p-6 border border-zinc-700 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-2">Fecha Inicio (Obligatorio)</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-2">Fecha Fin (Obligatorio)</label>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={handleDownload}
                        disabled={isLoading || !startDate || !endDate}
                        className="flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <RefreshIcon className="w-5 h-5 animate-spin" />
                        ) : (
                            <DownloadIcon className="w-5 h-5" />
                        )}
                        <span>{isLoading ? 'Generando...' : 'Descargar Excel'}</span>
                    </button>
                </div>
            </div>

            <div className="mt-8 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50 max-w-2xl">
                <h3 className="text-sm font-bold text-zinc-300 mb-2">Información del Reporte</h3>
                <ul className="text-xs text-zinc-500 space-y-1 list-disc pl-4">
                    <li>Este reporte incluye todas las auditorías realizadas en el periodo seleccionado.</li>
                    <li>Los datos están formateados para su uso directo en tableros de Looker Studio.</li>
                    <li>Sectores incluidos: {reportType === 'secos' ? 'Secos y BAS' : 'Frescos'}.</li>
                </ul>
            </div>
        </div>
    );
};

export default QualityLookerReports;
