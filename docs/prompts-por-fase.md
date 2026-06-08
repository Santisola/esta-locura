# Prompts por Fase para IA

## Fase 1 - Setup del proyecto

```text
Ejecuta la Fase 1 de Esta Locura.

Lee primero:
- README.md
- docs/plan-implementacion.md
- docs/fases-desarrollo.md
- docs/schema-resumen.md

Objetivo:
- crear la base del proyecto con Next.js, TypeScript, Tailwind, Drizzle y Neon

Entregables esperados:
- estructura inicial del proyecto
- cliente de base de datos
- migraciones listas
- layout base y home minima

No implementes aun draft ni multiplayer.
```

## Fase 2 - Draft singleplayer

```text
Ejecuta la Fase 2 de Esta Locura.

Lee primero:
- README.md
- docs/plan-implementacion.md
- docs/fases-desarrollo.md
- docs/schema-resumen.md

Objetivo:
- implementar configuracion y draft singleplayer reutilizando el schema existente

Entregables esperados:
- setup de partida
- slots por formacion
- roll de selecciones
- eleccion de jugadores
- rerolls y persistencia del equipo

No implementes todavia simulacion del torneo.
```

## Fase 3 - Simulador del Mundial 2026

```text
Ejecuta la Fase 3 de Esta Locura.

Lee primero:
- README.md
- docs/plan-implementacion.md
- docs/fases-desarrollo.md
- docs/schema-resumen.md

Objetivo:
- construir el simulador completo de grupos y knockout usando el equipo drafteado

Entregables esperados:
- modulo de simulacion desacoplado
- tabla de grupos
- ranking de mejores terceros
- bracket final
- partidos con eventos y penales

No agregues multiplayer en esta fase.
```

## Fase 4 - Persistencia y card final

```text
Ejecuta la Fase 4 de Esta Locura.

Lee primero:
- README.md
- docs/plan-implementacion.md
- docs/fases-desarrollo.md
- docs/schema-resumen.md

Objetivo:
- guardar runs, mostrar resultado final y generar card compartible

Entregables esperados:
- historial de partidas
- pantalla final
- card para compartir
```

## Fase 5 - Salas privadas y realtime

```text
Ejecuta la Fase 5 de Esta Locura.

Lee primero:
- README.md
- docs/plan-implementacion.md
- docs/fases-desarrollo.md
- docs/schema-resumen.md
- docs/partykit-eventos.md

Objetivo:
- integrar PartyKit y crear salas privadas sincronizadas

Entregables esperados:
- crear sala
- entrar con codigo
- lobby sincronizado
- reconexion basica

No implementes aun el draft grupal completo.
```

## Fase 6 - Draft multiplayer

```text
Ejecuta la Fase 6 de Esta Locura.

Lee primero:
- README.md
- docs/plan-implementacion.md
- docs/fases-desarrollo.md
- docs/schema-resumen.md
- docs/partykit-eventos.md

Objetivo:
- implementar el draft sincronico entre varios usuarios

Entregables esperados:
- progreso global
- picks y rerolls validados por servidor
- persistencia de equipos humanos
```

## Fase 7 - Torneo compartido

```text
Ejecuta la Fase 7 de Esta Locura.

Lee primero:
- README.md
- docs/plan-implementacion.md
- docs/fases-desarrollo.md
- docs/schema-resumen.md
- docs/partykit-eventos.md

Objetivo:
- generar y sincronizar el torneo multiplayer completo

Entregables esperados:
- cupos vacios llenados con selecciones reales
- bracket sincronizado
- simulacion compartida
```

## Fase 8 - Hardening

```text
Ejecuta la Fase 8 de Esta Locura.

Lee primero todos los docs relevantes.

Objetivo:
- estabilizar el MVP, reforzar reconexion, errores y validaciones

Entregables esperados:
- manejo de errores mejorado
- proteccion contra dobles acciones
- telemetria basica
- lista de deuda tecnica restante
```
