const API_LOTES_DISPONIBLES = "/api/lotes-disponibles";
const API_VENTAS = "/api/ventas";

const idLote = document.getElementById("idLote");
const idUnidadVenta = document.getElementById("idUnidadVenta");
const cantidad = document.getElementById("cantidad");
const precioUnitario = document.getElementById("precioUnitario");
const descuento = document.getElementById("descuento");

const btnAgregar = document.getElementById("btnAgregar");
const btnGuardarVenta = document.getElementById("btnGuardarVenta");
const btnLimpiar = document.getElementById("btnLimpiar");

const tablaDetalleVenta = document.getElementById("tablaDetalleVenta");
const tablaVentas = document.getElementById("tablaVentas");

const subtotalTexto = document.getElementById("subtotalTexto");
const igvTexto = document.getElementById("igvTexto");
const totalTexto = document.getElementById("totalTexto");

const tipoComprobante = document.getElementById("tipoComprobante");
const serie = document.getElementById("serie");
const numeroComprobante = document.getElementById("numeroComprobante");
const observacion = document.getElementById("observacion");

let lotesDisponibles = [];
let detalleVenta = [];

document.addEventListener("DOMContentLoaded", async () => {
  await cargarLotesDisponibles();
  await cargarVentas();
});

idLote.addEventListener("change", () => {
  const lote = obtenerLoteSeleccionado();

  if (lote) {
    cargarUnidadesVenta(lote);
  } else {
    idUnidadVenta.innerHTML = `<option value="">Seleccione unidad...</option>`;
    precioUnitario.value = "";
  }
});

idUnidadVenta.addEventListener("change", () => {
  const unidad = obtenerUnidadSeleccionada();

  precioUnitario.value = unidad ? Number(unidad.PrecioVenta).toFixed(2) : "";
});

btnAgregar.addEventListener("click", () => {
  agregarProducto();
});

btnGuardarVenta.addEventListener("click", () => {
  guardarVenta();
});

btnLimpiar.addEventListener("click", () => {
  limpiarVenta();
});

async function cargarLotesDisponibles() {
  try {
    const respuesta = await fetch(API_LOTES_DISPONIBLES);
    lotesDisponibles = await respuesta.json();

    idLote.innerHTML = `<option value="">Seleccione producto...</option>`;

    lotesDisponibles.forEach((lote) => {
      idLote.innerHTML += `
        <option value="${lote.IdLote}">
          ${lote.Producto} - ${lote.Marca} - Lote: ${lote.NumeroLote} - Stock: ${formatearStockMinimo(lote)}
        </option>
      `;
    });
  } catch (error) {
    console.error("Error al cargar lotes disponibles:", error);
    alert("Error al cargar productos disponibles");
  }
}

async function cargarVentas() {
  try {
    const respuesta = await fetch(API_VENTAS);
    const ventas = await respuesta.json();

    if (ventas.length === 0) {
      tablaVentas.innerHTML = `
        <tr>
          <td colspan="7">No hay ventas registradas</td>
        </tr>
      `;
      return;
    }

    tablaVentas.innerHTML = ventas
      .map((venta) => {
        return `
          <tr>
            <td>${venta.IdVenta}</td>
            <td>${venta.NumeroVenta}</td>
            <td>${formatearFecha(venta.FechaVenta)}</td>
            <td>${venta.Cliente}</td>
            <td>${venta.Usuario}</td>
            <td>S/ ${Number(venta.Total).toFixed(2)}</td>
            <td>${venta.EstadoVenta}</td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Error al cargar ventas:", error);
    tablaVentas.innerHTML = `
      <tr>
        <td colspan="7">Error al cargar ventas</td>
      </tr>
    `;
  }
}

function agregarProducto() {
  const lote = obtenerLoteSeleccionado();
  const unidad = obtenerUnidadSeleccionada();

  if (!lote) {
    alert("Seleccione un producto");
    return;
  }

  if (!unidad) {
    alert("Seleccione una unidad de venta");
    return;
  }

  const cantidadVenta = parseInt(cantidad.value);
  const precio = parseFloat(precioUnitario.value);
  const descuentoVenta = descuento.value ? parseFloat(descuento.value) : 0;
  const cantidadMinima = cantidadVenta * Number(unidad.FactorConversion);

  if (!cantidadVenta || cantidadVenta <= 0) {
    alert("La cantidad debe ser mayor a 0");
    return;
  }

  if (cantidadMinima > lote.StockActual) {
    alert("No hay stock suficiente para este lote");
    return;
  }

  if (!precio || precio <= 0) {
    alert("El precio debe ser mayor a 0");
    return;
  }

  if (Number.isNaN(descuentoVenta) || descuentoVenta < 0) {
    alert("El descuento no puede ser negativo");
    return;
  }

  if (cantidadVenta * precio - descuentoVenta < 0) {
    alert("El descuento no puede superar el subtotal del producto");
    return;
  }

  const stockReservado = detalleVenta
    .filter((item) => item.idLote === lote.IdLote)
    .reduce((total, item) => total + item.cantidadUnidadesMinimas, 0);
  const productoExistente = detalleVenta.find((item) => {
    return item.idLote === lote.IdLote && String(item.idUnidadVenta || "") === String(unidad.IdUnidadVenta || "");
  });

  if (productoExistente) {
    const nuevaCantidad = productoExistente.cantidad + cantidadVenta;
    const nuevaCantidadMinima = nuevaCantidad * productoExistente.factorConversion;
    const reservadoSinLinea = stockReservado - productoExistente.cantidadUnidadesMinimas;

    if (reservadoSinLinea + nuevaCantidadMinima > lote.StockActual) {
      alert("La cantidad total supera el stock disponible");
      return;
    }

    productoExistente.cantidad = nuevaCantidad;
    productoExistente.cantidadUnidadesMinimas = nuevaCantidadMinima;
    productoExistente.subtotal = nuevaCantidad * productoExistente.precioUnitario - productoExistente.descuento;
  } else {
    if (stockReservado + cantidadMinima > lote.StockActual) {
      alert("La cantidad total supera el stock disponible");
      return;
    }

    detalleVenta.push({
      idLote: lote.IdLote,
      idUnidadVenta: unidad.IdUnidadVenta,
      producto: lote.Producto,
      numeroLote: lote.NumeroLote,
      unidadVenta: unidad.Nombre,
      unidadMinima: lote.UnidadMinima || "UND",
      factorConversion: Number(unidad.FactorConversion),
      cantidad: cantidadVenta,
      cantidadUnidadesMinimas: cantidadMinima,
      precioUnitario: precio,
      descuento: descuentoVenta,
      subtotal: cantidadVenta * precio - descuentoVenta,
    });
  }

  mostrarDetalleVenta();
  limpiarCamposProducto();
};

function mostrarDetalleVenta() {
  if (detalleVenta.length === 0) {
    tablaDetalleVenta.innerHTML = `
      <tr>
        <td colspan="8">No hay productos agregados</td>
      </tr>
    `;
    actualizarTotales();
    return;
  }

  tablaDetalleVenta.innerHTML = detalleVenta
    .map((item, index) => {
      return `
        <tr>
          <td>${item.producto}</td>
          <td>${item.numeroLote}</td>
          <td>
            ${item.unidadVenta}
            <span class="texto-secundario">x${item.factorConversion} ${item.unidadMinima}</span>
          </td>
          <td>${item.cantidad}</td>
          <td>S/ ${item.precioUnitario.toFixed(2)}</td>
          <td>S/ ${item.descuento.toFixed(2)}</td>
          <td>S/ ${item.subtotal.toFixed(2)}</td>
          <td>
            <button class="btn-icono btn-eliminar" onclick="quitarProducto(${index})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  actualizarTotales();
}

function quitarProducto(index) {
  detalleVenta.splice(index, 1);
  mostrarDetalleVenta();
}

async function guardarVenta() {
  if (detalleVenta.length === 0) {
    alert("Agrega al menos un producto a la venta");
    return;
  }

  const venta = {
    tipoComprobante: tipoComprobante.value,
    serie: serie.value.trim(),
    numeroComprobante: numeroComprobante.value.trim() || null,
    observacion: observacion.value.trim(),
    detalles: detalleVenta.map((item) => {
      return {
        idLote: item.idLote,
        idUnidadVenta: item.idUnidadVenta,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        descuento: item.descuento,
      };
    }),
  };

  try {
    const respuesta = await fetch(API_VENTAS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(venta),
    });

    const data = await respuesta.json();

    if (!respuesta.ok) {
      alert(data.error || "Error al registrar venta");
      return;
    }

    alert("Venta registrada correctamente");

    limpiarVenta();
    await cargarLotesDisponibles();
    await cargarVentas();
  } catch (error) {
    console.error("Error al guardar venta:", error);
    alert("Error al guardar venta");
  }
}

function obtenerLoteSeleccionado() {
  const id = parseInt(idLote.value);

  return lotesDisponibles.find((lote) => lote.IdLote === id);
}

function cargarUnidadesVenta(lote) {
  const unidades = obtenerUnidadesVentaLote(lote);

  idUnidadVenta.innerHTML = `<option value="">Seleccione unidad...</option>`;

  unidades.forEach((unidad, index) => {
    const id = obtenerValorUnidadVenta(unidad, index);
    idUnidadVenta.innerHTML += `
      <option value="${id}" data-index="${index}">
        ${unidad.Nombre} x ${unidad.FactorConversion} ${lote.UnidadMinima || "UND"}
      </option>
    `;
  });

  if (unidades.length > 0) {
    const primeraUnidad = unidades[0];
    idUnidadVenta.value = obtenerValorUnidadVenta(primeraUnidad, 0);
    precioUnitario.value = Number(primeraUnidad.PrecioVenta).toFixed(2);
  } else {
    precioUnitario.value = "";
  }
}

function obtenerUnidadSeleccionada() {
  const lote = obtenerLoteSeleccionado();

  if (!lote) {
    return null;
  }

  const opcion = idUnidadVenta.options[idUnidadVenta.selectedIndex];
  const index = opcion?.dataset.index;

  if (index === undefined) {
    return null;
  }

  return obtenerUnidadesVentaLote(lote)[parseInt(index)];
}

function obtenerUnidadesVentaLote(lote) {
  const unidades = Array.isArray(lote?.UnidadesVenta) ? lote.UnidadesVenta : [];

  if (unidades.length > 0) {
    return unidades;
  }

  if (!lote) {
    return [];
  }

  return [
    {
      IdUnidadVenta: null,
      Nombre: lote.UnidadMinima || "UND",
      Abreviatura: lote.UnidadMinima || "UND",
      FactorConversion: 1,
      PrecioVenta: Number(lote.PrecioVenta || 0),
      EsUnidadMinima: "S",
    },
  ];
}

function obtenerValorUnidadVenta(unidad, index) {
  return unidad.IdUnidadVenta ?? `default-${index}`;
}

function formatearStockMinimo(lote) {
  return `${lote.StockActual} ${lote.UnidadMinima || "UND"}`;
}

function actualizarTotales() {
  const total = detalleVenta.reduce((acumulado, item) => acumulado + item.subtotal, 0);
  const subtotal = total / 1.18;
  const igv = total - subtotal;

  subtotalTexto.textContent = `S/ ${subtotal.toFixed(2)}`;
  igvTexto.textContent = `S/ ${igv.toFixed(2)}`;
  totalTexto.textContent = `S/ ${total.toFixed(2)}`;
}

function limpiarCamposProducto() {
  idLote.value = "";
  idUnidadVenta.innerHTML = `<option value="">Seleccione unidad...</option>`;
  cantidad.value = 1;
  precioUnitario.value = "";
  descuento.value = 0;
}

function limpiarVenta() {
  detalleVenta = [];
  mostrarDetalleVenta();

  tipoComprobante.value = "Boleta";
  serie.value = "B001";
  numeroComprobante.value = "";
  observacion.value = "";

  limpiarCamposProducto();
}

function formatearFecha(fecha) {
  if (!fecha) {
    return "-";
  }

  return new Date(fecha).toLocaleString("es-PE");
}
