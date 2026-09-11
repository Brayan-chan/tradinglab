# TradingLab

Sistema personal de preservación de capital y análisis de disciplina para XM/MT5.

## Sincronización de MT5 (sólo lectura)

1. Crea un proyecto Supabase y ejecuta `supabase/migrations/202609080001_mt5_sync.sql` en el SQL Editor.
2. Configura en Vercel las cuatro variables listadas en `.env.example`. Genera los dos tokens con al menos 32 bytes aleatorios y usa valores diferentes.
3. El EA ya apunta al endpoint de producción `https://tradinglab-beryl.vercel.app/api/mt5/snapshot`.
4. Abre MetaEditor desde MT5, copia el EA, compílalo y añádelo a una gráfica.
5. En MT5 abre **Tools → Options → Expert Advisors**, activa WebRequest y agrega únicamente el origen `https://tradinglab-beryl.vercel.app`.
6. Coloca `MT5_INGEST_TOKEN` en los parámetros del EA. Nunca lo escribas dentro del archivo que subes a Git.
7. En TradingLab → **Cuenta MT5**, introduce `TRADINGLAB_READ_TOKEN`.

El EA no llama ninguna función de trading. Sólo consulta cuenta, posiciones, cierres y especificaciones de símbolos. Los archivos `.ex5` y secretos locales se excluyen de Git.

## Piloto automático BTCUSD

`mt5/TradingLabTrader.mq5` es un EA separado. Su valor predeterminado es **modo sombra**: analiza una vela M5 cerrada y registra la decisión, pero no manda órdenes.

1. Ejecuta también las migraciones `202609090001_add_deal_entry.sql` y `202609110001_bot_shadow_log.sql` en Supabase.
2. Copia `TradingLabTrader.mq5` dentro de `MQL5/Experts`, compílalo en MetaEditor y colócalo en un único gráfico de BTCUSD.
3. Reutiliza el mismo `MT5_INGEST_TOKEN` y permite el origen `https://tradinglab-beryl.vercel.app` en WebRequest.
4. Conserva `RunMode = MODE_SHADOW` y `EnableDemoExecution = false` durante la primera etapa.
5. Confirma que `StrategySymbol` coincide exactamente con el nombre mostrado por XM.
6. Abre **Piloto automático** en TradingLab para ver las evaluaciones.

Política inicial: entradas de 05:00 a 10:30, gestión sin nuevas entradas de 10:30 a 11:00, hora de Ciudad de México; riesgo máximo 0.25%, una sola posición, SL obligatorio, objetivo 2R, bloqueo diario de 1% y tras tres pérdidas consecutivas. Después de las 11:00 una posición protegida no se cierra arbitrariamente: continúa hasta su SL o TP.

La ejecución sólo puede activarse cuando coinciden `RunMode = MODE_DEMO`, `EnableDemoExecution = true` y una cuenta que MT5 identifica como demo. No se autoriza esta configuración para una cuenta real.

Sistema web local-first para tomar decisiones de trading con límites verificables antes de exponer capital.

## MVP

- Calculadora de tamaño para BTCUSD y GOLD en XM.
- Stop técnico obligatorio y validación de dirección.
- Riesgo agregado máximo por tesis.
- Bloqueos por pérdida diaria y racha de pérdidas.
- Importador de reportes HTML de MetaTrader 5/XM (incluido UTF-16).
- Métricas de PnL, acierto, profit factor, esperanza y uso de SL/TP.
- Simulador Monte Carlo de hasta 100,000 trayectorias en un Web Worker.
- Piloto BTCUSD con registro de decisiones en modo sombra.
- Diario privado persistido en el navegador.

## Ejecutar

```bash
npm install
npm run dev
```

También puedes utilizar `bun install` y `bun run dev`.

## Verificar

```bash
npm run test
npm run build
```

## Privacidad

Los reportes se procesan en el navegador. Esta versión no transmite ni almacena historiales en un servidor.

## Alcance

TradingLab es una herramienta educativa y de gestión de riesgo. No ofrece asesoría financiera, no predice el mercado y no garantiza ganancias.
