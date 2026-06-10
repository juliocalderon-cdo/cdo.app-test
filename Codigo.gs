






// =================================================================
// =================== CONFIGURACIÓN DE ENTORNO ===================
// =================================================================

/**
 * Obtiene un valor de configuración de las Propiedades del Script.
 * Lanza un error si la propiedad no está definida para evitar fallos silenciosos.
 * @param {string} key - El nombre de la propiedad a obtener.
 * @returns {string} El valor de la propiedad.
 */
function getConfig(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (value === null || value === undefined) {
    Logger.log(`ERROR: La propiedad del script '${key}' no fue encontrada.`);
    throw new Error(`La propiedad del script requerida '${key}' no está definida. Por favor, configúrela en los ajustes del proyecto.`);
  }
  Logger.log(`Éxito al obtener la propiedad '${key}'.`);
  return value;
}

// --- Nombres de las Hojas ---
const USERS_SHEET_NAME = "Usuarios";
const TASKS_SHEET_NAME = "Tasks";
const PACK_LOCATION_SHEET_NAME = "PackLocationDet";
const OLPN_DISTRIBUTION_LOG_SHEET_NAME = "RepartoOlpnsFrescos";
const MANHATTAN_SHIPMENTS_SHEET_NAME = "EnviosExpeManhattan";
const APPOINTMENTS_SHEET_NAME = "CitasExpeManhattan";
const MANHATTAN_CONFIG_SHEET_NAME = "ManhattanConfig";
const MEMORIA_ANALISTA_SHEET_NAME = "MemoriaAnalistaImpactoOper";
const AUDIT_SHEET_NAME = "AuditoriaDeOlpns";
const LOCATION_AUDIT_SHEET_NAME = "AuditoriaDeUbicaciones";
const IMPACT_METRICS_SHEET_NAME = "MetricasDeImpacto";

// =================================================================
// =================== SERVIDOR WEB Y API GATEWAY ==================
// =================================================================

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index.html')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle("APP CDO");
}

function apiGateway(request) {
  Logger.log(`apiGateway recibió una solicitud. Acción: ${request.action}`);
  const { action, payload } = request;
  try {
    let data;
    switch (action) {
      // --- Configuración de la App ---
      case 'getAppConfig': data = getAppConfig(); break;

      // --- Tareas de Importación ---
      case 'getTasks': data = getTasks(); break;
      case 'addTasks': data = addTasks(payload); break;
      case 'updateTask': data = updateTask(payload); break;
      
      // --- Envíos y Citas Manhattan ---
      case 'getManhattanShipments': data = getManhattanShipments(payload); break;
      case 'addManhattanShipments': data = addManhattanShipments(payload); break;
      case 'createManhattanAppointments': data = createManhattanAppointments(payload); break;

      // --- Frescos / API Manhattan ---
      case 'getPackLocationDetails': data = getPackLocationDetails(); break;
      case 'getManhattanToken': data = getManhattanToken(); break;
      case 'searchManhattanOlpn': data = searchManhattanOlpn(payload); break;
      case 'combineManhattanOlpns': data = combineManhattanOlpns(payload); break;
      case 'addOlpnDistributionLog': data = addOlpnDistributionLog(payload); break;
      case 'getOlpnDistributionLog': data = getOlpnDistributionLog(payload); break;

      // --- Agente de IA ---
      case 'getAnalystMemory': data = getAnalystMemory(); break;
      case 'addAnalystMemoryEntry': data = addAnalystMemoryEntry(payload); break;
      case 'callGeminiAgent': data = callGeminiAgent(payload); break;
      case 'analyzeWithGemini': data = analyzeWithGemini(payload); break;
      case 'getImpactMetrics': data = getImpactMetrics(); break;
      case 'getImpactFilterOptions': data = getImpactFilterOptions(payload); break; 
      case 'getImpactAnalysisData': data = getImpactAnalysisData(payload); break;
      case 'getAnalystV2Prompt': data = getAnalystV2Prompt(payload); break;

      // --- Módulo de Calidad (Auditoría / Logística Inversa) ---
      case 'searchManhattanOlpnForAudit': data = searchManhattanOlpnForAudit(payload); break;
      case 'searchManhattanItems': data = searchManhattanItems(payload); break;
      case 'searchManhattanItemByBarcode': data = searchManhattanItemByBarcode(payload); break;
      case 'getAuditRecords': data = getAuditRecords(payload); break;
      case 'saveAuditRecords': data = saveAuditRecords(payload); break;
      case 'processReverseLogistics': data = processReverseLogistics(payload); break;
      
      // --- Auditoría de Ubicaciones ---
      case 'searchManhattanLocation': data = searchManhattanLocation(payload); break;
      case 'searchManhattanIlpnsInLocation': data = searchManhattanIlpnsInLocation(payload); break;
      case 'searchManhattanOlpnsInLocation': data = searchManhattanOlpnsInLocation(payload); break;
      case 'getLocationAuditRecords': data = getLocationAuditRecords(payload); break;
      case 'saveLocationAuditRecords': data = saveLocationAuditRecords(payload); break;

      default: throw new Error(`Acción desconocida: ${action}`);
    }
    Logger.log(`apiGateway completó la acción '${action}' exitosamente.`);
    return { success: true, data: data };
  } catch (e) {
    Logger.log('API Gateway Error: ' + e.toString() + ' Stack: ' + e.stack);
    return { success: false, message: e.message };
  }
}

function userApiGateway(request) {
  Logger.log(`userApiGateway recibió una solicitud. Acción: ${request.action}`);
  const { action, payload } = request;
  try {
    let data;
    switch (action) {
      // --- Autenticación y Usuarios ---
      case 'login': data = login(payload); break;
      case 'getUsers': data = getUsers(); break;
      case 'addUser': data = addUser(payload); break;
      case 'updateUser': data = updateUser(payload); break;
      case 'deleteUser': data = deleteUser(payload); break;
      default: throw new Error(`Acción de usuario desconocida: ${action}`);
    }
    return { success: true, data: data };
  } catch (e) {
    Logger.log('User API Gateway Error: ' + e.toString() + ' Stack: ' + e.stack);
    return { success: false, message: e.message };
  }
}

// =================================================================
// =================== LÓGICA DEL AGENTE DE IA =====================
// =================================================================

function callGeminiAgent(payload) {
  Logger.log('Iniciando callGeminiAgent...');
  const { history, systemInstruction, newMessage } = payload;

  const apiKey = getConfig('API_KEY'); 
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent";

  const contents = history.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: newMessage }]
  });

  const apiPayload = {
    contents: contents,
    system_instruction: {
      parts: [{ text: systemInstruction }]
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-goog-api-key": apiKey
    },
    payload: JSON.stringify(apiPayload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`Error from Gemini API: ${responseBody}`);
  }

  const jsonResponse = JSON.parse(responseBody);
  const text = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const totalTokens = jsonResponse.usageMetadata?.totalTokenCount || 0;

  if (!text && jsonResponse.candidates?.[0]?.finishReason === "SAFETY") {
    throw new Error("La respuesta fue bloqueada por políticas de seguridad.");
  }

  return { text, totalTokens };
}

function analyzeWithGemini(payload) {
  Logger.log('Iniciando analyzeWithGemini...');
  const { prompt } = payload;

  const apiKey = getConfig('API_KEY');
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent";

  const apiPayload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-goog-api-key": apiKey
    },
    payload: JSON.stringify(apiPayload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`Error from Gemini API: ${responseBody}`);
  }

  const jsonResponse = JSON.parse(responseBody);
  const text = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!text && jsonResponse.candidates?.[0]?.finishReason === "SAFETY") {
    throw new Error("La respuesta del análisis fue bloqueada por políticas de seguridad.");
  }

  return text;
}

function getAnalystMemory() {
  try {
    const sheet = getAppSpreadsheet().getSheetByName(MEMORIA_ANALISTA_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) {
      return [];
    }
    return sheetDataToObjects(sheet);
  } catch(e) {
    Logger.log('Error en getAnalystMemory: ' + e.stack);
    return [];
  }
}

function addAnalystMemoryEntry(entry) {
  if (!entry || typeof entry !== 'object' || !entry.tipoCambio || !entry.resultado) {
    throw new Error("La entrada de memoria es inválida o le faltan campos obligatorios.");
  }
  
  const sheet = getOrCreateSheet(getAppSpreadsheet(), MEMORIA_ANALISTA_SHEET_NAME, [
    "fechaAnalisis", "tipoCambio", "resultado", "metricasClave", "observaciones", "totalTokens"
  ]);
  
  const nowISO = new Date().toISOString();
  
  const newEntry = {
    fechaAnalisis: nowISO,
    tipoCambio: entry.tipoCambio || '',
    resultado: entry.resultado || 'neutro',
    metricasClave: entry.metricasClave || '',
    observaciones: entry.observaciones || '',
    totalTokens: entry.totalTokens || 0
  };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => newEntry[header] !== undefined ? newEntry[header] : '');

  sheet.appendRow(newRow);
  
  return newEntry;
}

function getAppConfig() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const version = properties.getProperty('VERSION') || '?.?.?';
    const ambiente = properties.getProperty('AMBIENTE') || 'No definido';
    return { version, ambiente };
  } catch(e) {
    return { version: 'error', ambiente: 'error' };
  }
}

// =================================================================
// =================== LÓGICA AGENTE V2 (IMPACTO) ==================
// =================================================================

function getImpactMetrics() {
  const sheet = getAppSpreadsheet().getSheetByName(IMPACT_METRICS_SHEET_NAME);
  return sheet ? sheetDataToObjects(sheet) : [];
}

function normalizeImpactHeader(h) {
  return String(h || '').toUpperCase().trim().replace(/\s/g, '').replace(/_DE_/g, '').replace(/DE/g, '').replace(/_/g, '');
}

function getImpactFilterOptions(payload) {
  const { processName } = payload;
  const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID_DATOS_MANH_IA_AGENT'));
  const sheet = ss.getSheetByName(processName);
  if (!sheet) return { unidadesNegocio: [], zonas: [], tiposPicking: [] };
  const data = sheet.getDataRange().getValues();
  const headers = data.shift().map(normalizeImpactHeader);
  const getUnique = (idx) => {
    if (idx === -1) return [];
    const set = new Set();
    data.forEach(row => { if(row[idx]) set.add(String(row[idx]).trim()); });
    return Array.from(set).filter(v => v !== '').sort();
  };
  return {
    unidadesNegocio: getUnique(headers.indexOf('UNIDADNEGOCIO')),
    zonas: getUnique(headers.indexOf('ZONA')),
    tiposPicking: getUnique(headers.indexOf('TIPOPICKING'))
  };
}

function getImpactAnalysisData(payload) {
  const { processName, changeDate, filters } = payload;
  const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID_DATOS_MANH_IA_AGENT'));
  const sheet = ss.getSheetByName(processName);
  if (!sheet) throw new Error(`Hoja '${processName}' no encontrada.`);
  const rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const normHeaders = rawHeaders.map(normalizeImpactHeader);
  const allData = sheetDataToObjects(sheet);
  const targetDate = new Date(changeDate);
  const windowMs = 4 * 30 * 24 * 60 * 60 * 1000;
  const start = new Date(targetDate.getTime() - windowMs);
  const end = new Date(targetDate.getTime() + windowMs);

  const buKey = rawHeaders[normHeaders.indexOf('UNIDADNEGOCIO')]?.trim();
  const zonaKey = rawHeaders[normHeaders.indexOf('ZONA')]?.trim();
  const pickingKey = rawHeaders[normHeaders.indexOf('TIPOPICKING')]?.trim();
  
  return allData.filter(row => {
    const d = new Date(row.FECHA);
    if (d < start || d > end) return false;
    if (filters) {
      if (buKey && filters.bus?.length && !filters.bus.includes(String(row[buKey]))) return false;
      if (zonaKey && filters.zones?.length && !filters.zones.includes(String(row[zonaKey]))) return false;
      if (pickingKey && filters.types?.length && !filters.types.includes(String(row[pickingKey]))) return false;
    }
    return true;
  });
}

/**
 * PROCESAMIENTO DETERMINISTA DE DATOS PARA LA IA:
 * 1. Calcula promedios diarios (para el JSON diario).
 * 2. Calcula el promedio global Pre y Post (para que la IA no tenga que calcular nada).
 */
function calculateDeterministicImpact(data, changeDate, indicators) {
  const cutoff = new Date(changeDate).getTime();
  const preRows = data.filter(r => new Date(r.FECHA).getTime() < cutoff);
  const postRows = data.filter(r => new Date(r.FECHA).getTime() >= cutoff);

  const calculateMetricValue = (rows, formula) => {
    if (rows.length === 0) return 0;
    const parts = formula.split(/[\/\*\+\-]/);
    const op = formula.match(/[\/\*\+\-]/)?.[0] || null;
    const colA = parts[0].trim();
    const colB = parts[1]?.trim();

    const sumA = rows.reduce((s, r) => s + (Number(r[colA]) || 0), 0);
    if (!op) return sumA;
    const sumB = rows.reduce((s, r) => s + (Number(r[colB]) || 0), 0);
    
    if (op === '/') return sumB !== 0 ? sumA / sumB : 0;
    if (op === '*') return sumA * sumB;
    if (op === '+') return sumA + sumB;
    if (op === '-') return sumA - sumB;
    return sumA;
  };

  const summary = indicators.map(ind => {
    const valPre = calculateMetricValue(preRows, ind.OrigenDato);
    const valPost = calculateMetricValue(postRows, ind.OrigenDato);
    const diff = valPre !== 0 ? ((valPost - valPre) / valPre) * 100 : 0;
    
    return {
      indicador: ind.Indicador,
      valorPre: Number(valPre.toFixed(2)),
      valorPost: Number(valPost.toFixed(2)),
      variacionPorcentual: Number(diff.toFixed(2))
    };
  });

  // Agrupación diaria para el JSON compacto solicitado
  const daysMap = {};
  data.forEach(row => {
    const d = row.FECHA.split('T')[0];
    if (!daysMap[d]) daysMap[d] = [];
    daysMap[d].push(row);
  });

  const dailyJson = Object.keys(daysMap).sort().map(d => {
    const dayRows = daysMap[d];
    const dayObj = { "Fecha": d };
    indicators.forEach(ind => {
      dayObj[ind.Indicador] = Number(calculateMetricValue(dayRows, ind.OrigenDato).toFixed(2));
    });
    return dayObj;
  });

  return { summary, dailyJson };
}

function getAnalystV2Prompt(payload) {
  const { processName, changeDate, selectedIndicators, data, filterContext } = payload;
  
  // Realizamos TODO el cálculo matemático aquí en el Servidor
  const results = calculateDeterministicImpact(data, changeDate, selectedIndicators);
  
  const indicatorsSummaryStr = results.summary.map(s => 
    `- **${s.indicador}**: Pre: ${s.valorPre} | Post: ${s.valorPost} | Variación: ${s.variacionPorcentual}%`
  ).join('\n');

  return `
    Actúa como "Analista de Impacto GDN". Cambio operativo en **${processName}** el **${changeDate}**.
    
    **Segmento analizado:**
    ${filterContext}
    
    **1. RESULTADOS MATEMÁTICOS REALES (INALTERABLES):**
    El sistema ya ha procesado los datos de 4 meses antes y 4 meses después. 
    Utiliza ESTOS VALORES EXACTOS para tu informe y NO intentes promediarlos tú:
    ${indicatorsSummaryStr}
    
    **2. DATOS DIARIOS PARA ANÁLISIS DE TENDENCIAS:**
    Aquí tienes el detalle diario para que identifiques si hubo mejora progresiva o caídas puntuales:
    ${JSON.stringify(results.dailyJson, null, 2)}
    
    **Instrucciones Obligatorias:**
    - Presenta una tabla comparativa Markdown usando los valores de la sección "RESULTADOS MATEMÁTICOS REALES".
    - Analiza las tendencias basándote en los datos diarios.
    - Concluye si el cambio fue exitoso basándote en los números.
    - El comando [SAVE_MEMORY] DEBE contener exactamente los porcentajes de variación calculados arriba.

    [SAVE_MEMORY] {"tipoCambio": "${processName} (${changeDate})", "resultado": "...", "metricasClave": "${results.summary.map(s => `${s.indicador} ${s.variacionPorcentual >= 0 ? '+' : ''}${s.variacionPorcentual}%`).join(', ')}", "observaciones": "..."}
  `;
}

function extractTokens(json) {
  const metadata = json.usageMetadata || {};
  const total = metadata.totalTokenCount || 
                (Number(metadata.promptTokenCount || 0) + Number(metadata.candidatesTokenCount || 0));
  return Number(total) || 0;
}


// =======================================================
// === FUNCIONES PARA ENVÍOS Y CITAS DE MANHATTAN ========
// =======================================================

function getManhattanShipments(payload) {
  try {
    const { date } = payload;
    if (!date) throw new Error('La fecha es un parámetro requerido.');
    
    const sheet = getOrCreateSheet(getAppSpreadsheet(), MANHATTAN_SHIPMENTS_SHEET_NAME);
    if (sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    const dateIndex = headers.indexOf('FechaHoraEnvio');
    if (dateIndex === -1) return [];
    
    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    
    const originalDataWithIndex = data.map((row, index) => [...row, index + 2]);
    const filteredRowsWithOriginalIndex = originalDataWithIndex.filter(rowWithIndex => {
        const cellValue = rowWithIndex[dateIndex];
        if (cellValue instanceof Date) {
            const cellDate = new Date(Date.UTC(cellValue.getFullYear(), cellValue.getMonth(), cellValue.getDate()));
            return cellDate.getTime() === targetDate.getTime();
        }
        return false;
    });

    return filteredRowsWithOriginalIndex.map(rowWithIndex => {
      const obj = { _rowIndex: rowWithIndex[rowWithIndex.length - 1] };
      const row = rowWithIndex.slice(0, -1);
      headers.forEach((header, i) => {
        obj[header] = (row[i] instanceof Date) ? row[i].toISOString() : row[i];
      });
      return obj;
    });
  } catch (e) {
    throw new Error('Error al obtener los envíos: ' + e.message);
  }
}

function addManhattanShipments(payload) {
    try {
        const { shipments: shipmentsFromExcel, user } = payload;
        if (!shipmentsFromExcel || !Array.isArray(shipmentsFromExcel) || shipmentsFromExcel.length === 0 || !user) {
            throw new Error('Datos insuficientes para crear envíos.');
        }

        const lock = LockService.getScriptLock();
        lock.waitLock(30000);

        try {
            const appSS = getAppSpreadsheet();
            const configSheet = getOrCreateSheet(appSS, MANHATTAN_CONFIG_SHEET_NAME, ["Contador", "Valor"]);
            
            let stopIdCounter = getAndIncrementCounter(configSheet, 'StopId');
            
            const sectorMapping = { 'Secos': 'S', 'Frescos': 'F', 'Bas': 'B', 'Electro': 'E' };
            let stopIdOffset = 0;

            const shipmentsToCreate = shipmentsFromExcel.map((shipment) => {
                const nowISO = new Date().toISOString().replace(/\.\d+/, '');
                const stops = [];
                
                const pickupStopId = `STP${String(stopIdCounter + stopIdOffset).padStart(10, '0')}`;
                stops.push({ StopId: pickupStopId, StopActionId: { StopActionId: "PU" }, StopSequence: 1, OrgId: "1001", FacilityId: "100", PlannedArrivalDateTime: nowISO, PlannedDepartureDateTime: nowISO });
                shipment['Stop 0'] = pickupStopId;
                stopIdOffset++;

                const paradas = [];
                for (let i = 1; i <= 15; i++) {
                    const paradaKey = `Parada ${i}`;
                    if (shipment[paradaKey]) {
                        paradas.push({ facilityId: shipment[paradaKey], originalIndex: i });
                    }
                }

                paradas.forEach((parada, index) => {
                    const stopSequence = index + 2;
                    const deliveryStopId = `STP${String(stopIdCounter + stopIdOffset).padStart(10, '0')}`;
                    stops.push({ StopId: deliveryStopId, StopActionId: { StopActionId: "DL" }, StopSequence: stopSequence, OrgId: "1001", FacilityId: String(parada.facilityId), PlannedArrivalDateTime: nowISO, PlannedDepartureDateTime: nowISO });
                    shipment[`Stop ${parada.originalIndex}`] = deliveryStopId;
                    stopIdOffset++;
                });
                
                const sectorLetra = sectorMapping[shipment['Sector de carga']] || 'X';
                const shipmentId = `${shipment['Número de envío']}-${sectorLetra}-1`;
                
                return { Stop: stops, OrgId: "1001", TrailerNumber: shipment['Tráiler'], ShipmentId: shipmentId, _originalData: shipment };
            });

            const shipmentApiResponse = callManhattanApi('/shipment/api/shipment/shipment/bulkImport', { data: shipmentsToCreate });

            const successfulShipments = [];
            const failures = [];
            const failedShipmentIds = new Set();

            if (shipmentApiResponse.success) {
                const failedRecordsMap = new Map((shipmentApiResponse.data?.FailedRecords || []).map(r => [r.ShipmentId, r]));
                shipmentsToCreate.forEach(s => {
                    if (failedRecordsMap.has(s.ShipmentId)) {
                        const errorMsg = findErrorMessageForShipment(s.ShipmentId, shipmentApiResponse.messages);
                        failures.push({ shipmentId: s.ShipmentId, message: errorMsg, record: s._originalData });
                        failedShipmentIds.add(s.ShipmentId);
                    } else {
                        successfulShipments.push(s);
                    }
                });
            } else {
                shipmentsToCreate.forEach(s => {
                    failures.push({ shipmentId: s.ShipmentId, message: shipmentApiResponse.message || 'Error de conexión con la API de envíos.', record: s._originalData });
                    failedShipmentIds.add(s.ShipmentId);
                });
            }

            if (successfulShipments.length > 0) {
                persistSuccessfulShipments(appSS, successfulShipments, user);
                updateCounter(configSheet, 'StopId', stopIdCounter + stopIdOffset);
            }

            shipmentsToCreate.forEach(s => {
                if (failedShipmentIds.has(s.ShipmentId) && s._originalData['Crear Cita'] === 'SI') {
                    failures.push({
                        appointmentId: `Cita para envío ${s._originalData['Número de envío']}`,
                        message: 'No se intentó crear la cita porque el envío correspondiente falló.',
                        record: s._originalData
                    });
                }
            });

            const shipmentsToCreateAppointment = successfulShipments.filter(s => s._originalData['Crear Cita'] === 'SI');
            const createdAppointments = [];
            if (shipmentsToCreateAppointment.length > 0) {
                const formattedForAppointment = shipmentsToCreateAppointment.map(s => {
                    const completeData = { ...s._originalData };
                    completeData['Número de envío Manhattan'] = s.ShipmentId;
                    return completeData;
                });
                const appointmentCreationResult = processAppointmentCreation(appSS, configSheet, formattedForAppointment, user);
                if (appointmentCreationResult) {
                    createdAppointments.push(...(appointmentCreationResult.createdAppointments || []));
                    failures.push(...(appointmentCreationResult.failures || []));
                }
            }

            return { successCount: successfulShipments.length, failureCount: failures.length, totalCount: shipmentsFromExcel.length, failures: failures, createdAppointments: createdAppointments };

        } finally {
            lock.releaseLock();
        }
    } catch (e) {
        const totalCount = (payload?.shipments && Array.isArray(payload.shipments)) ? payload.shipments.length : 0;
        return { successCount: 0, failureCount: totalCount, totalCount: totalCount, failures: [{ shipmentId: 'General', message: 'Error inesperado del servidor: ' + e.message, record: {} }], createdAppointments: [] };
    }
}

function createManhattanAppointments(payload) {
    const { shipments, user } = payload;
    if (!shipments || !Array.isArray(shipments) || shipments.length === 0 || !user) {
        throw new Error("Datos insuficientes para crear citas.");
    }
    
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
        const appSS = getAppSpreadsheet();
        const configSheet = getOrCreateSheet(appSS, MANHATTAN_CONFIG_SHEET_NAME, ["Contador", "Valor"]);
        return processAppointmentCreation(appSS, configSheet, shipments, user);

    } finally {
        lock.releaseLock();
    }
}

// =================================================================
// =================== LÓGICA DE FRESCOS (MANHATTAN) ===============
// =================================================================

function getPackLocationDetails() {
  const sheet = getAppSpreadsheet().getSheetByName(PACK_LOCATION_SHEET_NAME);
  if (!sheet) return [];
  return sheetDataToObjects(sheet);
}

function addOlpnDistributionLog(logEntry) {
  const sheet = getAppSpreadsheet().getSheetByName(OLPN_DISTRIBUTION_LOG_SHEET_NAME);
  if (!sheet) throw new Error(`La hoja '${OLPN_DISTRIBUTION_LOG_SHEET_NAME}' no fue encontrada.`);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => {
    const key = String(header || '').toLowerCase().replace(/\s/g, '');
    if (key === 'fechahoraconfirmado') {
      return new Date().toISOString();
    }
    return logEntry[key] || '';
  });
  
  sheet.appendRow(newRow);
  return { success: true };
}

function getOlpnDistributionLog(filters) {
  const sheet = getAppSpreadsheet().getSheetByName(OLPN_DISTRIBUTION_LOG_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const logs = sheetDataToObjects(sheet);

  if (!filters || Object.keys(filters).length === 0) {
      return logs;
  }

  return logs.filter(log => {
    if (!log.fechahoraconfirmado) return false;
    
    const logDate = new Date(log.fechahoraconfirmado);

    if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        if (logDate < start) return false;
    }
    if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (logDate > end) return false;
    }
    
    if (filters.palletid && !String(log.palletid || '').toLowerCase().includes(filters.palletid.toLowerCase())) return false;
    if (filters.usuario && !String(log.usuario || '').toLowerCase().includes(filters.usuario.toLowerCase())) return false;
    if (filters.olpnorigenid && !String(log.olpnorigenid || '').toLowerCase().includes(filters.olpnorigenid.toLowerCase())) return false;
    if (filters.olpndestinoid && !String(log.olpndestinoid || '').toLowerCase().includes(filters.olpndestinoid.toLowerCase())) return false;
    
    return true;
  });
}

function getManhattanToken() {
  const url = `${getConfig('MANHATTAN_AUTH_HOST')}/oauth/token`;
  const payload = { 'grant_type': 'password', 'username': getConfig('MANHATTAN_USER'), 'password': getConfig('MANHATTAN_PASS') };
  const options = {
    'method': 'post',
    'contentType': 'application/x-www-form-urlencoded',
    'headers': {
      'Authorization': 'Basic b21uaWNvbXBvbmVudC4xLjAuMDpiNHM4cmdUeWc1NVhZTnVu'
    },
    'payload': payload,
    'muteHttpExceptions': true
  };
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  if (responseCode === 200) return JSON.parse(responseBody);
  throw new Error(`Error de autenticación con Manhattan: ${responseCode} - ${responseBody}`);
}

function searchManhattanOlpn(payload) {
  const { token, palletId } = payload;
  if (!token || !palletId) throw new Error("Token y PalletID son requeridos.");

  const url = `${getConfig('MANHATTAN_HOST')}/pickpack/api/pickpack/olpn/search`;
  const apiPayload = {
    "Size": 500,
    "Query": `PalletId='${palletId}'`,
    "Template": { "OlpnId": "", "DestinationFacilityId": "", "PalletId": "", "CurrentLocationId": "", "PackerId": "", "Status": "" }
  };
  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'selectedBusinessUnit': '1002',
      'selectedOrganization': '1001',
      'selectedLocation': '100'
    },
    'payload': JSON.stringify(apiPayload),
    'muteHttpExceptions': true
  };
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  if (responseCode === 200) return JSON.parse(responseBody);
  throw new Error(`Error al buscar OLPNs en Manhattan: ${responseCode} - ${responseBody}`);
}

function combineManhattanOlpns(payload) {
  const { token, sourceOlpnId, destinationOlpnId } = payload;
  if (!token || !sourceOlpnId || !destinationOlpnId) {
    throw new Error("Token, OLPN de origen y OLPN de destino son requeridos.");
  }
  
  const MANHATTAN_HOST = getConfig('MANHATTAN_HOST');
  
  const validationUrl = `${MANHATTAN_HOST}/pickpack/api/pickpack/olpn/search`;
  const validationPayload = {
    "Size": 2, 
    "Query": `OlpnId in ('${sourceOlpnId}','${destinationOlpnId}')`,
    "Template": { "OlpnId": "", "DestinationFacilityId": "", "Status": "" }
  };
  const validationOptions = {
    'method': 'post',
    'headers': { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'selectedBusinessUnit': '1002', 'selectedOrganization': '1001', 'selectedLocation': '100' },
    'payload': JSON.stringify(validationPayload), 'muteHttpExceptions': true
  };
  
  const validationResponse = UrlFetchApp.fetch(validationUrl, validationOptions);
  if (validationResponse.getResponseCode() !== 200) { 
    throw new Error("Error al validar OLPNs en Manhattan: " + validationResponse.getContentText()); 
  }

  const olpnsData = JSON.parse(validationResponse.getContentText());
  const foundOlpns = olpnsData.data || olpnsData.Data || [];
  
  const sourceOlpn = foundOlpns.find(o => o.OlpnId === sourceOlpnId);
  if (!sourceOlpn) { 
    throw new Error(`El OLPN de origen '${sourceOlpnId}' no fue encontrado en Manhattan.`); 
  }
  if (sourceOlpn.Status !== "7200") { 
    throw new Error(`Error: El OLPN de origen tiene un estado inválido (${sourceOlpn.Status}). Se esperaba 7200.`); 
  }

  const destOlpn = foundOlpns.find(o => o.OlpnId === destinationOlpnId);
  if (destOlpn) {
    if (sourceOlpn.DestinationFacilityId !== destOlpn.DestinationFacilityId) { 
      throw new Error(`Error: Los OLPNs no pertenecen a la misma tienda (Origen: ${sourceOlpn.DestinationFacilityId}, Destino: ${destOlpn.DestinationFacilityId}).`); 
    }
    if (!["7100", "7200"].includes(destOlpn.Status)) { 
      throw new Error(`Error: El OLPN de destino tiene un estado inválido (${destOlpn.Status}). Se esperaba 7100 o 7200.`); 
    }
  }

  const combinationUrl = `${MANHATTAN_HOST}/device-integration/api/deviceintegration/process/`;
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  
  const combinationPayload = {
    "EndpointId": "AU01-Combine-Source-Endpoint", "header": { "Organization": "1001", "Location": "100", "BusinessUnit": "1002" },
    "Message": { "MessageType": "COMBINE", "contextLocation": "100", "contextBusinessUnit": "1002", "contextOrg": "1001", "contextUser": getConfig('MANHATTAN_USER'), "SourceEndpointId": "AU01-Combine-Source-Endpoint", "EventId": 999999, "User": getConfig('MANHATTAN_USER'), "DTT": timestamp, "FromOlpnId": sourceOlpnId, "ToOlpnId": destinationOlpnId },
    "IncludeRequest": true
  };
  const combinationOptions = {
    'method': 'post', 'headers': { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'selectedBusinessUnit': '1002', 'selectedOrganization': '1001', 'selectedLocation': '100' },
    'payload': JSON.stringify(combinationPayload), 'muteHttpExceptions': true
  };

  const combinationResponse = UrlFetchApp.fetch(combinationUrl, combinationOptions);
  const responseCode = combinationResponse.getResponseCode();
  const responseText = combinationResponse.getContentText();

  if (responseCode !== 200) { 
    throw new Error(`Error en la API de combinación de Manhattan: ${responseText}`); 
  }
  return JSON.parse(responseText);
}

// =================================================================
// =================== FUNCIONES DE CALIDAD / AUDITORÍA ============
// =================================================================

function searchManhattanOlpnForAudit(payload) {
  const { token, olpnId } = payload;
  if (!token || !olpnId) throw new Error("Token y OLPN ID son requeridos.");

  const url = `${getConfig('MANHATTAN_HOST')}/pickpack/api/pickpack/olpn/search`;
  
  const apiPayload = {
    "Size": 100,
    "Query": `OlpnId in ('${olpnId}')`,
    "Template": {
        "OlpnId": "",
        "PalletId": "",
        "DestinationFacilityId": "",
        "CurrentLocationId": "",
        "OlpnDetail": [
            {
                "ItemId": "",
                "ItemDescription": "",
                "PackedQuantity": "",
                "ExpirationDate": "",
                "BatchNumber": "",
                "QuantityUomId": ""
            }
        ]
    }
  };

  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'selectedBusinessUnit': '1002',
      'selectedOrganization': '1001',
      'selectedLocation': '100'
    },
    'payload': JSON.stringify(apiPayload),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  
  if (responseCode === 200) {
      return JSON.parse(responseBody);
  }
  
  throw new Error(`Error al buscar OLPN para auditoría en Manhattan: ${responseCode} - ${responseBody}`);
}

function searchManhattanItems(payload) {
  const { token, itemIds } = payload;
  if (!token || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      throw new Error("Token y lista de Item IDs son requeridos.");
  }

  const url = `${getConfig('MANHATTAN_HOST')}/item-master/api/item-master/item/search`;
  
  const idsString = itemIds.map(id => `'${id}'`).join(',');
  
  const apiPayload = {
    "Query": `ItemId in (${idsString})`,
    "Template": {
        "ItemId": "",
        "TrackExpiryDate": "",
        "TrackBatchNumber": "",
        "Style": "",
        "ItemCode": [
            {
                "CodeValue": ""
            }
        ],
        "ItemPackage": [
            {
                "UomId": "",
                "Quantity": ""
            }
        ],
        "ShortDescription": ""
    },
    "Size": 2000
  };

  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'selectedBusinessUnit': '1002',
      'selectedOrganization': '1001',
      'selectedLocation': '100'
    },
    'payload': JSON.stringify(apiPayload),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  
  if (responseCode === 200) {
      return JSON.parse(responseBody);
  }
  
  throw new Error(`Error al buscar Items en Manhattan: ${responseCode} - ${responseBody}`);
}

function searchManhattanItemByBarcode(payload) {
  const { token, barcode } = payload;
  if (!token || !barcode) throw new Error("Token y código de barras son requeridos.");

  const url = `${getConfig('MANHATTAN_HOST')}/item-master/api/item-master/item/search`;
  
  const apiPayload = {
    "Query": `ItemCode.CodeValue in ('${barcode}')`,
    "Template": {
        "ItemId": "",
        "TrackExpiryDate": "",
        "TrackBatchNumber": "",
        "Style": "",
        "ItemCode": [
            {
                "CodeValue": ""
            }
        ],
        "ItemPackage": [
            {
                "UomId": "",
                "Quantity": ""
            }
        ],
        "ShortDescription": ""
    },
    "Size": 2000
  };

  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'selectedBusinessUnit': '1002',
      'selectedOrganization': '1001',
      'selectedLocation': '100'
    },
    'payload': JSON.stringify(apiPayload),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  
  if (responseCode === 200) {
      return JSON.parse(responseBody);
  }
  
  throw new Error(`Error al buscar Item por código de barras: ${responseCode} - ${responseBody}`);
}

function getAuditRecords(filters) {
  const sheet = getAppSpreadsheet().getSheetByName(AUDIT_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const records = sheetDataToObjects(sheet);

  if (!filters || Object.keys(filters).length === 0) {
      return records;
  }

  return records.filter(record => {
    if (!record.FechaHoraAuditoria) return false;
    
    // Comparación robusta de fechas
    const auditDate = new Date(record.FechaHoraAuditoria);

    if (filters.startDate) {
        // Asumimos formato YYYY-MM-DD
        var parts = filters.startDate.split('-');
        // Creamos fecha local a las 00:00:00
        var start = new Date(parts[0], parts[1] - 1, parts[2]); 
        start.setHours(0, 0, 0, 0);
        
        if (auditDate < start) return false;
    }
    if (filters.endDate) {
        var parts = filters.endDate.split('-');
        // Creamos fecha local a las 23:59:59
        var end = new Date(parts[0], parts[1] - 1, parts[2]);
        end.setHours(23, 59, 59, 999);
        
        if (auditDate > end) return false;
    }
    
    if (filters.olpn && !String(record.OlpnId || '').toLowerCase().includes(filters.olpn.toLowerCase())) return false;
    if (filters.usuario && !String(record.Usuario || '').toLowerCase().includes(filters.usuario.toLowerCase())) return false;
    if (filters.tipoDiferencia && record.TipoDiferencia !== filters.tipoDiferencia) return false;
    if (filters.recuento && record.Recuento !== filters.recuento) return false;
    if (filters.sector && record.Sector !== filters.sector) return false;

    
    return true;
  });
}

function saveAuditRecords(payload) {
  const { records } = payload;
  if (!records || !Array.isArray(records) || records.length === 0) {
      throw new Error("No hay registros de auditoría para guardar.");
  }

  const headers = [
    "IdInternoAuditoria", "FechaHoraAuditoria", "Sector", "Usuario", "EstadoAuditoria", "Item", "Descripcion", 
    "CantidadManhattan", "CantidadAuditada", "FechaVtoManhattan", "FechaVtoAuditada", 
    "Diferencia", "TipoDiferencia", "Recuento", "OlpnId", "Local", "Ubicacion",
    "PalletIdOriginal", "PalletIdAuditado", "DiferenciaPallet", "PorcentajeCalidad",
    "DetalleOriginal", "DetalleAuditado", "DetalleDiferencia", 
    "RawOriginal", "RawAuditado", "RawDiferencia"
  ];

  const sheet = getOrCreateSheet(getAppSpreadsheet(), AUDIT_SHEET_NAME, headers);

  const newRows = records.map(record => {
      return headers.map(header => {
          // Use the header directly as the key since the frontend sends PascalCase properties
          return record[header] !== undefined && record[header] !== null ? record[header] : '';
      });
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  
  return { success: true, count: newRows.length };
}

/**
 * Función para procesar Logística Inversa enviando los datos a Manhattan.
 */
function processReverseLogistics(payload) {
  const { token, payload: apiPayload } = payload;
  if (!token || !apiPayload) throw new Error("Token y Payload son requeridos.");

  const url = `${getConfig('MANHATTAN_HOST')}/device-integration/api/deviceintegration/process`;
  
  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'selectedBusinessUnit': '1002',
      'selectedOrganization': '1001',
      'selectedLocation': '100'
    },
    'payload': JSON.stringify(apiPayload),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  
  try {
    const json = JSON.parse(responseBody);
    // Manhattan devuelve un objeto que contiene success: true/false.
    return json;
  } catch(e) {
    Logger.log("Error parseando respuesta de Manhattan: " + responseBody);
    return { success: false, message: "Error al interpretar la respuesta de Manhattan: " + responseBody };
  }
}

// =================================================================
// ============ LÓGICA DE USUARIOS Y TAREAS (APP) ==================
// =================================================================

function login(payload) {
  const { username, password } = payload;
  if (!username || !password) throw new Error("Usuario y contraseña son obligatorios.");
  const usersSheet = getUsersSpreadsheet().getSheetByName(USERS_SHEET_NAME);
  if (!usersSheet) throw new Error(`La hoja '${USERS_SHEET_NAME}' no fue encontrada.`);
  const users = sheetDataToObjects(usersSheet);
  const userRecord = users.find(u => u.Username && u.Username.toString().toLowerCase() === username.toLowerCase());
  if (!userRecord || userRecord.Password.toString() !== password.toString()) { throw new Error("Usuario o contraseña incorrectos."); }
  return { username: userRecord.Username, name: userRecord.Name, role: userRecord.Role, email: userRecord.Email };
}

function getUsers() {
  const sheet = getUsersSpreadsheet().getSheetByName(USERS_SHEET_NAME);
  if (!sheet) return [];
  return sheetDataToObjects(sheet).map(user => ({ username: user.Username, name: user.Name, email: user.Email, role: user.Role })).filter(u => u.username);
}

function addUser(user) {
  const sheet = getUsersSpreadsheet().getSheetByName(USERS_SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const usernameColIndex = headers.findIndex(h => String(h).toLowerCase() === 'username');
  if (usernameColIndex === -1) throw new Error("La columna 'username' no se encuentra en la hoja de Usuarios.");
  const usernames = sheet.getRange(2, usernameColIndex + 1, sheet.getLastRow(), 1).getValues().flat();
  if (usernames.some(u => u.toLowerCase() === user.username.toLowerCase())) { throw new Error(`El usuario '${user.username}' ya existe.`); }
  const newRow = headers.map(header => user[String(header).toLowerCase()] || '');
  sheet.appendRow(newRow);
  const { password, ...userToReturn } = user;
  return userToReturn;
}

function updateUser(user) {
  const sheet = getUsersSpreadsheet().getSheetByName(USERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const usernameColIndex = headers.findIndex(h => String(h).toLowerCase() === 'username');
  if (usernameColIndex === -1) throw new Error("La columna 'username' no se encuentra en la hoja de Usuarios.");
  const rowIndex = data.findIndex(row => row[usernameColIndex] && String(row[usernameColIndex]).toLowerCase() === user.username.toLowerCase());
  if (rowIndex === -1) throw new Error(`Usuario '${user.username}' no encontrado.`);
  const rowToUpdate = rowIndex + 2;
  headers.forEach((header, index) => {
    const key = String(header).toLowerCase();
    if (key in user && (key !== 'password' || user.password)) {
      sheet.getRange(rowToUpdate, index + 1).setValue(user[key]);
    }
  });
  const { password, ...userToReturn } = user;
  return userToReturn;
}

function deleteUser(payload) {
  const { username } = payload;
  const sheet = getUsersSpreadsheet().getSheetByName(USERS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const usernameColIndex = data[0].findIndex(h => String(h).toLowerCase() === 'username');
  if (usernameColIndex === -1) throw new Error("La columna 'username' no se encuentra en la hoja de Usuarios.");
  const rowIndexToDelete = data.slice(1).findIndex(row => row[usernameColIndex] && String(row[usernameColIndex]).toLowerCase() === username.toLowerCase());
  if (rowIndexToDelete === -1) throw new Error(`Usuario '${username}' no encontrado.`);
  sheet.deleteRow(rowIndexToDelete + 2);
  return { username };
}

function getTasks() {
  const spreadsheet = getAppSpreadsheet();
  const tasksSheet = spreadsheet.getSheetByName(TASKS_SHEET_NAME);
  if (!tasksSheet || tasksSheet.getLastRow() < 2) return [];
  const tasksData = tasksSheet.getRange(2, 1, tasksSheet.getLastRow() - 1, 2).getValues();
  return tasksData.map(row => {
    const [taskId, taskJson] = row;
    try { return JSON.parse(taskJson); } 
    catch (e) { Logger.log(`Error parseando tarea ${taskId}: ${e.message}`); return null; }
  }).filter(Boolean);
}

function addTasks(tasks) {
  const spreadsheet = getAppSpreadsheet();
  const tasksSheet = getOrCreateSheet(spreadsheet, TASKS_SHEET_NAME, ["id", "taskData"]);
  const tasksToAdd = tasks.map(task => [task.id, JSON.stringify(task)]);
  if (tasksToAdd.length > 0) {
    tasksSheet.getRange(tasksSheet.getLastRow() + 1, 1, tasksToAdd.length, 2).setValues(tasksToAdd);
  }
  return tasks;
}

function updateTask(taskToUpdate) {
  const sheet = getAppSpreadsheet().getSheetByName(TASKS_SHEET_NAME);
  if (!sheet) throw new Error(`Hoja '${TASKS_SHEET_NAME}' no encontrada.`);
  const ids = sheet.getRange("A:A").getValues().flat();
  const rowIndexToUpdate = ids.indexOf(taskToUpdate.id);
  if (rowIndexToUpdate !== -1) {
    sheet.getRange(rowIndexToUpdate + 1, 2).setValue(JSON.stringify(taskToUpdate));
  } else {
    addTasks([taskToUpdate]);
  }
  return taskToUpdate;
}

// =================================================================
// =================== UTILITIES (HELPER FUNCTIONS) ================
// =================================================================

function getAppSpreadsheet() {
  try { return SpreadsheetApp.openById(getConfig('SPREADSHEET_ID_APP')); } 
  catch(e) { throw new Error(`No se pudo abrir la hoja de cálculo de la app. Verifique el SPREADSHEET_ID_APP.`); }
}

function getUsersSpreadsheet() {
  try { return SpreadsheetApp.openById(getConfig('SPREADSHEET_ID_USUARIOS')); } 
  catch(e) { throw new Error(`No se pudo abrir la hoja de cálculo de usuarios. Verifique el SPREADSHEET_ID_USUARIOS.`); }
}

function sheetDataToObjects(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift().map(h => String(h).trim());
  return data.map((row, rowIndex) => {
    const obj = { _rowIndex: rowIndex + 2 };
    headers.forEach((header, index) => { 
        const value = row[index];
        obj[header || `col_${index}`] = (value instanceof Date) ? value.toISOString() : value; 
    });
    return obj;
  });
}

function getOrCreateSheet(spreadsheet, sheetName, headers) {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
        if (headers && headers.length > 0) sheet.appendRow(headers);
    } else if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
        sheet.appendRow(headers);
    }
    return sheet;
}

function callManhattanApi(endpoint, payload, method = 'post') {
    let url;
    try {
        const tokenResponse = getManhattanToken();
        if (!tokenResponse || !tokenResponse.access_token) {
            return { success: false, message: "Error de Autenticación: No se pudo obtener un token." };
        }
        const token = tokenResponse.access_token;

        const host = getConfig('MANHATTAN_HOST');
        url = `${host}${endpoint}`;

        const options = {
            'method': method,
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'selectedBusinessUnit': '1002',
                'selectedOrganization': '1001',
                'selectedLocation': '100'
            },
            'payload': JSON.stringify(payload),
            'muteHttpExceptions': true
        };
        
        const response = UrlFetchApp.fetch(url, options);
        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        let responseBody;
        try {
            responseBody = responseText ? JSON.parse(responseText) : {};
        } catch (jsonError) {
            return { success: false, message: `La respuesta de Manhattan no es un JSON válido.`, data: null, messages: [] };
        }
        
        const businessSuccess = responseBody.success === true;

        if (!businessSuccess || responseCode >= 400) {
            let userMessage = "Error del Servidor de Manhattan.";
            if (responseBody.messages && Array.isArray(responseBody.messages.Message) && responseBody.messages.Message.length > 0) {
                userMessage = responseBody.messages.Message[0].Description || responseBody.messages.Message[0].ShortDescription || userMessage;
            } else if (responseBody.message) {
                userMessage = responseBody.message;
            }
            return { success: false, message: userMessage, data: responseBody.data, messages: responseBody.messages?.Message || [] };
        }

        return {
            success: true,
            data: responseBody.data,
            messages: responseBody.messages?.Message || [],
            message: "Éxito"
        };

    } catch (e) {
        return { success: false, message: "Error de conexión: " + e.message, data: null, messages: [] };
    }
}

function getAndIncrementCounter(sheet, counterName) {
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const counterIndex = headers.indexOf("Contador");
    const valueIndex = headers.indexOf("Valor");

    let counterRow = data.find(row => row[counterIndex] === counterName);
    let currentValue = 0;
    
    if (counterRow) {
        currentValue = parseInt(counterRow[valueIndex], 10) || 0;
    } else {
        sheet.appendRow([counterName, 0]);
    }
    return currentValue + 1;
}

function updateCounter(sheet, counterName, newValue) {
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const counterIndex = headers.indexOf("Contador");

    const rowIndex = data.findIndex(row => row[counterIndex] === counterName);
    if (rowIndex !== -1) {
        sheet.getRange(rowIndex + 2, headers.indexOf("Valor") + 1).setValue(newValue);
    }
}

function persistSuccessfulShipments(appSS, successfulShipments, user) {
    const headers = [
      'FechaHoraCreacion', 'UsuarioCreacion', 'Número de envío', 'Número de envío Manhattan', 
      'Tráiler', 'Sector de carga', 'FechaHoraEnvio', 'Duracion de carga',
      'Stop 0',
      'Parada 1', 'Stop 1', 'Parada 2', 'Stop 2', 'Parada 3', 'Stop 3',
      'Parada 4', 'Stop 4', 'Parada 5', 'Stop 5', 'Parada 6', 'Stop 6',
      'Parada 7', 'Stop 7', 'Parada 8', 'Stop 8', 'Parada 9', 'Stop 9',
      'Parada 10', 'Stop 10', 'Parada 11', 'Stop 11', 'Parada 12', 'Stop 12',
      'Parada 13', 'Stop 13', 'Parada 14', 'Stop 14', 'Parada 15', 'Stop 15',
      'Cita', 'FechaCitado'
    ];
    const sheet = getOrCreateSheet(appSS, MANHATTAN_SHIPMENTS_SHEET_NAME, headers);
    const now = new Date();

    const rowsToAdd = successfulShipments.map(s => {
        const original = s._originalData;
        return [
            now, user, original['Número de envío'], s.ShipmentId, original['Tráiler'], original['Sector de carga'],
            new Date(original.FechaHoraEnvio), original['Duracion de carga'], original['Stop 0'],
            original['Parada 1'] || "", original['Stop 1'] || "", original['Parada 2'] || "", original['Stop 2'] || "",
            original['Parada 3'] || "", original['Stop 3'] || "", original['Parada 4'] || "", original['Stop 4'] || "",
            original['Parada 5'] || "", original['Stop 5'] || "", original['Parada 6'] || "", original['Stop 6'] || "",
            original['Parada 7'] || "", original['Stop 7'] || "", original['Parada 8'] || "", original['Stop 8'] || "",
            original['Parada 9'] || "", original['Stop 9'] || "", original['Parada 10'] || "", original['Stop 10'] || "",
            original['Parada 11'] || "", original['Stop 11'] || "", original['Parada 12'] || "", original['Stop 12'] || "",
            original['Parada 13'] || "", original['Stop 13'] || "", original['Parada 14'] || "", original['Stop 14'] || "",
            original['Parada 15'] || "", original['Stop 15'] || "", 
            "", "" 
        ];
    });

    if (rowsToAdd.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, headers.length).setValues(rowsToAdd);
    }
}

function processAppointmentCreation(appSS, configSheet, shipmentsToProcess, user) {
    let appointmentIdCounter = getAndIncrementCounter(configSheet, 'AppointmentId');
    const createdAppointments = [];
    const failures = [];
    const groupedByNroEnvio = new Map();

    shipmentsToProcess.forEach(s => {
        const nroEnvio = s['Número de envío'];
        if (!groupedByNroEnvio.has(nroEnvio)) {
            groupedByNroEnvio.set(nroEnvio, []);
        }
        groupedByNroEnvio.get(nroEnvio).push(s);
    });

    for (const [nroEnvio, shipmentsInGroup] of groupedByNroEnvio.entries()) {
        const newAppointmentId = `EXPE_${String(appointmentIdCounter).padStart(8, '0')}`;
        const firstShipment = shipmentsInGroup[0];
        
        const originalAppointmentDate = new Date(firstShipment.FechaHoraEnvio);
        originalAppointmentDate.setHours(originalAppointmentDate.getHours());
        const adjustedAppointmentTimeISO = originalAppointmentDate.toISOString().replace(/\.\d+Z$/, '');

        const shipmentPayloads = shipmentsInGroup.map((shipment, index) => {
            const stops = [];
            stops.push({
                StopSequence: 1,
                StopActionId: { StopActionId: "PU", LocalizedTo: "en", Name: "Pickup" },
                WarehouseStatusId: { LocalizedTo: "en", WarehouseStatusId: "1100" },
                PlannedDepartureDateTime: adjustedAppointmentTimeISO,
                StopId: shipment['Stop 0'],
                LoadClosed: false,
                FacilityId: "100",
                TimeZone: "America/Montevideo",
                WarehouseStatusDescription: "Open",
                PlannedArrivalDateTime: adjustedAppointmentTimeISO
            });

            const paradas = [];
            for (let i = 1; i <= 15; i++) {
                if (shipment[`Parada ${i}`] && shipment[`Stop ${i}`]) {
                    paradas.push({ facilityId: shipment[`Parada ${i}`], stopId: shipment[`Stop ${i}`] });
                }
            }

            paradas.forEach((parada, stopIndex) => {
                stops.push({
                    StopSequence: stopIndex + 2,
                    StopActionId: { StopActionId: "DL", LocalizedTo: "en", Name: "Delivery" },
                    WarehouseStatusId: { LocalizedTo: "en", WarehouseStatusId: "1100" },
                    PlannedDepartureDateTime: adjustedAppointmentTimeISO,
                    StopId: parada.stopId,
                    LoadClosed: false,
                    FacilityId: String(parada.facilityId),
                    WarehouseStatusDescription: "Open",
                    PlannedArrivalDateTime: adjustedAppointmentTimeISO
                });
            });

            const pickupDeliveries = paradas.map((parada, stopIndex) => ({
                DeliveryStopId: parada.stopId,
                PickupStopSeq: 1,
                DeliveryStopSeq: stopIndex + 2,
                PickupStopId: shipment['Stop 0'],
                DeliveryFacility: String(parada.facilityId),
                PickupFacility: "100"
            }));
            
            return {
                ShipmentId: shipment['Número de envío Manhattan'],
                Stop: stops,
                OriginPlannedArrStartDttm: adjustedAppointmentTimeISO,
                WarehouseStatusId: "1100",
                OriginTimeZone: "America/Montevideo",
                ShipmentPlanningAttributes: { TotalNumberOfStops: stops.length, ShipmentWithoutOrder: false },
                TimeFeasibilityTurnedOff: false,
                TenderStatusDescription: "Not Tendered",
                IsParentShipment: false,
                OriginFacilityId: "100",
                DestinationFacilityId: paradas.length > 0 ? String(paradas[paradas.length - 1].facilityId) : "100",
                OriginWarehouseStatusDescription: "Open",
                PlanningStatusId: { PlanningStatusId: "0500" },
                OrgId: "1001",
                BroadcastStatusDescription: "Not Broadcasted",
                ShipmentPickupDelivery: pickupDeliveries,
                PlanningStatusDescription: "Planned",
                TransitStatusId: { TransitStatusId: "8100" },
                HazardousMaterial: false,
                TenderStatusId: { TenderStatusId: "2400" },
                LoadBuildingStatusId: "0100",
                TrailerNumber: shipment['Tráiler'],
                LoadBuildingStatusDescription: "Not Built",
                OriginPlannedArrEndDttm: adjustedAppointmentTimeISO,
                TransitStatusDescription: "Not Started",
                Priority: index + 1
            };
        });

        const appointmentApiBody = {
            ContentType: "SHIPMENTS",
            FacilityId: "100",
            SupplierPoAppointment: false,
            AppointmentScheduleTime: adjustedAppointmentTimeISO,
            ArrivalDateTime: adjustedAppointmentTimeISO,
            AppointmentStartDateTime: adjustedAppointmentTimeISO,
            PreferredDateTime: adjustedAppointmentTimeISO,
            Shipment: shipmentPayloads,
            Duration: firstShipment['Duracion de carga'],
            TrailerId: firstShipment['Tráiler'],
            ShipmentStop: shipmentsInGroup.map(s => ({
                ShipmentId: s['Número de envío Manhattan'],
                StopId: s['Stop 0'],
                RemoveAppointment: "false",
                StopSequence: 1,
                TenderStatusId: "2400",
                StopActionId: "PU",
                FacilityId: "100",
                OrgId: "1001"
            })),
            AppointmentContents: shipmentsInGroup.map(s => ({
                Shipment: s['Número de envío Manhattan'],
                StopSequence: 1,
                Stop: s['Stop 0']
            })),
            AppointmentId: newAppointmentId,
            AppointmentTypeId: "LIVE_LOAD",
            Resources: [{ GroupName: "CITAS_EXPEDICION", ResourceName: "CITAS_EXPEDICION" }]
        };

        const apiResponse = callManhattanApi('/appointment/api/appointment/scheduleAppointment', appointmentApiBody);

        if (apiResponse.success) {
            const successfulAppointmentData = {
                AppointmentId: newAppointmentId,
                AppointmentScheduleTime: firstShipment.FechaHoraEnvio,
                Duration: firstShipment['Duracion de carga'],
                _originalShipments: shipmentsInGroup.map(s => ({ ShipmentId: s['Número de envío Manhattan'], _originalData: s }))
            };
            createdAppointments.push(successfulAppointmentData);
        } else {
            failures.push({
                appointmentId: newAppointmentId,
                message: apiResponse.message,
                record: shipmentsInGroup
            });
        }
        appointmentIdCounter++;
    }

    if (createdAppointments.length > 0) {
        persistSuccessfulAppointments(appSS, createdAppointments, user);
        updateCounter(configSheet, 'AppointmentId', appointmentIdCounter - 1);
    }

    return { createdAppointments, failures, successCount: createdAppointments.length };
}

function persistSuccessfulAppointments(appSS, createdAppointments, user) {
    const citasSheetHeaders = ["Cita", "FechaHoraCita", "Envio", "Duracion", "UsuarioCreacion", "FechaHoraCreacion"];
    const citasSheet = getOrCreateSheet(appSS, APPOINTMENTS_SHEET_NAME, citasSheetHeaders);
    const shipmentsSheet = getOrCreateSheet(appSS, MANHATTAN_SHIPMENTS_SHEET_NAME);
    const shipmentsData = sheetDataToObjects(shipmentsSheet);

    const headers = shipmentsSheet.getRange(1, 1, 1, shipmentsSheet.getLastColumn()).getValues()[0];
    const citaCol = headers.indexOf("Cita") + 1;
    const fechaCitadoCol = headers.indexOf("FechaCitado") + 1;

    if (citaCol === 0 || fechaCitadoCol === 0) throw new Error("No se encontraron las columnas 'Cita' o 'FechaCitado' en la hoja de envíos.");

    const newAppointmentsRows = [];
    const now = new Date();

    createdAppointments.forEach(app => {
        const firstShipmentOriginalData = app._originalShipments[0]._originalData;
        newAppointmentsRows.push([
            app.AppointmentId, new Date(app.AppointmentScheduleTime), firstShipmentOriginalData['Número de envío'], 
            app.Duration, user, now
        ]);

        app._originalShipments.forEach(shipmentInApp => {
            const shipmentRow = shipmentsData.find(row => row['Número de envío Manhattan'] === shipmentInApp.ShipmentId);
            if (shipmentRow && shipmentRow._rowIndex) {
                shipmentsSheet.getRange(shipmentRow._rowIndex, citaCol).setValue(app.AppointmentId);
                shipmentsSheet.getRange(shipmentRow._rowIndex, fechaCitadoCol).setValue(new Date(app.AppointmentScheduleTime));
            }
        });
    });

    if (newAppointmentsRows.length > 0) {
        citasSheet.getRange(citasSheet.getLastRow() + 1, 1, newAppointmentsRows.length, citasSheetHeaders.length).setValues(newAppointmentsRows);
    }
}

// --- Auditoría de Ubicaciones ---

function searchManhattanLocation(payload) {
  const { token, barcode } = payload;
  const url = `${getConfig('MANHATTAN_HOST')}/dcinventory/api/dcinventory/location/search`;
  const apiPayload = {
    "Size": 100,
    "Query": `LocationBarcode = '${barcode}'`,
    "Template": { "LocationId": "" }
  };
  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'selectedBusinessUnit': '1002',
      'selectedOrganization': '1001',
      'selectedLocation': '100'
    },
    'payload': JSON.stringify(apiPayload),
    'muteHttpExceptions': true
  };
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  if (responseCode === 200) return JSON.parse(responseBody);
  throw new Error(`Error al buscar ubicación en Manhattan: ${responseCode} - ${responseBody}`);
}

function searchManhattanIlpnsInLocation(payload) {
  const { token, locationId } = payload;
  const url = `${getConfig('MANHATTAN_HOST')}/dcinventory/api/dcinventory/ilpn/search`;
  const apiPayload = {
    "Size": 500,
    "Query": `CurrentLocationId in ('${locationId}')`,
    "Template": { "IlpnId": "" }
  };
  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'selectedBusinessUnit': '1002',
      'selectedOrganization': '1001',
      'selectedLocation': '100'
    },
    'payload': JSON.stringify(apiPayload),
    'muteHttpExceptions': true
  };
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  if (responseCode === 200) return JSON.parse(responseBody);
  throw new Error(`Error al buscar ILPNs en Manhattan: ${responseCode} - ${responseBody}`);
}

function searchManhattanOlpnsInLocation(payload) {
  const { token, locationId } = payload;
  const url = `${getConfig('MANHATTAN_HOST')}/pickpack/api/pickpack/olpn/search`;
  const apiPayload = {
    "Size": 500,
    "Query": `CurrentLocationId in ('${locationId}') and PalletId = null and Status < 9000`,
    "Template": { "OlpnId": "" }
  };
  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'selectedBusinessUnit': '1002',
      'selectedOrganization': '1001',
      'selectedLocation': '100'
    },
    'payload': JSON.stringify(apiPayload),
    'muteHttpExceptions': true
  };
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  if (responseCode === 200) return JSON.parse(responseBody);
  throw new Error(`Error al buscar OLPNs en Manhattan: ${responseCode} - ${responseBody}`);
}

function getLocationAuditRecords(filters) {
  const sheet = getAppSpreadsheet().getSheetByName(LOCATION_AUDIT_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  
  const records = sheetDataToObjects(sheet);
  
  return records.filter(record => {
    if (filters.startDate) {
      const parts = filters.startDate.split('-');
      const start = new Date(parts[0], parts[1] - 1, parts[2]);
      start.setHours(0, 0, 0, 0);
      if (new Date(record.FechaHoraAuditoria) < start) return false;
    }
    if (filters.endDate) {
      const parts = filters.endDate.split('-');
      const end = new Date(parts[0], parts[1] - 1, parts[2]);
      end.setHours(23, 59, 59, 999);
      if (new Date(record.FechaHoraAuditoria) > end) return false;
    }
    if (filters.location && !String(record.UbicacionAuditada || '').toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.user && !String(record.Usuario || '').toLowerCase().includes(filters.user.toLowerCase())) return false;
    if (filters.local && !String(record.Local || '').toLowerCase().includes(filters.local.toLowerCase())) return false;
    
    return true;
  });
}

function saveLocationAuditRecords(payload) {
  const { records } = payload;
  const ss = getAppSpreadsheet();
  const headers = [
    "IdInternoAuditoria", "FechaHoraAuditoria", "Usuario", "EstadoAuditoria", 
    "UbicacionAuditada", "ContenedorManhattan", "TipoContenedorManhattan", 
    "ContenedorAuditado", "TipoContenedorAuditado", "Local", "TipoDiferencia"
  ];
  const sheet = getOrCreateSheet(ss, LOCATION_AUDIT_SHEET_NAME, headers);
  
  const rows = records.map(record => {
    return headers.map(header => record[header] || '');
  });
  
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }
}

function findErrorMessageForShipment(shipmentId, messages) {
    if (!messages || messages.length === 0) return "Error desconocido en Manhattan.";
    const error = messages.find(m => m.Description && m.Description.includes(shipmentId));
    return error ? error.Description : "No se encontró un mensaje de error específico.";
}