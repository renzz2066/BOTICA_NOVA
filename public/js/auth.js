const LINKS_SOLO_ADMIN = new Set(["proveedores.html", "productos.html", "lotes.html"]);

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const respuesta = await fetch("/api/auth/me");

    if (!respuesta.ok) {
      window.location.href = "login.html";
      return;
    }

    const data = await respuesta.json();
    configurarInterfazPorUsuario(data.usuario);
  } catch (error) {
    console.error("Error al validar sesion:", error);
    window.location.href = "login.html";
  }
});

function configurarInterfazPorUsuario(usuario) {
  if (usuario.rol === "CAJERO") {
    document.querySelectorAll("a").forEach((link) => {
      const href = link.getAttribute("href");

      if (LINKS_SOLO_ADMIN.has(href)) {
        link.remove();
      }
    });
  }

  mostrarUsuario(usuario);
}

function mostrarUsuario(usuario) {
  let usuarioContenedor = document.querySelector(".usuario");
  const barraSuperior = document.querySelector(".barra-superior");

  if (!usuarioContenedor && barraSuperior) {
    usuarioContenedor = document.createElement("div");
    usuarioContenedor.className = "usuario";
    barraSuperior.appendChild(usuarioContenedor);
  }

  if (!usuarioContenedor) {
    return;
  }

  usuarioContenedor.textContent = "";

  const icono = document.createElement("i");
  icono.className = "fa-solid fa-user";

  const texto = document.createElement("span");
  texto.textContent = `${usuario.username} (${usuario.rol})`;

  const btnSalir = document.createElement("button");
  btnSalir.type = "button";
  btnSalir.className = "btn-salir";
  btnSalir.title = "Cerrar sesion";
  btnSalir.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i>';
  btnSalir.addEventListener("click", cerrarSesion);

  usuarioContenedor.appendChild(icono);
  usuarioContenedor.appendChild(texto);
  usuarioContenedor.appendChild(btnSalir);
}

async function cerrarSesion() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
  } catch (error) {
    console.error("Error al cerrar sesion:", error);
  } finally {
    window.location.href = "login.html";
  }
}
