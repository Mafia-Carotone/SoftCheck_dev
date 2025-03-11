import { ApiError } from '@/lib/errors';
import { sendAudit } from '@/lib/retraced';
import { createSoftware, getAllSoftware, deleteSoftware, updateSoftware } from 'models/software';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createSoftwareSchema, validateWithSchema } from '@/lib/zod';
import { recordMetric } from '@/lib/metrics';
import { throwIfNoTeamAccess } from 'models/team';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        await handleGET(req, res);
        break;
      case 'POST':
        await handlePOST(req, res);
        break;
      case 'DELETE':
        await handleDELETE(req, res);
        break;
      case 'PATCH':
        await handlePATCH(req, res);
        break;
      default:
        res.setHeader('Allow', 'GET, POST, DELETE, PATCH');
        res.status(405).json({ error: { message: `Method ${method} Not Allowed` } });
    }
  } catch (error: any) {
    const message = error.message || 'Something went wrong.';
    const status = error.status || 500;

    res.status(status).json({ error: { message } });
  }
}

// Get all software entries for a team
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const teamMember = await throwIfNoTeamAccess(req, res);
  const softwareList = await getAllSoftware(teamMember.teamId);
  res.status(200).json({ data: softwareList });
};

// Create a software entry
const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const teamMember = await throwIfNoTeamAccess(req, res);
    console.log("Team member:", teamMember); // Debugging
    console.log("Request body:", req.body); // Debugging

    if (!teamMember.teamId) {
      throw new ApiError(400, 'No se pudo determinar el ID del equipo');
    }

    // Verificar que el cuerpo de la solicitud no esté vacío
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new ApiError(400, 'El cuerpo de la solicitud está vacío');
    }

    // Verificar campos obligatorios manualmente
    const { id, softwareName, version } = req.body;
    if (!id) {
      throw new ApiError(400, 'El ID del software es obligatorio');
    }
    if (!softwareName || typeof softwareName !== 'string' || !softwareName.trim()) {
      throw new ApiError(400, 'El nombre del software es obligatorio');
    }
    if (!version || typeof version !== 'string' || !version.trim()) {
      throw new ApiError(400, 'La versión del software es obligatoria');
    }

    // Validate request body against schema and add teamId
    const validatedData = validateWithSchema(createSoftwareSchema, {
      ...req.body,
      teamId: teamMember.teamId, // Usar el teamId del miembro del equipo
      // Asegurar que los campos opcionales tengan valores por defecto
      windowsEXE: req.body.windowsEXE || null,
      macosEXE: req.body.macosEXE || null,
      answers: req.body.answers || {},
      approved: req.body.approved || false
    });

    console.log("Validated data:", validatedData); // Debugging

    // Create the software with teamId
    const newSoftware = await createSoftware({
      ...validatedData,
      teamId: teamMember.teamId // Asegurarnos de que el teamId se pasa correctamente
    });

    console.log("Created software:", newSoftware); // Debugging

    // Register audit
    await sendAudit({
      action: 'software.create',
      crud: 'c',
      user: teamMember.user,
      team: teamMember.team,
      target: { id: newSoftware.id, type: 'software' }
    });

    // Record metric
    await recordMetric('software.created');

    res.status(201).json({ data: newSoftware });
  } catch (error: any) {
    console.error('Error creating software:', error);
    
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { message: error.message } });
      return;
    }

    if (error.code === 'P2002') {
      res.status(409).json({ error: { message: 'Ya existe un software con ese ID para este equipo' } });
      return;
    }

    res.status(500).json({ error: { message: error.message || 'Error al crear el software en la base de datos' } });
  }
};

// Delete a software entry
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const teamMember = await throwIfNoTeamAccess(req, res);
  const { id } = req.query;

  if (typeof id !== 'string') {
    throw new ApiError(400, 'ID inválido');
  }

  await deleteSoftware(id);
  
  await sendAudit({
    action: 'software.delete',
    crud: 'd',
    user: teamMember.user,
    team: teamMember.team,
    target: { id, type: 'software' }
  });

  await recordMetric('software.deleted');

  res.status(200).json({ data: {} });
};

// Update a software entry
const handlePATCH = async (req: NextApiRequest, res: NextApiResponse) => {
  const teamMember = await throwIfNoTeamAccess(req, res);
  const { id } = req.query;

  if (typeof id !== 'string') {
    throw new ApiError(400, 'ID inválido');
  }

  const updatedSoftware = await updateSoftware(id, req.body);

  await sendAudit({
    action: 'software.update',
    crud: 'u',
    user: teamMember.user,
    team: teamMember.team,
    target: { id, type: 'software' }
  });

  await recordMetric('software.updated');

  res.status(200).json({ data: updatedSoftware });
};
