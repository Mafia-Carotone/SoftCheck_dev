import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions, sessionTokenCookieName } from '@/lib/nextAuth';
import { prisma } from '@/lib/prisma';
import { getCookie, deleteCookie } from 'cookies-next';
import env from '@/lib/env';
import { deleteSession } from 'models/session';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Intentar obtener la sesión pero no requerir que exista
    const authOptions = getAuthOptions(req, res);
    const session = await getServerSession(req, res, authOptions);

    // Si hay una sesión activa, eliminarla de la base de datos
    if (session?.user && env.nextAuth.sessionStrategy === 'database') {
      const sessionToken = await getCookie(sessionTokenCookieName, {
        req,
        res,
      });
      
      if (sessionToken) {
        const sessionDBEntry = await prisma.session.findFirst({
          where: {
            sessionToken: sessionToken,
          },
        });

        if (sessionDBEntry) {
          await deleteSession({
            where: {
              sessionToken: sessionToken,
            },
          });
        }
      }
    }

    // Lista de cookies a eliminar
    const cookiesToClear = [
      'next-auth.session-token',
      'next-auth.callback-url',
      'next-auth.csrf-token',
      '__Secure-next-auth.session-token',
      '__Secure-next-auth.callback-url',
      '__Secure-next-auth.csrf-token',
      '__Host-next-auth.csrf-token'
    ];

    // Eliminar cada cookie usando cookies-next
    cookiesToClear.forEach(cookieName => {
      deleteCookie(cookieName, { req, res, path: '/', sameSite: 'lax', secure: true });
      deleteCookie(`${cookieName}.sig`, { req, res, path: '/', sameSite: 'lax', secure: true });
    });

    // También eliminar usando Set-Cookie header como respaldo
    res.setHeader(
      'Set-Cookie',
      cookiesToClear.flatMap(cookieName => [
        `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; Secure; SameSite=Lax`,
        `${cookieName}.sig=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; Secure; SameSite=Lax`
      ])
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Signout error:', error);
    // Incluso si hay un error, intentar limpiar las cookies
    try {
      const cookiesToClear = [
        'next-auth.session-token',
        'next-auth.callback-url',
        'next-auth.csrf-token',
        '__Secure-next-auth.session-token',
        '__Secure-next-auth.callback-url',
        '__Secure-next-auth.csrf-token',
        '__Host-next-auth.csrf-token'
      ];

      cookiesToClear.forEach(cookieName => {
        deleteCookie(cookieName, { req, res, path: '/', sameSite: 'lax', secure: true });
        deleteCookie(`${cookieName}.sig`, { req, res, path: '/', sameSite: 'lax', secure: true });
      });
    } catch (e) {
      console.error('Error clearing cookies:', e);
    }
    
    return res.status(200).json({ success: true });
  }
}
