import { Error, Loading } from '@/components/shared';
import { Software } from '@prisma/client';
import useCanAccess from 'hooks/useCanAccess';
import useSoftwareList from 'hooks/useSoftwareList';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { Button } from 'react-daisyui';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Table } from '@/components/shared/table/Table';
import ConfirmationDialog from '../../../components/shared/ConfirmationDialog';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import * as XLSX from 'xlsx';

const SoftwareTable = () => {
  const router = useRouter();
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

    const teamSlug = router.query.slug as string;
    try {
      console.log('Attempting to delete software:', { id: software.id, teamSlug }); // Debugging

      const response = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/software`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: software.id })
      });

      console.log('Delete response:', response.status); // Debugging

      if (!response.ok) {
        const json = await response.json();
        throw Error(json.error?.message || 'Error al eliminar el software');
      }

      mutateSoftwareList();
      toast.success(t('software-deleted'));
      setConfirmationDialogVisible(false);
    } catch (error: any) {
      console.error('Error deleting software:', error);
      toast.error(error.message || 'Error al eliminar el software');
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(softwareList.map(software => ({
      Name: software.softwareName,
      'Windows EXE': software.windowsEXE || '-',
      'MacOS EXE': software.macosEXE || '-',
      Version: software.version,
      Approved: software.approved ? t('yes') : t('no'),
      'Approval Date': new Date(software.approvalDate).toLocaleDateString(),
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved Software');
    XLSX.writeFile(workbook, 'approved_software.xlsx');
  };

  const cols = [
    t('name'),
    t('windows-exe'),
    t('macos-exe'),
    t('version'),
    t('approved'),
    t('approval-date'),
  ];

  if (canAccess('team_software', ['delete'])) {
    cols.push(t('actions'));
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium leading-none tracking-tight">{t('software-database')}</h2>
        <Button className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 py-2 px-4" onClick={downloadExcel}>
          {t('download-excel')}
        </Button>
      </div>
      <Table
        cols={cols}
        body={softwareList.map((software) => ({
          id: software.id,
          cells: [
            { text: software.softwareName, wrap: true },
            { text: software.windowsEXE || '-', wrap: true },
            { text: software.macosEXE || '-', wrap: true },
            { text: software.version, wrap: true },
            { text: software.approved ? t('yes') : t('no'), wrap: true },
            { text: new Date(software.approvalDate).toLocaleDateString(), wrap: true },
            ...(canAccess('team_software', ['delete'])
              ? [{
                  buttons: [
                    {
                      color: 'error',
                      text: t('remove'),
                      onClick: () => {
                        setSelectedSoftware(software);
                        setConfirmationDialogVisible(true);
                      },
                    },
                  ],
                }]
              : []),
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

export async function getServerSideProps({
  locale,
}: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default SoftwareTable;