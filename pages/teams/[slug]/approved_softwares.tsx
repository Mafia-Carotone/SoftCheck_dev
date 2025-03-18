import { Error, Loading } from '@/components/shared';
import { Software } from '@prisma/client';
import useCanAccess from 'hooks/useCanAccess';
import useSoftwareList from 'hooks/useSoftwareList';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { Button, Modal, Form, Input, Checkbox } from 'react-daisyui';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import { useState, useRef, useCallback } from 'react';
import { Table } from '@/components/shared/table/Table';
import ConfirmationDialog from '../../../components/shared/ConfirmationDialog';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import * as XLSX from 'xlsx';
import * as Yup from 'yup';
import { Formik } from 'formik';
// Importar desde el archivo centralizado
import { QuestionState, ValidationQuestion, validationQuestions, obtenerValorAprobacion } from '@/lib/validation/software-validation';

// Extender el tipo Software para incluir todas las propiedades necesarias
// Este tipo ahora mapea exactamente a nuestro modelo Prisma actualizado
interface ExtendedSoftware extends Omit<Software, 'status'> {
  id: string; 
  teamId: string;
  userId: string;
  softwareName: string;
  status: string;
  launcher?: string | null;
  version?: string | null;
  fileSize?: number | null;
  downloadSource?: string | null;
  sha256?: string | null;
  md5?: string | null;
  requestedBy?: string | null;
  createdAt: Date;
  approvalDate?: Date | null;
  denniedDate?: Date | null;
  answers?: Record<string, any> | null;
}

const SoftwareTable = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation('common');
  const { canAccess } = useCanAccess();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmationDialogVisible, setConfirmationDialogVisible] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState<ExtendedSoftware | null>(null);
  const [addSoftwareModalVisible, setAddSoftwareModalVisible] = useState(false);
  // Nuevo estado para el modal de validación
  const [validationModalVisible, setValidationModalVisible] = useState(false);
  const [softwareToValidate, setSoftwareToValidate] = useState<ExtendedSoftware | null>(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  // Tipado correcto para el software list
  const { isLoading, isError, softwareList, mutateSoftwareList } = useSoftwareList();

  // Mover las funciones que interactúan con la API y usan hooks a useCallback
  const removeSoftware = useCallback(async (software: ExtendedSoftware | null) => {
    if (!software) return;

    const teamSlug = router.query.slug as string;
    try {
      console.log('Eliminando software:', { id: software.id, teamSlug });

      const response = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/software`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: software.id })
      });

      if (!response.ok) {
        const json = await response.json();
        throw Error(json.error?.message || 'Error al eliminar el software');
      }

      mutateSoftwareList();
      toast.success(t('software-deleted'));
      setConfirmationDialogVisible(false);
    } catch (error: any) {
      console.error('Error eliminando software:', error);
      toast.error(error.message || 'Error al eliminar el software');
    }
  }, [router.query.slug, mutateSoftwareList, t]);

  const addSoftware = useCallback(async (values: any) => {
    const teamSlug = router.query.slug as string;
    try {
      // Generar un ID único
      const id = `SW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('Añadiendo software:', { ...values, id });
      
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
      console.error('Error añadiendo software:', error);
      toast.error(error.message || 'Error al añadir el software');
    }
  }, [router.query.slug, mutateSoftwareList, t]);

  // Función para iniciar el proceso de validación
  const startValidation = useCallback((software: ExtendedSoftware) => {
    setSoftwareToValidate(software);
    setValidationModalVisible(true);
  }, []);

  // Función para procesar el resultado de la validación
  const processValidationResult = useCallback(async (values: Record<string, string>, software: ExtendedSoftware) => {
    const teamSlug = router.query.slug as string;
    
    // Determinar si el software pasa la validación usando la función importada
    const isApproved = obtenerValorAprobacion(values);
    
    // Estado final basado en la validación
    const finalStatus = isApproved ? 'approved' : 'denied';
    
    try {
      console.log(`Procesando validación de software (${finalStatus}):`, { id: software.id, teamSlug, values });
      
      toast.loading(finalStatus === 'approved' 
        ? t('approving-software') 
        : t('denying-software'), { id: 'validation-toast' });
      
      // Guardar las respuestas de la validación en el campo answers
      const answers = {
        ...software.answers,
        validation: values,
        validationResult: finalStatus,
        validatedAt: new Date().toISOString(),
        validatedBy: session?.user?.email || 'unknown'
      };
      
      const response = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/software?id=${software.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: finalStatus,
          answers
        })
      });

      const data = await response.json();
      console.log('Respuesta de la API:', data);

      if (!response.ok) {
        throw Error(data.error?.message || `Error al ${finalStatus === 'approved' ? 'aprobar' : 'denegar'} el software`);
      }

      await mutateSoftwareList();
      toast.success(finalStatus === 'approved' 
        ? t('software-approved') 
        : t('software-denied'), { id: 'validation-toast' });
      
      setValidationModalVisible(false);
    } catch (error: any) {
      console.error(`Error en la validación (${finalStatus}):`, error);
      toast.error(error.message || `Error al ${finalStatus === 'approved' ? 'aprobar' : 'denegar'} el software`, { id: 'validation-toast' });
    }
  }, [router.query.slug, mutateSoftwareList, t, session]);

  // Esta función ya no se usa directamente, pero la mantenemos por si se necesita
  const approveSoftware = useCallback(async (software: ExtendedSoftware) => {
    const teamSlug = router.query.slug as string;
    try {
      console.log('Aprobando software:', { id: software.id, teamSlug });
      
      toast.loading(t('approving-software'), { id: 'approve-toast' });
      
      const response = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/software?id=${software.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'approved'
        })
      });

      const data = await response.json();
      console.log('Respuesta de la API:', data);

      if (!response.ok) {
        throw Error(data.error?.message || 'Error al aprobar el software');
      }

      await mutateSoftwareList();
      toast.success(t('software-approved'), { id: 'approve-toast' });
    } catch (error: any) {
      console.error('Error aprobando software:', error);
      toast.error(error.message || 'Error al aprobar el software', { id: 'approve-toast' });
    }
  }, [router.query.slug, mutateSoftwareList, t]);

  const denySoftware = useCallback(async (software: ExtendedSoftware) => {
    const teamSlug = router.query.slug as string;
    try {
      console.log('Denegando software:', { id: software.id, teamSlug });
      
      toast.loading(t('denying-software'), { id: 'deny-toast' });
      
      const response = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/software?id=${software.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'denied'
        })
      });

      const data = await response.json();
      console.log('Respuesta de la API:', data);

      if (!response.ok) {
        throw Error(data.error?.message || 'Error al denegar el software');
      }

      await mutateSoftwareList();
      toast.success(t('software-denied'), { id: 'deny-toast' });
    } catch (error: any) {
      console.error('Error denegando software:', error);
      toast.error(error.message || 'Error al denegar el software', { id: 'deny-toast' });
    }
  }, [router.query.slug, mutateSoftwareList, t]);

  const downloadExcel = useCallback(() => {
    if (!softwareList) return;
    
    // Convertimos los datos a ExtendedSoftware para typed safety
    const typedSoftwareList = softwareList as unknown as ExtendedSoftware[];
    
    const worksheet = XLSX.utils.json_to_sheet(typedSoftwareList.map(software => ({
      Name: software.softwareName,
      Status: software.status,
      Launcher: software.launcher || '-',
      Version: software.version || '-',
      'File Size': software.fileSize ? `${(software.fileSize / (1024 * 1024)).toFixed(2)} MB` : '-',
      'Download Source': software.downloadSource || '-',
      SHA256: software.sha256 || '-',
      MD5: software.md5 || '-',
      'Requested By': software.requestedBy || '-',
      'Created At': new Date(software.createdAt).toLocaleDateString(),
      'Approval Date': software.approvalDate ? new Date(software.approvalDate).toLocaleDateString() : '-',
      'Denied Date': software.denniedDate ? new Date(software.denniedDate).toLocaleDateString() : '-',
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Software Database');
    XLSX.writeFile(workbook, 'software_database.xlsx');
  }, [softwareList]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !softwareList) return;

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
        softwareList.forEach((software: ExtendedSoftware) => {
          approvedSoftwareMap.set(software.softwareName.toLowerCase(), software.status === 'approved');
        });
        
        // Agregar la columna "Status"
        const processedData = excelData.map((row: any) => {
          const softwareName = row[processNameKey as string];
          const isApproved = softwareName && 
                           approvedSoftwareMap.has(String(softwareName).toLowerCase()) && 
                           approvedSoftwareMap.get(String(softwareName).toLowerCase());
          
          return {
            ...row,
            'Status': isApproved ? 'approved' : 'pending'
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
  }, [softwareList, t]);

  // Ahora, comprobemos si los datos están todavía cargando
  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Error message={isError.message} />;
  }

  if (!softwareList) {
    return null;
  }

  // Convertimos los datos a ExtendedSoftware para typed safety
  const typedSoftwareList = softwareList as unknown as ExtendedSoftware[];
  
  // Filtrar la lista para obtener software pendiente, aprobado y denegado
  const pendingSoftware = typedSoftwareList.filter(software => software.status === 'pending');
  
  // El Software Database ahora incluye tanto software aprobado como denegado
  const databaseSoftware = typedSoftwareList.filter(software => 
    software.status === 'approved' || software.status === 'denied'
  );

  const cols = [
    t('name'),
    t('version'),
    t('launcher'),
    t('download-source'),
    t('file-size'),
    t('date'),
  ];

  const pendingCols = [...cols];
  const approvedCols = [...cols, t('status')];

  if (canAccess('team_software', ['delete'])) {
    pendingCols.push(t('actions'));
    approvedCols.push(t('actions'));
  }

  // Validation schema for the form
  const SoftwareSchema = Yup.object().shape({
    softwareName: Yup.string().required(t('name-required')),
    launcher: Yup.string(),
    version: Yup.string(),
    fileSize: Yup.number().nullable(),
    downloadSource: Yup.string(),
    sha256: Yup.string(),
    md5: Yup.string(),
    requestedBy: Yup.string(),
    status: Yup.string().default('pending'),
  });

  // Esquema de validación para el formulario de validación
  const ValidationSchema = Yup.object().shape(
    validationQuestions.reduce((schema, question) => {
      return {
        ...schema,
        [question.id]: Yup.string().required('Este campo es obligatorio')
      };
    }, {})
  );

  return (
    <div className="space-y-8">
      {/* Tabs para navegación entre Pending y Approved */}
      <div className="flex border-b">
        <button 
          className={`py-2 px-4 font-medium ${activeTab === 'approved' 
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' 
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('approved')}
        >
          {t('Software Database')}
        </button>
        <button 
          className={`py-2 px-4 font-medium ${activeTab === 'pending' 
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' 
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('pending')}
        >
          {t('Pending Software')}
        </button>
      </div>

      {/* Sección de Software Database (software aprobado y denegado) */}
      {activeTab === 'approved' && (
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
            cols={approvedCols}
            body={databaseSoftware.map((software) => ({
              id: software.id,
              cells: [
                { text: software.softwareName, wrap: true },
                { text: software.version || '-', wrap: true },
                { text: software.launcher || '-', wrap: true },
                { text: software.downloadSource || '-', wrap: true },
                { text: software.fileSize ? `${(software.fileSize / (1024 * 1024)).toFixed(2)} MB` : '-', wrap: true },
                { text: new Date(software.createdAt).toLocaleDateString(), wrap: true },
                { 
                  text: software.status, 
                  wrap: true,
                  className: software.status === 'approved' 
                    ? 'text-green-600 font-medium' 
                    : 'text-red-600 font-medium'
                },
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
        </div>
      )}
      {/* Sección de Pending Software */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-medium leading-none tracking-tight">{t('Pending Software')}</h2>
            <div className="flex space-x-2">
            </div>
          </div>
          
          {pendingSoftware.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {t('No pending software')}
            </div>
          ) : (
            <Table
              cols={pendingCols}
              body={pendingSoftware.map((software) => ({
                id: software.id,
                cells: [
                  { text: software.softwareName, wrap: true },
                  { text: software.version || '-', wrap: true },
                  { text: software.launcher || '-', wrap: true },
                  { text: software.downloadSource || '-', wrap: true },
                  { text: software.fileSize ? `${(software.fileSize / (1024 * 1024)).toFixed(2)} MB` : '-', wrap: true },
                  { text: new Date(software.createdAt).toLocaleDateString(), wrap: true },
                  ...(canAccess('team_software', ['delete'])
                    ? [{
                        buttons: [
                          {
                            color: 'success',
                            text: t('validate'),
                            onClick: () => startValidation(software),
                          },
                          {
                            color: 'warning',
                            text: t('deny'),
                            onClick: () => denySoftware(software),
                          },
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
          )}
        </div>
      )}
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
            launcher: '',
            version: '',
            fileSize: null,
            downloadSource: '',
            sha256: '',
            md5: '',
            requestedBy: '',
            status: 'pending',
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
            setFieldValue
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
                      <span className="label-text">{t('launcher')}</span>
                    </label>
                    <input
                      type="text"
                      name="launcher"
                      className="input input-bordered w-full"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.launcher}
                    />
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">{t('version')}</span>
                    </label>
                    <input
                      type="text"
                      name="version"
                      className="input input-bordered w-full"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.version}
                    />
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">{t('file-size')} (MB)</span>
                    </label>
                    <input
                      type="number"
                      name="fileSize"
                      className="input input-bordered w-full"
                      onChange={(e) => {
                        const value = e.target.value;
                        // Convertir MB a bytes para almacenar
                        const bytes = value ? parseInt(value) * 1024 * 1024 : null;
                        setFieldValue('fileSize', bytes);
                      }}
                      onBlur={handleBlur}
                      value={values.fileSize ? (values.fileSize / (1024 * 1024)) : ''}
                    />
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">{t('download-source')}</span>
                    </label>
                    <input
                      type="text"
                      name="downloadSource"
                      className="input input-bordered w-full"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.downloadSource}
                    />
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">SHA256</span>
                    </label>
                    <input
                      type="text"
                      name="sha256"
                      className="input input-bordered w-full"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.sha256}
                    />
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">MD5</span>
                    </label>
                    <input
                      type="text"
                      name="md5"
                      className="input input-bordered w-full"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.md5}
                    />
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">{t('requested-by')}</span>
                    </label>
                    <input
                      type="text"
                      name="requestedBy"
                      className="input input-bordered w-full"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.requestedBy}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label cursor-pointer">
                      <span className="label-text">{t('approved')}</span>
                      <input
                        type="checkbox"
                        name="status"
                        className="toggle toggle-primary"
                        onChange={(e) => {
                          setFieldValue('status', e.target.checked ? 'approved' : 'pending');
                        }}
                        checked={values.status === 'approved'}
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

      {/* Modal para validación de software */}
      <Modal open={validationModalVisible}>
        <Button 
          className="absolute right-2 top-2" 
          size="sm" 
          shape="circle" 
          onClick={() => setValidationModalVisible(false)}
        >
          ✕
        </Button>
        <Modal.Header>
          <h3 className="font-bold text-lg">Validación de software: {softwareToValidate?.softwareName}</h3>
        </Modal.Header>
        <Formik
          initialValues={validationQuestions.reduce((values, q) => {
            return { ...values, [q.id]: 'unknown' };
          }, {})}
          validationSchema={ValidationSchema}
          onSubmit={(values) => {
            if (softwareToValidate) {
              processValidationResult(values, softwareToValidate);
            }
          }}
        >
          {({
            values,
            errors,
            touched,
            handleChange,
            handleBlur,
            handleSubmit,
            isSubmitting,
            setFieldValue
          }) => (
            <form onSubmit={handleSubmit}>
              <Modal.Body>
                <div className="space-y-4">
                  {/* Información básica del software */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md mb-4">
                    <p><strong>Nombre:</strong> {softwareToValidate?.softwareName}</p>
                    <p><strong>Versión:</strong> {softwareToValidate?.version || '-'}</p>
                    <p><strong>Fuente:</strong> {softwareToValidate?.downloadSource || '-'}</p>
                    <p><strong>SHA256:</strong> {softwareToValidate?.sha256 || '-'}</p>
                    <p><strong>Solicitado por:</strong> {softwareToValidate?.requestedBy || '-'}</p>
                  </div>
                  
                  {/* Preguntas de validación */}
                  {validationQuestions.map((question) => (
                    <div className="form-control w-full" key={question.id}>
                      <label className="label">
                        <span className={`label-text ${question.criticalForApproval ? 'font-semibold' : ''}`}>
                          {question.question}
                          {question.criticalForApproval && 
                            <span className="text-red-500 ml-1">*</span>
                          }
                        </span>
                      </label>
                      
                      <div className="flex flex-col space-y-2">
                        {question.options.map(option => (
                          <label key={option.value} className="label cursor-pointer justify-start">
                            <input
                              type="radio"
                              name={question.id.toString()}
                              className="radio mr-2"
                              value={option.value}
                              checked={values[question.id] === option.value}
                              onChange={() => setFieldValue(question.id.toString(), option.value)}
                            />
                            <span className="label-text">{option.label}</span>
                          </label>
                        ))}
                      </div>
                      
                      {errors[question.id] && touched[question.id] && (
                        <label className="label">
                          <span className="label-text-alt text-error">{errors[question.id]}</span>
                        </label>
                      )}
                    </div>
                  ))}
                  
                  <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                      Las preguntas marcadas con <span className="text-red-500">*</span> son críticas para la aprobación. 
                      Responder negativamente a cualquiera de ellas resultará en la denegación automática del software.
                    </p>
                  </div>
                </div>
              </Modal.Body>
              <Modal.Actions>
                <Button 
                  onClick={() => setValidationModalVisible(false)} 
                  color="ghost"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  color="primary" 
                  loading={isSubmitting}
                >
                  Finalizar validación
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