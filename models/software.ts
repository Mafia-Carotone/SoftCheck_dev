import { prisma } from '@/lib/prisma';
import { Software } from '@prisma/client';

// Crear un nuevo registro de software
export const createSoftware = async ({
  softwareName,
  windowsEXE,
  macosEXE,
  version,
  approvalDate,
}: {
  softwareName: string;
  windowsEXE: string;
  macosEXE: string;
  version: string;
  approvalDate: Date;
}): Promise<Software> => {
  return await prisma.software.create({
    data: {
      softwareName,
      windowsEXE,
      macosEXE,
      version,
      approvalDate,
    },
  });
};

// Eliminar un software por ID
export const deleteSoftware = async (id: string) => {
  return await prisma.software.delete({
    where: { id },
  });
};

// Actualizar un software por ID
export const updateSoftware = async (id: string, data: Partial<Software>) => {
  return await prisma.software.update({
    where: { id },
    data,
  });
};

// Obtener todos los registros de software
export const getAllSoftware = async (): Promise<Software[]> => {
  return await prisma.software.findMany();
};

// Obtener un software por ID
export const getSoftwareById = async (id: string): Promise<Software | null> => {
  return await prisma.software.findUnique({
    where: { id },
  });
};
