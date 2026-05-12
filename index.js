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
    ruta.startsWith("/alertas") ||
    ruta.startsWith("/chatbot")
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

async function asegurarUsuarioInicial(username, password, rol, nombres, apellidos, numeroDocumento) {
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
        VALUES (?, ?, 'DNI', ?, '', '', '')
        `,
        [nombres, apellidos, numeroDocumento]
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
  await asegurarUsuarioInicial("admin", "123456", "ADMIN", "Administrador", "Sistema", "11111111");
  await asegurarUsuarioInicial("cajero", "123456", "CAJERO", "Cajero", "Ventas", "22222222");
}

const NOMBRES_TIPO_MOVIMIENTO = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
};

const NOMBRES_TIPO_DOCUMENTO = {
  LOTE: "Registro de lote",
  VENTA: "Venta",
  AJUSTE: "Ajuste de stock",
};

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

async function registrarMovimientoInventario(connection, movimiento) {
  const cantidadEntrada = Number(movimiento.cantidadEntrada || 0);
  const cantidadSalida = Number(movimiento.cantidadSalida || 0);
  const costoUnitario = movimiento.costoUnitario === undefined || movimiento.costoUnitario === null
    ? null
    : Number(movimiento.costoUnitario);
  const cantidadMovimiento = cantidadEntrada > 0 ? cantidadEntrada : cantidadSalida;
  const valorMovimiento = costoUnitario === null ? null : costoUnitario * cantidadMovimiento;
  const idTipoMovimiento = await obtenerTipoMovimientoId(connection, movimiento.tipoMovimiento);
  const idTipoDocumento = await obtenerTipoDocumentoId(connection, movimiento.tipoDocumento);

  await connection.query(
    `
    INSERT INTO MI_MovimientoInventario
    (
      IdLote, IdUsuario, IdTipoMovimiento, IdTipoDocumento,
      NumeroDocumento, TablaReferencia, IdReferencia,
      CantidadEntrada, CantidadSalida, StockAnterior, StockNuevo,
      CostoUnitario, ValorMovimiento, MetodoCosto, Motivo
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      movimiento.idLote,
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

async function agregarColumnaSiNoExiste(connection, tabla, columna, definicion) {
  if (await columnaExiste(connection, tabla, columna)) {
    return;
  }

  await connection.query(`ALTER TABLE ${tabla} ADD COLUMN ${definicion}`);
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
      SET CantidadUnidadesMinimas = Cantidad
      WHERE CantidadUnidadesMinimas IS NULL OR CantidadUnidadesMinimas = 0
    `);

    if (!(await constraintExiste(connection, "DV_DetalleVenta", "FK_DV_UnidadVenta"))) {
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

async function asegurarDatosIniciales() {
  await asegurarEsquemaUnidadesVenta();
  await asegurarUsuariosIniciales();
  await asegurarCatalogosInventario();
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
  { ruta: "/chatbot.html", archivo: "chatbot.html", roles: ["ADMIN", "CAJERO"] },
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
        pe.Correo,
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
        pe.Correo,
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
  const {
    nombres,
    apellidos,
    tipoDocumento,
    numeroDocumento,
    telefono,
    correo,
    direccion,
    razonSocial,
    ruc,
  } = req.body;

  if (!nombres || !apellidos || !razonSocial || !ruc) {
    return res.status(400).json({
      error: "Nombres, apellidos, razón social y RUC son obligatorios",
    });
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
        nombres,
        apellidos,
        tipoDocumento,
        numeroDocumento,
        telefono,
        correo,
        direccion,
      ]
    );

    const idPersona = personaResult.insertId;

    const [proveedorResult] = await connection.query(
      `
      INSERT INTO PV_Proveedor
      (IdPersona, RazonSocial, Ruc)
      VALUES (?, ?, ?)
      `,
      [idPersona, razonSocial, ruc]
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

  const {
    idPersona,
    nombres,
    apellidos,
    tipoDocumento,
    numeroDocumento,
    telefono,
    correo,
    direccion,
    razonSocial,
    ruc,
  } = req.body;

  if (!idPersona) {
    return res.status(400).json({ error: "IdPersona es obligatorio" });
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
        nombres,
        apellidos,
        tipoDocumento,
        numeroDocumento,
        telefono,
        correo,
        direccion,
        idPersona,
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
      [razonSocial, ruc, idProveedor]
    );

    await connection.commit();

    res.json({ mensaje: "Proveedor actualizado correctamente" });
  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar proveedor:", error);
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

  if (!nombre || Number.isNaN(precioVentaNumero) || precioVentaNumero <= 0 || !idCategoria || !idMarca || !idPresentacion) {
    return res.status(400).json({
      error: "Nombre, precio venta, categoría, marca y presentación son obligatorios",
    });
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
        codigo,
        codigoBarras,
        nombre,
        descripcion,
        precioVentaNumero,
        precioCompra,
        idCategoria,
        idMarca,
        idPresentacion,
        idProveedor || null,
        requiereReceta || "N",
        esControlado || "N",
        unidadMedida,
        stockMinimo || 0,
        usuarioRegistro || "admin",
      ]
    );

    await guardarUnidadesVentaProducto(connection, result.insertId, unidadesVenta, unidadMedida, precioVentaNumero);

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

  if (!nombre || Number.isNaN(precioVentaNumero) || precioVentaNumero <= 0 || !idCategoria || !idMarca || !idPresentacion) {
    return res.status(400).json({
      error: "Nombre, precio venta, categoría, marca y presentación son obligatorios",
    });
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
        codigo,
        codigoBarras,
        nombre,
        descripcion,
        precioVentaNumero,
        precioCompra,
        idCategoria,
        idMarca,
        idPresentacion,
        idProveedor || null,
        requiereReceta || "N",
        esControlado || "N",
        unidadMedida,
        stockMinimo || 0,
        usuarioModifica || "admin",
        id,
      ]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    await guardarUnidadesVentaProducto(connection, id, unidadesVenta, unidadMedida, precioVentaNumero);

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
  const stockInicial = parseInt(stockActual);
  const costoLote = costoCompraLote === undefined || costoCompraLote === null || costoCompraLote === ""
    ? null
    : parseFloat(costoCompraLote);

  if (!idItem || !numeroLote || stockActual === undefined) {
    return res.status(400).json({
      error: "Producto, número de lote y stock actual son obligatorios",
    });
  }

  if (Number.isNaN(stockInicial) || stockInicial < 0) {
    return res.status(400).json({
      error: "El stock actual debe ser 0 o mayor",
    });
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
        idItem,
        numeroLote,
        fechaVencimiento || null,
        fechaIngreso || null,
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
        numeroDocumento: numeroLote,
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
    res.status(500).json({ error: "Error al registrar lote" });
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
  const stockNuevo = parseInt(stockActual);
  const costoLote = costoCompraLote === undefined || costoCompraLote === null || costoCompraLote === ""
    ? null
    : parseFloat(costoCompraLote);

  if (!idItem || !numeroLote || stockActual === undefined) {
    return res.status(400).json({
      error: "Producto, número de lote y stock actual son obligatorios",
    });
  }

  if (Number.isNaN(stockNuevo) || stockNuevo < 0) {
    return res.status(400).json({
      error: "El stock actual no puede ser negativo",
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [lotesActuales] = await connection.query(
      `
      SELECT StockActual
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
        idItem,
        numeroLote,
        fechaVencimiento || null,
        fechaIngreso || null,
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
    res.status(500).json({ error: "Error al actualizar lote" });
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
        l.IdLote,
        i.Nombre AS Producto,
        l.NumeroLote,
        l.StockActual,
        i.StockMinimo,
        i.UnidadMedida AS UnidadMinima,
        pv.RazonSocial AS Proveedor
      FROM LT_Lote l
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
      LEFT JOIN PV_Proveedor pv ON i.IdProveedor = pv.IdProveedor
      WHERE l.StockActual <= i.StockMinimo
        AND l.Estado = 'A'
        AND i.Estado = 'A'
      ORDER BY l.StockActual ASC
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
        l.StockActual,
        l.FechaVencimiento,
        i.IdItem,
        i.Nombre AS Producto,
        i.PrecioVenta,
        i.UnidadMedida AS UnidadMinima,
        m.Nombre AS Marca,
        pr.Nombre AS Presentacion
      FROM LT_Lote l
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
      INNER JOIN MA_Marca m ON i.IdMarca = m.IdMarca
      INNER JOIN PR_Presentacion pr ON i.IdPresentacion = pr.IdPresentacion
      WHERE l.Estado = 'A'
        AND i.Estado = 'A'
        AND l.StockActual > 0
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

async function obtenerDatosVentaBasicos(connection) {
  let idCliente;
  let idEstadoVenta;

  const [clientes] = await connection.query(`
    SELECT IdCliente
    FROM CL_Cliente
    WHERE CodigoCliente = 'CLI-GENERAL'
    LIMIT 1
  `);

  if (clientes.length > 0) {
    idCliente = clientes[0].IdCliente;
  } else {
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

    idCliente = cliente.insertId;
  }

  const [estados] = await connection.query(`
    SELECT IdEstadoVenta
    FROM EV_EstadoVenta
    WHERE Codigo = 'REG'
    LIMIT 1
  `);

  if (estados.length > 0) {
    idEstadoVenta = estados[0].IdEstadoVenta;
  } else {
    const [estado] = await connection.query(`
      INSERT INTO EV_EstadoVenta
      (Codigo, Nombre)
      VALUES ('REG', 'Registrada')
    `);

    idEstadoVenta = estado.insertId;
  }

  return { idCliente, idEstadoVenta };
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
        v.NumeroComprobante,
        ev.Nombre AS EstadoVenta,
        CONCAT(pc.Nombres, ' ', pc.Apellidos) AS Cliente,
        u.Username AS Usuario
      FROM VE_Venta v
      INNER JOIN CL_Cliente c ON v.IdCliente = c.IdCliente
      INNER JOIN PE_Persona pc ON c.IdPersona = pc.IdPersona
      INNER JOIN US_Usuario u ON v.IdUsuario = u.IdUsuario
      INNER JOIN EV_EstadoVenta ev ON v.IdEstadoVenta = ev.IdEstadoVenta
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
  const { tipoComprobante, serie, numeroComprobante, observacion, detalles } = req.body;

  if (!detalles || detalles.length === 0) {
    return res.status(400).json({ error: "La venta debe tener al menos un producto" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { idCliente, idEstadoVenta } = await obtenerDatosVentaBasicos(connection);
    const idUsuario = req.usuario.idUsuario;
    const numeroVenta = `V${Date.now().toString().slice(-9)}`;
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

        lotesBloqueados.set(idLoteDetalle, {
          stockAnterior: Number(lotes[0].StockActual),
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

      if (loteBloqueado.stockAnterior < loteBloqueado.cantidadTotal) {
        throw new Error("Stock insuficiente para uno de los productos");
      }

      const subtotalDetalle = cantidadDetalle * precioUnitario - descuento;

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

      total += subtotalDetalle;
    }

    const subtotal = total / 1.18;
    const igv = total - subtotal;

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
        tipoComprobante || "Boleta",
        serie || "B001",
        numeroComprobante || null,
        observacion || "",
      ]
    );

    const idVenta = ventaResult.insertId;

    for (const detalle of detallesPreparados) {
      const idLoteDetalle = detalle.idLoteDetalle;
      const loteBloqueado = lotesBloqueados.get(idLoteDetalle);
      const stockAnteriorMovimiento = loteBloqueado.stockAnterior - loteBloqueado.cantidadProcesada;
      const stockNuevoMovimiento = stockAnteriorMovimiento - detalle.cantidadUnidadesMinimas;

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

      await connection.query(
        `
        UPDATE LT_Lote
        SET StockActual = StockActual - ?
        WHERE IdLote = ?
        `,
        [detalle.cantidadUnidadesMinimas, idLoteDetalle]
      );

      await registrarMovimientoInventario(connection, {
        idLote: idLoteDetalle,
        idUsuario,
        tipoMovimiento: "SALIDA",
        tipoDocumento: "VENTA",
        numeroDocumento: numeroComprobante || numeroVenta,
        tablaReferencia: "VE_Venta",
        idReferencia: idVenta,
        cantidadSalida: detalle.cantidadUnidadesMinimas,
        stockAnterior: stockAnteriorMovimiento,
        stockNuevo: stockNuevoMovimiento,
        costoUnitario: loteBloqueado.costoUnitario,
        motivo: `Salida por venta (${detalle.cantidadDetalle} ${detalle.unidadVenta})`,
      });

      loteBloqueado.cantidadProcesada += detalle.cantidadUnidadesMinimas;
    }

    await connection.commit();

    res.status(201).json({
      mensaje: "Venta registrada correctamente",
      idVenta,
      total,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al registrar venta:", error.message);
    res.status(500).json({ error: error.message || "Error al registrar venta" });
  } finally {
    connection.release();
  }
});

/* =========================
   KARDEX / MOVIMIENTOS DE INVENTARIO
========================= */

app.get("/api/kardex", async (req, res) => {
  const { idLote, idItem } = req.query;
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

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  try {
    const [rows] = await pool.query(
      `
      SELECT
        m.IdMovimiento,
        m.FechaMovimiento,
        i.Nombre AS Producto,
        i.UnidadMedida AS UnidadMinima,
        l.NumeroLote,
        tm.Codigo AS CodigoMovimiento,
        tm.Nombre AS TipoMovimiento,
        td.Nombre AS TipoDocumento,
        m.NumeroDocumento,
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

/* =========================
   CHATBOT SIMPLE
========================= */

app.post("/api/chatbot", async (req, res) => {
  const { mensaje } = req.body;

  if (!mensaje) {
    return res.status(400).json({ error: "El mensaje es obligatorio" });
  }

  const texto = mensaje.toLowerCase();

  try {
    let palabraClave = "";

    if (texto.includes("dolor") && texto.includes("cabeza")) {
      palabraClave = "paracetamol";
    } else if (texto.includes("tos")) {
      palabraClave = "jarabe";
    } else if (texto.includes("gripe") || texto.includes("resfrio")) {
      palabraClave = "gripe";
    } else if (texto.includes("estomago") || texto.includes("diarrea")) {
      palabraClave = "oral";
    }

    if (!palabraClave) {
      return res.json({
        respuesta:
          "No encontré una recomendación clara. Sugiere consultar con un químico farmacéutico o médico.",
        productos: [],
      });
    }

    const [productos] = await pool.query(
      `
      SELECT 
        i.IdItem,
        i.Nombre,
        i.Descripcion,
        i.PrecioVenta,
        SUM(l.StockActual) AS StockDisponible
      FROM IT_Item i
      INNER JOIN LT_Lote l ON i.IdItem = l.IdItem
      WHERE LOWER(i.Nombre) LIKE ?
        AND i.Estado = 'A'
        AND l.Estado = 'A'
      GROUP BY i.IdItem, i.Nombre, i.Descripcion, i.PrecioVenta
      HAVING StockDisponible > 0
      LIMIT 5
      `,
      [`%${palabraClave}%`]
    );

    res.json({
      respuesta:
        "Estos productos podrían ayudar, pero no reemplazan la opinión de un profesional de salud.",
      productos,
    });
  } catch (error) {
    console.error("Error en chatbot:", error);
    res.status(500).json({ error: "Error en el chatbot" });
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
