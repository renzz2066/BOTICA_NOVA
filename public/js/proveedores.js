const API_PROVEEDORES = "/api/proveedores";

const tablaProveedores = document.getElementById("tablaProveedores");
const modalProveedor = document.getElementById("modalProveedor");
const formProveedor = document.getElementById("formProveedor");
const tituloModal = document.getElementById("tituloModal");

const btnNuevo = document.getElementById("btnNuevo");
const btnCerrar = document.getElementById("btnCerrar");
const btnCancelar = document.getElementById("btnCancelar");
const inputBuscar = document.getElementById("inputBuscar");

const idProveedor = document.getElementById("idProveedor");
const idPersona = document.getElementById("idPersona");
const nombres = document.getElementById("nombres");
const apellidos = document.getElementById("apellidos");
const tipoDocumento = document.getElementById("tipoDocumento");
const numeroDocumento = document.getElementById("numeroDocumento");
const razonSocial = document.getElementById("razonSocial");
const ruc = document.getElementById("ruc");
const telefono = document.getElementById("telefono");
const correo = document.getElementById("correo");
const direccion = document.getElementById("direccion");

let proveedores = [];

document.addEventListener("DOMContentLoaded", () => {
  cargarProveedores();
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

  const filtrados = proveedores.filter((proveedor) => {
    return (
      proveedor.RazonSocial.toLowerCase().includes(texto) ||
      proveedor.Ruc.toLowerCase().includes(texto) ||
      proveedor.Telefono?.toLowerCase().includes(texto)
    );
  });

  mostrarProveedores(filtrados);
});

formProveedor.addEventListener("submit", async (event) => {
  event.preventDefault();

  const proveedor = {
    idPersona: idPersona.value,
    nombres: nombres.value.trim(),
    apellidos: apellidos.value.trim(),
    tipoDocumento: tipoDocumento.value,
    numeroDocumento: numeroDocumento.value.trim(),
    razonSocial: razonSocial.value.trim(),
    ruc: ruc.value.trim(),
    telefono: telefono.value.trim(),
    correo: correo.value.trim(),
    direccion: direccion.value.trim(),
  };

  try {
    if (idProveedor.value) {
      await fetch(`${API_PROVEEDORES}/${idProveedor.value}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proveedor),
      });

      alert("Proveedor actualizado correctamente");
    } else {
      await fetch(API_PROVEEDORES, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proveedor),
      });

      alert("Proveedor registrado correctamente");
    }

    cerrarModal();
    cargarProveedores();
  } catch (error) {
    console.error("Error al guardar proveedor:", error);
    alert("Error al guardar proveedor");
  }
});

async function cargarProveedores() {
  try {
    const respuesta = await fetch(API_PROVEEDORES);
    proveedores = await respuesta.json();

    mostrarProveedores(proveedores);
  } catch (error) {
    console.error("Error al cargar proveedores:", error);
    tablaProveedores.innerHTML = `
      <tr>
        <td colspan="8">Error al cargar proveedores</td>
      </tr>
    `;
  }
}

function mostrarProveedores(lista) {
  if (lista.length === 0) {
    tablaProveedores.innerHTML = `
      <tr>
        <td colspan="8">No hay proveedores registrados</td>
      </tr>
    `;
    return;
  }

  tablaProveedores.innerHTML = lista
    .map((proveedor) => {
      return `
        <tr>
          <td>${proveedor.IdProveedor}</td>
          <td>${proveedor.RazonSocial}</td>
          <td>${proveedor.Ruc}</td>
          <td>${proveedor.Nombres} ${proveedor.Apellidos}</td>
          <td>${proveedor.Telefono || "-"}</td>
          <td>${proveedor.Correo || "-"}</td>
          <td>${proveedor.Direccion || "-"}</td>
          <td>
            <div class="acciones-tabla">
              <button class="btn-icono btn-editar" onclick="editarProveedor(${proveedor.IdProveedor})">
                <i class="fa-solid fa-pen"></i>
              </button>

              <button class="btn-icono btn-eliminar" onclick="eliminarProveedor(${proveedor.IdProveedor})">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function abrirModalNuevo() {
  tituloModal.textContent = "Nuevo proveedor";
  formProveedor.reset();
  idProveedor.value = "";
  idPersona.value = "";
  modalProveedor.classList.add("mostrar");
}

function cerrarModal() {
  modalProveedor.classList.remove("mostrar");
}

async function editarProveedor(id) {
  try {
    const respuesta = await fetch(`${API_PROVEEDORES}/${id}`);
    const proveedor = await respuesta.json();

    tituloModal.textContent = "Editar proveedor";

    idProveedor.value = proveedor.IdProveedor;
    idPersona.value = proveedor.IdPersona;
    nombres.value = proveedor.Nombres;
    apellidos.value = proveedor.Apellidos;
    tipoDocumento.value = proveedor.TipoDocumento || "DNI";
    numeroDocumento.value = proveedor.NumeroDocumento || "";
    razonSocial.value = proveedor.RazonSocial;
    ruc.value = proveedor.Ruc;
    telefono.value = proveedor.Telefono || "";
    correo.value = proveedor.Correo || "";
    direccion.value = proveedor.Direccion || "";

    modalProveedor.classList.add("mostrar");
  } catch (error) {
    console.error("Error al obtener proveedor:", error);
    alert("Error al obtener proveedor");
  }
}

async function eliminarProveedor(id) {
  const confirmar = confirm("¿Seguro que deseas eliminar este proveedor?");

  if (!confirmar) {
    return;
  }

  try {
    await fetch(`${API_PROVEEDORES}/${id}`, {
      method: "DELETE",
    });

    alert("Proveedor eliminado correctamente");
    cargarProveedores();
  } catch (error) {
    console.error("Error al eliminar proveedor:", error);
    alert("Error al eliminar proveedor");
  }
}