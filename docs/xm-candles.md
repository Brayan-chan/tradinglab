# Velas XM y revisión sombra (primera versión)

## Instalación

Tras desplegar este cambio, recompilar `mt5/TradingLabTrader.mq5` en MetaEditor y reemplazar la instancia anterior en un solo gráfico BTCUSD. Conservar el token privado y `RunMode=MODE_SHADOW`, `EnableDemoExecution=false`. No activar demo todavía.

`MarketApiUrl` debe ser `https://tradinglab-beryl.vercel.app/api/mt5/market`; el dominio ya autorizado para WebRequest sigue siendo suficiente. MT5 y el Mac deben permanecer abiertos, con red y sin suspensión. No hace falta mantener abierto el navegador.

El EA envía 3 velas M5 cada 30 segundos (sin carga histórica inicial). Se guardan mediante upsert en una tabla privada por cuenta/símbolo/hora. El navegador consulta las últimas 1000 y dibuja 100; la última puede estar en formación. No se dibujan datos sintéticos cuando la conexión falla.

## Alcance y limitaciones

- Las flechas son señales sombra, NO órdenes ejecutadas. Los niveles corresponden a la última señal.
- El resultado OHLC se recalcula al consultar y no constituye una ejecución del broker, ni incluye spread de salida, comisiones o deslizamiento.
- Se excluye la vela aún abierta. Si una vela toca ambos niveles, el resultado es ambiguo. Huecos o entradas intrabar se marcan insuficientes; no se presupone un orden favorable.
- Para resolver esas entradas intrabar hace falta añadir históricos de ticks bid/ask. Esta primera versión no es un simulador completo ni una autorización para operar sin supervisión.
- Sólo BTCUSD exacto y M5 están soportados. M15/H1, marcadores de fills, selección de señal, paginación de señales y archivo persistente de resultados quedan pendientes.
- WebRequest es síncrono: la transmisión puede demorar al EA. Mantener en sombra mientras se comprueba la continuidad y la compilación en Mac.

## Verificación pendiente en el terminal del usuario

Compilar sin errores, ver mensajes de transmisión, confirmar frescura de velas en web y que los datos sobreviven a recargar. Comparar OHLC contra MT5; probar suspensión/reconexión. No cambiar las reglas de entrada para provocar señales.
