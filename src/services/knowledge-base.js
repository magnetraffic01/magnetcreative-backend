// Base de conocimiento del Grupo TreboLife / MagneTraffic
// Integrado del documento: sistema_evaluacion_video_trebolife.docx v2.0

const NEGOCIOS = {
  TrebolLife: {
    descripcion: 'Membresia de descuentos de salud (NO es seguro). Operado por FFL Insurance LLC / MagneTraffic. Administrado por Careington International Corporation (45+ anos, 30M+ miembros). Disponible en 47 estados (excepto Vermont, Washington, Utah). Activacion inmediata, sin periodo de espera, sin SSN, sin contrato.',
    audiencia: 'Comunidad hispana/latina en EE.UU. Segmentos: Familia joven (25-35) -> Safe $24.99. Profesional sin seguro (35-50) -> Health Plus $29.99. Adulto mayor (50+) -> Health Plus. Estudiante (18-25) -> Dental $14.99. Tambien distribuidores independientes que buscan ingresos extra.',
    tono: 'Cercano, empoderador, profesional, familiar. StoryBrand: el CLIENTE es el heroe, TreboLife es el GUIA. Emocion primero, datos despues. NUNCA decir "seguro" o "insurance" o "cobertura medica" - SIEMPRE decir "membresia de descuentos de salud".',
    productos: 'Trebol Dental ($14.99/mes ind, $29.99 familia): dental Careington +100K dentistas, Vision VSP +40K, Farmacia GetMoreRx hasta 95% desc. Trebol Safe ($24.99/mes ind, $39.99 familia, MAS POPULAR): todo Dental + DialCare telemedicina 24/7 $0/consulta ilimitada + DirectLabs +3000 labs 10-80% desc. Trebol Health Plus ($29.99/mes ind, $44.99 familia): todo Safe + medico primario virtual para condiciones cronicas. Todos: $30 activacion, garantia 30 dias, familia hasta 7 personas.',
    diferenciador: 'Sin SSN requerido, activacion inmediata, sin periodo de espera, sin restriccion condiciones preexistentes, sin verificacion credito, familia incluida, servicio en espanol, telemedicina 24/7/365, respaldado por Careington (45+ anos). Ahorro: dental $300-800/ano, telemedicina vs ER $65 vs $400+, labs 10-80%, medicinas genericas hasta 95%.',
    visual: 'Colores: verde oscuro #1A6E3E (fondos hero, CTA), verde medio #2D9E5F (iconos, checkmarks), verde claro #E8F5EE (tarjetas), crema #FFFCF5 (fondos claros), dorado #D4A017 (badges Best Value, anclas precio), verde muy oscuro #0D1F13 (slides transformacion), rojo fondo #FFF0F0 (columna Sin Plan), rojo texto #C0392B (advertencia). Imagenes: estilo 3D Pixar/Disney, personajes hispanos (piel morena/oliva, pelo oscuro), escenas domesticas y emocionales, iluminacion calida. Tipografia: titulos 48-64pt bold, secciones 28-36pt, cuerpo 18-22pt, precios 24-32pt bold, disclaimer 10-12pt. PROHIBIDO: familias no-hispanas, fondos blancos de estudio, logos de seguros, azul/rojo dominante, personas en poses corporativas, imagenes genericas de doctor sonriendo sin contexto familiar.',
    reglas_diseno_v3: 'REGLAS STORYBRAND v3 PERMANENTES: 1) Slide 2: SIEMPRE abrir con emocion/dolor INTERNO, luego datos. 2) Slide 3: Titulo centrado en el CLIENTE (Esto es lo que tienes), no en la empresa. 3) Slide 6: Codigos tecnicos como secreto del insider, no como amenaza. 4) Slide 9: Transformacion EMOCIONAL y humana, no solo economica. Usar la palabra "por fin". 5) Slide 10: ANCLA de precio ANTES de mostrar planes (1 visita sin plan vs mes completo). 6) Slide 12: 3 pasos SIN URLs, SIN datos tecnicos, verbo de accion directo. 7) REGLA DE ORO: El cliente es Luke Skywalker, TreboLife es Yoda. Cada titulo responde: que gana el cliente?',
    storybrand: 'Headlines aprobados: Dental="Cuanto tiempo llevas aguantando ese dolor de muela porque crees que no puedes pagarlo?" Safe="Son las 2AM. Tu hijo tiene fiebre de 103. A donde vas?" Health Plus="Tienes diabetes, hipertension o colesterol. Necesitas un medico que te conozca." Vision="Tu hijo reprueba. No es que no estudia - es que no puede ver el pizarron." Estructura brochure: 13 slides obligatorias (Hero crisis -> Problema 3 niveles -> Servicios -> Beneficio clave -> Farmacia/Diabetes -> Vision/Labs -> Dental ahorro -> 7 personas 1 precio -> Vida transformada 4 antes/despues -> Precios con ancla -> Sin barreras -> 3 pasos sin friccion -> CTA final + disclaimer legal).',
    urls: 'trebolife.com, trebolife.telemedsimplified.com (activacion)',
    redes: 'Instagram, Facebook, TikTok, WhatsApp (canal principal)'
  },
  Traduce: {
    descripcion: 'Servicio de traduccion certificada de documentos para procesos migratorios, legales, academicos y personales en EE.UU. Cada traduccion incluye: certificado oficial, firma del traductor certificado, declaracion jurada de precision, formato PDF profesional. 100% de traducciones aceptadas por instituciones (cero rechazos). Garantia 30 dias.',
    audiencia: 'B2C: Comunidad hispana/latina en EE.UU. que necesita traducciones para USCIS, cortes, universidades, notarios. Documentos: actas de nacimiento/matrimonio/divorcio, pasaportes, licencias, transcripciones academicas, diplomas, records medicos. B2B: Abogados de inmigracion, paralegales, call centers legales, emprendedores que quieren generar ingresos como afiliados.',
    tono: 'Calido, personal, tranquilizador. "Sabemos que este documento representa algo importante para ti". "Eres parte de la familia Traduce". Usa "tu" (informal). Bilingue espanol/ingles. Tagline: "Las palabras correctas, en el momento justo, marcan la diferencia."',
    productos: 'Ingles-Espanol: Regular $13.99/pag, Express, Urgente, Mismo dia. Espanol-Ingles: 4 velocidades. Otros idiomas: 4 velocidades. Notarizacion: $35 primer doc + adicionales. Envio fisico: $25. Descuento 10% clientes recurrentes (dentro de 10 dias). Descuentos por volumen/familia.',
    diferenciador: '100% tasa de aceptacion (cero rechazos institucionales), correcciones gratis si hay errores, garantia 30 dias sin costo extra, cumple USCIS/cortes, certificacion profesional con firma y declaracion jurada, entregas mismo dia disponible, soporte bilingue, programa de afiliados via Tracknow (15 SKUs, comisiones por referidos)',
    proceso: '1. Cliente envia documento original. 2. Traductor certificado traduce. 3. Multiples revisiones. 4. Se emite certificado y firma. 5. Se entrega PDF estructurado (certificado -> traduccion -> original). 6. Notarizacion opcional. 7. Envio fisico opcional. 8. Soporte 30 dias post-entrega.',
    urls: 'traduce.us, traduce.us/googlereviews',
    contacto: 'Email: info@traduce.us, Tel: +1 (888) 378 1368, WhatsApp disponible',
    redes: 'Instagram, Facebook, WhatsApp, Google Reviews'
  },
  MagneTraffic: {
    descripcion: 'Plataforma de generacion de leads para agentes de seguros hispanos en EE.UU. Usa sistema actuarial de IA (no marketing tradicional) para optimizar campanas de Meta Ads. Sede en Orlando, FL. Opera con logica de seguros: Loss Ratio, Factor de Credibilidad Z, Tablas de Supervivencia de ads.',
    audiencia: 'Agentes de seguros hispanos en EE.UU., agencias de seguros, call centers de salud/dental/vida. Segmentos: agentes individuales, agencias (multiples agentes), mayoristas (multiples agencias).',
    tono: 'Directo, profesional, orientado a datos y resultados. Sin exageraciones. Honesto sobre lo que funciona y lo que no. "No son listas recicladas, son leads generados especificamente para lo que contratas."',
    productos: 'Leads Generados $0.99/lead: Salud/Dental, Excel/CSV, WhatsApp validado, opt-in, minimo 250. Leads Inbound: Dental $7, Salud $15, Vida $25, minimo 30. Pack Starter: 250 leads por $247, entrega mismo dia.',
    diferenciador: 'Leads generados especificamente para lo contratado (no listas publicas/recicladas/compartidas). WhatsApp validado. Opt-in verificado. Entrega mismo dia. Sistema actuarial de IA que optimiza CPL automaticamente. Umbrales CPL: Traduce $6, MagneTraffic/FFL/Dental $8, TreboLife $3.',
    objeciones: 'Opt-in: 100% por iniciativa del usuario. Leads frios: llenaron formulario pidiendo info. Listas compartidas: no, son exclusivas. Miedo/estafas: pago seguro via Stripe. Menos de 250: minimo para estadisticas reales de cierre. No contestan: son personas reales con WhatsApp real, la rapidez de contacto es clave.',
    urls: 'magnetraffic.com, magnetai.com',
    contacto: 'Tel: +1-863-800-0163, Email: info@magnetraffic.com',
    redes: 'Instagram, Facebook, WhatsApp'
  },
  FFL: {
    descripcion: 'FFL Insurance - agencia de seguros enfocada en la comunidad hispana/latina en EE.UU. Ofrece membresia dental, seguro dental PPO, seguros de salud ACA y alternativos, y seguros de gastos finales (Final Expense). Opera con agente AI "Alejandra" como primer contacto.',
    audiencia: 'Comunidad hispana/latina en EE.UU., inmigrantes (con o sin estatus migratorio valido), personas sin SSN, sin empleo formal, sin seguro actual. Final Expense: adultos 50-85 anos.',
    tono: 'Empatia primero - siempre validar la emocion/dolor del cliente en la primera frase. Solucion directa en 1-2 oraciones. Detalles solo si el cliente muestra interes. Espanol primero. NUNCA mencionar nombres de carriers (Careington, 1Dental) al cliente.',
    productos: 'Membresia Dental Careington: $99/ano (~$8/mes), 75K+ dentistas, descuentos 60-82%, sin SSN, activacion 24-72h. Dental PPO: $14.99/mes, hasta $3K/ano limite, $50 deducible. Salud ACA: varia segun ingreso (puede ser $0). Planes Alternativos: sin SSN, sin verificacion credito. Final Expense: $40-60/mes por $5K-$10K cobertura, edades 50-85.',
    diferenciador: 'Sin SSN requerido, sin verificacion de credito, sin verificacion de empleo, activacion inmediata 24-72h, cancelacion sin penalidad, planes para indocumentados, servicio bilingue espanol-first, entrada desde $99/ano.',
    ahorros: 'Limpieza dental: $135 -> $33 (76% desc). Canal raiz molar: $1,510 -> $481 (68%). Extraccion simple: $287 -> $71 (75%). Dentadura completa: $2,559 -> $752 (71%). Corona porcelana: $1,586 -> $524 (67%). Brackets adulto: $6,401 -> $2,615 (59%). Emergencia dolor: $194 -> $44 (77%).',
    proceso_venta: '1. Saludo -> pedir ZIP y edad. 2. Preguntar que necesita: dental, salud, o ambos. 3. Si salud: verificar seguro actual, estatus migratorio, empleo. 4. Si dental: verificar problemas, urgencia, plan actual. 5. Si ambos: empezar con salud, luego dental. Horario asesores: 10AM-8PM EST.',
    final_expense: 'Costo promedio funeral: $10,000+. Cobertura tipica: $10K-$25K. Simplified Issue: salud favorable = primas bajas, cobertura inmediata. Guaranteed Issue: salud adversa = primas altas, 2 anos espera para muerte natural. Enfoque consultivo/educativo, empatia, abordar objeciones proactivamente.',
    urls: 'fflinsurance.com',
    redes: 'Instagram, Facebook, WhatsApp'
  },
  Dental: {
    descripcion: 'Planes dentales accesibles para la comunidad hispana. Membresia de descuentos (NO seguro). Red 1Dental/Careington con 75K+ dentistas. Activacion inmediata, sin periodo de espera.',
    audiencia: 'Familias hispanas sin seguro dental, trabajadores independientes, inmigrantes, personas sin SSN.',
    tono: 'Accesible, amigable, enfocado en ahorro real con ejemplos numericos concretos. Empatia con el dolor dental. NUNCA mencionar nombres de carriers.',
    productos: '1Dental Standard: $99/ano (20% desc en todo). Premium: $149/ano (20% preventivo, 30% basico/mayor). Elite: $199/ano (20% preventivo, 50% basico/mayor). Careington via TreboLife: desde $14.99/mes. Sin deducible en preventivo, $50 en mayor. Limite anual $1,500-$3,000.',
    diferenciador: 'Activacion inmediata, sin periodo espera, sin SSN, sin verificacion credito, cancelacion sin penalidad, garantia 30 dias, 75K+ dentistas, app movil, soporte 24/7, programa referidos.',
    ahorros: 'Limpieza: $150 -> $120 (20%). Relleno: $200 -> $140 (30%). Muela juicio: $2,200 -> $1,100 (50%). Corona porcelana: $1,600 -> $800 (50%). Ortodoncia completa: $6,000 -> $3,000 (50%). Dentadura parcial: $4,000 -> $2,000 (50%).',
    urls: '1dental.com',
    redes: 'Instagram, Facebook, WhatsApp'
  },
  Salud: {
    descripcion: 'Seguros de salud ACA/Obamacare, planes complementarios, y planes alternativos para inmigrantes sin estatus. PPO dental con vision, audicion y farmacia incluidos.',
    audiencia: 'Familias hispanas sin seguro medico, individuos con/sin estatus migratorio, trabajadores independientes.',
    tono: 'Informativo, tranquilizador, profesional. Enfasis en accesibilidad y que hay opciones para todos sin importar su situacion.',
    productos: 'ACA/Obamacare: varia segun ingreso (puede ser $0 con subsidios). Requiere estatus migratorio valido. Planes Alternativos: sin SSN, sin verificacion credito, para indocumentados. PPO Dental: preventivo 100% cubierto, basico 80-90%, mayor 50%. Vision: examenes anuales cubiertos, descuentos en lentes. Audicion: evaluaciones gratis. Farmacia: descuentos en red.',
    diferenciador: 'Planes para TODOS sin importar estatus migratorio, asesoria en espanol, ayuda con subsidios ACA, proceso simplificado, sin verificacion de empleo, herramientas digitales (portal, app, calculadoras de costos), proteccion contra facturacion sorpresa.',
    urls: 'healthcare.gov (ACA)',
    redes: 'Instagram, Facebook, WhatsApp'
  },
  BankyBlendz: {
    descripcion: 'Barberia especializada en cortes, fades y servicios de grooming masculino. Contenido enfocado en mostrar transformaciones, tecnicas de corte y estilo de vida de barberia.',
    audiencia: 'Hombres jovenes y adultos (16-40 anos) que buscan cortes modernos, fades, y servicios de barberia de calidad. Clientes locales y potenciales que descubren la barberia por redes sociales.',
    tono: 'Autentico, visual, moderno, urbano. El contenido debe hablar por si mismo - las transformaciones son el mejor marketing. Energia positiva, confianza, estilo.',
    productos: 'Cortes de cabello, fades, beard trims, lineups, disenos, servicios de grooming completos.',
    diferenciador: 'Definido por la base de conocimiento del admin. Subir documentos con el estilo unico, reglas de contenido y criterios de evaluacion de BankyBlendz.',
    urls: '',
    redes: 'TikTok, Instagram'
  }
};

const STORYBRAND_HISPANO = `
METODOLOGIA STORYBRAND ADAPTADA PARA AUDIENCIAS HISPANAS:

Framework base (Donald Miller) adaptado:
- El HEROE es siempre el cliente/prospecto, nunca la marca
- La marca es el GUIA que tiene empatia y autoridad
- Se identifica un PROBLEMA externo, interno y filosofico
- Se presenta un PLAN claro y simple
- Se hace un LLAMADO A LA ACCION directo
- Se muestra el EXITO (transformacion) y se advierte del FRACASO (que pasa si no actua)

ADAPTACION HISPANA CRITICA:
- Mayor calidez emocional y conexion personal antes de ir al punto
- Uso de storytelling con elementos familiares, comunitarios y de identidad cultural
- El "pain point" se aborda con empatia profunda, no solo logica
- Los testimonios tienen mayor peso que las estadisticas frias
- El sentido de comunidad y pertenencia es un motivador mas fuerte que el individualismo
- El lenguaje debe ser inclusivo, calido y evitar sonar "gringo traducido"
- Las referencias culturales deben ser autenticas, no estereotipadas

REGLAS CULTURALES:
- NUNCA usar traduccion literal del ingles
- Si es bilingue, ambas versiones deben ser igualmente potentes
- Para audiencia hispana: priorizar emocion, familia, comunidad, identidad
- Para anglosajona: priorizar eficiencia, datos, resultados
- Detectar y penalizar: estereotipos culturales, espanol neutro forzado
- El humor debe ser culturalmente apropiado
- WhatsApp es el canal de distribucion mas importante en mercados hispanos
`;

const RUBRICA_VIDEO = `
RUBRICA DE EVALUACION DE VIDEOS (100 PUNTOS):

1. StoryBrand Adaptado (15 pts): Heroe definido, marca como guia, problema triple, plan claro, CTA, exito/fracaso, adaptacion hispana
2. Hook y Retencion (12 pts): Hook en 3 segundos, prediccion de abandono, momentos de riesgo
3. Copy y Titulos (12 pts): Titulo efectivo, textos en pantalla legibles, thumbnail compelling
4. Guion y Estructura (12 pts): Estructura completa, mensaje funciona sin audio
5. Creatividad (10 pts): Diferenciacion alta/media/baja
6. Engagement (10 pts): Elementos interactivos, shareability
7. Calidad Tecnica (10 pts): Resolucion, audio limpio, formato correcto, subtitulos
8. Tiempos y Ritmo (8 pts): Duracion apropiada, ritmo de edicion
9. Marca y Compartibilidad (6 pts): Branding apropiado, facil de compartir por WhatsApp
10. CTA y Conversion (5 pts): CTA claro, siguiente paso definido

UMBRALES:
- 90-100: Excelente - publicar inmediatamente
- 80-89: Bueno - aprobado con observaciones menores
- 70-79: Aceptable - aprobado con cambios recomendados
- 50-69: Requiere cambios - no publicar sin correcciones
- 0-49: Rechazado - rehacer el creativo

REGLAS CRITICAS:
- Si abandono predicho > 40% antes del CTA, maximo 6/12 en Hook
- No aprobar videos con calidad tecnica excelente pero storytelling debil
- No aprobar videos que suenen a "IA generica" - deben tener personalidad humana
- Evaluar si el video seria facil de compartir por WhatsApp
`;

const TIPOS_VIDEO = `
TIPOS DE VIDEO Y SUS OBJETIVOS:

TIPO 1 - Informativo/Educativo: Educar al publico sobre un tema. Debe ser claro, conciso y aportar valor real.
TIPO 2 - Captacion/Venta Directa: Convertir espectadores en compradores. CTA fuerte, urgencia, beneficios claros.
TIPO 3 - Generacion de Leads: Captar datos del prospecto. Oferta irresistible, formulario simple, valor inmediato.
TIPO 4 - Reclutamiento de Red: Atraer afiliados/distribuidores. Oportunidad de negocio, testimonios, plan claro.
TIPO 5 - Webinar: Reclutamiento y entrenamiento. Estructura de presentacion, engagement, duracion apropiada.
TIPO 6 - Retencion: Mantener clientes actuales. Valor continuo, comunidad, exclusividad.
TIPO 7 - Branding: Conocimiento de marca. Emocional, memorable, compartible.
TIPO 8 - Seguimiento: Nurturing. Personalizado, valor adicional, recordatorio suave.
`;

// Criterios de evaluacion por OBJETIVO
const CRITERIOS_POR_OBJETIVO = {
  leads: `
CRITERIOS ESPECIFICOS PARA GENERACION DE LEADS:
Este creativo tiene como objetivo CAPTAR DATOS del prospecto (nombre, telefono, email).

EVALUAR OBLIGATORIAMENTE:
1. HOOK EMOCIONAL (20 pts): ¿Abre con un pain point real de la audiencia? ¿Genera urgencia? ¿El prospecto se identifica en los primeros 2 segundos?
2. OFERTA CLARA (20 pts): ¿Se entiende QUE ofrece en menos de 5 segundos? ¿Menciona precio/descuento/gratis? ¿Hay una propuesta de valor irresistible?
3. CTA DIRECTO (20 pts): ¿El CTA pide una accion especifica? (Cotiza gratis, Llama ahora, Envía tu documento). NO sirven CTAs vagos como "Conoce más" o "Visita nuestra página".
4. CONFIANZA (15 pts): ¿Incluye prueba social? (testimonios, numero de clientes, calificaciones, logos, certificaciones). ¿Elimina el miedo a actuar?
5. FORMATO DE LEAD (15 pts): ¿Las dimensiones son correctas para Meta Ads? ¿El texto cumple la regla de 20% de Meta? ¿Es mobile-first? ¿El boton/enlace es visible y grande?
6. URGENCIA (10 pts): ¿Hay razon para actuar AHORA? (tiempo limitado, cupo limitado, precio especial)

REGLA DE FIGURAS HUMANAS EN LEADS:
- Las figuras humanas (fotos de personas, modelos, rostros) DISTRAEN del mensaje principal en ads de generacion de leads
- El prospecto se enfoca en la persona y NO en la oferta/CTA
- Para leads es mas efectivo: iconos, ilustraciones simples, numeros grandes, beneficio en texto directo, colores contrastantes
- Si hay persona, debe ser MUY secundaria (fondo borroso, pequena) y el texto/oferta debe dominar el 80%+ del espacio
- Penalizar si la figura humana ocupa mas del 30% de la imagen y no hay oferta clara visible

ERRORES CRITICOS (descuentan 15 pts cada uno):
- CTA que dice "Conoce más" o "Más información" en vez de accion directa
- No mencionar el beneficio principal en el primer 25% del creativo
- Formulario o siguiente paso no claro
- Imagen generica de stock sin conexion emocional
- Demasiado texto (Meta rechaza ads con >20% texto en imagen)
- No incluir WhatsApp como canal de contacto (audiencia hispana)
- Figura humana dominante que distrae de la oferta/CTA (ver regla arriba)
`,

  reclutamiento: `
CRITERIOS ESPECIFICOS PARA RECLUTAMIENTO:
Objetivo: atraer distribuidores/afiliados al negocio.

EVALUAR:
1. OPORTUNIDAD CLARA (25 pts): ¿Se entiende que es una oportunidad de ingreso? ¿Menciona cuanto pueden ganar? ¿Es realista?
2. TESTIMONIOS (20 pts): ¿Muestra resultados reales de personas similares? ¿Son creibles?
3. PLAN SIMPLE (20 pts): ¿Explica los pasos para empezar? ¿Parece facil?
4. ELIMINACION DE BARRERAS (15 pts): ¿Aborda objeciones? (sin inversion, sin experiencia, desde tu celular)
5. CTA DE RECLUTAMIENTO (10 pts): ¿Invita a unirse/registrarse/agendar llamada?
6. PROFESIONALISMO (10 pts): ¿Se ve como negocio serio, no como esquema piramidal?
`,

  retencion: `
CRITERIOS ESPECIFICOS PARA RETENCION:
Objetivo: mantener clientes actuales, reducir cancelaciones.

EVALUAR:
1. VALOR CONTINUO (25 pts): ¿Recuerda al cliente por que se unio? ¿Muestra beneficios que quizas no ha usado?
2. COMUNIDAD (20 pts): ¿Hace sentir al cliente parte de algo? ¿Usa "nosotros", "familia", "comunidad"?
3. EXCLUSIVIDAD (20 pts): ¿Ofrece algo especial para clientes actuales? ¿Descuento por lealtad, contenido exclusivo?
4. EMOTIVIDAD (15 pts): ¿Conecta emocionalmente? ¿Storytelling de transformacion?
5. FACILIDAD DE USO (10 pts): ¿Recuerda como usar el servicio? ¿Tips practicos?
6. SIN PRESION DE VENTA (10 pts): ¿Es contenido de valor, no venta agresiva?
`,

  branding: `
CRITERIOS ESPECIFICOS PARA BRANDING:
Objetivo: conocimiento de marca, posicionamiento, recordacion.

EVALUAR:
1. IDENTIDAD VISUAL (25 pts): ¿Colores, fuentes y estilo consistentes con la marca? ¿Logo visible pero no invasivo?
2. MENSAJE MEMORABLE (20 pts): ¿Se recuerda despues de verlo? ¿Tiene una frase o concepto central potente?
3. EMOCION (20 pts): ¿Genera sentimiento positivo? ¿Conecta con los valores de la audiencia?
4. COMPARTIBILIDAD (15 pts): ¿La gente lo compartiria en WhatsApp/redes? ¿Es interesante/util/inspirador?
5. DIFERENCIACION (10 pts): ¿Se distingue de la competencia? ¿Tiene personalidad propia?
6. PROFESIONALISMO (10 pts): ¿Calidad de produccion acorde a la marca?
`,

  webinar: `
CRITERIOS ESPECIFICOS PARA WEBINAR/EVENTO:
Objetivo: lograr registros para evento en vivo o grabado.

EVALUAR:
1. TITULO DEL EVENTO (20 pts): ¿Es compelling? ¿Promete un resultado especifico?
2. FECHA/HORA CLARA (15 pts): ¿Se ve facilmente cuando es? ¿Timezone?
3. SPEAKER/AUTORIDAD (15 pts): ¿Muestra quien presenta? ¿Credibilidad?
4. BENEFICIO DE ASISTIR (20 pts): ¿Que va a aprender/obtener el asistente?
5. CTA DE REGISTRO (15 pts): ¿Boton/enlace de registro claro y visible?
6. URGENCIA/EXCLUSIVIDAD (15 pts): ¿Cupos limitados? ¿Bonus por registrarse?
`,

  educativo: `
CRITERIOS ESPECIFICOS PARA CONTENIDO EDUCATIVO:
Objetivo: aportar valor, educar, posicionar como experto.

EVALUAR:
1. VALOR REAL (25 pts): ¿El contenido es util y aplicable? ¿Resuelve una duda real?
2. CLARIDAD (20 pts): ¿Se entiende facilmente? ¿Lenguaje simple, sin jerga?
3. ESTRUCTURA (20 pts): ¿Tiene inicio-desarrollo-conclusion? ¿Fluye logicamente?
4. CREDIBILIDAD (15 pts): ¿Demuestra expertise? ¿Datos verificables?
5. ENGAGEMENT (10 pts): ¿Invita a guardar/compartir? ¿Tiene formato atractivo (tips, lista, infografia)?
6. BRANDING SUTIL (10 pts): ¿Asocia la marca con autoridad sin vender directamente?
`,

  venta_directa: `
CRITERIOS ESPECIFICOS PARA VENTA DIRECTA:
Objetivo: convertir en compra/contratacion inmediata.

EVALUAR:
1. PRODUCTO/PRECIO CLARO (25 pts): ¿Se sabe exactamente que se vende y cuanto cuesta?
2. BENEFICIO PRINCIPAL (20 pts): ¿Por que comprarlo? ¿Que problema resuelve?
3. URGENCIA (15 pts): ¿Razon para comprar AHORA? ¿Oferta limitada, descuento?
4. PRUEBA SOCIAL (15 pts): ¿Testimonios, reviews, numero de clientes satisfechos?
5. CTA DE COMPRA (15 pts): ¿Boton/enlace claro para comprar? ¿Proceso simple?
6. OBJECIONES (10 pts): ¿Aborda las dudas principales? (garantia, devolucion, soporte)
`,

  seguimiento: `
CRITERIOS ESPECIFICOS PARA SEGUIMIENTO/FOLLOW-UP:
Objetivo: reactivar prospectos que no convirtieron, nurturing.

EVALUAR:
1. PERSONALIZACION (25 pts): ¿Se siente personal, no masivo? ¿Referencia interaccion previa?
2. VALOR ADICIONAL (20 pts): ¿Ofrece algo nuevo que no vio antes? ¿Tip, descuento, info?
3. TONO NO AGRESIVO (20 pts): ¿Es un recordatorio amable, no presion? ¿Respeta el tiempo?
4. CTA SUAVE (15 pts): ¿Invita sin obligar? "Cuando estes listo", "Si tienes dudas"
5. CANALES (10 pts): ¿Facilita responder por WhatsApp/telefono?
6. TIMING (10 pts): ¿Es apropiado para follow-up? ¿No es el primer contacto?
`
};

// Rubrica especifica para IMAGENES
const RUBRICA_IMAGEN = `
RUBRICA DE EVALUACION DE IMAGENES PARA ADS (100 PUNTOS):

1. SCROLL-STOPPING POWER (18 pts):
   - ¿Captura atencion en menos de 1 segundo? ¿Destaca en el feed?
   - ¿Tiene UN punto focal dominante? (no multiples elementos compitiendo)
   - ¿Hay jerarquia visual clara? (primario → secundario → terciario)
   - ¿Usa contraste estrategico y espacio en blanco?
   - Si la respuesta es NO a cualquiera: maximo 8/18

2. STORYBRAND VISUAL (15 pts):
   - El CLIENTE es el heroe (la imagen habla de lo que GANA el cliente, no de la marca)
   - La marca aparece como GUIA (logo sutil, no invasivo)
   - Se identifica visualmente un PROBLEMA (externo, interno o filosofico)
   - Hay un PLAN claro visible
   - CTA y transformacion de EXITO implicita
   - Adaptacion cultural hispana: emocion > datos, familia, comunidad, identidad

3. COPY Y TEXTO EN IMAGEN (15 pts):
   - Texto legible a tamano mobile (fuente minima 24pt equivalente)
   - Cumple regla de 20% de texto de Meta (si >20%, Meta reduce alcance)
   - Hook escrito en la imagen que genera emocion/urgencia
   - Idioma correcto para la audiencia (espanol natural, no traduccion literal)
   - Headline centrado en el cliente, no en la empresa
   - PENALIZAR: espanol neutro forzado, "gringo traducido", jerga corporativa

4. CTA Y CONVERSION (12 pts):
   - CTA claro, visible, con accion DIRECTA ("Cotiza gratis", "Llama ahora", NO "Conoce mas")
   - Siguiente paso definido (telefono, WhatsApp, formulario)
   - Boton/enlace visible y grande (mobile-first)
   - Incluye WhatsApp como canal (critico para audiencia hispana)

5. IDENTIDAD DE MARCA (10 pts):
   - Colores consistentes con la guia visual del negocio
   - Logo presente pero NO dominante (guia, no heroe)
   - Fuentes y estilo coherentes con la marca
   - TreboLife: verdes (#1A6E3E, #2D9E5F), crema (#FFFCF5), dorado (#D4A017)
   - Traduce: profesional, bilingue, certificacion visible
   - FFL/Dental/Salud: empatico, numeros de ahorro grandes

6. CALIDAD TECNICA Y META ADS (10 pts):
   - Resolucion alta (minimo 1080px en dimension menor)
   - Dimensiones correctas: 1080x1080 (feed), 1080x1920 (stories/reels), 1200x628 (feed horizontal)
   - Sin pixelacion, sin marcas de agua, sin logos de herramientas (Canva, etc.)
   - Colores vibrantes que no se pierdan en modo oscuro del feed
   - Sin clutter visual que Meta penalizaria

7. CONEXION CULTURAL (8 pts):
   - Personajes/imagenes que representan a la audiencia hispana
   - Sin estereotipos culturales
   - Estilo visual aprobado: ilustracion 3D tipo Pixar/Disney con personajes hispanos (TreboLife)
   - O fotografia autentica con familias hispanas reales (no stock generico)
   - PROHIBIDO: familias no-hispanas, fondos blancos de estudio, poses corporativas forzadas

8. TRIGGER EMOCIONAL (7 pts):
   - La imagen comunica INSTANTANEAMENTE una emocion: seguridad, oportunidad, alivio, pertenencia
   - El prospecto se ve REFLEJADO en la imagen (aspiracional, no intimidante)
   - Para TreboLife: crisis nocturna → alivio, dolor dental → solucion, familia protegida
   - Para Traduce: documento importante → tranquilidad, proceso migratorio → esperanza
   - Para FFL/Dental: dolor → ahorro real con numeros concretos

9. COMPARTIBILIDAD (5 pts):
   - ¿Se compartiria facilmente por WhatsApp?
   - ¿El mensaje se entiende SIN leer la descripcion del ad?
   - ¿Funciona como imagen standalone?

UMBRALES:
- 90-100: Publicar inmediatamente - ad de alto rendimiento
- 80-89: Aprobado con observaciones menores
- 70-79: Aprobado con cambios recomendados
- 50-69: Requiere cambios - no publicar sin correcciones
- 0-49: Rechazado - rehacer el creativo

ERRORES CRITICOS QUE DESCUENTAN 15 PTS CADA UNO:
- Imagen con mas de 20% de texto (Meta reduce alcance drasticamente)
- CTA vago: "Conoce mas", "Mas informacion" en vez de accion directa
- No mencionar beneficio principal en la zona visible de la imagen
- Imagen generica de stock sin conexion emocional con la audiencia
- Figura humana dominante (>30% del espacio) que distrae de la oferta/CTA en ads de leads
- Logo de herramientas visibles (Canva, Unsplash, etc.)
- Dimensiones incorrectas para la plataforma destino
- Fondo blanco plano sin profundidad visual (parece no-terminado)

METRICAS DE RENDIMIENTO ESPERADAS (para referencia del evaluador):
- CTR objetivo: 3%+ (promedio industria: 1-2%)
- Thumb-stop rate: 80%+ en primeros 2 segundos
- El ad debe funcionar como "sistema predecible de conversion", no como "post bonito"
- Cada pixel debe tener un proposito. Cada palabra debe mover al prospecto hacia la accion.
`;

const RUBRICA_EMAIL = `
RUBRICA DE EVALUACION DE EMAILS (100 PUNTOS):

1. Linea de Asunto (15 pts): Genera curiosidad, no es spam, menos de 50 caracteres
2. StoryBrand (15 pts): Estructura heroe-guia-problema-plan-CTA
3. Copy Persuasivo (15 pts): Natural, no suena a robot, personalizado
4. CTA Claro (12 pts): Visible, directo, con urgencia apropiada
5. Estructura Visual (12 pts): Header, body, CTA, footer, escaneable, mobile-friendly
6. Personalizacion (10 pts): Usa nombre, contexto, segmentacion
7. Longitud (8 pts): Apropiada para el objetivo (corto para leads, mas largo para educativo)
8. Compliance (8 pts): Unsubscribe, direccion fisica, no misleading
9. Valor (5 pts): Aporta algo al lector, no solo vende
`;

const RUBRICA_PRESENTACION = `
RUBRICA DE EVALUACION DE PRESENTACIONES (100 PUNTOS):

1. Primer Slide/Portada (15 pts): Impactante, titulo claro, genera interes
2. StoryBrand (15 pts): Flujo problema-solucion-CTA a lo largo de las slides
3. Diseno Visual (15 pts): Consistencia, colores de marca, profesionalismo
4. Texto Conciso (12 pts): Maximo 6 lineas por slide, una idea por slide
5. Flujo Logico (12 pts): La informacion progresa naturalmente
6. CTA Final (10 pts): Slide final con accion clara
7. Imagenes/Graficos (10 pts): Relevantes, alta calidad, apoyan el mensaje
8. Legibilidad (6 pts): Fuentes legibles, contraste adecuado, tamano apropiado
9. Branding (5 pts): Logo, colores, fuentes de marca consistentes
`;

const RUBRICA_SMS = `
RUBRICA DE EVALUACION DE SMS (100 PUNTOS):
IMPORTANTE: No solo evalues. Por cada problema que encuentres, DEBES dar una VERSION CORREGIDA lista para copiar y usar. El usuario necesita alternativas, no solo criticas.

1. PREVIEW HACK Y ESTRUCTURA (20 pts):
   - ¿El nombre del destinatario esta en la PRIMERA LINEA? (critico para preview de notificacion)
   - ¿Hay 3-5 lineas en blanco despues del nombre para empujar el cuerpo fuera de la preview?
   - Tecnica: el telefono muestra ~40 chars en la notificacion. Si solo ve "Hola Juan," genera curiosidad maxima
   - FORMATO CORRECTO:
     "Hola {{nombre}},\n\n\n\nTu mensaje aqui. Responde SI\n\nSTOP para cancelar"
   - Si NO usa preview hack, mostrar como quedaria CON el hack

2. CTA DE RESPUESTA SIMPLE (20 pts):
   - El CTA debe ser UNA PALABRA de respuesta: "Responde SI", "Responde HOLA", "Responde 1"
   - CTAs de respuesta simple tienen 70% de conversion vs 15% de links
   - MALO: "Visita nuestro sitio web para mas informacion"
   - BUENO: "Responde SI y te envio los detalles"
   - Si el CTA es debil, REESCRIBIR el SMS completo con CTA correcto

3. PERSONALIZACION (15 pts):
   - Usa {{nombre}} del destinatario
   - Referencia contexto: "la ultima vez que hablamos", "tu consulta sobre dental"
   - Se siente como mensaje de UN HUMANO, no de una empresa
   - Si suena generico, dar version personalizada

4. PROPUESTA DE VALOR EN 1 LINEA (15 pts):
   - El beneficio debe ser claro en UNA oracion despues de los espacios
   - Usar numeros concretos: "$14.99/mes", "ahorra $300", "en 24 horas"
   - Si el beneficio es vago, reescribir con numero concreto

5. COMPLIANCE TCPA (10 pts):
   - OBLIGATORIO: "STOP para cancelar" al final
   - Sin esto, viola regulaciones federales de EE.UU.
   - Si falta, agregar automaticamente en la version corregida

6. BREVEDAD (10 pts):
   - MAXIMO 160 caracteres (1 SMS = 1 cobro, >160 = 2 SMS = doble costo)
   - Contar caracteres exactos y reportar
   - Si excede 160, dar version recortada que mantenga el mensaje

7. TIMING Y CONTEXTO (10 pts):
   - ¿Es apropiado para base fria? (no agresivo, no asume relacion)
   - ¿Tiene razon para contactar? (no es spam aleatorio)
   - Sugerir horario: 10am-2pm o 5pm-7pm

PARA CADA PROBLEMA, DAR:
- ❌ Version actual (lo que envio el usuario)
- ✅ Version corregida (lista para copiar y usar)
- 💡 Por que funciona mejor

PLANTILLAS DE REFERENCIA PARA BASE FRIA:
Reactivacion: "Hola {{nombre}},\n\n\n\n¿Sigues buscando opciones de seguro dental? Tengo algo nuevo para ti. Responde SI\n\nSTOP para cancelar"
Urgencia: "{{nombre}},\n\n\n\nTu cotizacion de $14.99/mes vence manana. ¿La activo? Responde SI\n\nSTOP para cancelar"
Re-engagement: "{{nombre}}, hace tiempo no hablamos\n\n\n\n¿Todo bien? Si aun necesitas ayuda, estoy aqui. Responde HOLA\n\nSTOP para cancelar"
Oferta directa: "{{nombre}},\n\n\n\nTengo 3 opciones de seguro desde $0/mes para ti. ¿Te interesa? Responde SI\n\nSTOP para cancelar"
`;

const RUBRICA_WHATSAPP = `
RUBRICA DE EVALUACION DE PLANTILLAS WHATSAPP (100 PUNTOS):
IMPORTANTE: No solo evalues. Por cada problema, DEBES dar VERSION CORREGIDA de la plantilla completa lista para enviar a Meta para aprobacion. El usuario necesita la solucion, no solo la critica.

1. CUMPLIMIENTO DEL TIPO DE PLANTILLA (20 pts):
   - UTILITY (abrir canal): DEBE ser 100% transaccional. Si tiene CUALQUIER contenido promocional, Meta la RECHAZA.
     BIEN: "Hola {{1}}, tu cita es el {{2}} a las {{3}}. Responde SI para confirmar o NO para reprogramar."
     MAL: "Hola {{1}}, tu cita es manana. Aprovecha nuestro descuento del 20%!" ← RECHAZADA (mezcla utility con marketing)
   - MARKETING (promocional): Puede vender pero debe aportar VALOR real. No spam.
     BIEN: "{{1}}, tienes un descuento exclusivo del 30% en tu limpieza dental. Solo hasta el {{2}}. ¿Te agendo?"
     MAL: "OFERTA INCREIBLE!!! COMPRA YA!!!" ← RECHAZADA (spam, mayusculas, sin personalizacion)
   - AUTHENTICATION: SOLO codigos de verificacion. Maximo 1 boton.
     BIEN: "Tu codigo de verificacion es {{1}}. Expira en 5 minutos. No compartas este codigo."
   - Si el tipo declarado no coincide con el contenido, CORREGIR la plantilla completa

2. PREVIEW DE NOTIFICACION (15 pts):
   - La primera linea es lo que el usuario ve en la notificacion push de WhatsApp
   - Debe generar curiosidad o valor inmediato
   - MALO: "Estimado cliente, le informamos que..." (corporativo, aburrido)
   - BUENO: "{{1}}, tengo noticias sobre tu consulta" (personal, intrigante)
   - Dar 3 alternativas de primera linea si la actual es debil

3. CUERPO CLARO Y CONCISO (15 pts):
   - Utility: maximo 100 palabras
   - Marketing: maximo 150 palabras
   - UNA idea por plantilla, no multiples ofertas
   - Usar emojis con moderacion (1-2 max, no llenar de emojis)
   - Si es largo, dar version recortada

4. BOTONES CTA (15 pts):
   - Maximo 3 botones (regla de Meta)
   - Cada boton debe tener accion DIRECTA: "Agendar cita", "Ver oferta", "Llamar ahora"
   - Deep links preferidos: wa.me/numero, tel:+1234567890
   - Quick replies para respuestas simples: "Si, me interesa" / "No, gracias"
   - Si no tiene botones, sugerir cuales agregar

5. VARIABLES DINAMICAS (10 pts):
   - {{1}} = nombre SIEMPRE (personalizacion minima)
   - {{2}} = dato relevante (fecha, precio, producto)
   - {{3}} = contexto (sucursal, agente, referencia)
   - Variables deben tener fallback (si nombre es vacio, usar "amigo/a")
   - Si no tiene variables, agregar y mostrar ejemplo

6. MEDIA HEADER (10 pts):
   - Imagen: alta calidad, sin texto sobrepuesto (Meta puede rechazar)
   - Video: max 16MB, formato MP4
   - Documento: PDF para cotizaciones, contratos
   - Si el tipo de mensaje se beneficiaria de media pero no la tiene, sugerir

7. COMPLIANCE META BUSINESS (15 pts):
   - Sin contenido prohibido (alcohol, tabaco, armas, etc.)
   - Opt-in verificado (el usuario debe haber dado consentimiento)
   - Sin lenguaje amenazante o presion excesiva
   - Sin promesas de resultados garantizados
   - Si viola alguna politica, explicar CUAL y dar version que cumpla

PARA CADA PROBLEMA, DAR:
- ❌ Version actual
- ✅ Plantilla corregida COMPLETA (header + body + botones) lista para enviar a Meta
- 💡 Por que Meta la aprobaria y por que convierte mejor

PLANTILLAS DE REFERENCIA:

UTILITY - Confirmacion de cita:
Header: Confirmacion de cita
Body: "Hola {{1}}, tu cita esta programada para el {{2}} a las {{3}}. Responde para confirmar o reprogramar."
Botones: [Confirmar] [Reprogramar] [Llamar]

UTILITY - Seguimiento de orden:
Header: Tu pedido esta en camino
Body: "{{1}}, tu pedido #{{2}} fue enviado. Llegara el {{3}}. Rastrear aqui:"
Botones: [Rastrear pedido]

MARKETING - Oferta dental:
Header: imagen de sonrisa
Body: "{{1}}, tu limpieza dental con 30% de descuento te espera. Solo hasta el {{2}}. ¿Te agendo?"
Botones: [Si, agendar] [Ver precios] [Llamar]

MARKETING - Reactivacion:
Header: Te extranamos
Body: "{{1}}, hace tiempo no nos visitas. Tenemos algo especial para ti: {{2}}. ¿Te interesa?"
Botones: [Si, cuéntame] [No, gracias]

AUTHENTICATION:
Body: "Tu codigo de verificacion es {{1}}. Expira en 5 minutos. No compartas este codigo con nadie."
Botones: [Copiar codigo]
`;

// Build context for AI based on submission
// Can receive db pool to also load entries from knowledge_base table
// List of internal businesses that get full hardcoded KB (StoryBrand, rubrics, etc.)
const INTERNAL_NEGOCIOS = ['TrebolLife', 'Traduce', 'MagneTraffic', 'FFL', 'Dental', 'Salud'];

async function buildKnowledgeContext(submission, pool) {
  const negocioName = submission.negocio || 'TrebolLife';
  const negocio = NEGOCIOS[negocioName];
  const objetivo = submission.objetivo;
  const tipo = submission.tipo;
  const isInternal = INTERNAL_NEGOCIOS.includes(negocioName);

  // Try dynamic business from DB first (for any tenant)
  let dynamicBusiness = null;
  if (pool) {
    try {
      const bizResult = await pool.query(
        'SELECT * FROM businesses WHERE name = $1 LIMIT 1',
        [negocioName]
      );
      if (bizResult.rows.length > 0) {
        dynamicBusiness = bizResult.rows[0];
      }
    } catch (e) { /* businesses table may not exist yet */ }
  }

  let context = `\n\nBASE DE CONOCIMIENTO DEL NEGOCIO:\n`;

  if (dynamicBusiness) {
    // Use dynamic business from DB
    const db = dynamicBusiness;
    context += `Negocio: ${negocioName}\n`;
    if (db.description) context += `Descripcion: ${db.description}\n`;
    if (db.audience) context += `Audiencia objetivo: ${db.audience}\n`;
    if (db.tone) context += `Tono de marca: ${db.tone}\n`;
    if (db.products) context += `Productos/servicios: ${db.products}\n`;
    if (db.colors) context += `Colores de marca: ${db.colors}\n`;
    if (db.visual_style) context += `Estilo visual: ${db.visual_style}\n`;
    if (db.rules) context += `Reglas especificas: ${db.rules}\n`;
    if (db.urls) context += `URLs: ${db.urls}\n`;
  } else if (negocio) {
    // Fallback to hardcoded (for MagneTraffic default tenant)
    context += `Negocio: ${negocioName}\n`;
    context += `Descripcion: ${negocio.descripcion}\n`;
    context += `Audiencia objetivo: ${negocio.audiencia}\n`;
    context += `Tono de marca: ${negocio.tono}\n`;
    context += `Productos/servicios: ${negocio.productos}\n`;
    context += `Diferenciador clave: ${negocio.diferenciador}\n`;

    if (negocio.visual) context += `Guia visual: ${negocio.visual}\n`;
    if (negocio.reglas_diseno_v3) context += `Reglas de diseno StoryBrand v3: ${negocio.reglas_diseno_v3}\n`;
    if (negocio.storybrand) context += `StoryBrand del negocio: ${negocio.storybrand}\n`;
    if (negocio.proceso) context += `Proceso: ${negocio.proceso}\n`;
    if (negocio.ahorros) context += `Ejemplos de ahorro: ${negocio.ahorros}\n`;
    if (negocio.objeciones) context += `Objeciones comunes: ${negocio.objeciones}\n`;
    if (negocio.proceso_venta) context += `Proceso de venta: ${negocio.proceso_venta}\n`;
    if (negocio.final_expense) context += `Final Expense: ${negocio.final_expense}\n`;
    if (negocio.contacto) context += `Contacto: ${negocio.contacto}\n`;
    if (negocio.urls) context += `URLs: ${negocio.urls}\n`;
    if (negocio.redes) context += `Redes: ${negocio.redes}\n`;
  } else {
    context += `Negocio: ${negocioName}\n`;
    context += `NOTA: Evalua este creativo usando UNICAMENTE la base de conocimiento del admin para este negocio. No apliques reglas de otros negocios.\n`;
  }

  // Only apply internal rubrics/StoryBrand for internal businesses
  if (isInternal) {
    context += `\n${STORYBRAND_HISPANO}\n`;

    if (tipo === 'video') {
      context += `\n${RUBRICA_VIDEO}\n`;
      context += `\n${TIPOS_VIDEO}\n`;
    } else if (tipo === 'imagen' || tipo === 'plantilla') {
      context += `\n${RUBRICA_IMAGEN}\n`;
    } else if (tipo === 'email') {
      context += `\n${RUBRICA_EMAIL}\n`;
    } else if (tipo === 'presentacion') {
      context += `\n${RUBRICA_PRESENTACION}\n`;
    } else if (tipo === 'sms') {
      context += `\n${RUBRICA_SMS}\n`;
    } else if (tipo === 'whatsapp') {
      context += `\n${RUBRICA_WHATSAPP}\n`;
    }

    if (objetivo && CRITERIOS_POR_OBJETIVO[objetivo]) {
      context += `\n${CRITERIOS_POR_OBJETIVO[objetivo]}\n`;
    }
  }

  // Load admin-created KB entries from database
  // Filter by negocio AND categoria (maps objetivo/tipo to relevant KB categories)
  if (pool) {
    try {
      // Map submission context to relevant KB categories
      const relevantCategorias = ['general'];
      if (objetivo) relevantCategorias.push(objetivo); // leads, reclutamiento, etc.
      if (tipo === 'video') relevantCategorias.push('video_ads');
      if (tipo === 'imagen' || tipo === 'plantilla') relevantCategorias.push('imagen_ads');
      if (tipo === 'email') relevantCategorias.push('email_marketing');
      relevantCategorias.push('copies'); // copies always relevant

      // Internal businesses get their KB + global entries
      // External businesses get ONLY their own KB entries (strict isolation)
      let kbResult;
      if (isInternal) {
        kbResult = await pool.query(
          `SELECT titulo, tipo, contenido, categoria FROM knowledge_base
           WHERE (negocio IS NULL OR negocio = '' OR negocio = $1)
           AND (categoria IS NULL OR categoria = '' OR categoria = 'general' OR categoria = ANY($2))
           ORDER BY updated_at DESC`,
          [negocioName, relevantCategorias]
        );
      } else {
        kbResult = await pool.query(
          `SELECT titulo, tipo, contenido, categoria FROM knowledge_base
           WHERE negocio = $1
           ORDER BY updated_at DESC`,
          [negocioName]
        );
      }
      if (kbResult.rows.length > 0) {
        context += `\n\nREGLAS ADICIONALES DEL ADMIN (Base de Conocimiento):\n`;
        for (const entry of kbResult.rows) {
          context += `\n[${entry.titulo}] (${entry.tipo}${entry.categoria ? ', ' + entry.categoria : ''}):\n${entry.contenido}\n`;
        }
      }
    } catch (err) {
      console.error(`[KB] Error loading from database: ${err.message}`);
    }
  }

  context += `\nINSTRUCCIONES FINALES:`;
  context += `\n- Evalua usando LA RUBRICA DEL TIPO (${tipo}) Y LOS CRITERIOS DEL OBJETIVO (${objetivo || 'general'}).`;
  context += `\n- Aplica TODAS las reglas adicionales del admin que aparecen arriba.`;
  context += `\n- Cada fortaleza y problema debe ser ESPECIFICO al creativo, no generico.`;
  context += `\n- Cada recomendacion debe incluir QUE cambiar y COMO cambiarlo concretamente.`;
  context += `\n- Verifica que el creativo respete el tono, la audiencia y las reglas visuales del negocio ${negocioName}.`;
  context += `\n- Penaliza si usa palabras prohibidas del negocio o no se alinea con StoryBrand.`;
  context += `\n- Se estricto pero constructivo. El disenador necesita saber EXACTAMENTE que mejorar.\n`;

  // Load auto-learnings from previous evaluations
  try {
    const { getLearnings } = require('./learning');
    const learnings = await getLearnings(pool, negocioName, tipo, submission.objetivo);
    if (learnings) context += learnings;
  } catch (e) {
    // Learning module failure should not break evaluation
  }

  return context;
}

module.exports = { buildKnowledgeContext, NEGOCIOS };
