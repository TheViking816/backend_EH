// ============================================
// Push Notification Backend (Node.js + Vercel)
// ============================================
// Endpoint: POST /api/send-push

const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// Configuración de VAPID (desde variables de entorno)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = 'mailto:contact@extrahostelero.com';

// Supabase (desde variables de entorno)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configurar web-push
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Envía notificación push a una suscripción
 */
async function sendWebPush(subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 86400 }
    );
    return { status: 'ok' };
  } catch (error) {
    // 410 Gone = subscripción expirada
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.warn(`Expired subscription: ${subscription.endpoint}`);
      return { status: 'expired', endpoint: subscription.endpoint };
    }
    // Otros errores (red, temporal, etc.)
    console.error('Push send error:', error.message);
    return { status: 'error', error: error.message };
  }
}

/**
 * Obtiene suscripciones activas de un usuario
 */
async function getUserPushSubscriptions(userId) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('active', true);

  if (error) {
    console.error('Error fetching subscriptions:', error);
    return [];
  }

  return data || [];
}

/**
 * Marca suscripción como inactiva
 */
async function markSubscriptionInactive(endpoint) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  await supabase
    .from('push_subscriptions')
    .update({ active: false })
    .eq('endpoint', endpoint);
}

/**
 * Construye deep link según el tipo de notificación
 */
function buildDeepLink(type, data) {
  const baseUrl = process.env.APP_URL || 'https://extrahostelero.com';

  switch (type) {
    case 'job_posted':
      return `${baseUrl}/?view=job&id=${data.job_id}`;
    case 'new_message':
      return `${baseUrl}/?view=chat&user=${data.sender_id}${data.job_id ? '&job=' + data.job_id : ''}`;
    case 'application_accepted':
      return `${baseUrl}/?view=job&id=${data.job_id}&tab=application`;
    case 'application_rejected':
      return `${baseUrl}/?view=jobs`;
    default:
      return baseUrl;
  }
}

/**
 * Handler principal (Vercel Serverless Function)
 */
module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      .end();
  }

  // Solo POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, user_ids, title, body, data } = req.body;

    // Validar campos requeridos
    if (!type || !user_ids || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields: type, user_ids, title, body' });
    }

    console.log(`[Push Backend] Sending ${type} to ${user_ids.length} user(s)`);

    // Construir payload de notificación
    const notification = {
      title,
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: type,
      data: {
        ...data,
        url: buildDeepLink(type, data),
        type,
      },
      requireInteraction: type === 'application_accepted',
    };

    // Agregar acciones según el tipo
    if (type === 'new_message') {
      notification.actions = [{ action: 'open', title: 'Abrir chat' }];
    } else if (type === 'job_posted') {
      notification.actions = [{ action: 'view', title: 'Ver oferta' }];
    } else if (type === 'application_accepted') {
      notification.actions = [{ action: 'view', title: 'Ver detalles' }];
    }

    // Enviar a cada usuario
    let totalSent = 0;
    let totalExpired = 0;
    let totalErrors = 0;

    for (const userId of user_ids) {
      const subscriptions = await getUserPushSubscriptions(userId);

      if (subscriptions.length === 0) {
        console.log(`[Push Backend] No active subscriptions for user ${userId}`);
        continue;
      }

      console.log(`[Push Backend] Sending to ${subscriptions.length} subscription(s) for user ${userId}`);

      // Enviar a todas las suscripciones del usuario
      const results = await Promise.all(
        subscriptions.map((sub) => sendWebPush(sub, notification))
      );

      // Procesar resultados
      for (const result of results) {
        if (result.status === 'ok') {
          totalSent++;
        } else if (result.status === 'expired') {
          totalExpired++;
          // Marcar como inactiva
          await markSubscriptionInactive(result.endpoint);
        } else {
          totalErrors++;
        }
      }
    }

    console.log(`[Push Backend] Results: ${totalSent} sent, ${totalExpired} expired, ${totalErrors} errors`);

    return res.status(200).json({
      success: true,
      sent: totalSent,
      expired: totalExpired,
      errors: totalErrors,
    });
  } catch (error) {
    console.error('[Push Backend] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
