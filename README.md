# Calcly
Calculadora visual de finanzas para autónomos individuales en España (2026).

Aplicación estática, sin dependencias, llamadas de API ni analítica. Cálculos, almacenamiento local, importación/exportación JSON y generación PDF se ejecutan en el navegador. Las referencias oficiales están enlazadas en la interfaz.

## Desarrollo
`python3 -m http.server 5173 --directory dist`

Abre http://localhost:5173. `dist/model.js` contiene las tablas y cálculos; `dist/app.js` gestiona la interfaz y el progreso; `dist/report.js` genera el reporte PDF con el estilo visual de la página. No requiere compilación.

La media prevista determina el tramo. La facturación real del mes determina la reserva y el disponible, sin modificar la base elegida. Los gastos indicados también se consideran representativos de los gastos medios previstos para estimar el tramo. El disponible descuenta cuota, otros gastos y reserva de IRPF.

Los archivos JSON usan la versión 2 (dos importes de facturación) y cargan también la versión 1: su único ingreso inicializa ambos campos. Los reportes se dibujan localmente a alta resolución y se descargan sin llamadas de red.

Verificación de cálculos y compatibilidad: `node --test tests/model.test.mjs`.

La reserva IRPF es orientativa y configurable; no constituye un cálculo de la declaración anual. La cuota usa tablas 2026 y un tipo del 31,50%. No incluye bonificaciones ni regímenes especiales.
