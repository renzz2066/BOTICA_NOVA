const API_KARDEX = "/api/kardex";
const API_PRODUCTOS = "/api/productos";
const API_LOTES = "/api/lotes";

const tablaKardex = document.getElementById("tablaKardex");
const totalMovimientos = document.getElementById("totalMovimientos");
const totalEntradas = document.getElementById("totalEntradas");
const totalSalidas = document.getElementById("totalSalidas");

const filtroProducto = document.getElementById("filtroProducto");
const filtroLote = document.getElementById("filtroLote");
const inputBuscar = document.getElementById("inputBuscar");
const btnFiltrar = document.getElementById("btnFiltrar");
const btnLimpiar = document.getElementById("btnLimpiar");
const btnActualizar = document.getElementById("btnActualizar");

let movimientos = [];
let lotes = [];

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([cargarProductos(), cargarLotes()]);
  await cargarKardex();
});

filtroProducto.addEventListener("change", () => {
  cargarOpcionesLotes();
});

btnFiltrar.addEventListener("click", () => {
  cargarKardex();
});

btnLimpiar.addEventListener("click", () => {
  filtroProducto.value = "";
  filtroLote.value = "";
  inputBuscar.value = "";
  cargarOpcionesLotes();
  cargarKardex();
});

btnActualizar.addEventListener("click", () => {
  cargarKardex();
});

inputBuscar.addEventListener("input", () => {
  const texto = inputBuscar.value.trim().toLowerCase();

  if (!texto) {
    mostrarKardex(movimientos);
    return;
  }

  const filtrados = movimientos.filter((movimiento) => {
    return (
      String(movimiento.Producto || "").toLowerCase().includes(texto) ||
      String(movimiento.NumeroLote || "").toLowerCase().includes(texto) ||
      String(movimiento.TipoMovimiento || "").toLowerCase().includes(texto) ||
      String(movimiento.TipoDocumento || "").toLowerCase().includes(texto) ||
      String(movimiento.NumeroDocumento || "").toLowerCase().includes(texto) ||
      String(movimiento.Usuario || "").toLowerCase().includes(texto)
    );
  });

  mostrarKardex(filtrados);
});

async function cargarProductos() {
  try {
    const respuesta = await fetch(API_PRODUCTOS);
    const productos = await respuesta.json();

    filtroProducto.innerHTML = `<option value="">Todos los productos</option>`;

    productos.forEach((producto) => {
      filtroProducto.innerHTML += `
        <option value="${producto.IdItem}">${producto.Nombre}</option>
      `;
    });
  } catch (error) {
    console.error("Error al cargar productos:", error);
  }
}

async function cargarLotes() {
  try {
    const respuesta = await fetch(API_LOTES);
    lotes = await respuesta.json();
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
      <option value="${lote.IdLote}">${lote.Producto} - ${lote.NumeroLote}</option>
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

  const url = parametros.toString() ? `${API_KARDEX}?${parametros}` : API_KARDEX;

  try {
    const respuesta = await fetch(url);
    movimientos = await respuesta.json();

    if (!respuesta.ok) {
      tablaKardex.innerHTML = `
        <tr>
          <td colspan="10">${movimientos.error || "Error al cargar Kardex"}</td>
        </tr>
      `;
      return;
    }

    mostrarKardex(movimientos);
  } catch (error) {
    console.error("Error al cargar Kardex:", error);
    tablaKardex.innerHTML = `
      <tr>
        <td colspan="10">Error al cargar Kardex</td>
      </tr>
    `;
  }
}

function mostrarKardex(lista) {
  actualizarResumen(lista);

  if (lista.length === 0) {
    tablaKardex.innerHTML = `
      <tr>
        <td colspan="10">No hay movimientos registrados</td>
      </tr>
    `;
    return;
  }

  tablaKardex.innerHTML = lista
    .map((movimiento) => {
      return `
        <tr>
          <td>${formatearFecha(movimiento.FechaMovimiento)}</td>
          <td>${movimiento.Producto}</td>
          <td>${movimiento.NumeroLote}</td>
          <td>${crearBadgeMovimiento(movimiento.CodigoMovimiento, movimiento.TipoMovimiento)}</td>
          <td>${movimiento.NumeroDocumento || "-"}</td>
          <td>${movimiento.CantidadEntrada}</td>
          <td>${movimiento.CantidadSalida}</td>
          <td>${movimiento.StockAnterior}</td>
          <td>${movimiento.StockNuevo}</td>
          <td>${movimiento.Usuario || "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function actualizarResumen(lista) {
  const entradas = lista.reduce((total, movimiento) => total + Number(movimiento.CantidadEntrada || 0), 0);
  const salidas = lista.reduce((total, movimiento) => total + Number(movimiento.CantidadSalida || 0), 0);

  totalMovimientos.textContent = lista.length;
  totalEntradas.textContent = entradas;
  totalSalidas.textContent = salidas;
}

function crearBadgeMovimiento(codigo, texto) {
  const clase = String(codigo || "").toLowerCase();
  return `<span class="badge-movimiento ${clase}">${texto || codigo || "-"}</span>`;
}

function formatearFecha(fecha) {
  if (!fecha) {
    return "-";
  }

  return new Date(fecha).toLocaleString("es-PE");
}
