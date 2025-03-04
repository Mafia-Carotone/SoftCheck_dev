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

  const removeSoftware = async (software: Software | null) => {
    if (!software) return;

    const response = await fetch(`/api/software/${software.id}`, {
      method: 'DELETE',
    });

    const json = await response.json();

    if (!response.ok) {
      toast.error(json.error.message);
      return;
    }

    mutateSoftwareList();
    toast.success('software-deleted');
  };

  const cols = [
    'Software Name',
    'windows-exe',
    'macos-exe',
    'version',
    'approval-date',
  ];

  if (canAccess('team_software', ['delete'])) {
    cols.push('actions');
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-medium leading-none tracking-tight">{t('software-list')}</h2>

      <Table
        cols={cols}
        body={softwareList.map((software) => ({
          id: software.id,
          cells: [
            { text: software.softwareName, wrap: true },
            { text: software.windowsEXE || '-', wrap: true },
            { text: software.macosEXE || '-', wrap: true },
            { text: software.version, wrap: true },
            { text: new Date(software.approvalDate).toLocaleDateString(), wrap: true },
            {
              buttons: canAccess('team_software', ['delete'])
                ? [
                    {
                      color: 'error',
                      text: 'remove',
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
        title={'confirm-delete-software'}
      >
        {t('delete-software-warning', {
          name: selectedSoftware?.softwareName,
        })}
      </ConfirmationDialog>
    </div>
  );
};

export default SoftwareTable;
