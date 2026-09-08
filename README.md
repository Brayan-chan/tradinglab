# TradingLab

Sistema personal de preservación de capital y análisis de disciplina para XM/MT5.

## Sincronización de MT5 (sólo lectura)

1. Crea un proyecto Supabase y ejecuta `supabase/migrations/202609080001_mt5_sync.sql` en el SQL Editor.
2. Configura en Vercel las cuatro variables listadas en `.env.example`. Genera los dos tokens con al menos 32 bytes aleatorios y usa valores diferentes.
3. Despliega el proyecto y cambia `ApiUrl` en `mt5/TradingLabSync.mq5` por `https://TU-DOMINIO/api/mt5/snapshot`.
4. Abre MetaEditor desde MT5, copia el EA, compílalo y añádelo a una gráfica.
5. En MT5 abre **Tools → Options → Expert Advisors**, activa WebRequest y agrega únicamente el origen `https://TU-DOMINIO`.
6. Coloca `MT5_INGEST_TOKEN` en los parámetros del EA. Nunca lo escribas dentro del archivo que subes a Git.
7. En TradingLab → **Cuenta MT5**, introduce `TRADINGLAB_READ_TOKEN`.

El EA no llama ninguna función de trading. Sólo consulta cuenta, posiciones, cierres y especificaciones de símbolos. Los archivos `.ex5` y secretos locales se excluyen de Git.

Sistema web local-first para tomar decisiones de trading con límites verificables antes de exponer capital.

## MVP

- Calculadora de tamaño para BTCUSD y GOLD en XM.
- Stop técnico obligatorio y validación de dirección.
- Riesgo agregado máximo por tesis.
- Bloqueos por pérdida diaria y racha de pérdidas.
- Importador de reportes HTML de MetaTrader 5/XM (incluido UTF-16).
- Métricas de PnL, acierto, profit factor, esperanza y uso de SL/TP.
- Simulador Monte Carlo de 1,000 trayectorias.
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
