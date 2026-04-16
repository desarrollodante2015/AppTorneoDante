// ============================================================
// CÓDIGO PARA GOOGLE APPS SCRIPT
// Torneo de Dante — Backend completo con Google Sheets
//
// INSTRUCCIONES:
// 1. Abrí tu Google Sheet (https://docs.google.com/spreadsheets/d/1HWbL4h-WwA3_vve98gi9NNeJTyLDQEUKVHeaWSh4WNA)
// 2. Andá a Extensiones > Apps Script
// 3. Borrá todo lo que haya y pegá ESTE código
// 4. Guardá (Ctrl+S)
// 5. Hacé clic en "Implementar" > "Nueva implementación"
// 6. Tipo: "Aplicación web"
// 7. Ejecutar como: "Yo" (tu cuenta)
// 8. Acceso: "Cualquier persona"
// 9. Hacé clic en "Implementar"
// 10. Copiá la URL que te da y pegala en la app
//
// HOJAS QUE SE CREAN AUTOMÁTICAMENTE:
// - Config: configuración del torneo (1 fila)
// - Equipos: lista de equipos
// - Partidos: fixture completo con resultados
// - Jugadores: jugadores de cada equipo
// ============================================================

/**
 * Maneja las peticiones GET (cuando la app PIDE datos)
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

  if (action === 'leer') {
    return leerTodo();
  }

  if (action === 'ping') {
    return responder({ ok: true, mensaje: 'Conexión OK', timestamp: new Date().toISOString() });
  }

  return responder({ error: 'Acción no reconocida. Usá ?action=leer o ?action=ping' });
}

/**
 * Maneja las peticiones POST (cuando la app ENVÍA datos para guardar)
 */
function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder({ error: 'No se pudo leer el JSON enviado.' });
  }

  var action = data.action || '';

  if (action === 'guardar') {
    return guardarTodo(data);
  }

  return responder({ error: 'Acción no reconocida. Enviá action: "guardar".' });
}

// -------------------- Funciones auxiliares --------------------

/**
 * Arma una respuesta JSON con headers CORS para que la app pueda leer
 */
function responder(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Busca una hoja por nombre. Si no existe, la crea con los encabezados.
 */
function obtenerOCrearHoja(nombre, encabezados) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(nombre);

  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    // Ponemos lindo el encabezado
    hoja.getRange(1, 1, 1, encabezados.length)
      .setFontWeight('bold')
      .setBackground('#7c5cff')
      .setFontColor('#ffffff');
    hoja.setFrozenRows(1);
  }

  return hoja;
}

// -------------------- DEFINICIÓN DE HOJAS --------------------

var HOJAS = {
  config: {
    nombre: 'Config',
    encabezados: ['nombre', 'formato', 'titulares', 'suplentes', 'modalidad', 'clasificados', 'fechaInicio', 'diasEntreFechas']
  },
  equipos: {
    nombre: 'Equipos',
    encabezados: ['id', 'nombre']
  },
  partidos: {
    nombre: 'Partidos',
    encabezados: ['id', 'fase', 'ronda', 'fecha', 'localId', 'visitanteId', 'golesLocal', 'golesVisitante']
  },
  jugadores: {
    nombre: 'Jugadores',
    encabezados: ['id', 'nombre', 'equipoId', 'tipo']
  }
};

// -------------------- LEER datos --------------------

/**
 * Lee TODOS los datos de las 4 hojas y los devuelve como JSON
 */
function leerTodo() {
  // --- Config ---
  var hojaConfig = obtenerOCrearHoja(HOJAS.config.nombre, HOJAS.config.encabezados);
  var config = null;
  if (hojaConfig.getLastRow() > 1) {
    var datosConfig = hojaConfig.getRange(2, 1, 1, HOJAS.config.encabezados.length).getValues();
    var fc = datosConfig[0];
    if (fc[0] !== '' && fc[0] !== null) {
      config = {
        nombre: String(fc[0]),
        formato: String(fc[1]),
        titulares: Number(fc[2]) || 11,
        suplentes: Number(fc[3]) || 5,
        modalidad: String(fc[4]) || 'soloida',
        clasificados: Number(fc[5]) || 4,
        fechaInicio: formatearFecha(fc[6]),
        diasEntreFechas: Number(fc[7]) || 7
      };
    }
  }

  // --- Equipos ---
  var hojaEquipos = obtenerOCrearHoja(HOJAS.equipos.nombre, HOJAS.equipos.encabezados);
  var equipos = [];
  if (hojaEquipos.getLastRow() > 1) {
    var datosEquipos = hojaEquipos.getRange(2, 1, hojaEquipos.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < datosEquipos.length; i++) {
      var fila = datosEquipos[i];
      if (fila[0] !== '' && fila[0] !== null) {
        equipos.push({ id: Number(fila[0]), nombre: String(fila[1]) });
      }
    }
  }

  // --- Partidos ---
  var hojaPartidos = obtenerOCrearHoja(HOJAS.partidos.nombre, HOJAS.partidos.encabezados);
  var partidos = [];
  if (hojaPartidos.getLastRow() > 1) {
    var datosPartidos = hojaPartidos.getRange(2, 1, hojaPartidos.getLastRow() - 1, 8).getValues();
    for (var j = 0; j < datosPartidos.length; j++) {
      var f = datosPartidos[j];
      if (f[0] !== '' && f[0] !== null) {
        partidos.push({
          id: Number(f[0]),
          fase: String(f[1]),
          ronda: (f[2] === '' || f[2] === null) ? null : String(f[2]),
          fecha: formatearFecha(f[3]),
          localId: Number(f[4]),
          visitanteId: Number(f[5]),
          golesLocal: (f[6] === '' || f[6] === null) ? null : Number(f[6]),
          golesVisitante: (f[7] === '' || f[7] === null) ? null : Number(f[7])
        });
      }
    }
  }

  // --- Jugadores ---
  var hojaJugadores = obtenerOCrearHoja(HOJAS.jugadores.nombre, HOJAS.jugadores.encabezados);
  var jugadores = [];
  if (hojaJugadores.getLastRow() > 1) {
    var datosJugadores = hojaJugadores.getRange(2, 1, hojaJugadores.getLastRow() - 1, 4).getValues();
    for (var k = 0; k < datosJugadores.length; k++) {
      var fj = datosJugadores[k];
      if (fj[0] !== '' && fj[0] !== null) {
        jugadores.push({
          id: Number(fj[0]),
          nombre: String(fj[1]),
          equipoId: Number(fj[2]),
          tipo: String(fj[3]) || 'titular'
        });
      }
    }
  }

  return responder({
    config: config,
    equipos: equipos,
    partidos: partidos,
    jugadores: jugadores
  });
}

/**
 * Formatea fechas que pueden venir como Date de Google Sheets
 */
function formatearFecha(valor) {
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(valor || '');
}

// -------------------- GUARDAR datos --------------------

/**
 * Recibe TODOS los datos desde la app y los escribe en las 4 hojas
 */
function guardarTodo(data) {
  // --- Config ---
  var hojaConfig = obtenerOCrearHoja(HOJAS.config.nombre, HOJAS.config.encabezados);
  // Limpiar config vieja
  if (hojaConfig.getLastRow() > 1) {
    hojaConfig.getRange(2, 1, hojaConfig.getLastRow() - 1, hojaConfig.getLastColumn()).clearContent();
  }
  var config = data.config;
  if (config && config.nombre) {
    hojaConfig.getRange(2, 1, 1, 8).setValues([[
      config.nombre || '',
      config.formato || 'Liga',
      config.titulares || 11,
      config.suplentes || 5,
      config.modalidad || 'soloida',
      config.clasificados || 4,
      config.fechaInicio || '',
      config.diasEntreFechas || 7
    ]]);
  }

  // --- Equipos ---
  var hojaEquipos = obtenerOCrearHoja(HOJAS.equipos.nombre, HOJAS.equipos.encabezados);
  limpiarDatos(hojaEquipos);
  var equipos = data.equipos || [];
  if (equipos.length > 0) {
    var filasEquipos = [];
    for (var i = 0; i < equipos.length; i++) {
      filasEquipos.push([equipos[i].id, equipos[i].nombre]);
    }
    hojaEquipos.getRange(2, 1, filasEquipos.length, 2).setValues(filasEquipos);
  }

  // --- Partidos ---
  var hojaPartidos = obtenerOCrearHoja(HOJAS.partidos.nombre, HOJAS.partidos.encabezados);
  limpiarDatos(hojaPartidos);
  var partidos = data.partidos || [];
  if (partidos.length > 0) {
    var filasPartidos = [];
    for (var j = 0; j < partidos.length; j++) {
      var p = partidos[j];
      filasPartidos.push([
        p.id,
        p.fase || 'Liga',
        p.ronda || '',
        p.fecha,
        p.localId,
        p.visitanteId,
        (p.golesLocal === null || p.golesLocal === undefined) ? '' : p.golesLocal,
        (p.golesVisitante === null || p.golesVisitante === undefined) ? '' : p.golesVisitante
      ]);
    }
    hojaPartidos.getRange(2, 1, filasPartidos.length, 8).setValues(filasPartidos);
  }

  // --- Jugadores ---
  var hojaJugadores = obtenerOCrearHoja(HOJAS.jugadores.nombre, HOJAS.jugadores.encabezados);
  limpiarDatos(hojaJugadores);
  var jugadores = data.jugadores || [];
  if (jugadores.length > 0) {
    var filasJugadores = [];
    for (var k = 0; k < jugadores.length; k++) {
      var jug = jugadores[k];
      filasJugadores.push([
        jug.id,
        jug.nombre,
        jug.equipoId,
        jug.tipo || 'titular'
      ]);
    }
    hojaJugadores.getRange(2, 1, filasJugadores.length, 4).setValues(filasJugadores);
  }

  return responder({
    ok: true,
    mensaje: 'Datos guardados correctamente',
    timestamp: new Date().toISOString()
  });
}

/**
 * Limpia datos de una hoja sin borrar encabezados
 */
function limpiarDatos(hoja) {
  if (hoja.getLastRow() > 1) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, hoja.getLastColumn()).clearContent();
  }
}
