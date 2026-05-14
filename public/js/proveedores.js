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
    const razon = String(proveedor.RazonSocial || "").toLowerCase();
    const documento = String(proveedor.Ruc || "").toLowerCase();
    const telefonoProveedor = String(proveedor.Telefono || "").toLowerCase();

    return (
      razon.includes(texto) ||
      documento.includes(texto) ||
      telefonoProveedor.includes(texto)
    );
  });

  mostrarProveedores(filtrados);
});

[numeroDocumento, ruc, telefono].forEach((input) => {
  input.addEventListener("input", () => {
    if (input === numeroDocumento && tipoDocumento.value === "CE") {
      input.value = input.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      return;
    }

    input.value = input.value.replace(/\D/g, "");
  });
});

tipoDocumento.addEventListener("change", () => {
  numeroDocumento.value = "";
  numeroDocumento.maxLength = tipoDocumento.value === "RUC" ? 11 : tipoDocumento.value === "CE" ? 12 : 8;
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

  const errorValidacion = validarProveedor(proveedor);

  if (errorValidacion) {
    alert(errorValidacion);
    return;
  }

  try {
    if (idProveedor.value) {
      const respuesta = await fetch(`${API_PROVEEDORES}/${idProveedor.value}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proveedor),
      });
      const data = await respuesta.json();

      if (!respuesta.ok) {
        alert(data.error || "Error al actualizar proveedor");
        return;
      }

      alert("Proveedor actualizado correctamente");
    } else {
      const respuesta = await fetch(API_PROVEEDORES, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proveedor),
      });
      const data = await respuesta.json();

      if (!respuesta.ok) {
        alert(data.error || "Error al registrar proveedor");
        return;
      }

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
    const data = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(data.error || "Error al cargar proveedores");
    }

    proveedores = Array.isArray(data) ? data : [];

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

    if (!respuesta.ok) {
      alert(proveedor.error || "Error al obtener proveedor");
      return;
    }

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
    const respuesta = await fetch(`${API_PROVEEDORES}/${id}`, {
      method: "DELETE",
    });
    const data = await respuesta.json();

    if (!respuesta.ok) {
      alert(data.error || "Error al eliminar proveedor");
      return;
    }

    alert("Proveedor eliminado correctamente");
    cargarProveedores();
  } catch (error) {
    console.error("Error al eliminar proveedor:", error);
    alert("Error al eliminar proveedor");
  }
}

function validarProveedor(proveedor) {
  if (!proveedor.nombres || !proveedor.apellidos || !proveedor.razonSocial) {
    return "Nombres, apellidos y razon social son obligatorios";
  }

  if (proveedor.tipoDocumento === "DNI" && !/^\d{8}$/.test(proveedor.numeroDocumento)) {
    return "El DNI debe tener 8 digitos";
  }

  if (proveedor.tipoDocumento === "RUC" && !/^\d{11}$/.test(proveedor.numeroDocumento)) {
    return "El documento RUC debe tener 11 digitos";
  }

  if (proveedor.tipoDocumento === "CE" && !/^[A-Za-z0-9]{6,12}$/.test(proveedor.numeroDocumento)) {
    return "El carnet de extranjeria debe tener entre 6 y 12 caracteres";
  }

  if (!/^\d{11}$/.test(proveedor.ruc)) {
    return "El RUC del proveedor debe tener 11 digitos";
  }

  if (!/^9\d{8}$/.test(proveedor.telefono)) {
    return "El telefono debe empezar con 9 y tener 9 digitos";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proveedor.correo)) {
    return "El correo debe contener @ y un punto despues del dominio";
  }

  return null;
}
