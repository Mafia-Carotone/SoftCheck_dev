import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

import packageInfo from '../../package.json';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Habilitar CORS para la extensión
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Responder inmediatamente a las solicitudes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      await prisma.$queryRaw`SELECT 1`;

      res.status(200).json({
        version: packageInfo.version,
        status: 'ok',
        message: 'SoftCheck API está en funcionamiento',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      const { statusCode = 503 } = err;
      res.status(statusCode).json({});
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
