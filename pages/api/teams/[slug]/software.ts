import { ApiError } from '@/lib/errors';
import { sendAudit } from '@/lib/retraced';
import { getAllSoftware, deleteSoftware, updateSoftware } from 'models/software';
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteSoftwareSchema, validateWithSchema } from '@/lib/zod';
import { softwareSchema, updateSoftwareSchema } from '@/lib/schemas';
import { recordMetric } from '@/lib/metrics';
import { validateMembershipOperation } from '@/lib/rbac';
import { sendEvent } from '@/lib/svix';
import { throwIfNoTeamAccess, removeTeamMember } from 'models/team';
import { throwIfNotAllowed } from 'models/user';

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

// Get all software entries.
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const softwareList = await getAllSoftware();

  res.status(200).json({ data: softwareList });
};

// Create a software entry
const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const { teamId, softwareName, windowsEXE, macosEXE, version, approvalDate } = req.body;

  if (!teamId || !softwareName || !version) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const newSoftware = await prisma.software.create({
      data: {
        teamId,
        softwareName,
        windowsEXE: windowsEXE || null,
        macosEXE: macosEXE || null,
        version,
        approvalDate: approvalDate ? new Date(approvalDate) : new Date(),
      },
    });

    res.status(201).json(newSoftware);
  } catch (error) {
    console.error('Error al crear software:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Delete a software entry
const handleDELETE_antiguo = async (req: NextApiRequest, res: NextApiResponse) => {
  const { id } = validateWithSchema(softwareSchema, req.query as { id: string });

  await deleteSoftware(id);

  res.status(200).json({ data: {} });
};

// Delete the software from a team.
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const teamMember = await throwIfNoTeamAccess(req, res);
  throwIfNotAllowed(softwareSchema, 'softwareName', 'delete');

  const { memberId } = validateWithSchema(
    deleteMemberSchema,
    req.query as { memberId: string }
  );

  await validateMembershipOperation(memberId, teamMember);

  const teamMemberRemoved = await removeTeamMember(teamMember.teamId, memberId);

  await sendEvent(teamMember.teamId, 'member.removed', teamMemberRemoved);

  sendAudit({
    action: 'member.remove',
    crud: 'd',
    user: teamMember.user,
    team: teamMember.team,
  });

  recordMetric('member.removed');

  res.status(200).json({ data: {} });
};

// Update a software entry
const handlePATCH = async (req: NextApiRequest, res: NextApiResponse) => {
  const { id, ...updateData } = validateWithSchema(updateSoftwareSchema, req.body);

  const updatedSoftware = await updateSoftware(id, updateData);

  res.status(200).json({ data: updatedSoftware });
};
