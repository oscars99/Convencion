# Horario de Convención

Aplicación web en español para consultar y administrar el horario de una convención.

## Funciones incluidas

- Buscar horario por nombre
- Ver horario personal agrupado por viernes, sábado y domingo
- Ver horario completo por día
- Filtrar por Lobby, Rampa, Escaleras, Entrada u Otro
- Panel de administrador
- Editar asignaciones
- Agregar y editar personas
- Historial de cambios
- Vista del mapa del área exterior
- Datos iniciales cargados desde `merged_schedule_with_viernes.json`
- Persistencia local con `localStorage`

## Credenciales demo de administrador

Contraseña:

```txt
admin123
```

> Esta versión usa autenticación local para poder correr inmediatamente. Para producción, reemplazar por Firebase Auth según el PRD.

## Instalación

```bash
npm install
npm run dev
```

Luego abre la URL que muestra Vite, normalmente:

```txt
http://localhost:5173
```

## Build de producción

```bash
npm run build
npm run preview
```

## Estructura

```txt
src/
  data/
    merged_schedule_with_viernes.json
  types/
    schedule.ts
  utils/
    scheduleUtils.ts
  main.tsx
  styles.css
```

## Nota técnica

Esta app está lista para usarse como MVP. Los cambios del administrador se guardan en el navegador usando `localStorage`.

Para producción con múltiples usuarios viendo cambios en tiempo real, conectar a Firebase Firestore y Firebase Auth siguiendo el plan del PRD.
