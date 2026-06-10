
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuditSector } from '../types';
import { BoxIcon, SnowflakeIcon, TruckIcon } from './Icons';

const SectorCard: React.FC<{ sector: AuditSector; icon: React.ReactNode; onClick: () => void; }> = ({ sector, icon, onClick }) => (
    <div
        onClick={onClick}
        className="block group bg-zinc-800 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transform transition-all duration-300 p-8 cursor-pointer text-center flex flex-col items-center justify-center"
    >
        <div className="flex items-center justify-center h-20 w-20 rounded-full bg-sky-900/50 mb-6 group-hover:bg-sky-800/80 transition-colors duration-300">
            {icon}
        </div>
        <h3 className="text-2xl font-bold text-zinc-100">{sector}</h3>
    </div>
);

const QualitySectorSelection: React.FC = () => {
    const navigate = useNavigate();

    const handleSelectSector = (sector: AuditSector) => {
        navigate('/quality/audits', { state: { sector } });
    };

    return (
        <div className="p-6 sm:p-8">
            <div className="mb-12 text-center">
                <h1 className="text-4xl font-extrabold text-white">Seleccionar Sector</h1>
                <p className="text-xl text-zinc-400 mt-2">Elija el sector en el que desea realizar o ver auditorías.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                <SectorCard
                    sector="SECOS"
                    icon={<BoxIcon className="h-10 w-10 text-sky-400" />}
                    onClick={() => handleSelectSector('SECOS')}
                />
                <SectorCard
                    sector="FRESCOS"
                    icon={<SnowflakeIcon className="h-10 w-10 text-sky-400" />}
                    onClick={() => handleSelectSector('FRESCOS')}
                />
                <SectorCard
                    sector="BAS"
                    icon={<TruckIcon className="h-10 w-10 text-sky-400" />}
                    onClick={() => handleSelectSector('BAS')}
                />
            </div>
        </div>
    );
};

export default QualitySectorSelection;