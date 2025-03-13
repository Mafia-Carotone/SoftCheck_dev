import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../api_request';

/**
 * Este archivo es un proxy hacia el manejador principal api_request
 * para operaciones específicas sobre una solicitud (como eliminar).
 */
export default async function softwareRequestHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Simplemente redirige al manejador principal que procesará
  // la solicitud basándose en el método y parámetros
  return handler(req, res);
} 