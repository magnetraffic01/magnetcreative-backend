# Rubrica de Evaluacion de Plantillas WhatsApp (100 puntos)

**Ultima actualizacion:** 2026-03-30

> IMPORTANTE: No solo evalues. Por cada problema, DEBES dar VERSION CORREGIDA de la plantilla completa lista para enviar a Meta para aprobacion. El usuario necesita la solucion, no solo la critica.

---

## 1. Cumplimiento del Tipo de Plantilla (20 pts)

- **UTILITY (abrir canal):** DEBE ser 100% transaccional. Si tiene CUALQUIER contenido promocional, Meta la RECHAZA.
  - BIEN: `Hola {{1}}, tu cita es el {{2}} a las {{3}}. Responde SI para confirmar o NO para reprogramar.`
  - MAL: `Hola {{1}}, tu cita es manana. Aprovecha nuestro descuento del 20%!` -- RECHAZADA (mezcla utility con marketing)
- **MARKETING (promocional):** Puede vender pero debe aportar VALOR real. No spam.
  - BIEN: `{{1}}, tienes un descuento exclusivo del 30% en tu limpieza dental. Solo hasta el {{2}}. Te agendo?`
  - MAL: `OFERTA INCREIBLE!!! COMPRA YA!!!` -- RECHAZADA (spam, mayusculas, sin personalizacion)
- **AUTHENTICATION:** SOLO codigos de verificacion. Maximo 1 boton.
  - BIEN: `Tu codigo de verificacion es {{1}}. Expira en 5 minutos. No compartas este codigo.`
- Si el tipo declarado no coincide con el contenido, CORREGIR la plantilla completa

## 2. Preview de Notificacion (15 pts)

- La primera linea es lo que el usuario ve en la notificacion push de WhatsApp
- Debe generar curiosidad o valor inmediato
- **MALO:** "Estimado cliente, le informamos que..." (corporativo, aburrido)
- **BUENO:** "{{1}}, tengo noticias sobre tu consulta" (personal, intrigante)
- Dar 3 alternativas de primera linea si la actual es debil

## 3. Cuerpo Claro y Conciso (15 pts)

- **Utility:** maximo 100 palabras
- **Marketing:** maximo 150 palabras
- UNA idea por plantilla, no multiples ofertas
- Usar emojis con moderacion (1-2 max, no llenar de emojis)
- Si es largo, dar version recortada

## 4. Botones CTA (15 pts)

- Maximo 3 botones (regla de Meta)
- Cada boton debe tener accion DIRECTA: "Agendar cita", "Ver oferta", "Llamar ahora"
- Deep links preferidos: `wa.me/numero`, `tel:+1234567890`
- Quick replies para respuestas simples: "Si, me interesa" / "No, gracias"
- Si no tiene botones, sugerir cuales agregar

## 5. Variables Dinamicas (10 pts)

- `{{1}}` = nombre SIEMPRE (personalizacion minima)
- `{{2}}` = dato relevante (fecha, precio, producto)
- `{{3}}` = contexto (sucursal, agente, referencia)
- Variables deben tener fallback (si nombre es vacio, usar "amigo/a")
- Si no tiene variables, agregar y mostrar ejemplo

## 6. Media Header (10 pts)

- **Imagen:** alta calidad, sin texto sobrepuesto (Meta puede rechazar)
- **Video:** max 16MB, formato MP4
- **Documento:** PDF para cotizaciones, contratos
- Si el tipo de mensaje se beneficiaria de media pero no la tiene, sugerir

## 7. Compliance Meta Business (15 pts)

- Sin contenido prohibido (alcohol, tabaco, armas, etc.)
- Opt-in verificado (el usuario debe haber dado consentimiento)
- Sin lenguaje amenazante o presion excesiva
- Sin promesas de resultados garantizados
- Si viola alguna politica, explicar CUAL y dar version que cumpla

---

## Para Cada Problema, Dar:

- Version actual
- Plantilla corregida COMPLETA (header + body + botones) lista para enviar a Meta
- Por que Meta la aprobaria y por que convierte mejor

---

## Plantillas de Referencia

### UTILITY - Confirmacion de cita

- **Header:** Confirmacion de cita
- **Body:** `Hola {{1}}, tu cita esta programada para el {{2}} a las {{3}}. Responde para confirmar o reprogramar.`
- **Botones:** [Confirmar] [Reprogramar] [Llamar]

### UTILITY - Seguimiento de orden

- **Header:** Tu pedido esta en camino
- **Body:** `{{1}}, tu pedido #{{2}} fue enviado. Llegara el {{3}}. Rastrear aqui:`
- **Botones:** [Rastrear pedido]

### MARKETING - Oferta dental

- **Header:** imagen de sonrisa
- **Body:** `{{1}}, tu limpieza dental con 30% de descuento te espera. Solo hasta el {{2}}. Te agendo?`
- **Botones:** [Si, agendar] [Ver precios] [Llamar]

### MARKETING - Reactivacion

- **Header:** Te extranamos
- **Body:** `{{1}}, hace tiempo no nos visitas. Tenemos algo especial para ti: {{2}}. Te interesa?`
- **Botones:** [Si, cuentame] [No, gracias]

### AUTHENTICATION

- **Body:** `Tu codigo de verificacion es {{1}}. Expira en 5 minutos. No compartas este codigo con nadie.`
- **Botones:** [Copiar codigo]
