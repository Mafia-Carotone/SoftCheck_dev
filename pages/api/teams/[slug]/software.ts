import { ApiError } from '@/lib/errors';
import { sendAudit } from '@/lib/retraced';
import { createSoftware, getAllSoftware, deleteSoftware, updateSoftware, approveSoftware, denySoftware } from 'models/software';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createSoftwareSchema, validateWithSchema } from '@/lib/zod';
import { recordMetric } from '@/lib/metrics';
import { throwIfNoTeamAccess } from 'models/team';
import { getSession } from 'next-auth/react';

// Tipos personalizados para eventos y métricas de software
type SoftwareEventType = 'team_update' | 'team_invite' | 'team_member_role' | 'team_member_remove' | 'software_action';
type SoftwareMetricEvent = 'api_key.created' | 'api_key.deleted' | 'team.created' | 'team.deleted' | 'member.invited' | 'member.joined' | 'software_action';

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
    const { id, softwareName } = req.body;
    if (!id) {
      throw new ApiError(400, 'El ID del software es obligatorio');
    }
    if (!softwareName || typeof softwareName !== 'string' || !softwareName.trim()) {
      throw new ApiError(400, 'El nombre del software es obligatorio');
    }

    // Validate request body against schema and add teamId and userId
    const validatedData = validateWithSchema(createSoftwareSchema, {
      ...req.body,
      teamId: teamMember.teamId,
      userId: teamMember.userId
    });

    console.log("Validated data:", validatedData); // Debugging

    // Create the software
    const newSoftware = await createSoftware(validatedData);

    console.log("Created software:", newSoftware); // Debugging

    // Register audit - usando tipo genérico para evitar error
    await sendAudit({
      action: 'software_action' as SoftwareEventType,
      crud: 'c',
      user: teamMember.user,
      team: teamMember.team,
      target: { id: newSoftware.id, type: 'software' }
    });

    // Record metric - usando tipo genérico para evitar error
    await recordMetric('software_action' as SoftwareMetricEvent);

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
  try {
    const teamMember = await throwIfNoTeamAccess(req, res);
    
    if (!teamMember.teamId) {
      throw new ApiError(400, 'No se pudo determinar el ID del equipo');
    }

    // Obtener el ID del software del body
    const { id } = req.body;
    
    if (!id || typeof id !== 'string') {
      throw new ApiError(400, 'ID de software inválido o no proporcionado');
    }

    console.log('Deleting software:', { id, teamId: teamMember.teamId }); // Debugging

    await deleteSoftware(id, teamMember.teamId);
    
    await sendAudit({
      action: 'software_action' as SoftwareEventType,
      crud: 'd',
      user: teamMember.user,
      team: teamMember.team,
      target: { id, type: 'software' }
    });

    await recordMetric('software_action' as SoftwareMetricEvent);

    res.status(200).json({ data: {} });
  } catch (error: any) {
    console.error('Error in handleDELETE:', error); // Debugging
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { message: error.message } });
      return;
    }
    res.status(500).json({ error: { message: error.message || 'Error al eliminar el software' } });
  }
};

// Update a software entry
const handlePATCH = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const teamMember = await throwIfNoTeamAccess(req, res);
    
    // Intentar obtener el ID desde la query string o el body
    let id = req.query.id as string;
    if (!id && req.body.id) {
      id = req.body.id as string;
    }

    console.log('PATCH - Datos recibidos:', { id, bodyId: req.body.id, status: req.body.status });

    if (!id) {
      throw new ApiError(400, 'Se requiere un ID de software para la actualización');
    }

    if (typeof id !== 'string') {
      throw new ApiError(400, 'ID inválido');
    }

    // Si la solicitud incluye cambiar el status a approved, usamos la función específica
    if (req.body.status === 'approved') {
      console.log(`Aprobando software con ID: ${id}`);
      const updatedSoftware = await approveSoftware(id, teamMember.userId);
      
      await sendAudit({
        action: 'software_action' as SoftwareEventType,
        crud: 'u',
        user: teamMember.user,
        team: teamMember.team,
        target: { id, type: 'software' }
      });
      
      await recordMetric('software_action' as SoftwareMetricEvent);
      
      console.log('Software aprobado exitosamente:', updatedSoftware);
      res.status(200).json({ data: updatedSoftware });
      return;
    }
    
    // Si la solicitud incluye cambiar el status a denied (antes era rejected), usamos la función específica
    if (req.body.status === 'denied') {
      console.log(`Denegando software con ID: ${id}`);
      const updatedSoftware = await denySoftware(id, teamMember.userId);
      
      await sendAudit({
        action: 'software_action' as SoftwareEventType,
        crud: 'u',
        user: teamMember.user,
        team: teamMember.team,
        target: { id, type: 'software' }
      });
      
      await recordMetric('software_action' as SoftwareMetricEvent);
      
      console.log('Software denegado exitosamente:', updatedSoftware);
      res.status(200).json({ data: updatedSoftware });
      return;
    }

    // Para otras actualizaciones
    console.log(`Actualizando software con ID: ${id}, datos:`, req.body);
    const updatedSoftware = await updateSoftware(id, req.body);

    await sendAudit({
      action: 'software_action' as SoftwareEventType,
      crud: 'u',
      user: teamMember.user,
      team: teamMember.team,
      target: { id, type: 'software' }
    });

    await recordMetric('software_action' as SoftwareMetricEvent);

    console.log('Software actualizado exitosamente:', updatedSoftware);
    res.status(200).json({ data: updatedSoftware });
  } catch (error: any) {
    console.error('Error updating software:', error);
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { message: error.message } });
      return;
    }
    res.status(500).json({ error: { message: error.message || 'Error al actualizar el software' } });
  }
};
