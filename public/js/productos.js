const API_PRODUCTOS = "/api/productos";
const API_CATEGORIAS = "/api/categorias";
const API_MARCAS = "/api/marcas";
const API_PRESENTACIONES = "/api/presentaciones";
const API_PROVEEDORES = "/api/proveedores";

const tablaProductos = document.getElementById("tablaProductos");
const modalProducto = document.getElementById("modalProducto");
const formProducto = document.getElementById("formProducto");
const tituloModal = document.getElementById("tituloModal");

const btnNuevo = document.getElementById("btnNuevo");
const btnCerrar = document.getElementById("btnCerrar");
const btnCancelar = document.getElementById("btnCancelar");
const inputBuscar = document.getElementById("inputBuscar");

const idProducto = document.getElementById("idProducto");
const codigo = document.getElementById("codigo");
const codigoBarras = document.getElementById("codigoBarras");
const nombre = document.getElementById("nombre");
const descripcion = document.getElementById("descripcion");
const precioVenta = document.getElementById("precioVenta");
const precioCompra = document.getElementById("precioCompra");
const idCategoria = document.getElementById("idCategoria");
const idMarca = document.getElementById("idMarca");
const idPresentacion = document.getElementById("idPresentacion");
const idProveedor = document.getElementById("idProveedor");
const unidadMedida = document.getElementById("unidadMedida");
const stockMinimo = document.getElementById("stockMinimo");
const requiereReceta = document.getElementById("requiereReceta");
const esControlado = document.getElementById("esControlado");

let productos = [];

document.addEventListener("DOMContentLoaded", async () => {
  await cargarCombos();
  await cargarProductos();
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

  const filtrados = productos.filter((producto) => {
    return (
      producto.Nombre.toLowerCase().includes(texto) ||
      producto.Codigo?.toLowerCase().includes(texto) ||
      producto.Categoria?.toLowerCase().includes(texto) ||
      producto.Marca?.toLowerCase().includes(texto)
    );
  });

  mostrarProductos(filtrados);
});

formProducto.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validarProducto()) {
    return;
  }

  const producto = {
    codigo: codigo.value.trim(),
    codigoBarras: codigoBarras.value.trim(),
    nombre: nombre.value.trim(),
    descripcion: descripcion.value.trim(),
    precioVenta: parseFloat(precioVenta.value),
    precioCompra: precioCompra.value ? parseFloat(precioCompra.value) : null,
    idCategoria: parseInt(idCategoria.value),
    idMarca: parseInt(idMarca.value),
    idPresentacion: parseInt(idPresentacion.value),
    idProveedor: idProveedor.value ? parseInt(idProveedor.value) : null,
    requiereReceta: requiereReceta.value,
    esControlado: esControlado.value,
    unidadMedida: unidadMedida.value.trim(),
    stockMinimo: stockMinimo.value ? parseInt(stockMinimo.value) : 0,
    usuarioRegistro: "admin",
    usuarioModifica: "admin",
  };

  try {
    let respuesta;

    if (idProducto.value) {
      respuesta = await fetch(`${API_PRODUCTOS}/${idProducto.value}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(producto),
      });
    } else {
      respuesta = await fetch(API_PRODUCTOS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(producto),
      });
    }

    const data = await respuesta.json();

    if (!respuesta.ok) {
      alert(data.error || "Error al guardar producto");
      return;
    }

    alert(idProducto.value ? "Producto actualizado correctamente" : "Producto registrado correctamente");

    cerrarModal();
    cargarProductos();
  } catch (error) {
    console.error("Error al guardar producto:", error);
    alert("Error al guardar producto");
  }
});

async function cargarProductos() {
  try {
    const respuesta = await fetch(API_PRODUCTOS);
    productos = await respuesta.json();

    mostrarProductos(productos);
  } catch (error) {
    console.error("Error al cargar productos:", error);
    tablaProductos.innerHTML = `
      <tr>
        <td colspan="10">Error al cargar productos</td>
      </tr>
    `;
  }
}

function mostrarProductos(lista) {
  if (lista.length === 0) {
    tablaProductos.innerHTML = `
      <tr>
        <td colspan="10">No hay productos registrados</td>
      </tr>
    `;
    return;
  }

  tablaProductos.innerHTML = lista
    .map((producto) => {
      return `
        <tr>
          <td>${producto.IdItem}</td>
          <td>${producto.Codigo || "-"}</td>
          <td>${producto.Nombre}</td>
          <td>${producto.Categoria}</td>
          <td>${producto.Marca}</td>
          <td>${producto.Presentacion}</td>
          <td>${producto.Proveedor || "-"}</td>
          <td>S/ ${Number(producto.PrecioVenta).toFixed(2)}</td>
          <td>${producto.StockMinimo}</td>
          <td>
            <div class="acciones-tabla">
              <button class="btn-icono btn-editar" onclick="editarProducto(${producto.IdItem})">
                <i class="fa-solid fa-pen"></i>
              </button>

              <button class="btn-icono btn-eliminar" onclick="eliminarProducto(${producto.IdItem})">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function cargarCombos() {
  await Promise.all([
    cargarSelect(API_CATEGORIAS, idCategoria, "IdCategoria", "Nombre", "Seleccione..."),
    cargarSelect(API_MARCAS, idMarca, "IdMarca", "Nombre", "Seleccione..."),
    cargarSelect(API_PRESENTACIONES, idPresentacion, "IdPresentacion", "Nombre", "Seleccione..."),
    cargarSelect(API_PROVEEDORES, idProveedor, "IdProveedor", "RazonSocial", "Sin proveedor"),
  ]);
}

async function cargarSelect(url, select, campoId, campoNombre, textoInicial) {
  try {
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    select.innerHTML = `<option value="">${textoInicial}</option>`;

    datos.forEach((item) => {
      select.innerHTML += `
        <option value="${item[campoId]}">${item[campoNombre]}</option>
      `;
    });
  } catch (error) {
    console.error("Error al cargar select:", error);
  }
}

function abrirModalNuevo() {
  tituloModal.textContent = "Nuevo producto";
  formProducto.reset();
  idProducto.value = "";
  stockMinimo.value = 0;
  requiereReceta.value = "N";
  esControlado.value = "N";
  modalProducto.classList.add("mostrar");
}

function cerrarModal() {
  modalProducto.classList.remove("mostrar");
}

async function editarProducto(id) {
  try {
    const respuesta = await fetch(`${API_PRODUCTOS}/${id}`);
    const producto = await respuesta.json();

    if (!respuesta.ok) {
      alert(producto.error || "Error al obtener producto");
      return;
    }

    tituloModal.textContent = "Editar producto";

    idProducto.value = producto.IdItem;
    codigo.value = producto.Codigo || "";
    codigoBarras.value = producto.CodigoBarras || "";
    nombre.value = producto.Nombre || "";
    descripcion.value = producto.Descripcion || "";
    precioVenta.value = producto.PrecioVenta || "";
    precioCompra.value = producto.PrecioCompra || "";
    idCategoria.value = producto.IdCategoria || "";
    idMarca.value = producto.IdMarca || "";
    idPresentacion.value = producto.IdPresentacion || "";
    idProveedor.value = producto.IdProveedor || "";
    unidadMedida.value = producto.UnidadMedida || "";
    stockMinimo.value = producto.StockMinimo || 0;
    requiereReceta.value = producto.RequiereReceta || "N";
    esControlado.value = producto.EsControlado || "N";

    modalProducto.classList.add("mostrar");
  } catch (error) {
    console.error("Error al obtener producto:", error);
    alert("Error al obtener producto");
  }
}

async function eliminarProducto(id) {
  const confirmar = confirm("¿Seguro que deseas eliminar este producto?");

  if (!confirmar) {
    return;
  }

  try {
    const respuesta = await fetch(`${API_PRODUCTOS}/${id}`, {
      method: "DELETE",
    });

    const data = await respuesta.json();

    if (!respuesta.ok) {
      alert(data.error || "Error al eliminar producto");
      return;
    }

    alert("Producto eliminado correctamente");
    cargarProductos();
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    alert("Error al eliminar producto");
  }
}

function validarProducto() {
  if (nombre.value.trim().length < 3) {
    alert("El nombre del producto debe tener al menos 3 caracteres");
    return false;
  }

  if (!precioVenta.value || parseFloat(precioVenta.value) <= 0) {
    alert("El precio de venta debe ser mayor a 0");
    return false;
  }

  if (precioCompra.value && parseFloat(precioCompra.value) < 0) {
    alert("El precio de compra no puede ser negativo");
    return false;
  }

  if (!idCategoria.value) {
    alert("Seleccione una categoría");
    return false;
  }

  if (!idMarca.value) {
    alert("Seleccione una marca");
    return false;
  }

  if (!idPresentacion.value) {
    alert("Seleccione una presentación");
    return false;
  }

  if (stockMinimo.value && parseInt(stockMinimo.value) < 0) {
    alert("El stock mínimo no puede ser negativo");
    return false;
  }

  return true;
}