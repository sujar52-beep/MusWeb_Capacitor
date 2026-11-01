"use strict";

// =============================================
// 1. CONFIGURACIÓN
// =============================================

const REGLAS = {
    cartasPorJugador: 4,
    ordenGrande: [3, 12, 11, 10, 7, 6, 5, 4, 2, 1],
    ordenChica:  [1, 2, 4, 5, 6, 7, 10, 11, 12, 3],
    probabilidadMus: 0.9,
    lancesConEnvite: ["grande", "chica", "pares", "juego"],
    lancesActivos: ["grande", "chica", "pares", "juego"],
    // ▼▼▼ AÑADIR ESTAS ▼▼▼
    tantosParaGanarPartida: 25,       // cámbialo a 40 si prefieres partida larga
    partidasParaGanarJuego: 3         // a 3 partidas (o 5 si prefieres)
    // ▲▲▲ FIN ▲▲▲
};

const PALOS = [
    { nombre: "Oros",    archivo: "coins",  simbolo: "●", clase: "red" },
    { nombre: "Copas",   archivo: "cups",   simbolo: "♥", clase: "red" },
    { nombre: "Espadas", archivo: "swords", simbolo: "♠", clase: ""    },
    { nombre: "Bastos",  archivo: "clubs",  simbolo: "♣", clase: ""    }
];

const VALORES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

const NOMBRES = {
    1: "As", 2: "Dos", 3: "Tres", 4: "Cuatro", 5: "Cinco",
    6: "Seis", 7: "Siete", 10: "Sota", 11: "Caballo", 12: "Rey"
};

const PALOS_POR_JUGADOR = {
    3: "clubs", 
    0: "coins", 
    1: "cups", 
    2: "swords"
};

const TANTOS_POR_LANCE = {
    grande: 1, chica: 1, pares: 1, juego: 1
};

// =============================================
// 2. ESTADO
// =============================================

let baraja = [];
let jugadores = [];
let manoRepartida = false;
let fase = "inicio";
let mensajes = [];
let historialCompleto = [];
let historialAbierto = false;
let repartidorId = null;
let manoId = null;
let repartiendo = false;
let sorteoInicializado = false;
let manoNumero = 0;

let descartesRestantes = 4;
let descartesSeleccionados = [];
let montonDeDescartes = [];

let tantosNosotros = 0;
let tantosEllos = 0;
let partidasNosotros = 0;
let partidasEllos = 0;

let lanceActual = "grande";
let turnoEnviteId = null;
let turnoMusId = null; // Jugador al que le toca decidir si quiere mus.
let pasesConsecutivos = 0;
let respuestaIAEnCurso = false;
let tantosMano = {
    grande: { nosotros: 0, ellos: 0 },
    chica:  { nosotros: 0, ellos: 0 },
    pares:  { nosotros: 0, ellos: 0 },
    juego:  { nosotros: 0, ellos: 0 }
};

let envite = {
    activo: false,
    lance: null,
    ultimoEnvidante: null,
    respondiente: null,
    base: 0,
    pendiente: 0
};


let envitesPendientes = [];
let lancesCerradosPorEnvite = [];
let declaracionesPares = {};
let declaracionesJuego = {};
let turnoDeclaracion = null; // <-- AÑADIR ESTO

const $ = id => document.getElementById(id);

function getValorJuego(suma) {
    if (suma === 31) return 8;
    if (suma === 32) return 7;
    if (suma === 40) return 6;
    if (suma === 37) return 5;
    if (suma === 36) return 4;
    if (suma === 35) return 3;
    if (suma === 34) return 2;
    if (suma === 33) return 1;
    return 0; // No es una suma de juego válida
}

// =============================================
// 3. BARAJA
// =============================================

function crearBaraja() {
    const cartas = [];
    for (const palo of PALOS) {
        for (const valor of VALORES) {
            cartas.push({
                id: `${palo.archivo}_${String(valor).padStart(2, "0")}`,
                valor, nombre: NOMBRES[valor], palo: palo.nombre,
                archivoPalo: palo.archivo, simbolo: palo.simbolo, clase: palo.clase
            });
        }
    }
    return cartas;
}

function mezclar(cartas) {
    for (let i = cartas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cartas[i], cartas[j]] = [cartas[j], cartas[i]];
    }
    return cartas;
}

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================
// 4. RESALTAR LANCE
// =============================================

function resaltarLance(lance) {
    const columnas = { grande: 3, chica: 4, pares: 5, juego: 6 };
    const tabla = document.querySelector(".marcador-tabla");
    if (!tabla) return;

    tabla.querySelectorAll(".lance-activo").forEach(el => {
        el.classList.remove("lance-activo");
    });

    const columna = columnas[lance];
    if (!columna) return;

    const cabecera = tabla.querySelector(".marcador-cabecera");
    if (cabecera && cabecera.children[columna]) {
        cabecera.children[columna].classList.add("lance-activo");
    }

    const ids = {
        grande: ["puntos-grande-nosotros", "puntos-grande-ellos", "en-juego-grande"],
        chica:  ["puntos-chica-nosotros",  "puntos-chica-ellos",  "en-juego-chica"],
        pares:  ["puntos-pares-nosotros",  "puntos-pares-ellos",  "en-juego-pares"],
        juego:  ["puntos-juego-nosotros",  "puntos-juego-ellos",  "en-juego-juego"]
    };

    (ids[lance] || []).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("lance-activo");
    });
}

// =============================================
// 5. JUGADORES
// =============================================

function crearJugadores() {
    
    return [
        { id: 0, nombre: "Tú",              equipo: 0, cartas: [], humano: true,  posicion: "abajo"     },
        { id: 1, nombre: "Rival derecho",   equipo: 1, cartas: [], humano: false, posicion: "derecha"   },
        { id: 2, nombre: "Tu compañero",    equipo: 0, cartas: [], humano: false, posicion: "arriba"    },
        { id: 3, nombre: "Rival izquierdo", equipo: 1, cartas: [], humano: false, posicion: "izquierda" }
    ];
}

function encontrarJugadorPorPalo(archivoPalo) {
    for (const id in PALOS_POR_JUGADOR) {
        if (PALOS_POR_JUGADOR[id] === archivoPalo) return Number(id);
    }
    return null;
}

// =============================================
// 6. LIMPIEZA Y HUECOS
// =============================================

function limpiarMesa() {

        // Ocultar el texto "Mus" al limpiar la mesa
    const textoMus = $("texto-mus");
    if (textoMus) textoMus.classList.remove("visible");
    
    ["player-hand", "left-hand", "partner-hand", "right-hand"].forEach(id => {
        const el = $(id);
        if (el) el.replaceChildren();
    });

    ["player-status", "left-status", "partner-status", "right-status"].forEach(id => {
        const el = $(id);
        if (el) el.textContent = "Esperando";
    });

    const ayuda = $("discard-help");
    if (ayuda) ayuda.textContent = "";

    // ▼▼▼ Ocultar el mazo al limpiar la mesa (se volverá a mostrar en el reparto) ▼▼▼
    const mazo = $("mazo-fijo");
    if (mazo) mazo.classList.remove("visible");

    ocultarCartaSorteo();
}

function reservarHuecos() {
    const contenedores = {
        0: "player-hand", 
        1:"right-hand", 
        2: "partner-hand", 
        3: "left-hand"
    };

    for (const id of Object.values(contenedores)) {
        const contenedor = $(id);
        if (!contenedor) continue;
        contenedor.replaceChildren();

        for (let i = 0; i < REGLAS.cartasPorJugador; i++) {
            const hueco = document.createElement("div");
            hueco.className = "card-slot";
            hueco.dataset.indice = String(i);
            contenedor.append(hueco);
        }
    }
}
// =============================================
// 7. CARTA DEL SORTEO
// =============================================

function mostrarCartaSorteo(carta) {
    const musOverlay = $("mus-text-overlay");
    if (musOverlay) musOverlay.classList.remove("visible");
    
    const contenedor = $("carta-sorteo");
    if (!contenedor) return;

    contenedor.replaceChildren();

    const cartaEl = crearCartaVisual(carta);

    const texto = document.createElement("div");
    texto.className = "carta-palo-texto";
    texto.textContent = `${carta.nombre} de ${carta.palo}`;

    const envoltorio = document.createElement("div");
    envoltorio.style.display = "flex";
    envoltorio.style.flexDirection = "column";
    envoltorio.style.alignItems = "center";
    envoltorio.append(cartaEl, texto);

    contenedor.append(envoltorio);
    contenedor.classList.add("visible");
}

function ocultarCartaSorteo() {
    const contenedor = $("carta-sorteo");
    if (contenedor) {
        contenedor.classList.remove("visible");
        contenedor.replaceChildren();
    }

    const musOverlay = $("mus-text-overlay");
    if (musOverlay) musOverlay.classList.add("visible");
}

// =============================================
// 8. NUEVA MANO
// =============================================

async function nuevaMano() {
    limpiarBocadillos();
    if (repartiendo) return;

        // Limpiar puntos extra
    const betArea = $("bet-area");
    if (betArea) {
        betArea.querySelectorAll(".puntos-jugador").forEach(el => el.remove());
    }
    $("mus-text-overlay")?.classList.remove("visible");

    repartiendo = true;
    manoRepartida = false;
    fase = "sorteo";
    actualizarBotones();
    limpiarMesa();
    reiniciarApuestas();

    try {
        prepararHerramientasPartida();
        limpiarMesa();
        reiniciarApuestas();
        reiniciarTantosMano();
        envitesPendientes = [];
        lancesCerradosPorEnvite = [];
        actualizarMarcaEnJuego();

        baraja = [];
        jugadores = crearJugadores();
        mensajes = [];
        renderizarMensajes();

        manoNumero++;
        descartesRestantes = 4;
        descartesSeleccionados = [];
        lanceActual = "grande";
        actualizarMarcador();

        // 1. SORTEO INICIAL
        if (!sorteoInicializado) {
            $("message").textContent = "Sorteando quién reparte";
            $("phase").textContent = "Se extrae una carta al azar del mazo";
            
            const mazoSorteo = mezclar(crearBaraja());
            const cartaSorteo = mazoSorteo.pop();

            repartidorId = encontrarJugadorPorPalo(cartaSorteo.archivoPalo);
            
            // Protección: si por lo que sea no encuentra el palo, elegimos uno al azar.
            if (repartidorId === null || repartidorId === undefined || !jugadores[repartidorId]) {
            repartidorId = Math.floor(Math.random() * jugadores.length); }

            mostrarCartaSorteo(cartaSorteo);
            registrar(`Sorteo inicial: ${cartaSorteo.nombre} de ${cartaSorteo.palo}.`);
            
            // Protección extra: comprobar que el jugador existe antes de leer su nombre
            const nombreRepartidor = jugadores[repartidorId] ? jugadores[repartidorId].nombre : "Alguien";
            registrar(`Le corresponde repartir a ${nombreRepartidor}.`);

            await esperar(1600);
            ocultarCartaSorteo();     
            $("mus-text-overlay")?.classList.add("visible");
            
            sorteoInicializado = true;     
                        
                    
                
            } else {
                repartidorId = (repartidorId + 1) % jugadores.length;
            }

            // Ocultar "Mus" mientras se realiza un nuevo sorteo.
            const textoMus = $("texto-mus");
            if (textoMus) textoMus.classList.remove("visible");


        // 2. ASIGNACIÓN DEL MANO
        manoId = (repartidorId + 1) % jugadores.length;
        const nombreMano = jugadores[manoId] ? jugadores[manoId].nombre : "Alguien";
        registrar(`Es mano ${nombreMano}.`);
        actualizarMarcaMano();

        // 3. REPARTO
        baraja = mezclar(crearBaraja());
        const ordenReparto = [];
        for (let paso = 1; paso < jugadores.length; paso++) {
            ordenReparto.push((repartidorId + paso) % jugadores.length);
        }
        ordenReparto.push(repartidorId);

        // ▼▼▼ REPARTO BLINDADO ▼▼▼
        for (let ronda = 0; ronda < REGLAS.cartasPorJugador; ronda++) {
            for (const indiceJugador of ordenReparto) {
                // Si por algún motivo el jugador no existe, nos lo saltamos
                if (!jugadores[indiceJugador]) continue; 
                
                const carta = baraja.pop();
                if (carta) {
                    jugadores[indiceJugador].cartas.push(carta);
                }
            }
        }
        // ▲▲▲ FIN DEL REPARTO BLINDADO ▲▲▲
        reservarHuecos();
        $("message").textContent = "Repartiendo las cartas";
        
        const nombreRepartidor = jugadores[repartidorId] ? jugadores[repartidorId].nombre : "Alguien";
        $("phase").textContent = `Mano ${manoNumero} · Reparte ${nombreRepartidor}`;
        $("player-status").textContent = "Esperando el reparto";

        await animarReparto();
        renderizarMesa();

        registrar(`Comienza la mano ${manoNumero}.`);
        registrar(`Reparte ${nombreRepartidor}.`);

        // 4. FASE DE MUS
        fase = "mus";
        manoRepartida = true;
        turnoMusId = manoId;
        
        $("message").textContent = "Ronda de mus";
        $("phase").textContent = `Empieza ${jugadores[turnoMusId].nombre}, que es mano`;
        
        procesarTurnoMus();

    } catch (error) {
        console.error("Error durante el reparto:", error);
        registrar("Error en el reparto. Revisa la consola.");
    } finally {
        repartiendo = false;
        actualizarBotones();
    }
}

function actualizarMarcaMano() {
    // Indicadores nuevos: se muestran dentro del borde de la caja de apuestas.
    const ids = {
        0: "mano-marca-abajo",      // Tú, abajo
        1: "mano-marca-derecha",    // Rival derecho
        2: "mano-marca-arriba",     // Compañero, arriba
        3: "mano-marca-izquierda"   // Rival izquierdo
    };

    const todos = [
        "mano-marca-abajo",
        "mano-marca-arriba",
        "mano-marca-izquierda",
        "mano-marca-derecha"
    ];

    // Ocultar todos antes de mostrar el que corresponda.
    todos.forEach(id => {
        const marca = document.getElementById(id);
        if (marca) marca.hidden = true;
    });

    const idMarca = ids[Number(manoId)];
    const marca = idMarca ? document.getElementById(idMarca) : null;
    if (marca) {
        marca.hidden = false;
        marca.setAttribute("aria-label", `Mano: ${jugadores[manoId]?.nombre || "jugador"}`);
    }
}

// =============================================
// 9. DIBUJAR CARTAS
// ==============================================

function crearCartaVisual(carta, oculta = false) {
    const elemento = document.createElement("div");
    elemento.className = "card";

    if (oculta) {
        elemento.classList.add("back");
        elemento.setAttribute("aria-label", "Carta boca abajo");
        return elemento;
    }

    const imagen = document.createElement("img");
    imagen.src = `cartas/card_${carta.archivoPalo}_${String(carta.valor).padStart(2, "0")}.png`;
    imagen.alt = `${carta.nombre} de ${carta.palo}`;
    imagen.title = imagen.alt;

    imagen.addEventListener("error", () => {
        imagen.remove();
        const reserva = document.createElement("div");
        reserva.className = `card-fallback ${carta.clase}`;

        const nombre = document.createElement("span");
        nombre.textContent = carta.nombre;
        const simbolo = document.createElement("span");
        simbolo.className = "suit";
        simbolo.textContent = carta.simbolo;
        const valor = document.createElement("strong");
        valor.textContent = carta.valor;

        reserva.append(nombre, simbolo, valor);
        elemento.append(reserva);
    }, { once: true });

    elemento.append(imagen);
    return elemento;
}

function mostrarCartas(contenedorId, cartas, ocultas = false) {
    const contenedor = $(contenedorId);
    if (!contenedor) return;

    contenedor.replaceChildren();
    for (const carta of cartas) {
        contenedor.append(crearCartaVisual(carta, ocultas));
    }
}

function renderizarMesa() {
    mostrarCartas("player-hand",  jugadores[0].cartas);
    mostrarCartas("right-hand",   jugadores[1].cartas, true);
    mostrarCartas("partner-hand", jugadores[2].cartas, true);
    mostrarCartas("left-hand",    jugadores[3].cartas, true);

    $("left-status").textContent    = "Rival";
    $("partner-status").textContent = "Compañero";
    $("right-status").textContent   = "Rival";

    renderizarMensajes();
    actualizarMarcaEnJuego();
}

function colocarMazoAIRepartidor() {
    const mazo = $("mazo-fijo");
    const mesa = document.querySelector(".table");
    if (!mazo || !mesa) return;

    const slots = {
        0: "mazo-slot-player",   // Tú
        1: "mazo-slot-right",    // Rival derecho
        2: "mazo-slot-partner",  // Compañero
        3: "mazo-slot-left"      // Rival izquierdo
    };

    const slot = $(slots[repartidorId]);
    if (!slot) return;

    mazo.classList.add("visible");

    const rectMesa = mesa.getBoundingClientRect();
    const ancho = mazo.offsetWidth || 96;
    const alto = mazo.offsetHeight || 148;

    // Valores por defecto (para ti y tu compañero)
    let centroX, centroY;

    // 🔥 AQUÍ CONTROLAS LA POSICIÓN EXACTA DE LOS RIVALES 🔥
       if (Number(repartidorId) === 3) {
        // --- RIVAL IZQUIERDO ---
        // Si has movido las cartas con margin-left: 60px, 
        // el mazo debe moverse también. Ajusta centroX.
        centroX = 75;   // Antes era 60. Auméntalo si mueves las cartas a la derecha.
        centroY = 630;
    } 
    else if (Number(repartidorId) === 1) {
        // --- RIVAL DERECHO ---
        // Si has movido las cartas con margin-right: 60px,
        // el mazo debe moverse también. Ajusta centroX.
        centroX = rectMesa.width -70; // Antes era -60.
        centroY = 35;
    } 
    else {
        // --- TÚ Y COMPAÑERO (Usan el hueco dinámico) ---
        const rectSlot = slot.getBoundingClientRect();
        centroX = rectSlot.left + rectSlot.width / 2 - rectMesa.left;
        centroY = rectSlot.top + rectSlot.height / 2 - rectMesa.top;
    }

    // Rotamos el mazo solo para los rivales laterales
    mazo.style.transformOrigin = "center center";
    mazo.style.transform = (Number(repartidorId) === 3 || Number(repartidorId) === 1) ? "rotate(90deg)" : "none";

    // Aplicamos la posición final
    mazo.style.left = `${centroX - ancho / 2}px`;
    mazo.style.top = `${centroY - alto / 2}px`;
}
async function animarReparto() {
    const mazo = $("mazo-fijo");
    if (!mazo) return;

    const duracionVuelo =405; // <-- ¡CAMBIA AQUÍ LA VELOCIDAD! (en milisegundos)

    const contenedores = {
        0: "player-hand",
        1: "right-hand",
        2: "partner-hand",
        3: "left-hand"
    };

    // 1. Creamos las cartas apiladas del mazo.
    mazo.replaceChildren();
    for (let i = 0; i < 4; i++) {
        const carta = document.createElement("div");
        carta.className = "card back";
        carta.style.transform = `translate(${i * 2}px, ${i * -2}px)`;
        mazo.appendChild(carta);
    }

    // 2. Posicionamos el mazo junto al jugador que reparte.
    colocarMazoAIRepartidor();

    // Recalcular antes de iniciar las animaciones.
  await new Promise(resolve => requestAnimationFrame(resolve));
    colocarMazoAIRepartidor(); // <-- Esto está perfecto, asegúrate de que se mantenga.
    // 3. Orden de reparto
    const ordenReparto = [];
    for (let paso = 1; paso < jugadores.length; paso++) {
        ordenReparto.push((repartidorId + paso) % jugadores.length);
    }
    ordenReparto.push(repartidorId);

    // 4. Animación
    for (let ronda = 0; ronda < REGLAS.cartasPorJugador; ronda++) {
        for (const indiceJugador of ordenReparto) {
            const contenedor = $(contenedores[indiceJugador]);
            if (!contenedor) continue;

            const hueco = contenedor.querySelector(`.card-slot[data-indice="${ronda}"]`);
            if (!hueco) continue;

            const rectDestino = hueco.getBoundingClientRect();
            const rectMazo = mazo.getBoundingClientRect();

            const cartaVoladora = document.createElement("div");
            cartaVoladora.className = "card back";

            Object.assign(cartaVoladora.style, {
                position: "fixed",
                left: `${rectMazo.left}px`,
                top: `${rectMazo.top}px`,
                width: `${rectDestino.width}px`,
                height: `${rectDestino.height}px`,
                margin: "0",
                zIndex: "1100",
                pointerEvents: "none",
                transition: `left ${duracionVuelo}ms ease, top ${duracionVuelo}ms ease`,
                boxShadow: "0 3px 8px #0008"
            });

            document.body.appendChild(cartaVoladora);
            cartaVoladora.getBoundingClientRect();

            cartaVoladora.style.left = `${rectDestino.left}px`;
            cartaVoladora.style.top = `${rectDestino.top}px`;

            await esperar(duracionVuelo + 10);
            cartaVoladora.remove();

            const cartaReal = jugadores[indiceJugador].cartas[ronda];
            const oculta = indiceJugador !== 0;
            const cartaFinal = crearCartaVisual(cartaReal, oculta);
            cartaFinal.classList.add("carta-recien-llegada");

            contenedor.replaceChild(cartaFinal, hueco);
            await esperar(45);
        }
    }

    // 5. Dejar el mazo en su posición final (encima del hueco)
    colocarMazoAIRepartidor();
}

async function animarRepartoDeNuevasCartas(cartasPorJugador) {
    const mazo = $("mazo-fijo");
    if (!mazo) return;

    colocarMazoAIRepartidor();
    await new Promise(resolve => requestAnimationFrame(resolve));

    const duracionVuelo = 550;8
    const contenedores = { 0: "player-hand", 1: "right-hand", 2: "partner-hand", 3: "left-hand" };
    const ordenReparto = [];
    for (let paso = 1; paso < jugadores.length; paso++) {
        ordenReparto.push((repartidorId + paso) % jugadores.length);
    }
    ordenReparto.push(repartidorId);

    for (const indiceJugador of ordenReparto) {
        const numCartas = cartasPorJugador[indiceJugador] || 0;
        if (numCartas === 0) continue;

        const contenedor = $(contenedores[indiceJugador]);
        if (!contenedor) continue;

        for (let i = 0; i < numCartas; i++) {
            if (baraja.length === 0) {
                if (montonDeDescartes.length === 0) {
                    registrar("¡No quedan cartas ni en el mazo ni en los descartes!");
                    console.error("Se acabaron las cartas de la baraja y no hay descartes para rebuscar.");
                    continue;
                }
                registrar("Mazo agotado. Rebuscando de los descartes...");
                baraja = mezclar(montonDeDescartes);
                montonDeDescartes = [];
                $('descarte-central').classList.add('hidden');
            }
            const nuevaCarta = baraja.pop();
            if (!nuevaCarta) {
                console.error("Error crítico: No se pudo obtener una carta ni siquiera después de rebuscar.");
                continue;
            }

            const hueco = contenedor.querySelector('.card-slot');
            if (!hueco) {
                console.error(`No se encontró hueco para el jugador ${indiceJugador} en el descarte.`);
                continue;
            }

            const rectDestino = hueco.getBoundingClientRect();
            const rectMazo = mazo.getBoundingClientRect();

            const cartaVoladora = document.createElement("div");
            cartaVoladora.className = "card back";
            Object.assign(cartaVoladora.style, {
                position: "fixed",
                left: `${rectMazo.left}px`,
                top: `${rectMazo.top}px`,
                width: `${rectDestino.width}px`,
                height: `${rectDestino.height}px`,
                margin: "0",
                zIndex: "1100",
                pointerEvents: "none",
                transition: `left ${duracionVuelo}ms ease, top ${duracionVuelo}ms ease`,
                boxShadow: "0 3px 8px #0008"
            });

            document.body.appendChild(cartaVoladora);
            await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));

            cartaVoladora.style.left = `${rectDestino.left}px`;
            cartaVoladora.style.top = `${rectDestino.top}px`;

            await esperar(duracionVuelo + 10);
            cartaVoladora.remove();

            jugadores[indiceJugador].cartas.push(nuevaCarta);

            const oculta = indiceJugador !== 0;
            const cartaFinal = crearCartaVisual(nuevaCarta, oculta);
            cartaFinal.classList.add("carta-recien-llegada");

            hueco.replaceWith(cartaFinal);
        }
    }

    // Al final, solo reordenamos los datos de la mano del jugador.
    // La visualización se hará en renderizarMesa()
    jugadores[0].cartas.sort((a, b) => REGLAS.ordenGrande.indexOf(b.valor) - REGLAS.ordenGrande.indexOf(a.valor));
}
async function ejecutarDescarte() {
    if (fase !== "descarte") return;

    $("confirm-discard-btn").disabled = true;
    $("discard-help").textContent = "";
    registrar("--- Fase de descarte ---");

    const descartesPorJugador = {};
    const indicesSeleccionados = Array.from(document.querySelectorAll("#player-hand .card.seleccionada"))
        .map(el => parseInt(el.dataset.indice, 10));

    descartesPorJugador[0] = indicesSeleccionados.map(idx => jugadores[0].cartas[idx]);

    for (let i = 1; i < 4; i++) {
        const indicesIA = decidirDescartesIA(jugadores[i]);
        descartesPorJugador[i] = indicesIA.map(idx => jugadores[i].cartas[idx]);
    }

    const descarteCentralEl = $('descarte-central');
    descarteCentralEl.classList.remove('hidden');
    descarteCentralEl.innerHTML = '';
    await animarDescarteHaciaMonton(descartesPorJugador);

    const cartasARepartir = {};
    const contenedores = { 0: "player-hand", 1: "right-hand", 2: "partner-hand", 3: "left-hand" };

    for (let i = 0; i < 4; i++) {
        const cartasADescartar = descartesPorJugador[i] || [];
        if (cartasADescartar.length > 0) {
            montonDeDescartes.push(...cartasADescartar);
        }
        cartasARepartir[i] = cartasADescartar.length;

        if (cartasADescartar.length > 0) {
            const indicesOriginales = cartasADescartar.map(c => jugadores[i].cartas.findIndex(orig => orig.id === c.id)).filter(idx => idx > -1);
            
            const contenedor = $(contenedores[i]);
            if (contenedor) {
                indicesOriginales.forEach(indice => {
                    if (contenedor.children[indice]) {
                        const hueco = document.createElement("div");
                        hueco.className = "card-slot";
                        contenedor.children[indice].replaceWith(hueco);
                    }
                });
            }
            
            indicesOriginales.sort((a, b) => b - a).forEach(indice => {
                jugadores[i].cartas.splice(indice, 1);
            });
        }
    }

    await esperar(300);
    descarteCentralEl.classList.add('hidden');

    await animarRepartoDeNuevasCartas(cartasARepartir);

    // Iniciar una nueva ronda de MUS tras reponer las cartas.
    // procesarTurnoMus() solo funciona cuando fase === "mus"; usar
    // "mus-resuelto" dejaba la partida bloqueada y todos los botones apagados.
    fase = "mus";
    turnoMusId = manoId;

    $("message").textContent = "Ronda de mus";
    $("phase").textContent = `Empieza ${jugadores[turnoMusId].nombre}, que es mano`;
    $("player-status").textContent = "Esperando tu turno de mus";

    // Actualizar la mesa y activar los controles que correspondan a la fase MUS.
    renderizarMesa();
    actualizarBotones();

    // Reanudar la secuencia de decisiones desde el jugador mano.
    procesarTurnoMus();
}
// =============================================
// 10. LOG
// =============================================

// Muestra un bocadillo encima del jugador durante unos segundos.
function mostrarBocadillo(idJugador, texto, tipo = "normal") {
    const contenedores = {
        0: "player-hand",
        1: "right-hand",
        2: "partner-hand",
        3: "left-hand"
    };

    const contenedorCartas = $(contenedores[idJugador]);
    if (!contenedorCartas) return;

    // El bocadillo se cuelga del jugador, no de la mano de cartas girada.
    const padre = contenedorCartas.closest('.player') || contenedorCartas.parentElement;
    if (!padre) return;

    const anterior = padre.querySelector('.bocadillo');
    if (anterior) anterior.remove();

    const boca = document.createElement('div');
    const posicion = { 0: 'bocadillo-abajo', 1: 'bocadillo-derecha', 2: 'bocadillo-arriba', 3: 'bocadillo-izquierda' }[idJugador] || '';
    boca.className = `bocadillo ${tipo} ${posicion} bocadillo-jugador-${idJugador}`;
    boca.textContent = texto;
    
    padre.appendChild(boca);
    
    setTimeout(() => {
        boca.classList.add('visible');
    }, 10);

    // Los bocadillos permanecen visibles durante todo este lance.
    // Se limpian juntos cuando comienza el siguiente lance.
}

function limpiarBocadillos() {
    document.querySelectorAll('.player .bocadillo').forEach(boca => boca.remove());
}
function registrar(mensaje) {
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    historialCompleto.push(`[${hora}] Mano ${manoNumero || 0}: ${mensaje}`);
    mensajes.unshift(mensaje);
    mensajes = mensajes.slice(0, 5);
    renderizarMensajes();
    renderizarHistorial();
}

function renderizarMensajes() {
    const log = $("log");
    if (!log) return;
    log.replaceChildren();
    for (const mensaje of mensajes) {
        const linea = document.createElement("div");
        linea.textContent = mensaje;
        log.append(linea);
    }
}

function prepararHerramientasPartida() {
    if (!$('historial-partida-btn')) {
        const boton = document.createElement('button');
        boton.id = 'historial-partida-btn';
        boton.type = 'button';
        boton.textContent = 'Historial de partida';
        boton.addEventListener('click', () => {
            const panel = $('historial-partida-panel');
            if (!panel) return;
            panel.hidden = !panel.hidden;
            historialAbierto = !panel.hidden;
            if (!panel.hidden) renderizarHistorial();
        });
        const referencia = $('new-btn');
        const contenedor = referencia?.parentElement || document.body;
        contenedor.appendChild(boton);
    }
    if (!$('historial-partida-panel')) {
        const panel = document.createElement('section');
        panel.id = 'historial-partida-panel';
        panel.hidden = true;
        panel.innerHTML = '<div class="historial-cabecera"><strong>Historial de partida</strong><button type="button" id="cerrar-historial-btn">Cerrar</button></div><pre id="historial-partida-texto"></pre><div class="historial-acciones"><button type="button" id="ver-historial-pestana-btn">Ver en pestaña nueva</button><button type="button" id="descargar-historial-btn">Descargar TXT</button><button type="button" id="copiar-historial-btn">Copiar historial</button></div>';
        document.body.appendChild(panel);
        $('cerrar-historial-btn').addEventListener('click', () => { panel.hidden = true; historialAbierto = false; });
        $('descargar-historial-btn').addEventListener('click', descargarHistorial);
        $('ver-historial-pestana-btn').addEventListener('click', abrirHistorialEnPestana);
        $('copiar-historial-btn').addEventListener('click', async () => {
            const contenido = historialCompleto.join('\n');
            try { await navigator.clipboard.writeText(contenido); registrar('Historial copiado al portapapeles.'); }
            catch { alert('No se pudo copiar automáticamente. Puedes seleccionar el texto del historial y copiarlo.'); }
        });
    }
    
    renderizarHistorial();
}

function renderizarHistorial() {
    const texto = $('historial-partida-texto');
    if (texto) texto.textContent = historialCompleto.length ? historialCompleto.join('\n') : 'Todavía no hay acciones registradas.';
}

function descargarHistorial() {
    const contenido = historialCompleto.join('\r\n') || 'Todavía no hay acciones registradas.';
    const archivo = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'historial-partida-mus.txt';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
}

function abrirHistorialEnPestana() {
    const contenido = historialCompleto.join('\r\n') || 'Todavía no hay acciones registradas.';
    const archivo = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(archivo);
    const pestana = window.open(url, '_blank');
    if (!pestana) {
        alert('El navegador ha bloqueado la pestaña nueva. Permite las ventanas emergentes para este proyecto o utiliza «Descargar TXT».');
        URL.revokeObjectURL(url);
        return;
    }
    // Mantener la URL disponible mientras la pestaña nueva carga el archivo.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function actualizarResumenPuntosMano() {
    if (!jugadores.length) return;
    
    const hayPares = hayParesEnMesa();
    const hayJuego = hayJuegoEnMesa();
    
    // Obtenemos el jugador ganador de cada lance (el que tiene la mejor jugada)
    const ganadorPares = hayPares ? obtenerGanadorLance("pares") : null;
    const ganadorJuego = obtenerGanadorLance("juego");
    
    const nosotros = $("extras-nosotros");
    const ellos = $("extras-ellos");
    const detalle = $("extras-detalle-jugadores");
    if (detalle) detalle.replaceChildren();
    
    const totalesExtras = { nosotros: 0, ellos: 0 };

    for (const jugador of jugadores) {
        const pares = analizarPares(jugador);
        const juego = analizarJuego(jugador);
        const equipo = jugador.equipo === 0 ? "nosotros" : "ellos";
        
        // SOLO sumamos si el jugador pertenece al equipo GANADOR del lance
        const ganaPares = !!(ganadorPares && ganadorPares.equipo === jugador.equipo);
        const ganaJuego = !!(ganadorJuego && ganadorJuego.equipo === jugador.equipo);
        
        const puntosPares = ganaPares && pares.tipo ? pares.puntos : 0;
        let puntosJuego = 0;
        
        if (hayJuego && ganaJuego && juego.tieneJuego) {
            puntosJuego = juego.suma === 31 ? 3 : 2;
        } else if (!hayJuego && ganadorJuego && ganadorJuego.id === jugador.id) {
            // En el caso de Punto (nadie tiene juego), solo el jugador con la suma más alta suma 1
            puntosJuego = 1;
        }
        
        // Si el jugador NO es del equipo ganador, sus puntos son 0 (no suman)
        if (!ganaPares && pares.tipo) {
            // Opcional: registrar que tiene pares pero no suma
        }
        
        totalesExtras[equipo] += puntosPares + puntosJuego;
        
        if (detalle) {
            const fila = document.createElement("div");
            fila.className = "puntos-extras-jugador";
            const nombre = document.createElement("strong");
            nombre.textContent = jugador.nombre;
            const conceptos = document.createElement("span");
            
            // Mostramos los puntos reales, pero solo los del equipo ganador
            const paresTexto = puntosPares ? `${pares.nombre} +${puntosPares}` : "Pares +0";
            const juegoTexto = puntosJuego ? `${hayJuego ? `Juego ${juego.suma}` : `Punto ${juego.suma}`} +${puntosJuego}` : "Juego/punto +0";
            conceptos.textContent = `${paresTexto} · ${juegoTexto}`;
            
            const total = document.createElement("b");
            total.textContent = `+${puntosPares + puntosJuego}`;
            
            fila.append(nombre, conceptos, total);
            detalle.appendChild(fila);
        }
    }
    
    if (nosotros) nosotros.textContent = `+${totalesExtras.nosotros}`;
    if (ellos) ellos.textContent = `+${totalesExtras.ellos}`;
}

// =============================================
// 11. IA
// =============================================

function valorGrande(carta) { return REGLAS.ordenGrande.indexOf(carta.valor); }

function contarRepeticiones(cartas) {
    const contador = {};
    for (const carta of cartas) {
        const valor = carta.valor === 3 ? 12 :
                      carta.valor === 2 ? 1  : carta.valor;
        contador[valor] = (contador[valor] || 0) + 1;
    }
    return Object.values(contador).sort((a, b) => b - a);
}

function iaQuiereMus(jugador) {
    const grupos = contarRepeticiones(jugador.cartas);
    const valores = jugador.cartas.map(valorGrande);

    const tienePareja = grupos.some(cantidad => cantidad >= 2);
    const cartasAltas = valores.filter(valor => valor <= 2).length;

    if (tienePareja || cartasAltas >= 3) return Math.random() < 0.8;
    return Math.random() < REGLAS.probabilidadMus;
}
function dibujarPuntosJugadores() {
    const betArea = $("bet-area");
    if (!betArea || !jugadores.length) return;
    betArea.querySelectorAll(".puntos-jugador").forEach(el => el.remove());

    const hayPares = hayParesEnMesa();
    const hayJuego = hayJuegoEnMesa();
    const ganadorPares = hayPares ? obtenerGanadorLance("pares") : null;
    const ganadorJuego = obtenerGanadorLance("juego");

    for (const jugador of jugadores) {
        const lineas = [];
        const pares = analizarPares(jugador);
        const juego = analizarJuego(jugador);

        const ganaPares = ganadorPares && ganadorPares.equipo === jugador.equipo;
        const ganaJuego = ganadorJuego && ganadorJuego.id === jugador.id; // Para el Punto, solo gana el jugador concreto

        // Pares
        if (ganaPares && pares.tipo) {
            const nombre = pares.nombre === "Pares" ? "Pareja" : pares.nombre;
            lineas.push(`${nombre}: +${pares.puntos}`);
        }

        // Juego o Punto
        if (hayJuego) {
            // Si hay juego, solo suma el equipo ganador
            if (ganadorJuego.equipo === jugador.equipo && juego.tieneJuego) {
                lineas.push(`Juego (${juego.suma}): +${juego.suma === 31 ? 3 : 2}`);
            }
        } else {
            // Si nadie tiene juego, es Punto. Solo el ganador del Punto suma.
            if (ganaJuego) {
                lineas.push(`Punto (${juego.suma}): +1`);
            }
        }

        if (lineas.length) {
            const contenedor = document.createElement("div");
            const posClass = { 
                0: "puntos-jugador-abajo", 
                1: "puntos-jugador-derecha", 
                2: "puntos-jugador-arriba", 
                3: "puntos-jugador-izquierda" 
            }[jugador.id];
            
            contenedor.className = `puntos-jugador ${posClass}`;

            for (const texto of lineas) {
                const linea = document.createElement("div");
                linea.className = "puntos-jugador-linea";
                linea.textContent = texto;
                contenedor.appendChild(linea);
            }
            betArea.appendChild(contenedor);
        }
    }
}
// =============================================
// 12. BOTONES
// =============================================

function actualizarBotones() {
    const ocupado = repartiendo || fase === "repartiendo" || fase === "sorteo";

    if (!jugadores || jugadores.length === 0 || !jugadores[0] || !jugadores[0].cartas) {
        $("new-btn").disabled = ocupado;
        actualizarVisibilidadPanel();
        return;
    }

    // ¿Estamos en fase de declarar y es tu turno?
    const enDeclaracion = (fase === "declararPares" || fase === "declararJuego") && !ocupado;
    const esMiTurnoDeclaracion = enDeclaracion && turnoDeclaracion === 0;

    const enMus = fase === "mus" && !ocupado && turnoMusId === 0;
    const enDescarte = fase === "descarte" && !ocupado;

    $("new-btn").disabled = ocupado;
    $("mus-btn").disabled = !enMus;
    $("cut-btn").disabled = !enMus;

    if ($("confirm-discard-btn")) {
        $("confirm-discard-btn").disabled = !enDescarte;
    }

    // SI ES MI TURNO DE DECLARAR
    if (esMiTurnoDeclaracion) {
        $("declarar-si-btn").disabled = false;
        $("declarar-no-btn").disabled = false;

        $("bet-stones-btn").disabled = true;
        $("bet-amarracos-btn").disabled = true;
        $("pass-bet-btn").disabled = true;
        $("accept-bet-btn").disabled = true;
        $("decline-bet-btn").disabled = true;

        actualizarVisibilidadPanel();
        return;
    } else {
        $("declarar-si-btn").disabled = true;
        $("declarar-no-btn").disabled = true;
    }

    // LÓGICA NORMAL DE ENVITES
    const enGrande = fase === "grande" && !ocupado;
    const esTurnoHumano = turnoEnviteId === 0;
    const debesResponder = envite.activo && envite.respondiente === 0;

    let rivalPuedeAceptar = true;

    if (lanceActual === "pares") {
        rivalPuedeAceptar = jugadores
            .filter(j => j.equipo === 1)
            .some(j => analizarPares(j).tipo > 0);

    } else if (lanceActual === "juego" && hayJuegoEnMesa()) {
        rivalPuedeAceptar = jugadores
            .filter(j => j.equipo === 1)
            .some(j => analizarJuego(j).tieneJuego);
    }

    const puedoAbrirEnvite =
        enGrande &&
        esTurnoHumano &&
        !envite.activo &&
        jugadorPuedeIntervenir(jugadores[0], lanceActual) &&
        rivalPuedeAceptar;

    const puedoReenvidar =
        debesResponder &&
        puedeEnvidarEnLance(0, lanceActual) &&
        (envite.base + envite.pendiente) < 12;

    const puedeEnvidar = puedoAbrirEnvite || puedoReenvidar;

    $("bet-stones-btn").disabled = !puedeEnvidar;
    $("bet-amarracos-btn").disabled = !puedeEnvidar;

    const humanoPuedePasar =
        jugadorPuedeIntervenir(jugadores[0], lanceActual);

    if ($("pass-bet-btn")) {
        $("pass-bet-btn").disabled =
            !(enGrande && esTurnoHumano && !envite.activo && humanoPuedePasar);
    }

    $("accept-bet-btn").disabled = !debesResponder || ocupado;
    $("decline-bet-btn").disabled = !debesResponder || ocupado;

    // ACTUALIZAR QUÉ BOTONES SE VEN
    actualizarVisibilidadPanel();
}


// =============================================
// VISIBILIDAD DEL PANEL DE CONTROLES
// =============================================
function actualizarVisibilidadPanel() {
    const panel = $("controls-panel");
    if (!panel) return;

    const hayJugadores =
        jugadores &&
        jugadores.length > 0 &&
        jugadores[0] &&
        jugadores[0].cartas;

    const botonNuevo = $("new-btn");

    // Mostrar Nueva mano al inicio y al terminar una mano
    if (botonNuevo) {
        botonNuevo.hidden = !(
            fase === "inicio" ||
            fase === "finMano"
        );
    }

    // Botones que dependen de la fase y del turno
    const botones = [
        "mus-btn",
        "cut-btn",
        "confirm-discard-btn",
        "declarar-si-btn",
        "declarar-no-btn",
        "bet-stones-btn",
        "bet-amarracos-btn",
        "pass-bet-btn",
        "accept-bet-btn",
        "decline-bet-btn"
    ];

    botones.forEach(id => {
        const boton = $(id);

        if (boton) {
            boton.hidden = !hayJugadores || boton.disabled;
        }
    });

    // Comprobar si queda algún botón que deba mostrarse
    const todosLosIds = ["new-btn", ...botones];

    const hayAlgunBotonVisible = todosLosIds.some(id => {
        const boton = $(id);
        return boton && !boton.hidden;
    });

    // Si no hay acciones para el jugador, desaparece todo el panel
    panel.hidden = !hayAlgunBotonVisible;
}
// =============================================
// VISIBILIDAD DEL PANEL DE CONTROLES
// =============================================

function actualizarVisibilidadPanel() {
    const hayJugadores = jugadores &&
        jugadores.length > 0 &&
        jugadores[0] &&
        jugadores[0].cartas;

    const botonNuevo = $("new-btn");

    // Nueva mano solo aparece al inicio o al terminar una mano.
    botonNuevo.hidden = !(
        fase === "inicio" ||
        fase === "finMano"
    );

    const botones = [
        "mus-btn",
        "cut-btn",
        "confirm-discard-btn",
        "declarar-si-btn",
        "declarar-no-btn",
        "bet-stones-btn",
        "bet-amarracos-btn",
        "pass-bet-btn",
        "accept-bet-btn",
        "decline-bet-btn"
    ];

    botones.forEach(id => {
        const boton = $(id);
        if (boton) {
            boton.hidden = !hayJugadores || boton.disabled;
        }
    });
}
// =============================================
// 13. MUS Y NO HAY MUS
// =============================================

function pedirMus() {
    if (!manoRepartida || fase !== "mus" || turnoMusId !== 0) return;
    mostrarBocadillo(0, "¡Mus!", "verde");
    registrar(`${jugadores[0].nombre}: Mus.`);
    avanzarTurnoMus(true);
}

function cortarMus() {
    if (!manoRepartida || fase !== "mus" || turnoMusId !== 0) return;
    mostrarBocadillo(0, "No mus", "rojo");
    registrar(`${jugadores[0].nombre}: no mus.`);
    declararCorteMus(0);
}

// =============================================
// 13b. DECLARACIONES DE PARES Y JUEGO
// =============================================

function iniciarDeclaracion(tipo) {
    fase = tipo === "pares" ? "declararPares" : "declararJuego";

    if (tipo === "pares") declaracionesPares = {};
    else declaracionesJuego = {};

    turnoDeclaracion = manoId;

    $("message").textContent = tipo === "pares" ? "Declaración de pares" : "Declaración de juego";
    $("phase").textContent = "Cada jugador dice si tiene o no.";

    ["right-status", "partner-status", "left-status"].forEach(id => {
        const el = $(id);
        if (el) {
            el.textContent = "Esperando declaración";
            el.classList.remove("declaracion");
        }
    });

    $("player-status").textContent = "Tu turno de declarar";

    actualizarBotones();
    procesarTurnoDeclaracion();
}

function procesarTurnoDeclaracion() {
    if (turnoDeclaracion === null) return;

    const jugador = jugadores[turnoDeclaracion];

    if (jugador.humano) {
        $("player-status").textContent = "Declara tu jugada";
        actualizarBotones();
        return;
    }

    setTimeout(() => {
        const tiene = jugadorTiene(turnoDeclaracion);
        declarar(turnoDeclaracion, tiene);
    }, 900);
}

function jugadorTiene(idJugador) {
    const jugador = jugadores[idJugador];
    if (fase === "declararPares") return analizarPares(jugador).tipo > 0;
    if (fase === "declararJuego") return analizarJuego(jugador).tieneJuego;
    return false;
}

function declarar(idJugador, tiene) {
    const esPares = fase === "declararPares";

    if (esPares) declaracionesPares[idJugador] = tiene;
    else declaracionesJuego[idJugador] = tiene;

    const estados = { 0: "player-status", 1: "right-status", 2: "partner-status", 3: "left-status" };
    const elEstado = $(estados[idJugador]);
    
    if (elEstado) {
        elEstado.textContent = tiene
            ? (esPares ? "Tengo pares" : "Tengo juego")
            : (esPares ? "No tengo pares" : "No tengo juego");
        elEstado.classList.add("declaracion");
    }

    // Bocadillo (si lo has implementado)
    if (typeof mostrarBocadillo === "function") {
        mostrarBocadillo(idJugador, tiene ? "¡Tengo!" : "No tengo", tiene ? "verde" : "rojo");
    }

    registrar(`${jugadores[idJugador].nombre}: ${
        tiene ? (esPares ? "tengo pares." : "tengo juego.") : (esPares ? "no tengo pares." : "no tengo juego.")
    }`);

    turnoDeclaracion = (turnoDeclaracion + 1) % jugadores.length;

    if (Object.keys(esPares ? declaracionesPares : declaracionesJuego).length >= jugadores.length) {
        finalizarDeclaracion(esPares ? "pares" : "juego");
        return;
    }

    procesarTurnoDeclaracion();
}

function finalizarDeclaracion(tipo) {
    const declaraciones = tipo === "pares" ? declaracionesPares : declaracionesJuego;
    const algunoTiene = Object.values(declaraciones).some(v => v === true);

    if (tipo === "pares") {
        const nosotrosTiene = jugadores.some(j => j.equipo === 0 && analizarPares(j).tipo > 0);
        const ellosTiene = jugadores.some(j => j.equipo === 1 && analizarPares(j).tipo > 0);

        if (!algunoTiene) {
            registrar("Nadie tiene pares. Se pasa a juego.");
            fase = "transicion";
            $("message").textContent = "Nadie tiene pares";
            $("phase").textContent = "Pasando a juego...";
            resaltarLance("juego"); 
            actualizarBotones();
            setTimeout(() => iniciarDeclaracion("juego"), 1200);
        } else if (!nosotrosTiene || !ellosTiene) {
            const equipoConPares = nosotrosTiene ? "Nosotros" : "Ellos";
            registrar(`${equipoConPares} es el único equipo con pares. No hay envite posible.`);
            fase = "transicion";
            $("message").textContent = `${equipoConPares} tiene pares`;
            $("phase").textContent = "No hay rival con pares: pasando a juego automáticamente…";
            resaltarLance("juego"); 
            actualizarBotones();
            setTimeout(() => iniciarDeclaracion("juego"), 1200);
        } else {
            registrar("Ambos equipos tienen pares. Se puede envidiar.");
            comenzarFaseGrande("¡Hay pares!", "Fase de pares. Puedes envidiar si tienes pares.", "pares");
            setTimeout(() => intentarEnviteIA(), 1500);
        }
        return;
    }

    // tipo === "juego"
    const nosotrosTieneJuego = jugadores.some(j => j.equipo === 0 && analizarJuego(j).tieneJuego);
    const ellosTieneJuego = jugadores.some(j => j.equipo === 1 && analizarJuego(j).tieneJuego);

    if (!algunoTiene) {
        // ▼▼▼ AQUÍ ESTÁ EL CAMBIO PARA PERMITIR ENVIDIAR AL PUNTO ▼▼▼
        registrar("Nadie tiene juego. Se juega al PUNTO.");
        comenzarFaseGrande("¡Al Punto!", "Nadie tiene juego. Puedes envidiar al Punto.", "juego");
        return;
    } else if (!nosotrosTieneJuego || !ellosTieneJuego) {
        const equipo = nosotrosTieneJuego ? "Nosotros" : "Ellos";
        registrar(`${equipo} es el único equipo con juego. No se pide respuesta al equipo sin juego.`);
        fase = "transicion";
        $("message").textContent = `${equipo} tiene juego`;
        $("phase").textContent = "Se cuentan los tantos de juego automáticamente.";
        actualizarBotones();
        setTimeout(() => finalizarMano(), 900);
    } else {
        registrar("Ambos equipos tienen juego. Se puede envidiar.");
        comenzarFaseGrande("¡Hay juego!", "Fase de juego. Puedes envidiar si tienes juego.", "juego");
    }
}

function procesarTurnoMus() {
    if (fase !== "mus" || turnoMusId === null) return;
    actualizarBotones();
    if (turnoMusId === 0) {
        $("message").textContent = "¿Quieres mus?";
        $("phase").textContent = `Tu turno: eres ${turnoMusId === manoId ? "mano" : "el siguiente en hablar"}`;
        $("player-status").textContent = "Tu turno de mus";
        return;
    }

    const id = turnoMusId;
    const jugador = jugadores[id];
    const quiere = iaQuiereMus(jugador);
    mostrarBocadillo(id, quiere ? "¡Mus!" : "No mus", quiere ? "verde" : "rojo");
    registrar(`${jugador.nombre}: ${quiere ? "quiere mus" : "no mus"}.`);
    const estadoDom = {1: "right-status", 2: "partner-status", 3: "left-status"}[id];
    if (estadoDom) $(estadoDom).textContent = quiere ? "Quiere mus" : "Corta el mus";
    if (!quiere) {
        declararCorteMus(id);
        return;
    }
    avanzarTurnoMus(true);
}

function avanzarTurnoMus(quiereMus) {
    if (fase !== "mus") return;
    if (!quiereMus) return;
    // Si ya han hablado los cuatro y todos quieren mus, se descarta.
    const siguiente = (turnoMusId + 1) % jugadores.length;
    if (siguiente === manoId) {
        registrar("Los cuatro jugadores quieren mus. Se pasa al descarte.");
        turnoMusId = null;
        iniciarDescarte();
        actualizarBotones();
        return;
    }
    turnoMusId = siguiente;
    if (turnoMusId === 0) {
        $("message").textContent = "¿Quieres mus?";
        $("phase").textContent = "Tu turno de mus";
        $("player-status").textContent = "Tu turno";
        actualizarBotones();
    } else {
        setTimeout(procesarTurnoMus, 500);
    }
}

function declararCorteMus(id) {
      // ▼▼▼ RESTAURAR ZONA CENTRAL ▼▼▼
    const infoCentral = $('info-central');
    const descarteCentral = $('descarte-central');
    if (infoCentral) infoCentral.classList.remove('hidden');
    if (descarteCentral) {
        descarteCentral.classList.add('hidden');
        descarteCentral.replaceChildren(); // Limpiar las cartas del montón
    }
    // ▲▲▲ FIN ▲▲▲

    
    turnoMusId = null;
    for (const jugador of jugadores) {
        const estadoDom = {0: "player-status", 1: "right-status", 2: "partner-status", 3: "left-status"}[jugador.id];
        if (estadoDom) $(estadoDom).textContent = jugador.id === id ? "Corta el mus" : "Se juega grande";
    }
    registrar(`${jugadores[id].nombre} corta el mus. Se juega grande.`);
    comenzarFaseGrande("¡No hay mus!", "Comienza la fase de grande.");
}

function comenzarFaseGrande(mensaje, logMsg, lanceInicial = "grande") {
    fase = "grande";
    lanceActual = lanceInicial;
    turnoEnviteId = manoId;
    pasesConsecutivos = 0;
    // Solo se reinicia el desglose al comenzar GRANDE. Cuando se entra en
    // PARES o JUEGO hay que conservar los puntos ya obtenidos en grande/chica.
    if (lanceInicial === "grande") reiniciarTantosMano();
    actualizarMarcaEnJuego();

    resaltarLance(lanceActual);

    $("message").textContent = mensaje;
    $("phase").textContent = `Lance: ${lanceActual === "juego" && !hayJuegoEnMesa() ? "punto" : lanceActual}. Puedes envidar o pasar.`;
    registrar(logMsg);

    actualizarBotones();

    setTimeout(() => intentarEnviteIA(), 1200);
}

// =============================================
// 14. DESCARTE
// =============================================

function iniciarDescarte() {
    fase = "descarte";
    descartesSeleccionados = [];

    $("message").textContent = "Fase de descarte";
    $("phase").textContent = `Descartes restantes: ${descartesRestantes}`;
    $("discard-help").textContent =
        "Pulsa las cartas que quieras descartar y luego «Confirmar descarte».";

    const mano = $("player-hand");
    if (mano) {
        [...mano.children].forEach((carta, indice) => {
            carta.classList.add("seleccionable");
            carta.dataset.indice = String(indice);
            carta.addEventListener("click", () => alternarSeleccionDescarte(indice));
        });
    }

    for (const rival of [jugadores[1], jugadores[2], jugadores[3]]) {
        rival.descartes = decidirDescartesIA(rival);
    }

    actualizarBotones();
}

function alternarSeleccionDescarte(indice) {
    if (fase !== "descarte") return;

    const posicion = descartesSeleccionados.indexOf(indice);
    if (posicion === -1) descartesSeleccionados.push(indice);
    else descartesSeleccionados.splice(posicion, 1);

    const mano = $("player-hand");
    if (mano) {
        [...mano.children].forEach((carta, i) => {
            carta.classList.toggle(
                "seleccionada",
                descartesSeleccionados.includes(i)
            );
        });
    }
}

function confirmarDescarte() {
    if (fase !== "descarte") return;
    limpiarBocadillos();
    ejecutarDescarte();
}

function decidirDescartesIA(jugador) {
    const valores = jugador.cartas.map((c, i) => ({
        indice: i,
        peso: REGLAS.ordenGrande.indexOf(c.valor)
    }));

    const contador = {};
    for (const carta of jugador.cartas) {
        contador[carta.valor] = (contador[carta.valor] || 0) + 1;
    }

    valores.sort((a, b) => b.peso - a.peso);

    const descartes = [];
    for (const item of valores) {
        const carta = jugador.cartas[item.indice];
        if (contador[carta.valor] >= 2) continue;
        if (item.peso <= 3) break;
        descartes.push(item.indice);
        if (descartes.length >= 3) break;
    }
    return descartes;
}

async function animarDescarteHaciaMonton(descartesPorJugador) {
    const descarteCentralEl = $('descarte-central');
    if (!descarteCentralEl) return;

    const rectDestino = descarteCentralEl.getBoundingClientRect();
    const ids = { 0: "player-hand", 1: "right-hand", 2: "partner-hand", 3: "left-hand" };
    let cartasEnMonton = 0;

    const promesasAnimacion = [];

    for (const jugadorId in descartesPorJugador) {
        const manoEl = $(ids[jugadorId]);
        const cartasADescartar = descartesPorJugador[jugadorId];

        for (const carta of cartasADescartar) {
            const indiceCarta = jugadores[jugadorId].cartas.findIndex(c => c.id === carta.id);
            if (!manoEl || indiceCarta === -1) continue;

            const cartaEl = manoEl.children[indiceCarta];
            if (!cartaEl) continue;

            const animacion = async () => {
                const rectOrigen = cartaEl.getBoundingClientRect();
                const cartaVoladora = document.createElement("div");
                cartaVoladora.className = "card back";
                Object.assign(cartaVoladora.style, {
                    position: "fixed",
                    left: `${rectOrigen.left}px`,
                    top: `${rectOrigen.top}px`,
                    width: `${rectOrigen.width}px`,
                    height: `${rectOrigen.height}px`,
                    zIndex: "1200",
                    transition: "all 450ms cubic-bezier(0.3, 0, 0.3, 1)", // Curva más natural
                });

                document.body.appendChild(cartaVoladora);
                cartaEl.style.opacity = '0';

                await esperar(10); // Pequeña pausa para que la transición se aplique

                cartaVoladora.style.left = `${rectDestino.left + (rectDestino.width - rectOrigen.width) / 2}px`;
                cartaVoladora.style.top = `${rectDestino.top + (rectDestino.height - rectOrigen.height) / 2}px`;
                cartaVoladora.style.transform = `rotate(${Math.random() * 30 - 15}deg) scale(0.9)`;

                await esperar(450);

                cartaVoladora.remove();
                const cartaEnMonton = crearCartaVisual(carta, true);
                Object.assign(cartaEnMonton.style, {
                    transform: `rotateZ(${Math.random() * 40 - 20}deg) translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px)`,
                    zIndex: 10 + cartasEnMonton
                });
                descarteCentralEl.appendChild(cartaEnMonton);
                cartasEnMonton++;
            };

            promesasAnimacion.push(animacion());
            await esperar(90); // Escalonar la salida de cada carta
        }
    }

    await Promise.all(promesasAnimacion);
    await esperar(300);
}


function reponerCartas(jugador, indicesDescartados) {
    if (!indicesDescartados || indicesDescartados.length === 0) return;

    const ordenados = [...indicesDescartados].sort((a, b) => b - a);
    for (const indice of ordenados) {
        jugador.cartas.splice(indice, 1);
    }
    for (let i = 0; i < ordenados.length; i++) {
        const nueva = baraja.pop();
        if (nueva) jugador.cartas.push(nueva);
    }
}

// =============================================
// 15. COMPARAR Y RESOLVER
// =============================================

function compararManos(jugadorA, jugadorB, orden) {
    const pesosA = jugadorA.cartas
        .map(c => orden.indexOf(c.valor))
        .sort((a, b) => a - b);

    const pesosB = jugadorB.cartas
        .map(c => orden.indexOf(c.valor))
        .sort((a, b) => a - b);

    for (let i = 0; i < pesosA.length; i++) {
        if (pesosA[i] < pesosB[i]) return 1;
        if (pesosA[i] > pesosB[i]) return -1;
    }
    return 0;
}

function obtenerOrdenDeMano() {
    const orden = [];
    for (let i = 0; i < jugadores.length; i++) {
        orden.push((manoId + i) % jugadores.length);
    }
    return orden;
}

function valorMus(carta) {
    // En el mus, doses y ases valen uno para pares; treses y reyes forman pareja.
    if (carta.valor === 2) return 1;
    if (carta.valor === 3) return 12;
    return carta.valor;
}

function analizarPares(jugador) {
    const cuenta = {};
    for (const carta of jugador.cartas) {
        const v = valorMus(carta);
        cuenta[v] = (cuenta[v] || 0) + 1;
    }
    const grupos = Object.entries(cuenta)
        .map(([valor, cantidad]) => ({ valor: Number(valor), cantidad }))
        .filter(g => g.cantidad >= 2)
        .sort((a, b) => b.cantidad - a.cantidad || pesoGrandeValor(b.valor) - pesoGrandeValor(a.valor));

    if (!grupos.length) return { tipo: 0, nombre: "Sin pares", puntos: 0, clave: [] };
    // Cuatro cartas del mismo valor también son duples en el mus.
    if (grupos.length >= 2 || grupos[0].cantidad === 4) {
        const valores = grupos.slice(0, 2)
            .map(g => pesoGrandeValor(g.valor))
            .sort((a, b) => b - a);
        return { tipo: 3, nombre: "Duples", puntos: 3, clave: [3, ...valores] };
    }
    const g = grupos[0];
    if (g.cantidad === 3) {
        return { tipo: 2, nombre: "Medias", puntos: 2, clave: [2, pesoGrandeValor(g.valor)] };
    }
    return { tipo: 1, nombre: "Pares", puntos: 1, clave: [1, pesoGrandeValor(g.valor)] };
}

function pesoGrandeValor(valor) {
    const normalizado = valor === 12 ? 3 : valor === 1 ? 2 : valor;
    // Un peso mayor significa una carta más alta en la comparación de pares.
    return 9 - REGLAS.ordenGrande.indexOf(normalizado);
}

function puntosCartaJuego(carta) {
    if (carta.valor === 1 || carta.valor === 2) return 1;
    if ([3, 10, 11, 12].includes(carta.valor)) return 10;
    return carta.valor;
}

function analizarJuego(jugador) {
    const suma = jugador.cartas.reduce((total, carta) => total + puntosCartaJuego(carta), 0);
    const ordenJuego = { 31: 8, 32: 7, 40: 6, 37: 5, 36: 4, 35: 3, 34: 2, 33: 1 };
    return {
        suma,
        tieneJuego: suma >= 31,
        nombre: suma === 31 ? "31" : String(suma),
        fuerza: ordenJuego[suma] || 0
    };
}

function hayJuegoEnMesa() {
    return jugadores.some(j => analizarJuego(j).tieneJuego);
}

function hayParesEnMesa() {
    return jugadores.some(j => analizarPares(j).tipo > 0);
}

function compararClaves(a, b) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
        const va = a[i] ?? -1;
        const vb = b[i] ?? -1;
        if (va !== vb) return va > vb ? 1 : -1;
    }
    return 0;
}

function compararLance(jugadorA, jugadorB, lance) {
    if (lance === "pares") {
        const paresA = analizarPares(jugadorA);
        const paresB = analizarPares(jugadorB);
        
        // Si uno tiene pares y el otro no, gana el que tiene
        if (paresA.tipo !== paresB.tipo) return paresA.tipo > paresB.tipo ? 1 : -1;
        if (paresA.tipo === 0) return 0;
        
        // Si ambos tienen el mismo tipo (ej. ambos tienen Pareja de Reyes), 
        // comparamos la clave (que ya incluye el peso del valor).
        const cmpClave = compararClaves(paresA.clave, paresB.clave);
        if (cmpClave !== 0) return cmpClave;
        
        // Si siguen empatados (misma pareja exacta), desempata la carta más alta restante
        // (la cuarta carta). Usamos el orden de Grande para ver quién tiene la carta más alta.
        const cartasA = jugadorA.cartas.filter(c => valorMus(c) !== paresA.clave[1]).map(c => REGLAS.ordenGrande.indexOf(c.valor));
        const cartasB = jugadorB.cartas.filter(c => valorMus(c) !== paresB.clave[1]).map(c => REGLAS.ordenGrande.indexOf(c.valor));
        
        // Ordenamos de mejor a peor (índice más bajo = carta más alta)
        cartasA.sort((a, b) => a - b);
        cartasB.sort((a, b) => a - b);
        
        // Comparamos la mejor carta restante
        const mejorA = cartasA[0] ?? 99;
        const mejorB = cartasB[0] ?? 99;
        
        if (mejorA !== mejorB) return mejorA < mejorB ? 1 : -1;
        return 0; // Empate total
    }
    
    if (lance === "juego") {
        const a = analizarJuego(jugadorA);
        const b = analizarJuego(jugadorB);
        const aTiene = a.tieneJuego;
        const bTiene = b.tieneJuego;

        if (aTiene !== bTiene) return aTiene ? 1 : -1; // Uno tiene juego y el otro no

        if (!aTiene) { // Si 'a' no tiene, 'b' tampoco: es punto
            return a.suma === b.suma ? 0 : a.suma > b.suma ? 1 : -1;
        }

        // Ambos tienen juego
        const valorA = getValorJuego(a.suma);
        const valorB = getValorJuego(b.suma);
        return valorA === valorB ? 0 : valorA > valorB ? 1 : -1;
    }
    
    const orden = lance === "chica" ? REGLAS.ordenChica : REGLAS.ordenGrande;
    return compararManos(jugadorA, jugadorB, orden);
}
function obtenerGanadorLance(lance) {
    if (!jugadores || !jugadores.length) return null;

    // 1. Encontrar todos los jugadores que tienen la mejor jugada (pueden ser varios en caso de empate)
    let mejoresJugadores = [jugadores[0]];

    for (let i = 1; i < jugadores.length; i++) {
        const jugadorActual = jugadores[i];
        const mejorDeLaLista = mejoresJugadores[0];
        const comparacion = compararLance(jugadorActual, mejorDeLaLista, lance);

        if (comparacion > 0) {
            // El jugador actual es estrictamente mejor, se convierte en el único mejor
            mejoresJugadores = [jugadorActual];
        } else if (comparacion === 0) {
            // Es un empate, se añade a la lista de mejores
            mejoresJugadores.push(jugadorActual);
        }
    }

    // 2. Si solo hay un jugador en la lista, es el ganador
    if (mejoresJugadores.length === 1) {
        return mejoresJugadores[0];
    }

    // 3. Si hay empate, buscar en orden de mano cuál de los empatados gana
    const ordenDeMano = obtenerOrdenDeMano();
    for (const id of ordenDeMano) {
        const ganadorPorMano = mejoresJugadores.find(j => j.id === id);
        if (ganadorPorMano) {
            return ganadorPorMano;
        }
    }

    return null; // No debería ocurrir si hay jugadores
}

function resolverTantosBaseDeLance(lance) {
    const ganador = obtenerGanadorLance(lance);

    if (lance === "pares") {
        if (!hayParesEnMesa()) return { ganador: null, texto: "PARES: nadie tiene pares; 0 tantos." };
        const equipoGanadorKey = ganador.equipo === 0 ? "nosotros" : "ellos";
        let puntosGanador = 0;

        for (const jugador of jugadores) {
            const pares = analizarPares(jugador);
            if (pares.tipo && jugador.equipo === ganador.equipo) {
                registrar(`${jugador.nombre}: ${pares.nombre} (+${pares.puntos}).`);
                puntosGanador += pares.puntos;
            }
        }

        tantosMano.pares[equipoGanadorKey] += puntosGanador;
        return { ganador: ganador.nombre, texto: `PARES: gana ${ganador.nombre}. Su equipo suma ${puntosGanador} tantos.` };
    }

    if (lance === "juego") {
        const equipoGanadorKey = ganador.equipo === 0 ? "nosotros" : "ellos";

        if (hayJuegoEnMesa()) {
            let puntosGanador = 0;
            for (const jugador of jugadores) {
                const juego = analizarJuego(jugador);
                if (juego.tieneJuego && jugador.equipo === ganador.equipo) {
                    const puntos = juego.suma === 31 ? 3 : 2;
                    registrar(`${jugador.nombre}: juego de ${juego.suma} (+${puntos}).`);
                    puntosGanador += puntos;
                }
            }
            tantosMano.juego[equipoGanadorKey] += puntosGanador;
            return { ganador: ganador.nombre, texto: `JUEGO: gana ${ganador.nombre}. Su equipo suma ${puntosGanador} tantos.` };
        } else {
            // Nadie tiene juego: se juega al PUNTO (30 hacia abajo).
            // El ganador ya se ha calculado arriba (el que tiene la suma más alta).
            tantosMano.juego[equipoGanadorKey] += 1;
            const sumaGanador = analizarJuego(ganador).suma;
            registrar(`Punto: gana ${ganador.nombre} con ${sumaGanador}. (+1 piedra).`);
            return { ganador: ganador.nombre, texto: `PUNTO: gana ${ganador.nombre} con ${sumaGanador}; +1 piedra.` };
        }
    }

    return asignarTantosBase(lance, ganador.equipo, ganador.nombre);
}
function asignarTantosBase(lance, equipo, nombre) {
    const base = TANTOS_POR_LANCE[lance] || 1;
    if (equipo === 0) tantosMano[lance].nosotros += base;
    else tantosMano[lance].ellos += base;
    return { ganador: nombre, equipo, tantos: base, texto: `${lance.toUpperCase()}: gana ${nombre} (${base} tanto).` };
}

function reiniciarTantosMano() {
    tantosMano = {
        grande: { nosotros: 0, ellos: 0 },
        chica:  { nosotros: 0, ellos: 0 },
        pares:  { nosotros: 0, ellos: 0 },
        juego:  { nosotros: 0, ellos: 0 }
    };
}

function actualizarMarcador() {
    const pn = $("partidas-nosotros");
    const pe = $("partidas-ellos");
    const tn = $("tantos-nosotros");
    const te = $("tantos-ellos");

    if (pn) pn.textContent = String(partidasNosotros);
    if (pe) pe.textContent = String(partidasEllos);
    if (tn) tn.textContent = String(tantosNosotros);
    if (te) te.textContent = String(tantosEllos);

    actualizarColumnasLances();
}

function actualizarColumnasLances() {
    for (const lance of ["grande", "chica", "pares", "juego"]) {
        const n = $(`puntos-${lance}-nosotros`);
        const e = $(`puntos-${lance}-ellos`);
        if (n) n.textContent = tantosMano[lance].nosotros || "—";
        if (e) e.textContent = tantosMano[lance].ellos || "—";
    }
}

function actualizarMarcaEnJuego() {
    const cabeceraJuego = document.querySelector(".marcador-cabecera");
    if (cabeceraJuego && cabeceraJuego.children[6]) {
        cabeceraJuego.children[6].textContent = hayJuegoEnMesa() ? "JUEGO" : "PUNTO";
    }
    for (const lance of ["grande", "chica", "pares", "juego"]) {
        const celda = $(`en-juego-${lance}`);
        if (celda) celda.textContent = "—";
    }

    for (const e of envitesPendientes) {
        const celda = $(`en-juego-${e.lance}`);
        if (!celda) continue;

        const marca = e.equipo === 0 ? "N" : "E";
        const textoActual = celda.textContent === "—" ? "" : celda.textContent + " · ";
        celda.textContent = `${textoActual}${e.importe}${marca}`;
    }

    if (envite.activo && envite.lance) {
        const celda = $(`en-juego-${envite.lance}`);
        if (celda) {
            const total = envite.base + envite.pendiente;
            const marca = envite.ultimoEnvidante === 0 ? "N" : "E";
            const textoActual = celda.textContent === "—" ? "" : celda.textContent + " · ";
            celda.textContent = `${textoActual}${total}${marca}?`;
        }
    }
}

// =============================================
// 16. ENVITES
// =============================================

function reiniciarApuestas() {
    envite = {
        activo: false,
        lance: null,
        ultimoEnvidante: null,
        respondiente: null,
        base: 0,
        pendiente: 0
    };

     const titulo = $("bet-title");
    if (titulo) titulo.textContent = "Zona de apuestas";

    // ▼▼▼ LIMPIAR PUNTOS DE JUGADOR ▼▼▼
    const betArea = $("bet-area");
    if (betArea) {
        betArea.querySelectorAll(".puntos-jugador").forEach(el => el.remove());
    }
}
    // ▲▲▲ FIN ▲▲▲

function dibujarApuesta() {
    const zona = $("bet-tokens");
    if (!zona) return;

    zona.replaceChildren();
    zona.style.display = "flex";
    zona.style.justifyContent = "center";
    zona.style.alignItems = "center";
    zona.style.flexWrap = "wrap";
    zona.style.gap = "12px";
    zona.style.minHeight = "55px";

    const total = envite.base + envite.pendiente;

    if (total === 0) {
        const vacio = document.createElement("span");
        vacio.className = "bet-empty";
        vacio.textContent = "Todavía no hay envites";
        zona.appendChild(vacio);
    } else {
        for (let i = 0; i < envite.base; i++) {
            zona.appendChild(crearFicha(false));
        }
        for (let i = 0; i < envite.pendiente; i++) {
            const ficha = crearFicha(false);
            ficha.style.outline = "2px dashed #ffef9f";
            ficha.style.opacity = "0.7";
            ficha.title = "Subida pendiente de aceptar";
            zona.appendChild(ficha);
        }
    }

    let texto = `En juego: ${envite.base} piedras`;
    if (envite.pendiente > 0) {
        texto += ` · Pendiente: ${envite.pendiente}`;
    }

    const totalEl = $("bet-total");
    if (totalEl) totalEl.textContent = texto;
}

function crearFicha(esAmarraco) {
    const ficha = document.createElement("span");
    ficha.className = esAmarraco ? "bet-token amarraco" : "bet-token";
    ficha.textContent = esAmarraco ? "5" : "1";

    const tamano = esAmarraco ? "42px" : "34px";
    Object.assign(ficha.style, {
        display: "inline-flex",
        width: tamano, height: tamano, minWidth: tamano,
        boxSizing: "border-box", borderRadius: "50%",
        alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: "13px", fontWeight: "bold",
        background: esAmarraco
            ? "radial-gradient(circle at 30% 25%, #72b6ff, #16477f)"
            : "radial-gradient(circle at 30% 25%, #ffe9a1, #c28c20)",
        border: esAmarraco ? "3px double #ffe9a1" : "3px dashed #fff1bd",
        boxShadow: "0 2px 8px #0009"
    });
    return ficha;
}

function registrarEnvite(cantidad, nombre) {
    if (!manoRepartida || fase !== "grande") return;

    if (envite.activo && envite.respondiente === 0) {
        // Tienes que responder primero (Quiero / No quiero / Reenvidar).
        // Aquí el botón "Envidar" actúa como reenvite.
        reenvidar(cantidad);
        return;
    }

    if (envite.activo) return;

    envite = {
        activo: true,
        lance: lanceActual,
        ultimoEnvidante: 0,
        respondiente: 1,
        base: 0,
        pendiente: cantidad
    };

    $("bet-title").textContent = "Envite de tu equipo";
    $("message").textContent = "¡Hay envite!";
    $("phase").textContent = `${nombre}: ${cantidad} piedras`;
    mostrarBocadillo(0, "¡Envido!", "rojo"); // AÑADIR
    registrar(`Tu equipo envida ${cantidad} piedras.`);

    dibujarApuesta();
    actualizarMarcaEnJuego();
    actualizarBotones();

    setTimeout(() => responderEnviteRival(), 1000);
}

function reenvidar(cantidad) {
    if (!envite.activo || envite.respondiente !== 0) return;

    // Aceptas la subida pendiente
    envite.base += envite.pendiente;

    // Subes tu nueva cantidad
    envite.pendiente = cantidad;
    envite.ultimoEnvidante = 0;
    envite.respondiente = 1;   // ahora le toca responder al rival

    $("bet-title").textContent = "Reenvite de tu equipo";
    $("message").textContent = "¡Reenvías!";
    $("phase").textContent = `Aceptas ${envite.base} y subes ${cantidad}`;
    registrar(`Tu equipo reenvida ${cantidad} piedras. Total base: ${envite.base}.`);

    dibujarApuesta();
    actualizarMarcaEnJuego();
    actualizarBotones();

    setTimeout(() => responderEnviteRival(), 1000);
}

function responderEnviteRival() {
    if (!envite.activo || envite.respondiente !== 1) return;
    
    const rivales = [jugadores[1], jugadores[3]];
    const algunoQuiere = rivales.some(j => !iaQuiereMus(j));
    const manoFuerte   = rivales.every(j => !iaQuiereMus(j));

    // Buscamos cuál de los dos rivales es el que está decidiendo (el que tiene la jugada)
    const rivalQueDecide = rivales.find(r => puedeEnvidarEnLance(1, lanceActual)) || jugadores[1];
    const idBocadillo = rivalQueDecide.id;

    if (manoFuerte && envite.base + envite.pendiente < 12) {
        envite.base += envite.pendiente; envite.pendiente = 2; envite.ultimoEnvidante = 1; envite.respondiente = 0;
        
        mostrarBocadillo(idBocadillo, "¡Reenvido!", "rojo"); // <-- BOCADILLO
        
        $("bet-title").textContent = "Reenvite del rival"; $("message").textContent = "¡El rival reenvía!";
        $("phase").textContent = `Aceptan ${envite.base} y suben 2`; registrar(`El rival reenvida 2 piedras. Base: ${envite.base}.`);
        dibujarApuesta(); actualizarMarcaEnJuego(); actualizarBotones(); return;
    }

    if (algunoQuiere) {
        envite.base += envite.pendiente; envite.pendiente = 0;
        envitesPendientes.push({ lance: envite.lance, equipo: envite.ultimoEnvidante, importe: envite.base });
        lancesCerradosPorEnvite.push(envite.lance);
        
        mostrarBocadillo(idBocadillo, "Quiero", "verde"); // <-- BOCADILLO
        
        $("message").textContent = "El rival quiere"; $("phase").textContent = `Envite aceptado: ${envite.base} piedras en juego`;
        registrar(`El rival quiere. En juego: ${envite.base} piedras.`);
        envite = { activo: false, lance: null, ultimoEnvidante: null, respondiente: null, base: 0, pendiente: 0 };
        dibujarApuesta(); actualizarMarcaEnJuego(); actualizarBotones(); setTimeout(() => siguienteLance(), 1000); return;
    }

    // Si rechazan una subida, el último envidante cobra lo que ya estaba aceptado;
    // si rechazan el primer envite, cobra el deje de 1 piedra.
    const gananciaRival = envite.base > 0 ? envite.base : 1;
    const equipoGanadorEnvite = envite.ultimoEnvidante === 0 ? "nosotros" : "ellos";
    tantosMano[envite.lance][equipoGanadorEnvite] += gananciaRival;
    lancesCerradosPorEnvite.push(envite.lance);
    
    mostrarBocadillo(idBocadillo, "No quiero", "rojo"); // <-- BOCADILLO
    
    $("message").textContent = "El rival no quiere"; $("phase").textContent = `Ganas ${gananciaRival} piedras`; registrar(`El rival no quiere. Ganas ${gananciaRival} piedras.`);
    envite = { activo: false, lance: null, ultimoEnvidante: null, respondiente: null, base: 0, pendiente: 0 };
    actualizarMarcador(); dibujarApuesta(); actualizarMarcaEnJuego(); actualizarBotones(); setTimeout(() => siguienteLance(), 1200);
}
function responderEnvite(aceptado) {
    if (!envite.activo || envite.respondiente !== 0) return;

    if (lanceActual === "juego" || lanceActual === "pares") {
        const yoTengo = (lanceActual === "juego") ? analizarJuego(jugadores[0]).tieneJuego : analizarPares(jugadores[0]).tipo > 0;
        const companeroTiene = (lanceActual === "juego") ? analizarJuego(jugadores[2]).tieneJuego : analizarPares(jugadores[2]).tipo > 0;

        if (!yoTengo && !companeroTiene) {
            const gananciaMia = envite.base > 0 ? envite.base : 1;
            const equipoGanadorEnvite = envite.ultimoEnvidante === 0 ? "nosotros" : "ellos";
            tantosMano[envite.lance][equipoGanadorEnvite] += gananciaMia;
            lancesCerradosPorEnvite.push(envite.lance);
            
            // Aquí el que "habla" eres tú, pero como no tienes, el juego te rechaza automáticamente.
            mostrarBocadillo(0, "No puedo", "rojo"); // <-- BOCADILLO
            
            $("message").textContent = "Nadie tiene la jugada. No se puede querer."; $("phase").textContent = `El rival gana ${gananciaMia} piedra(s) por deje.`;
            registrar(`Vuestro equipo no tiene ${lanceActual}. El rival gana ${gananciaMia} por deje.`);
            envite = { activo: false, lance: null, ultimoEnvidante: null, respondiente: null, base: 0, pendiente: 0 };
            actualizarMarcador(); 
            dibujarApuesta(); 
            actualizarMarcaEnJuego(); 
            actualizarBotones(); 
           setTimeout(() => finalizarMano(), 1200);
            return;
        }
    }

    if (aceptado) {
        envite.base += envite.pendiente; envite.pendiente = 0;
        envitesPendientes.push({ lance: envite.lance, equipo: envite.ultimoEnvidante, importe: envite.base });
        lancesCerradosPorEnvite.push(envite.lance);
        
        mostrarBocadillo(0, "Quiero", "verde"); // <-- BOCADILLO
        
        $("message").textContent = "Quieres el envite"; $("phase").textContent = `${envite.base} piedras en juego`; registrar(`Quieres. En juego: ${envite.base} piedras.`);
        envite = { activo: false, lance: null, ultimoEnvidante: null, respondiente: null, base: 0, pendiente: 0 };
        dibujarApuesta(); actualizarMarcaEnJuego(); actualizarBotones(); setTimeout(() => siguienteLance(), 1000);
    } else {
        const gananciaMia = envite.base > 0 ? envite.base : 1;
        const equipoGanadorEnvite = envite.ultimoEnvidante === 0 ? "nosotros" : "ellos";
        tantosMano[envite.lance][equipoGanadorEnvite] += gananciaMia;
        lancesCerradosPorEnvite.push(envite.lance);
        
        mostrarBocadillo(0, "No quiero", "rojo"); // <-- BOCADILLO
        
        $("message").textContent = "No quieres"; $("phase").textContent = `El rival gana ${gananciaMia} piedras`; registrar(`No quieres. El rival gana ${gananciaMia} piedras.`);
        envite = { activo: false, lance: null, ultimoEnvidante: null, respondiente: null, base: 0, pendiente: 0 };
        actualizarMarcador(); dibujarApuesta(); actualizarMarcaEnJuego(); actualizarBotones(); setTimeout(() => siguienteLance(), 1200);
    }
}
function puedeEnvidarEnLance(equipo, lance) {
    if (!REGLAS.lancesConEnvite.includes(lance)) return false;
    const miembros = jugadores.filter(j => j.equipo === equipo);
    if (lance === "pares") return miembros.some(j => analizarPares(j).tipo > 0);
    if (lance === "juego" && hayJuegoEnMesa()) {
        return miembros.some(j => analizarJuego(j).tieneJuego);
    }
    return lance !== "juego" || !hayJuegoEnMesa(); // Punto: todos pueden competir.
}

function jugadorPuedeIntervenir(jugador, lance) {
    if (!jugador) return false;

    if (lance === "pares") {
        return analizarPares(jugador).tipo > 0;
    }

    if (lance === "juego" && hayJuegoEnMesa()) {
        return analizarJuego(jugador).tieneJuego;
    }

    // Si nadie tiene Juego, se juega al Punto y participan los cuatro.
    // En Grande y Chica también participan todos.
    return true;
}

function fuerzaEnviteIA(jugador, lance) {
    // La fuerza se calcula según las reglas reales de cada lance; no se usa
    // iaQuiereMus() como sustituto de la calidad de las cartas.
    if (lance === "grande") {
        return jugador.cartas.reduce((s, c) => s + (10 - REGLAS.ordenGrande.indexOf(c.valor)), 0);
    }
    if (lance === "chica") {
        // En chica, el as es la mejor carta. Se ponderan las cuatro cartas
        // ordenadas de mejor a peor, para que una mano realmente baja destaque.
        const valores = jugador.cartas
            .map(c => REGLAS.ordenChica.indexOf(c.valor))
            .sort((a, b) => a - b);
        return valores.reduce((s, rango, i) => s + (10 - rango) * (4 - i), 0);
    }
    if (lance === "pares") {
        const p = analizarPares(jugador);
        if (p.tipo === 3) return 30 + (p.clave[1] || 0) + (p.clave[2] || 0); // duples
        if (p.tipo === 2) return 20 + (p.clave[1] || 0); // medias
        if (p.tipo === 1) return 10 + (p.clave[1] || 0); // pares
        return 0;
    }
    if (lance === "juego" && hayJuegoEnMesa()) {
        const j = analizarJuego(jugador);
        return j.tieneJuego ? 30 + j.fuerza : 0;
    }
    if (lance === "juego") {
        // Si nadie tiene juego, se juega al punto: una suma alta es buena.
        return analizarJuego(jugador).suma;
    }
    return 0;
}

function debeEnvidarIA(jugador, lance) {
    const fuerza = fuerzaEnviteIA(jugador, lance);
    if (lance === "grande") return fuerza >= 30;
    if (lance === "chica") return fuerza >= 70;
    if (lance === "pares") return fuerza >= 10; // con pares, al menos considerar el envite
    if (lance === "juego" && hayJuegoEnMesa()) return fuerza >= 31;
    if (lance === "juego") return fuerza >= 30; // punto
    return false;
}

function avanzarTurnoEnvite() {
    if (envite.activo) return;

    pasesConsecutivos++;

    if (pasesConsecutivos >= jugadores.length) {
        registrar("Todos han pasado. Se cierra el lance.");
        $("phase").textContent = "Nadie ha envidiado. Siguiente lance...";
        pasesConsecutivos = 0;
        setTimeout(() => siguienteLance(), 1000);
        return;
    }

    turnoEnviteId = (turnoEnviteId + 1) % jugadores.length;

    // Si te toca a ti y no tienes la jugada, no debes intervenir.
    if (
        turnoEnviteId === 0 &&
        !jugadorPuedeIntervenir(jugadores[0], lanceActual)
    ) {
        registrar(`No intervienes en ${lanceActual}: no tienes la jugada.`);

        // Pasamos al siguiente jugador sin pedirte que pulses "Pasar".
        turnoEnviteId = (turnoEnviteId + 1) % jugadores.length;

        actualizarBotones();
        $("phase").textContent =
            `No tienes ${lanceActual}; continúa ${jugadores[turnoEnviteId].nombre}.`;

        if (turnoEnviteId !== 0) {
            setTimeout(() => intentarEnviteIA(), 500);
        }

        return;
    }

    actualizarBotones();

    if (turnoEnviteId === 0) {
        $("phase").textContent =
            `Tu turno (${lanceActual}). Puedes envidar o pasar.`;
    } else {
        $("phase").textContent =
            `Turno de ${jugadores[turnoEnviteId].nombre}...`;

        setTimeout(() => intentarEnviteIA(), 1000);
    }
}

function intentarEnviteIA() {
    if (fase !== "grande" || envite.activo) return;
    if (turnoEnviteId === null || turnoEnviteId === 0) return;

    const jugador = jugadores[turnoEnviteId];
    if (!jugador || jugador.humano) return;

    let tieneJugada = true;
    if (lanceActual === "pares") tieneJugada = analizarPares(jugador).tipo > 0;
    if (lanceActual === "juego" && hayJuegoEnMesa()) tieneJugada = analizarJuego(jugador).tieneJuego;

    let rivalPuede = true;
    if (lanceActual === "pares") rivalPuede = jugadores.filter(j => j.equipo !== jugador.equipo).some(j => analizarPares(j).tipo > 0);
    if (lanceActual === "juego" && hayJuegoEnMesa()) rivalPuede = jugadores.filter(j => j.equipo !== jugador.equipo).some(j => analizarJuego(j).tieneJuego);

    if (!tieneJugada || !rivalPuede || !debeEnvidarIA(jugador, lanceActual)) {
        mostrarBocadillo(jugador.id, "Paso", "normal");
        registrar(`${jugador.nombre} pasa.`);
        avanzarTurnoEnvite();
        return;
    }

    mostrarBocadillo(jugador.id, "¡Envido!", "rojo");
    pasesConsecutivos = 0;
    envite = { activo: true, lance: lanceActual, ultimoEnvidante: jugador.equipo, respondiente: jugador.equipo === 0 ? 1 : 0, base: 0, pendiente: 2 };
    $("bet-title").textContent = `Envite de ${jugador.nombre} · ${lanceActual.toUpperCase()}`;
    $("message").textContent = "¡Hay envite!";
    $("phase").textContent = "2 piedras pendientes de respuesta";
    registrar(`${jugador.nombre} envida 2 piedras.`);
    dibujarApuesta(); actualizarMarcaEnJuego(); actualizarBotones();

    if (jugador.equipo === 0) {
        setTimeout(() => responderEnviteRival(), 1000);
    } else {
        const yoTengo = lanceActual === "pares" ? analizarPares(jugadores[0]).tipo > 0 : lanceActual === "juego" && hayJuegoEnMesa() ? analizarJuego(jugadores[0]).tieneJuego : true;
        const companeroTiene = lanceActual === "pares" ? analizarPares(jugadores[2]).tipo > 0 : lanceActual === "juego" && hayJuegoEnMesa() ? analizarJuego(jugadores[2]).tieneJuego : true;
        if (!yoTengo && companeroTiene) setTimeout(() => procesarRespuestaCompanero(), 1200);
    }
}

function procesarRespuestaCompanero() {
    if (!envite.activo || envite.respondiente !== 0) return;

    $("phase").textContent = "Tu compañero está valorando el envite...";
    actualizarBotones();

    setTimeout(() => {
        if (!envite.activo || envite.respondiente !== 0) return;
        const companeroQuiere = !iaQuiereMus(jugadores[2]);
        const decision = companeroQuiere ? "Quiero" : "No quiero";
        mostrarBocadillo(2, decision, companeroQuiere ? "verde" : "rojo");
        $("message").textContent = `Tu compañero dice «${decision}»`;
        $("phase").textContent = companeroQuiere
            ? "Tu compañero quiere; ahora decides tú."
            : "Tu compañero no quiere; puedes decidir tú. Si rechazas, se cerrará el envite.";
        registrar(`Tu compañero opina: ${decision}. La decisión final queda en tus manos.`);
        // No cerramos el envite aquí: el jugador humano puede aceptar, rechazar
        // o reenvidar con sus propias cartas en cuenta.
        actualizarBotones();
    }, 900);
}
// =============================================
// 17. SIGUIENTE LANCE Y FIN DE MANO ennada mi archiov67
// =============================================

function declararJugadoresLance(lance) {
    if (lance !== "pares" && lance !== "juego") return;
    const esPares = lance === "pares";
    
    registrar(esPares ? "Declaración de pares." : "Declaración de juego.");

    for (const jugador of jugadores) {
        const estadoDom = {0: "player-status", 1: "right-status", 2: "partner-status", 3: "left-status"}[jugador.id];
        let declaracion = "";

        if (esPares) {
            const pares = analizarPares(jugador);
            declaracion = pares.tipo ? "Tengo pares" : "No tengo pares";
        } else {
            const juego = analizarJuego(jugador);
            declaracion = juego.tieneJuego ? "Tengo juego" : "No tengo juego";
        }

        if (estadoDom) $(estadoDom).textContent = declaracion;
        registrar(`${jugador.nombre}: ${declaracion}.`);
    }
}

function siguienteLance() {
    
    limpiarBocadillos();

    // Cada nuevo lance comienza siempre por el jugador mano.
    turnoEnviteId = manoId;
    pasesConsecutivos = 0;

    // El resultado del lance anterior ya se ha mostrado; retirar ahora todos
    // sus bocadillos antes de comenzar el siguiente.
    
    const orden = REGLAS.lancesActivos;
    const idx = orden.indexOf(lanceActual);

    if (idx === -1 || idx === orden.length - 1) {
        finalizarMano();
        return;
    }

    lanceActual = orden[idx + 1];

    // ▼▼▼ ESTO ES LO QUE ACTIVA LAS DECLARACIONES ▼▼▼
    if (lanceActual === "pares") {
        reiniciarApuestas(); 
        resaltarLance(lanceActual); 
        iniciarDeclaracion("pares");
        return;
    }
    if (lanceActual === "juego") {
        reiniciarApuestas(); 
        resaltarLance(lanceActual); 
        iniciarDeclaracion("juego");
        return;
    }
    // ▲▲▲ FIN ▲▲▲

    // Grande y chica
    reiniciarApuestas(); 
    resaltarLance(lanceActual);
    $("message").textContent = `Lance: ${lanceActual}`;
    $("phase").textContent = "Puedes envidiar o pasar.";
    actualizarBotones();
    setTimeout(() => intentarEnviteIA(), 1200);
}
async function finalizarMano() {
    if (repartiendo) return;
    repartiendo = true;
    actualizarBotones();

    try {
        await revelarTodasLasCartas();

        // 1) Resolver envites pendientes.
              for (const e of envitesPendientes) {
            const ganador = obtenerGanadorLance(e.lance);
            const ganaElQueEnvidio = (ganador.equipo === e.equipo);
            const total = e.importe;                      // ← SIN * 2

            if (ganaElQueEnvidio) {
                tantosMano[e.lance][e.equipo === 0 ? "nosotros" : "ellos"] += total;
                registrar(`Envite ${e.lance}: gana el que envidió (${total} piedras).`);
            } else {
                const otro = e.equipo === 0 ? "ellos" : "nosotros";
                tantosMano[e.lance][otro] += total;
                registrar(`Envite ${e.lance}: gana el otro equipo (${total} piedras).`);
            }
        
        }
          envitesPendientes = [];
        actualizarMarcaEnJuego();

               // 2) Tantos base de los lances
        for (const lance of REGLAS.lancesActivos) {
            // Solo nos saltamos Grande y Chica si hubo envite no querido.
            if (lancesCerradosPorEnvite.includes(lance) && (lance === "grande" || lance === "chica")) {
                registrar(`${lance.toUpperCase()}: cerrado por envite. Sin tantos base.`);
                continue;
            }
            
            // Pares y Juego SIEMPRE se resuelven (incluso si hubo envite no querido)
            const resumen = resolverTantosBaseDeLance(lance);
            registrar(resumen.texto);
        }

        // 3) Sumar al marcador global.
        const totalNosotros = REGLAS.lancesActivos.reduce((s, l) => s + tantosMano[l].nosotros, 0);
        const totalEllos = REGLAS.lancesActivos.reduce((s, l) => s + tantosMano[l].ellos, 0);

        tantosNosotros += totalNosotros;
        tantosEllos += totalEllos;

        let ganadorTexto = "Empate en la mano";
        if (totalNosotros > totalEllos) ganadorTexto = "Gana la mano NOSOTROS";
        if (totalEllos > totalNosotros) ganadorTexto = "Gana la mano ELLOS";

        registrar(`Fin de mano: ${ganadorTexto} (${totalNosotros}-${totalEllos}).`);

        // 4) Conversión a partidas.
              // 4) Comprobar si se gana una partida (los tantos se ACUMULAN).
               const umbral = REGLAS.tantosParaGanarPartida;

        while (tantosNosotros >= umbral) {
            partidasNosotros += 1;
            tantosNosotros -= umbral;        // ← RESTA 25, no resetea a 0
            registrar(`¡NOSOTROS ganamos una partida! (Quedan ${tantosNosotros} tantos)`);
        }

        while (tantosEllos >= umbral) {
            partidasEllos += 1;
            tantosEllos -= umbral;
            registrar(`¡ELLOS ganan una partida! (Quedan ${tantosEllos} tantos)`);
        }
        actualizarMarcador();
        actualizarResumenPuntosMano();
        dibujarPuntosJugadores();
        registrar(`RESUMEN mano ${manoNumero}: Nosotros ${totalNosotros} piedra(s); Ellos ${totalEllos} piedra(s).`);
        for (const lance of REGLAS.lancesActivos) {
            registrar(`Desglose ${lance}: Nosotros ${tantosMano[lance].nosotros}; Ellos ${tantosMano[lance].ellos}.`);
        }
        mostrarAvisoFinMano(ganadorTexto, totalNosotros, totalEllos);

        fase = "finMano";
        $("message").textContent = ganadorTexto;
        $("phase").textContent = "Pulsa «Nueva mano» para continuar.";
    } catch (error) {
        console.error("Error al finalizar la mano:", error);
        registrar("Error al finalizar la mano.");
    } finally {
        repartiendo = false;
        actualizarBotones();
    }
}

async function revelarTodasLasCartas() {
    $("message").textContent = "Se destapan las cartas";
    $("phase").textContent = "Revelando las manos...";

    mostrarCartas("player-hand",  jugadores[0].cartas, false);
    mostrarCartas("right-hand",   jugadores[1].cartas, false);
    mostrarCartas("partner-hand", jugadores[2].cartas, false);
    mostrarCartas("left-hand",    jugadores[3].cartas, false);

    const todos = ["player-hand", "right-hand", "partner-hand", "left-hand"];
    for (const id of todos) {
        const contenedor = $(id);
        if (!contenedor) continue;
        [...contenedor.children].forEach((carta, i) => {
            carta.classList.add("carta-volteada");
            carta.style.animationDelay = `${i * 80}ms`;
        });
    }

    await esperar(700);
}

function mostrarAvisoFinMano(titulo, n, e) {
    // El resultado queda registrado en el historial y en la caja central.
    // No mostrar un segundo aviso sobre las cartas.
    const aviso = $("aviso-fin-mano");
    if (!aviso) return;
    aviso.hidden = true;
    aviso.replaceChildren();
    return;

    aviso.replaceChildren();

    const t = document.createElement("strong");
    t.textContent = titulo;

    const detalle = document.createElement("div");
    detalle.textContent = `Nosotros ${n} · Ellos ${e}`;

    const pista = document.createElement("div");
    pista.style.marginTop = "8px";
    pista.style.fontSize = "12px";
    pista.style.color = "#c0dfc5";
    pista.textContent = "Pulsa «Nueva mano» para seguir.";

    aviso.append(t, detalle, pista);
    aviso.hidden = false;

    setTimeout(() => { aviso.hidden = true; }, 4000);
}

// =============================================
// 18. MARCA DEL JUGADOR MANO
// =============================================

function actualizarMarcaMano() {
    // Indicadores nuevos: se muestran dentro del borde de la caja de apuestas.
    const ids = {
        0: "mano-marca-abajo",      // Tú, abajo
        1: "mano-marca-derecha",    // Rival derecho
        2: "mano-marca-arriba",     // Compañero, arriba
        3: "mano-marca-izquierda"   // Rival izquierdo
    };

    const todos = [
        "mano-marca-abajo",
        "mano-marca-arriba",
        "mano-marca-izquierda",
        "mano-marca-derecha"
    ];

    // Ocultar todos antes de mostrar el que corresponda.
    todos.forEach(id => {
        const marca = document.getElementById(id);
        if (marca) marca.hidden = true;
    });

    const idMarca = ids[Number(manoId)];
    const marca = idMarca ? document.getElementById(idMarca) : null;
    if (marca) {
        marca.hidden = false;
        marca.setAttribute("aria-label", `Mano: ${jugadores[manoId]?.nombre || "jugador"}`);
    }
}

// =============================================
// 19. INICIAR
// =============================================

$("new-btn").addEventListener("click", nuevaMano);
$("mus-btn").addEventListener("click", pedirMus);
$("cut-btn").addEventListener("click", cortarMus);
$("confirm-discard-btn").addEventListener("click", confirmarDescarte);

// ▼▼▼ AÑADE ESTOS DOS ▼▼▼
$("declarar-si-btn").addEventListener("click", () => {
    if (turnoDeclaracion !== 0) return;
    declarar(0, true);
});
$("declarar-no-btn").addEventListener("click", () => {
    if (turnoDeclaracion !== 0) return;
    declarar(0, false);
});
// ▲▲▲ FIN ▲▲▲


$("bet-stones-btn").addEventListener("click", () => {
    registrarEnvite(2, "Envite de dos piedras");
});

$("bet-amarracos-btn").addEventListener("click", () => {
    registrarEnvite(5, "Envite de un amarraco");
});

$("accept-bet-btn").addEventListener("click", () => {
    responderEnvite(true);
});

$("decline-bet-btn").addEventListener("click", () => {
    responderEnvite(false);
});

$("pass-bet-btn").addEventListener("click", () => {
    if (fase !== "grande") return;
    if (envite.activo) return;
   if (!jugadorPuedeIntervenir(jugadores[0], lanceActual)) return;
    registrar(`Pasas en ${lanceActual === "juego" && !hayJuegoEnMesa() ? "punto" : lanceActual}.`);
    mostrarBocadillo(0, "Paso", "normal");
    avanzarTurnoEnvite();
});
actualizarBotones();

// Herramientas auxiliares de auditoría de la partida.
document.addEventListener("DOMContentLoaded", prepararHerramientasPartida);