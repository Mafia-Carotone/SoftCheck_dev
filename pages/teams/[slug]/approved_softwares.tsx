import { Error, Loading } from '@/components/shared';
import { Software } from '@prisma/client';
import useCanAccess from 'hooks/useCanAccess';
import useSoftwareList from 'hooks/useSoftwareList';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { Button } from 'react-daisyui';
import toast from 'react-hot-toast';

import { useState } from 'react';
import { Table } from '@/components/shared/table/Table';
import ConfirmationDialog from '../../../components/shared/ConfirmationDialog';
import { slug } from '@/lib/zod/primitives';

// Definimos la interfaz para el formato específico de tu JSON
interface SoftwareResponse {
  data: Software[];
}

const SoftwareTable = () => {
  const { data: session } = useSession();
  const { t } = useTranslation('common');
  const { canAccess } = useCanAccess();

  const [confirmationDialogVisible, setConfirmationDialogVisible] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);

  const { isLoading, isError, softwareList, mutateSoftwareList } = useSoftwareList();

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Error message={isError.message} />;
  }

  if (!softwareList) {
    return null;
  }

  // Asegúrate de que softwareList contenga los datos correctos
  // Si useSoftwareList no está adaptado para manejar el formato {data: [...]}
  // puedes modificar esta parte o modificar el hook

  // Ejemplo de cómo podrías manejar el formato JSON si viene directo:
  // const actualSoftwareList = softwareList.data  softwareList;

  const removeSoftware = async (software: Software | null) => {
    if (!software) return;

    const response = await fetch(`/api/teams/${slug}/softwaresoftware/${software.id}`, {
      method: 'DELETE',
    });

    const json = await response.json();

    if (!response.ok) {
      toast.error(json.error.message);
      return;
    }

    mutateSoftwareList();
    toast.success(t('software-deleted'));
  };

  const cols = [
    t('Software-Name'),
    t('windows-exe'),
    t('macos-exe'),
    t('version'),
    t('approval-date'),
  ];

  if (canAccess('team_software', ['delete'])) {
    cols.push(t('actions'));
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-medium leading-none tracking-tight">{t('Software Database')}</h2>

      <Table
        cols={cols}
        body={softwareList.map((software) => ({
          id: software.id,
          cells: [
            { text: software.softwareName, wrap: true },
            { text: software.windowsEXE || '-', wrap: true },
            { text: software.macosEXE || '-', wrap: true },
            { text: software.version, wrap: true },
            { 
              text: new Date(software.approvalDate).toLocaleDateString(), 
              wrap: true 
            },
            {
              buttons: canAccess('team_software', ['delete'])
                ? [
                    {
                      color: 'error',
                      text: t('remove'),
                      onClick: () => {
                        setSelectedSoftware(software);
                        setConfirmationDialogVisible(true);
                      },
                    },
                  ]
                : [],
            },
          ],
        }))}
      />

      <ConfirmationDialog
        visible={confirmationDialogVisible}
        onCancel={() => setConfirmationDialogVisible(false)}
        onConfirm={() => removeSoftware(selectedSoftware)}
        title={t('confirm-delete-software')}
      >
        {t('delete-software-warning', {
          name: selectedSoftware?.softwareName,
        })}
      </ConfirmationDialog>
    </div>
  );
};

export default SoftwareTable;