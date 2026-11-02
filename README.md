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
- Recetario editable: añade recetas propias, cambia nombre, categoría, temporada, huecos e ingredientes, o retira platos base.
- Cambio de plato individual, sugerencia aleatoria, búsqueda de alternativas e intercambio entre días.
- Repetición de platos dentro de la misma semana, pensada para sobras o para repetir algo que gusta.
- Lista de la compra agregada por secciones, con ingredientes compartidos contados una sola vez y opción de copiarla.
- Temporada automática según el mes, o forzada a verano/invierno.
- Evita repetir platos de las últimas tres semanas al generar, sin impedir repeticiones manuales.
- Cuentas de usuario con correo y contraseña mediante la autenticación de Supabase.
- Planificaciones compartidas en modo lectura: puedes dar acceso a otra cuenta por correo y retirarlo cuando quieras.
- Recetario global: las recetas propias, las ediciones y los platos retirados son comunes para todas las cuentas.
- Persistencia en Supabase con RLS por usuario para las semanas, y acceso de lectura para las personas con las que compartes.
- Modo local automático si no hay variables de Supabase o si falla la conexión después de entrar.

## Arrancar en local

Requisitos: Node.js 20.9 o superior.

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Sin configurar Supabase, la app funciona en modo local y guarda las semanas y el recetario en `localStorage`.

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
3. Comprueba que **Authentication → Providers → Email** está activo. La app usa cuentas con correo y contraseña; ya no crea sesiones anónimas.
4. Copia `.env.example` a `.env.local` y rellena los valores de **Project Settings → API**:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
# También puedes usar la nueva publishable key:
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

5. Reinicia el servidor de desarrollo.

La app pide iniciar sesión y guarda cada semana en la tabla `weekly_plans` asociada a la cuenta. El recetario vive en una única fila de `recipe_catalog` compartida por todas las cuentas, y `plan_shares` guarda quién puede ver la planificación de quién. Se mantiene una copia local como respaldo; si Supabase falla después de entrar, la app sigue funcionando en local y lo indica en la cabecera.

> Por defecto Supabase pide confirmar el correo al registrarse. Puedes desactivarlo en **Authentication → Providers → Email → Confirm email** mientras pruebas en local. Si lo dejas activo, la persona recibirá un enlace para activar la cuenta y volverá a la app.
>
> Añade la URL desde la que sirves la app (por ejemplo `http://localhost:3000` y tu dominio de producción) en **Authentication → URL Configuration → Redirect URLs**. Si falta, el enlace de confirmación redirige a la Site URL configurada en Supabase en lugar de a la app.

> Si actualizas desde la versión anterior, `schema.sql` crea el recetario global usando como semilla el recetario personal más reciente y después retira la tabla `recipe_books`. Las semanas antiguas siguen asociadas a su usuario anónimo; para conservarlas hay que migrarlas a mano a la nueva cuenta.

## Cómo se organiza el código

```text
app/
  layout.tsx          Metadatos y layout raíz
  page.tsx            Estado principal, navegación y acciones
  globals.css         Sistema visual y responsive
components/
  auth-screen.tsx     Entrada, registro y confirmación de cuenta
  share-modal.tsx     Compartir y retirar acceso a la planificación
  meal-card.tsx       Tarjeta de comida/cena (editable o de solo lectura)
  meal-modal.tsx      Cambiar, repetir, buscar e intercambiar platos
  recipe-manager.tsx  Recetario global editable y formulario de recetas
  balance-card.tsx    Reparto semanal y equilibrio
  shopping-list.tsx   Lista de la compra
  info-modal.tsx      Explicación de reglas, cuentas y sincronización
  confirm-dialog.tsx  Confirmación de regeneración
lib/
  recipes.ts          Catálogo base de recetas y metadatos
  recipe-book.ts      Recetas propias, ediciones y catálogo efectivo
  planner.ts          Generación, cuotas, estadísticas y compra
  dates.ts            Semanas, fechas y temporada
  storage.ts          Persistencia local + Supabase (semanas, recetario y accesos)
  supabase.ts         Cliente, sesión y operaciones de autenticación
  types.ts            Tipos compartidos
supabase/
  schema.sql          Tablas, índices, RLS, función de compartir y triggers
```

## Reglas de generación

La semana se construye a partir de dos plantillas que se barajan entre los días:

- **Comidas (7):** 2 carne, 1 pasta, 1 arroz, 2 legumbres y 1 pescado blanco.
- **Cenas (7):** 1 carne, 1 pescado azul, 2 huevos, 2 verduras y 1 “otros”.

El generador puntúa cada receta por temporada, si se ha usado en las últimas tres semanas y si encaja con el hueco. Al generar, evita repetir platos dentro de la misma semana; si el recetario no tiene suficientes opciones, reutiliza las que haya. Después puedes repetir cualquier plato manualmente desde la pestaña **Repetir**. Al cambiar o repetir un plato, el equilibrio puede variar; la tarjeta de equilibrio lo muestra en tiempo real.

Los platos repetidos cuentan para el equilibrio (son dos comidas), pero sus ingredientes aparecen una sola vez en la lista de la compra, pensando en sobras. Los datos locales se guardan por cuenta en `mesa.week-plans.v2.<id>` y el recetario global en `mesa.recipe-catalog.v2`; en modo local sin Supabase se usa `mesa.week-plans.v2.local`.

## Compartir la planificación

- Cada persona comparte todas sus semanas desde **Compartir**, indicando el correo de otra cuenta registrada.
- Quien recibe el acceso ve un selector en la cabecera para cambiar entre su planificación y las que le han compartido.
- La vista compartida es de solo lectura: no se pueden cambiar platos, temporadas ni regenerar la semana. La lista de la compra y el equilibrio sí se calculan.
- Quien comparte puede retirar el acceso cuando quiera. La función `share_plan_with_email` resuelve el correo en `auth.users` sin exponer el listado de cuentas al cliente.
- El recetario no se comparte: directamente es global. Cualquier cuenta autenticada puede crear, editar o retirar recetas para todas.

## Despliegue

El proyecto se puede desplegar en Vercel. Añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en las variables de entorno del proyecto y despliega. No hay claves privadas ni service role en el cliente.
