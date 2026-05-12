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
      alerta.Producto.toLowerCase().includes(texto) ||
      alerta.NumeroLote.toLowerCase().includes(texto) ||
      alerta.Proveedor?.toLowerCase().includes(texto)
    );
  });

  mostrarAlertas(filtradas);
});

async function cargarAlertas() {
  try {
    const respuesta = await fetch(API_ALERTAS);
    alertas = await respuesta.json();

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
      return `
        <tr>
          <td>${alerta.Producto}</td>
          <td>${alerta.NumeroLote}</td>
          <td>${alerta.StockActual} ${alerta.UnidadMinima || "UND"}</td>
          <td>${alerta.StockMinimo} ${alerta.UnidadMinima || "UND"}</td>
          <td>${alerta.Proveedor || "-"}</td>
          <td>
            <span class="badge-alerta">
              Bajo stock
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}
