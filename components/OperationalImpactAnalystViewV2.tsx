
import React, { useState, useEffect } from 'react';
import { sheets as googleSheetsService, ImpactFilterOptions } from '../services/googleSheetsService';
import { ImpactMetric } from '../types';
import { CpuChipIcon, CheckCircleIcon, RefreshIcon, ChartIcon, ClockIcon, FilterIcon } from './Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Step = 'SELECT_PROCESS' | 'SELECT_INDICATORS' | 'SELECT_FILTERS' | 'SELECT_DATE' | 'ANALYZING' | 'RESULT';

const OperationalImpactAnalystV2: React.FC = () => {
    const [step, setStep] = useState<Step>('SELECT_PROCESS');
    const [metrics, setMetrics] = useState<ImpactMetric[]>([]);
    const [processes, setProcesses] = useState<string[]>([]);
    const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
    const [availableIndicators, setAvailableIndicators] = useState<ImpactMetric[]>([]);
    const [selectedIndicators, setSelectedIndicators] = useState<ImpactMetric[]>([]);
    
    // Filters State
    const [filterOptions, setFilterOptions] = useState<ImpactFilterOptions | null>(null);
    const [selectedBUs, setSelectedBUs] = useState<string[]>([]);
    const [selectedZones, setSelectedZones] = useState<string[]>([]);
    const [selectedPickingTypes, setSelectedPickingTypes] = useState<string[]>([]);

    const [changeDate, setChangeDate] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null); 
    const [tokensUsed, setTokensUsed] = useState<number | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const data = await googleSheetsService.getImpactMetrics();
                setMetrics(data);
                const uniqueProcesses = Array.from(new Set(data.map(m => m.TipoProceso)));
                setProcesses(uniqueProcesses);
            } catch (err) {
                setError("No se pudieron cargar los tipos de proceso.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleSelectProcess = (process: string) => {
        setSelectedProcess(process);
        const filtered = metrics.filter(m => m.TipoProceso === process);
        setAvailableIndicators(filtered);
        setStep('SELECT_INDICATORS');
    };

    const toggleIndicator = (indicator: ImpactMetric) => {
        setSelectedIndicators(prev => {
            const exists = prev.find(p => p.Indicador === indicator.Indicador);
            if (exists) {
                return prev.filter(p => p.Indicador !== indicator.Indicador);
            } else {
                return [...prev, indicator];
            }
        });
    };

    const handleSelectAllIndicators = () => {
        if (selectedIndicators.length === availableIndicators.length) {
            setSelectedIndicators([]);
        } else {
            setSelectedIndicators([...availableIndicators]);
        }
    };

    const handleConfirmIndicators = async () => {
        if (selectedIndicators.length === 0) {
            alert("Seleccione al menos un indicador.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const options = await googleSheetsService.getFilterOptions(selectedProcess!);
            
            // Verificamos si realmente hay opciones para segmentar
            const hasBUs = options?.unidadesNegocio && options.unidadesNegocio.length > 0;
            const hasZones = options?.zonas && options.zonas.length > 0;
            const hasTypes = options?.tiposPicking && options.tiposPicking.length > 0;

            if (hasBUs || hasZones || hasTypes || selectedProcess === 'PICKING') {
                setFilterOptions(options);
                // Por defecto seleccionamos todos como solicitó el usuario
                setSelectedBUs(options.unidadesNegocio || []);
                setSelectedZones(options.zonas || []);
                setSelectedPickingTypes(options.tiposPicking || []);
                setStep('SELECT_FILTERS');
            } else {
                setStep('SELECT_DATE');
            }
        } catch (err) {
            console.error("Error al obtener opciones de filtro:", err);
            setError("Error al cargar dimensiones de segmentación.");
            setStep('SELECT_DATE');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleFilter = (list: string[], setList: (v: string[]) => void, item: string) => {
        if (list.includes(item)) {
            setList(list.filter(i => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    const handleSelectAllFilter = (allOptions: string[], list: string[], setList: (v: string[]) => void) => {
        if (list.length === allOptions.length) {
            setList([]);
        } else {
            setList([...allOptions]);
        }
    };

    const handleConfirmFilters = () => {
        if (selectedBUs.length === 0 || selectedZones.length === 0) {
            alert("Debe seleccionar al menos una Unidad de Negocio y una Zona para continuar.");
            return;
        }
        if (selectedProcess === 'PICKING' && selectedPickingTypes.length === 0) {
            alert("Para Picking debe seleccionar al menos una modalidad.");
            return;
        }
        setStep('SELECT_DATE');
    };

    const handleRunAnalysis = async () => {
        if (!changeDate) {
            alert("Seleccione una fecha de cambio.");
            return;
        }
        setStep('ANALYZING');
        setIsLoading(true);
        setError(null);

        try {
            const filters = {
                bus: selectedBUs,
                zones: selectedZones,
                types: selectedPickingTypes
            };

            const rawData = await googleSheetsService.getImpactAnalysisData(selectedProcess!, changeDate, filters);
            
            if (!rawData || rawData.length === 0) {
                throw new Error("No se encontraron suficientes datos históricos para los filtros aplicados.");
            }

            const filterContext = `
                Análisis segmentado por:
                - BUs: ${selectedBUs.length === (filterOptions?.unidadesNegocio.length || 0) ? 'TODAS' : selectedBUs.join(', ')}
                - Zonas: ${selectedZones.length === (filterOptions?.zonas.length || 0) ? 'TODAS' : selectedZones.join(', ')}
                - Picking: ${selectedPickingTypes.length === (filterOptions?.tiposPicking.length || 0) ? 'TODOS' : selectedPickingTypes.join(', ')}
            `;

            const prompt = await googleSheetsService.getAnalystV2Prompt(selectedProcess!, changeDate, selectedIndicators, rawData, filterContext);
            const response = await googleSheetsService.analyzeWithGemini(prompt);
            
            let processedText = typeof response === 'string' ? response : (response.text || '');
            const tokens = typeof response === 'object' ? (response.totalTokens || 0) : 0;
            
            setTokensUsed(tokens);

            if (processedText && processedText.includes('[SAVE_MEMORY]')) {
                try {
                    const parts = processedText.split('[SAVE_MEMORY]');
                    const jsonString = parts[1].trim();
                    const memoryData = JSON.parse(jsonString);

                    const entryToSave = {
                        ...memoryData,
                        tipoCambio: `${selectedProcess} (${changeDate})`,
                        totalTokens: tokens,
                        observaciones: `${memoryData.observaciones || ''} | Filtros: ${selectedBUs.length} BU, ${selectedZones.length} Zonas.`
                    };

                    await googleSheetsService.addAnalystMemoryEntry(entryToSave);
                    processedText = parts[0].trim();
                } catch (saveErr) {
                    console.error("Error al guardar en bitácora:", saveErr);
                }
            }

            setAnalysisResult(processedText);
            setStep('RESULT');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error crítico al ejecutar el análisis.");
            setStep('SELECT_DATE');
        } finally {
            setIsLoading(false);
        }
    };

    const reset = () => {
        setStep('SELECT_PROCESS');
        setSelectedProcess(null);
        setSelectedIndicators([]);
        setSelectedBUs([]);
        setSelectedZones([]);
        setSelectedPickingTypes([]);
        setChangeDate('');
        setAnalysisResult(null);
        setError(null);
        setTokensUsed(null);
    };

    const FilterSection = ({ title, options, selected, onToggle, onSelectAll }: { title: string, options: string[], selected: string[], onToggle: (i: string) => void, onSelectAll: () => void }) => (
        <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-700/50">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-2">
                    <FilterIcon className="w-3.5 h-3.5" />
                    {title}
                </h3>
                <button 
                    onClick={onSelectAll}
                    type="button"
                    className="text-[10px] font-bold text-sky-500 hover:text-sky-300 uppercase underline decoration-sky-500/30 underline-offset-4"
                >
                    {selected.length === options.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {options.map(opt => {
                    const isSelected = selected.includes(opt);
                    return (
                        <button
                            key={opt}
                            onClick={() => onToggle(opt)}
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                isSelected 
                                ? 'bg-sky-600 border-sky-400 text-white' 
                                : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="p-6 sm:p-8 max-w-5xl mx-auto">
            <header className="mb-10 text-center">
                <div className="inline-flex items-center justify-center p-3 bg-sky-900/30 rounded-2xl mb-4">
                    <CpuChipIcon className="w-10 h-10 text-sky-400" />
                </div>
                <h1 className="text-3xl font-extrabold text-white">Analista de Impacto v2</h1>
                <p className="text-zinc-400 mt-2">Análisis de base histórica con segmentación avanzada.</p>
            </header>

            {error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-700/50 rounded-xl text-red-200 text-center flex items-center justify-between gap-4">
                    <p className="text-sm font-medium">{error}</p>
                    <button onClick={() => setError(null)} className="text-xs font-black uppercase text-red-400 hover:text-red-300 underline">Cerrar</button>
                </div>
            )}

            {isLoading && step !== 'ANALYZING' && (
                <div className="text-center py-20 bg-zinc-800/50 rounded-2xl border border-zinc-700">
                    <RefreshIcon className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
                    <p className="text-zinc-300 text-lg font-medium">Preparando entorno...</p>
                </div>
            )}

            {!isLoading && step === 'SELECT_PROCESS' && (
                <div className="space-y-6 animate-fade-in">
                    <h2 className="text-xl font-bold text-white text-center">Paso 1: Seleccione el Proceso</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {processes.map(proc => (
                            <button
                                key={proc}
                                onClick={() => handleSelectProcess(proc)}
                                className="p-6 bg-zinc-800 border border-zinc-700 rounded-xl hover:border-sky-500 hover:bg-zinc-700/50 transition-all text-left group"
                            >
                                <ChartIcon className="w-8 h-8 text-sky-400 mb-4 group-hover:scale-110 transition-transform" />
                                <span className="font-bold text-lg text-zinc-100">{proc}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {step === 'SELECT_INDICATORS' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <button onClick={() => setStep('SELECT_PROCESS')} className="text-sky-400 hover:underline font-bold">← Volver</button>
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Paso 2: Indicadores</h2>
                            <button 
                                onClick={handleSelectAllIndicators}
                                className="text-[10px] font-bold text-sky-400 hover:text-sky-300 uppercase tracking-widest mt-1 block w-full text-center"
                            >
                                {selectedIndicators.length === availableIndicators.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                            </button>
                        </div>
                        <div className="w-20"></div>
                    </div>
                    <div className="bg-zinc-800 p-8 rounded-2xl border border-zinc-700 shadow-xl">
                        <p className="text-zinc-400 mb-6 flex items-center gap-2 text-sm">
                            Proceso actual: <span className="text-sky-400 font-black">{selectedProcess}</span>
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {availableIndicators.map(ind => {
                                const isSelected = selectedIndicators.some(s => s.Indicador === ind.Indicador);
                                return (
                                    <div
                                        key={ind.Indicador}
                                        onClick={() => toggleIndicator(ind)}
                                        className={`p-5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                                            isSelected ? 'bg-sky-900/20 border-sky-500' : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
                                        }`}
                                    >
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-sky-500 border-sky-500' : 'border-zinc-600'}`}>
                                            {isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                        </div>
                                        <span className={`font-bold ${isSelected ? 'text-white' : 'text-zinc-400'}`}>{ind.Indicador}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            onClick={handleConfirmIndicators}
                            className="mt-10 w-full bg-sky-600 hover:bg-sky-700 text-white font-black py-4 rounded-xl transition-all shadow-lg text-lg"
                        >
                            Siguiente: Segmentación ({selectedIndicators.length})
                        </button>
                    </div>
                </div>
            )}

            {step === 'SELECT_FILTERS' && filterOptions && (
                <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
                    <div className="flex justify-between items-center">
                        <button onClick={() => setStep('SELECT_INDICATORS')} className="text-sky-400 hover:underline font-bold">← Volver</button>
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Paso 3: Segmentación</h2>
                        <div className="w-20"></div>
                    </div>
                    <div className="bg-zinc-800 p-8 rounded-2xl border border-zinc-700 shadow-2xl space-y-6">
                        <p className="text-sm text-zinc-400 mb-2 leading-relaxed">
                            Filtre las dimensiones de los datos históricos para el análisis.
                        </p>
                        
                        <FilterSection 
                            title="Unidades de Negocio" 
                            options={filterOptions.unidadesNegocio} 
                            selected={selectedBUs} 
                            onToggle={(i) => handleToggleFilter(selectedBUs, setSelectedBUs, i)}
                            onSelectAll={() => handleSelectAllFilter(filterOptions.unidadesNegocio, selectedBUs, setSelectedBUs)}
                        />
                        
                        <FilterSection 
                            title="Zonas de Almacén" 
                            options={filterOptions.zonas} 
                            selected={selectedZones} 
                            onToggle={(i) => handleToggleFilter(selectedZones, setSelectedZones, i)}
                            onSelectAll={() => handleSelectAllFilter(filterOptions.zonas, selectedZones, setSelectedZones)}
                        />
                        
                        {selectedProcess === 'PICKING' && (
                            <FilterSection 
                                title="Tipos de Picking" 
                                options={filterOptions.tiposPicking} 
                                selected={selectedPickingTypes} 
                                onToggle={(i) => handleToggleFilter(selectedPickingTypes, setSelectedPickingTypes, i)}
                                onSelectAll={() => handleSelectAllFilter(filterOptions.tiposPicking, selectedPickingTypes, setSelectedPickingTypes)}
                            />
                        )}

                        <div className="pt-4">
                            <button
                                onClick={handleConfirmFilters}
                                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-black py-4 rounded-xl transition-all shadow-lg text-lg transform hover:scale-[1.01] active:scale-[0.99]"
                            >
                                Confirmar y Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {step === 'SELECT_DATE' && (
                <div className="max-w-md mx-auto space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <button onClick={() => setStep(filterOptions ? 'SELECT_FILTERS' : 'SELECT_INDICATORS')} className="text-sky-400 hover:underline font-bold">← Volver</button>
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Paso Final</h2>
                        <div className="w-20"></div>
                    </div>
                    <div className="bg-zinc-800 p-10 rounded-2xl border border-zinc-700 shadow-2xl text-center">
                        <ClockIcon className="w-20 h-20 text-sky-500 mx-auto mb-6" />
                        <h3 className="text-white font-bold text-xl mb-4">Fecha del Cambio</h3>
                        <p className="text-zinc-400 mb-8 text-sm">Seleccione el día de implementación del cambio operativo.</p>
                        <input
                            type="date"
                            value={changeDate}
                            onChange={(e) => setChangeDate(e.target.value)}
                            className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-xl p-5 text-white text-2xl focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all text-center font-mono"
                        />
                        <button
                            onClick={handleRunAnalysis}
                            disabled={!changeDate}
                            className="mt-10 w-full bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-xl transition-all shadow-xl disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-xl"
                        >
                            Ejecutar Análisis con IA
                        </button>
                    </div>
                </div>
            )}

            {step === 'ANALYZING' && (
                <div className="text-center py-24 bg-zinc-800/30 rounded-3xl border border-zinc-700/50 backdrop-blur-sm">
                    <div className="relative inline-block mb-10">
                        <CpuChipIcon className="w-28 h-28 text-sky-500 animate-pulse" />
                        <div className="absolute inset-0 border-8 border-sky-500/10 rounded-full border-t-sky-500 animate-spin"></div>
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Comparando Históricos</h2>
                    <p className="text-zinc-400 text-lg max-w-md mx-auto italic">Gemini está analizando las tendencias pre y post cambio en base a los filtros seleccionados...</p>
                </div>
            )}

            {step === 'RESULT' && analysisResult && (
                <div className="space-y-6 animate-fade-in pb-12">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <CheckCircleIcon className="w-8 h-8 text-green-500" />
                            Resultados del Análisis
                        </h2>
                        <div className="flex items-center gap-4">
                            {tokensUsed !== null && (
                                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-2 py-1 rounded border border-zinc-700 uppercase">
                                    Tokens: {tokensUsed}
                                </span>
                            )}
                            <button onClick={reset} className="bg-sky-600/10 hover:bg-sky-600 text-sky-400 hover:text-white px-4 py-2 rounded-lg font-bold border border-sky-500/30 transition-all">Nuevo Análisis</button>
                        </div>
                    </div>
                    
                    <div className="bg-zinc-800 p-6 sm:p-10 rounded-3xl border border-zinc-700 shadow-2xl overflow-hidden relative">
                         <div className="absolute top-0 left-0 w-2 h-full bg-sky-500 shadow-[2px_0_10px_rgba(14,165,233,0.3)]"></div>
                         <div className="mb-8 pb-8 border-b border-zinc-700/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                             <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-700/30">
                                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Proceso</p>
                                <p className="font-bold text-sky-400 text-base">{selectedProcess}</p>
                             </div>
                             <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-700/30">
                                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Corte Temporal</p>
                                <p className="font-bold text-zinc-100 text-base font-mono">{changeDate}</p>
                             </div>
                             <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-700/30 lg:col-span-2">
                                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Segmento Analizado</p>
                                <p className="text-xs text-zinc-400 leading-relaxed font-medium mt-1">
                                    {selectedBUs.length} Unidades | {selectedZones.length} Zonas | {selectedPickingTypes.length || 'N/A'} Tipos Picking.
                                </p>
                             </div>
                         </div>
                        <div className="prose prose-invert prose-sky max-w-none text-zinc-200 text-sm sm:text-base leading-relaxed selection:bg-sky-500/30">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {analysisResult}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OperationalImpactAnalystV2;
