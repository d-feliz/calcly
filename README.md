# Calcly
Calculadora visual de finanzas para autónomos individuales en España (2026).

Aplicación estática, sin dependencias, llamadas de API ni analítica. Cálculos, almacenamiento local, importación/exportación JSON y generación PDF se ejecutan en el navegador. Las referencias oficiales están enlazadas en la interfaz.

## Desarrollo
`python3 -m http.server 5173 --directory dist`

Abre http://localhost:5173. `dist/model.js` contiene las tablas y cálculos; `dist/app.js` gestiona la interfaz y exportaciones. No requiere compilación.

La reserva IRPF es orientativa y configurable; no constituye un cálculo de la declaración anual. La cuota usa tablas 2026 y un tipo del 31,50%. No incluye bonificaciones ni regímenes especiales.
