import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Endpoint simple para verificar si el servidor está disponible
 * No requiere autenticación, DB u otros servicios
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Habilitar CORS para la extensión
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Responder inmediatamente a OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Solo permitir GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  
  // Responder con texto plano simple
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send('pong');
} 