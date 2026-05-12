const API_ALERTAS = "/api/alertas";

const tablaAlertas = document.getElementById("tablaAlertas");
const totalAlertas = document.getElementById("totalAlertas");
const inputBuscar = document.getElementById("inputBuscar");
const btnActualizar = document.getElementById("btnActualizar");

let alertas = [];

document.addEventListener("DOMContentLoaded", () => {
  cargarAlertas();
});

btnActualizar.addEventListener("click", () => {
  cargarAlertas();
});

inputBuscar.addEventListener("input", () => {
  const texto = inputBuscar.value.toLowerCase();

  const filtradas = alertas.filter((alerta) => {
    return (
      String(alerta.Producto || "").toLowerCase().includes(texto) ||
      String(alerta.NumeroLote || "").toLowerCase().includes(texto) ||
      String(alerta.Proveedor || "").toLowerCase().includes(texto)
    );
  });

  mostrarAlertas(filtradas);
});

async function cargarAlertas() {
  try {
    const respuesta = await fetch(API_ALERTAS);
    const data = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(data.error || "Error al cargar alertas");
    }

    alertas = Array.isArray(data) ? data : [];

    totalAlertas.textContent = alertas.length;
    mostrarAlertas(alertas);
  } catch (error) {
    console.error("Error al cargar alertas:", error);

    tablaAlertas.innerHTML = `
      <tr>
        <td colspan="6">Error al cargar alertas</td>
      </tr>
    `;
  }
}

function mostrarAlertas(lista) {
  if (lista.length === 0) {
    tablaAlertas.innerHTML = `
      <tr>
        <td colspan="6">No hay productos con bajo stock</td>
      </tr>
    `;
    return;
  }

  tablaAlertas.innerHTML = lista
    .map((alerta) => {
      const stockActual = Number(alerta.StockActual || 0);
      const estado = stockActual <= 0 ? "Sin stock" : "Bajo stock";

      return `
        <tr>
          <td>${escaparHtml(alerta.Producto)}</td>
          <td>${escaparHtml(alerta.NumeroLote || "Sin lote activo")}</td>
          <td>${stockActual} ${escaparHtml(alerta.UnidadMinima || "UND")}</td>
          <td>${Number(alerta.StockMinimo || 0)} ${escaparHtml(alerta.UnidadMinima || "UND")}</td>
          <td>${escaparHtml(alerta.Proveedor || "-")}</td>
          <td>
            <span class="badge-alerta">
              ${estado}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
