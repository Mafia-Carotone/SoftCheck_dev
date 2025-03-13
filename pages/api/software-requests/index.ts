import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../api_request';

/**
 * Este archivo es un proxy hacia el manejador principal api_request
 * para facilitar que la extensión encuentre la ruta correcta.
 */
export default async function softwareRequestsHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Simplemente redirige al manejador principal
  return handler(req, res);
} 