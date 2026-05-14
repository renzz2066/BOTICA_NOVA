const API_LOTES_DISPONIBLES = "/api/lotes-disponibles";
const API_VENTAS = "/api/ventas";
const API_TIPOS_PAGO = "/api/tipos-pago";

const idLote = document.getElementById("idLote");
const inputBuscarProducto = document.getElementById("inputBuscarProducto");
const inputCodigoBarrasVenta = document.getElementById("inputCodigoBarrasVenta");
const tablaProductosVenta = document.getElementById("tablaProductosVenta");
const idUnidadVenta = document.getElementById("idUnidadVenta");
const cantidad = document.getElementById("cantidad");
const precioUnitario = document.getElementById("precioUnitario");
const descuento = document.getElementById("descuento");
const clienteDocumento = document.getElementById("clienteDocumento");
const clienteNombre = document.getElementById("clienteNombre");

const btnAgregar = document.getElementById("btnAgregar");
const btnGuardarVenta = document.getElementById("btnGuardarVenta");
const btnLimpiar = document.getElementById("btnLimpiar");
const modalPago = document.getElementById("modalPago");
const formPago = document.getElementById("formPago");
const btnCerrarPago = document.getElementById("btnCerrarPago");
const btnCancelarPago = document.getElementById("btnCancelarPago");
const idVentaPago = document.getElementById("idVentaPago");
const pagoNumeroVenta = document.getElementById("pagoNumeroVenta");
const pagoDocumento = document.getElementById("pagoDocumento");
const pagoTotalTexto = document.getElementById("pagoTotalTexto");
const idTipoPago = document.getElementById("idTipoPago");
const montoPago = document.getElementById("montoPago");
const referenciaPago = document.getElementById("referenciaPago");

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
let ventasRegistradas = [];

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([cargarLotesDisponibles(), cargarTiposPago()]);
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

inputBuscarProducto.addEventListener("input", () => {
  mostrarProductosVenta();
});

inputCodigoBarrasVenta.addEventListener("input", () => {
  mostrarProductosVenta();
});

inputBuscarProducto.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  const primerProducto = obtenerLotesFiltrados()[0];
  if (primerProducto) {
    seleccionarProductoVenta(primerProducto.IdLote);
  }
});

inputCodigoBarrasVenta.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  const lote = buscarLotePorCodigoBarrasExacto() || obtenerLotesFiltrados()[0];
  if (lote) {
    seleccionarProductoVenta(lote.IdLote);
  }
});

tablaProductosVenta.addEventListener("click", (event) => {
  const fila = event.target.closest("[data-id-lote]");

  if (!fila) {
    return;
  }

  seleccionarProductoVenta(parseInt(fila.dataset.idLote));
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

btnCerrarPago.addEventListener("click", cerrarModalPago);
btnCancelarPago.addEventListener("click", cerrarModalPago);

modalPago.addEventListener("click", (event) => {
  if (event.target === modalPago) {
    cerrarModalPago();
  }
});

formPago.addEventListener("submit", (event) => {
  event.preventDefault();
  pagarPedido();
});

tablaVentas.addEventListener("click", (event) => {
  const botonPagar = event.target.closest("[data-accion='pagar']");
  const botonAnular = event.target.closest("[data-accion='anular']");

  if (botonPagar) {
    abrirModalPago(parseInt(botonPagar.dataset.idVenta));
    return;
  }

  if (botonAnular) {
    anularPedido(parseInt(botonAnular.dataset.idVenta));
  }
});

tipoComprobante.addEventListener("change", () => {
  if (!serie.value.trim() || ["B001", "F001", "T001"].includes(serie.value.trim().toUpperCase())) {
    serie.value = obtenerSeriePorDefecto(tipoComprobante.value);
  }
});

async function cargarLotesDisponibles() {
  try {
    const respuesta = await fetch(API_LOTES_DISPONIBLES);
    const data = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(data.error || "Error al cargar productos disponibles");
    }

    lotesDisponibles = Array.isArray(data) ? data : [];

    idLote.innerHTML = `<option value="">Seleccione producto...</option>`;

    lotesDisponibles.forEach((lote) => {
      idLote.innerHTML += `
        <option value="${lote.IdLote}">
          ${lote.Producto} - ${lote.Marca} - Lote: ${lote.NumeroLote} - Disponible: ${formatearStockMinimo(lote)}
        </option>
      `;
    });

    mostrarProductosVenta();
  } catch (error) {
    console.error("Error al cargar lotes disponibles:", error);
    alert("Error al cargar productos disponibles");
  }
}

function mostrarProductosVenta() {
  const lotes = obtenerLotesFiltrados();

  if (lotesDisponibles.length === 0) {
    tablaProductosVenta.innerHTML = `
      <tr>
        <td colspan="8">No hay productos con stock disponible</td>
      </tr>
    `;
    return;
  }

  if (lotes.length === 0) {
    tablaProductosVenta.innerHTML = `
      <tr>
        <td colspan="8">No se encontraron productos para la búsqueda</td>
      </tr>
    `;
    return;
  }

  tablaProductosVenta.innerHTML = lotes.slice(0, 12).map((lote) => {
    const seleccionado = Number(idLote.value) === lote.IdLote ? " seleccionado" : "";

    return `
      <tr class="fila-producto-venta${seleccionado}" data-id-lote="${lote.IdLote}">
        <td>${escaparHtml(lote.CodigoBarras || "-")}</td>
        <td>
          ${escaparHtml(lote.Producto)}
          <span class="texto-secundario">${escaparHtml(lote.UnidadMinima || "UND")}</span>
        </td>
        <td>${escaparHtml(lote.Marca || "-")}</td>
        <td>${escaparHtml(lote.Presentacion || "-")}</td>
        <td>${escaparHtml(lote.NumeroLote || "-")}</td>
        <td>S/ ${Number(lote.PrecioVenta || 0).toFixed(2)}</td>
        <td>${formatearStockMinimo(lote)}</td>
        <td>${formatearFechaCorta(lote.FechaVencimiento)}</td>
      </tr>
    `;
  }).join("");
}

function obtenerLotesFiltrados() {
  const texto = normalizarTexto(inputBuscarProducto.value);
  const codigoBarras = normalizarTexto(inputCodigoBarrasVenta.value);

  if (!texto && !codigoBarras) {
    return lotesDisponibles;
  }

  return lotesDisponibles.filter((lote) => {
    const coincideTexto = !texto || [
      lote.Producto,
      lote.Marca,
      lote.Presentacion,
      lote.NumeroLote,
      lote.UnidadMinima,
      lote.FechaVencimiento,
    ].some((valor) => normalizarTexto(valor).includes(texto));

    const coincideCodigo = !codigoBarras || normalizarTexto(lote.CodigoBarras).includes(codigoBarras);

    return coincideTexto && coincideCodigo;
  });
}

function buscarLotePorCodigoBarrasExacto() {
  const codigoBarras = normalizarTexto(inputCodigoBarrasVenta.value);

  if (!codigoBarras) {
    return null;
  }

  return lotesDisponibles.find((lote) => normalizarTexto(lote.CodigoBarras) === codigoBarras) || null;
}

function seleccionarProductoVenta(idLoteSeleccionado) {
  const lote = lotesDisponibles.find((item) => item.IdLote === idLoteSeleccionado);

  if (!lote) {
    return;
  }

  idLote.value = lote.IdLote;
  inputBuscarProducto.value = `${lote.Producto} - Lote ${lote.NumeroLote}`;
  inputCodigoBarrasVenta.value = lote.CodigoBarras || "";
  cargarUnidadesVenta(lote);
  mostrarProductosVenta();
}

async function cargarVentas() {
  try {
    const respuesta = await fetch(API_VENTAS);
    const ventas = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(ventas.error || "Error al cargar pedidos");
    }

    ventasRegistradas = Array.isArray(ventas) ? ventas : [];

    if (ventasRegistradas.length === 0) {
      tablaVentas.innerHTML = `
        <tr>
          <td colspan="10">No hay pedidos registrados</td>
        </tr>
      `;
      return;
    }

    tablaVentas.innerHTML = ventasRegistradas
      .map((venta) => {
        return `
          <tr>
            <td>${venta.IdVenta}</td>
            <td>${venta.NumeroVenta}</td>
            <td>${formatearDocumentoVenta(venta)}</td>
            <td>${formatearFecha(venta.FechaVenta)}</td>
            <td>${formatearClienteVenta(venta)}</td>
            <td>${venta.Usuario}</td>
            <td>S/ ${Number(venta.Total).toFixed(2)}</td>
            <td>${crearBadgeEstado(venta.CodigoEstadoVenta, venta.EstadoVenta)}</td>
            <td>${venta.NumeroPago ? `${venta.TipoPago || "Pago"} - ${venta.NumeroPago}` : "-"}</td>
            <td>${crearAccionesPedido(venta)}</td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Error al cargar ventas:", error);
    tablaVentas.innerHTML = `
      <tr>
        <td colspan="10">Error al cargar pedidos</td>
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
    alert("Agrega al menos un producto al pedido");
    return;
  }

  const documentoCliente = clienteDocumento.value.trim();
  const nombreCliente = clienteNombre.value.trim();

  const venta = {
    cliente: {
      tipoDocumento: documentoCliente ? "DNI" : null,
      numeroDocumento: documentoCliente || null,
      nombre: nombreCliente || null,
    },
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
      alert(data.error || "Error al generar pedido");
      return;
    }

    alert(`Pedido generado correctamente. Documento: ${data.documento || data.numeroVenta || ""}`);

    limpiarVenta();
    await cargarLotesDisponibles();
    await cargarVentas();
  } catch (error) {
    console.error("Error al generar pedido:", error);
    alert("Error al generar pedido");
  }
}

function abrirModalPago(idVenta) {
  const venta = ventasRegistradas.find((item) => item.IdVenta === idVenta);

  if (!venta) {
    alert("No se encontro el pedido seleccionado");
    return;
  }

  idVentaPago.value = venta.IdVenta;
  pagoNumeroVenta.textContent = venta.NumeroVenta;
  pagoDocumento.textContent = formatearDocumentoVenta(venta);
  pagoTotalTexto.textContent = `S/ ${Number(venta.Total || 0).toFixed(2)}`;
  montoPago.value = Number(venta.Total || 0).toFixed(2);
  referenciaPago.value = "";

  modalPago.classList.add("mostrar");
}

function cerrarModalPago() {
  modalPago.classList.remove("mostrar");
}

async function pagarPedido() {
  const idVenta = idVentaPago.value;

  if (!idVenta) {
    return;
  }

  if (!idTipoPago.value) {
    alert("Seleccione un tipo de pago");
    return;
  }

  try {
    const respuesta = await fetch(`${API_VENTAS}/${idVenta}/pagar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idTipoPago: parseInt(idTipoPago.value),
        monto: parseFloat(montoPago.value),
        referencia: referenciaPago.value.trim(),
      }),
    });
    const data = await respuesta.json();

    if (!respuesta.ok) {
      alert(data.error || "Error al pagar pedido");
      return;
    }

    alert(`Pedido pagado correctamente. Pago: ${data.numeroPago}`);
    cerrarModalPago();
    await cargarLotesDisponibles();
    await cargarVentas();
  } catch (error) {
    console.error("Error al pagar pedido:", error);
    alert("Error al pagar pedido");
  }
}

async function anularPedido(idVenta) {
  const motivo = prompt("Motivo de anulacion del pedido:", "Cliente cancelo antes del pago");

  if (motivo === null) {
    return;
  }

  try {
    const respuesta = await fetch(`${API_VENTAS}/${idVenta}/anular`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ motivo: motivo.trim() }),
    });
    const data = await respuesta.json();

    if (!respuesta.ok) {
      alert(data.error || "Error al anular pedido");
      return;
    }

    alert("Pedido anulado correctamente");
    await cargarLotesDisponibles();
    await cargarVentas();
  } catch (error) {
    console.error("Error al anular pedido:", error);
    alert("Error al anular pedido");
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

async function cargarTiposPago() {
  try {
    const respuesta = await fetch(API_TIPOS_PAGO);
    const tiposPago = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(tiposPago.error || "Error al cargar tipos de pago");
    }

    idTipoPago.innerHTML = `<option value="">Seleccione...</option>`;

    (Array.isArray(tiposPago) ? tiposPago : []).forEach((tipo) => {
      idTipoPago.innerHTML += `
        <option value="${tipo.IdTipoPago}">${tipo.Nombre}</option>
      `;
    });

    const efectivo = (Array.isArray(tiposPago) ? tiposPago : []).find((tipo) => tipo.Codigo === "EFE");
    if (efectivo) {
      idTipoPago.value = efectivo.IdTipoPago;
    }
  } catch (error) {
    console.error("Error al cargar tipos de pago:", error);
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
  inputBuscarProducto.value = "";
  inputCodigoBarrasVenta.value = "";
  idUnidadVenta.innerHTML = `<option value="">Seleccione unidad...</option>`;
  cantidad.value = 1;
  precioUnitario.value = "";
  descuento.value = 0;
  mostrarProductosVenta();
}

function limpiarVenta() {
  detalleVenta = [];
  mostrarDetalleVenta();

  clienteDocumento.value = "";
  clienteNombre.value = "";
  tipoComprobante.value = "Boleta";
  serie.value = obtenerSeriePorDefecto(tipoComprobante.value);
  numeroComprobante.value = "";
  observacion.value = "";

  limpiarCamposProducto();
}

function crearAccionesPedido(venta) {
  if (venta.CodigoEstadoVenta === "PEN") {
    return `
      <div class="acciones-tabla">
        <button class="btn-icono btn-pagar" title="Pagar pedido" data-accion="pagar" data-id-venta="${venta.IdVenta}">
          <i class="fa-solid fa-money-bill-wave"></i>
        </button>
        <button class="btn-icono btn-eliminar" title="Anular pedido" data-accion="anular" data-id-venta="${venta.IdVenta}">
          <i class="fa-solid fa-ban"></i>
        </button>
      </div>
    `;
  }

  return "-";
}

function crearBadgeEstado(codigo, texto) {
  const clase = String(codigo || "").toLowerCase();
  return `<span class="badge-estado ${clase}">${texto || "-"}</span>`;
}

function formatearFecha(fecha) {
  if (!fecha) {
    return "-";
  }

  return new Date(fecha).toLocaleString("es-PE");
}

function formatearFechaCorta(fecha) {
  if (!fecha) {
    return "-";
  }

  return new Date(fecha).toLocaleDateString("es-PE");
}

function formatearDocumentoVenta(venta) {
  if (!venta.TipoComprobante && !venta.Serie && !venta.NumeroComprobante) {
    return "-";
  }

  return `${venta.TipoComprobante || "Venta"} ${venta.Serie || ""}-${venta.NumeroComprobante || ""}`;
}

function formatearClienteVenta(venta) {
  const cliente = venta.Cliente || "Cliente General";
  const documento = venta.DocumentoCliente;

  if (!documento || documento === "00000000") {
    return cliente;
  }

  return `${cliente} (${documento})`;
}

function obtenerSeriePorDefecto(tipo) {
  const codigo = String(tipo || "").trim().toUpperCase();

  if (codigo === "FACTURA") {
    return "F001";
  }

  if (codigo === "TICKET") {
    return "T001";
  }

  return "B001";
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
