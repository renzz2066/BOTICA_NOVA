const API_CHATBOT = "/api/chatbot";

const chatContenedor = document.getElementById("chatContenedor");
const mensajeInput = document.getElementById("mensajeInput");
const btnEnviar = document.getElementById("btnEnviar");

btnEnviar.addEventListener("click", () => {
  enviarMensaje();
});

mensajeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    enviarMensaje();
  }
});

async function enviarMensaje() {
  const mensaje = mensajeInput.value.trim();

  if (!mensaje) {
    alert("Escribe los síntomas del cliente");
    return;
  }

  agregarMensajeUsuario(mensaje);
  mensajeInput.value = "";

  try {
    const respuesta = await fetch(API_CHATBOT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mensaje }),
    });

    const data = await respuesta.json();

    if (!respuesta.ok) {
      agregarMensajeBot("Ocurrió un error al consultar el asistente.");
      return;
    }

    agregarRespuestaBot(data);
  } catch (error) {
    console.error("Error en chatbot:", error);
    agregarMensajeBot("No se pudo conectar con el asistente.");
  }
}

function agregarMensajeUsuario(texto) {
  chatContenedor.innerHTML += `
    <div class="mensaje-usuario">
      <div class="burbuja">
        ${texto}
      </div>
    </div>
  `;

  bajarScroll();
}

function agregarMensajeBot(texto) {
  chatContenedor.innerHTML += `
    <div class="mensaje-bot">
      <div class="burbuja">
        ${texto}
      </div>
    </div>
  `;

  bajarScroll();
}

function agregarRespuestaBot(data) {
  let html = `
    <div class="mensaje-bot">
      <div class="burbuja">
        <p>${data.respuesta}</p>
  `;

  if (data.productos && data.productos.length > 0) {
    html += `
      <div class="productos-chat">
        <h4>Productos sugeridos:</h4>
    `;

    data.productos.forEach((producto) => {
      html += `
        <div class="producto-chat">
          <strong>${producto.Nombre}</strong>
          <span>${producto.Descripcion || "Sin descripción"}</span>
          <span>Precio: S/ ${Number(producto.PrecioVenta).toFixed(2)}</span>
          <span>Stock: ${producto.StockDisponible}</span>
        </div>
      `;
    });

    html += `
      </div>
    `;
  }

  html += `
        <p class="nota-chat">
          Recomienda al cliente consultar con un profesional de salud si los síntomas son graves o persisten.
        </p>
      </div>
    </div>
  `;

  chatContenedor.innerHTML += html;
  bajarScroll();
}

function bajarScroll() {
  chatContenedor.scrollTop = chatContenedor.scrollHeight;
}