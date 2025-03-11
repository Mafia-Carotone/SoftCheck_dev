import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/errors';
import type { Software } from '@prisma/client';

// Crear un nuevo registro de software
export const createSoftware = async (params: {
  id: string;
  teamId: string;
  softwareName: string;
  windowsEXE?: string | null;
  macosEXE?: string | null;
  version: string;
  answers?: Record<string, string>;
  approved?: boolean;
}): Promise<Software> => {
  const { id, teamId, softwareName, windowsEXE, macosEXE, version, answers, approved } = params;

  if (!teamId) {
    throw new ApiError(400, 'El ID del equipo es obligatorio');
  }

  try {
    // Verificar si el equipo existe
    const team = await prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team) {
      throw new ApiError(404, 'El equipo no existe');
    }

    // Crear el software
    return await prisma.software.create({
      data: {
        id,
        teamId,
        softwareName,
        windowsEXE: windowsEXE || null,
        macosEXE: macosEXE || null,
        version,
        approvalDate: new Date(),
        answers: answers || {},
        approved: approved || false,
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
      throw new ApiError(400, 'El ID del equipo proporcionado no es válido');
    }
    throw new ApiError(500, 'Error al crear el software en la base de datos');
  }
};

// Eliminar un software por ID
export const deleteSoftware = async (id: string): Promise<void> => {
  await prisma.software.delete({
    where: {
      id
    }
  });
};

// Actualizar un software por ID
export const updateSoftware = async (
  id: string,
  data: Partial<Software>
): Promise<Software> => {
  return await prisma.software.update({
    where: {
      id
    },
    data
  });
};

// Obtener todos los registros de software
export const getAllSoftware = async (teamId: string): Promise<Software[]> => {
  return await prisma.software.findMany({
    where: {
      teamId
    }
  });
};

// Obtener un software por ID
export const getSoftwareById = async (id: string): Promise<Software | null> => {
  return await prisma.software.findUnique({
    where: { id },
  });
};
