const express = require("express");
const path = require("path");
const pool = require("./db");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("API de Botica Nova funcionando correctamente");
});

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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});