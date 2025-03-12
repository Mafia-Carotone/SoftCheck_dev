import { Error, Loading } from '@/components/shared';
import { Software } from '@prisma/client';
import useCanAccess from 'hooks/useCanAccess';
import useSoftwareList from 'hooks/useSoftwareList';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { Button, Modal, Form, Input, Checkbox } from 'react-daisyui';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import { useState, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmationDialogVisible, setConfirmationDialogVisible] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);
  const [addSoftwareModalVisible, setAddSoftwareModalVisible] = useState(false);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingExcel(true);
      toast.loading(t('processing-excel'), { id: 'processing-excel' });
      
      // Leer el archivo Excel
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Obtener la primera hoja
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON
        const excelData = XLSX.utils.sheet_to_json(worksheet);
        
        if (!excelData || excelData.length === 0) {
          toast.error(t('excel-empty'), { id: 'processing-excel' });
          setIsProcessingExcel(false);
          return;
        }
        
        // Mostrar la estructura del primer elemento para depuración
        console.log('Excel first row structure:', excelData[0]);
        
        // Verificar si el Excel tiene columnas
        const firstRow = excelData[0] as any;
        const columnKeys = Object.keys(firstRow);
        
        if (columnKeys.length === 0) {
          console.error('Excel has no columns');
          toast.error(t('excel-no-columns'), { id: 'processing-excel' });
          setIsProcessingExcel(false);
          return;
        }
        
        console.log('Available columns in Excel:', columnKeys);
        
        // Buscar columnas que puedan contener nombres de software
        let processNameKey = columnKeys.find(key => 
          key.toLowerCase().includes('process.name') || 
          (key.toLowerCase().includes('process') && key.toLowerCase().includes('name'))
        );
        
        // Si no encuentra una columna de nombre, usa la primera columna disponible
        if (!processNameKey) {
          processNameKey = columnKeys[0];
          console.log('Using first column as software name:', processNameKey);
        }
        
        // Crear un mapa de software aprobado para búsqueda rápida
        const approvedSoftwareMap = new Map();
        softwareList.forEach(software => {
          approvedSoftwareMap.set(software.softwareName.toLowerCase(), software.approved);
        });
        
        // Agregar la columna "Approved"
        const processedData = excelData.map((row: any) => {
          const softwareName = row[processNameKey as string];
          const isApproved = softwareName && 
                           approvedSoftwareMap.has(String(softwareName).toLowerCase()) && 
                           approvedSoftwareMap.get(String(softwareName).toLowerCase());
          
          return {
            ...row,
            'Approved': isApproved ? t('yes') : t('no')
          };
        });
        
        // Crear un nuevo Excel con los datos procesados
        const newWorksheet = XLSX.utils.json_to_sheet(processedData);
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Processed Software');
        
        // Descargar el nuevo Excel
        XLSX.writeFile(newWorkbook, 'processed_software.xlsx');
        
        toast.success(t('excel-processed'), { id: 'processing-excel' });
        setIsProcessingExcel(false);
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error('Error processing Excel:', error);
      toast.error(error.message || t('excel-processing-error'), { id: 'processing-excel' });
      setIsProcessingExcel(false);
    }
    
    // Limpiar el input para permitir subir el mismo archivo nuevamente
    event.target.value = '';
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
        <h2 className="text-xl font-medium leading-none tracking-tight">{t('Software Database')}</h2>
        <div className="flex space-x-2">
          {canAccess('team_software', ['create']) && (
            <Button 
              className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 py-2 px-4" 
              onClick={() => setAddSoftwareModalVisible(true)}
            >
              {t('Add Software')}
            </Button>
          )}
          <Button 
            className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 py-2 px-4"
            onClick={handleUploadClick}
            disabled={isProcessingExcel}
          >
            {t('Upload Excel')}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx, .xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button 
            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 py-2 px-4" 
            onClick={downloadExcel}
          >
            {t('Download Database')}
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