import React, { useState, useMemo, useRef, useEffect } from 'react';
import { sheets as googleSheetsService } from '../services/googleSheetsService';
import { Olpn, PackLocation } from '../types';
import { useAuthContext } from '../hooks/useAuth';
import { BarcodeIcon, CheckCircleIcon } from './Icons';

type DistributionStep = {
    packLocation: PackLocation;
    olpns: Olpn[];
};

type ViewState = 'IDLE' | 'LOADING' | 'DISTRIBUTING' | 'COMPLETED' | 'ERROR';
type ScanPhase = 'SOURCE' | 'DESTINATION';

const OlpnDistributionView: React.FC = () => {
    const { currentUser } = useAuthContext();
    const [viewState, setViewState] = useState<ViewState>('IDLE');
    const [palletId, setPalletId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [distributionPlan, setDistributionPlan] = useState<DistributionStep[]>([]);
    const [allPalletOlpns, setAllPalletOlpns] = useState<Olpn[]>([]);
    
    // State for tracking progress
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [scannedOlpnsInStep, setScannedOlpnsInStep] = useState<Set<string>>(new Set());
    
    // State for new combination flow
    const [scanPhase, setScanPhase] = useState<ScanPhase>('SOURCE');
    const [sourceOlpn, setSourceOlpn] = useState<Olpn | null>(null);
    const [destinationOlpn, setDestinationOlpn] = useState('');
    const [isCombining, setIsCombining] = useState(false);
    const [combinationError, setCombinationError] = useState<string | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [combinationSuccessMessage, setCombinationSuccessMessage] = useState<string | null>(null);

    const palletInputRef = useRef<HTMLInputElement>(null);
    const olpnInputRef = useRef<HTMLInputElement>(null);


    useEffect(() => {
        if (viewState === 'IDLE') {
            palletInputRef.current?.focus();
        } else if (viewState === 'DISTRIBUTING') {
            olpnInputRef.current?.focus();
        }
    }, [viewState, scanPhase]);

    const handleStartSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!palletId) return;

        setViewState('LOADING');
        setError(null);
        setDistributionPlan([]);
        setAllPalletOlpns([]);

        try {
            const token = await googleSheetsService.getManhattanToken();
            if (!token) throw new Error("No se pudo obtener el token de autenticación de Manhattan.");
            
            const olpns = await googleSheetsService.searchManhattanOlpn(token, palletId);
            if (olpns.length === 0) throw new Error(`No se encontraron OLPNs para el pallet "${palletId}". Verifique el ID.`);
            
            setAllPalletOlpns(olpns);

            const packLocations = await googleSheetsService.getPackLocationDetails();
            const lacteosPackLocations = packLocations.filter(loc => loc.type.toUpperCase() === 'LACTEOS');

            if (lacteosPackLocations.length === 0) throw new Error("No se pudo cargar la configuración de reparto para LACTEOS (PackLocationDet).");
            
            const olpnsByStore = new Map<string, Olpn[]>();
            olpns.forEach(olpn => {
                const store = olpn.DestinationFacilityId;
                if (!olpnsByStore.has(store)) olpnsByStore.set(store, []);
                olpnsByStore.get(store)!.push(olpn);
            });

            const plan: DistributionStep[] = [];
            lacteosPackLocations
                .sort((a, b) => a.sequence - b.sequence)
                .forEach(loc => {
                    const storeId = String(loc.store);
                    if (olpnsByStore.has(storeId)) {
                        plan.push({ packLocation: loc, olpns: olpnsByStore.get(storeId)! });
                    }
                });

            if (plan.length === 0) throw new Error("Ninguno de los OLPNs encontrados corresponde a una ubicación de reparto de LACTEOS configurada.");
            
            setDistributionPlan(plan);
            setViewState('DISTRIBUTING');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
            setViewState('ERROR');
        }
    };

    const currentStep = useMemo(() => distributionPlan[currentStepIndex] || null, [distributionPlan, currentStepIndex]);
    const nextOlpnToScan = useMemo(() => currentStep?.olpns.find(o => !scannedOlpnsInStep.has(o.OlpnId)) || null, [currentStep, scannedOlpnsInStep]);

    const advanceToNextStepOrComplete = () => {
        if (currentStepIndex === distributionPlan.length - 1) {
            setViewState('COMPLETED');
        } else {
            setCurrentStepIndex(prev => prev + 1);
            setScannedOlpnsInStep(new Set());
        }
    };
    
    const handleSkipCurrentSourceOlpn = () => {
        const olpnToSkip = nextOlpnToScan;
        if (!olpnToSkip) return;

        const newScannedSet = new Set(scannedOlpnsInStep).add(olpnToSkip.OlpnId);
        setScannedOlpnsInStep(newScannedSet);

        // Check if the step is now complete after skipping
        if (newScannedSet.size === currentStep?.olpns.length) {
            advanceToNextStepOrComplete();
        }
        // If not, the component will re-render, and `nextOlpnToScan` will point to the next one.
    };

    const handleSourceOlpnScan = (scannedValue: string) => {
        setScanError(null);
        if (!scannedValue) return;

        if (!nextOlpnToScan || scannedValue.toUpperCase() !== nextOlpnToScan.OlpnId.toUpperCase()) {
            setScanError('El OLPN escaneado no es el correcto.');
            return;
        }
        setSourceOlpn(nextOlpnToScan);
        setScanPhase('DESTINATION');
    };

    const advanceAfterCombination = () => {
        if (!sourceOlpn) return; // Should not happen, but for safety

        const newScannedSet = new Set(scannedOlpnsInStep).add(sourceOlpn.OlpnId);
        setScannedOlpnsInStep(newScannedSet);

        // Reset for next scan
        setScanPhase('SOURCE');
        setSourceOlpn(null);
        setDestinationOlpn('');
        setCombinationSuccessMessage(null);

        if (newScannedSet.size === currentStep?.olpns.length) {
            advanceToNextStepOrComplete();
        }
    };

    const handleCombination = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sourceOlpn || !destinationOlpn || !currentStep || !currentUser) return;
        
        setIsCombining(true);
        setCombinationError(null);
        setScanError(null);

        // --- Frontend Validation ---
        if (destinationOlpn.length !== 18) {
            setCombinationError("Error: El OLPN de destino debe tener exactamente 18 caracteres.");
            setIsCombining(false);
            return;
        }

        const destinationOlpnDetails = allPalletOlpns.find(o => o.OlpnId.toUpperCase() === destinationOlpn.toUpperCase());
        if (destinationOlpnDetails && destinationOlpnDetails.DestinationFacilityId !== sourceOlpn.DestinationFacilityId) {
            setCombinationError(`Error: El OLPN de destino (${destinationOlpn}) pertenece a la tienda ${destinationOlpnDetails.DestinationFacilityId}, pero el origen es de la tienda ${sourceOlpn.DestinationFacilityId}.`);
            setIsCombining(false);
            return;
        }

        try {
            const token = await googleSheetsService.getManhattanToken();
            await googleSheetsService.combineOlpns(token, sourceOlpn.OlpnId, destinationOlpn);

            // Log the successful distribution event
            await googleSheetsService.logOlpnDistribution({
                palletid: palletId,
                olpnorigenid: sourceOlpn.OlpnId,
                olpndestinoid: destinationOlpn,
                local: currentStep.packLocation.store,
                ubicaciondestino: currentStep.packLocation.packLocationId,
                usuario: currentUser.username,
            });

            // Success: set the success message to trigger the visual confirmation.
            setCombinationSuccessMessage(`¡Combinación exitosa!`);

        } catch (err) {
            setCombinationError(err instanceof Error ? err.message : "Error desconocido al combinar.");
        } finally {
            setIsCombining(false);
        }
    };

    const handleSkipOlpn = () => {
        if (!sourceOlpn) return;

        const newScannedSet = new Set(scannedOlpnsInStep).add(sourceOlpn.OlpnId);
        setScannedOlpnsInStep(newScannedSet);

        setScanPhase('SOURCE');
        setSourceOlpn(null);
        setDestinationOlpn('');
        setCombinationError(null);
        setScanError(null);

        if (newScannedSet.size === currentStep?.olpns.length) {
            advanceToNextStepOrComplete();
        }
    };


    const handleReset = () => {
        setViewState('IDLE');
        setPalletId('');
        setError(null);
        setDistributionPlan([]);
        setCurrentStepIndex(0);
        setScannedOlpnsInStep(new Set());
        setScanPhase('SOURCE');
        setSourceOlpn(null);
        setDestinationOlpn('');
        setCombinationError(null);
        setIsCombining(false);
        setScanError(null);
        setAllPalletOlpns([]);
        setCombinationSuccessMessage(null);
    };

    // --- RENDER FUNCTIONS ---
    const renderIdleState = () => (
        <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Iniciar Reparto de OLPNs</h2>
            <p className="text-zinc-400 mb-6 max-w-xl mx-auto">Escanee el código de barras del Pallet para cargar el plan de distribución.</p>
            <form onSubmit={handleStartSearch} className="max-w-lg mx-auto">
                 <label htmlFor="pallet-id" className="sr-only">ID del Pallet</label>
                 <div className="relative">
                     <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                         <BarcodeIcon className="h-6 w-6 text-zinc-400" />
                     </div>
                     <input
                         ref={palletInputRef}
                         id="pallet-id"
                         type="text"
                         value={palletId}
                         onChange={(e) => setPalletId(e.target.value.toUpperCase())}
                         className="block w-full text-base sm:text-xl text-center rounded-lg border-zinc-600 bg-zinc-900 py-3 sm:py-4 pl-12 pr-4 focus:border-sky-500 focus:ring-sky-500"
                         placeholder="ESCANEAR PALLET"
                     />
                 </div>
                 <button type="submit" className="mt-6 w-full bg-sky-600 text-white font-bold py-3 sm:py-4 px-8 rounded-lg hover:bg-sky-700 transition-colors shadow-md text-base sm:text-lg">
                    Buscar Pallet
                 </button>
            </form>
        </div>
    );
    
    const renderLoadingState = () => (
        <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-sky-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-zinc-400 text-lg">Buscando información del pallet <span className="font-bold text-zinc-200">{palletId}</span>...</p>
        </div>
    );
    
    const renderErrorState = () => (
        <div className="text-center bg-red-900/30 p-8 rounded-lg max-w-2xl mx-auto">
             <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
             <p className="text-red-300 mb-6">{error}</p>
             <button onClick={handleReset} className="bg-sky-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-700 transition-colors">
                Intentar de Nuevo
             </button>
        </div>
    );

    const renderCompletedState = () => (
         <div className="text-center">
            <CheckCircleIcon className="h-24 w-24 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">¡Reparto Completado!</h2>
            <p className="text-zinc-400 mb-8">Todos los OLPNs del pallet <span className="font-bold text-zinc-200">{palletId}</span> han sido distribuidos correctamente.</p>
            <button onClick={handleReset} className="bg-sky-600 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-lg hover:bg-sky-700 transition-colors shadow-md text-base sm:text-lg">
                Escanear Nuevo Pallet
            </button>
        </div>
    );

    const renderCombinationSuccessState = () => {
        if (!sourceOlpn) return renderErrorState(); // Should have sourceOlpn at this point

        return (
            <div className="text-center max-w-2xl mx-auto w-full">
                <CheckCircleIcon className="h-20 w-20 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Combinación Exitosa</h2>
                
                <div className="flex flex-col md:flex-row items-stretch justify-center gap-4 text-center bg-zinc-900/50 p-6 rounded-lg">
                    <div className="flex-1">
                        <p className="text-sm text-amber-300 uppercase font-bold tracking-wider">OLPN Origen</p>
                        <p className="text-xl sm:text-2xl font-mono font-bold text-amber-400 mt-1 break-all">{sourceOlpn.OlpnId}</p>
                    </div>
                    <div className="flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-zinc-400 transform md:rotate-0 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-sky-300 uppercase font-bold tracking-wider">OLPN Destino</p>
                        <p className="text-xl sm:text-2xl font-mono font-bold text-sky-400 mt-1 break-all">{destinationOlpn}</p>
                    </div>
                </div>

                <button 
                    onClick={advanceAfterCombination} 
                    className="mt-8 w-full max-w-sm mx-auto bg-sky-600 text-white font-bold py-3 sm:py-4 px-8 rounded-lg hover:bg-sky-700 transition-colors shadow-md text-base sm:text-lg"
                >
                    Continuar
                </button>
            </div>
        );
    };

    const renderDistributingState = () => {
        if (combinationSuccessMessage) {
            return renderCombinationSuccessState();
        }

        if (!currentStep) return renderLoadingState();

        const olpnsForCurrentStep = currentStep.olpns;
        const progressInStep = `${scannedOlpnsInStep.size} de ${olpnsForCurrentStep.length} procesados`;
        const overallProgress = `Ubicación ${currentStepIndex + 1} de ${distributionPlan.length}`;

        const commonHeader = (
            <div className="text-center mb-6 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-700">
                <p className="text-base sm:text-lg text-zinc-400 font-medium">{overallProgress}</p>
                <p className="text-lg sm:text-xl font-semibold text-zinc-300">Diríjase a:</p>
                <p className="text-3xl sm:text-4xl font-extrabold text-sky-400 tracking-wider">{currentStep.packLocation.packLocationId}</p>
                <p className="text-base sm:text-lg text-zinc-300 mt-1">Local: <span className="font-bold text-white">{currentStep.packLocation.store}</span></p>
                <p className="mt-2 text-sm sm:text-base text-zinc-500">Pallet: {palletId}</p>
            </div>
        );

        const commonFooter = (
            <>
                <div>
                    <h3 className="text-base sm:text-lg font-semibold text-zinc-300 mb-3">OLPNs para esta ubicación ({progressInStep}):</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-2">
                        {olpnsForCurrentStep.map(olpn => (
                            <div key={olpn.OlpnId} className={`p-1 sm:p-2 rounded-md border text-center font-mono text-[10px] sm:text-sm break-words transition-all duration-300 ${scannedOlpnsInStep.has(olpn.OlpnId) ? 'bg-green-900/50 border-green-700 text-green-400' : 'bg-zinc-700/50 border-zinc-600 text-zinc-300'}`}>
                                {scannedOlpnsInStep.has(olpn.OlpnId) && <span className="font-sans text-xs">✓ </span>}
                                {olpn.OlpnId}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-8 sm:mt-12 text-center">
                    <button onClick={handleReset} className="text-zinc-500 hover:text-red-500 transition-colors text-sm underline">
                        Cancelar y reiniciar reparto
                    </button>
                </div>
            </>
        );

        if (scanPhase === 'SOURCE') {
            const olpnToScan = nextOlpnToScan;
            if (!olpnToScan) return renderCompletedState();
            
            return (
                <div className="max-w-4xl mx-auto w-full">
                    {commonHeader}
                    <div className="bg-zinc-800 p-4 sm:p-8 rounded-xl shadow-lg text-center mb-6">
                        <p className="text-base sm:text-xl font-semibold text-zinc-300">{`Escanear OLPN Origen (${scannedOlpnsInStep.size + 1} de ${olpnsForCurrentStep.length}):`}</p>
                        <p className="text-2xl sm:text-3xl md:text-5xl font-bold font-mono text-amber-400 my-2 sm:my-4 break-all">{olpnToScan.OlpnId}</p>
                         <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); handleSourceOlpnScan((e.currentTarget.elements.namedItem('source-olpn-scan') as HTMLInputElement).value); }}>
                            <label htmlFor="source-olpn-scan" className="sr-only">ESCANEAR OLPN DE ORIGEN</label>
                            <input
                                ref={olpnInputRef}
                                id="source-olpn-scan"
                                name="source-olpn-scan"
                                type="text"
                                key="source-input"
                                autoFocus
                                className="block w-full max-w-md mx-auto text-base sm:text-xl text-center rounded-lg border-zinc-600 bg-zinc-900 py-3 focus:border-amber-500 focus:ring-amber-500"
                                placeholder="ESCANEAR OLPN DE ORIGEN"
                            />
                            {scanError && (
                                <div className="mt-4 p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-red-300 max-w-md mx-auto">
                                    <p className="font-semibold">{scanError}</p>
                                </div>
                            )}
                            <div className="mt-4 sm:mt-6 flex flex-col items-center">
                                <button type="submit" className="bg-green-600 text-white font-bold py-3 sm:py-4 px-8 sm:px-12 rounded-lg hover:bg-green-500 transition-colors shadow-md text-lg sm:text-xl">
                                    Confirmar Origen
                                </button>
                                <button 
                                    type="button"
                                    onClick={handleSkipCurrentSourceOlpn}
                                    className="mt-4 text-zinc-400 hover:text-yellow-400 transition-colors text-sm underline"
                                >
                                    Saltar detalle
                                </button>
                            </div>
                        </form>
                    </div>
                    {commonFooter}
                </div>
            );
        }

        if (scanPhase === 'DESTINATION') {
            if (!sourceOlpn) return renderErrorState();
            return (
                 <div className="max-w-4xl mx-auto w-full">
                    {commonHeader}
                    <div className="bg-zinc-800 p-4 sm:p-8 rounded-xl shadow-lg text-center mb-6">
                        <h3 className="text-lg sm:text-xl font-semibold text-zinc-300 mb-6">Confirmar Combinación</h3>
                        <div className="flex flex-col md:flex-row items-stretch justify-center gap-4 md:gap-8 text-center">
                            <div className="p-2 sm:p-4 border border-dashed border-amber-500 rounded-lg flex-1">
                                <p className="text-sm text-amber-300 uppercase font-bold tracking-wider">Origen</p>
                                <p className="text-xl sm:text-2xl font-mono font-bold text-amber-400 mt-1 break-all flex items-center justify-center min-h-[44px]">{sourceOlpn.OlpnId}</p>
                            </div>
                            <div className="flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-zinc-400 transform md:rotate-0 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </div>
                            <div className="p-2 sm:p-4 border border-dashed border-sky-500 rounded-lg flex-1">
                                <p className="text-sm text-sky-300 uppercase font-bold tracking-wider">Destino</p>
                                <p className="text-xl sm:text-2xl font-mono font-bold text-sky-400 mt-1 break-all flex items-center justify-center min-h-[44px]">{destinationOlpn || '...'}</p>
                            </div>
                        </div>
                        <form onSubmit={handleCombination} className="mt-8">
                            <label htmlFor="dest-olpn-scan" className="sr-only">ESCANEAR OLPN DE DESTINO</label>
                            <input
                                ref={olpnInputRef}
                                id="dest-olpn-scan"
                                type="text"
                                key="destination-input"
                                autoFocus
                                value={destinationOlpn}
                                onChange={(e) => setDestinationOlpn(e.target.value.toUpperCase())}
                                className="block w-full max-w-md mx-auto text-base sm:text-xl text-center rounded-lg border-zinc-600 bg-zinc-900 py-3 focus:border-sky-500 focus:ring-sky-500"
                                placeholder="ESCANEAR OLPN DE DESTINO"
                            />
                            {combinationError && (
                                <div className="mt-4 p-4 bg-red-900/40 border border-red-500/50 rounded-lg text-red-300 max-w-md mx-auto">
                                    <p className="font-semibold">Error de Combinación</p>
                                    <p className="text-sm">{combinationError}</p>
                                </div>
                            )}
                            <div className="mt-4 sm:mt-6 flex flex-col items-center">
                                <button 
                                    type="submit"
                                    disabled={isCombining || !destinationOlpn}
                                    className="bg-green-600 text-white font-bold py-3 sm:py-4 px-8 sm:px-12 rounded-lg hover:bg-green-500 transition-colors shadow-md text-lg sm:text-xl disabled:bg-zinc-600 disabled:cursor-not-allowed"
                                >
                                    {isCombining ? 'Combinando...' : 'Combinar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSkipOlpn}
                                    className="mt-4 text-zinc-400 hover:text-yellow-400 transition-colors text-sm underline"
                                >
                                    Saltar detalle
                                </button>
                            </div>
                        </form>
                    </div>
                    {commonFooter}
                </div>
            );
        }
        
        return null; // Should not be reached
    };


    const renderContent = () => {
        switch (viewState) {
            case 'IDLE':         return renderIdleState();
            case 'LOADING':      return renderLoadingState();
            case 'ERROR':        return renderErrorState();
            case 'DISTRIBUTING': return renderDistributingState();
            case 'COMPLETED':    return renderCompletedState();
            default:             return renderIdleState();
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-white">Reparto de OLPNs - Frescos</h1>
                    <p className="text-base sm:text-xl text-zinc-400 mt-1 sm:mt-2">Guía interactiva para la distribución de pallets.</p>
                </div>
            </div>
            <div className="bg-zinc-800 p-4 sm:p-6 md:p-10 rounded-xl shadow-lg flex items-center justify-center">
                {renderContent()}
            </div>
        </div>
    );
};

export default OlpnDistributionView;