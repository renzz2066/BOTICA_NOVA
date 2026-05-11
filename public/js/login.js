const formLogin = document.getElementById("formLogin");
const username = document.getElementById("username");
const password = document.getElementById("password");
const loginError = document.getElementById("loginError");

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const respuesta = await fetch("/api/auth/me");

    if (respuesta.ok) {
      const data = await respuesta.json();
      redirigirPorRol(data.usuario);
    }
  } catch (error) {
    console.error("No se pudo validar la sesion:", error);
  }
});

formLogin.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  try {
    const respuesta = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username.value.trim(),
        password: password.value,
      }),
    });

    const data = await respuesta.json();

    if (!respuesta.ok) {
      loginError.textContent = data.error || "No se pudo iniciar sesion";
      return;
    }

    redirigirPorRol(data.usuario);
  } catch (error) {
    console.error("Error al iniciar sesion:", error);
    loginError.textContent = "No se pudo conectar con el servidor";
  }
});

function redirigirPorRol(usuario) {
  if (usuario.rol === "CAJERO") {
    window.location.href = "ventas.html";
    return;
  }

  window.location.href = "dashboard.html";
}
