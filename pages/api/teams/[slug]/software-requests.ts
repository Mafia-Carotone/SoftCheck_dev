import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/errors';
import { sendAudit } from '@/lib/retraced';
import { recordMetric } from '@/lib/metrics';
import { throwIfNoTeamAccess } from 'models/team';
import { validateWithSchema, createSoftwareSchema } from '@/lib/zod';

// Correct the import for createSoftwareRequestSchema
const createSoftwareRequestSchema = createSoftwareSchema;

// ... existing code ...

// Move the handlePOST function declaration before its usage
const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const teamMember = await throwIfNoTeamAccess(req, res);

    if (!req.body || Object.keys(req.body).length === 0) {
      throw new ApiError(400, 'Request body is empty');
    }

    const { fileName, fileSize, fileUrl, downloadSource } = req.body;

    if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
      throw new ApiError(400, 'File name is required');
    }

    const validatedData = validateWithSchema(createSoftwareRequestSchema, {
      ...req.body,
      teamId: teamMember.teamId,
      userId: teamMember.user.id,
    });

    const newSoftwareRequest = await prisma.softwareRequest.create({
      data: {
        ...validatedData,
        teamId: teamMember.teamId,
        userId: teamMember.user.id,
        fileName, // Ensure fileName is included
      },
    });

    await sendAudit({
      action: 'software_request_created',
      crud: 'c',
      user: teamMember.user,
      team: teamMember.team,
      target: { id: newSoftwareRequest.id, type: 'software_request' },
    });

    await recordMetric('software_request_created');

    res.status(201).json({ data: newSoftwareRequest });
  } catch (error: any) {
    console.error('Error creating software request:', error);
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { message: error.message } });
      return;
    }
    res.status(500).json({ error: { message: error.message || 'Error creating software request' } });
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Habilitar CORS para la extensión
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Responder inmediatamente a las solicitudes OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Continuar con el resto del código
    switch (req.method) {
      case 'POST':
        await handlePOST(req, res);
        break;
      // ... existing code ...
      default:
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    res.status(500).json({ error: { message: error.message || 'Internal Server Error' } });
  }
}

// ... existing code ... 