import React, { useState } from 'react';
import { useDownloadManagerContext } from '../hooks/useDownloadManager';
import { useAuthContext } from '../hooks/useAuth';
import { DownloadTask, TaskStatus, DownloadType, UserRole, iLPNArticle } from '../types';
import { FileUpload } from './FileUpload';
import { useNavigate } from 'react-router-dom';
import { PlayIcon, ClockIcon, CheckCircleIcon, UserIcon, RefreshIcon } from './Icons';

const TaskStatusBadge: React.FC<{ status: TaskStatus }> = ({ status }: { status: TaskStatus }) => {
  const baseClasses = 'px-2 py-0.5 text-xs font-semibold rounded-full inline-flex items-center gap-1.5';
  if (status === TaskStatus.PENDING) {
    return <span className={`${baseClasses} bg-yellow-400/10 text-yellow-300 ring-1 ring-inset ring-yellow-400/20`}><ClockIcon className="w-3.5 h-3.5"/> Pendiente</span>;
  }
  if (status === TaskStatus.IN_PROGRESS) {
    return <span className={`${baseClasses} bg-sky-400/10 text-sky-300 ring-1 ring-inset ring-sky-400/20`}><PlayIcon className="w-3.5 h-3.5"/> En Progreso</span>;
  }
  if (status === TaskStatus.COMPLETED) {
    return <span className={`${baseClasses} bg-green-400/10 text-green-300 ring-1 ring-inset ring-green-400/20`}><CheckCircleIcon className="w-3.5 h-3.5"/> Completado</span>;
  }
  return <span className={`${baseClasses} bg-gray-400/10 text-gray-300 ring-1 ring-inset ring-gray-400/20`}>Desconocido</span>;
};

const DownloadTypeBadge: React.FC<{ type: DownloadType }> = ({ type }: { type: DownloadType }) => {
    let colors = 'bg-zinc-400/10 text-zinc-300 ring-1 ring-inset ring-zinc-400/20';
    switch (type) {
        case DownloadType.TATA:
            colors = 'bg-blue-400/10 text-blue-300 ring-1 ring-inset ring-blue-400/20';
            break;
        case DownloadType.HYG:
            colors = 'bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/20';
            break;
        case DownloadType.BAS:
            colors = 'bg-lime-400/10 text-lime-300 ring-1 ring-inset ring-lime-400/20';
            break;
    }
    return <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${colors}`}>{type}</span>;
}

const TaskCard: React.FC<{ task: DownloadTask }> = ({ task }: { task: DownloadTask }) => {
    const navigate = useNavigate();
    const { startTask } = useDownloadManagerContext();

    const handleStart = () => {
        startTask(task.id);
        navigate(`/download/${task.id}`);
    };

    const handleResume = () => {
        navigate(`/download/${task.id}`);
    };
    
    const totalArticles = task.articles.length;
    const processedArticles = new Set([...task.openILPNs, ...task.closedILPNs].flatMap(ilpn => ilpn.articles.map((a: iLPNArticle) => a.articleId))).size;
    const progress = totalArticles > 0 ? (processedArticles / totalArticles) * 100 : 0;

    return (
        <div className="bg-zinc-800/80 border border-zinc-700/80 rounded-xl shadow-lg hover:shadow-sky-900/20 hover:border-sky-800/70 transition-all duration-300 flex flex-col group">
            {/* Card Header */}
            <div className="p-4 border-b border-zinc-700 flex justify-between items-center">
                <p className="text-xs text-zinc-500 font-mono" title={task.id}>ID: {task.id.split('-')[0]}-{task.id.split('-')[1]?.slice(-4) || task.id}</p>
                <div className="flex items-center gap-2">
                    <DownloadTypeBadge type={task.downloadType} />
                    <TaskStatusBadge status={task.status} />
                </div>
            </div>

            {/* Card Body */}
            <div className="p-4 flex-grow">
                <h3 className="text-lg font-bold text-zinc-100 truncate" title={task.fileName}>{task.fileName}</h3>
                <div className="mt-2 text-xs text-zinc-400 space-y-1">
                    <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-zinc-500" />
                        <span>Creado por {task.user}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-zinc-500" />
                        <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-sm font-medium text-zinc-300">Progreso</span>
                        <span className="text-sm font-medium text-zinc-400">{processedArticles} / {totalArticles} Items</span>
                    </div>
                    <div className="w-full bg-zinc-700/50 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-sky-600 to-sky-400 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Card Footer */}
            <div className="p-4 border-t border-zinc-700/80">
                {task.status === TaskStatus.PENDING && (
                    <button onClick={handleStart} className="w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-500 flex items-center justify-center gap-2 transition-colors disabled:bg-sky-400/70 disabled:cursor-not-allowed">
                        <PlayIcon className="w-5 h-5"/> Iniciar Tarea
                    </button>
                )}
                {task.status === TaskStatus.IN_PROGRESS && (
                     <button onClick={handleResume} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-500 flex items-center justify-center gap-2 transition-colors">
                        <PlayIcon className="w-5 h-5"/> Continuar Tarea
                    </button>
                )}
                 {task.status === TaskStatus.COMPLETED && (
                     <button onClick={() => navigate('/reports')} className="w-full bg-zinc-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-zinc-500 flex items-center justify-center gap-2 transition-colors">
                        Ver Reporte
                    </button>
                )}
            </div>
        </div>
    );
};


export const Dashboard: React.FC = () => {
    const { tasks, createTask, isLoading, fetchTasks } = useDownloadManagerContext();
    const { currentUser } = useAuthContext();
    const [file, setFile] = useState<File | null>(null);
    const [downloadType, setDownloadType] = useState<DownloadType | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = (selectedFile: File) => {
        setFile(selectedFile);
        setDownloadType(null);
        setError(null);
    };

    const handleCreateTask = async () => {
        if (file && downloadType) {
            setError(null);
            try {
                await createTask(file, downloadType);
                setFile(null);
                setDownloadType(null);
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("Ocurrió un error inesperado al crear la tarea.");
                }
            }
        } else {
            setError("Por favor seleccione un archivo y un tipo de descarga.");
        }
    };
    
    const inProgressTasks = tasks.filter((t: DownloadTask) => t.status === TaskStatus.IN_PROGRESS);
    const pendingTasks = tasks.filter((t: DownloadTask) => t.status === TaskStatus.PENDING);
    const canCreateTask = currentUser && [UserRole.ADMIN, UserRole.MONITOR_IMPO].includes(currentUser.role);

    return (
        <div className="p-6 sm:p-8">
             <div className="flex justify-between items-start mb-12">
                <div>
                    <h1 className="text-4xl font-extrabold text-white">Descarga de importaciones</h1>
                    <p className="text-xl text-zinc-400 mt-2">Gestione las tareas de descarga activas o cree una nueva.</p>
                </div>
                <button 
                    onClick={() => fetchTasks()} 
                    className="p-3 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-600"
                    disabled={isLoading}
                    title="Actualizar tareas"
                >
                    <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {canCreateTask && (
                <div className="bg-zinc-800 p-6 rounded-xl shadow-lg mb-8">
                    <h2 className="text-3xl font-bold text-white mb-1">Crear Nueva Tarea</h2>
                    <p className="text-zinc-400 mb-8">Sube el archivo Excel y selecciona el tipo de descarga correspondiente.</p>
                    <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
                    
                    {file && !isLoading && (
                        <div className="mt-6 flex flex-col items-center">
                            <div>
                                <h3 className="text-lg font-medium text-zinc-200 mb-3 text-center">Seleccione el Tipo de Descarga</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* FIX: Use Object.values to iterate over the enum for better type safety. */}
                                    {Object.values(DownloadType).map(typeValue => (
                                        <button 
                                            key={typeValue}
                                            onClick={() => setDownloadType(typeValue)}
                                            className={`px-6 py-4 rounded-lg font-semibold border-2 transition-all duration-200 text-base ${
                                                downloadType === typeValue 
                                                ? 'bg-sky-600 text-white border-sky-700 shadow-lg' 
                                                : 'bg-zinc-700 border-zinc-600 hover:bg-zinc-600 hover:border-zinc-500'
                                            }`}
                                        >
                                            {typeValue}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

                            <button 
                                onClick={handleCreateTask} 
                                className="mt-6 bg-sky-600 text-white font-bold py-4 px-8 rounded-lg hover:bg-sky-700 transition-colors shadow-md disabled:bg-sky-400 disabled:cursor-not-allowed disabled:shadow-none text-lg"
                                disabled={!downloadType || isLoading}
                            >
                                {isLoading ? "Creando..." : "Crear Tarea"}
                            </button>
                        </div>
                    )}
                    {isLoading && file && (
                        <div className="mt-6 text-center text-zinc-400">
                            Procesando archivo y guardando en la base de datos...
                        </div>
                    )}
                </div>
            )}
            
            {isLoading && tasks.length === 0 ? (
                 <div className="text-center py-10 bg-zinc-800 rounded-lg">
                    <svg className="animate-spin h-8 w-8 text-sky-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-zinc-400">Cargando tareas...</p>
                </div>
            ) : (
                <>
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-white mb-6">Tareas en Progreso</h2>
                        {inProgressTasks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                                {inProgressTasks.map((task: DownloadTask) => <TaskCard key={task.id} task={task} />)}
                            </div>
                        ) : (
                            <p className="text-zinc-400 text-center py-4 bg-zinc-800 rounded-lg">No hay tareas en progreso.</p>
                        )}
                    </div>

                    <div>
                        <h2 className="text-3xl font-bold text-white mb-6">Tareas Pendientes</h2>
                        {pendingTasks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                                {pendingTasks.map((task: DownloadTask) => <TaskCard key={task.id} task={task} />)}
                            </div>
                        ) : (
                            <p className="text-zinc-400 text-center py-4 bg-zinc-800 rounded-lg">No hay tareas pendientes.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};