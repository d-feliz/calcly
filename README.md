# Calcly
Calculadora visual de finanzas para autónomos individuales en España (2026).

Aplicación estática, sin dependencias, llamadas de API ni analítica. Cálculos, almacenamiento local, importación/exportación JSON y generación PDF se ejecutan en el navegador. Las referencias oficiales están enlazadas en la interfaz.

## Desarrollo
`python3 -m http.server 5173 --directory dist`

Abre http://localhost:5173. `dist/model.js` contiene las tablas y cálculos; `dist/app.js` gestiona la interfaz y el progreso; `dist/report.js` genera el reporte PDF con el estilo visual de la página. No requiere compilación.

La media prevista determina el tramo. La facturación real del mes determina la reserva y el disponible, sin modificar la base elegida. Los gastos indicados también se consideran representativos de los gastos medios previstos para estimar el tramo. El disponible descuenta cuota, otros gastos y reserva de IRPF.

La primera vez, la sección de cuota pregunta si tienes tarifa plana. Con tarifa plana, la cuota es fija (88,64 € en 2026: 80 € + 8,64 € de MEI) y no depende del tramo ni de la base; sin ella, eliges la base de cotización. Puedes cambiar la respuesta en cualquier momento.

Los archivos JSON usan la versión 3 (dos importes de facturación y la respuesta sobre la tarifa plana) y cargan también las versiones 1 y 2: el único ingreso de la versión 1 inicializa ambos campos, y la pregunta de la tarifa plana queda sin responder. Los reportes se dibujan localmente a alta resolución y se descargan sin llamadas de red.

El simulador parte de la facturación mensual actual y permite restablecerla. Compara facturación, disponible y cuota más reserva de IRPF. Modela un cambio sostenido: la media prevista cambia en la misma cantidad que la facturación, manteniendo los gastos y el porcentaje de reserva. La base elegida se ajusta a los límites del nuevo tramo. La gráfica marca el valor original e incluye los saltos entre tramos. Las simulaciones no modifican ni guardan cambios en el presupuesto.

Verificación de cálculos, simulaciones y compatibilidad: `node --test tests/*.test.mjs`.

La reserva IRPF es orientativa y configurable; no constituye un cálculo de la declaración anual. La cuota usa tablas 2026 y un tipo del 31,50%. Incluye la tarifa plana; no incluye otras bonificaciones ni regímenes especiales.
