import { z } from 'zod';

// Esquema para validar la eliminación de software
export const softwareSchema = z.object({
  id: z.string().uuid(),
});

// Esquema para validar la actualización de software
export const updateSoftwareSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  version: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});