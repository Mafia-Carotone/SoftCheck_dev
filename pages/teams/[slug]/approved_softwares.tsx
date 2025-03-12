import { Error, Loading } from '@/components/shared';
import { Software } from '@prisma/client';
import useCanAccess from 'hooks/useCanAccess';
import useSoftwareList from 'hooks/useSoftwareList';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { Button, Modal, Form, Input, Checkbox } from 'react-daisyui';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Table } from '@/components/shared/table/Table';
import ConfirmationDialog from '../../../components/shared/ConfirmationDialog';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import * as XLSX from 'xlsx';
import * as Yup from 'yup';
import { Formik } from 'formik';

const SoftwareTable = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation('common');
  const { canAccess } = useCanAccess();

  const [confirmationDialogVisible, setConfirmationDialogVisible] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);
  const [addSoftwareModalVisible, setAddSoftwareModalVisible] = useState(false);

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

  const addSoftware = async (values: any) => {
    const teamSlug = router.query.slug as string;
    try {
      // Generar un ID único
      const id = `SW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/software`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...values,
          id
        })
      });

      if (!response.ok) {
        const json = await response.json();
        throw Error(json.error?.message || 'Error al añadir el software');
      }

      mutateSoftwareList();
      toast.success(t('software-added'));
      setAddSoftwareModalVisible(false);
    } catch (error: any) {
      console.error('Error adding software:', error);
      toast.error(error.message || 'Error al añadir el software');
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

  // Validation schema for the form
  const SoftwareSchema = Yup.object().shape({
    softwareName: Yup.string().required(t('name-required')),
    windowsEXE: Yup.string(),
    macosEXE: Yup.string(),
    version: Yup.string().required(t('version-required')),
    approved: Yup.boolean(),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium leading-none tracking-tight">{t('software-database')}</h2>
        <div className="flex space-x-2">
          {canAccess('team_software', ['create']) && (
            <Button 
              className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 py-2 px-4" 
              onClick={() => setAddSoftwareModalVisible(true)}
            >
              {t('add-software')}
            </Button>
          )}
          <Button 
            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 py-2 px-4" 
            onClick={downloadExcel}
          >
            {t('download-excel')}
          </Button>
        </div>
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

      {/* Confirmation Dialog for Deletion */}
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

      {/* Modal for Adding New Software */}
      <Modal open={addSoftwareModalVisible}>
        <Button 
          className="absolute right-2 top-2" 
          size="sm" 
          shape="circle" 
          onClick={() => setAddSoftwareModalVisible(false)}
        >
          ✕
        </Button>
        <Modal.Header>
          <h3 className="font-bold text-lg">{t('add-new-software')}</h3>
        </Modal.Header>
        <Formik
          initialValues={{
            softwareName: '',
            windowsEXE: '',
            macosEXE: '',
            version: '',
            approved: true,
          }}
          validationSchema={SoftwareSchema}
          onSubmit={addSoftware}
        >
          {({
            values,
            errors,
            touched,
            handleChange,
            handleBlur,
            handleSubmit,
            isSubmitting,
          }) => (
            <form onSubmit={handleSubmit}>
              <Modal.Body>
                <div className="space-y-4">
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">{t('name')}</span>
                    </label>
                    <input
                      type="text"
                      name="softwareName"
                      className={`input input-bordered w-full ${
                        errors.softwareName && touched.softwareName ? 'input-error' : ''
                      }`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.softwareName}
                    />
                    {errors.softwareName && touched.softwareName && (
                      <label className="label">
                        <span className="label-text-alt text-error">{errors.softwareName}</span>
                      </label>
                    )}
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">{t('windows-exe')}</span>
                    </label>
                    <input
                      type="text"
                      name="windowsEXE"
                      className="input input-bordered w-full"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.windowsEXE}
                    />
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">{t('macos-exe')}</span>
                    </label>
                    <input
                      type="text"
                      name="macosEXE"
                      className="input input-bordered w-full"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.macosEXE}
                    />
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">{t('version')}</span>
                    </label>
                    <input
                      type="text"
                      name="version"
                      className={`input input-bordered w-full ${
                        errors.version && touched.version ? 'input-error' : ''
                      }`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.version}
                    />
                    {errors.version && touched.version && (
                      <label className="label">
                        <span className="label-text-alt text-error">{errors.version}</span>
                      </label>
                    )}
                  </div>

                  <div className="form-control">
                    <label className="label cursor-pointer">
                      <span className="label-text">{t('approved')}</span>
                      <input
                        type="checkbox"
                        name="approved"
                        className="toggle toggle-primary"
                        onChange={handleChange}
                        checked={values.approved}
                      />
                    </label>
                  </div>
                </div>
              </Modal.Body>
              <Modal.Actions>
                <Button 
                  onClick={() => setAddSoftwareModalVisible(false)} 
                  color="ghost"
                >
                  {t('cancel')}
                </Button>
                <Button 
                  type="submit" 
                  color="primary" 
                  loading={isSubmitting}
                >
                  {t('save')}
                </Button>
              </Modal.Actions>
            </form>
          )}
        </Formik>
      </Modal>
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