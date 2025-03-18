import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/errors';
import type { Software } from '@prisma/client';

// Crear un nuevo registro de software
export const createSoftware = async (params: {
  id: string;
  teamId: string;
  userId: string;
  softwareName: string;
  status?: string;
  launcher?: string | null;
  version?: string | null;
  fileSize?: number | null;
  downloadSource?: string | null;
  sha256?: string | null;
  md5?: string | null;
  requestedBy?: string | null;
  answers?: Record<string, string>;
}): Promise<Software> => {
  const { 
    id, 
    teamId, 
    userId,
    softwareName, 
    status = 'pending', 
    launcher, 
    version, 
    fileSize, 
    downloadSource, 
    sha256, 
    md5, 
    requestedBy,
    answers 
  } = params;

  if (!teamId) {
    throw new ApiError(400, 'El ID del equipo es obligatorio');
  }

  if (!userId) {
    throw new ApiError(400, 'El ID del usuario es obligatorio');
  }

  try {
    // Verificar si el equipo existe
    const team = await prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team) {
      throw new ApiError(404, 'El equipo no existe');
    }

    // Verificar si el usuario existe
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ApiError(404, 'El usuario no existe');
    }

    // Crear el software
    return await prisma.software.create({
      data: {
        id,
        teamId,
        userId,
        softwareName,
        status,
        launcher: launcher || null,
        version: version || null,
        fileSize: fileSize || null,
        downloadSource: downloadSource || null,
        sha256: sha256 || null,
        md5: md5 || null,
        requestedBy: requestedBy || null,
        answers: answers || {},
      },
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error.code === 'P2002') {
      throw new ApiError(409, 'Ya existe un software con ese ID para este equipo');
    }
    if (error.code === 'P2003') {
      throw new ApiError(400, 'El ID proporcionado no es válido');
    }
    throw new ApiError(500, 'Error al crear el software en la base de datos');
  }
};

// Eliminar un software por ID
export const deleteSoftware = async (id: string, teamId: string): Promise<void> => {
  try {
    // Verificar que el software existe y pertenece al equipo
    const software = await prisma.software.findFirst({
      where: {
        id,
        teamId
      }
    });

    if (!software) {
      throw new ApiError(404, 'Software no encontrado o no pertenece a este equipo');
    }

    // Eliminar el software
    await prisma.software.delete({
      where: {
        id
      }
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error al eliminar el software');
  }
};

// Actualizar un software por ID
export const updateSoftware = async (
  id: string,
  data: Partial<Software>
): Promise<Software> => {
  try {
    // Verificar que el software existe
    const existingSoftware = await prisma.software.findUnique({
      where: { id }
    });

    if (!existingSoftware) {
      throw new ApiError(404, 'Software no encontrado');
    }

    // Actualizar el software
    return await prisma.software.update({
      where: { id },
      data
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error al actualizar el software');
  }
};

// Aprobar un software
export const approveSoftware = async (id: string, userId: string): Promise<Software> => {
  return await prisma.software.update({
    where: { id },
    data: {
      status: 'approved',
      approvalDate: new Date(),
      userId
    }
  });
};

// Rechazar un software
export const denySoftware = async (id: string, userId: string): Promise<Software> => {
  return await prisma.software.update({
    where: { id },
    data: {
      status: 'rejected',
      denniedDate: new Date(),
      userId
    }
  });
};

// Obtener todos los registros de software
export const getAllSoftware = async (teamId: string): Promise<Software[]> => {
  return await prisma.software.findMany({
    where: {
      teamId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

// Obtener un software por ID
export const getSoftwareById = async (id: string): Promise<Software | null> => {
  return await prisma.software.findUnique({
    where: { id },
    include: {
      team: true,
      checkedBy: true
    }
  });
};

// Obtener software por estado
export const getSoftwareByStatus = async (teamId: string, status: string): Promise<Software[]> => {
  return await prisma.software.findMany({
    where: {
      teamId,
      status
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};
