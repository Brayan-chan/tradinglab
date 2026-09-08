# TradingLab

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
