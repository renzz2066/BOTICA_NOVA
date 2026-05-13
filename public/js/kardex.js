const API_KARDEX = "/api/kardex";
const API_PRODUCTOS = "/api/productos";
const API_LOTES = "/api/lotes";

const tablaKardex = document.getElementById("tablaKardex");
const totalMovimientos = document.getElementById("totalMovimientos");
const totalEntradas = document.getElementById("totalEntradas");
const totalSalidas = document.getElementById("totalSalidas");
const saldoFinal = document.getElementById("saldoFinal");

const filtroProducto = document.getElementById("filtroProducto");
const filtroLote = document.getElementById("filtroLote");
const filtroMovimiento = document.getElementById("filtroMovimiento");
const filtroDocumento = document.getElementById("filtroDocumento");
const fechaDesde = document.getElementById("fechaDesde");
const fechaHasta = document.getElementById("fechaHasta");
const inputBuscar = document.getElementById("inputBuscar");
const btnFiltrar = document.getElementById("btnFiltrar");
const btnLimpiar = document.getElementById("btnLimpiar");
const btnActualizar = document.getElementById("btnActualizar");
const modalDocumento = document.getElementById("modalDocumento");
const btnCerrarDocumento = document.getElementById("btnCerrarDocumento");
const tituloDocumento = document.getElementById("tituloDocumento");
const contenidoDocumento = document.getElementById("contenidoDocumento");

let movimientos = [];
let lotes = [];

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([cargarProductos(), cargarLotes()]);
  await cargarKardex();
});

filtroProducto.addEventListener("change", () => {
  filtroLote.value = "";
  cargarOpcionesLotes();
});

btnFiltrar.addEventListener("click", () => {
  cargarKardex();
});

btnLimpiar.addEventListener("click", () => {
  filtroProducto.value = "";
  filtroLote.value = "";
  filtroMovimiento.value = "";
  filtroDocumento.value = "";
  fechaDesde.value = "";
  fechaHasta.value = "";
  inputBuscar.value = "";
  cargarOpcionesLotes();
  cargarKardex();
});

btnActualizar.addEventListener("click", () => {
  cargarKardex();
});

btnCerrarDocumento.addEventListener("click", cerrarDocumento);

modalDocumento.addEventListener("click", (event) => {
  if (event.target === modalDocumento) {
    cerrarDocumento();
  }
});

tablaKardex.addEventListener("click", (event) => {
  const boton = event.target.closest("[data-ver-documento]");

  if (!boton) {
    return;
  }

  abrirDocumento(boton.dataset.verDocumento);
});

inputBuscar.addEventListener("input", () => {
  const texto = inputBuscar.value.trim().toLowerCase();

  if (!texto) {
    mostrarKardex(movimientos);
    return;
  }

  const filtrados = movimientos.filter((movimiento) => {
    return [
      movimiento.Producto,
      movimiento.NumeroLote,
      movimiento.TipoMovimiento,
      movimiento.TipoDocumento,
      movimiento.DocumentoCompleto,
      movimiento.NumeroDocumento,
      movimiento.NumeroVenta,
      movimiento.Usuario,
      movimiento.Motivo,
    ].some((valor) => String(valor || "").toLowerCase().includes(texto));
  });

  mostrarKardex(filtrados);
});

async function cargarProductos() {
  try {
    const respuesta = await fetch(API_PRODUCTOS);
    const productos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(productos.error || "Error al cargar productos");
    }

    filtroProducto.innerHTML = `<option value="">Todos los productos</option>`;

    (Array.isArray(productos) ? productos : []).forEach((producto) => {
      filtroProducto.innerHTML += `
        <option value="${producto.IdItem}">${escaparHtml(producto.Nombre)}</option>
      `;
    });
  } catch (error) {
    console.error("Error al cargar productos:", error);
  }
}

async function cargarLotes() {
  try {
    const respuesta = await fetch(API_LOTES);
    const data = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(data.error || "Error al cargar lotes");
    }

    lotes = Array.isArray(data) ? data : [];
    cargarOpcionesLotes();
  } catch (error) {
    console.error("Error al cargar lotes:", error);
  }
}

function cargarOpcionesLotes() {
  const idProducto = filtroProducto.value ? parseInt(filtroProducto.value) : null;
  const lotesFiltrados = idProducto
    ? lotes.filter((lote) => lote.IdItem === idProducto)
    : lotes;

  filtroLote.innerHTML = `<option value="">Todos los lotes</option>`;

  lotesFiltrados.forEach((lote) => {
    filtroLote.innerHTML += `
      <option value="${lote.IdLote}">${escaparHtml(lote.Producto)} - ${escaparHtml(lote.NumeroLote)}</option>
    `;
  });
}

async function cargarKardex() {
  const parametros = new URLSearchParams();

  if (filtroLote.value) {
    parametros.set("idLote", filtroLote.value);
  } else if (filtroProducto.value) {
    parametros.set("idItem", filtroProducto.value);
  }

  if (filtroMovimiento.value) {
    parametros.set("tipoMovimiento", filtroMovimiento.value);
  }

  if (filtroDocumento.value) {
    parametros.set("tipoDocumento", filtroDocumento.value);
  }

  if (fechaDesde.value) {
    parametros.set("fechaDesde", fechaDesde.value);
  }

  if (fechaHasta.value) {
    parametros.set("fechaHasta", fechaHasta.value);
  }

  const url = parametros.toString() ? `${API_KARDEX}?${parametros}` : API_KARDEX;

  try {
    tablaKardex.innerHTML = `
      <tr>
        <td colspan="13">Cargando movimientos...</td>
      </tr>
    `;

    const respuesta = await fetch(url);
    const data = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(data.error || "Error al cargar Kardex");
    }

    movimientos = Array.isArray(data) ? data : [];
    mostrarKardex(filtrarBusquedaActual(movimientos));
  } catch (error) {
    console.error("Error al cargar Kardex:", error);
    tablaKardex.innerHTML = `
      <tr>
        <td colspan="13">Error al cargar Kardex</td>
      </tr>
    `;
  }
}

function filtrarBusquedaActual(lista) {
  const texto = inputBuscar.value.trim().toLowerCase();

  if (!texto) {
    return lista;
  }

  return lista.filter((movimiento) => {
    return [
      movimiento.Producto,
      movimiento.NumeroLote,
      movimiento.TipoMovimiento,
      movimiento.TipoDocumento,
      movimiento.DocumentoCompleto,
      movimiento.NumeroDocumento,
      movimiento.NumeroVenta,
      movimiento.Usuario,
      movimiento.Motivo,
    ].some((valor) => String(valor || "").toLowerCase().includes(texto));
  });
}

function mostrarKardex(lista) {
  actualizarResumen(lista);

  if (lista.length === 0) {
    tablaKardex.innerHTML = `
      <tr>
        <td colspan="13">No hay movimientos registrados</td>
      </tr>
    `;
    return;
  }

  tablaKardex.innerHTML = lista
    .map((movimiento) => {
      return `
        <tr>
          <td>${formatearFecha(movimiento.FechaMovimiento)}</td>
          <td>
            <strong>${escaparHtml(movimiento.Producto)}</strong>
            <span class="texto-secundario">${escaparHtml(movimiento.Motivo || "")}</span>
          </td>
          <td>${escaparHtml(movimiento.NumeroLote)}</td>
          <td>${crearBadgeMovimiento(movimiento.CodigoMovimiento, movimiento.TipoMovimiento)}</td>
          <td>${crearDocumento(movimiento)}</td>
          <td class="cantidad entrada">${formatearCantidadMinima(movimiento.CantidadEntrada, movimiento.UnidadMinima)}</td>
          <td class="cantidad salida">${formatearCantidadMinima(movimiento.CantidadSalida, movimiento.UnidadMinima)}</td>
          <td>${formatearCantidadMinima(movimiento.StockAnterior, movimiento.UnidadMinima)}</td>
          <td><strong>${formatearCantidadMinima(movimiento.StockNuevo, movimiento.UnidadMinima)}</strong></td>
          <td>${formatearMoneda(movimiento.CostoUnitario)}</td>
          <td>${formatearMoneda(movimiento.ValorMovimiento)}</td>
          <td>${escaparHtml(movimiento.Usuario || "-")}</td>
          <td>
            <button class="btn-icono btn-ver" title="Ver documento" data-ver-documento="${movimiento.IdMovimiento}">
              <i class="fa-solid fa-file-lines"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function actualizarResumen(lista) {
  const entradas = lista.reduce((total, movimiento) => total + Number(movimiento.CantidadEntrada || 0), 0);
  const salidas = lista.reduce((total, movimiento) => total + Number(movimiento.CantidadSalida || 0), 0);
  const ultimoMovimiento = [...lista].sort((a, b) => {
    return new Date(b.FechaMovimiento) - new Date(a.FechaMovimiento) || Number(b.IdMovimiento) - Number(a.IdMovimiento);
  })[0];

  totalMovimientos.textContent = lista.length;
  totalEntradas.textContent = entradas;
  totalSalidas.textContent = salidas;
  saldoFinal.textContent = ultimoMovimiento
    ? formatearCantidadMinima(ultimoMovimiento.StockNuevo, ultimoMovimiento.UnidadMinima)
    : "0";
}

function crearBadgeMovimiento(codigo, texto) {
  const clase = String(codigo || "").toLowerCase();
  return `<span class="badge-movimiento ${clase}">${escaparHtml(texto || codigo || "-")}</span>`;
}

function crearDocumento(movimiento) {
  const codigoDocumento = String(movimiento.CodigoDocumento || "").toLowerCase();
  const documento = movimiento.DocumentoCompleto || movimiento.NumeroDocumento || "-";

  return `
    <span class="documento-badge ${codigoDocumento}">${escaparHtml(movimiento.DocumentoTipo || movimiento.TipoDocumento || "-")}</span>
    <span class="documento-numero">${escaparHtml(documento)}</span>
  `;
}

async function abrirDocumento(idMovimiento) {
  try {
    tituloDocumento.textContent = "Documento de Kardex";
    contenidoDocumento.innerHTML = `<p class="texto-secundario">Cargando documento...</p>`;
    modalDocumento.classList.add("mostrar");

    const respuesta = await fetch(`${API_KARDEX}/documento/${idMovimiento}`);
    const data = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(data.error || "Error al obtener documento");
    }

    renderizarDocumento(data);
  } catch (error) {
    console.error("Error al abrir documento:", error);
    contenidoDocumento.innerHTML = `<p class="mensaje-error">No se pudo cargar el documento.</p>`;
  }
}

function renderizarDocumento(data) {
  const movimiento = data.movimiento || {};
  const documento = data.documento || {};
  const detalles = Array.isArray(data.detalles) ? data.detalles : [];
  const codigoDocumento = String(movimiento.CodigoDocumento || "").toUpperCase();

  if (codigoDocumento === "VENTA") {
    const comprobante = `${documento.TipoComprobante || "Venta"} ${documento.Serie || ""}-${documento.NumeroComprobante || ""}`;
    tituloDocumento.textContent = comprobante;
    contenidoDocumento.innerHTML = `
      <div class="documento-grid">
        ${crearDatoDocumento("Venta", documento.NumeroVenta)}
        ${crearDatoDocumento("Fecha", formatearFecha(documento.FechaVenta))}
        ${crearDatoDocumento("Cliente", documento.Cliente)}
        ${crearDatoDocumento("Usuario", documento.Usuario)}
        ${crearDatoDocumento("Estado", documento.EstadoVenta)}
        ${crearDatoDocumento("Total", formatearMoneda(documento.Total))}
      </div>

      <div class="tabla-contenedor documento-tabla">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Lote</th>
              <th>Unidad</th>
              <th>Cantidad</th>
              <th>Minimas</th>
              <th>Precio</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${detalles.map((detalle) => `
              <tr>
                <td>${escaparHtml(detalle.Producto)}</td>
                <td>${escaparHtml(detalle.NumeroLote)}</td>
                <td>${escaparHtml(detalle.UnidadVenta)} x${Number(detalle.FactorConversion || 1)}</td>
                <td>${Number(detalle.Cantidad || 0)}</td>
                <td>${Number(detalle.CantidadUnidadesMinimas || 0)}</td>
                <td>${formatearMoneda(detalle.PrecioUnitario)}</td>
                <td>${formatearMoneda(detalle.Subtotal)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    return;
  }

  if (codigoDocumento === "LOTE") {
    tituloDocumento.textContent = `Ingreso de lote ${documento.NumeroLote || movimiento.NumeroLote || ""}`;
    contenidoDocumento.innerHTML = `
      <div class="documento-grid">
        ${crearDatoDocumento("Producto", documento.Producto || movimiento.Producto)}
        ${crearDatoDocumento("Lote", documento.NumeroLote || movimiento.NumeroLote)}
        ${crearDatoDocumento("Proveedor", documento.Proveedor || "-")}
        ${crearDatoDocumento("Ingreso", formatearFecha(documento.FechaIngreso || movimiento.FechaMovimiento))}
        ${crearDatoDocumento("Vencimiento", formatearFecha(documento.FechaVencimiento))}
        ${crearDatoDocumento("Costo", formatearMoneda(documento.CostoCompraLote || movimiento.CostoUnitario))}
        ${crearDatoDocumento("Entrada", formatearCantidadMinima(movimiento.CantidadEntrada, movimiento.UnidadMinima))}
        ${crearDatoDocumento("Stock actual", formatearCantidadMinima(documento.StockActual, documento.UnidadMinima || movimiento.UnidadMinima))}
      </div>
    `;
    return;
  }

  tituloDocumento.textContent = movimiento.TipoDocumento || "Movimiento";
  contenidoDocumento.innerHTML = `
    <div class="documento-grid">
      ${crearDatoDocumento("Movimiento", movimiento.TipoMovimiento)}
      ${crearDatoDocumento("Documento", movimiento.NumeroDocumento)}
      ${crearDatoDocumento("Producto", movimiento.Producto)}
      ${crearDatoDocumento("Lote", movimiento.NumeroLote)}
      ${crearDatoDocumento("Entrada", formatearCantidadMinima(movimiento.CantidadEntrada, movimiento.UnidadMinima))}
      ${crearDatoDocumento("Salida", formatearCantidadMinima(movimiento.CantidadSalida, movimiento.UnidadMinima))}
      ${crearDatoDocumento("Stock anterior", formatearCantidadMinima(movimiento.StockAnterior, movimiento.UnidadMinima))}
      ${crearDatoDocumento("Stock nuevo", formatearCantidadMinima(movimiento.StockNuevo, movimiento.UnidadMinima))}
    </div>
    <p class="documento-motivo">${escaparHtml(movimiento.Motivo || "")}</p>
  `;
}

function crearDatoDocumento(etiqueta, valor) {
  return `
    <div class="documento-dato">
      <span>${escaparHtml(etiqueta)}</span>
      <strong>${escaparHtml(valor ?? "-")}</strong>
    </div>
  `;
}

function cerrarDocumento() {
  modalDocumento.classList.remove("mostrar");
}

function formatearCantidadMinima(cantidad, unidadMinima) {
  return `${Number(cantidad || 0)} ${unidadMinima || "UND"}`;
}

function formatearMoneda(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "-";
  }

  return `S/ ${Number(valor || 0).toFixed(2)}`;
}

function formatearFecha(fecha) {
  if (!fecha) {
    return "-";
  }

  return new Date(fecha).toLocaleString("es-PE");
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
