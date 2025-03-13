import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/errors';
import { authOptions } from '../auth/[...nextauth]';

// Endpoint para generar o regenerar la API key del usuario autenticado
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      throw new ApiError(401, 'No autenticado');
    }

    const userId = session.user.id;

    if (req.method === 'GET') {
      // Obtener la API key actual si existe
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { apiKey: true }
      });

      return res.status(200).json({
        apiKey: user?.apiKey || null,
        hasApiKey: !!user?.apiKey
      });
    } 
    else if (req.method === 'POST') {
      // Generar una nueva API key
      const apiKey = `sk_${randomBytes(24).toString('hex')}`;

      // Guardar en la base de datos
      await prisma.user.update({
        where: { id: userId },
        data: { apiKey }
      });

      return res.status(200).json({ apiKey });
    }
    else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error handling API key request:', error);
    
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { message: error.message } });
      return;
    }
    
    res.status(500).json({ error: { message: error.message || 'Error interno del servidor' } });
  }
} 