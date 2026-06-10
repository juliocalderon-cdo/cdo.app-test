import React, { useState, useEffect, useRef } from 'react';
import { agentService } from '../services/agentService';
import { CpuChipIcon, PaperAirplaneIcon, UserIcon } from './Icons';
import { FileUpload } from './FileUpload';
import { parseExcelToCSV } from '../services/mockExcelParser';

interface Message {
    text: string;
    sender: 'user' | 'agent';
}

type AnalysisStep = 'CONTEXT' | 'AWAITING_FILES' | 'ANALYZING';

const OperationalImpactAnalystView: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState(''); // For detailed status
    const [error, setError] = useState<string | null>(null);
    const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('CONTEXT');
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const startChat = async () => {
            try {
                setError(null);
                const initialMessage = await agentService.initializeChat();
                setMessages([{ text: initialMessage, sender: 'agent' }]);
            } catch (err) {
                setError(err instanceof Error ? err.message : "No se pudo iniciar el agente.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        startChat();
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() && uploadedFiles.length === 0) return;

        const userMessage: Message = { text: userInput, sender: 'user' };
        
        // The history to send is the current state of messages *before* this new message.
        const history = [...messages];
        
        // Optimistically update the UI with the user's message.
        setMessages(prev => [...prev, userMessage]);
        
        const currentInput = userInput;
        setUserInput('');
        setIsLoading(true);
        setLoadingMessage("El agente está pensando...");
        setAnalysisStep('ANALYZING');
        
        try {
            let parsedFilesData: { fileName: string; data: string }[] | undefined;
            
            if (uploadedFiles.length > 0) {
                setLoadingMessage("Leyendo archivos y convirtiendo a CSV...");
                parsedFilesData = await Promise.all(
                    uploadedFiles.map(async file => {
                        // Direct conversion to CSV without AI optimization steps
                        const rawCsv = await parseExcelToCSV(file);
                        return {
                            fileName: file.name,
                            data: rawCsv
                        };
                    })
                );
                setUploadedFiles([]);
            }
            
            setLoadingMessage("Analizando datos...");
            // Pass the history and the new message to the service.
            const agentResponseText = await agentService.sendMessage(history, currentInput, parsedFilesData);
            
            if (agentResponseText.includes('[AWAIT_FILES]')) {
                const cleanText = agentResponseText.replace('[AWAIT_FILES]', '').trim();
                setMessages(prev => [...prev, { text: cleanText, sender: 'agent' }]);
                setAnalysisStep('AWAITING_FILES');
            } else {
                setMessages(prev => [...prev, { text: agentResponseText, sender: 'agent' }]);
                setAnalysisStep('CONTEXT');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Ocurrió un error al contactar al agente.";
            setMessages(prev => [...prev, { text: `Error: ${errorMessage}`, sender: 'agent' }]);
            setAnalysisStep('CONTEXT'); // Reset step on error
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="p-4 sm:p-5 bg-zinc-800 border-b border-zinc-700">
                <h1 className="text-xl sm:text-2xl font-bold text-white">Agente: Analista de Impacto Operativo</h1>
                <p className="text-sm text-zinc-400">Interactúe con la IA para evaluar cambios operativos.</p>
            </header>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.sender === 'agent' && (
                            <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                <CpuChipIcon className="w-6 h-6 text-sky-400" />
                            </div>
                        )}
                        <div className={`max-w-xl p-4 rounded-xl shadow-md ${msg.sender === 'user' ? 'bg-sky-800 text-white' : 'bg-zinc-700 text-zinc-200'}`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                         {msg.sender === 'user' && (
                            <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                <UserIcon className="w-6 h-6 text-zinc-300" />
                            </div>
                        )}
                    </div>
                ))}
                
                {analysisStep === 'AWAITING_FILES' && !isLoading && (
                    <div className="my-6">
                        <FileUpload onFileSelect={(file) => setUploadedFiles([file])} isLoading={false} />
                        {uploadedFiles.length > 0 && (
                             <p className="text-center text-sm text-green-400 mt-2">
                                Archivo "{uploadedFiles[0].name}" listo. Añade un comentario (opcional) y pulsa enviar.
                            </p>
                        )}
                    </div>
                )}

                {isLoading && messages.length > 0 && (
                     <div className="flex items-start gap-4 justify-start">
                        <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                           <CpuChipIcon className="w-6 h-6 text-sky-400" />
                        </div>
                        <div className="max-w-xl p-4 rounded-xl shadow-md bg-zinc-700 text-zinc-200">
                           <div className="flex flex-col gap-2">
                               <div className="flex items-center gap-2">
                                   <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse"></div>
                                   <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                                   <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                               </div>
                               {loadingMessage && (
                                   <p className="text-xs text-zinc-400 italic mt-1">{loadingMessage}</p>
                               )}
                           </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </main>
            
            <footer className="p-4 bg-zinc-800 border-t border-zinc-700">
                {error && <p className="text-red-400 text-center mb-2 text-sm">{error}</p>}
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                    <textarea
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                        }}
                        placeholder={
                            isLoading ? "El agente está trabajando..." :
                            analysisStep === 'AWAITING_FILES' ? "Añade un comentario sobre los archivos (opcional)..." :
                            "Describe el cambio que quieres analizar..."
                        }
                        className="flex-1 p-3 rounded-lg bg-zinc-900 border border-zinc-600 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
                        rows={1}
                        disabled={isLoading || !!error}
                    />
                    <button type="submit" disabled={isLoading || (!userInput.trim() && uploadedFiles.length === 0) || !!error} className="p-3 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:bg-zinc-600 disabled:cursor-not-allowed">
                        <PaperAirplaneIcon className="w-6 h-6" />
                    </button>
                </form>
            </footer>
        </div>
    );
};

export default OperationalImpactAnalystView;