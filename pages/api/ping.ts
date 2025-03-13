import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Endpoint simple para verificar que la API está funcionando.
 * La extensión lo utiliza para comprobar la conexión.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo responder a solicitudes GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Método no permitido' } });
  }
  
  // Respuesta simple indicando que el servidor está activo
  res.status(200).json({ 
    status: 'ok',
    message: 'API running',
    timestamp: new Date().toISOString()
  });
} 