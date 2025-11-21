# Guía de Autenticación para AgroLink

## 🎯 Objetivo: Dejar de ser Usuario Anónimo

Si estás recibiendo errores 403 al intentar enviar mensajes, es porque estás usando un **token anónimo** en lugar de un **token de usuario autenticado**.

## 🔍 ¿Cómo sé si soy usuario anónimo?

1. **Visita la página de debug**: `https://agro-link-jet.vercel.app/auth-debug`
2. **Revisa el estado de autenticación**
3. **Si ves `role: 'anon'`** → Necesitas autenticarte
4. **Si ves `role: 'authenticated'`** → Ya estás autenticado

## 🚀 Métodos para Autenticarte

### Opción 1: Iniciar Sesión con Email/Teléfono

1. Ve a la página de login: `https://agro-link-jet.vercel.app/login`
2. **Ingresa tu email o teléfono**
3. **Ingresa tu contraseña**
4. **Completa el captcha** si aparece
5. **Haz clic en "Iniciar sesión"**

### Opción 2: Registrarse como Nuevo Usuario

1. Ve a la página de registro: `https://agro-link-jet.vercel.app/register`
2. **Completa el formulario**:
   - Nombre completo
   - Email o teléfono
   - Contraseña
3. **Completa el captcha**
4. **Haz clic en "Crear cuenta"**

### Opción 3: Inicio Social (Google/Facebook)

1. Ve a la página de login: `https://agro-link-jet.vercel.app/login`
2. **Haz clic en "Continuar con Google"** o **"Continuar con Facebook"**
3. **Autoriza la aplicación** en la ventana emergente
4. **Serás redirigido automáticamente** a AgroLink

## 🔧 ¿Qué cambia al autenticarte?

### Antes (Anónimo):
```json
{
  "role": "anon",
  "userId": null,
  "isValid": false,
  "error": "Anonymous token - user needs proper authentication"
}
```

### Después (Autenticado):
```json
{
  "role": "authenticated",
  "userId": "tu-id-de-usuario",
  "isValid": true,
  "email": "tu@email.com"
}
```

## 🛠️ Solución Automática (Implementada)

He creado un sistema automático que:

1. **Detecta usuarios anónimos** automáticamente
2. **Redirige al login** cuando es necesario
3. **Valida el token** después del login
4. **Permite el envío de mensajes** solo con tokens válidos

## 📱 Flujo Completo de Autenticación

```
Usuario Anónimo → Intenta enviar mensaje → Sistema detecta token anónimo → 
Redirige a login → Usuario se autentica → Obtiene token autenticado → 
Puede enviar mensajes exitosamente
```

## ⚠️ Problemas Comunes y Soluciones

### Problema: "No puedo registrarme"
- **Verifica que el email no esté registrado**
- **Prueba con tu teléfono en lugar de email**
- **Asegúrate de completar el captcha**

### Problema: "El login falla"
- **Verifica tu email/teléfono y contraseña**
- **Prueba restablecer tu contraseña**
- **Limpia las cookies y vuelve a intentar**

### Problema: "Sigo viendo role: 'anon' después de login"
- **Refresca la página** (F5)
- **Verifica en la página de debug** que el token se actualizó
- **Cierra sesión y vuelve a iniciar**

## 🔐 Seguridad

- Los tokens autenticados **expiran** después de un tiempo
- El sistema **refresca automáticamente** tu sesión
- Si tu token expira, **deberás iniciar sesión nuevamente**

## 🎉 Resultado Final

Una vez autenticado correctamente:
- ✅ Puedes **enviar mensajes** sin errores 403
- ✅ Puedes **crear conversaciones** con otros usuarios
- ✅ Puedes **acceder a todas las funciones** de mensajería
- ✅ Tu **identidad está verificada** en el sistema

---

**¿Necesitas ayuda?** Visita la página de debug (`/auth-debug`) para verificar tu estado actual y diagnosticar problemas.