import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDownloadManagerContext } from '../hooks/useDownloadManager';
import { iLPN, Article, TaskStatus, iLPNArticle, IlpnType } from '../types';
import { BarcodeIcon, CheckCircleIcon, LockClosedIcon, RefreshIcon } from './Icons';

// --- START: SHARED COMPONENTS WITHIN VIEW ---

export const BarcodePrefix: React.FC<{ barcode?: string }> = ({ barcode }: { barcode?: string }) => {
    if (!barcode || barcode.length < 3) return null;
    return (
        <span className="font-bold text-sky-400 mr-2 flex-shrink-0">({barcode.slice(-3)})</span>
    );
};

// --- START: MODALS & NOTIFICATIONS ---

const ToastNotification: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 4000); // Hide after 4 seconds

        return () => clearTimeout(timer);
    }, [message, onDismiss]);

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed top-24 right-5 z-[100] bg-sky-600 text-white py-3 px-5 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in-down"
        >
            <CheckCircleIcon className="w-6 h-6 flex-shrink-0"/>
            <span className="text-sm font-medium">{message}</span>
        </div>
    );
};

interface ProcessingDetails {
    articleId: string;
    crossIlpn: { id: string, quantity: number } | null;
    stockIlpn: { id: string, quantity: number } | null;
}

const ProcessingFlowModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (details: ProcessingDetails) => void;
    article: (Article & { pendingStock: number; pendingCross: number }) | null;
    suggestedStockIlpnId: string | null;
    suggestedCrossIlpnId: string | null;
    error: string | null;
    setError: (message: string | null) => void;
    isIlpnIdUnique: (ilpnId: string) => boolean;
}> = ({ isOpen, onClose, onConfirm, article, suggestedStockIlpnId, suggestedCrossIlpnId, error, setError, isIlpnIdUnique }) => {
    const [step, setStep] = useState<'cross' | 'stock'>('cross');

    const [crossIlpnId, setCrossIlpnId] = useState('');
    const [crossQuantity, setCrossQuantity] = useState(0);
    const [stockIlpnId, setStockIlpnId] = useState('');
    const [stockQuantity, setStockQuantity] = useState(0);

    const crossIlpnInputRef = useRef<HTMLInputElement>(null);
    const stockIlpnInputRef = useRef<HTMLInputElement>(null);

    const needsCrossDock = article && article.pendingCross > 0;
    const needsStock = article && article.pendingStock > 0;

    useEffect(() => {
        if (isOpen && article) {
            setError(null);
            
            // Set quantities
            setCrossQuantity(article.pendingCross);
            setStockQuantity(article.pendingStock);

            // Set iLPNs based on suggestions
            setCrossIlpnId(suggestedCrossIlpnId || '');
            setStockIlpnId(suggestedStockIlpnId || '');
            
            // Determine initial step
            const initialStep = needsCrossDock ? 'cross' : 'stock';
            setStep(initialStep);

            // Focus the appropriate input
            setTimeout(() => {
                if (initialStep === 'cross') {
                    crossIlpnInputRef.current?.focus();
                } else {
                    stockIlpnInputRef.current?.focus();
                }
            }, 100);
        }
    }, [isOpen, article, suggestedStockIlpnId, suggestedCrossIlpnId, setError]);

    if (!isOpen || !article) return null;

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        if (crossQuantity > article.pendingCross) {
            setError('La cantidad de Cross-Dock no puede exceder lo pendiente.');
            return;
        }
        if (crossQuantity > 0 && (!crossIlpnId || crossIlpnId.length !== 18)) {
            setError('El iLPN de Cross-Dock es obligatorio y debe tener 18 caracteres.');
            return;
        }
        if (crossQuantity > 0 && !suggestedCrossIlpnId && !isIlpnIdUnique(crossIlpnId)) {
            setError(`El iLPN de Cross-Dock "${crossIlpnId}" ya existe en el sistema.`);
            return;
        }

        if (needsStock) {
            setStep('stock');
            setTimeout(() => stockIlpnInputRef.current?.focus(), 100);
        } else {
            // If no stock is needed, we can confirm from here
            handleConfirm();
        }
    };
    
    const handleConfirm = (e?: React.FormEvent) => {
        e?.preventDefault();
        setError(null);

        if (stockQuantity > article.pendingStock) {
            setError('La cantidad de Stock no puede exceder lo pendiente.');
            return;
        }
        if (stockQuantity > 0 && (!stockIlpnId || stockIlpnId.length !== 18)) {
            setError('El iLPN de Stock es obligatorio y debe tener 18 caracteres.');
            return;
        }
        if (stockQuantity > 0 && !suggestedStockIlpnId && !isIlpnIdUnique(stockIlpnId)) {
            setError(`El iLPN de Stock "${stockIlpnId}" ya existe en el sistema.`);
            return;
        }

        const details: ProcessingDetails = {
            articleId: article.id,
            crossIlpn: crossQuantity > 0 ? { id: crossIlpnId.toUpperCase(), quantity: crossQuantity } : null,
            stockIlpn: stockQuantity > 0 ? { id: stockIlpnId.toUpperCase(), quantity: stockQuantity } : null,
        };
        onConfirm(details);
    };

    const renderFooter = () => {
        if (step === 'cross') {
            return (
                <div className="p-4 bg-zinc-700/50 flex justify-end gap-3 rounded-b-lg">
                    <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-600 rounded-md border border-zinc-600">
                        Cancelar
                    </button>
                    <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">
                        {needsStock ? 'Siguiente (Stock)' : 'Confirmar'}
                    </button>
                </div>
            );
        }
        if (step === 'stock') {
            return (
                <div className="p-4 bg-zinc-700/50 flex justify-end gap-3 rounded-b-lg">
                     <button type="button" onClick={needsCrossDock ? () => setStep('cross') : onClose} className="px-5 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-600 rounded-md border border-zinc-600">
                        {needsCrossDock ? 'Volver (Cross)' : 'Cancelar'}
                    </button>
                    <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">
                        Confirmar
                    </button>
                </div>
            )
        }
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-md m-4" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
                <form onSubmit={step === 'cross' ? handleNextStep : handleConfirm}>
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-white">Procesar Artículo</h3>
                        <div className="mt-4 text-zinc-400 bg-zinc-700/50 p-4 rounded-lg">
                            <p className="font-semibold text-zinc-200">{article.sku}</p>
                            <p className="text-sm">{article.description}</p>
                        </div>

                        <div className="mt-4 p-3 bg-zinc-900/70 border border-zinc-700 rounded-lg flex justify-around text-center">
                            <div>
                                <p className="text-xs text-amber-300 uppercase font-bold tracking-wider">Pendiente Cross</p>
                                <p className="text-2xl font-bold text-amber-400">
                                  {article.pendingCross} <span className="text-lg text-zinc-400">/ {article.quantityCross}</span>
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-sky-300 uppercase font-bold tracking-wider">Pendiente Stock</p>
                                <p className="text-2xl font-bold text-sky-400">
                                  {article.pendingStock} <span className="text-lg text-zinc-400">/ {article.quantityStock}</span>
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 space-y-4">
                           {step === 'cross' && needsCrossDock && (
                                <div className="p-4 rounded-lg bg-amber-900/30 ring-1 ring-amber-500/50">
                                    <p className="text-sm font-medium text-amber-200 mb-2">Paso 1: Destino Cross-Dock</p>
                                    
                                    <label htmlFor="cross-ilpn-id" className="text-xs font-medium text-zinc-300">iLPN Cross-Dock</label>
                                    <input
                                        ref={crossIlpnInputRef}
                                        id="cross-ilpn-id"
                                        type="text"
                                        value={crossIlpnId}
                                        onChange={(e) => setCrossIlpnId(e.target.value.toUpperCase())}
                                        maxLength={18}
                                        disabled={!!suggestedCrossIlpnId}
                                        className={`w-full px-4 py-2 mt-1 border rounded-lg bg-zinc-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition border-zinc-600 disabled:bg-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed`}
                                    />
                                     <p className="text-xs text-zinc-400 mt-1 text-right">Caracteres: {crossIlpnId.length} / 18</p>
                                    
                                     <label htmlFor="cross-quantity" className="text-xs font-medium text-zinc-300 mt-2 block">Cantidad Cajas Cross</label>
                                     <input
                                        id="cross-quantity"
                                        type="number"
                                        value={crossQuantity}
                                        onChange={(e) => setCrossQuantity(parseInt(e.target.value, 10) || 0)}
                                        min="0"
                                        max={article.pendingCross}
                                        className={`w-full px-4 py-2 mt-1 border rounded-lg bg-zinc-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition border-zinc-600`}
                                    />
                                </div>
                            )}
                            {step === 'stock' && needsStock && (
                                <div className="p-4 rounded-lg bg-sky-900/30 ring-1 ring-sky-500/50">
                                    <p className="text-sm font-medium text-sky-200 mb-2">Paso 2: Destino Stock</p>
                                    
                                    <label htmlFor="stock-ilpn-id" className="text-xs font-medium text-zinc-300">iLPN Stock</label>
                                    <input
                                        ref={stockIlpnInputRef}
                                        id="stock-ilpn-id"
                                        type="text"
                                        value={stockIlpnId}
                                        onChange={(e) => setStockIlpnId(e.target.value.toUpperCase())}
                                        maxLength={18}
                                        disabled={!!suggestedStockIlpnId}
                                        className={`w-full px-4 py-2 mt-1 border rounded-lg bg-zinc-900 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition border-zinc-600 disabled:bg-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed`}
                                    />
                                     <p className="text-xs text-zinc-400 mt-1 text-right">Caracteres: {stockIlpnId.length} / 18</p>
                                
                                     <label htmlFor="stock-quantity" className="text-xs font-medium text-zinc-300 mt-2 block">Cantidad Cajas Stock</label>
                                     <input
                                        id="stock-quantity"
                                        type="number"
                                        value={stockQuantity}
                                        onChange={(e) => setStockQuantity(parseInt(e.target.value, 10) || 0)}
                                        min="0"
                                        max={article.pendingStock}
                                        className={`w-full px-4 py-2 mt-1 border rounded-lg bg-zinc-900 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition border-zinc-600`}
                                    />
                                </div>
                            )}
                        </div>

                        {error && <p className="text-red-500 text-sm mt-3 p-3 bg-red-900/30 rounded-md">{error}</p>}
                    </div>
                    {renderFooter()}
                </form>
            </div>
        </div>
    );
};


const IlpnDetailModal: React.FC<{
    ilpn: iLPN | null;
    onClose: () => void;
}> = ({ ilpn, onClose }: { ilpn: iLPN | null; onClose: () => void; }) => {
    if (!ilpn) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-lg m-4 max-h-[90vh] flex flex-col" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-zinc-700">
                    <h3 className="text-lg font-bold text-white">Detalle de iLPN</h3>
                    <p className="text-sm text-zinc-400 break-all">{ilpn.id}</p>
                </div>
                <div className="p-5 overflow-y-auto space-y-3">
                    <p><span className="font-semibold">Tipo:</span> 
                        <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded-full ${ilpn.type === IlpnType.CROSS ? 'bg-amber-900 text-amber-300' : 'bg-sky-900 text-sky-300'}`}>
                            {ilpn.type}
                        </span>
                    </p>
                    <p><span className="font-semibold">Madre:</span> {ilpn.madre}</p>
                    <p><span className="font-semibold">Creado:</span> {new Date(ilpn.createdAt).toLocaleString()}</p>
                    <h4 className="font-semibold pt-2">Artículos ({ilpn.articles.reduce((sum: number, a: iLPNArticle) => sum + a.quantity, 0)} cajas):</h4>
                    <ul className="space-y-2">
                        {ilpn.articles.map((article: iLPNArticle, index: number) => (
                            <li key={index} className="flex justify-between items-center bg-zinc-700/50 p-3 rounded-md">
                                <div>
                                    <p className="font-semibold text-zinc-200">{article.sku}</p>
                                    <p className="text-xs text-zinc-400 flex items-baseline" title={article.description}>
                                        <BarcodePrefix barcode={article.barcode} />
                                        <span className="truncate">{article.description}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg">{article.quantity}</p>
                                    <p className="text-xs">cajas</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="p-4 bg-zinc-700/50 flex justify-end rounded-b-lg border-t border-zinc-700">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-600 rounded-md border border-zinc-600">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};


const CloseIlpnConfirmationModal: React.FC<{
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    ilpnId?: string;
}> = ({ isOpen, onConfirm, onCancel, ilpnId }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    ilpnId?: string;
}) => {
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => confirmButtonRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen || !ilpnId) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onCancel}>
            <div className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-md m-4" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white">Confirmar Cierre de iLPN</h3>
                    <p className="mt-4 text-zinc-400">
                        ¿Está seguro que desea cerrar el iLPN <span className="font-bold font-mono text-zinc-300 break-all">{ilpnId}</span>?
                    </p>
                    <p className="mt-2 text-sm text-yellow-400">Esta acción no se puede deshacer. El iLPN no podrá recibir más artículos.</p>
                </div>
                 <div className="p-4 bg-zinc-700/50 flex justify-end gap-3 rounded-b-lg">
                    <button type="button" onClick={onCancel} className="px-5 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-600 rounded-md border border-zinc-600">
                        Cancelar
                    </button>
                    <button ref={confirmButtonRef} type="button" onClick={onConfirm} className="px-5 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-md">
                        Sí, Cerrar iLPN
                    </button>
                </div>
            </div>
        </div>
    );
};

const FinishTaskConfirmationModal: React.FC<{
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    pendingItemsCount: number;
    taskFileName: string;
}> = ({ isOpen, onConfirm, onCancel, pendingItemsCount, taskFileName }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    pendingItemsCount: number;
    taskFileName: string;
}) => {
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => confirmButtonRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onCancel}>
            <div className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-md m-4" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white">Finalizar Tarea de Descarga</h3>
                    <p className="mt-4 text-zinc-400">
                        ¿Está seguro que desea finalizar la tarea para el archivo <span className="font-bold text-zinc-300 break-all">{taskFileName}</span>?
                    </p>
                    {pendingItemsCount > 0 && (
                         <div className="mt-4 p-3 bg-yellow-900/30 border-l-4 border-yellow-500 rounded-md">
                             <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.9c.76 1.355-.213 3.001-1.742 3.001H4.42c-1.53 0-2.502-1.646-1.742-3.001l5.58-9.9zM10 13a1 1 0 11-2 0 1 1 0 012 0zm-1-4a1 1 0 00-1 1v2a1 1 0 102 0v-2a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-300">¡Atención!</h3>
                                    <div className="mt-2 text-sm text-yellow-400">
                                        <p>Aún quedan {pendingItemsCount} tipos de artículos pendientes por procesar. Si finaliza la tarea ahora, se marcarán como no recibidos.</p>
                                    </div>
                                </div>
                            </div>
                         </div>
                    )}
                </div>
                 <div className="p-4 bg-zinc-700/50 flex justify-end gap-3 rounded-b-lg">
                    <button type="button" onClick={onCancel} className="px-5 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-600 rounded-md border border-zinc-600">
                        Cancelar
                    </button>
                    <button ref={confirmButtonRef} type="button" onClick={onConfirm} className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">
                        Sí, Finalizar Tarea
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- START: MAIN VIEW COMPONENT ---

const DownloadView: React.FC = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const {
        getTask,
        fetchTasks,
        isLoading,
        processScannedItem,
        closeILPN,
        completeTask,
        getTotalManifestCount,
        getTotalProcessedCount,
        findSuggestedIlpn,
        isIlpnIdUnique,
        getPendingArticles,
    } = useDownloadManagerContext();

    const [scannedValue, setScannedValue] = useState('');
    const [lastAction, setLastAction] = useState<string | null>(null);
    const [processModalError, setProcessModalError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'pending' | 'openIlpns' | 'closedIlpns'>('pending');
    
    // Modals states
    const [articleToProcess, setArticleToProcess] = useState<(Article & { pendingStock: number; pendingCross: number; }) | null>(null);
    const [suggestedStockIlpn, setSuggestedStockIlpn] = useState<string | null>(null);
    const [suggestedCrossIlpn, setSuggestedCrossIlpn] = useState<string | null>(null);
    const [ilpnToView, setIlpnToView] = useState<iLPN | null>(null);
    const [ilpnToClose, setIlpnToClose] = useState<iLPN | null>(null);
    const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
    
    const scanInputRef = useRef<HTMLInputElement>(null);
    
    const task = useMemo(() => taskId ? getTask(taskId) : null, [taskId, getTask]);

    useEffect(() => {
        if (!task || task.status === TaskStatus.COMPLETED) {
            navigate('/');
        }
        // Focus scan input on load
        scanInputRef.current?.focus();
    }, [task, navigate]);

    if (!task) {
        return <div className="p-8 text-center">Cargando tarea...</div>;
    }

    const pendingArticles = getPendingArticles(task) as (Article & { pendingQuantity: number })[];
    const totalManifest = getTotalManifestCount(task);
    const totalProcessed = getTotalProcessedCount(task);
    const progress = totalManifest > 0 ? (totalProcessed / totalManifest) * 100 : 0;

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        const value = scannedValue.trim();
        if (!value) return;

        const allPendingArticles = getPendingArticles(task, true) as (Article & { pendingStock: number; pendingCross: number; })[];
        
        const foundArticle = allPendingArticles.find(
            a => a.sku === value || a.barcode === value
        );

        if (foundArticle) {
            if (taskId && foundArticle.madre) {
                setSuggestedStockIlpn(findSuggestedIlpn(taskId, foundArticle.madre, IlpnType.STOCK));
                setSuggestedCrossIlpn(findSuggestedIlpn(taskId, foundArticle.madre, IlpnType.CROSS));
            } else {
                setSuggestedStockIlpn(null);
                setSuggestedCrossIlpn(null);
            }
            setArticleToProcess(foundArticle);
        } else {
            alert(`Artículo no encontrado o ya procesado: ${value}`);
        }
        setScannedValue('');
    };

    const handleProcessConfirm = async (details: ProcessingDetails) => {
        try {
            await processScannedItem(task.id, details);
            setLastAction(`Artículo ${details.crossIlpn ? 'CROSS' : ''}${details.crossIlpn && details.stockIlpn ? ' y ' : ''}${details.stockIlpn ? 'STOCK' : ''} procesado.`);
            setArticleToProcess(null);
            setProcessModalError(null);
        } catch (error) {
            if (error instanceof Error) {
                setProcessModalError(error.message);
            } else {
                setProcessModalError("Ocurrió un error desconocido.");
            }
        }
    };

    const handleCloseIlpnConfirm = () => {
        if (ilpnToClose) {
            closeILPN(task.id, ilpnToClose.id);
            setLastAction(`iLPN ${ilpnToClose.id} cerrado.`);
            setIlpnToClose(null);
        }
    };

    const handleFinishTaskConfirm = () => {
        completeTask(task.id);
        setIsFinishModalOpen(false);
        navigate('/'); // Redirect after completion
    };

    const renderTabs = () => {
        const tabs = [
            { id: 'pending', label: `Pendientes (${pendingArticles.length})` },
            { id: 'openIlpns', label: `iLPNs Abiertos (${task.openILPNs.length})` },
            { id: 'closedIlpns', label: `iLPNs Cerrados (${task.closedILPNs.length})` },
        ];
        return (
            <div className="border-b border-zinc-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`${
                                activeTab === tab.id
                                    ? 'border-sky-500 text-sky-400'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
        );
    };
    
    return (
        // The root element is now a React Fragment, preventing a nested scrolling container.
        // The main Layout component will handle all scrolling.
        <>
            {lastAction && <ToastNotification message={lastAction} onDismiss={() => setLastAction(null)} />}
            
            <ProcessingFlowModal
                isOpen={!!articleToProcess}
                onClose={() => {
                  setArticleToProcess(null);
                  setProcessModalError(null);
                }}
                onConfirm={handleProcessConfirm}
                article={articleToProcess}
                suggestedStockIlpnId={suggestedStockIlpn}
                suggestedCrossIlpnId={suggestedCrossIlpn}
                error={processModalError}
                setError={setProcessModalError}
                isIlpnIdUnique={isIlpnIdUnique}
            />
            <IlpnDetailModal ilpn={ilpnToView} onClose={() => setIlpnToView(null)} />
            <CloseIlpnConfirmationModal
                isOpen={!!ilpnToClose}
                onCancel={() => setIlpnToClose(null)}
                onConfirm={handleCloseIlpnConfirm}
                ilpnId={ilpnToClose?.id}
            />
            <FinishTaskConfirmationModal
                isOpen={isFinishModalOpen}
                onCancel={() => setIsFinishModalOpen(false)}
                onConfirm={handleFinishTaskConfirm}
                pendingItemsCount={pendingArticles.length}
                taskFileName={task.fileName}
            />

            {/* Header */}
            <header className="p-4 sm:p-5 bg-zinc-800 border-b border-zinc-700">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{task.fileName}</h1>
                        <p className="text-sm text-zinc-400">Tipo: {task.downloadType}</p>
                    </div>
                     <div className="flex items-center gap-3">
                        <button 
                            onClick={() => fetchTasks()} 
                            className="p-3 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-600"
                            disabled={isLoading}
                            title="Actualizar tarea"
                        >
                            <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => setIsFinishModalOpen(true)} className="bg-red-600 text-white font-bold py-2.5 px-5 rounded-lg hover:bg-red-700 transition-colors">
                            Finalizar Tarea
                        </button>
                    </div>
                </div>
                <div className="mt-3">
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-zinc-300">Progreso General</span>
                        <span className="text-sm font-medium text-zinc-300">{totalProcessed} / {totalManifest} Cajas</span>
                    </div>
                    <div className="w-full bg-zinc-700 rounded-full h-2.5">
                        <div className="bg-sky-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </header>

            {/* Scan Form */}
             <div className="p-4 bg-zinc-800">
                <form onSubmit={handleScan}>
                    <label htmlFor="scan-input" className="sr-only">Escanear Artículo</label>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <BarcodeIcon className="h-5 w-5 text-zinc-400" />
                        </div>
                        <input
                            ref={scanInputRef}
                            id="scan-input"
                            type="text"
                            value={scannedValue}
                            onChange={(e) => setScannedValue(e.target.value)}
                            className="block w-full text-lg rounded-md border-zinc-600 bg-zinc-900 py-3 pl-10 pr-3 focus:border-sky-500 focus:ring-sky-500"
                            placeholder="Escanear SKU o código de barras..."
                        />
                    </div>
                </form>
            </div>

            {/* Content Area */}
            <div className="p-4 sm:p-5">
                {renderTabs()}
                <div className="py-4">
                    {activeTab === 'pending' && (
                        <ul className="space-y-2">
                             {pendingArticles.map(article => (
                                <li key={article.id} className="bg-zinc-800/70 p-3 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-zinc-200">{article.sku}</p>
                                        <p className="text-xs text-zinc-400 flex items-baseline" title={article.description}>
                                            <BarcodePrefix barcode={article.barcode} />
                                            <span className="truncate">{article.description}</span>

                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-xl">{article.pendingQuantity}</p>
                                        <p className="text-xs">cajas pend.</p>
                                    </div>
                                </li>
                            ))}
                            {pendingArticles.length === 0 && <p className="text-center text-zinc-500 py-8">¡Todos los artículos han sido procesados!</p>}
                        </ul>
                    )}
                     {activeTab === 'openIlpns' && (
                        <ul className="space-y-3">
                           {task.openILPNs.map(ilpn => (
                                <li key={ilpn.id} className="bg-zinc-800 p-3 rounded-lg border border-zinc-700">
                                    <div className="flex justify-between items-center">
                                        <button onClick={() => setIlpnToView(ilpn)} className="text-left">
                                            <p className="font-bold text-sky-400">{ilpn.id}</p>
                                            <p className="text-sm text-zinc-400">Madre: {ilpn.madre}</p>
                                        </button>
                                        <button onClick={() => setIlpnToClose(ilpn)} className="bg-yellow-600 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-yellow-700">
                                            Cerrar
                                        </button>
                                    </div>
                                </li>
                           ))}
                           {task.openILPNs.length === 0 && <p className="text-center text-zinc-500 py-8">No hay iLPNs abiertos.</p>}
                        </ul>
                    )}
                     {activeTab === 'closedIlpns' && (
                        <ul className="space-y-3">
                           {task.closedILPNs.map(ilpn => (
                                <li key={ilpn.id} className="bg-zinc-800 p-3 rounded-lg border border-zinc-700 opacity-80">
                                    <button onClick={() => setIlpnToView(ilpn)} className="w-full text-left flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-zinc-300">{ilpn.id}</p>
                                            <p className="text-sm text-zinc-400">Madre: {ilpn.madre}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ilpn.type === IlpnType.CROSS ? 'bg-amber-900 text-amber-300' : 'bg-sky-900 text-sky-300'}`}>{ilpn.type}</span>
                                            <LockClosedIcon className="w-5 h-5 text-zinc-500"/>
                                        </div>
                                    </button>
                                </li>
                           ))}
                           {task.closedILPNs.length === 0 && <p className="text-center text-zinc-500 py-8">No hay iLPNs cerrados.</p>}
                        </ul>
                    )}
                </div>
            </div>
        </>
    );
};

export default DownloadView;