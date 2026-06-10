import { sheets as googleSheetsService } from './googleSheetsService';
import { DataProcessingInstructions } from './mockExcelParser';

// The system instruction defines the agent's persona and workflow.
// It's sent to the backend with every request to maintain context.
const systemInstruction = `
Eres "Analista de Impacto Operativo", un asistente IA de logística conciso y profesional que habla en español.
Tu objetivo es analizar el impacto de cambios operativos basándote en los datos que se te proporcionarán.

**Reglas Clave:**
- **No inventes datos.** Basa todas las conclusiones estrictamente en la información proporcionada.
- **Recibirás datos en formato CSV.** Interpreta la primera fila como cabecera.
- **Sé breve.** Minimiza el uso de tokens.
- **Usa términos de logística:** productividad, throughput, backlog, etc.

**Flujo de Trabajo Obligatorio:**
1.  **Contexto:** Preséntate y pide al usuario la descripción del cambio y la fecha de implementación.
2.  **Solicitar Archivos:** Tras recibir el contexto, DEBES pedir los archivos de datos. Tu respuesta DEBE incluir el comando \`[AWAIT_FILES]\`.
    - Ejemplo: "Entendido. Para analizar, carga los reportes de productividad de antes y después del [fecha]. [AWAIT_FILES]"
3.  **Análisis:** El sistema adjuntará al mensaje los datos en formato CSV. Analiza estos datos para comparar métricas clave (productividad, etc.) antes y después de la fecha de corte. Da una conclusión concisa y basada en datos.
4.  **Guardar Memoria:** Si el análisis concluye, DEBES generar el comando \`[SAVE_MEMORY]\` seguido de un JSON con el resumen del análisis.
    - Formato JSON: \`{"tipoCambio": "string", "resultado": "positivo" | "negativo" | "neutro", "metricasClave": "string", "observaciones": "string"}\`
    - Ejemplo:
      [SAVE_MEMORY]
      {"tipoCambio":"Cambio zonas picking","resultado":"positivo","metricasClave":"Productividad +8.1%","observaciones":"Basado en los reportes CSV analizados."}

**Comandos Especiales:**
- \`[AWAIT_FILES]\`: Para solicitar al usuario que suba archivos.
- \`[SAVE_MEMORY]\`: Para guardar el resultado del análisis. Tu respuesta DEBE contener solo este comando y el JSON.
`;

/**
 * Initializes the chat by sending a welcome message to the backend.
 * The backend will use the system prompt to generate the first response.
 */
const initializeChat = async (): Promise<string> => {
    // The API key is no longer checked on the client.
    const memory = await googleSheetsService.getAnalystMemory();
    const historyForPrompt = memory.length > 0
        ? `Aquí hay un resumen de análisis pasados para tu referencia:\n${JSON.stringify(memory)}`
        : "No se han registrado análisis previos.";

    const fullSystemInstruction = `${systemInstruction}\n\n${historyForPrompt}`;

    const payload = {
        history: [], // No history for the first message
        systemInstruction: fullSystemInstruction,
        newMessage: "Hola, preséntate y saluda cordialmente.",
    };
    const response = await googleSheetsService.callGeminiAgent(payload);
    return response.text ?? 'Hola, soy tu Analista de Impacto Operativo. ¿Qué cambio te gustaría analizar hoy?';
};

/**
 * Sends headers and sample data to Gemini to classify columns and suggest metrics.
 * This step saves tokens by filtering irrelevant columns before sending the full file.
 */
const classifyAndDefineMetrics = async (fileName: string, headers: string[], sample: any[]): Promise<DataProcessingInstructions> => {
    const prompt = `
    Actúa como un Ingeniero de Datos experto en Logística.
    Tengo un archivo Excel llamado "${fileName}" con las siguientes columnas: ${JSON.stringify(headers)}.
    Aquí tienes una muestra de los datos (primeras 3 filas): ${JSON.stringify(sample)}.

    Tu tarea es optimizar estos datos para un análisis de "Impacto Operativo".
    
    1. **Clasifica las columnas** en estas categorías (si aplican):
       - fechas, operadores, sku/ítems, cantidades, productividad, tiempos/duración, ubicaciones, estado/flags, identificadores.
    
    2. **Selecciona las columnas relevantes** para analizar productividad y eficiencia operativa. Descarta columnas irrelevantes (ej: colores, comentarios largos vacíos, IDs de sistema internos irrelevantes).

    3. **Detecta Métricas Calculadas**: Si faltan métricas clave pero se pueden calcular con operaciones simples (+, -, *, /) entre dos columnas existentes, defínelas.
       Ejemplo: Si tienes "Unidades" y "Horas", crea "Productividad" = "Unidades" / "Horas".
       Ejemplo: Si tienes "Fin" e "Inicio", crea "Duración" = "Fin" - "Inicio" (Solo si son numéricos, no fechas complejas).

    Responde EXCLUSIVAMENTE con un JSON con este formato (sin markdown):
    {
        "keepColumns": ["Columna1", "Columna2", ...],
        "calculatedMetrics": [
            { "name": "NombreMetrica", "operation": "DIVIDE", "operand1": "ColumnaA", "operand2": "ColumnaB" }
        ],
        "classification": { "Columna1": "fechas", "Columna2": "operadores" ... }
    }
    Nota: "operation" puede ser "ADD", "SUBTRACT", "MULTIPLY", "DIVIDE".
    `;

    const payload = {
        history: [],
        systemInstruction: "Eres un experto en procesamiento de datos. Responde solo en JSON.",
        newMessage: prompt
    };

    try {
        const { text } = await googleSheetsService.callGeminiAgent(payload);
        // Clean response to ensure JSON parsing
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr) as DataProcessingInstructions;
    } catch (error) {
        console.error("Error classifying columns:", error);
        // Fallback: Keep all original headers if AI fails
        return {
            keepColumns: headers,
            calculatedMetrics: []
        };
    }
};

/**
 * Sends the user's message and the entire conversation history to the backend proxy.
 * If file data is present, it appends the CSV data to the user message.
 */
const sendMessage = async (
    history: { text: string, sender: 'user' | 'agent' }[], 
    message: string, 
    fileData?: { fileName: string; data: string }[] // data is now string (CSV)
): Promise<string> => {

    let fullMessage = message;
    let totalTokensUsed = 0;

    // --- Step 1: Append CSV file data to the message ---
    if (fileData && fileData.length > 0) {
        const fileContentString = fileData.map(file => 
            `--- Contenido del archivo: ${file.fileName} (Formato CSV) ---\n${file.data}`
        ).join('\n\n');
        
        console.log("Appending raw CSV data to message...");
        // We provide the raw CSV data directly to the agent.
        fullMessage = `Aquí tienes los datos de los archivos adjuntos en formato CSV. Por favor, analízalos en el contexto de mi solicitud anterior: "${message}"\n\n${fileContentString}`;
    }

    // --- Step 2: Send message to the main analyst agent ---
    const memory = await googleSheetsService.getAnalystMemory();
    const historyForPrompt = memory.length > 0
        ? `Aquí hay un resumen de análisis pasados para tu referencia:\n${JSON.stringify(memory)}`
        : "No se han registrado análisis previos.";
    const fullSystemInstruction = `${systemInstruction}\n\n${historyForPrompt}`;

    const payload = {
        history,
        systemInstruction: fullSystemInstruction,
        newMessage: fullMessage,
    };

    const { text: responseText, totalTokens } = await googleSheetsService.callGeminiAgent(payload);
    totalTokensUsed += totalTokens || 0;
    let processedText = responseText;
    
    if (!processedText) {
        return "No he podido procesar la solicitud. Es posible que el volumen de datos CSV exceda el límite de tokens permitidos. Por favor, intenta reducir el rango de fechas.";
    }

    // The logic to parse the [SAVE_MEMORY] command remains on the client.
    if (processedText.includes('[SAVE_MEMORY]')) {
        try {
            const jsonString = processedText.substring(processedText.indexOf('{'));
            const memoryData = JSON.parse(jsonString);

            const memoryEntryWithTokens = {
                ...memoryData,
                totalTokens: totalTokensUsed, // Use the accumulated token count
            };

            await googleSheetsService.addAnalystMemoryEntry(memoryEntryWithTokens);

            processedText = processedText.substring(0, processedText.indexOf('[SAVE_MEMORY]')).trim();
            if(processedText) { // Only add the message if there's text before the command
              processedText += "\n\n*(He registrado este análisis en mi bitácora para futuras referencias.)*";
            } else {
              processedText = "Análisis guardado en la bitácora. ¿Hay algo más que necesites?";
            }
        } catch (error) {
            console.error("Error parsing or saving memory entry:", error);
            // Clean the response even if saving fails, so the user doesn't see the command.
            processedText = processedText.substring(0, processedText.indexOf('[SAVE_MEMORY]')).trim();
        }
    }

    return processedText;
};

export const agentService = {
    initializeChat,
    sendMessage,
    classifyAndDefineMetrics
};