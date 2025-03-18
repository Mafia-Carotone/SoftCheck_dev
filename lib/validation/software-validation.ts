// Enumeración para identificar los estados de las preguntas
export enum QuestionState {
  PRIVACY_POLICY = 0,
  CERTIFICACIONES_SEC = 1,
  VULNERABILIDADES_ACTIVAS = 2,
  QUIEN_LO_DESARROLLA = 3,
  FRECUENCIA_UPDATE = 4,
  VULNERABILIDADES_ANTIGUAS = 5,
  VERSIONES_TROYANIZADAS = 6,
  RESULT = 7
}

// Interfaz para definir la estructura de una pregunta de validación
export interface ValidationQuestion {
  id: QuestionState;
  question: string;
  options: { value: string; label: string }[];
  criticalForApproval?: boolean;
}

// Preguntas de validación para evaluar el software
export const validationQuestions: ValidationQuestion[] = [
  {
    id: QuestionState.PRIVACY_POLICY,
    question: '¿El software cuenta con una política de privacidad clara que protege los datos de la empresa?',
    options: [
      { value: 'yes', label: 'Sí' },
      { value: 'no', label: 'No' },
      { value: 'unknown', label: 'No se sabe' }
    ],
    criticalForApproval: true
  },
  {
    id: QuestionState.CERTIFICACIONES_SEC,
    question: '¿El software cuenta con certificaciones de seguridad reconocidas?',
    options: [
      { value: 'yes', label: 'Sí' },
      { value: 'no', label: 'No' },
      { value: 'unknown', label: 'No se sabe' }
    ]
  },
  {
    id: QuestionState.VULNERABILIDADES_ACTIVAS,
    question: '¿Tiene vulnerabilidades activas conocidas?',
    options: [
      { value: 'yes', label: 'Sí' },
      { value: 'no', label: 'No' },
      { value: 'unknown', label: 'No se sabe' }
    ],
    criticalForApproval: true
  },
  {
    id: QuestionState.QUIEN_LO_DESARROLLA,
    question: '¿Quién desarrolla el software?',
    options: [
      { value: 'major_company', label: 'Empresa reconocida' },
      { value: 'small_company', label: 'Pequeña empresa' },
      { value: 'individual', label: 'Desarrollador individual' },
      { value: 'unknown', label: 'Desconocido' }
    ]
  },
  {
    id: QuestionState.FRECUENCIA_UPDATE,
    question: '¿Con qué frecuencia se actualiza?',
    options: [
      { value: 'very_frequent', label: 'Muy frecuentemente' },
      { value: 'regular', label: 'Regularmente' },
      { value: 'rarely', label: 'Rara vez' },
      { value: 'abandoned', label: 'Parece abandonado' },
      { value: 'unknown', label: 'No se sabe' }
    ]
  },
  {
    id: QuestionState.VULNERABILIDADES_ANTIGUAS,
    question: '¿Tiene historial de vulnerabilidades que fueron parcheadas rápidamente?',
    options: [
      { value: 'yes', label: 'Sí' },
      { value: 'no', label: 'No' },
      { value: 'unknown', label: 'No se sabe' }
    ]
  },
  {
    id: QuestionState.VERSIONES_TROYANIZADAS,
    question: '¿Hay reportes de versiones troyanizadas o maliciosas?',
    options: [
      { value: 'yes', label: 'Sí' },
      { value: 'no', label: 'No' },
      { value: 'unknown', label: 'No se sabe' }
    ],
    criticalForApproval: true
  }
];

/**
 * Determina si un software debe ser aprobado basado en las respuestas de validación
 * @param answers Respuestas de validación
 * @returns true si el software debe ser aprobado, false si debe ser rechazado
 */
export const obtenerValorAprobacion = (answers: Record<string, string>): boolean => {
  // Criterios críticos que provocan rechazo automático
  if (answers[QuestionState.PRIVACY_POLICY] === 'no') return false;
  if (answers[QuestionState.VULNERABILIDADES_ACTIVAS] === 'yes') return false;
  if (answers[QuestionState.VERSIONES_TROYANIZADAS] === 'yes') return false;
  
  // Criterios que sumados pueden provocar rechazo
  let riskScore = 0;
  
  // Quien lo desarrolla
  if (answers[QuestionState.QUIEN_LO_DESARROLLA] === 'unknown') riskScore += 3;
  else if (answers[QuestionState.QUIEN_LO_DESARROLLA] === 'individual') riskScore += 2;
  else if (answers[QuestionState.QUIEN_LO_DESARROLLA] === 'small_company') riskScore += 1;
  
  // Frecuencia de actualización
  if (answers[QuestionState.FRECUENCIA_UPDATE] === 'abandoned') riskScore += 3;
  else if (answers[QuestionState.FRECUENCIA_UPDATE] === 'rarely') riskScore += 2;
  else if (answers[QuestionState.FRECUENCIA_UPDATE] === 'unknown') riskScore += 1;
  
  // Certificaciones
  if (answers[QuestionState.CERTIFICACIONES_SEC] === 'no') riskScore += 1;
  
  // Vulnerabilidades antiguas
  if (answers[QuestionState.VULNERABILIDADES_ANTIGUAS] === 'no') riskScore += 2;
  
  // Si el riesgo es muy alto, rechazar
  return riskScore < 5;
}; 