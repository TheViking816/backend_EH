# 🔔 Backend Push Notifications - Node.js + Vercel.

Backend Node.js para envío de notificaciones push de ExtraHostelero.

## 📋 ¿Por qué un backend separado?

La librería `web-push` requiere módulos de Node.js que **NO funcionan en Supabase Edge Functions (Deno)**.

**Solución:** Backend Node.js en Vercel + Edge Function como relay.

## 🚀 Deployment en Vercel

### 1. Crear repositorio en GitHub

```bash
cd backend-push
git init
git add .
git commit -m "Initial commit - Push notification backend"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/extrahostelero-push-backend.git
git push -u origin main
```

### 2. Conectar con Vercel

1. Ve a https://vercel.com/dashboard
2. Click **"Add New"** → **"Project"**
3. Importa tu repositorio de GitHub
4. Vercel detectará automáticamente la configuración

### 3. Configurar Variables de Entorno en Vercel

**IMPORTANTE:** Ve a **Settings → Environment Variables** y agrega:

| Variable | Valor |
|----------|-------|
| `VAPID_PUBLIC_KEY` | `BFD3EPrf6t6d-TVypeh-KHOvRsamoYwihZ9Ilb7uB20D5xlVQYVgfEoXgMT47g1arT0mOwvK-sgiuVsnKyDnylw` |
| `VAPID_PRIVATE_KEY` | `RocoMB4HBNhjV3N6Rwena8SGmA1XMVbIcNMqcYjZk9Y` |
| `SUPABASE_URL` | `https://oknpgpencszibnmndyzm.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Tu service_role key (Supabase Dashboard → Settings → API) |
| `APP_URL` | `https://tudominio.com` (o URL de producción) |

### 4. Deploy

```bash
# Vercel CLI (opcional)
npm install -g vercel
vercel

# O simplemente push a GitHub
git push origin main
# Vercel auto-deploya
```

### 5. Obtener URL del Backend

Después del deploy, Vercel te dará una URL como:

```
https://extrahostelero-push-backend.vercel.app
```

**Guarda esta URL** - la necesitarás para la Edge Function.

---

## 🧪 Probar Localmente

```bash
# Instalar dependencias
npm install

# Configurar .env.local
cp .env.example .env.local
# Editar .env.local con tus valores

# Ejecutar en modo desarrollo
npm run dev

# El servidor estará en http://localhost:3000
```

### Test con curl:

```bash
curl -X POST http://localhost:3000/api/send-push \
  -H "Content-Type: application/json" \
  -d '{
    "type": "job_posted",
    "user_ids": ["USER_ID_AQUI"],
    "title": "Nueva oferta",
    "body": "Hay una nueva oferta de camarero",
    "data": {
      "job_id": "123",
      "local_id": "456"
    }
  }'
```

---

## 📊 Endpoint API

### POST `/api/send-push`

**Request Body:**
```json
{
  "type": "job_posted | new_message | application_accepted | application_rejected",
  "user_ids": ["uuid1", "uuid2"],
  "title": "Título de la notificación",
  "body": "Cuerpo de la notificación",
  "data": {
    "job_id": "uuid",
    "local_id": "uuid",
    "sender_id": "uuid",
    "application_id": "uuid"
  }
}
```

**Response:**
```json
{
  "success": true,
  "sent": 5,
  "expired": 1,
  "errors": 0
}
```

---

## 🔐 Seguridad

- ✅ VAPID keys en variables de entorno (no en código)
- ✅ Supabase Service Role Key protegida
- ✅ CORS configurado para permitir solo tu dominio (opcional)
- ✅ Subscripciones expiradas marcadas como `active = false` automáticamente

---

## 📝 Estructura de Archivos

```
backend-push/
├── api/
│   └── send-push.js      # Endpoint principal
├── package.json          # Dependencias
├── vercel.json          # Configuración Vercel
├── .env.example         # Ejemplo de variables
└── README.md            # Este archivo
```

---

## 🐛 Troubleshooting

### Error: "Missing required fields"
- Verifica que estás enviando `type`, `user_ids`, `title`, `body` en el request

### Error: "No active subscriptions"
- El usuario no ha habilitado notificaciones desde su perfil
- Verifica la tabla `push_subscriptions` en Supabase

### Error: "VAPID_PUBLIC_KEY is not defined"
- Asegúrate de configurar las variables de entorno en Vercel
- Ve a Settings → Environment Variables

### Logs de Vercel
```bash
# Ver logs en tiempo real
vercel logs --follow
```

---

## ✅ Siguiente Paso

Después de deployar el backend, actualiza la **Supabase Edge Function** para que llame a esta URL en lugar de intentar enviar push directamente.

Ver: `ACTUALIZAR_EDGE_FUNCTION.md`
