# Esta Locura

Documentacion inicial del proyecto `Esta Locura`, un juego web de draft y simulacion del Mundial 2026 con modo singleplayer y multiplayer en salas privadas.

## Contenido

- `docs/plan-implementacion.md`: arquitectura, stack, modelo de datos y lineamientos tecnicos.
- `docs/fases-desarrollo.md`: roadmap por fases para construir el MVP y evolucionarlo a multiplayer en vivo.
- `docs/schema-resumen.md`: resumen del modelo relacional y relaciones clave.
- `docs/partykit-eventos.md`: contrato inicial de eventos realtime.
- `docs/guia-desarrollo-con-ia.md`: reglas para ejecutar cada fase con agentes de IA.
- `docs/prompts-por-fase.md`: prompts listos para pedir cada fase.
- `src/lib/db/schema.ts`: schema inicial de `Drizzle ORM`.
- `drizzle.config.ts`: configuracion base para migraciones.
- `.env.example`: variables iniciales del proyecto.

## Stack propuesto

- Frontend: `Next.js` + `TypeScript` + `Tailwind CSS`
- Backend web: `Vercel` Route Handlers / Server Actions
- Base de datos: `Neon Postgres`
- ORM: `Drizzle ORM`
- Realtime: `PartyKit`
- Estado cliente: `Zustand`
- Validacion: `Zod`

## Objetivo del MVP

1. Draft singleplayer con formaciones, ratings visibles/ocultos y rerolls.
2. Simulacion completa del Mundial 2026 con grupos y eliminacion directa.
3. Persistencia de partidas y card final compartible.
4. Salas privadas con draft sincronizado y torneo compartido.
