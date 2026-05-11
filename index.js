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

    res.json(rows);
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
  } = req.body;

  if (!nombre || !precioVenta || !idCategoria || !idMarca || !idPresentacion) {
    return res.status(400).json({
      error: "Nombre, precio venta, categoría, marca y presentación son obligatorios",
    });
  }

  try {
    const [result] = await pool.query(
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
        precioVenta,
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

    res.status(201).json({
      mensaje: "Producto registrado correctamente",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error al registrar producto:", error);
    res.status(500).json({ error: "Error al registrar producto" });
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

    res.json(rows[0]);
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
  } = req.body;

  if (!nombre || !precioVenta || !idCategoria || !idMarca || !idPresentacion) {
    return res.status(400).json({
      error: "Nombre, precio venta, categoría, marca y presentación son obligatorios",
    });
  }

  try {
    const [result] = await pool.query(
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
        precioVenta,
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
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ mensaje: "Producto actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    res.status(500).json({ error: "Error al actualizar producto" });
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
        l.Estado
      FROM LT_Lote l
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
      WHERE l.Estado = 'A'
      ORDER BY l.IdLote DESC
    `);

    res.json(rows);
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

  if (!idItem || !numeroLote || stockActual === undefined) {
    return res.status(400).json({
      error: "Producto, número de lote y stock actual son obligatorios",
    });
  }

  try {
    const [result] = await pool.query(
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
        fechaVencimiento,
        fechaIngreso,
        costoCompraLote,
        stockActual,
        usuarioRegistro || "admin",
      ]
    );

    res.status(201).json({
      mensaje: "Lote registrado correctamente",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error al registrar lote:", error);
    res.status(500).json({ error: "Error al registrar lote" });
  }
});

app.get("/api/lotes/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM LT_Lote
      WHERE IdLote = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    res.json(rows[0]);
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

  if (!idItem || !numeroLote || stockActual === undefined) {
    return res.status(400).json({
      error: "Producto, número de lote y stock actual son obligatorios",
    });
  }

  if (parseInt(stockActual) < 0) {
    return res.status(400).json({
      error: "El stock actual no puede ser negativo",
    });
  }

  try {
    const [result] = await pool.query(
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
        costoCompraLote || null,
        stockActual,
        usuarioRegistro || "admin",
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Lote no encontrado" });
    }

    res.json({ mensaje: "Lote actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar lote:", error);
    res.status(500).json({ error: "Error al actualizar lote" });
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

    res.json(rows);
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
        i.Nombre AS Producto,
        l.NumeroLote,
        dv.Cantidad,
        dv.PrecioUnitario,
        dv.Descuento,
        dv.Subtotal
      FROM DV_DetalleVenta dv
      INNER JOIN LT_Lote l ON dv.IdLote = l.IdLote
      INNER JOIN IT_Item i ON l.IdItem = i.IdItem
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

    let total = 0;

    for (const detalle of detalles) {
      const [lotes] = await connection.query(
        `
        SELECT StockActual
        FROM LT_Lote
        WHERE IdLote = ?
        FOR UPDATE
        `,
        [detalle.idLote]
      );

      if (lotes.length === 0) {
        throw new Error("Uno de los lotes no existe");
      }

      if (lotes[0].StockActual < detalle.cantidad) {
        throw new Error("Stock insuficiente para uno de los productos");
      }

      const descuento = detalle.descuento || 0;
      const subtotalDetalle = detalle.cantidad * detalle.precioUnitario - descuento;

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
        `V${Date.now().toString().slice(-9)}`,
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

    for (const detalle of detalles) {
      const descuento = detalle.descuento || 0;
      const subtotalDetalle = detalle.cantidad * detalle.precioUnitario - descuento;

      await connection.query(
        `
        INSERT INTO DV_DetalleVenta
        (IdVenta, IdLote, Cantidad, PrecioUnitario, Descuento, Subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          idVenta,
          detalle.idLote,
          detalle.cantidad,
          detalle.precioUnitario,
          descuento,
          subtotalDetalle,
        ]
      );

      await connection.query(
        `
        UPDATE LT_Lote
        SET StockActual = StockActual - ?
        WHERE IdLote = ?
        `,
        [detalle.cantidad, detalle.idLote]
      );
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

asegurarUsuariosIniciales()
  .catch((error) => {
    console.error("No se pudieron asegurar los usuarios iniciales:", error.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
      console.log("Usuarios iniciales: admin/123456 y cajero/123456");
    });
  });
