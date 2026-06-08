# Fases de Desarrollo - Esta Locura

## Enfoque general

El desarrollo se divide en fases progresivas para minimizar riesgo y llegar rapido a un MVP jugable. El objetivo es construir primero el core del juego en singleplayer y despues sumar sincronizacion realtime y salas privadas.

---

## Fase 0 - Discovery y definicion tecnica

### Objetivo

Cerrar las reglas del producto y dejar lista la base tecnica antes de escribir codigo de negocio.

### Tareas

- definir reglas exactas del draft
- cerrar lista inicial de formaciones
- definir formato de datos para selecciones y jugadores
- documentar flujo del Mundial 2026
- diseñar esquema de base de datos
- definir contratos de eventos realtime

### Entregables

- documento de arquitectura
- esquema inicial de DB
- backlog tecnico inicial
- formato JSON de seed de selecciones y jugadores

### Criterio de salida

El equipo puede empezar la implementacion sin dudas sobre reglas, entidades ni flujo principal del juego.

---

## Fase 1 - Setup del proyecto y persistencia base

### Objetivo

Levantar la app y dejar preparada la infraestructura gratuita elegida.

### Tareas

- crear proyecto `Next.js` con `TypeScript`
- configurar `Tailwind CSS`
- configurar `Drizzle ORM`
- conectar `Neon Postgres`
- crear migraciones iniciales
- cargar seeds de selecciones y jugadores
- preparar layout base y ruta inicial

### Entregables

- repositorio base operativo
- base de datos conectada
- tablas creadas y seed inicial cargado
- home del proyecto funcionando

### Criterio de salida

La app levanta localmente y puede leer datos reales desde Neon.

---

## Fase 2 - Draft singleplayer

### Objetivo

Implementar el primer loop jugable del producto: configuracion + draft completo.

### Tareas

- pantalla de configuracion inicial
- seleccion de formacion
- seleccion de modo `Clasico` o `Memoria`
- render del campo segun formacion
- ruleta/dado de paises
- listado de jugadores disponibles por seleccion
- bloqueo de posiciones ya ocupadas
- logica de rerolls limitados
- validacion de once completo

### Entregables

- experiencia singleplayer de draft funcional
- persistencia del equipo drafteado
- UI base del campo y de slots

### Criterio de salida

El usuario puede completar un once inicial y cerrar el draft sin inconsistencias.

---

## Fase 3 - Simulador del Mundial 2026

### Objetivo

Completar el loop singleplayer con fase de grupos y llave final.

### Tareas

- generacion de 12 grupos de 4
- sistema de puntos y desempates
- ranking de mejores terceros
- armado de dieciseisavos
- simulacion de partidos
- simulacion de eventos clave
- definicion por penales en cruces KO
- render del bracket completo

### Entregables

- Mundial 2026 completo jugable
- modulo de simulacion desacoplado de la UI
- resumen de resultados por ronda

### Criterio de salida

La partida singleplayer puede ir desde el draft hasta la final del torneo.

---

## Fase 4 - Persistencia, historial y card final

### Objetivo

Dar cierre de producto al modo singleplayer y habilitar share.

### Tareas

- guardar torneos finalizados
- guardar estadisticas basicas de la run
- crear pantalla final de campeon/eliminado
- generar card compartible
- crear historial simple de partidas

### Entregables

- resultado final persistido
- card visual para compartir
- historial basico de partidas jugadas

### Criterio de salida

Existe un singleplayer completo, persistido y presentable como primera version publica.

---

## Fase 5 - Infraestructura realtime y salas privadas

### Objetivo

Agregar la capa minima necesaria para jugar con amigos en tiempo real.

### Tareas

- integrar `PartyKit`
- crear modelo de sala privada
- generar codigos de acceso
- crear lobby con host e invitados
- sincronizar participantes y estados `ready`
- soportar reconexion por `sessionId`

### Entregables

- sala privada funcional
- lobby sincronizado en vivo
- snapshot de estado de sala

### Criterio de salida

Varios usuarios pueden entrar a una misma sala y ver el mismo lobby en tiempo real.

---

## Fase 6 - Draft multiplayer sincronico

### Objetivo

Permitir que todos los jugadores hagan su draft al mismo tiempo dentro de una sala.

### Tareas

- iniciar draft grupal desde el host
- mantener progreso individual por jugador
- emitir actualizaciones globales de avance
- validar picks y rerolls en PartyKit
- confirmar finalizacion de cada participante
- persistir equipos humanos al cerrar el draft

### Entregables

- draft simultaneo estable
- estados tipo `eligiendo`, `terminado`, `desconectado`
- guardado de equipos drafteados por usuario

### Criterio de salida

Todos los participantes pueden completar su draft viendo el avance del resto en vivo.

---

## Fase 7 - Torneo multiplayer compartido

### Objetivo

Transformar el draft sincronizado en una experiencia de torneo colectivo completa.

### Tareas

- completar cupos vacios con selecciones reales
- generar torneo unico para toda la sala
- emitir bracket inicial a todos los clientes
- sincronizar eventos de partidos y resultados
- actualizar rondas y clasificacion en tiempo real
- mostrar enfrentamientos entre humanos y selecciones reales

### Entregables

- torneo compartido end-to-end
- bracket realtime
- simulacion sincronizada para todos los jugadores conectados

### Criterio de salida

Una sala puede jugar el ciclo completo desde lobby hasta campeon sin desincronizaciones.

---

## Fase 8 - Hardening y preparacion para testers

### Objetivo

Estabilizar el MVP antes de abrirlo a usuarios externos.

### Tareas

- mejorar manejo de errores
- reforzar validaciones cliente/servidor
- prevenir doble pick o doble emision
- mejorar reconexion y recuperacion de estado
- agregar logs y metricas basicas
- testear carga con varias salas
- pulir UX y mensajes de estado

### Entregables

- build candidata a beta cerrada
- checklist de estabilidad
- telemetria basica para diagnostico

### Criterio de salida

El juego soporta pruebas reales con usuarios sin romper el flujo principal.

---

## Orden de ejecucion recomendado

1. `Fase 0`
2. `Fase 1`
3. `Fase 2`
4. `Fase 3`
5. `Fase 4`
6. `Fase 5`
7. `Fase 6`
8. `Fase 7`
9. `Fase 8`

## Prioridad del MVP

Si hay que recortar alcance, el corte recomendado es este:

### MVP publico minimo

- Fase 1
- Fase 2
- Fase 3
- Fase 4

### MVP multiplayer

- Fase 5
- Fase 6
- Fase 7

## Resultado esperado

Al finalizar estas fases, `Esta Locura` deberia tener:

- draft singleplayer completo
- simulacion del Mundial 2026 completa
- historial y card final
- salas privadas
- draft multiplayer simultaneo
- torneo compartido con relleno de selecciones reales
