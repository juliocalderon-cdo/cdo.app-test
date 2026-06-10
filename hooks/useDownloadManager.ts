import React, { useState, useCallback, useContext, useEffect } from 'react';
import { DownloadTask, TaskStatus, Article, iLPN, iLPNArticle, DownloadType, TaskType, IlpnType } from '../types';
import { parseExcelFile } from '../services/mockExcelParser';
import { analyzeImportData } from '../services/geminiService';
import { useAuthContext } from './useAuth';
import { useNotification } from '../hooks/useNotification';
import { sheets as googleSheetsService } from '../services/googleSheetsService';

interface ProcessingDetails {
    articleId: string;
    crossIlpn: { id: string, quantity: number } | null;
    stockIlpn: { id: string, quantity: number } | null;
}

// Helper to get total processed count for a single article from all iLPNs
const getProcessedCount = (task: DownloadTask, articleId: string, type?: IlpnType): number => {
    let count = 0;
    const allILPNs = [...(task.openILPNs || []), ...(task.closedILPNs || [])];
    for (const ilpn of allILPNs) {
        if (type && ilpn.type !== type) continue; // Filter by type if provided
        for (const ilpnArticle of ilpn.articles) {
            if (ilpnArticle.articleId === articleId) {
                count += ilpnArticle.quantity;
            }
        }
    }
    return count;
};


export const useDownloadManager = () => {
    const { currentUser } = useAuthContext();
    const { error: notifyError } = useNotification();
    const [tasks, setTasks] = useState<DownloadTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingTask, setIsCreatingTask] = useState(false);

    // Initial data fetch from Google Sheets
    const fetchTasks = useCallback(async () => {
        if (!currentUser) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const fetchedTasks = await googleSheetsService.getTasks();
            
            // Sanitize tasks to ensure required arrays exist, preventing crashes from malformed sheet data.
            const sanitizedTasks = fetchedTasks.map((task: DownloadTask) => ({
                ...task,
                articles: Array.isArray(task.articles) ? task.articles : [],
                openILPNs: Array.isArray(task.openILPNs) ? task.openILPNs : [],
                closedILPNs: Array.isArray(task.closedILPNs) ? task.closedILPNs : [],
            }));

            setTasks(sanitizedTasks);
        } catch (error) {
            console.error("Failed to load tasks from Google Sheets", error);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // Fetch tasks once when the manager is initialized (and user is available).
    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const createTask = useCallback(async (file: File, downloadType: DownloadType) => {
        if (!currentUser) {
            throw new Error("No hay un usuario autenticado para crear la tarea.");
        }

        setIsCreatingTask(true);
        try {
            const { articles, fileName } = await parseExcelFile(file, downloadType);
            const analysis = await analyzeImportData(articles, fileName);

            const mainTask: DownloadTask = {
                id: `TASK-${Date.now()}`,
                taskType: TaskType.DOWNLOAD,
                fileName,
                downloadType,
                createdAt: new Date().toISOString(),
                status: TaskStatus.PENDING,
                articles,
                openILPNs: [],
                closedILPNs: [],
                analysis,
                user: currentUser.name,
            };

            await googleSheetsService.addTasks([mainTask]);
            setTasks((prevTasks: DownloadTask[]) => [...prevTasks, mainTask]);

        } catch (error)
        {
            console.error("Error creating task:", error);
            throw error;
        } finally {
            setIsCreatingTask(false);
        }
    }, [currentUser]);

    const updateTaskOnSheetAndState = async (updatedTask: DownloadTask) => {
         // Optimistic update of local state
        setTasks((prevTasks: DownloadTask[]) => prevTasks.map((t: DownloadTask) => t.id === updatedTask.id ? updatedTask : t));
        
        try {
            await googleSheetsService.updateTask(updatedTask);
        } catch (error) {
            console.error("Failed to update task on Google Sheet. Reverting state might be needed.", error);
            // Optionally revert state or show an error message
            notifyError("Error: No se pudo guardar el cambio en la base de datos. Por favor, recargue la página.");
            fetchTasks(); // Refetch to get the correct state
        }
    };
    
    const getTask = useCallback((taskId: string) => {
        return tasks.find((task: DownloadTask) => task.id === taskId);
    }, [tasks]);

    const startTask = useCallback((taskId: string) => {
        const task = getTask(taskId);
        if (task) {
            const updatedTask = { ...task, status: TaskStatus.IN_PROGRESS, startedAt: new Date().toISOString() };
            updateTaskOnSheetAndState(updatedTask);
        }
    }, [getTask, updateTaskOnSheetAndState]);
    
    const completeTask = useCallback((taskId: string) => {
        const task = getTask(taskId);
        if (task) {
             const closedILPNs = [...task.closedILPNs, ...task.openILPNs.map((ilpn: iLPN) => ({...ilpn, isClosed: true}))];
             const updatedTask = {
                ...task,
                status: TaskStatus.COMPLETED,
                completedAt: new Date().toISOString(),
                openILPNs: [],
                closedILPNs
            };
            updateTaskOnSheetAndState(updatedTask);
        }
    }, [getTask, updateTaskOnSheetAndState]);

    const processScannedItem = useCallback((taskId: string, details: ProcessingDetails) => {
        if (!currentUser) {
            throw new Error("No hay un usuario autenticado para procesar el artículo.");
        }
        
        const task = getTask(taskId);
        if (!task) throw new Error("Task not found");
        
        const originalArticle = task.articles.find((a: Article) => a.id === details.articleId);
        if (!originalArticle) throw new Error("Original article definition not found.");

        const updatedTask = JSON.parse(JSON.stringify(task)); // Deep copy
        
        const allIlpnsAcrossAllTasks = tasks.flatMap((t: DownloadTask) => [...t.openILPNs, ...t.closedILPNs]);
        
        // --- Process Cross-Dock ---
        if (details.crossIlpn && details.crossIlpn.quantity > 0) {
            const { id: ilpnId, quantity } = details.crossIlpn;
            const processedCross = getProcessedCount(task, originalArticle.id, IlpnType.CROSS);
            if (quantity > originalArticle.quantityCross - processedCross) throw new Error("Cantidad de cross-dock excede lo pendiente.");

            let targetCrossIlpn = updatedTask.openILPNs.find((ilpn: iLPN) => ilpn.id === ilpnId);

            if (targetCrossIlpn) { // Add to existing open iLPN
                 if (targetCrossIlpn.isClosed) throw new Error(`El iLPN de cross-dock "${ilpnId}" está cerrado.`);
                 if (targetCrossIlpn.type !== IlpnType.CROSS) throw new Error(`El iLPN "${ilpnId}" no es de tipo Cross-Dock.`);
                 const existingArticle = targetCrossIlpn.articles.find((a:iLPNArticle) => a.articleId === originalArticle.id);
                 if (existingArticle) {
                     existingArticle.quantity += quantity;
                 } else {
                     targetCrossIlpn.articles.push({
                        articleId: originalArticle.id,
                        sku: originalArticle.sku,
                        barcode: originalArticle.barcode,
                        description: originalArticle.description,
                        quantity,
                    });
                 }
            } else { // Create new open iLPN for cross
                if (allIlpnsAcrossAllTasks.some((i: iLPN) => i.id === ilpnId)) {
                     throw new Error(`El iLPN de Cross-Dock "${ilpnId}" ya existe y está cerrado o en otra tarea.`);
                }
                const newCrossIlpn: iLPN = {
                    id: ilpnId,
                    type: IlpnType.CROSS,
                    madre: originalArticle.madre || `CROSS-${originalArticle.sku}`,
                    articles: [{
                        articleId: originalArticle.id,
                        sku: originalArticle.sku,
                        barcode: originalArticle.barcode,
                        description: originalArticle.description,
                        quantity,
                    }],
                    isClosed: false, // CROSS DOCK ILPNS ARE NOW CREATED OPEN
                    createdAt: new Date().toISOString(),
                    user: currentUser.name,
                };
                updatedTask.openILPNs.push(newCrossIlpn);
            }
        }

        // --- Process Stock ---
        if (details.stockIlpn && details.stockIlpn.quantity > 0) {
            const { id: ilpnId, quantity } = details.stockIlpn;
            const processedStock = getProcessedCount(task, originalArticle.id, IlpnType.STOCK);
            if (quantity > originalArticle.quantityStock - processedStock) throw new Error("Cantidad de stock excede lo pendiente.");

            let targetStockIlpn = updatedTask.openILPNs.find((ilpn: iLPN) => ilpn.id === ilpnId);

            if (targetStockIlpn) { // Add to existing open iLPN
                 if (targetStockIlpn.isClosed) throw new Error(`El iLPN de stock "${ilpnId}" está cerrado.`);
                 if (targetStockIlpn.type !== IlpnType.STOCK) throw new Error(`El iLPN "${ilpnId}" no es de tipo Stock.`);
                 const existingArticle = targetStockIlpn.articles.find((a:iLPNArticle) => a.articleId === originalArticle.id);
                 if (existingArticle) {
                     existingArticle.quantity += quantity;
                 } else {
                     targetStockIlpn.articles.push({
                        articleId: originalArticle.id,
                        sku: originalArticle.sku,
                        barcode: originalArticle.barcode,
                        description: originalArticle.description,
                        quantity,
                    });
                 }
            } else { // Create new open iLPN for stock
                if (allIlpnsAcrossAllTasks.some((i: iLPN) => i.id === ilpnId)) {
                     throw new Error(`El iLPN de Stock "${ilpnId}" ya existe y está cerrado o en otra tarea.`);
                }
                const isTataTask = updatedTask.downloadType === DownloadType.TATA;
                const madre = isTataTask ? originalArticle.sku : (originalArticle.madre || 'SIN MADRE');

                const newStockIlpn: iLPN = {
                    id: ilpnId,
                    type: IlpnType.STOCK,
                    madre,
                    articles: [{
                        articleId: originalArticle.id,
                        sku: originalArticle.sku,
                        barcode: originalArticle.barcode,
                        description: originalArticle.description,
                        quantity,
                    }],
                    isClosed: false,
                    createdAt: new Date().toISOString(),
                    user: currentUser.name,
                };
                updatedTask.openILPNs.push(newStockIlpn);
            }
        }
        
        updateTaskOnSheetAndState(updatedTask);
    }, [tasks, currentUser, getTask, updateTaskOnSheetAndState]);

    const closeILPN = useCallback((taskId: string, ilpnId: string) => {
        const task = getTask(taskId);
        if (!task) throw new Error("Task not found");
        
        const ilpnToClose = task.openILPNs.find((ilpn: iLPN) => ilpn.id === ilpnId);
        if (!ilpnToClose) throw new Error("iLPN not found in open list");

        const updatedTask = {
            ...task,
            openILPNs: task.openILPNs.filter((ilpn: iLPN) => ilpn.id !== ilpnId),
            closedILPNs: [...task.closedILPNs, { ...ilpnToClose, isClosed: true }]
        };

        updateTaskOnSheetAndState(updatedTask);
    }, [getTask, updateTaskOnSheetAndState]);
    
    const getPendingArticles = useCallback((task: DownloadTask, breakdown = false) => {
        if (!task || !task.articles) return [];
        if (breakdown) {
             return task.articles.map(article => ({
                ...article,
                pendingStock: article.quantityStock - getProcessedCount(task, article.id, IlpnType.STOCK),
                pendingCross: article.quantityCross - getProcessedCount(task, article.id, IlpnType.CROSS),
            })).filter(a => a.pendingStock > 0 || a.pendingCross > 0);
        }
        return task.articles.map(article => ({
            ...article,
            pendingQuantity: article.quantity - getProcessedCount(task, article.id)
        })).filter(a => a.pendingQuantity > 0);
    }, []);

    const getTotalManifestCount = useCallback((task: DownloadTask): number => {
        if (!task || !task.articles) return 0;
        return task.articles.reduce((sum, article) => sum + article.quantity, 0);
    }, []);

    const getTotalProcessedCount = useCallback((task: DownloadTask): number => {
        if (!task) return 0;
        let total = 0;
        const allILPNs = [...(task.openILPNs || []), ...(task.closedILPNs || [])];
        for (const ilpn of allILPNs) {
            for (const item of ilpn.articles) {
                total += item.quantity;
            }
        }
        return total;
    }, []);

    const findSuggestedIlpn = useCallback((taskId: string, madre: string, type: IlpnType): string | null => {
        const task = getTask(taskId);
        if (!task || !madre || !task.openILPNs) return null;

        const suggestedIlpn = [...task.openILPNs]
            .reverse() // Search from newest to oldest
            .find(ilpn => ilpn.type === type && ilpn.madre === madre && !ilpn.isClosed);

        return suggestedIlpn ? suggestedIlpn.id : null;
    }, [getTask]);

    const isIlpnIdUnique = useCallback((ilpnId: string): boolean => {
        if (!ilpnId) return true;
        const upperCaseId = ilpnId.toUpperCase();
        for (const task of tasks) {
            const allIlpns = [...(task.openILPNs || []), ...(task.closedILPNs || [])];
            if (allIlpns.some(ilpn => ilpn.id.toUpperCase() === upperCaseId)) {
                return false;
            }
        }
        return true;
    }, [tasks]);


    return {
        tasks,
        isLoading: isLoading || isCreatingTask,
        fetchTasks,
        createTask,
        getTask,
        startTask,
        processScannedItem,
        closeILPN,
        completeTask,
        getPendingArticles,
        getTotalManifestCount,
        getTotalProcessedCount,
        findSuggestedIlpn,
        isIlpnIdUnique,
    };
};

// Context to provide the manager across the app
interface DownloadManagerContextType extends ReturnType<typeof useDownloadManager> {}
export const DownloadManagerContext = React.createContext<DownloadManagerContextType | null>(null);

export const useDownloadManagerContext = () => {
    const context = useContext(DownloadManagerContext);
    if (!context) {
        throw new Error('useDownloadManagerContext must be used within a DownloadManagerProvider');
    }
    return context;
};