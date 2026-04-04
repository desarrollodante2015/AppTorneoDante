// ============================================================
// CÓDIGO PARA GOOGLE APPS SCRIPT
// Torneo de Dante — Conexión con Google Sheets
//
// INSTRUCCIONES:
// 1. Abrí tu Google Sheet
// 2. Andá a Extensiones > Apps Script
// 3. Borrá todo lo que haya y pegá ESTE código
// 4. Guardá (Ctrl+S)
// 5. Desplegá como Web App (ver guía)
// ============================================================

/**
 * Maneja las peticiones GET (cuando la app PIDE datos)
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

  if (action === 'leer') {
    return leerTodo();
  }

  return responder({ error: 'Acción no reconocida. Usá ?action=leer' });
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
 * Arma una respuesta JSON para mandar de vuelta a la app
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

// -------------------- LEER datos --------------------

/**
 * Lee TODOS los equipos y partidos de las hojas y los devuelve como JSON
 */
function leerTodo() {
  var hojaEquipos = obtenerOCrearHoja('Equipos', ['id', 'nombre']);
  var hojaPartidos = obtenerOCrearHoja('Partidos', [
    'id', 'fase', 'ronda', 'fecha', 'localId', 'visitanteId', 'golesLocal', 'golesVisitante'
  ]);

  // --- Leer equipos ---
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

  // --- Leer partidos ---
  var partidos = [];
  if (hojaPartidos.getLastRow() > 1) {
    var datosPartidos = hojaPartidos.getRange(2, 1, hojaPartidos.getLastRow() - 1, 8).getValues();
    for (var j = 0; j < datosPartidos.length; j++) {
      var f = datosPartidos[j];
      if (f[0] !== '' && f[0] !== null) {
        // La fecha puede venir como objeto Date desde Google Sheets
        var fecha = f[3];
        if (fecha instanceof Date) {
          fecha = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          fecha = String(fecha);
        }

        partidos.push({
          id: Number(f[0]),
          fase: String(f[1]),
          ronda: (f[2] === '' || f[2] === null) ? null : String(f[2]),
          fecha: fecha,
          localId: Number(f[4]),
          visitanteId: Number(f[5]),
          golesLocal: (f[6] === '' || f[6] === null) ? null : Number(f[6]),
          golesVisitante: (f[7] === '' || f[7] === null) ? null : Number(f[7])
        });
      }
    }
  }

  return responder({ equipos: equipos, partidos: partidos });
}

// -------------------- GUARDAR datos --------------------

/**
 * Recibe equipos y partidos desde la app y los escribe en las hojas
 */
function guardarTodo(data) {
  var hojaEquipos = obtenerOCrearHoja('Equipos', ['id', 'nombre']);
  var hojaPartidos = obtenerOCrearHoja('Partidos', [
    'id', 'fase', 'ronda', 'fecha', 'localId', 'visitanteId', 'golesLocal', 'golesVisitante'
  ]);

  // --- Limpiar datos viejos (sin borrar encabezados) ---
  if (hojaEquipos.getLastRow() > 1) {
    hojaEquipos.getRange(2, 1, hojaEquipos.getLastRow() - 1, hojaEquipos.getLastColumn()).clearContent();
  }
  if (hojaPartidos.getLastRow() > 1) {
    hojaPartidos.getRange(2, 1, hojaPartidos.getLastRow() - 1, hojaPartidos.getLastColumn()).clearContent();
  }

  // --- Escribir equipos ---
  var equipos = data.equipos || [];
  if (equipos.length > 0) {
    var filasEquipos = [];
    for (var i = 0; i < equipos.length; i++) {
      filasEquipos.push([equipos[i].id, equipos[i].nombre]);
    }
    hojaEquipos.getRange(2, 1, filasEquipos.length, 2).setValues(filasEquipos);
  }

  // --- Escribir partidos ---
  var partidos = data.partidos || [];
  if (partidos.length > 0) {
    var filasPartidos = [];
    for (var k = 0; k < partidos.length; k++) {
      var p = partidos[k];
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

  return responder({ ok: true, mensaje: 'Datos guardados correctamente' });
}
