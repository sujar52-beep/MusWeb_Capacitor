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
    tantosParaGanarPartida: 25,
    partidasParaGanarJuego: 3
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
let turnoMusId = null;
let pasesConsecutivos = 0;

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
let turnoDeclaracion = null;

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
    return 0;
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

    const mazo = $("mazo-fijo");
    if (mazo) mazo.classList.remove("visible");

    ocultarCartaSorteo();
}

function reservarHuecos() {
    const contenedores = {
        0: "player-hand",
        1: "right-hand",
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
    const descarteInicio = $("descarte-central");
    if (descarteInicio) { descarteInicio.classList.add("hidden"); descarteInicio.replaceChildren(); }
    montonDeDescartes = [];

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

            if (repartidorId === null || repartidorId === undefined || !jugadores[repartidorId]) {
                repartidorId = Math.floor(Math.random() * jugadores.length);
            }

            mostrarCartaSorteo(cartaSorteo);
            registrar(`Sorteo inicial: ${cartaSorteo.nombre} de ${cartaSorteo.palo}.`);

            const nombreRepartidor = jugadores[repartidorId] ? jugadores[repartidorId].nombre : "Alguien";
            registrar(`Le corresponde repartir a ${nombreRepartidor}.`);

            await esperar(1600);
            ocultarCartaSorteo();
            $("mus-text-overlay")?.classList.add("visible");

            sorteoInicializado = true;
        } else {
            repartidorId = (repartidorId + 1) % jugadores.length;
        }

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

        for (let ronda = 0; ronda < REGLAS.cartasPorJugador; ronda++) {
            for (const indiceJugador of ordenReparto) {
                if (!jugadores[indiceJugador]) continue;
                const carta = baraja.pop();
                if (carta) {
                    jugadores[indiceJugador].cartas.push(carta);
                }
            }
        }

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
    const ids = {
        0: "mano-marca-abajo",
        1: "mano-marca-derecha",
        2: "mano-marca-arriba",
        3: "mano-marca-izquierda"
    };

    const todos = [
        "mano-marca-abajo",
        "mano-marca-arriba",
        "mano-marca-izquierda",
        "mano-marca-derecha"
    ];

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
// =============================================

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
        0: "mazo-slot-player",
        1: "mazo-slot-right",
        2: "mazo-slot-partner",
        3: "mazo-slot-left"
    };

    const slot = document.getElementById(slots[Number(repartidorId)]);
    if (!slot) {
        console.warn("No existe el hueco ficticio para repartidor", repartidorId);
        return;
    }

    mazo.classList.add("visible");
    mazo.style.position = "absolute";
    mazo.style.transformOrigin = "center center";

    const rotacion = Number(repartidorId) === 1 ? 90
                   : Number(repartidorId) === 3 ? -90
                   : 0;
    mazo.style.transform = rotacion ? `rotate(${rotacion}deg)` : "none";

    const rectMesa  = mesa.getBoundingClientRect();
    const rectSlot  = slot.getBoundingClientRect();
    const anchoMazo = mazo.offsetWidth  || 60;
    const altoMazo  = mazo.offsetHeight || 92;

    const left = rectSlot.left - rectMesa.left + (rectSlot.width  - anchoMazo) / 2;
    const top  = rectSlot.top  - rectMesa.top  + (rectSlot.height - altoMazo)  / 2;

    mazo.style.left = `${left}px`;
    mazo.style.top  = `${top}px`;
}

async function animarReparto() {
    const mazo = $("mazo-fijo");
    if (!mazo) return;

    const duracionVuelo = 405;

    const contenedores = {
        0: "player-hand",
        1: "right-hand",
        2: "partner-hand",
        3: "left-hand"
    };

    mazo.replaceChildren();
    for (let i = 0; i < 4; i++) {
        const carta = document.createElement("div");
        carta.className = "card back";
        carta.style.transform = `translate(${i * 2}px, ${i * -2}px)`;
        mazo.appendChild(carta);
    }

    colocarMazoAIRepartidor();

    await new Promise(resolve => requestAnimationFrame(resolve));

    const ordenReparto = [];
    for (let paso = 1; paso < jugadores.length; paso++) {
        ordenReparto.push((repartidorId + paso) % jugadores.length);
    }
    ordenReparto.push(repartidorId);

    for (let ronda = 0; ronda < REGLAS.cartasPorJugador; ronda++) {
        for (const indiceJugador of ordenReparto) {
            const contenedor = $(contenedores[indiceJugador]);
            if (!contenedor) continue;

            const hueco = contenedor.querySelector(`.card-slot[data-indice="${ronda}"]`);
            if (!hueco) continue;

            const rectDestino = hueco.getBoundingClientRect();
            const rectMazo = mazo.getBoundingClientRect();

            const origenX = rectMazo.left + rectMazo.width  / 2 - rectDestino.width  / 2;
            const origenY = rectMazo.top  + rectMazo.height / 2 - rectDestino.height / 2;

            const cartaVoladora = document.createElement("div");
            cartaVoladora.className = "card back";

            Object.assign(cartaVoladora.style, {
                position: "fixed",
                left: `${origenX}px`,
                top: `${origenY}px`,
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

    colocarMazoAIRepartidor();
}

async function animarRepartoDeNuevasCartas(cartasPorJugador) {
    const mazo = $("mazo-fijo");
    if (!mazo) return;

    colocarMazoAIRepartidor();
    await new Promise(resolve => requestAnimationFrame(resolve));

    const duracionVuelo = 550;
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
    await animarRepartoDeNuevasCartas(cartasARepartir);

    fase = "mus";
    turnoMusId = manoId;

    $("message").textContent = "Ronda de mus";
    $("phase").textContent = `Empieza ${jugadores[turnoMusId].nombre}, que es mano`;
    $("player-status").textContent = "Esperando tu turno de mus";

    renderizarMesa();
    actualizarBotones();

    procesarTurnoMus();
}

// =============================================
// 10. LOG
// =============================================

function mostrarBocadillo(idJugador, texto, tipo = "normal") {
    const contenedores = {
        0: "player-hand",
        1: "right-hand",
        2: "partner-hand",
        3: "left-hand"
    };

    const contenedorCartas = $(contenedores[idJugador]);
    if (!contenedorCartas) return;

    const padre = contenedorCartas.closest('.player') || contenedorCartas.parentElement;
    if (!padre) return;

    const anterior = padre.querySelector('.bocadillo');
    if (anterior) anterior.remove();

    const equipo = jugadores[idJugador]?.equipo === 0 ? "nosotros" : "ellos";
    const boca = document.createElement('div');
    const clasePos = {
        0: 'bocadillo-abajo',
        1: 'bocadillo-derecha',
        2: 'bocadillo-arriba',
        3: 'bocadillo-izquierda'
    }[idJugador] || '';

    boca.className = `bocadillo ${tipo} equipo-${equipo} ${clasePos} bocadillo-jugador-${idJugador}`;
    boca.dataset.jugador = idJugador;
    boca.textContent = texto;

    padre.appendChild(boca);

    requestAnimationFrame(() => boca.classList.add('visible'));
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
        boton.textContent = 'H';
        boton.setAttribute('aria-label', 'Abrir historial de la partida');
        boton.title = 'Historial de la partida';
        boton.addEventListener('click', () => {
            const panel = $('historial-partida-panel');
            if (!panel) return;
            panel.hidden = !panel.hidden;
            historialAbierto = !panel.hidden;
            if (!panel.hidden) renderizarHistorial();
        });
        const contenedor = $('marcador-movil') || document.body;
        contenedor.appendChild(boton);
    }
    const botonHistorial = $('historial-partida-btn');
    if (botonHistorial) {
        botonHistorial.textContent = 'H';
        botonHistorial.setAttribute('aria-label', 'Abrir historial de la partida');
        botonHistorial.title = 'Historial de la partida';
        const marcador = $('marcador-movil');
        if (marcador && botonHistorial.parentElement !== marcador) marcador.appendChild(botonHistorial);
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
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function actualizarResumenPuntosMano() {
    if (!jugadores.length) return;

    const hayPares = hayParesEnMesa();
    const hayJuego = hayJuegoEnMesa();

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

        const ganaPares = !!(ganadorPares && ganadorPares.equipo === jugador.equipo);
        const ganaJuego = !!(ganadorJuego && ganadorJuego.equipo === jugador.equipo);

        const puntosPares = ganaPares && pares.tipo ? pares.puntos : 0;
        let puntosJuego = 0;

        if (hayJuego && ganaJuego && juego.tieneJuego) {
            puntosJuego = juego.suma === 31 ? 3 : 2;
        } else if (!hayJuego && ganadorJuego && ganadorJuego.id === jugador.id) {
            puntosJuego = 1;
        }

        totalesExtras[equipo] += puntosPares + puntosJuego;

        if (detalle) {
            const fila = document.createElement("div");
            fila.className = "puntos-extras-jugador";
            const nombre = document.createElement("strong");
            nombre.textContent = jugador.nombre;
            const conceptos = document.createElement("span");

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
        const ganaJuegoEquipo = ganadorJuego && ganadorJuego.equipo === jugador.equipo;
        const ganaPunto = ganadorJuego && ganadorJuego.id === jugador.id;

        if (ganaPares && pares.tipo) {
            const nombre = pares.nombre === "Pares" ? "Pareja" : pares.nombre;
            lineas.push(`${nombre}: +${pares.puntos}`);
        }

        if (hayJuego) {
            if (ganaJuegoEquipo && juego.tieneJuego) {
                lineas.push(`Juego (${juego.suma}): +${juego.suma === 31 ? 3 : 2}`);
            }
        } else {
            if (ganaPunto) {
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

    const enDeclaracion = (fase === "declararPares" || fase === "declararJuego") && !ocupado;
    const esMiTurnoDeclaracion =
        enDeclaracion &&
        turnoDeclaracion === 0 &&
        jugadorTiene(0);

    const enMus = fase === "mus" && !ocupado && turnoMusId === 0;
    const enDescarte = fase === "descarte" && !ocupado;

    $("new-btn").disabled = ocupado;
    $("mus-btn").disabled = !enMus;
    $("cut-btn").disabled = !enMus;

    if ($("confirm-discard-btn")) {
        $("confirm-discard-btn").disabled = !enDescarte;
    }

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

    if (botonNuevo) {
        botonNuevo.hidden = !(
            fase === "inicio" ||
            fase === "finMano"
        );
    }

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

    const todosLosIds = ["new-btn", ...botones];

    const hayAlgunBotonVisible = todosLosIds.some(id => {
        const boton = $(id);
        return boton && !boton.hidden;
    });

    panel.hidden = !hayAlgunBotonVisible;
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
    limpiarBocadillos();
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

    const idJugador = turnoDeclaracion;
    const faseDeclaracion = fase;
    const jugador = jugadores[idJugador];
    if (!jugador) return;

    const declaraciones = faseDeclaracion === "declararPares"
        ? declaracionesPares
        : declaracionesJuego;

    // Evita programar dos veces la declaración de un mismo jugador.
    if (Object.prototype.hasOwnProperty.call(declaraciones, idJugador)) return;

    // Si el humano no tiene la jugada, declara automáticamente "no tengo".
    if (jugador.humano) {
        const tiene = jugadorTiene(idJugador);

        if (!tiene) {
            actualizarBotones();
            setTimeout(() => {
                if (fase !== faseDeclaracion || turnoDeclaracion !== idJugador) return;
                declarar(idJugador, false);
            }, 800);
            return;
        }

        $("player-status").textContent = "Declara tu jugada";
        actualizarBotones();
        return;
    }

    setTimeout(() => {
        if (fase !== faseDeclaracion || turnoDeclaracion !== idJugador) return;
        const tiene = jugadorTiene(idJugador);
        declarar(idJugador, tiene);
    }, 900);
}

// ▼▼▼ NUEVA: comprueba si un jugador tiene la jugada del lance de declaración actual.
function jugadorTiene(idJugador) {
    const jugador = jugadores[idJugador];
    if (!jugador) return false;
    if (fase === "declararPares") return analizarPares(jugador).tipo > 0;
    if (fase === "declararJuego") return analizarJuego(jugador).tieneJuego;
    return false;
}
// ▲▲▲ FIN ▲▲▲

function declarar(idJugador, tiene) {
    // ▼▼▼ GUARDAS ANTI-DOBLE DECLARACIÓN ▼▼▼
    if (!["declararPares", "declararJuego"].includes(fase)) return;
    if (idJugador !== turnoDeclaracion || !jugadores[idJugador]) return;

    const esPares = fase === "declararPares";
    const declaraciones = esPares ? declaracionesPares : declaracionesJuego;

    if (Object.prototype.hasOwnProperty.call(declaraciones, idJugador)) return;
    // ▲▲▲ FIN ▲▲▲

    declaraciones[idJugador] = tiene;

    const estados = { 0: "player-status", 1: "right-status", 2: "partner-status", 3: "left-status" };
    const elEstado = $(estados[idJugador]);

    if (elEstado) {
        elEstado.textContent = tiene
            ? (esPares ? "Tengo pares" : "Tengo juego")
            : (esPares ? "No tengo pares" : "No tengo juego");
        elEstado.classList.add("declaracion");
    }

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

    const nosotrosTieneJuego = jugadores.some(j => j.equipo === 0 && analizarJuego(j).tieneJuego);
    const ellosTieneJuego = jugadores.some(j => j.equipo === 1 && analizarJuego(j).tieneJuego);

    if (!algunoTiene) {
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
    const infoCentral = $('info-central');
    const descarteCentral = $('descarte-central');
    if (infoCentral) infoCentral.classList.remove('hidden');
    if (descarteCentral) {
        descarteCentral.classList.add('hidden');
        descarteCentral.replaceChildren();
    }

    turnoMusId = null;
    for (const jugador of jugadores) {
        const estadoDom = {0: "player-status", 1: "right-status", 2: "partner-status", 3: "left-status"}[jugador.id];
        if (estadoDom) $(estadoDom).textContent = jugador.id === id ? "Corta el mus" : "Se juega grande";
    }
    registrar(`${jugadores[id].nombre} corta el mus. Se juega grande.`);

    fase = "transicion";
    actualizarBotones();

    setTimeout(() => {
        if (fase !== "transicion") return;
        comenzarFaseGrande("¡No hay mus!", "Comienza la fase de grande.");
    }, 2000);
}

function comenzarFaseGrande(mensaje, logMsg, lanceInicial = "grande") {
    limpiarBocadillos();
    fase = "grande";
    lanceActual = lanceInicial;
    turnoEnviteId = manoId;
    pasesConsecutivos = 0;
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
                    transition: "all 450ms cubic-bezier(0.3, 0, 0.3, 1)",
                });

                document.body.appendChild(cartaVoladora);
                cartaEl.style.opacity = '0';

                await esperar(10);

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
            await esperar(90);
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
        .sort((a, b) => {
            if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
            return pesoPares(b.valor) - pesoPares(a.valor);
        });

    if (!grupos.length) return { tipo: 0, nombre: "Sin pares", puntos: 0, clave: [] };

    if (grupos.length >= 2 || grupos[0].cantidad === 4) {
        const valores = grupos.slice(0, 2)
            .map(g => pesoPares(g.valor))
            .sort((a, b) => b - a);
        return { tipo: 3, nombre: "Duples", puntos: 3, clave: [3, ...valores] };
    }

    const g = grupos[0];
    if (g.cantidad === 3) {
        return { tipo: 2, nombre: "Medias", puntos: 2, clave: [2, pesoPares(g.valor)] };
    }

    return { tipo: 1, nombre: "Pares", puntos: 1, clave: [1, pesoPares(g.valor)] };
}

function pesoPares(valor) {
    if (valor === 3 || valor === 12) return 10;
    if (valor === 1 || valor === 2) return 1;
    return valor;
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

        if (paresA.tipo !== paresB.tipo) return paresA.tipo > paresB.tipo ? 1 : -1;
        if (paresA.tipo === 0) return 0;

        const cmpClave = compararClaves(paresA.clave, paresB.clave);
        if (cmpClave !== 0) return cmpClave;

        const cartasA = jugadorA.cartas.filter(c => valorMus(c) !== paresA.clave[1]).map(c => REGLAS.ordenGrande.indexOf(c.valor));
        const cartasB = jugadorB.cartas.filter(c => valorMus(c) !== paresB.clave[1]).map(c => REGLAS.ordenGrande.indexOf(c.valor));

        cartasA.sort((a, b) => a - b);
        cartasB.sort((a, b) => a - b);

        const mejorA = cartasA[0] ?? 99;
        const mejorB = cartasB[0] ?? 99;

        if (mejorA !== mejorB) return mejorA < mejorB ? 1 : -1;
        return 0;
    }

    if (lance === "juego") {
        const a = analizarJuego(jugadorA);
        const b = analizarJuego(jugadorB);
        const aTiene = a.tieneJuego;
        const bTiene = b.tieneJuego;

        if (aTiene !== bTiene) return aTiene ? 1 : -1;

        if (!aTiene) {
            return a.suma === b.suma ? 0 : a.suma > b.suma ? 1 : -1;
        }

        const valorA = getValorJuego(a.suma);
        const valorB = getValorJuego(b.suma);
        return valorA === valorB ? 0 : valorA > valorB ? 1 : -1;
    }

    const orden = lance === "chica" ? REGLAS.ordenChica : REGLAS.ordenGrande;
    return compararManos(jugadorA, jugadorB, orden);
}

function obtenerGanadorLance(lance) {
    if (!jugadores || !jugadores.length) return null;

    let mejoresJugadores = [jugadores[0]];

    for (let i = 1; i < jugadores.length; i++) {
        const jugadorActual = jugadores[i];
        const mejorDeLaLista = mejoresJugadores[0];
        const comparacion = compararLance(jugadorActual, mejorDeLaLista, lance);

        if (comparacion > 0) {
            mejoresJugadores = [jugadorActual];
        } else if (comparacion === 0) {
            mejoresJugadores.push(jugadorActual);
        }
    }

    if (mejoresJugadores.length === 1) {
        return mejoresJugadores[0];
    }

    const ordenDeMano = obtenerOrdenDeMano();
    for (const id of ordenDeMano) {
        const ganadorPorMano = mejoresJugadores.find(j => j.id === id);
        if (ganadorPorMano) {
            return ganadorPorMano;
        }
    }

    return null;
}

function resolverTantosBaseDeLance(lance) {
    const ganador = obtenerGanadorLance(lance);
    if (!ganador) return { ganador: null, texto: `Nadie gana ${lance}.` };

    const equipoGanadorKey = ganador.equipo === 0 ? "nosotros" : "ellos";
    let puntosGanador = 0;

    if (lance === "pares") {
        if (!hayParesEnMesa()) return { ganador: null, texto: "PARES: nadie tiene pares; 0 tantos." };

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
        if (hayJuegoEnMesa()) {
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

    const betArea = $("bet-area");
    if (betArea) {
        betArea.querySelectorAll(".puntos-jugador").forEach(el => el.remove());
    }
}

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
    mostrarBocadillo(0, "¡Envido!", "rojo");
    registrar(`Tu equipo envida ${cantidad} piedras.`);

    dibujarApuesta();
    actualizarMarcaEnJuego();
    actualizarBotones();

    setTimeout(() => responderEnviteRival(), 1000);
}

function reenvidar(cantidad) {
    if (!envite.activo || envite.respondiente !== 0) return;

    envite.base += envite.pendiente;
    envite.pendiente = cantidad;
    envite.ultimoEnvidante = 0;
    envite.respondiente = 1;

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

    const lance = envite.lance;

    const rivalQueDecide =
        mejorJugadorEquipoEnviteIA(1, lance) || jugadores[1];

    const idBocadillo = rivalQueDecide.id;

    const importeActual = envite.base + envite.pendiente;

    const decision = decidirRespuestaEnviteIA(
        1,
        lance,
        importeActual,
        importeActual < 12
    );

    if (decision === "reenvido" && importeActual < 12) {
        envite.base += envite.pendiente;
        envite.pendiente = 2;
        envite.ultimoEnvidante = 1;
        envite.respondiente = 0;

        mostrarBocadillo(idBocadillo, "¡Reenvido!", "rojo");

        $("bet-title").textContent = "Reenvite del rival";
        $("message").textContent = "¡El rival reenvía!";
        $("phase").textContent = `Aceptan ${envite.base} y suben 2`;

        registrar(`El rival reenvida 2 piedras. Base: ${envite.base}.`);

        dibujarApuesta();
        actualizarMarcaEnJuego();
        actualizarBotones();

        return;
    }

    if (decision === "quiero") {
        envite.base += envite.pendiente;
        envite.pendiente = 0;

        envitesPendientes.push({
            lance: lance,
            equipo: envite.ultimoEnvidante,
            importe: envite.base
        });

        lancesCerradosPorEnvite.push(lance);

        mostrarBocadillo(idBocadillo, "Quiero", "verde");

        $("message").textContent = "El rival quiere";
        $("phase").textContent = `Envite aceptado: ${envite.base} piedras en juego`;
        registrar(`El rival quiere. En juego: ${envite.base} piedras.`);

        envite = {
            activo: false,
            lance: null,
            ultimoEnvidante: null,
            respondiente: null,
            base: 0,
            pendiente: 0
        };

        dibujarApuesta();
        actualizarMarcaEnJuego();
        actualizarBotones();

        setTimeout(() => siguienteLance(), 1000);

        return;
    }

    const gananciaRival = envite.base > 0 ? envite.base : 1;

    const equipoGanadorEnvite =
        envite.ultimoEnvidante === 0 ? "nosotros" : "ellos";

    tantosMano[lance][equipoGanadorEnvite] += gananciaRival;

    lancesCerradosPorEnvite.push(lance);

    mostrarBocadillo(idBocadillo, "No quiero", "rojo");

    $("message").textContent = "El rival no quiere";
    $("phase").textContent = `Ganas ${gananciaRival} piedras`;
    registrar(`El rival no quiere. Ganas ${gananciaRival} piedras.`);

    envite = {
        activo: false,
        lance: null,
        ultimoEnvidante: null,
        respondiente: null,
        base: 0,
        pendiente: 0
    };

    actualizarMarcador();
    dibujarApuesta();
    actualizarMarcaEnJuego();
    actualizarBotones();

    setTimeout(() => siguienteLance(), 1200);
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

            mostrarBocadillo(0, "No puedo", "rojo");

            $("message").textContent = "Nadie tiene la jugada. No se puede querer.";
            $("phase").textContent = `El rival gana ${gananciaMia} piedra(s) por deje.`;
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

        mostrarBocadillo(0, "Quiero", "verde");

        $("message").textContent = "Quieres el envite";
        $("phase").textContent = `${envite.base} piedras en juego`;
        registrar(`Quieres. En juego: ${envite.base} piedras.`);
        envite = { activo: false, lance: null, ultimoEnvidante: null, respondiente: null, base: 0, pendiente: 0 };
        dibujarApuesta(); actualizarMarcaEnJuego(); actualizarBotones(); setTimeout(() => siguienteLance(), 1000);
    } else {
        const gananciaMia = envite.base > 0 ? envite.base : 1;
        const equipoGanadorEnvite = envite.ultimoEnvidante === 0 ? "nosotros" : "ellos";
        tantosMano[envite.lance][equipoGanadorEnvite] += gananciaMia;
        lancesCerradosPorEnvite.push(envite.lance);

        mostrarBocadillo(0, "No quiero", "rojo");

        $("message").textContent = "No quieres";
        $("phase").textContent = `El rival gana ${gananciaMia} piedras`;
        registrar(`No quieres. El rival gana ${gananciaMia} piedras.`);
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
    return lance !== "juego" || !hayJuegoEnMesa();
}

function jugadorPuedeIntervenir(jugador, lance) {
    if (!jugador) return false;

    if (lance === "pares") {
        return analizarPares(jugador).tipo > 0;
    }

    if (lance === "juego" && hayJuegoEnMesa()) {
        return analizarJuego(jugador).tieneJuego;
    }

    return true;
}

function fuerzaEnviteIA(jugador, lance) {
    if (lance === "grande") {
        return jugador.cartas.reduce((s, c) => s + (10 - REGLAS.ordenGrande.indexOf(c.valor)), 0);
    }
    if (lance === "chica") {
        const valores = jugador.cartas
            .map(c => REGLAS.ordenChica.indexOf(c.valor))
            .sort((a, b) => a - b);
        return valores.reduce((s, rango, i) => s + (10 - rango) * (4 - i), 0);
    }
    if (lance === "pares") {
        const p = analizarPares(jugador);
        if (p.tipo === 3) return 30 + (p.clave[1] || 0) + (p.clave[2] || 0);
        if (p.tipo === 2) return 20 + (p.clave[1] || 0);
        if (p.tipo === 1) return 10 + (p.clave[1] || 0);
        return 0;
    }
    if (lance === "juego" && hayJuegoEnMesa()) {
        const j = analizarJuego(jugador);
        return j.tieneJuego ? 30 + j.fuerza : 0;
    }
    if (lance === "juego") {
        return analizarJuego(jugador).suma;
    }
    return 0;
}

function debeEnvidarIA(jugador, lance) {
    const fuerza = fuerzaEnviteIA(jugador, lance);
    if (lance === "grande") return fuerza >= 30;
    if (lance === "chica") return fuerza >= 70;
    if (lance === "pares") return fuerza >= 10;
    if (lance === "juego" && hayJuegoEnMesa()) return fuerza >= 31;
    if (lance === "juego") return fuerza >= 30;
    return false;
}

function umbralBaseEnviteIA(lance) {
    if (lance === "grande") return 30;
    if (lance === "chica") return 70;
    if (lance === "pares") return 10;
    if (lance === "juego" && hayJuegoEnMesa()) return 31;
    if (lance === "juego") return 30;

    return Infinity;
}

function mejorJugadorEquipoEnviteIA(equipo, lance) {
    if (!jugadores || !jugadores.length) return null;

    const candidatos = jugadores.filter(j =>
        j.equipo === equipo && jugadorPuedeIntervenir(j, lance)
    );

    if (!candidatos.length) return null;

    return candidatos.reduce((mejor, actual) => {
        return fuerzaEnviteIA(actual, lance) >
               fuerzaEnviteIA(mejor, lance)
            ? actual
            : mejor;
    });
}

function debeEnvidarEquipoIA(equipo, lance) {
    const mejor = mejorJugadorEquipoEnviteIA(equipo, lance);

    if (!mejor) return false;

    return fuerzaEnviteIA(mejor, lance) >=
           umbralBaseEnviteIA(lance);
}

function incrementoReenvidoIA(lance) {
    const incrementos = {
        grande: 8,
        chica: 15,
        pares: 8,
        juego: 3
    };

    return incrementos[lance] || 5;
}

function decidirRespuestaEnviteIA(
    equipo,
    lance,
    importeActual = 2,
    puedeReenvidar = true
) {
    const mejor = mejorJugadorEquipoEnviteIA(equipo, lance);

    if (!mejor) return "noquiero";

    const fuerza = fuerzaEnviteIA(mejor, lance);
    const umbral = umbralBaseEnviteIA(lance);

    if (fuerza < umbral) return "noquiero";

    if (!puedeReenvidar) return "quiero";

    const incremento = incrementoReenvidoIA(lance);

    const penalizacion = Math.max(0, importeActual - 2)
        * (incremento / 4);

    const umbralReenvido = umbral + incremento + penalizacion;

    if (fuerza >= umbralReenvido) {
        return "reenvido";
    }

    return "quiero";
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

    const jugadorTurno = jugadores[turnoEnviteId];

    if (!jugadorPuedeIntervenir(jugadorTurno, lanceActual)) {
        registrar(`No interviene ${jugadorTurno.nombre} en ${lanceActual}: no tiene la jugada.`);

        if (turnoEnviteId === 0) {
            actualizarBotones();
            $("phase").textContent = `No tienes ${lanceActual}. Pasando...`;
        }

        setTimeout(() => avanzarTurnoEnvite(), 300);
        return;
    }

    actualizarBotones();

    if (turnoEnviteId === 0) {
        $("phase").textContent = `Tu turno (${lanceActual}). Puedes envidar o pasar.`;
    } else {
        $("phase").textContent = `Turno de ${jugadorTurno.nombre}...`;
        setTimeout(() => intentarEnviteIA(), 1000);
    }
}

function intentarEnviteIA() {
    if (fase !== "grande" || envite.activo) return;
    if (turnoEnviteId === null || turnoEnviteId === 0) return;

    const jugador = jugadores[turnoEnviteId];

    if (!jugador || jugador.humano) return;

    const tieneJugada = jugadorPuedeIntervenir(jugador, lanceActual);

    const equipoContrario = jugador.equipo === 0 ? 1 : 0;

    const rivalPuede = puedeEnvidarEnLance(
        equipoContrario,
        lanceActual
    );

    const equipoQuiereEnvidar = debeEnvidarEquipoIA(
        jugador.equipo,
        lanceActual
    );

    if (!tieneJugada || !rivalPuede || !equipoQuiereEnvidar) {
        mostrarBocadillo(jugador.id, "Paso", "normal");
        registrar(`${jugador.nombre} pasa.`);
        avanzarTurnoEnvite();
        return;
    }

    mostrarBocadillo(jugador.id, "¡Envido!", "rojo");

    pasesConsecutivos = 0;

    envite = {
        activo: true,
        lance: lanceActual,
        ultimoEnvidante: jugador.equipo,
        respondiente: jugador.equipo === 0 ? 1 : 0,
        base: 0,
        pendiente: 2
    };

    $("bet-title").textContent =
        `Envite de ${jugador.nombre} · ${lanceActual.toUpperCase()}`;

    $("message").textContent = "¡Hay envite!";
    $("phase").textContent = "2 piedras pendientes de respuesta";

    registrar(`${jugador.nombre} envida 2 piedras.`);

    dibujarApuesta();
    actualizarMarcaEnJuego();
    actualizarBotones();

    if (jugador.equipo === 0) {

        setTimeout(() => responderEnviteRival(), 1000);

    } else {

        const yoTengo = jugadorPuedeIntervenir(
            jugadores[0],
            lanceActual
        );

        const companeroTiene = jugadorPuedeIntervenir(
            jugadores[2],
            lanceActual
        );

        if (!yoTengo && companeroTiene) {
            setTimeout(() => procesarRespuestaCompanero(), 1200);
        }
    }
}

function procesarRespuestaCompanero() {
    if (!envite.activo || envite.respondiente !== 0) return;

    $("phase").textContent =
        "Tu compañero está valorando el envite...";

    actualizarBotones();

    setTimeout(() => {

        if (!envite.activo || envite.respondiente !== 0) return;

        const importeActual = envite.base + envite.pendiente;

        const decisionIA = decidirRespuestaEnviteIA(
            0,
            envite.lance,
            importeActual,
            false
        );

        const companeroQuiere = decisionIA === "quiero";

        const decision = companeroQuiere ? "Quiero" : "No quiero";

        mostrarBocadillo(
            2,
            decision,
            companeroQuiere ? "verde" : "rojo"
        );

        $("message").textContent =
            `Tu compañero dice «${decision}»`;

        $("phase").textContent = companeroQuiere
            ? "Tu compañero quiere; ahora decides tú."
            : "Tu compañero no quiere; puedes decidir tú. Si rechazas, se cerrará el envite.";

        registrar(
            `Tu compañero opina: ${decision}. La decisión final queda en tus manos.`
        );

        actualizarBotones();

    }, 900);
}

// =============================================
// 17. SIGUIENTE LANCE Y FIN DE MANO
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

    turnoEnviteId = manoId;
    pasesConsecutivos = 0;

    const orden = REGLAS.lancesActivos;
    const idx = orden.indexOf(lanceActual);

    if (idx === -1 || idx === orden.length - 1) {
        finalizarMano();
        return;
    }

    lanceActual = orden[idx + 1];

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
    limpiarBocadillos();
    actualizarBotones();

    try {
        await revelarTodasLasCartas();

        // 1) Resolver envites pendientes (aceptados).
        for (const e of envitesPendientes) {
            const ganador = obtenerGanadorLance(e.lance);
            // ▼▼▼ CORRECCIÓN: guarda por si no hay ganador ▼▼▼
            if (!ganador) {
                registrar(`No se pudo determinar el ganador del envite de ${e.lance}.`);
                continue;
            }

            const ganaElQueEnvidio = (ganador.equipo === e.equipo);
            const total = e.importe;

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

        // 2) Tantos base de los lances.
        for (const lance of REGLAS.lancesActivos) {
            if (lancesCerradosPorEnvite.includes(lance) && (lance === "grande" || lance === "chica")) {
                registrar(`${lance.toUpperCase()}: cerrado por envite. Sin tantos base.`);
                continue;
            }

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

        // 4) Conversión a partidas: al alcanzar el umbral se gana partida y los tantos VUELVEN A CERO.
        const umbral = REGLAS.tantosParaGanarPartida;

        if (tantosNosotros >= umbral) {
            partidasNosotros += 1;
            tantosNosotros = 0;
            registrar("¡NOSOTROS ganan una partida! Sus tantos vuelven a 0.");
        }

        if (tantosEllos >= umbral) {
            partidasEllos += 1;
            tantosEllos = 0;
            registrar("¡ELLOS ganan una partida! Sus tantos vuelven a 0.");
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

        // 5) Comprobar si se ha ganado el JUEGO (mejor de 5 = 3 partidas).
        if (partidasNosotros >= REGLAS.partidasParaGanarJuego) {
            registrar("¡¡NOSOTROS GANAMOS EL JUEGO!!");
            $("message").textContent = "¡¡HAS GANADO EL JUEGO!!";
            $("phase").textContent = "Pulsa «Nueva mano» para reiniciar.";
        } else if (partidasEllos >= REGLAS.partidasParaGanarJuego) {
            registrar("¡¡ELLOS GANAN EL JUEGO!!");
            $("message").textContent = "¡¡HAN GANADO ELLOS EL JUEGO!!";
            $("phase").textContent = "Pulsa «Nueva mano» para reiniciar.";
        }
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
    const aviso = $("aviso-fin-mano");
    if (!aviso) return;
    aviso.hidden = true;
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
// 19. INICIAR
// =============================================

$("new-btn").addEventListener("click", nuevaMano);
$("mus-btn").addEventListener("click", pedirMus);
$("cut-btn").addEventListener("click", cortarMus);
$("confirm-discard-btn").addEventListener("click", confirmarDescarte);

$("declarar-si-btn").addEventListener("click", () => {
    if (turnoDeclaracion !== 0) return;
    declarar(0, true);
});
$("declarar-no-btn").addEventListener("click", () => {
    if (turnoDeclaracion !== 0) return;
    declarar(0, false);
});

$("bet-stones-btn").addEventListener("click", () => {
    registrarEnvite(2, "Envidar 2");
});

$("bet-amarracos-btn").addEventListener("click", () => {
    registrarEnvite(5, "Envidar 5");
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

document.addEventListener("DOMContentLoaded", prepararHerramientasPartida);