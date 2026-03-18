// Base de conocimiento del Grupo TreboLife / MagneTraffic
// Integrado del documento: sistema_evaluacion_video_trebolife.docx v2.0

const NEGOCIOS = {
  TrebolLife: {
    descripcion: 'Membresia de descuentos de salud (NO es seguro). Operado por FFL Insurance LLC / MagneTraffic. Administrado por Careington International Corporation (45+ anos, 30M+ miembros). Disponible en 47 estados (excepto Vermont, Washington, Utah). Activacion inmediata, sin periodo de espera, sin SSN, sin contrato.',
    audiencia: 'Comunidad hispana/latina en EE.UU. Segmentos: Familia joven (25-35) -> Safe $24.99. Profesional sin seguro (35-50) -> Health Plus $29.99. Adulto mayor (50+) -> Health Plus. Estudiante (18-25) -> Dental $14.99. Tambien distribuidores independientes que buscan ingresos extra.',
    tono: 'Cercano, empoderador, profesional, familiar. StoryBrand: el CLIENTE es el heroe, TreboLife es el GUIA. Emocion primero, datos despues. NUNCA decir "seguro" o "insurance" o "cobertura medica" - SIEMPRE decir "membresia de descuentos de salud".',
    productos: 'Trebol Dental ($14.99/mes ind, $29.99 familia): dental Careington +100K dentistas, Vision VSP +40K, Farmacia GetMoreRx hasta 95% desc. Trebol Safe ($24.99/mes ind, $39.99 familia, MAS POPULAR): todo Dental + DialCare telemedicina 24/7 $0/consulta ilimitada + DirectLabs +3000 labs 10-80% desc. Trebol Health Plus ($29.99/mes ind, $44.99 familia): todo Safe + medico primario virtual para condiciones cronicas. Todos: $30 activacion, garantia 30 dias, familia hasta 7 personas.',
    diferenciador: 'Sin SSN requerido, activacion inmediata, sin periodo de espera, sin restriccion condiciones preexistentes, sin verificacion credito, familia incluida, servicio en espanol, telemedicina 24/7/365, respaldado por Careington (45+ anos). Ahorro: dental $300-800/ano, telemedicina vs ER $65 vs $400+, labs 10-80%, medicinas genericas hasta 95%.',
    visual: 'Colores: verde oscuro #1A6E3E (fondos hero, CTA), verde medio #2D9E5F (iconos), verde claro #E8F5EE, crema #FFFCF5, dorado #D4A017 (badges Best Value). Imagenes: estilo 3D Pixar/Disney, personajes hispanos (piel morena/oliva, pelo oscuro), escenas domesticas y emocionales, iluminacion calida. PROHIBIDO: familias no-hispanas, fondos blancos de estudio, logos de seguros, azul/rojo dominante.',
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
    descripcion: 'Final Expense / Gastos finales. Seguros de vida para gastos funerarios dirigidos a la comunidad hispana.',
    audiencia: 'Personas mayores hispanas, familias latinas en EE.UU.',
    tono: 'Empatico, respetuoso, familiar, sin ser morboso',
    productos: 'Polizas de gastos finales, seguros de vida asequibles',
    diferenciador: 'Atencion en espanol, comprension cultural del tema de la muerte en la cultura latina'
  },
  Dental: {
    descripcion: 'Planes dentales accesibles para la comunidad hispana. Cobertura dental sin seguro medico completo.',
    audiencia: 'Familias hispanas sin seguro dental, trabajadores independientes',
    tono: 'Accesible, amigable, enfocado en ahorro',
    productos: 'Planes dentales desde $19.95/mes, cobertura familiar',
    diferenciador: 'Precio accesible, sin periodos de espera, atencion en espanol'
  },
  Salud: {
    descripcion: 'Seguros de salud ACA/Obamacare y planes complementarios para la comunidad hispana.',
    audiencia: 'Familias hispanas, individuos sin seguro medico',
    tono: 'Informativo, tranquilizador, profesional',
    productos: 'Planes ACA, seguros complementarios, telemedicina',
    diferenciador: 'Asesoria en espanol, ayuda con subsidios, proceso simplificado'
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

// Build context for AI based on submission
function buildKnowledgeContext(submission) {
  const negocio = NEGOCIOS[submission.negocio] || NEGOCIOS['TrebolLife'];
  const negocioName = submission.negocio || 'TrebolLife';

  let context = `\n\nBASE DE CONOCIMIENTO DEL NEGOCIO:\n`;
  context += `Negocio: ${negocioName}\n`;
  context += `Descripcion: ${negocio.descripcion}\n`;
  context += `Audiencia objetivo: ${negocio.audiencia}\n`;
  context += `Tono de marca: ${negocio.tono}\n`;
  context += `Productos/servicios: ${negocio.productos}\n`;
  context += `Diferenciador clave: ${negocio.diferenciador}\n`;
  context += `\n${STORYBRAND_HISPANO}\n`;

  if (submission.tipo === 'video') {
    context += `\n${RUBRICA_VIDEO}\n`;
    context += `\n${TIPOS_VIDEO}\n`;
  }

  context += `\nEvalua este creativo considerando TODO el contexto del negocio, la audiencia, el tono de marca y la metodologia StoryBrand adaptada para hispanos. Se estricto pero constructivo. Cada critica debe venir con una sugerencia concreta de mejora.\n`;

  return context;
}

module.exports = { buildKnowledgeContext, NEGOCIOS };
