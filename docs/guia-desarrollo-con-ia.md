# Guia de Desarrollo con IA

## Objetivo

Dejar el proyecto documentado de forma que un agente de IA pueda ejecutar las fases una por una sin perder contexto tecnico.

## Regla de trabajo

Cada fase debe ejecutarse con este orden:

1. leer `README.md`
2. leer `docs/plan-implementacion.md`
3. leer `docs/fases-desarrollo.md`
4. leer `docs/schema-resumen.md`
5. ejecutar solo la fase pedida
6. validar entregables y criterio de salida antes de pasar a la siguiente

## Contexto que siempre debe conservar la IA

- el stack objetivo es `Next.js + Vercel + Neon + Drizzle + PartyKit`
- el singleplayer se construye antes que el multiplayer
- el motor de simulacion debe ser reutilizable y desacoplado
- PartyKit es autoritativo para estado realtime
- Neon es autoritativo para persistencia e historial

## Regla de alcance

Cuando se pida una fase, la IA no debe adelantarse a la siguiente salvo que haga falta una base tecnica minima compartida. Si agrega algo de una fase futura, debe ser solo scaffold, no logica completa.

## Checklist de salida por fase

La IA debe terminar cada fase con:

- lista de archivos creados o modificados
- decision tecnica principal tomada
- validacion ejecutada o pendiente
- limitaciones conocidas
- recomendacion de siguiente fase

## Prompt maestro recomendado

```text
Quiero que ejecutes la fase X de Esta Locura.

Antes de tocar codigo:
1. Lee README.md
2. Lee docs/plan-implementacion.md
3. Lee docs/fases-desarrollo.md
4. Lee docs/schema-resumen.md
5. Lee docs/partykit-eventos.md si la fase toca multiplayer

Objetivo:
- Ejecutar solo la fase X

Reglas:
- Respeta el stack definido
- No cambies el alcance de la fase
- Reutiliza el schema existente
- Deja el proyecto listo para que la siguiente fase continúe

Al final quiero:
- cambios realizados
- archivos tocados
- que falta para cerrar la fase
- siguiente paso recomendado
```
