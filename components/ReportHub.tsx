import React from 'react';
import { Link } from 'react-router-dom';
import { FileIcon, SnowflakeIcon } from './Icons';
import { useAuthContext } from '../hooks/useAuth';
import { UserRole } from '../types';

const ReportHub: React.FC = () => {
    const { currentUser } = useAuthContext();
    const role = currentUser?.role;

    const canSeeImportsReport = role === UserRole.ADMIN || role === UserRole.OPERADOR_IMPO || role === UserRole.MONITOR_IMPO;
    const canSeeFrescosReport = role === UserRole.ADMIN || role === UserRole.FRESCOS;
    const canSeeQualityReports = role !== UserRole.TRANSPORTE;


    const ReportCard: React.FC<{ to: string, icon: React.ReactNode, title: string, description: string }> = ({ to, icon, title, description }) => (
        <Link to={to} className="block group bg-zinc-800 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transform transition-all duration-300 p-8">
            <div className="flex items-center justify-center h-20 w-20 rounded-full bg-green-900/50 mb-8 group-hover:bg-green-800/80 transition-colors duration-300">
                {icon}
            </div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-2">{title}</h3>
            <p className="text-lg text-zinc-400">{description}</p>
        </Link>
    );

    return (
        <div className="p-6 sm:p-8">
            <div className="mb-12">
                <h1 className="text-4xl font-extrabold text-white">Menú de Reportes</h1>
                <p className="text-xl text-zinc-400 mt-2">Seleccione un reporte para ver los detalles.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {canSeeImportsReport && (
                    <ReportCard 
                        to="/reports/imports"
                        icon={<FileIcon className="h-10 w-10 text-green-400" />}
                        title="Importaciones - Detalle de descargas"
                        description="Ver el historial y los detalles de las tareas de importación completadas."
                    />
                )}
                {canSeeFrescosReport && (
                    <ReportCard 
                        to="/reports/frescos-distribution"
                        icon={<SnowflakeIcon className="h-10 w-10 text-green-400" />}
                        title="Frescos - Detalle de Reparto de Olpns"
                        description="Ver el historial de movimientos y combinaciones de OLPNs en el área de Frescos."
                    />
                )}
                {canSeeQualityReports && (
                    <>
                        {(role === UserRole.ADMIN || role === UserRole.CALIDAD) && (
                            <>
                                <ReportCard 
                                    to="/reports/quality-looker-secos"
                                    icon={<FileIcon className="h-10 w-10 text-sky-400" />}
                                    title="Secos - Auditoria Olpns (Looker)"
                                    description="Reporte de auditorías de Secos y BAS optimizado para Looker Studio."
                                />
                                <ReportCard 
                                    to="/reports/quality-looker-frescos"
                                    icon={<FileIcon className="h-10 w-10 text-sky-400" />}
                                    title="Frescos - Auditoria Olpns (Looker)"
                                    description="Reporte de auditorías de Frescos optimizado para Looker Studio."
                                />
                            </>
                        )}
                        <ReportCard 
                            to="/reports/location-audit"
                            icon={<FileIcon className="h-10 w-10 text-sky-400" />}
                            title="Auditoría de Ubicaciones"
                            description="Reporte detallado de discrepancias encontradas en auditorías de ubicación."
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default ReportHub;