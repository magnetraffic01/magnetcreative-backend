# Rubrica de Evaluacion de SMS (100 puntos)

**Ultima actualizacion:** 2026-03-30

> IMPORTANTE: No solo evalues. Por cada problema que encuentres, DEBES dar una VERSION CORREGIDA lista para copiar y usar. El usuario necesita alternativas, no solo criticas.

---

## 1. Preview Hack y Estructura (20 pts)

- El nombre del destinatario esta en la PRIMERA LINEA? (critico para preview de notificacion)
- Hay 3-5 lineas en blanco despues del nombre para empujar el cuerpo fuera de la preview?
- Tecnica: el telefono muestra ~40 chars en la notificacion. Si solo ve "Hola Juan," genera curiosidad maxima
- **FORMATO CORRECTO:**
  ```
  Hola {{nombre}},



  Tu mensaje aqui. Responde SI

  STOP para cancelar
  ```
- Si NO usa preview hack, mostrar como quedaria CON el hack

## 2. CTA de Respuesta Simple (20 pts)

- El CTA debe ser UNA PALABRA de respuesta: "Responde SI", "Responde HOLA", "Responde 1"
- CTAs de respuesta simple tienen 70% de conversion vs 15% de links
- **MALO:** "Visita nuestro sitio web para mas informacion"
- **BUENO:** "Responde SI y te envio los detalles"
- Si el CTA es debil, REESCRIBIR el SMS completo con CTA correcto

## 3. Personalizacion (15 pts)

- Usa `{{nombre}}` del destinatario
- Referencia contexto: "la ultima vez que hablamos", "tu consulta sobre dental"
- Se siente como mensaje de UN HUMANO, no de una empresa
- Si suena generico, dar version personalizada

## 4. Propuesta de Valor en 1 Linea (15 pts)

- El beneficio debe ser claro en UNA oracion despues de los espacios
- Usar numeros concretos: "$14.99/mes", "ahorra $300", "en 24 horas"
- Si el beneficio es vago, reescribir con numero concreto

## 5. Compliance TCPA (10 pts)

- **OBLIGATORIO:** "STOP para cancelar" al final
- Sin esto, viola regulaciones federales de EE.UU.
- Si falta, agregar automaticamente en la version corregida

## 6. Brevedad (10 pts)

- MAXIMO 160 caracteres (1 SMS = 1 cobro, >160 = 2 SMS = doble costo)
- Contar caracteres exactos y reportar
- Si excede 160, dar version recortada que mantenga el mensaje

## 7. Timing y Contexto (10 pts)

- Es apropiado para base fria? (no agresivo, no asume relacion)
- Tiene razon para contactar? (no es spam aleatorio)
- Sugerir horario: 10am-2pm o 5pm-7pm

---

## Para Cada Problema, Dar:

- Version actual (lo que envio el usuario)
- Version corregida (lista para copiar y usar)
- Por que funciona mejor

---

## Plantillas de Referencia para Base Fria

### Reactivacion
```
Hola {{nombre}},



Sigues buscando opciones de seguro dental? Tengo algo nuevo para ti. Responde SI

STOP para cancelar
```

### Urgencia
```
{{nombre}},



Tu cotizacion de $14.99/mes vence manana. La activo? Responde SI

STOP para cancelar
```

### Re-engagement
```
{{nombre}}, hace tiempo no hablamos



Todo bien? Si aun necesitas ayuda, estoy aqui. Responde HOLA

STOP para cancelar
```

### Oferta directa
```
{{nombre}},



Tengo 3 opciones de seguro desde $0/mes para ti. Te interesa? Responde SI

STOP para cancelar
```
