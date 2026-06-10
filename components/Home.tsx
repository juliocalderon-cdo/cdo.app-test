

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '../hooks/useAuth';
import { UploadIcon, TruckIcon, SnowflakeIcon, CpuChipIcon, ClipboardListIcon } from './Icons';
import { UserRole } from '../types';

const Home: React.FC = () => {
    const { currentUser } = useAuthContext();

    const role = currentUser?.role;
    const canSeeImportaciones = role === UserRole.ADMIN || role === UserRole.OPERADOR_IMPO || role === UserRole.MONITOR_IMPO;
    const canSeeTransporte = role === UserRole.ADMIN || role === UserRole.TRANSPORTE;
    const canSeeFrescos = role === UserRole.ADMIN || role === UserRole.FRESCOS;
    const canSeeAgents = role === UserRole.ADMIN;
    const canSeeCalidad = role !== UserRole.TRANSPORTE;


    const NavCard: React.FC<{ to: string, icon: React.ReactNode, title: string, description: string, tag?: string }> = ({ to, icon, title, description, tag }) => (
        <Link to={to} className="relative block group bg-zinc-800 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transform transition-all duration-300 p-6">
            {tag && (
                <span className="absolute top-4 right-4 bg-sky-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                    {tag}
                </span>
            )}
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-sky-900/50 mb-6 group-hover:bg-sky-800/80 transition-colors duration-300">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-zinc-100 mb-2">{title}</h3>
            <p className="text-base text-zinc-400">{description}</p>
        </Link>
    );

    return (
        <div className="p-6 sm:p-8">
            <div className="mb-12">
                <h1 className="text-4xl font-extrabold text-white">APP CDO</h1>
                <p className="text-xl text-zinc-400 mt-2">Bienvenido, {currentUser?.name || 'Usuario'}.</p>
            </div>

            <div className="space-y-12">
                {/* --- Sección de Agentes IA --- */}
                {canSeeAgents && (
                    <div>
                        <h2 className="text-2xl font-bold text-white border-b-2 border-zinc-700 pb-3 mb-6">Agentes IA</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            <NavCard
                                to="/agents"
                                icon={<CpuChipIcon className="h-8 w-8 text-sky-400" />}
                                title="Analista de Impacto v1"
                                description="Chat interactivo para evaluar cambios operativos subiendo reportes."
                            />
                            <NavCard
                                to="/agents-v2"
                                icon={<CpuChipIcon className="h-8 w-8 text-sky-400" />}
                                title="Analista de Impacto v2"
                                description="Análisis directo desde base histórica de Manhattan con indicadores clave."
                                tag="Data Driven"
                            />
                        </div>
                    </div>
                )}

                {/* --- Sección de Calidad --- */}
                {canSeeCalidad && (
                    <div>
                        <h2 className="text-2xl font-bold text-white border-b-2 border-zinc-700 pb-3 mb-6">Calidad</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {(role === UserRole.ADMIN || role === UserRole.CALIDAD) && (
                                <>
                                    <NavCard 
                                        to="/quality/select-sector"
                                        icon={<ClipboardListIcon className="h-8 w-8 text-sky-400" />}
                                        title="Auditoría de OLPNS"
                                        description="Verifique contenido de OLPNS y detecte diferencias con Manhattan."
                                    />
                                    <NavCard 
                                        to="/quality/reverse-logistics"
                                        icon={<ClipboardListIcon className="h-8 w-8 text-sky-400" />}
                                        title="Logística Inversa"
                                        description="Recepción de devoluciones de tienda a CDO e impacto en Manhattan."
                                    />
                                </>
                            )}
                            <NavCard 
                                to="/quality/location-audit"
                                icon={<ClipboardListIcon className="h-8 w-8 text-sky-400" />}
                                title="Auditoría de Ubicaciones"
                                description="Validación de inventario por ubicación y detección de diferencias."
                            />
                        </div>
                    </div>
                )}
                
                {/* --- Sección de Importaciones --- */}
                {canSeeImportaciones && (
                    <div>
                        <h2 className="text-2xl font-bold text-white border-b-2 border-zinc-700 pb-3 mb-6">Importaciones</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            <NavCard 
                                to="/imports"
                                icon={<UploadIcon className="h-8 w-8 text-sky-400" />}
                                title="Descarga de importaciones"
                                description="Cree y gestione tareas de descarga de archivos de importación."
                            />
                        </div>
                    </div>
                )}


                {/* --- Sección de Transporte --- */}
                 {canSeeTransporte && (
                    <div>
                        <h2 className="text-2xl font-bold text-white border-b-2 border-zinc-700 pb-3 mb-6">Transporte</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            <NavCard 
                                to="/manhattan-shipments"
                                icon={<TruckIcon className="h-8 w-8 text-sky-400" />}
                                title="Envíos y Citas Manhattan"
                                description="Cargue y gestione envíos para la expedición de Manhattan."
                            />
                        </div>
                    </div>
                 )}

                 {/* --- Sección de Frescos --- */}
                 {canSeeFrescos && (
                    <div>
                        <h2 className="text-2xl font-bold text-white border-b-2 border-zinc-700 pb-3 mb-6">Frescos</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            <NavCard 
                                to="/frescos/olpn-distribution"
                                icon={<SnowflakeIcon className="h-8 w-8 text-sky-400" />}
                                title="Reparto de OLPNs"
                                description="Guía para la distribución de OLPNs desde un pallet a las ubicaciones de packing."
                            />
                        </div>
                    </div>
                 )}
            </div>
        </div>
    );
};

export default Home;