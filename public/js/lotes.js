const API_LOTES = "/api/lotes";
const API_PRODUCTOS = "/api/productos";

const tablaLotes = document.getElementById("tablaLotes");
const modalLote = document.getElementById("modalLote");
const formLote = document.getElementById("formLote");
const tituloModal = document.getElementById("tituloModal");

const btnNuevo = document.getElementById("btnNuevo");
const btnCerrar = document.getElementById("btnCerrar");
const btnCancelar = document.getElementById("btnCancelar");
const inputBuscar = document.getElementById("inputBuscar");

const idLote = document.getElementById("idLote");
const idItem = document.getElementById("idItem");
const numeroLote = document.getElementById("numeroLote");
const fechaIngreso = document.getElementById("fechaIngreso");
const fechaVencimiento = document.getElementById("fechaVencimiento");
const costoCompraLote = document.getElementById("costoCompraLote");
const stockActual = document.getElementById("stockActual");

let lotes = [];

document.addEventListener("DOMContentLoaded", async () => {
  await cargarProductos();
  await cargarLotes();
});

btnNuevo.addEventListener("click", () => {
  abrirModalNuevo();
});

btnCerrar.addEventListener("click", () => {
  cerrarModal();
});

btnCancelar.addEventListener("click", () => {
  cerrarModal();
});

inputBuscar.addEventListener("input", () => {
  const texto = inputBuscar.value.toLowerCase();

  const filtrados = lotes.filter((lote) => {
    return (
      lote.Producto.toLowerCase().includes(texto) ||
      lote.NumeroLote.toLowerCase().includes(texto) ||
      String(lote.StockActual).includes(texto)
    );
  });

  mostrarLotes(filtrados);
});

formLote.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validarLote()) {
    return;
  }

  const lote = {
    idItem: parseInt(idItem.value),
    numeroLote: numeroLote.value.trim(),
    fechaIngreso: fechaIngreso.value || null,
    fechaVencimiento: fechaVencimiento.value || null,
    costoCompraLote: costoCompraLote.value ? parseFloat(costoCompraLote.value) : null,
    stockActual: parseInt(stockActual.value),
    usuarioRegistro: "admin",
  };

  try {
    let respuesta;

    if (idLote.value) {
      respuesta = await fetch(`${API_LOTES}/${idLote.value}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lote),
      });
    } else {
      respuesta = await fetch(API_LOTES, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lote),
      });
    }

    const data = await respuesta.json();

    if (!respuesta.ok) {
      alert(data.error || "Error al guardar lote");
      return;
    }

    alert(idLote.value ? "Lote actualizado correctamente" : "Lote registrado correctamente");

    cerrarModal();
    cargarLotes();
  } catch (error) {
    console.error("Error al guardar lote:", error);
    alert("Error al guardar lote");
  }
});

async function cargarLotes() {
  try {
    const respuesta = await fetch(API_LOTES);
    lotes = await respuesta.json();

    mostrarLotes(lotes);
  } catch (error) {
    console.error("Error al cargar lotes:", error);
    tablaLotes.innerHTML = `
      <tr>
        <td colspan="8">Error al cargar lotes</td>
      </tr>
    `;
  }
}

function mostrarLotes(lista) {
  if (lista.length === 0) {
    tablaLotes.innerHTML = `
      <tr>
        <td colspan="8">No hay lotes registrados</td>
      </tr>
    `;
    return;
  }

  tablaLotes.innerHTML = lista
    .map((lote) => {
      return `
        <tr>
          <td>${lote.IdLote}</td>
          <td>${lote.Producto}</td>
          <td>${lote.NumeroLote}</td>
          <td>${formatearFecha(lote.FechaIngreso)}</td>
          <td>${formatearFecha(lote.FechaVencimiento)}</td>
          <td>${lote.CostoCompraLote ? "S/ " + Number(lote.CostoCompraLote).toFixed(2) : "-"}</td>
          <td>${formatearStockLote(lote)}</td>
          <td>
            <div class="acciones-tabla">
              <button class="btn-icono btn-editar" onclick="editarLote(${lote.IdLote})">
                <i class="fa-solid fa-pen"></i>
              </button>

              <button class="btn-icono btn-eliminar" onclick="eliminarLote(${lote.IdLote})">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function cargarProductos() {
  try {
    const respuesta = await fetch(API_PRODUCTOS);
    const productos = await respuesta.json();

    idItem.innerHTML = `<option value="">Seleccione producto...</option>`;

    productos.forEach((producto) => {
      idItem.innerHTML += `
        <option value="${producto.IdItem}">
          ${producto.Nombre} - ${producto.Marca || ""} (${producto.UnidadMinima || producto.UnidadMedida || "UND"})
        </option>
      `;
    });
  } catch (error) {
    console.error("Error al cargar productos:", error);
  }
}

function abrirModalNuevo() {
  tituloModal.textContent = "Nuevo lote";
  formLote.reset();
  idLote.value = "";
  modalLote.classList.add("mostrar");
}

function cerrarModal() {
  modalLote.classList.remove("mostrar");
}

async function editarLote(id) {
  try {
    const respuesta = await fetch(`${API_LOTES}/${id}`);
    const lote = await respuesta.json();

    if (!respuesta.ok) {
      alert(lote.error || "Error al obtener lote");
      return;
    }

    tituloModal.textContent = "Editar lote";

    idLote.value = lote.IdLote;
    idItem.value = lote.IdItem;
    numeroLote.value = lote.NumeroLote;
    fechaIngreso.value = convertirFechaInput(lote.FechaIngreso);
    fechaVencimiento.value = convertirFechaInput(lote.FechaVencimiento);
    costoCompraLote.value = lote.CostoCompraLote || "";
    stockActual.value = lote.StockActual;

    modalLote.classList.add("mostrar");
  } catch (error) {
    console.error("Error al obtener lote:", error);
    alert("Error al obtener lote");
  }
}

async function eliminarLote(id) {
  const confirmar = confirm("¿Seguro que deseas eliminar este lote?");

  if (!confirmar) {
    return;
  }

  try {
    const respuesta = await fetch(`${API_LOTES}/${id}`, {
      method: "DELETE",
    });

    const data = await respuesta.json();

    if (!respuesta.ok) {
      alert(data.error || "Error al eliminar lote");
      return;
    }

    alert("Lote eliminado correctamente");
    cargarLotes();
  } catch (error) {
    console.error("Error al eliminar lote:", error);
    alert("Error al eliminar lote");
  }
}

function validarLote() {
  if (!idItem.value) {
    alert("Seleccione un producto");
    return false;
  }

  if (numeroLote.value.trim().length < 2) {
    alert("El número de lote debe tener al menos 2 caracteres");
    return false;
  }

  if (!stockActual.value || parseInt(stockActual.value) < 0) {
    alert("El stock actual debe ser 0 o mayor");
    return false;
  }

  if (costoCompraLote.value && parseFloat(costoCompraLote.value) < 0) {
    alert("El costo de compra no puede ser negativo");
    return false;
  }

  if (fechaIngreso.value && fechaVencimiento.value) {
    if (fechaVencimiento.value <= fechaIngreso.value) {
      alert("La fecha de vencimiento debe ser posterior a la fecha de ingreso");
      return false;
    }
  }

  return true;
}

function formatearFecha(fecha) {
  if (!fecha) {
    return "-";
  }

  return new Date(fecha).toLocaleDateString("es-PE");
}

function formatearStockLote(lote) {
  const unidadMinima = lote.UnidadMinima || "UND";
  const stock = Number(lote.StockActual || 0);
  const desglose = desglosarStock(stock, lote.UnidadesVenta || [], unidadMinima);

  return `
    <strong>${stock} ${unidadMinima}</strong>
    <span class="texto-secundario">${desglose}</span>
  `;
}

function desglosarStock(stock, unidades, unidadMinima) {
  const unidadesOrdenadas = unidades
    .filter((unidad) => Number(unidad.FactorConversion) > 1)
    .sort((a, b) => Number(b.FactorConversion) - Number(a.FactorConversion));

  if (unidadesOrdenadas.length === 0) {
    return "";
  }

  let restante = stock;
  const partes = [];

  unidadesOrdenadas.forEach((unidad) => {
    const factor = Number(unidad.FactorConversion);
    const cantidad = Math.floor(restante / factor);

    if (cantidad > 0) {
      partes.push(`${cantidad} ${unidad.Abreviatura || unidad.Nombre}`);
      restante -= cantidad * factor;
    }
  });

  if (restante > 0) {
    partes.push(`${restante} ${unidadMinima}`);
  }

  return partes.length > 0 ? partes.join(" + ") : "";
}

function convertirFechaInput(fecha) {
  if (!fecha) {
    return "";
  }

  return fecha.substring(0, 10);
}
