# App Muebles (MVP)

Web app local para cotizar muebles de melamina, calcular consumos y optimizar cortes.

## Como correr

1. Abrir `appMuebles/index.html` en el navegador.
2. Todo se guarda en el navegador (LocalStorage).

## Datos de ejemplo incluidos

- 1 placa de melamina con dos tamanos.
- 1 tapacanto.
- 5 accesorios.
- 2 plantillas (bajo mesada y alacena).
- Filtros de proyectos, duplicado rapido y tablero por estados.
- Alertas de validacion, resumen KPI y notificaciones en pantalla.
- Perfiles rapidos de configuracion de mano de obra.

## Estructura

- `appMuebles/domain/`: formulas y calculos.
- `appMuebles/services/`: resumen del proyecto.
- `appMuebles/storage/`: persistencia LocalStorage.
- `appMuebles/nesting/`: heuristica de corte 2D.
- `appMuebles/app.js`: UI.

## Nesting

El algoritmo usa First-Fit Decreasing con estanterias (shelves):

1. Ordena piezas por area descendente.
2. Intenta ubicarlas en estantes existentes.
3. Si no entra, crea un nuevo estante o una nueva placa.
4. Respeta el kerf entre cortes.

Parametros:
- `settings.kerf` en `appMuebles/storage/repository.js`.
- En cada placa, el % de desperdicio de compra.

## Exportaciones

- Presupuesto: abre una ventana de impresion (PDF desde el navegador).
- Cut list: descarga CSV.
- Backup: export/import JSON.

## Mejoras recientes

- Validacion de entradas clave (medidas, cantidades, costos, mermas).
- Reporte de piezas que no entran en la placa para evitar presupuestos incompletos.
- Normalizacion de datos al importar JSON para compatibilidad hacia atras.
