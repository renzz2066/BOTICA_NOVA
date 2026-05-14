const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const SESSION_COOKIE = "botica_sesion";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

app.use(express.json());

function normalizarRol(rol) {
  const rolNormalizado = String(rol || "").trim().toUpperCase();

  if (rolNormalizado === "ADMINISTRADOR") {
    return "ADMIN";
  }

  if (rolNormalizado === "VENTAS") {
    return "CAJERO";
  }

  return rolNormalizado || "CAJERO";
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [nombre, ...valorPartes] = cookie.trim().split("=");

    if (!nombre) {
      return cookies;
    }

    cookies[nombre] = decodeURIComponent(valorPartes.join("="));
    return cookies;
  }, {});
}

function crearCookieSesion(token) {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function limpiarCookieSesion() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function obtenerTokenSesion(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE];
}

function cargarSesion(req, res, next) {
  const token = obtenerTokenSesion(req);
  const sesion = token ? sessions.get(token) : null;

  if (!sesion) {
    req.usuario = null;
    return next();
  }

  if (sesion.expiraEn < Date.now()) {
    sessions.delete(token);
    res.setHeader("Set-Cookie", limpiarCookieSesion());
    req.usuario = null;
    return next();
  }

  sesion.expiraEn = Date.now() + SESSION_DURATION_MS;
  req.usuario = sesion.usuario;
  next();
}

function crearSesion(usuario) {
  const token = crypto.randomBytes(32).toString("hex");

  sessions.set(token, {
    usuario,
    expiraEn: Date.now() + SESSION_DURATION_MS,
  });

  return token;
}

function requireAuth(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ error: "Debe iniciar sesion" });
  }

  next();
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Debe iniciar sesion" });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tiene permisos para esta accion" });
    }

    next();
  };
}

function requirePageRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.redirect("/login.html");
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.redirect("/dashboard.html?sinPermiso=1");
    }

    next();
  };
}

function requireApiRole(req, res, next) {
  const ruta = req.path;

  if (
    ruta.startsWith("/ventas") ||
    ruta.startsWith("/lotes-disponibles") ||
    ruta.startsWith("/tipos-pago") ||
    ruta.startsWith("/alertas")
  ) {
    return requireRole("ADMIN", "CAJERO")(req, res, next);
  }

  return requireRole("ADMIN")(req, res, next);
}

async function crearPasswordHash(password) {
  return bcrypt.hash(password, 10);
}

async function verificarPassword(password, passwordHash) {
  if (!password || !passwordHash) {
    return false;
  }

  if (passwordHash.startsWith("$2a$") || passwordHash.startsWith("$2b$") || passwordHash.startsWith("$2y$")) {
    return bcrypt.compare(password, passwordHash);
  }

  return password === passwordHash;
}

async function asegurarUsuarioInicial(username, password, rol, nombres, apellidos, numeroDocumento, telefono, correo) {
  const [usuarios] = await pool.query(
    `
    SELECT IdUsuario
    FROM US_Usuario
    WHERE Username = ?
    LIMIT 1
    `,
    [username]
  );

  if (usuarios.length > 0) {
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [personas] = await connection.query(
      `
      SELECT IdPersona
      FROM PE_Persona
      WHERE NumeroDocumento = ?
      LIMIT 1
      `,
      [numeroDocumento]
    );

    let idPersona;

    if (personas.length > 0) {
      idPersona = personas[0].IdPersona;
    } else {
      const [persona] = await connection.query(
        `
        INSERT INTO PE_Persona
        (Nombres, Apellidos, TipoDocumento, NumeroDocumento, Telefono, Correo, Direccion)
        VALUES (?, ?, 'DNI', ?, ?, ?, '')
        `,
        [nombres, apellidos, numeroDocumento, normalizarTelefono(telefono, true), normalizarCorreo(correo, true)]
      );

      idPersona = persona.insertId;
    }

    const passwordHash = await crearPasswordHash(password);

    await connection.query(
      `
      INSERT INTO US_Usuario
      (IdPersona, Username, PasswordHash, Rol)
      VALUES (?, ?, ?, ?)
      `,
      [idPersona, username, passwordHash, rol]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function asegurarUsuariosIniciales() {
  await asegurarUsuarioInicial("admin", "123456", "ADMIN", "Administrador", "Sistema", "11111111", "987654321", "admin@boticanova.com");
  await asegurarUsuarioInicial("cajero", "123456", "CAJERO", "Cajero", "Ventas", "22222222", "912345678", "cajero@boticanova.com");
}

const NOMBRES_TIPO_MOVIMIENTO = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
  DCL: "Devolucion Cliente",
  DPR: "Devolucion Proveedor",
  VNC: "Producto Vencido",
};

const NOMBRES_TIPO_DOCUMENTO = {
  DNI: "DNI",
  RUC: "RUC",
  BOL: "Boleta",
  FAC: "Factura",
  LOTE: "Registro de lote",
  VENTA: "Venta",
  AJUSTE: "Ajuste de stock",
};

const NOMBRES_ESTADO_VENTA = {
  PEN: "Pendiente",
  PAG: "Pagado",
  ANU: "Anulado",
};

const SERIES_COMPROBANTE = {
  BOLETA: "B001",
  FACTURA: "F001",
  TICKET: "T001",
};

const TIPOS_COMPROBANTE = {
  BOLETA: "Boleta",
  FACTURA: "Factura",
  TICKET: "Ticket",
};

const PREFIJO_SERIE_COMPROBANTE = {
  Boleta: "B",
  Factura: "F",
  Ticket: "T",
};

const TIPOS_DOCUMENTO_PERSONA = new Set(["DNI", "RUC", "CE"]);
const TIPOS_MOVIMIENTO_VALIDOS = new Set(Object.keys(NOMBRES_TIPO_MOVIMIENTO));
const TIPOS_DOCUMENTO_KARDEX_VALIDOS = new Set(Object.keys(NOMBRES_TIPO_DOCUMENTO));
const TIPOS_PAGO_CON_REFERENCIA = new Set(["TDB", "TCR", "YAP", "PLI"]);

function normalizarCodigoDocumento(texto) {
  return String(texto || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function crearErrorValidacion(mensaje) {
  const error = new Error(mensaje);
  error.statusCode = 400;
  return error;
}

function limpiarTexto(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

function soloDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function redondearMoneda(valor) {
  return Number(Number(valor || 0).toFixed(2));
}

function normalizarTelefono(telefono, obligatorio = false) {
  const telefonoLimpio = soloDigitos(telefono);

  if (!telefonoLimpio) {
    if (obligatorio) {
      throw crearErrorValidacion("El telefono es obligatorio");
    }

    return null;
  }

  if (!/^9\d{8}$/.test(telefonoLimpio)) {
    throw crearErrorValidacion("El telefono debe empezar con 9 y tener 9 digitos");
  }

  return telefonoLimpio;
}

function normalizarCorreo(correo, obligatorio = false) {
  const correoLimpio = limpiarTexto(correo).toLowerCase();

  if (!correoLimpio) {
    if (obligatorio) {
      throw crearErrorValidacion("El correo es obligatorio");
    }

    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
    throw crearErrorValidacion("El correo debe contener @ y un punto despues del dominio");
  }

  return correoLimpio;
}

function normalizarDocumentoPersona(tipoDocumento, numeroDocumento, obligatorio = false) {
  const tipo = normalizarCodigoDocumento(tipoDocumento || (numeroDocumento ? "DNI" : ""));
  const numero = tipo === "CE" ? limpiarTexto(numeroDocumento).toUpperCase() : soloDigitos(numeroDocumento);

  if (!tipo && !numero) {
    if (obligatorio) {
      throw crearErrorValidacion("El documento de identidad es obligatorio");
    }

    return { tipoDocumento: null, numeroDocumento: null };
  }

  if (!TIPOS_DOCUMENTO_PERSONA.has(tipo)) {
    throw crearErrorValidacion("Tipo de documento no valido");
  }

  if (!numero) {
    throw crearErrorValidacion("El numero de documento es obligatorio");
  }

  if (tipo === "DNI" && !/^\d{8}$/.test(numero)) {
    throw crearErrorValidacion("El DNI debe tener 8 digitos");
  }

  if (tipo === "RUC" && !/^\d{11}$/.test(numero)) {
    throw crearErrorValidacion("El RUC debe tener 11 digitos");
  }

  if (tipo === "CE" && !/^[A-Z0-9]{6,12}$/.test(numero)) {
    throw crearErrorValidacion("El carnet de extranjeria debe tener entre 6 y 12 caracteres");
  }

  return { tipoDocumento: tipo, numeroDocumento: numero };
}

function normalizarRuc(ruc) {
  const rucLimpio = soloDigitos(ruc);

  if (!/^\d{11}$/.test(rucLimpio)) {
    throw crearErrorValidacion("El RUC debe tener 11 digitos");
  }

  return rucLimpio;
}

function normalizarProveedorPayload(datos, requiereIdPersona = false) {
  const idPersona = datos.idPersona ? parseInt(datos.idPersona) : null;

  if (requiereIdPersona && (!idPersona || Number.isNaN(idPersona))) {
    throw crearErrorValidacion("IdPersona es obligatorio");
  }

  const nombres = limpiarTexto(datos.nombres);
  const apellidos = limpiarTexto(datos.apellidos);
  const razonSocial = limpiarTexto(datos.razonSocial);

  if (!nombres || !apellidos || !razonSocial) {
    throw crearErrorValidacion("Nombres, apellidos y razon social son obligatorios");
  }

  const documento = normalizarDocumentoPersona(datos.tipoDocumento || "DNI", datos.numeroDocumento, true);

  return {
    idPersona,
    nombres,
    apellidos,
    tipoDocumento: documento.tipoDocumento,
    numeroDocumento: documento.numeroDocumento,
    telefono: normalizarTelefono(datos.telefono, true),
    correo: normalizarCorreo(datos.correo, true),
    direccion: limpiarTexto(datos.direccion) || null,
    razonSocial,
    ruc: normalizarRuc(datos.ruc),
  };
}

function normalizarTipoComprobante(tipoComprobante) {
  const codigo = normalizarCodigoDocumento(tipoComprobante || "Boleta");
  const tipo = TIPOS_COMPROBANTE[codigo];

  if (!tipo) {
    throw crearErrorValidacion("Tipo de comprobante no valido");
  }

  return tipo;
}

function obtenerSeriePorDefecto(tipoComprobante) {
  return SERIES_COMPROBANTE[normalizarCodigoDocumento(tipoComprobante)] || "B001";
}

function normalizarSerieComprobante(tipoComprobante, serie) {
  const tipo = normalizarTipoComprobante(tipoComprobante);
  const serieNormalizada = limpiarTexto(serie || obtenerSeriePorDefecto(tipo)).toUpperCase();
  const prefijoEsperado = PREFIJO_SERIE_COMPROBANTE[tipo];

  if (!new RegExp(`^${prefijoEsperado}[0-9]{3}$`).test(serieNormalizada)) {
    throw crearErrorValidacion(`La serie para ${tipo} debe tener el formato ${prefijoEsperado}001`);
  }

  return serieNormalizada;
}

function normalizarNumeroComprobanteManual(numeroComprobante) {
  const numero = soloDigitos(numeroComprobante);

  if (!numero) {
    return null;
  }

  if (numero.length > 10) {
    throw crearErrorValidacion("El numero de comprobante no puede superar 10 digitos");
  }

  return numero.padStart(6, "0");
}

function normalizarFechaISO(fecha) {
  const texto = limpiarTexto(fecha);
  return texto || null;
}

function validarFechasLote(fechaIngreso, fechaVencimiento) {
  const ingreso = normalizarFechaISO(fechaIngreso);
  const vencimiento = normalizarFechaISO(fechaVencimiento);

  if (!vencimiento) {
    return { fechaIngreso: ingreso, fechaVencimiento: null };
  }

  const fechaVencimientoDate = new Date(`${vencimiento}T00:00:00`);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (Number.isNaN(fechaVencimientoDate.getTime())) {
    throw crearErrorValidacion("La fecha de vencimiento no es valida");
  }

  if (fechaVencimientoDate < hoy) {
    throw crearErrorValidacion("No se puede registrar un lote vencido");
  }

  if (ingreso) {
    const fechaIngresoDate = new Date(`${ingreso}T00:00:00`);

    if (Number.isNaN(fechaIngresoDate.getTime())) {
      throw crearErrorValidacion("La fecha de ingreso no es valida");
    }

    if (fechaVencimientoDate <= fechaIngresoDate) {
      throw crearErrorValidacion("La fecha de vencimiento debe ser posterior a la fecha de ingreso");
    }
  }

  return { fechaIngreso: ingreso, fechaVencimiento: vencimiento };
}

function normalizarClienteVentaPayload(cliente = {}, tipoComprobante = "Boleta") {
  const tipo = normalizarTipoComprobante(tipoComprobante);
  const numero = soloDigitos(cliente.numeroDocumento || cliente.dni);
  const nombre = limpiarTexto(cliente.nombre || cliente.nombreCliente);

  if (!numero && !nombre) {
    if (tipo === "Factura") {
      throw crearErrorValidacion("La factura requiere RUC del cliente");
    }

    return {
      tipoDocumento: null,
      numeroDocumento: null,
      nombre: null,
    };
  }

  if (!numero) {
    if (tipo === "Factura") {
      throw crearErrorValidacion("La factura requiere RUC del cliente");
    }

    return {
      tipoDocumento: null,
      numeroDocumento: null,
      nombre,
    };
  }

  let tipoDocumento = normalizarCodigoDocumento(cliente.tipoDocumento || (numero.length === 11 ? "RUC" : "DNI"));

  if (tipo === "Factura") {
    tipoDocumento = "RUC";
  }

  const documento = normalizarDocumentoPersona(tipoDocumento, numero, Boolean(numero));

  if (tipo === "Factura" && documento.tipoDocumento !== "RUC") {
    throw crearErrorValidacion("La factura requiere un RUC de 11 digitos");
  }

  if ((tipo === "Boleta" || tipo === "Ticket") && documento.tipoDocumento === "RUC") {
    throw crearErrorValidacion("Use Factura cuando el cliente se identifique con RUC");
  }

  return {
    tipoDocumento: documento.tipoDocumento,
    numeroDocumento: documento.numeroDocumento,
    nombre: nombre || null,
  };
}

function formatearNumeroComprobante(numero) {
  return String(numero).padStart(6, "0");
}

function construirDocumentoVenta(tipoComprobante, serie, numeroComprobante) {
  return `${tipoComprobante} ${serie}-${numeroComprobante}`;
}

async function generarNumeroComprobanteVenta(connection, tipoComprobante, serie) {
  const [rows] = await connection.query(
    `
    SELECT MAX(CAST(NumeroComprobante AS UNSIGNED)) AS UltimoNumero
    FROM VE_Venta
    WHERE TipoComprobante = ?
      AND Serie = ?
      AND NumeroComprobante REGEXP '^[0-9]+$'
    `,
    [tipoComprobante, serie]
  );

  return formatearNumeroComprobante(Number(rows[0]?.UltimoNumero || 0) + 1);
}

async function obtenerTipoMovimientoId(connection, codigo) {
  const [rows] = await connection.query(
    `
    SELECT IdTipoMovimiento
    FROM TM_TipoMovimiento
    WHERE Codigo = ?
    LIMIT 1
    `,
    [codigo]
  );

  if (rows.length > 0) {
    return rows[0].IdTipoMovimiento;
  }

  const [result] = await connection.query(
    `
    INSERT INTO TM_TipoMovimiento (Codigo, Nombre)
    VALUES (?, ?)
    `,
    [codigo, NOMBRES_TIPO_MOVIMIENTO[codigo] || codigo]
  );

  return result.insertId;
}

async function obtenerTipoDocumentoId(connection, codigo) {
  const [rows] = await connection.query(
    `
    SELECT IdTipoDocumento
    FROM TD_TipoDocumento
    WHERE Codigo = ?
    LIMIT 1
    `,
    [codigo]
  );

  if (rows.length > 0) {
    return rows[0].IdTipoDocumento;
  }

  const [result] = await connection.query(
    `
    INSERT INTO TD_TipoDocumento (Codigo, Nombre)
    VALUES (?, ?)
    `,
    [codigo, NOMBRES_TIPO_DOCUMENTO[codigo] || codigo]
  );

  return result.insertId;
}

async function obtenerEstadoVentaId(connection, codigo) {
  const codigoNormalizado = normalizarCodigoDocumento(codigo);
  const [rows] = await connection.query(
    `
    SELECT IdEstadoVenta
    FROM EV_EstadoVenta
    WHERE Codigo = ?
    LIMIT 1
    `,
    [codigoNormalizado]
  );

  if (rows.length > 0) {
    return rows[0].IdEstadoVenta;
  }

  const [result] = await connection.query(
    `
    INSERT INTO EV_EstadoVenta (Codigo, Nombre)
    VALUES (?, ?)
    `,
    [codigoNormalizado, NOMBRES_ESTADO_VENTA[codigoNormalizado] || codigoNormalizado]
  );

  return result.insertId;
}

async function obtenerTipoPago(connection, idTipoPago, codigoTipoPago) {
  if (idTipoPago) {
    const [rows] = await connection.query(
      `
      SELECT IdTipoPago, Codigo, Nombre
      FROM TP_TipoPago
      WHERE IdTipoPago = ?
        AND Estado = 'A'
      LIMIT 1
      `,
      [idTipoPago]
    );

    if (rows.length > 0) {
      return rows[0];
    }
  }

  const codigo = normalizarCodigoDocumento(codigoTipoPago || "EFE");
  const [rows] = await connection.query(
    `
    SELECT IdTipoPago, Codigo, Nombre
    FROM TP_TipoPago
    WHERE Codigo = ?
      AND Estado = 'A'
    LIMIT 1
    `,
    [codigo]
  );

  if (rows.length === 0) {
    throw new Error("El tipo de pago seleccionado no existe");
  }

  return rows[0];
}

async function obtenerTipoPagoId(connection, idTipoPago, codigoTipoPago) {
  const tipoPago = await obtenerTipoPago(connection, idTipoPago, codigoTipoPago);
  return tipoPago.IdTipoPago;
}

async function generarNumeroPago(connection) {
  const [rows] = await connection.query(`
    SELECT MAX(CAST(SUBSTRING(NumeroPago, 2) AS UNSIGNED)) AS UltimoNumero
    FROM PG_Pago
    WHERE NumeroPago REGEXP '^P[0-9]+$'
  `);

  return `P${String(Number(rows[0]?.UltimoNumero || 0) + 1).padStart(6, "0")}`;
}

async function registrarMovimientoInventario(connection, movimiento) {
  const idLote = parseInt(movimiento.idLote);
  const cantidadEntrada = Number(movimiento.cantidadEntrada || 0);
  const cantidadSalida = Number(movimiento.cantidadSalida || 0);
  const stockAnterior = Number(movimiento.stockAnterior);
  const stockNuevo = Number(movimiento.stockNuevo);
  const tipoMovimiento = normalizarCodigoDocumento(movimiento.tipoMovimiento);
  const tipoDocumento = normalizarCodigoDocumento(movimiento.tipoDocumento);
  const costoUnitario = movimiento.costoUnitario === undefined || movimiento.costoUnitario === null
    ? null
    : Number(movimiento.costoUnitario);
  const cantidadMovimiento = cantidadEntrada > 0 ? cantidadEntrada : cantidadSalida;
  const valorMovimiento = costoUnitario === null ? null : redondearMoneda(costoUnitario * cantidadMovimiento);

  if (!idLote || Number.isNaN(idLote)) {
    throw new Error("El movimiento debe estar asociado a un lote valido");
  }

  if (!TIPOS_MOVIMIENTO_VALIDOS.has(tipoMovimiento)) {
    throw new Error("Tipo de movimiento de inventario no valido");
  }

  if (!TIPOS_DOCUMENTO_KARDEX_VALIDOS.has(tipoDocumento)) {
    throw new Error("Tipo de documento de Kardex no valido");
  }

  if (
    !Number.isInteger(cantidadEntrada) ||
    !Number.isInteger(cantidadSalida) ||
    cantidadEntrada < 0 ||
    cantidadSalida < 0
  ) {
    throw new Error("Las cantidades del movimiento deben ser enteros positivos");
  }

  if (cantidadEntrada > 0 && cantidadSalida > 0) {
    throw new Error("Un movimiento no puede registrar entrada y salida a la vez");
  }

  if (cantidadEntrada <= 0 && cantidadSalida <= 0 && tipoMovimiento !== "AJUSTE") {
    throw new Error("El movimiento de inventario debe registrar entrada o salida");
  }

  if (Number.isNaN(stockAnterior) || Number.isNaN(stockNuevo) || stockAnterior < 0 || stockNuevo < 0) {
    throw new Error("El movimiento debe tener stock anterior y stock nuevo validos");
  }

  if (stockNuevo !== stockAnterior + cantidadEntrada - cantidadSalida) {
    throw new Error("El stock del movimiento no coincide con la entrada o salida registrada");
  }

  if (costoUnitario !== null && (Number.isNaN(costoUnitario) || costoUnitario < 0)) {
    throw new Error("El costo unitario del movimiento no puede ser negativo");
  }

  const idTipoMovimiento = await obtenerTipoMovimientoId(connection, tipoMovimiento);
  const idTipoDocumento = await obtenerTipoDocumentoId(connection, tipoDocumento);

  await connection.query(
    `
    INSERT INTO MI_MovimientoInventario
    (
      IdLote, IdUsuario, IdTipoMovimiento, IdTipoDocumento,
      NumeroDocumento, TablaReferencia, IdReferencia,
      CantidadEntrada, CantidadSalida, StockAnterior, StockNuevo,
      CostoUnitario, ValorMovimiento, MetodoCosto, Motivo, FechaMovimiento
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `,
    [
      idLote,
      movimiento.idUsuario || null,
      idTipoMovimiento,
      idTipoDocumento,
      movimiento.numeroDocumento || null,
      movimiento.tablaReferencia || null,
      movimiento.idReferencia || null,
      cantidadEntrada,
      cantidadSalida,
      movimiento.stockAnterior,
      movimiento.stockNuevo,
      costoUnitario,
      valorMovimiento,
      movimiento.metodoCosto || "PROMEDIO",
      movimiento.motivo || null,
      movimiento.fechaMovimiento || null,
    ]
  );
}

async function asegurarCatalogosInventario() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await obtenerTipoMovimientoId(connection, "ENTRADA");
    await obtenerTipoMovimientoId(connection, "SALIDA");
    await obtenerTipoMovimientoId(connection, "AJUSTE");
    await obtenerTipoDocumentoId(connection, "LOTE");
    await obtenerTipoDocumentoId(connection, "VENTA");
    await obtenerTipoDocumentoId(connection, "AJUSTE");

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function asegurarCatalogosBasicos() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Insertar categorías básicas
    await connection.query(`
      INSERT INTO CA_Categoria (Codigo, Nombre)
      VALUES
        ('MED', 'Medicamentos'),
        ('DERM', 'Dermatológicos'),
        ('ANA', 'Analgésicos'),
        ('ATB', 'Antibióticos')
      ON DUPLICATE KEY UPDATE Nombre = VALUES(Nombre), Estado = 'A'
    `);

    // Insertar marcas básicas
    await connection.query(`
      INSERT INTO MA_Marca (Codigo, Nombre)
      VALUES
        ('GEN', 'Genérico'),
        ('BAY', 'Bayer'),
        ('MK', 'MK'),
        ('PFZ', 'Pfizer')
      ON DUPLICATE KEY UPDATE Nombre = VALUES(Nombre), Estado = 'A'
    `);

    // Insertar presentaciones básicas
    await connection.query(`
      INSERT INTO PR_Presentacion (Codigo, Nombre)
      VALUES
        ('TAB', 'Tableta'),
        ('CAP', 'Cápsula'),
        ('JAR', 'Jarabe'),
        ('CRE', 'Crema')
      ON DUPLICATE KEY UPDATE Nombre = VALUES(Nombre), Estado = 'A'
    `);

    // Insertar tipos de pago
    await connection.query(`
      INSERT INTO TP_TipoPago (Codigo, Nombre)
      VALUES
        ('EFE', 'Efectivo'),
        ('TDB', 'Tarjeta Débito'),
        ('TCR', 'Tarjeta Crédito')
      ON DUPLICATE KEY UPDATE Nombre = VALUES(Nombre), Estado = 'A'
    `);

    await connection.query(`
      INSERT INTO TP_TipoPago (Codigo, Nombre)
      VALUES
        ('YAP', 'Yape'),
        ('PLI', 'Plin')
      ON DUPLICATE KEY UPDATE Nombre = VALUES(Nombre), Estado = 'A'
    `);

    await connection.query(`
      INSERT INTO EV_EstadoVenta (Codigo, Nombre)
      VALUES
        ('PEN', 'Pendiente'),
        ('PAG', 'Pagado'),
        ('ANU', 'Anulado')
      ON DUPLICATE KEY UPDATE Nombre = VALUES(Nombre)
    `);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function columnaExiste(connection, tabla, columna) {
  const [rows] = await connection.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
    `,
    [tabla, columna]
  );

  return rows.length > 0;
}

async function constraintExiste(connection, tabla, constraint) {
  const [rows] = await connection.query(
    `
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND CONSTRAINT_NAME = ?
    LIMIT 1
    `,
    [tabla, constraint]
  );

  return rows.length > 0;
}

async function foreignKeyEnColumnaExiste(connection, tabla, columna) {
  const [rows] = await connection.query(
    `
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
      AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
    `,
    [tabla, columna]
  );

  return rows.length > 0;
}

async function indiceUnicoConColumnasExiste(connection, tabla, columnas) {
  const [rows] = await connection.query(
    `
    SELECT INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND NON_UNIQUE = 0
    GROUP BY INDEX_NAME
    HAVING GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') = ?
    LIMIT 1
    `,
    [tabla, columnas.join(",")]
  );

  return rows.length > 0;
}

async function agregarColumnaSiNoExiste(connection, tabla, columna, definicion) {
  if (await columnaExiste(connection, tabla, columna)) {
    return;
  }

  await connection.query(`ALTER TABLE ${tabla} ADD COLUMN ${definicion}`);
}

async function asegurarEsquemaBase() {
  const connection = await pool.getConnection();

  try {
    if (await columnaExiste(connection, "PE_Persona", "Codigo")) {
      await connection.query(`
        ALTER TABLE PE_Persona
        MODIFY COLUMN Codigo Varchar(10) NULL
      `);
    }

    await agregarColumnaSiNoExiste(
      connection,
      "PE_Persona",
      "Correo",
      "Correo Varchar(100) NULL AFTER Telefono"
    );

    await agregarColumnaSiNoExiste(
      connection,
      "CL_Cliente",
      "CodigoCliente",
      "CodigoCliente Varchar(20) NULL UNIQUE AFTER IdPersona"
    );

    if (await columnaExiste(connection, "PV_Proveedor", "Codigo")) {
      await connection.query(`
        ALTER TABLE PV_Proveedor
        MODIFY COLUMN Codigo Varchar(10) NULL
      `);
    }
  } finally {
    connection.release();
  }
}

async function asegurarEsquemaUnidadesVenta() {
  const connection = await pool.getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS UV_UnidadVenta (
        IdUnidadVenta Int AUTO_INCREMENT PRIMARY KEY,
        IdItem Int NOT NULL,
        Nombre Varchar(50) NOT NULL,
        Abreviatura Varchar(20) NOT NULL,
        FactorConversion Int NOT NULL,
        PrecioVenta Decimal(12,2),
        EsUnidadMinima Char(1) DEFAULT 'N',
        Estado Char(1) DEFAULT 'A',
        FechaRegistro Datetime DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (IdItem, Abreviatura),
        FOREIGN KEY (IdItem) REFERENCES IT_Item(IdItem),
        CHECK (FactorConversion > 0)
      ) ENGINE = InnoDB
    `);

    await agregarColumnaSiNoExiste(
      connection,
      "UV_UnidadVenta",
      "Abreviatura",
      "Abreviatura Varchar(20) NULL AFTER Nombre"
    );

    if (await columnaExiste(connection, "UV_UnidadVenta", "Codigo")) {
      await connection.query(`
        ALTER TABLE UV_UnidadVenta
        MODIFY COLUMN Codigo Varchar(20) NULL
      `);

      await connection.query(`
        UPDATE UV_UnidadVenta
        SET Abreviatura = COALESCE(NULLIF(Abreviatura, ''), NULLIF(Codigo, ''), UPPER(LEFT(Nombre, 20)), 'UND')
        WHERE Abreviatura IS NULL OR Abreviatura = ''
      `);
    } else {
      await connection.query(`
        UPDATE UV_UnidadVenta
        SET Abreviatura = COALESCE(NULLIF(Abreviatura, ''), UPPER(LEFT(Nombre, 20)), 'UND')
        WHERE Abreviatura IS NULL OR Abreviatura = ''
      `);
    }

    await connection.query(`
      ALTER TABLE UV_UnidadVenta
      MODIFY COLUMN Abreviatura Varchar(20) NOT NULL
    `);

    if (!(await indiceUnicoConColumnasExiste(connection, "UV_UnidadVenta", ["IdItem", "Abreviatura"]))) {
      await connection.query(`
        CREATE UNIQUE INDEX UX_UV_Item_Abreviatura
        ON UV_UnidadVenta (IdItem, Abreviatura)
      `);
    }

    await agregarColumnaSiNoExiste(
      connection,
      "DV_DetalleVenta",
      "IdUnidadVenta",
      "IdUnidadVenta Int NULL AFTER IdLote"
    );
    await agregarColumnaSiNoExiste(
      connection,
      "DV_DetalleVenta",
      "UnidadVenta",
      "UnidadVenta Varchar(50) NULL AFTER Cantidad"
    );
    await agregarColumnaSiNoExiste(
      connection,
      "DV_DetalleVenta",
      "FactorConversion",
      "FactorConversion Int NOT NULL DEFAULT 1 AFTER UnidadVenta"
    );
    await agregarColumnaSiNoExiste(
      connection,
      "DV_DetalleVenta",
      "CantidadUnidadesMinimas",
      "CantidadUnidadesMinimas Int NOT NULL DEFAULT 0 AFTER FactorConversion"
    );

    await connection.query(`
      UPDATE DV_DetalleVenta
      SET FactorConversion = 1
      WHERE FactorConversion IS NULL OR FactorConversion <= 0
    `);

    await connection.query(`
      UPDATE DV_DetalleVenta
      SET CantidadUnidadesMinimas = Cantidad * FactorConversion
      WHERE CantidadUnidadesMinimas IS NULL OR CantidadUnidadesMinimas = 0
    `);

    await connection.query(`
      ALTER TABLE DV_DetalleVenta
      MODIFY COLUMN IdUnidadVenta Int NULL
    `);

    if (
      !(await constraintExiste(connection, "DV_DetalleVenta", "FK_DV_UnidadVenta")) &&
      !(await foreignKeyEnColumnaExiste(connection, "DV_DetalleVenta", "IdUnidadVenta"))
    ) {
      await connection.query(`
        ALTER TABLE DV_DetalleVenta
        ADD CONSTRAINT FK_DV_UnidadVenta
        FOREIGN KEY (IdUnidadVenta) REFERENCES UV_UnidadVenta(IdUnidadVenta)
      `);
    }
  } finally {
    connection.release();
  }
}

function normalizarUnidadMinima(unidadMedida) {
  return String(unidadMedida || "UND").trim() || "UND";
}

function normalizarAbreviaturaUnidad(abreviatura, nombre) {
  const texto = String(abreviatura || nombre || "UND").trim().toUpperCase();
  return texto.substring(0, 20) || "UND";
}

function normalizarUnidadesVenta(unidadesVenta, unidadMedida, precioVentaBase) {
  const unidadMinima = normalizarUnidadMinima(unidadMedida);
  const precioBase = Number(precioVentaBase || 0);
  const entradas = Array.isArray(unidadesVenta) ? unidadesVenta : [];
  const porAbreviatura = new Map();

  entradas.forEach((unidad) => {
    const nombre = String(unidad.nombre || unidad.Nombre || "").trim();
    const factorConversion = parseInt(unidad.factorConversion || unidad.FactorConversion);
    const precioVenta = unidad.precioVenta ?? unidad.PrecioVenta;
    const precio = precioVenta === "" || precioVenta === null || precioVenta === undefined
      ? null
      : Number(precioVenta);

    if (!nombre || Number.isNaN(factorConversion) || factorConversion <= 0) {
      return;
    }

    const abreviatura = normalizarAbreviaturaUnidad(unidad.abreviatura || unidad.Abreviatura, nombre);

    if (porAbreviatura.has(abreviatura)) {
      return;
    }

    porAbreviatura.set(abreviatura, {
      nombre,
      abreviatura,
      factorConversion,
      precioVenta: precio === null || Number.isNaN(precio) ? precioBase * factorConversion : precio,
      esUnidadMinima: factorConversion === 1 ? "S" : "N",
    });
  });

  const tieneUnidadMinima = [...porAbreviatura.values()].some((unidad) => unidad.factorConversion === 1);

  if (!tieneUnidadMinima) {
    const abreviaturaMinima = normalizarAbreviaturaUnidad(unidadMinima, unidadMinima);
    porAbreviatura.set(abreviaturaMinima, {
      nombre: unidadMinima,
      abreviatura: abreviaturaMinima,
      factorConversion: 1,
      precioVenta: precioBase,
      esUnidadMinima: "S",
    });
  }

  return [...porAbreviatura.values()]
    .map((unidad) => ({
      ...unidad,
      esUnidadMinima: unidad.factorConversion === 1 ? "S" : "N",
    }))
    .sort((a, b) => b.factorConversion - a.factorConversion || a.nombre.localeCompare(b.nombre));
}

function crearUnidadVentaPorDefecto(producto) {
  const unidadMinima = normalizarUnidadMinima(producto.UnidadMedida || producto.UnidadMinima);

  return {
    IdUnidadVenta: null,
    IdItem: producto.IdItem,
    Nombre: unidadMinima,
    Abreviatura: normalizarAbreviaturaUnidad(unidadMinima, unidadMinima),
    FactorConversion: 1,
    PrecioVenta: Number(producto.PrecioVenta || 0),
    EsUnidadMinima: "S",
  };
}

async function obtenerUnidadesVentaPorItems(connection, idsItems) {
  const ids = [...new Set(idsItems.map((id) => parseInt(id)).filter((id) => !Number.isNaN(id)))];
  const porItem = new Map();

  if (ids.length === 0) {
    return porItem;
  }

  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `
    SELECT
      IdUnidadVenta,
      IdItem,
      Nombre,
      Abreviatura,
      FactorConversion,
      PrecioVenta,
      EsUnidadMinima
    FROM UV_UnidadVenta
    WHERE Estado = 'A'
      AND IdItem IN (${placeholders})
    ORDER BY IdItem ASC, FactorConversion DESC, Nombre ASC
    `,
    ids
  );

  rows.forEach((unidad) => {
    if (!porItem.has(unidad.IdItem)) {
      porItem.set(unidad.IdItem, []);
    }

    porItem.get(unidad.IdItem).push({
      ...unidad,
      FactorConversion: Number(unidad.FactorConversion),
      PrecioVenta: unidad.PrecioVenta === null ? null : Number(unidad.PrecioVenta),
    });
  });

  return porItem;
}

function agregarUnidadesVentaAProducto(producto, unidadesPorItem) {
  const unidades = unidadesPorItem.get(producto.IdItem) || [];
  const unidadMinima = normalizarUnidadMinima(producto.UnidadMedida);
  const unidadesConPrecio = unidades.map((unidad) => ({
    ...unidad,
    PrecioVenta: unidad.PrecioVenta === null
      ? Number(producto.PrecioVenta || 0) * Number(unidad.FactorConversion)
      : unidad.PrecioVenta,
  }));

  return {
    ...producto,
    UnidadMinima: unidadMinima,
    UnidadesVenta: unidadesConPrecio.length > 0 ? unidadesConPrecio : [crearUnidadVentaPorDefecto(producto)],
  };
}

async function guardarUnidadesVentaProducto(connection, idItem, unidadesVenta, unidadMedida, precioVentaBase) {
  const unidadesNormalizadas = normalizarUnidadesVenta(unidadesVenta, unidadMedida, precioVentaBase);

  await connection.query(
    `
    UPDATE UV_UnidadVenta
    SET Estado = 'I'
    WHERE IdItem = ?
    `,
    [idItem]
  );

  for (const unidad of unidadesNormalizadas) {
    await connection.query(
      `
      INSERT INTO UV_UnidadVenta
      (IdItem, Nombre, Abreviatura, FactorConversion, PrecioVenta, EsUnidadMinima, Estado)
      VALUES (?, ?, ?, ?, ?, ?, 'A')
      ON DUPLICATE KEY UPDATE
        Nombre = VALUES(Nombre),
        FactorConversion = VALUES(FactorConversion),
        PrecioVenta = VALUES(PrecioVenta),
        EsUnidadMinima = VALUES(EsUnidadMinima),
        Estado = 'A'
      `,
      [
        idItem,
        unidad.nombre,
        unidad.abreviatura,
        unidad.factorConversion,
        unidad.precioVenta,
        unidad.esUnidadMinima,
      ]
    );
  }
}

async function obtenerUnidadVentaParaDetalle(connection, idItem, idUnidadVenta, producto) {
  if (idUnidadVenta) {
    const [rows] = await connection.query(
      `
      SELECT
        IdUnidadVenta,
        Nombre,
        Abreviatura,
        FactorConversion,
        PrecioVenta
      FROM UV_UnidadVenta
      WHERE IdUnidadVenta = ?
        AND IdItem = ?
        AND Estado = 'A'
      LIMIT 1
      `,
      [idUnidadVenta, idItem]
    );

    if (rows.length === 0) {
      throw new Error("La unidad de venta seleccionada no pertenece al producto");
    }

    const unidad = rows[0];

    return {
      idUnidadVenta: unidad.IdUnidadVenta,
      nombre: unidad.Nombre,
      factorConversion: Number(unidad.FactorConversion),
      precioVenta: unidad.PrecioVenta === null
        ? Number(producto.PrecioVenta || 0) * Number(unidad.FactorConversion)
        : Number(unidad.PrecioVenta),
    };
  }

  const unidadDefecto = crearUnidadVentaPorDefecto(producto);

  return {
    idUnidadVenta: null,
    nombre: unidadDefecto.Nombre,
    factorConversion: unidadDefecto.FactorConversion,
    precioVenta: unidadDefecto.PrecioVenta,
  };
}

async function asegurarKardexHistorico() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(`
      UPDATE DV_DetalleVenta
      SET FactorConversion = 1
      WHERE FactorConversion IS NULL OR FactorConversion <= 0
    `);

    await connection.query(`
      UPDATE DV_DetalleVenta
      SET CantidadUnidadesMinimas = Cantidad * FactorConversion
      WHERE CantidadUnidadesMinimas IS NULL OR CantidadUnidadesMinimas = 0
    `);

    const [lotes] = await connection.query(`
      SELECT
        l.IdLote,
        l.NumeroLote,
        l.FechaIngreso,
        l.FechaRegistro,
        l.StockActual,
        l.CostoCompraLote,
        COALESCE(vendidos.CantidadVendida, 0) AS CantidadVendida,
        (
          SELECT m.StockAnterior
          FROM MI_MovimientoInventario m
          WHERE m.IdLote = l.IdLote
          ORDER BY m.FechaMovimiento ASC, m.IdMovimiento ASC
          LIMIT 1
        ) AS PrimerStockAnterior,
        EXISTS (
          SELECT 1
          FROM MI_MovimientoInventario m
          INNER JOIN TM_TipoMovimiento tm ON m.IdTipoMovimiento = tm.IdTipoMovimiento
          INNER JOIN TD_TipoDocumento td ON m.IdTipoDocumento = td.IdTipoDocumento
          WHERE m.IdLote = l.IdLote
            AND tm.Codigo = 'ENTRADA'
            AND td.Codigo = 'LOTE'
            AND m.TablaReferencia = 'LT_Lote'
            AND m.IdReferencia = l.IdLote
          LIMIT 1
        ) AS TieneEntradaInicial
      FROM LT_Lote l
      LEFT JOIN (
        SELECT
          dv.IdLote,
          SUM(dv.CantidadUnidadesMinimas) AS CantidadVendida
        FROM DV_DetalleVenta dv
        INNER JOIN VE_Venta v ON dv.IdVenta = v.IdVenta
        INNER JOIN EV_EstadoVenta ev ON v.IdEstadoVenta = ev.IdEstadoVenta
        WHERE v.Estado = 'A'
          AND ev.Codigo = 'PAG'
        GROUP BY dv.IdLote
      ) vendidos ON vendidos.IdLote = l.IdLote
    `);

    const stockInicialPorLote = new Map();

    for (const lote of lotes) {
      const stockActual = Number(lote.StockActual || 0);
      const cantidadVendida = Number(lote.CantidadVendida || 0);
      const primerStockAnterior = lote.PrimerStockAnterior === null || lote.PrimerStockAnterior === undefined
        ? null
        : Number(lote.PrimerStockAnterior);
      const stockInicial = primerStockAnterior !== null && primerStockAnterior > 0
        ? primerStockAnterior
        : stockActual + cantidadVendida;

      stockInicialPorLote.set(lote.IdLote, stockInicial);

      if (!lote.TieneEntradaInicial && stockInicial > 0) {
        await registrarMovimientoInventario(connection, {
          idLote: lote.IdLote,
          tipoMovimiento: "ENTRADA",
          tipoDocumento: "LOTE",
          numeroDocumento: lote.NumeroLote,
          tablaReferencia: "LT_Lote",
          idReferencia: lote.IdLote,
          cantidadEntrada: stockInicial,
          stockAnterior: 0,
          stockNuevo: stockInicial,
          costoUnitario: lote.CostoCompraLote,
          motivo: "Entrada inicial reconstruida para Kardex",
          fechaMovimiento: lote.FechaIngreso || lote.FechaRegistro,
        });
      }
    }

    const [ventasPorLote] = await connection.query(`
      SELECT
        dv.IdLote,
        v.IdVenta,
        v.NumeroVenta,
        v.NumeroComprobante,
        v.FechaVenta,
        v.IdUsuario,
        SUM(dv.CantidadUnidadesMinimas) AS CantidadSalida,
        GROUP_CONCAT(
          CONCAT(
            dv.Cantidad,
            ' ',
            COALESCE(NULLIF(dv.UnidadVenta, ''), i.UnidadMedida, 'UND')
          )
          ORDER BY dv.IdDetalleVenta
          SEPARATOR ', '
        ) AS DetalleVenta,
        EXISTS (
          SELECT 1
          FROM MI_MovimientoInventario m
          INNER JOIN TD_TipoDocumento td ON m.IdTipoDocumento = td.IdTipoDocumento
          WHERE m.IdLote = dv.IdLote
            AND td.Codigo = 'VENTA'
            AND m.TablaReferencia = 'VE_Venta'
            AND m.IdReferencia = v.IdVenta
          LIMIT 1
        ) AS TieneMovimientoVenta
      FROM DV_DetalleVenta dv
      INNER JOIN VE_Venta v ON dv.IdVenta = v.IdVenta
      INNER JOIN EV_EstadoVenta ev ON v.IdEstadoVenta = ev.IdEstadoVenta
      INNER JOIN LT_Lote l ON dv.IdLote = l.IdLote
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
      WHERE v.Estado = 'A'
        AND ev.Codigo = 'PAG'
      GROUP BY
        dv.IdLote,
        v.IdVenta,
        v.NumeroVenta,
        v.NumeroComprobante,
        v.FechaVenta,
        v.IdUsuario
      ORDER BY dv.IdLote ASC, v.FechaVenta ASC, v.IdVenta ASC
    `);

    const stockReconstruidoPorLote = new Map(stockInicialPorLote);

    for (const venta of ventasPorLote) {
      const cantidadSalida = Number(venta.CantidadSalida || 0);

      if (cantidadSalida <= 0) {
        continue;
      }

      const stockAnterior = Number(stockReconstruidoPorLote.get(venta.IdLote) || 0);
      const stockNuevo = stockAnterior - cantidadSalida;

      if (!venta.TieneMovimientoVenta) {
        await registrarMovimientoInventario(connection, {
          idLote: venta.IdLote,
          idUsuario: null, // Para histórico
          tipoMovimiento: "SALIDA",
          tipoDocumento: "VENTA",
          numeroDocumento: venta.NumeroComprobante || venta.NumeroVenta,
          tablaReferencia: "VE_Venta",
          idReferencia: venta.IdVenta,
          cantidadSalida,
          stockAnterior,
          stockNuevo,
          motivo: `Salida por venta reconstruida (${venta.DetalleVenta})`,
          fechaMovimiento: venta.FechaVenta,
        });
      }

      stockReconstruidoPorLote.set(venta.IdLote, stockNuevo);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function asegurarDatosIniciales() {
  await asegurarEsquemaBase();
  await asegurarEsquemaUnidadesVenta();
  await asegurarUsuariosIniciales();
  await asegurarCatalogosBasicos();
  await asegurarCatalogosInventario();

  // Asegurar que IdUsuario en MI_MovimientoInventario sea NULLABLE
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      ALTER TABLE MI_MovimientoInventario
      MODIFY COLUMN IdUsuario Int NULL
    `);
  } catch (error) {
    // Ignorar si ya es NULLABLE
  } finally {
    connection.release();
  }

  await asegurarKardexHistorico();
}

app.use(cargarSesion);

app.get("/", (req, res) => {
  res.redirect(req.usuario ? "/dashboard.html" : "/login.html");
});

app.get("/index.html", (req, res) => {
  res.redirect(req.usuario ? "/dashboard.html" : "/login.html");
});

app.get("/login.html", (req, res) => {
  if (req.usuario) {
    return res.redirect("/dashboard.html");
  }

  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

const paginasProtegidas = [
  { ruta: "/dashboard.html", archivo: "dashboard.html", roles: ["ADMIN", "CAJERO"] },
  { ruta: "/proveedores.html", archivo: "proveedores.html", roles: ["ADMIN"] },
  { ruta: "/productos.html", archivo: "productos.html", roles: ["ADMIN"] },
  { ruta: "/lotes.html", archivo: "lotes.html", roles: ["ADMIN"] },
  { ruta: "/kardex.html", archivo: "kardex.html", roles: ["ADMIN"] },
  { ruta: "/ventas.html", archivo: "ventas.html", roles: ["ADMIN", "CAJERO"] },
  { ruta: "/alertas.html", archivo: "alertas.html", roles: ["ADMIN", "CAJERO"] },
];

paginasProtegidas.forEach((pagina) => {
  app.get(pagina.ruta, requirePageRole(...pagina.roles), (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, pagina.archivo));
  });
});

app.use(express.static(PUBLIC_DIR));

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contrasena son obligatorios" });
  }

  try {
    const [usuarios] = await pool.query(
      `
      SELECT IdUsuario, Username, PasswordHash, Rol
      FROM US_Usuario
      WHERE Username = ?
      LIMIT 1
      `,
      [username]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
    }

    const usuarioDb = usuarios[0];
    const passwordValido = await verificarPassword(password, usuarioDb.PasswordHash);

    if (!passwordValido) {
      return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
    }

    if (!usuarioDb.PasswordHash.startsWith("$2")) {
      const nuevoHash = await crearPasswordHash(password);
      await pool.query(
        `
        UPDATE US_Usuario
        SET PasswordHash = ?
        WHERE IdUsuario = ?
        `,
        [nuevoHash, usuarioDb.IdUsuario]
      );
    }

    const usuario = {
      idUsuario: usuarioDb.IdUsuario,
      username: usuarioDb.Username,
      rol: normalizarRol(usuarioDb.Rol),
    };

    const token = crearSesion(usuario);
    res.setHeader("Set-Cookie", crearCookieSesion(token));

    res.json({
      mensaje: "Inicio de sesion correcto",
      usuario,
    });
  } catch (error) {
    console.error("Error al iniciar sesion:", error);
    res.status(500).json({ error: "Error al iniciar sesion" });
  }
});

app.get("/api/auth/me", (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: "Debe iniciar sesion" });
  }

  res.json({ usuario: req.usuario });
});

app.post("/api/auth/logout", (req, res) => {
  const token = obtenerTokenSesion(req);

  if (token) {
    sessions.delete(token);
  }

  res.setHeader("Set-Cookie", limpiarCookieSesion());
  res.json({ mensaje: "Sesion cerrada correctamente" });
});

app.use("/api", requireAuth, requireApiRole);

app.get("/api/test-db", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 + 1 AS resultado");
    res.json({
      mensaje: "Conexión correcta a MySQL",
      resultado: rows[0].resultado,
    });
  } catch (error) {
    console.error("Error al conectar con MySQL:", error);
    res.status(500).json({ error: "Error al conectar con MySQL" });
  }
});

/* =========================
   CATEGORÍAS
========================= */

app.get("/api/categorias", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT IdCategoria, Codigo, Nombre, Estado
      FROM CA_Categoria
      WHERE Estado = 'A'
      ORDER BY IdCategoria DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error al listar categorías:", error);
    res.status(500).json({ error: "Error al listar categorías" });
  }
});

app.post("/api/categorias", async (req, res) => {
  const { codigo, nombre } = req.body;

  if (!codigo || !nombre) {
    return res.status(400).json({ error: "Código y nombre son obligatorios" });
  }

  try {
    const [result] = await pool.query(
      `
      INSERT INTO CA_Categoria (Codigo, Nombre)
      VALUES (?, ?)
      `,
      [codigo, nombre]
    );

    res.status(201).json({
      mensaje: "Categoría registrada correctamente",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error al registrar categoría:", error);
    res.status(500).json({ error: "Error al registrar categoría" });
  }
});

/* =========================
   MARCAS
========================= */

app.get("/api/marcas", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT IdMarca, Codigo, Nombre, Estado
      FROM MA_Marca
      WHERE Estado = 'A'
      ORDER BY IdMarca DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error al listar marcas:", error);
    res.status(500).json({ error: "Error al listar marcas" });
  }
});

app.post("/api/marcas", async (req, res) => {
  const { codigo, nombre } = req.body;

  if (!codigo || !nombre) {
    return res.status(400).json({ error: "Código y nombre son obligatorios" });
  }

  try {
    const [result] = await pool.query(
      `
      INSERT INTO MA_Marca (Codigo, Nombre)
      VALUES (?, ?)
      `,
      [codigo, nombre]
    );

    res.status(201).json({
      mensaje: "Marca registrada correctamente",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error al registrar marca:", error);
    res.status(500).json({ error: "Error al registrar marca" });
  }
});

/* =========================
   PRESENTACIONES
========================= */

app.get("/api/presentaciones", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT IdPresentacion, Codigo, Nombre, Estado
      FROM PR_Presentacion
      WHERE Estado = 'A'
      ORDER BY IdPresentacion DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error al listar presentaciones:", error);
    res.status(500).json({ error: "Error al listar presentaciones" });
  }
});

app.get("/api/tipos-pago", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT IdTipoPago, Codigo, Nombre
      FROM TP_TipoPago
      WHERE Estado = 'A'
      ORDER BY IdTipoPago ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error al listar tipos de pago:", error);
    res.status(500).json({ error: "Error al listar tipos de pago" });
  }
});

app.post("/api/presentaciones", async (req, res) => {
  const { codigo, nombre } = req.body;

  if (!codigo || !nombre) {
    return res.status(400).json({ error: "Código y nombre son obligatorios" });
  }

  try {
    const [result] = await pool.query(
      `
      INSERT INTO PR_Presentacion (Codigo, Nombre)
      VALUES (?, ?)
      `,
      [codigo, nombre]
    );

    res.status(201).json({
      mensaje: "Presentación registrada correctamente",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error al registrar presentación:", error);
    res.status(500).json({ error: "Error al registrar presentación" });
  }
});

/* =========================
   PROVEEDORES
========================= */

app.get("/api/proveedores", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        pv.IdProveedor,
        pe.IdPersona,
        pe.Nombres,
        pe.Apellidos,
        pe.TipoDocumento,
        pe.NumeroDocumento,
        pe.Telefono,
        COALESCE(pe.Correo, '') AS Correo,
        pe.Direccion,
        pv.RazonSocial,
        pv.Ruc,
        pv.Estado
      FROM PV_Proveedor pv
      INNER JOIN PE_Persona pe ON pv.IdPersona = pe.IdPersona
      WHERE pv.Estado = 'A'
      ORDER BY pv.IdProveedor DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error al listar proveedores:", error);
    res.status(500).json({ error: "Error al listar proveedores" });
  }
});

app.get("/api/proveedores/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const [rows] = await pool.query(
      `
      SELECT
        pv.IdProveedor,
        pe.IdPersona,
        pe.Nombres,
        pe.Apellidos,
        pe.TipoDocumento,
        pe.NumeroDocumento,
        pe.Telefono,
        COALESCE(pe.Correo, '') AS Correo,
        pe.Direccion,
        pv.RazonSocial,
        pv.Ruc,
        pv.Estado
      FROM PV_Proveedor pv
      INNER JOIN PE_Persona pe ON pv.IdPersona = pe.IdPersona
      WHERE pv.IdProveedor = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener proveedor:", error);
    res.status(500).json({ error: "Error al obtener proveedor" });
  }
});

app.post("/api/proveedores", async (req, res) => {
  let proveedor;

  try {
    proveedor = normalizarProveedorPayload(req.body);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [personaResult] = await connection.query(
      `
      INSERT INTO PE_Persona
      (Nombres, Apellidos, TipoDocumento, NumeroDocumento, Telefono, Correo, Direccion)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        proveedor.nombres,
        proveedor.apellidos,
        proveedor.tipoDocumento,
        proveedor.numeroDocumento,
        proveedor.telefono,
        proveedor.correo,
        proveedor.direccion,
      ]
    );

    const idPersona = personaResult.insertId;

    const [proveedorResult] = await connection.query(
      `
      INSERT INTO PV_Proveedor
      (IdPersona, RazonSocial, Ruc)
      VALUES (?, ?, ?)
      `,
      [idPersona, proveedor.razonSocial, proveedor.ruc]
    );

    await connection.query(
      `
      UPDATE PV_Proveedor
      SET Codigo = CONCAT('PRO', LPAD(IdProveedor, 3, '0'))
      WHERE IdProveedor = ?
      `,
      [proveedorResult.insertId]
    );

    await connection.commit();

    res.status(201).json({
      mensaje: "Proveedor registrado correctamente",
      idProveedor: proveedorResult.insertId,
      idPersona,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al registrar proveedor:", error);

    if (error.code === "ER_DUP_ENTRY") {
      if (error.sqlMessage?.includes("NumeroDocumento")) {
        return res.status(409).json({ error: "Ya existe una persona con ese numero de documento" });
      }

      if (error.sqlMessage?.includes("Ruc")) {
        return res.status(409).json({ error: "Ya existe un proveedor con ese RUC" });
      }
    }

    res.status(500).json({ error: "Error al registrar proveedor" });
  } finally {
    connection.release();
  }
});

app.put("/api/proveedores/:id", async (req, res) => {
  const idProveedor = parseInt(req.params.id);

  let proveedor;

  try {
    proveedor = normalizarProveedorPayload(req.body, true);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE PE_Persona
      SET
        Nombres = ?,
        Apellidos = ?,
        TipoDocumento = ?,
        NumeroDocumento = ?,
        Telefono = ?,
        Correo = ?,
        Direccion = ?
      WHERE IdPersona = ?
      `,
      [
        proveedor.nombres,
        proveedor.apellidos,
        proveedor.tipoDocumento,
        proveedor.numeroDocumento,
        proveedor.telefono,
        proveedor.correo,
        proveedor.direccion,
        proveedor.idPersona,
      ]
    );

    await connection.query(
      `
      UPDATE PV_Proveedor
      SET
        RazonSocial = ?,
        Ruc = ?
      WHERE IdProveedor = ?
      `,
      [proveedor.razonSocial, proveedor.ruc, idProveedor]
    );

    await connection.commit();

    res.json({ mensaje: "Proveedor actualizado correctamente" });
  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar proveedor:", error);
    if (error.code === "ER_DUP_ENTRY") {
      if (error.sqlMessage?.includes("NumeroDocumento")) {
        return res.status(409).json({ error: "Ya existe una persona con ese numero de documento" });
      }

      if (error.sqlMessage?.includes("Ruc")) {
        return res.status(409).json({ error: "Ya existe un proveedor con ese RUC" });
      }
    }

    res.status(500).json({ error: "Error al actualizar proveedor" });
  } finally {
    connection.release();
  }
});

app.delete("/api/proveedores/:id", async (req, res) => {
  const idProveedor = parseInt(req.params.id);

  try {
    const [result] = await pool.query(
      `
      UPDATE PV_Proveedor
      SET Estado = 'I'
      WHERE IdProveedor = ?
      `,
      [idProveedor]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }

    res.json({ mensaje: "Proveedor eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar proveedor:", error);
    res.status(500).json({ error: "Error al eliminar proveedor" });
  }
});

/* =========================
   PRODUCTOS
========================= */

app.get("/api/productos", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        i.IdItem,
        i.Codigo,
        i.CodigoBarras,
        i.Nombre,
        i.Descripcion,
        i.PrecioVenta,
        i.PrecioCompra,
        i.UnidadMedida,
        i.StockMinimo,
        i.Estado,
        c.Nombre AS Categoria,
        m.Nombre AS Marca,
        pr.Nombre AS Presentacion,
        pv.RazonSocial AS Proveedor
      FROM IT_Item i
      INNER JOIN CA_Categoria c ON i.IdCategoria = c.IdCategoria
      INNER JOIN MA_Marca m ON i.IdMarca = m.IdMarca
      INNER JOIN PR_Presentacion pr ON i.IdPresentacion = pr.IdPresentacion
      LEFT JOIN PV_Proveedor pv ON i.IdProveedor = pv.IdProveedor
        AND pv.Estado = 'A'
      WHERE i.Estado = 'A'
      ORDER BY i.IdItem DESC
    `);

    const unidadesPorItem = await obtenerUnidadesVentaPorItems(pool, rows.map((producto) => producto.IdItem));
    const productos = rows.map((producto) => agregarUnidadesVentaAProducto(producto, unidadesPorItem));

    res.json(productos);
  } catch (error) {
    console.error("Error al listar productos:", error);
    res.status(500).json({ error: "Error al listar productos" });
  }
});

app.post("/api/productos", async (req, res) => {
  const {
    codigo,
    codigoBarras,
    nombre,
    descripcion,
    precioVenta,
    precioCompra,
    idCategoria,
    idMarca,
    idPresentacion,
    idProveedor,
    requiereReceta,
    esControlado,
    unidadMedida,
    stockMinimo,
    usuarioRegistro,
    unidadesVenta,
  } = req.body;
  const precioVentaNumero = parseFloat(precioVenta);
  const precioCompraNumero = precioCompra === undefined || precioCompra === null || precioCompra === ""
    ? null
    : parseFloat(precioCompra);
  const stockMinimoNumero = stockMinimo === undefined || stockMinimo === null || stockMinimo === ""
    ? 0
    : parseInt(stockMinimo);
  const unidadMedidaNormalizada = normalizarUnidadMinima(unidadMedida);

  if (!nombre || Number.isNaN(precioVentaNumero) || precioVentaNumero <= 0 || !idCategoria || !idMarca || !idPresentacion || !unidadMedidaNormalizada) {
    return res.status(400).json({
      error: "Nombre, precio venta, categoría, marca y presentación son obligatorios",
    });
  }

  if (precioCompraNumero !== null && (Number.isNaN(precioCompraNumero) || precioCompraNumero < 0)) {
    return res.status(400).json({ error: "El precio de compra no puede ser negativo" });
  }

  if (precioCompraNumero !== null && precioCompraNumero > precioVentaNumero) {
    return res.status(400).json({ error: "El precio de compra no puede ser mayor al precio de venta" });
  }

  if (Number.isNaN(stockMinimoNumero) || stockMinimoNumero < 0) {
    return res.status(400).json({ error: "El stock minimo no puede ser negativo" });
  }

  if (codigoBarras && !/^[0-9]{6,20}$/.test(soloDigitos(codigoBarras))) {
    return res.status(400).json({ error: "El codigo de barras debe contener entre 6 y 20 digitos" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
      INSERT INTO IT_Item
      (
        Codigo, CodigoBarras, Nombre, Descripcion, PrecioVenta, PrecioCompra,
        IdCategoria, IdMarca, IdPresentacion, IdProveedor,
        RequiereReceta, EsControlado, UnidadMedida, StockMinimo, UsuarioRegistro
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        codigo || null,
        codigoBarras ? soloDigitos(codigoBarras) : null,
        nombre,
        descripcion || null,
        precioVentaNumero,
        precioCompraNumero,
        idCategoria,
        idMarca,
        idPresentacion,
        idProveedor || null,
        requiereReceta || "N",
        esControlado || "N",
        unidadMedidaNormalizada,
        stockMinimoNumero,
        usuarioRegistro || "admin",
      ]
    );

    await guardarUnidadesVentaProducto(connection, result.insertId, unidadesVenta, unidadMedidaNormalizada, precioVentaNumero);

    await connection.commit();

    res.status(201).json({
      mensaje: "Producto registrado correctamente",
      id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al registrar producto:", error);
    res.status(500).json({ error: "Error al registrar producto" });
  } finally {
    connection.release();
  }
});

app.get("/api/productos/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM IT_Item
      WHERE IdItem = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const unidadesPorItem = await obtenerUnidadesVentaPorItems(pool, [id]);

    res.json(agregarUnidadesVentaAProducto(rows[0], unidadesPorItem));
  } catch (error) {
    console.error("Error al obtener producto:", error);
    res.status(500).json({ error: "Error al obtener producto" });
  }
});

app.put("/api/productos/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  const {
    codigo,
    codigoBarras,
    nombre,
    descripcion,
    precioVenta,
    precioCompra,
    idCategoria,
    idMarca,
    idPresentacion,
    idProveedor,
    requiereReceta,
    esControlado,
    unidadMedida,
    stockMinimo,
    usuarioModifica,
    unidadesVenta,
  } = req.body;
  const precioVentaNumero = parseFloat(precioVenta);
  const precioCompraNumero = precioCompra === undefined || precioCompra === null || precioCompra === ""
    ? null
    : parseFloat(precioCompra);
  const stockMinimoNumero = stockMinimo === undefined || stockMinimo === null || stockMinimo === ""
    ? 0
    : parseInt(stockMinimo);
  const unidadMedidaNormalizada = normalizarUnidadMinima(unidadMedida);

  if (!nombre || Number.isNaN(precioVentaNumero) || precioVentaNumero <= 0 || !idCategoria || !idMarca || !idPresentacion || !unidadMedidaNormalizada) {
    return res.status(400).json({
      error: "Nombre, precio venta, categoría, marca y presentación son obligatorios",
    });
  }

  if (precioCompraNumero !== null && (Number.isNaN(precioCompraNumero) || precioCompraNumero < 0)) {
    return res.status(400).json({ error: "El precio de compra no puede ser negativo" });
  }

  if (precioCompraNumero !== null && precioCompraNumero > precioVentaNumero) {
    return res.status(400).json({ error: "El precio de compra no puede ser mayor al precio de venta" });
  }

  if (Number.isNaN(stockMinimoNumero) || stockMinimoNumero < 0) {
    return res.status(400).json({ error: "El stock minimo no puede ser negativo" });
  }

  if (codigoBarras && !/^[0-9]{6,20}$/.test(soloDigitos(codigoBarras))) {
    return res.status(400).json({ error: "El codigo de barras debe contener entre 6 y 20 digitos" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
      UPDATE IT_Item
      SET
        Codigo = ?,
        CodigoBarras = ?,
        Nombre = ?,
        Descripcion = ?,
        PrecioVenta = ?,
        PrecioCompra = ?,
        IdCategoria = ?,
        IdMarca = ?,
        IdPresentacion = ?,
        IdProveedor = ?,
        RequiereReceta = ?,
        EsControlado = ?,
        UnidadMedida = ?,
        StockMinimo = ?,
        UsuarioModifica = ?,
        FechaModifica = NOW()
      WHERE IdItem = ?
      `,
      [
        codigo || null,
        codigoBarras ? soloDigitos(codigoBarras) : null,
        nombre,
        descripcion || null,
        precioVentaNumero,
        precioCompraNumero,
        idCategoria,
        idMarca,
        idPresentacion,
        idProveedor || null,
        requiereReceta || "N",
        esControlado || "N",
        unidadMedidaNormalizada,
        stockMinimoNumero,
        usuarioModifica || "admin",
        id,
      ]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    await guardarUnidadesVentaProducto(connection, id, unidadesVenta, unidadMedidaNormalizada, precioVentaNumero);

    await connection.commit();

    res.json({ mensaje: "Producto actualizado correctamente" });
  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar producto:", error);
    res.status(500).json({ error: "Error al actualizar producto" });
  } finally {
    connection.release();
  }
});

app.delete("/api/productos/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const [result] = await pool.query(
      `
      UPDATE IT_Item
      SET Estado = 'I'
      WHERE IdItem = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ mensaje: "Producto eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

/* =========================
   LOTES
========================= */

app.get("/api/lotes", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        l.IdLote,
        l.IdItem,
        i.Nombre AS Producto,
        i.CodigoBarras,
        l.NumeroLote,
        l.FechaVencimiento,
        l.FechaIngreso,
        l.CostoCompraLote,
        l.StockActual,
        i.UnidadMedida AS UnidadMinima,
        l.Estado
      FROM LT_Lote l
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
      WHERE l.Estado = 'A'
      ORDER BY l.IdLote DESC
    `);

    const unidadesPorItem = await obtenerUnidadesVentaPorItems(pool, rows.map((lote) => lote.IdItem));
    const lotes = rows.map((lote) => {
      const producto = {
        IdItem: lote.IdItem,
        UnidadMedida: lote.UnidadMinima,
        PrecioVenta: 0,
      };

      return {
        ...lote,
        UnidadMinima: normalizarUnidadMinima(lote.UnidadMinima),
        StockActualMinimo: Number(lote.StockActual),
        UnidadesVenta: agregarUnidadesVentaAProducto(producto, unidadesPorItem).UnidadesVenta,
      };
    });

    res.json(lotes);
  } catch (error) {
    console.error("Error al listar lotes:", error);
    res.status(500).json({ error: "Error al listar lotes" });
  }
});

app.post("/api/lotes", async (req, res) => {
  const {
    idItem,
    numeroLote,
    fechaVencimiento,
    fechaIngreso,
    costoCompraLote,
    stockActual,
    usuarioRegistro,
  } = req.body;
  const idItemNumero = parseInt(idItem);
  const numeroLoteNormalizado = limpiarTexto(numeroLote).toUpperCase();
  const stockInicial = parseInt(stockActual);
  const costoLote = costoCompraLote === undefined || costoCompraLote === null || costoCompraLote === ""
    ? null
    : parseFloat(costoCompraLote);
  let fechasLote;

  if (!idItemNumero || !numeroLoteNormalizado || stockActual === undefined) {
    return res.status(400).json({
      error: "Producto, número de lote y stock actual son obligatorios",
    });
  }

  if (Number.isNaN(stockInicial) || stockInicial < 0) {
    return res.status(400).json({
      error: "El stock actual debe ser 0 o mayor",
    });
  }

  if (costoLote !== null && (Number.isNaN(costoLote) || costoLote < 0)) {
    return res.status(400).json({ error: "El costo de compra no puede ser negativo" });
  }

  try {
    fechasLote = validarFechasLote(fechaIngreso, fechaVencimiento);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
      INSERT INTO LT_Lote
      (
        IdItem, NumeroLote, FechaVencimiento, FechaIngreso,
        CostoCompraLote, StockActual, UsuarioRegistro
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        idItemNumero,
        numeroLoteNormalizado,
        fechasLote.fechaVencimiento,
        fechasLote.fechaIngreso,
        costoLote,
        stockInicial,
        usuarioRegistro || req.usuario.username,
      ]
    );

    if (stockInicial > 0) {
      await registrarMovimientoInventario(connection, {
        idLote: result.insertId,
        idUsuario: req.usuario.idUsuario,
        tipoMovimiento: "ENTRADA",
        tipoDocumento: "LOTE",
        numeroDocumento: numeroLoteNormalizado,
        tablaReferencia: "LT_Lote",
        idReferencia: result.insertId,
        cantidadEntrada: stockInicial,
        stockAnterior: 0,
        stockNuevo: stockInicial,
        costoUnitario: costoLote,
        motivo: "Registro inicial de lote",
      });
    }

    await connection.commit();

    res.status(201).json({
      mensaje: "Lote registrado correctamente",
      id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al registrar lote:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Ya existe un lote con ese numero" });
    }

    res.status(error.statusCode || 500).json({ error: error.message || "Error al registrar lote" });
  } finally {
    connection.release();
  }
});

app.get("/api/lotes/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const [rows] = await pool.query(
      `
      SELECT
        l.*,
        i.UnidadMedida AS UnidadMinima,
        i.PrecioVenta
      FROM LT_Lote l
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
      WHERE l.IdLote = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    const unidadesPorItem = await obtenerUnidadesVentaPorItems(pool, [rows[0].IdItem]);

    res.json({
      ...rows[0],
      UnidadMinima: normalizarUnidadMinima(rows[0].UnidadMinima),
      StockActualMinimo: Number(rows[0].StockActual),
      UnidadesVenta: agregarUnidadesVentaAProducto(rows[0], unidadesPorItem).UnidadesVenta,
    });
  } catch (error) {
    console.error("Error al obtener lote:", error);
    res.status(500).json({ error: "Error al obtener lote" });
  }
});

app.put("/api/lotes/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  const {
    idItem,
    numeroLote,
    fechaVencimiento,
    fechaIngreso,
    costoCompraLote,
    stockActual,
    usuarioRegistro,
  } = req.body;
  const idItemNumero = parseInt(idItem);
  const numeroLoteNormalizado = limpiarTexto(numeroLote).toUpperCase();
  const stockNuevo = parseInt(stockActual);
  const costoLote = costoCompraLote === undefined || costoCompraLote === null || costoCompraLote === ""
    ? null
    : parseFloat(costoCompraLote);
  let fechasLote;

  if (!idItemNumero || !numeroLoteNormalizado || stockActual === undefined) {
    return res.status(400).json({
      error: "Producto, número de lote y stock actual son obligatorios",
    });
  }

  if (Number.isNaN(stockNuevo) || stockNuevo < 0) {
    return res.status(400).json({
      error: "El stock actual no puede ser negativo",
    });
  }

  if (costoLote !== null && (Number.isNaN(costoLote) || costoLote < 0)) {
    return res.status(400).json({ error: "El costo de compra no puede ser negativo" });
  }

  try {
    fechasLote = validarFechasLote(fechaIngreso, fechaVencimiento);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [lotesActuales] = await connection.query(
      `
      SELECT IdItem, StockActual
      FROM LT_Lote
      WHERE IdLote = ?
      FOR UPDATE
      `,
      [id]
    );

    if (lotesActuales.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    const stockAnterior = Number(lotesActuales[0].StockActual);
    const idItemAnterior = Number(lotesActuales[0].IdItem);
    const stockReservado = await obtenerStockReservadoPendiente(connection, id);

    if (stockNuevo < stockReservado) {
      await connection.rollback();
      return res.status(409).json({ error: "El stock no puede quedar por debajo de pedidos pendientes" });
    }

    if (idItemAnterior !== idItemNumero) {
      const [movimientos] = await connection.query(
        `
        SELECT IdMovimiento
        FROM MI_MovimientoInventario
        WHERE IdLote = ?
        LIMIT 1
        `,
        [id]
      );

      if (movimientos.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: "No se puede cambiar el producto de un lote con movimientos en Kardex" });
      }
    }

    const [result] = await connection.query(
      `
      UPDATE LT_Lote
      SET
        IdItem = ?,
        NumeroLote = ?,
        FechaVencimiento = ?,
        FechaIngreso = ?,
        CostoCompraLote = ?,
        StockActual = ?,
        UsuarioRegistro = ?
      WHERE IdLote = ?
      `,
      [
        idItemNumero,
        numeroLoteNormalizado,
        fechasLote.fechaVencimiento,
        fechasLote.fechaIngreso,
        costoLote,
        stockNuevo,
        usuarioRegistro || req.usuario.username,
        id,
      ]
    );

    const diferencia = stockNuevo - stockAnterior;

    if (diferencia !== 0) {
      await registrarMovimientoInventario(connection, {
        idLote: id,
        idUsuario: req.usuario.idUsuario,
        tipoMovimiento: "AJUSTE",
        tipoDocumento: "AJUSTE",
        numeroDocumento: `AJUSTE-${id}`,
        tablaReferencia: "LT_Lote",
        idReferencia: id,
        cantidadEntrada: diferencia > 0 ? diferencia : 0,
        cantidadSalida: diferencia < 0 ? Math.abs(diferencia) : 0,
        stockAnterior,
        stockNuevo,
        costoUnitario: costoLote,
        motivo: "Ajuste manual de stock de lote",
      });
    }

    await connection.commit();

    res.json({ mensaje: "Lote actualizado correctamente" });
  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar lote:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Ya existe un lote con ese numero" });
    }

    res.status(error.statusCode || 500).json({ error: error.message || "Error al actualizar lote" });
  } finally {
    connection.release();
  }
});

app.delete("/api/lotes/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const [result] = await pool.query(
      `
      UPDATE LT_Lote
      SET Estado = 'I'
      WHERE IdLote = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    res.json({ mensaje: "Lote eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar lote:", error);
    res.status(500).json({ error: "Error al eliminar lote" });
  }
});

/* =========================
   ALERTAS
========================= */

app.get("/api/alertas", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        i.IdItem,
        i.Nombre AS Producto,
        COALESCE(
          GROUP_CONCAT(l.NumeroLote ORDER BY l.NumeroLote SEPARATOR ', '),
          'Sin lote activo'
        ) AS NumeroLote,
        COALESCE(SUM(l.StockActual), 0) AS StockActual,
        i.StockMinimo,
        i.UnidadMedida AS UnidadMinima,
        pv.RazonSocial AS Proveedor
      FROM IT_Item i
      LEFT JOIN LT_Lote l ON i.IdItem = l.IdItem
        AND l.Estado = 'A'
      LEFT JOIN PV_Proveedor pv ON i.IdProveedor = pv.IdProveedor
      WHERE i.Estado = 'A'
        AND i.StockMinimo > 0
      GROUP BY
        i.IdItem,
        i.Nombre,
        i.StockMinimo,
        i.UnidadMedida,
        pv.RazonSocial
      HAVING StockActual <= i.StockMinimo
      ORDER BY StockActual ASC, i.Nombre ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error al listar alertas:", error);
    res.status(500).json({ error: "Error al listar alertas" });
  }
});

/* =========================
   LOTES DISPONIBLES PARA VENTA
========================= */

app.get("/api/lotes-disponibles", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        l.IdLote,
        l.NumeroLote,
        l.StockActual AS StockFisico,
        GREATEST(l.StockActual - COALESCE(reservado.StockReservado, 0), 0) AS StockActual,
        COALESCE(reservado.StockReservado, 0) AS StockReservado,
        l.FechaVencimiento,
        i.IdItem,
        i.CodigoBarras,
        i.Nombre AS Producto,
        i.PrecioVenta,
        i.UnidadMedida AS UnidadMinima,
        m.Nombre AS Marca,
        pr.Nombre AS Presentacion
      FROM LT_Lote l
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
      INNER JOIN MA_Marca m ON i.IdMarca = m.IdMarca
      INNER JOIN PR_Presentacion pr ON i.IdPresentacion = pr.IdPresentacion
      LEFT JOIN (
        SELECT
          dv.IdLote,
          SUM(dv.CantidadUnidadesMinimas) AS StockReservado
        FROM DV_DetalleVenta dv
        INNER JOIN VE_Venta v ON dv.IdVenta = v.IdVenta
        INNER JOIN EV_EstadoVenta ev ON v.IdEstadoVenta = ev.IdEstadoVenta
        WHERE v.Estado = 'A'
          AND ev.Codigo = 'PEN'
        GROUP BY dv.IdLote
      ) reservado ON reservado.IdLote = l.IdLote
      WHERE l.Estado = 'A'
        AND i.Estado = 'A'
        AND GREATEST(l.StockActual - COALESCE(reservado.StockReservado, 0), 0) > 0
      ORDER BY i.Nombre ASC
    `);

    const unidadesPorItem = await obtenerUnidadesVentaPorItems(pool, rows.map((lote) => lote.IdItem));
    const lotes = rows.map((lote) => {
      const producto = {
        IdItem: lote.IdItem,
        UnidadMedida: lote.UnidadMinima,
        PrecioVenta: lote.PrecioVenta,
      };

      return {
        ...lote,
        UnidadMinima: normalizarUnidadMinima(lote.UnidadMinima),
        StockActualMinimo: Number(lote.StockActual),
        UnidadesVenta: agregarUnidadesVentaAProducto(producto, unidadesPorItem).UnidadesVenta,
      };
    });


    res.json(lotes);
  } catch (error) {
    console.error("Error al listar lotes disponibles:", error);
    res.status(500).json({ error: "Error al listar lotes disponibles" });
  }
});

/* =========================
   VENTAS
========================= */

async function obtenerClienteGeneral(connection) {
  const [clientes] = await connection.query(`
    SELECT IdCliente
    FROM CL_Cliente
    WHERE CodigoCliente = 'CLI-GENERAL'
    LIMIT 1
  `);

  if (clientes.length > 0) {
    return clientes[0].IdCliente;
  }

  const [personaCliente] = await connection.query(`
    INSERT INTO PE_Persona
    (Nombres, Apellidos, TipoDocumento, NumeroDocumento, Telefono, Correo, Direccion)
    VALUES ('Cliente', 'General', 'DNI', '00000000', '', '', '')
  `);

  const [cliente] = await connection.query(
    `
    INSERT INTO CL_Cliente
    (IdPersona, CodigoCliente)
    VALUES (?, 'CLI-GENERAL')
    `,
    [personaCliente.insertId]
  );

  return cliente.insertId;
}

function separarNombreCliente(nombreCompleto) {
  const partes = String(nombreCompleto || "").trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) {
    return {
      nombres: "Cliente",
      apellidos: "Sin nombre",
    };
  }

  if (partes.length === 1) {
    return {
      nombres: partes[0],
      apellidos: "Sin apellidos",
    };
  }

  return {
    nombres: partes.slice(0, -1).join(" "),
    apellidos: partes.slice(-1).join(" "),
  };
}

async function crearClienteDesdePersona(connection, idPersona) {
  const [cliente] = await connection.query(
    `
    INSERT INTO CL_Cliente
    (IdPersona)
    VALUES (?)
    `,
    [idPersona]
  );

  await connection.query(
    `
    UPDATE CL_Cliente
    SET CodigoCliente = CONCAT('CLI', IdCliente)
    WHERE IdCliente = ?
    `,
    [cliente.insertId]
  );

  return cliente.insertId;
}

async function obtenerOCrearClienteVenta(connection, datosCliente = {}) {
  datosCliente = datosCliente || {};

  const numeroDocumento = String(datosCliente.numeroDocumento || datosCliente.dni || "").trim();
  const tipoDocumento = String(datosCliente.tipoDocumento || (numeroDocumento ? "DNI" : "")).trim() || null;
  const nombre = limpiarTexto(datosCliente.nombre || datosCliente.nombreCliente);

  if (!numeroDocumento && !nombre) {
    return obtenerClienteGeneral(connection);
  }

  if (numeroDocumento) {
    const [clientesDocumento] = await connection.query(
      `
      SELECT c.IdCliente
      FROM CL_Cliente c
      INNER JOIN PE_Persona p ON c.IdPersona = p.IdPersona
      WHERE p.NumeroDocumento = ?
      LIMIT 1
      `,
      [numeroDocumento]
    );

    if (clientesDocumento.length > 0) {
      return clientesDocumento[0].IdCliente;
    }

    const [personasDocumento] = await connection.query(
      `
      SELECT IdPersona
      FROM PE_Persona
      WHERE NumeroDocumento = ?
      LIMIT 1
      `,
      [numeroDocumento]
    );

    if (personasDocumento.length > 0) {
      return crearClienteDesdePersona(connection, personasDocumento[0].IdPersona);
    }
  }

  if (!numeroDocumento && nombre) {
    const [clientesNombre] = await connection.query(
      `
      SELECT c.IdCliente
      FROM CL_Cliente c
      INNER JOIN PE_Persona p ON c.IdPersona = p.IdPersona
      WHERE p.NumeroDocumento IS NULL
        AND CONCAT(p.Nombres, ' ', p.Apellidos) = ?
      LIMIT 1
      `,
      [nombre]
    );

    if (clientesNombre.length > 0) {
      return clientesNombre[0].IdCliente;
    }
  }

  const { nombres, apellidos } = separarNombreCliente(nombre);
  const [personaCliente] = await connection.query(
    `
    INSERT INTO PE_Persona
    (Nombres, Apellidos, TipoDocumento, NumeroDocumento, Telefono, Correo, Direccion)
    VALUES (?, ?, ?, ?, '', '', '')
    `,
    [nombres, apellidos, tipoDocumento, numeroDocumento || null]
  );

  return crearClienteDesdePersona(connection, personaCliente.insertId);
}

async function obtenerDatosVentaBasicos(connection, cliente) {
  const idCliente = await obtenerOCrearClienteVenta(connection, cliente);
  const idEstadoVenta = await obtenerEstadoVentaId(connection, "PEN");

  return { idCliente, idEstadoVenta };
}

async function obtenerStockReservadoPendiente(connection, idLote, idVentaExcluir = null) {
  const parametros = [idLote];
  const excluir = idVentaExcluir ? "AND v.IdVenta <> ?" : "";

  if (idVentaExcluir) {
    parametros.push(idVentaExcluir);
  }

  const [rows] = await connection.query(
    `
    SELECT COALESCE(SUM(dv.CantidadUnidadesMinimas), 0) AS Reservado
    FROM DV_DetalleVenta dv
    INNER JOIN VE_Venta v ON dv.IdVenta = v.IdVenta
    INNER JOIN EV_EstadoVenta ev ON v.IdEstadoVenta = ev.IdEstadoVenta
    WHERE dv.IdLote = ?
      AND v.Estado = 'A'
      AND ev.Codigo = 'PEN'
      ${excluir}
    `,
    parametros
  );

  return Number(rows[0]?.Reservado || 0);
}

app.get("/api/ventas", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        v.IdVenta,
        v.NumeroVenta,
        v.FechaVenta,
        v.Subtotal,
        v.Igv,
        v.Total,
        v.TipoComprobante,
        v.Serie,
        v.NumeroComprobante,
        ev.Codigo AS CodigoEstadoVenta,
        ev.Nombre AS EstadoVenta,
        pg.NumeroPago,
        pg.EstadoPago,
        tp.Nombre AS TipoPago,
        CONCAT(pc.Nombres, ' ', pc.Apellidos) AS Cliente,
        pc.NumeroDocumento AS DocumentoCliente,
        u.Username AS Usuario
      FROM VE_Venta v
      INNER JOIN CL_Cliente c ON v.IdCliente = c.IdCliente
      INNER JOIN PE_Persona pc ON c.IdPersona = pc.IdPersona
      INNER JOIN US_Usuario u ON v.IdUsuario = u.IdUsuario
      INNER JOIN EV_EstadoVenta ev ON v.IdEstadoVenta = ev.IdEstadoVenta
      LEFT JOIN PG_Pago pg ON v.IdVenta = pg.IdVenta
        AND pg.EstadoPago = 'PAGADO'
      LEFT JOIN DP_DetallePago dp ON pg.IdPago = dp.IdPago
      LEFT JOIN TP_TipoPago tp ON dp.IdTipoPago = tp.IdTipoPago
      WHERE v.Estado = 'A'
      ORDER BY v.IdVenta DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error al listar ventas:", error);
    res.status(500).json({ error: "Error al listar ventas" });
  }
});

app.get("/api/ventas/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const [ventaRows] = await pool.query(
      `
      SELECT *
      FROM VE_Venta
      WHERE IdVenta = ?
      `,
      [id]
    );

    if (ventaRows.length === 0) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    const [detalles] = await pool.query(
      `
      SELECT
        dv.IdDetalleVenta,
        dv.IdLote,
        dv.IdUnidadVenta,
        i.Nombre AS Producto,
        l.NumeroLote,
        dv.Cantidad,
        COALESCE(uv.Nombre, dv.UnidadVenta, i.UnidadMedida, 'UND') AS UnidadVenta,
        dv.FactorConversion,
        dv.CantidadUnidadesMinimas,
        dv.PrecioUnitario,
        dv.Descuento,
        dv.Subtotal
      FROM DV_DetalleVenta dv
      INNER JOIN LT_Lote l ON dv.IdLote = l.IdLote
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
      LEFT JOIN UV_UnidadVenta uv ON dv.IdUnidadVenta = uv.IdUnidadVenta
      WHERE dv.IdVenta = ?
      `,
      [id]
    );

    res.json({
      venta: ventaRows[0],
      detalles,
    });
  } catch (error) {
    console.error("Error al obtener venta:", error);
    res.status(500).json({ error: "Error al obtener venta" });
  }
});

app.post("/api/ventas", async (req, res) => {
  const { cliente, tipoComprobante, serie, numeroComprobante, observacion, detalles } = req.body;

  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ error: "La venta debe tener al menos un producto" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const tipoComprobanteFinal = normalizarTipoComprobante(tipoComprobante);
    const serieFinal = normalizarSerieComprobante(tipoComprobanteFinal, serie);
    const numeroComprobanteManual = normalizarNumeroComprobanteManual(numeroComprobante);
    const clienteNormalizado = normalizarClienteVentaPayload(cliente, tipoComprobanteFinal);
    const { idCliente, idEstadoVenta } = await obtenerDatosVentaBasicos(connection, clienteNormalizado);
    const idUsuario = req.usuario.idUsuario;
    const numeroVenta = `V${Date.now().toString().slice(-9)}`;
    const numeroComprobanteFinal = numeroComprobanteManual
      ? numeroComprobanteManual
      : await generarNumeroComprobanteVenta(connection, tipoComprobanteFinal, serieFinal);
    const documentoVenta = construirDocumentoVenta(tipoComprobanteFinal, serieFinal, numeroComprobanteFinal);
    const lotesBloqueados = new Map();
    const detallesPreparados = [];

    let total = 0;

    for (const detalle of detalles) {
      const idLoteDetalle = parseInt(detalle.idLote);
      const idUnidadVenta = detalle.idUnidadVenta ? parseInt(detalle.idUnidadVenta) : null;
      const cantidadDetalle = parseInt(detalle.cantidad);
      const descuento = detalle.descuento ? parseFloat(detalle.descuento) : 0;

      if (!idLoteDetalle || Number.isNaN(cantidadDetalle) || cantidadDetalle <= 0) {
        throw new Error("La cantidad de venta debe ser mayor a 0");
      }

      if (!lotesBloqueados.has(idLoteDetalle)) {
        const [lotes] = await connection.query(
          `
          SELECT
            l.StockActual,
            l.CostoCompraLote,
            l.IdItem,
            i.PrecioVenta,
            i.UnidadMedida
          FROM LT_Lote l
          INNER JOIN IT_Item i ON l.IdItem = i.IdItem
          WHERE l.IdLote = ?
            AND l.Estado = 'A'
            AND i.Estado = 'A'
          FOR UPDATE
          `,
          [idLoteDetalle]
        );

        if (lotes.length === 0) {
          throw new Error("Uno de los lotes no existe");
        }

        const stockReservado = await obtenerStockReservadoPendiente(connection, idLoteDetalle);

        lotesBloqueados.set(idLoteDetalle, {
          stockAnterior: Number(lotes[0].StockActual),
          stockReservado,
          costoUnitario: lotes[0].CostoCompraLote,
          idItem: lotes[0].IdItem,
          precioVenta: lotes[0].PrecioVenta,
          unidadMedida: lotes[0].UnidadMedida,
          cantidadTotal: 0,
          cantidadProcesada: 0,
        });
      }

      const loteBloqueado = lotesBloqueados.get(idLoteDetalle);
      const unidadVenta = await obtenerUnidadVentaParaDetalle(
        connection,
        loteBloqueado.idItem,
        idUnidadVenta,
        {
          IdItem: loteBloqueado.idItem,
          PrecioVenta: loteBloqueado.precioVenta,
          UnidadMedida: loteBloqueado.unidadMedida,
        }
      );
      const cantidadUnidadesMinimas = cantidadDetalle * unidadVenta.factorConversion;
      const precioUnitario = detalle.precioUnitario === undefined || detalle.precioUnitario === null || detalle.precioUnitario === ""
        ? unidadVenta.precioVenta
        : parseFloat(detalle.precioUnitario);

      if (Number.isNaN(precioUnitario) || precioUnitario <= 0) {
        throw new Error("El precio unitario debe ser mayor a 0");
      }

      if (Number.isNaN(descuento) || descuento < 0) {
        throw new Error("El descuento no puede ser negativo");
      }

      loteBloqueado.cantidadTotal += cantidadUnidadesMinimas;

      const stockDisponible = loteBloqueado.stockAnterior - loteBloqueado.stockReservado;

      if (stockDisponible < loteBloqueado.cantidadTotal) {
        throw new Error("Stock disponible insuficiente para uno de los productos");
      }

      const subtotalDetalle = redondearMoneda(cantidadDetalle * precioUnitario - descuento);

      if (subtotalDetalle < 0) {
        throw new Error("El descuento no puede superar el subtotal del producto");
      }

      detallesPreparados.push({
        idLoteDetalle,
        idUnidadVenta: unidadVenta.idUnidadVenta,
        unidadVenta: unidadVenta.nombre,
        cantidadDetalle,
        factorConversion: unidadVenta.factorConversion,
        cantidadUnidadesMinimas,
        precioUnitario,
        descuento,
        subtotalDetalle,
      });

      total = redondearMoneda(total + subtotalDetalle);
    }

    const subtotal = redondearMoneda(total / 1.18);
    const igv = redondearMoneda(total - subtotal);

    const [ventaResult] = await connection.query(
      `
      INSERT INTO VE_Venta
      (
        NumeroVenta, IdCliente, IdUsuario, IdEstadoVenta,
        Subtotal, Igv, Total, TipoComprobante, Serie,
        NumeroComprobante, Moneda, Observacion
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PEN', ?)
      `,
      [
        numeroVenta,
        idCliente,
        idUsuario,
        idEstadoVenta,
        subtotal,
        igv,
        total,
        tipoComprobanteFinal,
        serieFinal,
        numeroComprobanteFinal,
        observacion || "",
      ]
    );

    const idVenta = ventaResult.insertId;

    for (const detalle of detallesPreparados) {
      const idLoteDetalle = detalle.idLoteDetalle;

      await connection.query(
        `
        INSERT INTO DV_DetalleVenta
        (
          IdVenta, IdLote, IdUnidadVenta, Cantidad, UnidadVenta,
          FactorConversion, CantidadUnidadesMinimas,
          PrecioUnitario, Descuento, Subtotal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idVenta,
          idLoteDetalle,
          detalle.idUnidadVenta,
          detalle.cantidadDetalle,
          detalle.unidadVenta,
          detalle.factorConversion,
          detalle.cantidadUnidadesMinimas,
          detalle.precioUnitario,
          detalle.descuento,
          detalle.subtotalDetalle,
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      mensaje: "Pedido generado correctamente",
      idVenta,
      numeroVenta,
      documento: documentoVenta,
      tipoComprobante: tipoComprobanteFinal,
      serie: serieFinal,
      numeroComprobante: numeroComprobanteFinal,
      total,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al registrar venta:", error.message);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "El numero de comprobante ya existe" });
    }

    res.status(error.statusCode || 400).json({ error: error.message || "Error al registrar venta" });
  } finally {
    connection.release();
  }
});

app.post("/api/ventas/:id/pagar", async (req, res) => {
  const idVenta = parseInt(req.params.id);
  const { idTipoPago, codigoTipoPago, monto, referencia } = req.body;

  if (!idVenta || Number.isNaN(idVenta)) {
    return res.status(400).json({ error: "Pedido no valido" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [ventas] = await connection.query(
      `
      SELECT
        v.*,
        ev.Codigo AS CodigoEstadoVenta
      FROM VE_Venta v
      INNER JOIN EV_EstadoVenta ev ON v.IdEstadoVenta = ev.IdEstadoVenta
      WHERE v.IdVenta = ?
        AND v.Estado = 'A'
      FOR UPDATE
      `,
      [idVenta]
    );

    if (ventas.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const venta = ventas[0];

    if (venta.CodigoEstadoVenta === "PAG") {
      await connection.rollback();
      return res.status(409).json({ error: "Este pedido ya fue pagado" });
    }

    if (venta.CodigoEstadoVenta === "ANU") {
      await connection.rollback();
      return res.status(409).json({ error: "No se puede pagar un pedido anulado" });
    }

    if (venta.CodigoEstadoVenta !== "PEN") {
      await connection.rollback();
      return res.status(409).json({ error: "Solo se pueden pagar pedidos pendientes" });
    }

    const [pagosExistentes] = await connection.query(
      `
      SELECT IdPago
      FROM PG_Pago
      WHERE IdVenta = ?
        AND EstadoPago = 'PAGADO'
      LIMIT 1
      `,
      [idVenta]
    );

    if (pagosExistentes.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: "Este pedido ya tiene un pago registrado" });
    }

    const montoTotal = Number(venta.Total || 0);
    const montoRecibido = monto === undefined || monto === null || monto === ""
      ? montoTotal
      : Number(monto);

    if (montoTotal <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: "El total del pedido debe ser mayor a 0" });
    }

    if (Number.isNaN(montoRecibido) || montoRecibido <= 0 || montoRecibido < montoTotal) {
      await connection.rollback();
      return res.status(400).json({ error: "El monto recibido no puede ser menor al total del pedido" });
    }

    const [detalles] = await connection.query(
      `
      SELECT
        dv.IdDetalleVenta,
        dv.IdLote,
        dv.IdUnidadVenta,
        dv.Cantidad,
        dv.UnidadVenta,
        dv.FactorConversion,
        dv.CantidadUnidadesMinimas,
        dv.PrecioUnitario,
        dv.Subtotal,
        l.StockActual,
        l.CostoCompraLote
      FROM DV_DetalleVenta dv
      INNER JOIN LT_Lote l ON dv.IdLote = l.IdLote
      WHERE dv.IdVenta = ?
      ORDER BY dv.IdDetalleVenta ASC
      FOR UPDATE
      `,
      [idVenta]
    );

    if (detalles.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "El pedido no tiene productos" });
    }

    const idEstadoPagado = await obtenerEstadoVentaId(connection, "PAG");
    const tipoPagoSeleccionado = await obtenerTipoPago(connection, idTipoPago, codigoTipoPago);
    const numeroPago = await generarNumeroPago(connection);
    const documentoVenta = construirDocumentoVenta(venta.TipoComprobante, venta.Serie, venta.NumeroComprobante);
    const referenciaLimpia = limpiarTexto(referencia);

    if (TIPOS_PAGO_CON_REFERENCIA.has(tipoPagoSeleccionado.Codigo) && !referenciaLimpia) {
      await connection.rollback();
      return res.status(400).json({ error: "La referencia es obligatoria para este metodo de pago" });
    }

    if (tipoPagoSeleccionado.Codigo !== "EFE" && Math.abs(montoRecibido - montoTotal) > 0.009) {
      await connection.rollback();
      return res.status(400).json({ error: "Los pagos digitales o con tarjeta deben coincidir exactamente con el total" });
    }

    const stockProcesadoPorLote = new Map();

    for (const detalle of detalles) {
      const cantidadSalida = Number(detalle.CantidadUnidadesMinimas || 0);
      const stockAnteriorBase = Number(detalle.StockActual || 0);
      const stockYaProcesado = Number(stockProcesadoPorLote.get(detalle.IdLote) || 0);
      const stockAnterior = stockAnteriorBase - stockYaProcesado;
      const stockNuevo = stockAnterior - cantidadSalida;

      if (cantidadSalida <= 0) {
        throw new Error("El detalle del pedido tiene una cantidad invalida");
      }

      if (stockNuevo < 0) {
        throw new Error("Stock insuficiente para pagar el pedido");
      }

      const [stockResult] = await connection.query(
        `
        UPDATE LT_Lote
        SET StockActual = StockActual - ?
        WHERE IdLote = ?
          AND StockActual >= ?
        `,
        [cantidadSalida, detalle.IdLote, cantidadSalida]
      );

      if (stockResult.affectedRows === 0) {
        throw crearErrorValidacion("Stock insuficiente para pagar el pedido");
      }

      await registrarMovimientoInventario(connection, {
        idLote: detalle.IdLote,
        idUsuario: req.usuario.idUsuario,
        tipoMovimiento: "SALIDA",
        tipoDocumento: "VENTA",
        numeroDocumento: documentoVenta,
        tablaReferencia: "VE_Venta",
        idReferencia: idVenta,
        cantidadSalida,
        stockAnterior,
        stockNuevo,
        costoUnitario: detalle.CostoCompraLote,
        motivo: `Salida por pago de pedido ${venta.NumeroVenta} (${detalle.Cantidad} ${detalle.UnidadVenta || "UND"})`,
      });

      stockProcesadoPorLote.set(detalle.IdLote, stockYaProcesado + cantidadSalida);
    }

    await connection.query(
      `
      UPDATE VE_Venta
      SET IdEstadoVenta = ?
      WHERE IdVenta = ?
      `,
      [idEstadoPagado, idVenta]
    );

    const [pagoResult] = await connection.query(
      `
      INSERT INTO PG_Pago (NumeroPago, IdVenta, MontoTotal, EstadoPago)
      VALUES (?, ?, ?, 'PAGADO')
      `,
      [numeroPago, idVenta, montoTotal]
    );

    await connection.query(
      `
      INSERT INTO DP_DetallePago (IdPago, IdTipoPago, Monto, Referencia)
      VALUES (?, ?, ?, ?)
      `,
      [
        pagoResult.insertId,
        tipoPagoSeleccionado.IdTipoPago,
        montoTotal,
        referenciaLimpia || `Pago de ${documentoVenta}`,
      ]
    );

    await connection.commit();

    res.json({
      mensaje: "Pedido pagado correctamente",
      idPago: pagoResult.insertId,
      numeroPago,
      documento: documentoVenta,
      vuelto: montoRecibido - montoTotal,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al pagar pedido:", error.message);
    res.status(error.statusCode || 400).json({ error: error.message || "Error al pagar pedido" });
  } finally {
    connection.release();
  }
});

app.post("/api/ventas/:id/anular", async (req, res) => {
  const idVenta = parseInt(req.params.id);
  const { motivo } = req.body || {};
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [ventas] = await connection.query(
      `
      SELECT
        v.IdVenta,
        v.Observacion,
        ev.Codigo AS CodigoEstadoVenta
      FROM VE_Venta v
      INNER JOIN EV_EstadoVenta ev ON v.IdEstadoVenta = ev.IdEstadoVenta
      WHERE v.IdVenta = ?
        AND v.Estado = 'A'
      FOR UPDATE
      `,
      [idVenta]
    );

    if (ventas.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const venta = ventas[0];

    if (venta.CodigoEstadoVenta === "PAG") {
      await connection.rollback();
      return res.status(409).json({ error: "No se puede anular un pedido pagado desde este flujo" });
    }

    if (venta.CodigoEstadoVenta === "ANU") {
      await connection.rollback();
      return res.status(409).json({ error: "El pedido ya esta anulado" });
    }

    const idEstadoAnulado = await obtenerEstadoVentaId(connection, "ANU");
    const observacionAnulada = [venta.Observacion, motivo ? `Anulado: ${motivo}` : "Anulado antes del pago"]
      .filter(Boolean)
      .join(" | ");

    await connection.query(
      `
      UPDATE VE_Venta
      SET
        IdEstadoVenta = ?,
        Observacion = ?
      WHERE IdVenta = ?
      `,
      [idEstadoAnulado, observacionAnulada, idVenta]
    );

    await connection.commit();

    res.json({ mensaje: "Pedido anulado correctamente" });
  } catch (error) {
    await connection.rollback();
    console.error("Error al anular pedido:", error.message);
    res.status(500).json({ error: error.message || "Error al anular pedido" });
  } finally {
    connection.release();
  }
});

async function responderDocumentoKardex(req, res) {
  const idMovimiento = parseInt(req.params.id);

  try {
    const [movimientos] = await pool.query(
      `
      SELECT
        m.IdMovimiento,
        m.TablaReferencia,
        m.IdReferencia,
        m.FechaMovimiento,
        m.NumeroDocumento,
        m.CantidadEntrada,
        m.CantidadSalida,
        m.StockAnterior,
        m.StockNuevo,
        m.CostoUnitario,
        m.ValorMovimiento,
        m.Motivo,
        tm.Codigo AS CodigoMovimiento,
        tm.Nombre AS TipoMovimiento,
        td.Codigo AS CodigoDocumento,
        td.Nombre AS TipoDocumento,
        i.Nombre AS Producto,
        i.UnidadMedida AS UnidadMinima,
        l.NumeroLote,
        u.Username AS Usuario
      FROM MI_MovimientoInventario m
      INNER JOIN LT_Lote l ON m.IdLote = l.IdLote
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
      INNER JOIN TM_TipoMovimiento tm ON m.IdTipoMovimiento = tm.IdTipoMovimiento
      INNER JOIN TD_TipoDocumento td ON m.IdTipoDocumento = td.IdTipoDocumento
      LEFT JOIN US_Usuario u ON m.IdUsuario = u.IdUsuario
      WHERE m.IdMovimiento = ?
      LIMIT 1
      `,
      [idMovimiento]
    );

    if (movimientos.length === 0) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }

    const movimiento = movimientos[0];
    let documento = null;
    let detalles = [];

    if (movimiento.TablaReferencia === "VE_Venta" && movimiento.IdReferencia) {
      const [ventas] = await pool.query(
        `
        SELECT
          v.IdVenta,
          v.NumeroVenta,
          v.FechaVenta,
          v.TipoComprobante,
          v.Serie,
          v.NumeroComprobante,
          v.Subtotal,
          v.Igv,
          v.Total,
          v.Observacion,
          ev.Nombre AS EstadoVenta,
          CONCAT(pc.Nombres, ' ', pc.Apellidos) AS Cliente,
          pc.NumeroDocumento AS DocumentoCliente,
          u.Username AS Usuario
        FROM VE_Venta v
        INNER JOIN EV_EstadoVenta ev ON v.IdEstadoVenta = ev.IdEstadoVenta
        INNER JOIN CL_Cliente c ON v.IdCliente = c.IdCliente
        INNER JOIN PE_Persona pc ON c.IdPersona = pc.IdPersona
        INNER JOIN US_Usuario u ON v.IdUsuario = u.IdUsuario
        WHERE v.IdVenta = ?
        LIMIT 1
        `,
        [movimiento.IdReferencia]
      );

      documento = ventas[0] || null;

      const [detalleVenta] = await pool.query(
        `
        SELECT
          i.Nombre AS Producto,
          l.NumeroLote,
          dv.Cantidad,
          COALESCE(uv.Nombre, dv.UnidadVenta, i.UnidadMedida, 'UND') AS UnidadVenta,
          dv.FactorConversion,
          dv.CantidadUnidadesMinimas,
          dv.PrecioUnitario,
          dv.Descuento,
          dv.Subtotal
        FROM DV_DetalleVenta dv
        INNER JOIN LT_Lote l ON dv.IdLote = l.IdLote
        INNER JOIN IT_Item i ON l.IdItem = i.IdItem
        LEFT JOIN UV_UnidadVenta uv ON dv.IdUnidadVenta = uv.IdUnidadVenta
        WHERE dv.IdVenta = ?
        ORDER BY dv.IdDetalleVenta ASC
        `,
        [movimiento.IdReferencia]
      );

      detalles = detalleVenta;
    } else if (movimiento.TablaReferencia === "LT_Lote" && movimiento.IdReferencia) {
      const [lotes] = await pool.query(
        `
        SELECT
          l.IdLote,
          l.NumeroLote,
          l.FechaIngreso,
          l.FechaVencimiento,
          l.CostoCompraLote,
          l.StockActual,
          i.Nombre AS Producto,
          i.UnidadMedida AS UnidadMinima,
          pv.RazonSocial AS Proveedor
        FROM LT_Lote l
        INNER JOIN IT_Item i ON l.IdItem = i.IdItem
        LEFT JOIN PV_Proveedor pv ON i.IdProveedor = pv.IdProveedor
        WHERE l.IdLote = ?
        LIMIT 1
        `,
        [movimiento.IdReferencia]
      );

      documento = lotes[0] || null;
    }

    res.json({
      movimiento,
      documento,
      detalles,
    });
  } catch (error) {
    console.error("Error al obtener documento de Kardex:", error);
    res.status(500).json({ error: "Error al obtener documento de Kardex" });
  }
}

app.get("/api/kardex/:id/documento", responderDocumentoKardex);
app.get("/api/kardex/documento/:id", responderDocumentoKardex);

/* =========================
   KARDEX / MOVIMIENTOS DE INVENTARIO
========================= */

app.get("/api/kardex", async (req, res) => {
  const { idLote, idItem, tipoMovimiento, tipoDocumento, fechaDesde, fechaHasta } = req.query;
  const condiciones = [];
  const parametros = [];

  if (idLote) {
    condiciones.push("m.IdLote = ?");
    parametros.push(parseInt(idLote));
  }

  if (idItem) {
    condiciones.push("l.IdItem = ?");
    parametros.push(parseInt(idItem));
  }

  if (tipoMovimiento) {
    condiciones.push("tm.Codigo = ?");
    parametros.push(normalizarCodigoDocumento(tipoMovimiento));
  }

  if (tipoDocumento) {
    condiciones.push("td.Codigo = ?");
    parametros.push(normalizarCodigoDocumento(tipoDocumento));
  }

  if (fechaDesde) {
    condiciones.push("DATE(m.FechaMovimiento) >= ?");
    parametros.push(fechaDesde);
  }

  if (fechaHasta) {
    condiciones.push("DATE(m.FechaMovimiento) <= ?");
    parametros.push(fechaHasta);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  try {
    const [rows] = await pool.query(
      `
      SELECT
        m.IdMovimiento,
        m.TablaReferencia,
        m.IdReferencia,
        m.FechaMovimiento,
        i.IdItem,
        i.Nombre AS Producto,
        i.UnidadMedida AS UnidadMinima,
        l.IdLote,
        l.NumeroLote,
        tm.Codigo AS CodigoMovimiento,
        tm.Nombre AS TipoMovimiento,
        td.Codigo AS CodigoDocumento,
        td.Nombre AS TipoDocumento,
        m.NumeroDocumento,
        CASE
          WHEN td.Codigo = 'VENTA' THEN COALESCE(v.TipoComprobante, 'Venta')
          WHEN td.Codigo = 'LOTE' THEN 'Ingreso de lote'
          WHEN td.Codigo = 'AJUSTE' THEN 'Ajuste de inventario'
          ELSE td.Nombre
        END AS DocumentoTipo,
        CASE
          WHEN td.Codigo = 'VENTA' THEN v.Serie
          ELSE NULL
        END AS DocumentoSerie,
        CASE
          WHEN td.Codigo = 'VENTA' THEN v.NumeroComprobante
          WHEN td.Codigo = 'LOTE' THEN lr.NumeroLote
          ELSE m.NumeroDocumento
        END AS DocumentoNumero,
        CASE
          WHEN td.Codigo = 'VENTA' THEN CONCAT(v.TipoComprobante, ' ', v.Serie, '-', v.NumeroComprobante)
          WHEN td.Codigo = 'LOTE' THEN CONCAT('Lote ', lr.NumeroLote)
          WHEN td.Codigo = 'AJUSTE' THEN COALESCE(m.NumeroDocumento, CONCAT('Ajuste #', m.IdMovimiento))
          ELSE COALESCE(m.NumeroDocumento, '-')
        END AS DocumentoCompleto,
        v.NumeroVenta,
        v.TipoComprobante,
        v.Serie,
        v.NumeroComprobante,
        v.Total AS TotalDocumento,
        m.CantidadEntrada,
        m.CantidadSalida,
        m.StockAnterior,
        m.StockNuevo,
        m.CostoUnitario,
        m.ValorMovimiento,
        m.Motivo,
        u.Username AS Usuario
      FROM MI_MovimientoInventario m
      INNER JOIN LT_Lote l ON m.IdLote = l.IdLote
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
      INNER JOIN TM_TipoMovimiento tm ON m.IdTipoMovimiento = tm.IdTipoMovimiento
      INNER JOIN TD_TipoDocumento td ON m.IdTipoDocumento = td.IdTipoDocumento
      LEFT JOIN US_Usuario u ON m.IdUsuario = u.IdUsuario
      LEFT JOIN VE_Venta v ON m.TablaReferencia = 'VE_Venta'
        AND m.IdReferencia = v.IdVenta
      LEFT JOIN LT_Lote lr ON m.TablaReferencia = 'LT_Lote'
        AND m.IdReferencia = lr.IdLote
      ${where}
      ORDER BY m.FechaMovimiento DESC, m.IdMovimiento DESC
      LIMIT 300
      `,
      parametros
    );

    res.json(rows);
  } catch (error) {
    console.error("Error al listar kardex:", error);
    res.status(500).json({ error: "Error al listar kardex" });
  }
});

asegurarDatosIniciales()
  .catch((error) => {
    console.error("No se pudieron asegurar los datos iniciales:", error.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
      console.log("Usuarios iniciales: admin/123456 y cajero/123456");
    });
  });
