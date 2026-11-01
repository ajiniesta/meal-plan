# Mesa · Planificador semanal de comidas

Aplicación para generar y ajustar una semana de 7 comidas y 7 cenas. Está construida con **Next.js** y preparada para guardar las semanas en **Supabase**, con almacenamiento local como respaldo para que funcione sin configurar nada.

## Qué incluye

- Generación semanal con reparto equilibrado:
  - 3 carnes
  - 1 pasta
  - 1 arroz
  - 2 legumbres
  - 2 pescados (1 blanco y 1 azul)
  - 2 huevos
  - 2 verduras
  - 1 plato de “otros” para completar los 14 huecos
- Reparto pensado para el día a día: legumbres, pasta y arroz en la comida; cenas más ligeras.
- Catálogo inicial de más de 90 recetas, con ingredientes, temporada y tipo de pescado.
- Cambio de plato individual, sugerencia aleatoria, búsqueda de alternativas e intercambio entre días.
- Lista de la compra agregada por secciones, con ingredientes repetidos contados y opción de copiarla.
- Temporada automática según el mes, o forzada a verano/invierno.
- Evita repetir platos de las últimas tres semanas.
- Persistencia en Supabase mediante sesión anónima, con RLS por usuario.
- Modo local automático si no hay variables de Supabase o falla la conexión.

## Arrancar en local

Requisitos: Node.js 20.9 o superior.

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Sin configurar Supabase, la app funciona en modo local y guarda las semanas en `localStorage`.

Comandos disponibles:

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run start      # servidor de producción
npm run typecheck  # comprobación de TypeScript
```

## Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Abre **SQL Editor** y ejecuta el contenido de [`supabase/schema.sql`](./supabase/schema.sql).
3. Ve a **Authentication → Providers → Anonymous sign-ins** y actívalo. La app crea una sesión anónima por dispositivo para poder aplicar RLS sin pedir registro.
4. Copia `.env.example` a `.env.local` y rellena los valores de **Project Settings → API**:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
# También puedes usar la nueva publishable key:
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

5. Reinicia el servidor de desarrollo.

La app guarda cada semana en la tabla `weekly_plans` y mantiene una copia local. Si Supabase falla, sigue funcionando en local y lo indica en la cabecera.

> La sesión es anónima y vive en este navegador. Para compartir la planificación entre dispositivos habría que añadir autenticación con email o un enlace mágico; el esquema ya está preparado para asociar cada semana a `auth.uid()`.

## Cómo se organiza el código

```text
app/
  layout.tsx          Metadatos y layout raíz
  page.tsx            Estado principal, navegación y acciones
  globals.css         Sistema visual y responsive
components/
  meal-card.tsx       Tarjeta de comida/cena
  meal-modal.tsx      Cambiar, buscar e intercambiar platos
  balance-card.tsx    Reparto semanal y equilibrio
  shopping-list.tsx   Lista de la compra
  info-modal.tsx      Explicación de reglas y sincronización
  confirm-dialog.tsx  Confirmación de regeneración
lib/
  recipes.ts          Catálogo de recetas y metadatos
  planner.ts          Generación, cuotas, estadísticas y compra
  dates.ts            Semanas, fechas y temporada
  storage.ts          Persistencia local + Supabase
  supabase.ts         Cliente y sesión anónima
  types.ts            Tipos compartidos
supabase/
  schema.sql          Tabla, índices, RLS y trigger
```

## Reglas de generación

La semana se construye a partir de dos plantillas que se barajan entre los días:

- **Comidas (7):** 2 carne, 1 pasta, 1 arroz, 2 legumbres y 1 pescado blanco.
- **Cenas (7):** 1 carne, 1 pescado azul, 2 huevos, 2 verduras y 1 “otros”.

El generador puntúa cada receta por temporada, si se ha usado en las últimas tres semanas y si encaja con el hueco. Los platos no se repiten dentro de la misma semana. Al cambiar un plato manualmente, el equilibrio puede variar; la tarjeta de equilibrio lo muestra en tiempo real.

## Despliegue

El proyecto se puede desplegar en Vercel. Añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en las variables de entorno del proyecto y despliega. No hay claves privadas ni service role en el cliente.
