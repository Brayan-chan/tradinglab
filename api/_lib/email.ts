// Envía la notificación de una señal pendiente vía la API REST de EmailJS (server-side).
// Nunca lanza: un fallo de email no debe tumbar el guardado de la decisión ni de la orden pendiente.
export async function notifyPendingOrder(params: {
  symbol: string; side: 'buy' | 'sell'; entryPrice: number; stopLoss: number; takeProfit: number
  volume: number; expiresAt: string; autoApproved: boolean
}): Promise<void> {
  const serviceId = process.env.EMAILJS_SERVICE_ID
  const templateId = process.env.EMAILJS_TEMPLATE_ID
  const publicKey = process.env.EMAILJS_PUBLIC_KEY
  const privateKey = process.env.EMAILJS_PRIVATE_KEY
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error('EmailJS no configurado: faltan variables de entorno, no se envió la notificación')
    return
  }
  const appUrl = process.env.APP_URL ?? ''
  const direction = params.side === 'buy' ? 'COMPRA' : 'VENTA'
  const expiresLocal = new Date(params.expiresAt).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'medium' })
  const templateParams = {
    direction,
    symbol: params.symbol,
    entry_price: params.entryPrice.toFixed(2),
    stop_loss: params.stopLoss.toFixed(2),
    take_profit: params.takeProfit.toFixed(2),
    volume: params.volume.toFixed(2),
    expires_at: expiresLocal,
    app_url: appUrl ? `${appUrl}/` : '',
    mode_label: params.autoApproved ? 'Aprobada automáticamente (modo auto)' : 'Esperando tu aprobación',
  }
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: serviceId, template_id: templateId, user_id: publicKey, accessToken: privateKey, template_params: templateParams }),
    })
    if (!response.ok) console.error('EmailJS respondió con error', { status: response.status, body: await response.text().catch(() => '') })
  } catch (error) {
    console.error('No se pudo contactar a EmailJS', { message: error instanceof Error ? error.message : String(error) })
  }
}
