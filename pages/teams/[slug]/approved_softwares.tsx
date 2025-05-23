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
import { AIValidationService } from '@/lib/validation/ai-validation-service';
import { JsonValue } from '@prisma/client/runtime/library';

// Modificar el tipo para hacerlo compatible con Software
interface ExtendedSoftware {
  id: string; 
  teamId: string;
  userId: string;
  softwareName: string;
  status: string;
  launcher: string | null;
  version: string | null;
  fileSize: number | null;
  downloadSource: string | null;
  sha256: string | null;
  md5: string | null;
  requestedBy: string | null;
  createdAt: Date;
  approvalDate: Date | null;
  denniedDate: Date | null;
  answers: any; // Cambiamos a any para mayor flexibilidad con los tipos
}

// Helper para convertir tipos
const convertToExtendedSoftware = (softwareItem: any): ExtendedSoftware => {
  return {
    ...softwareItem,
    answers: softwareItem.answers || null
  };
};

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
  const [isAIValidating, setIsAIValidating] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{ 
    answers: Record<string, string>; 
    riskAnalysis: string; 
    confidenceScore: number;
    isApproved: boolean;
  } | null>(null);
  const [selectedAIAnalysis, setSelectedAIAnalysis] = useState<{
    software: ExtendedSoftware;
    answers: Record<string, string>;
    riskAnalysis: string;
    isApproved: boolean;
    confidenceScore: number;
  } | null>(null);
  const [aiAnalysisModalVisible, setAiAnalysisModalVisible] = useState(false);

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

  // Nueva función que extiende processValidationResult para guardar análisis de IA
  const processValidationWithAI = useCallback(async (enrichedAnswers: any, software: ExtendedSoftware) => {
    const teamSlug = router.query.slug as string;
    
    // Determinar si el software pasa la validación basado en la respuesta ya calculada
    const finalStatus = enrichedAnswers.validationResult;
    
    // Asegurarse de que los datos de IA están guardados en el formato correcto
    console.log("Guardando análisis de IA:", {
      validationResult: enrichedAnswers.validationResult,
      aiAnalysis: !!enrichedAnswers.aiAnalysis,
      confidenceScore: enrichedAnswers.confidenceScore
    });
    
    try {
      console.log(`Procesando validación de software con IA (${finalStatus}):`, { id: software.id, teamSlug });
      
      toast.loading(finalStatus === 'approved' 
        ? t('approving-software') 
        : t('denying-software'), { id: 'validation-toast' });
      
      const response = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/software?id=${software.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: finalStatus,
          answers: enrichedAnswers
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
      console.error(`Error en la validación con IA (${finalStatus}):`, error);
      toast.error(error.message || `Error al ${finalStatus === 'approved' ? 'aprobar' : 'denegar'} el software`, { id: 'validation-toast' });
    }
  }, [router.query.slug, mutateSoftwareList, t]);

  // Función para iniciar el proceso de validación
  const startValidation = useCallback((software: ExtendedSoftware) => {
    setSoftwareToValidate(software);
    setAiAnalysisResult(null); // Limpiar resultados previos
    setValidationModalVisible(true);
  }, []);

  // Nueva función para iniciar validación con IA
  const startAIValidation = useCallback(async (software: ExtendedSoftware) => {
    try {
      setIsAIValidating(true);
      
      // Llamar al servicio de IA para obtener análisis
      const result = await AIValidationService.analyzeRisks(
        software,
        validationQuestions
      );
      
      // Guardar resultado para mostrarlo en el formulario
      const analysisResult = {
        answers: result.answers,
        riskAnalysis: result.riskAnalysis,
        confidenceScore: result.confidenceScore,
        isApproved: result.isApproved
      };
      
      setAiAnalysisResult(analysisResult);
      
      // Si la confianza es alta (>80%), podemos procesar automáticamente
      if (result.confidenceScore > 80) {
        // Crear un objeto de respuestas más completo que incluya el análisis de IA
        const enrichedAnswers = {
          ...software.answers,
          validation: result.answers,
          validationResult: result.isApproved ? 'approved' : 'denied',
          validatedAt: new Date().toISOString(),
          validatedBy: session?.user?.email || 'unknown',
          aiAnalysis: result.riskAnalysis,
          confidenceScore: result.confidenceScore,
          // Asegurarnos de que estos datos sean fácilmente accesibles para la visualización posterior
          iaValidation: {
            isApproved: result.isApproved,
            riskAnalysis: result.riskAnalysis,
            confidenceScore: result.confidenceScore,
            validatedAt: new Date().toISOString()
          }
        };
        
        console.log("Guardando datos completos de análisis:", enrichedAnswers);
        
        await processValidationWithAI(enrichedAnswers, software);
      } else {
        // Si no, mostrar los resultados al usuario para revisión
        setSoftwareToValidate(software);
        setValidationModalVisible(true);
      }
    } catch (error: any) {
      console.error('Error en validación con IA:', error);
      toast.error(error.message || 'Error al procesar validación con IA');
    } finally {
      setIsAIValidating(false);
    }
  }, [session, processValidationWithAI, setSoftwareToValidate, setValidationModalVisible]);

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

  // Función para abrir el modal con el análisis de IA
  const showAIAnalysis = useCallback((software: ExtendedSoftware) => {
    // Verificar si el software tiene análisis de IA guardado
    console.log("Analizando software:", software);
    console.log("Datos de answers:", software.answers);
    
    // Si hay respuestas de validación, intentamos mostrar el análisis
    if (software.answers) {
      try {
        // Extraer la información guardada - buscando en varios lugares posibles
        const answers = software.answers.validation as Record<string, string> || {};
        const validationResult = software.answers.validationResult;
        
        // Buscar datos en estructura iaValidation si existe
        if (software.answers.iaValidation) {
          const iaData = software.answers.iaValidation;
          
          setSelectedAIAnalysis({
            software,
            answers,
            riskAnalysis: iaData.riskAnalysis || '',
            isApproved: iaData.isApproved || validationResult === 'approved',
            confidenceScore: iaData.confidenceScore || 70
          });
        } else {
          // Fallback a la estructura anterior o mostrar solo las respuestas si no hay análisis
          const isApproved = validationResult === 'approved';
          const riskAnalysis = software.answers.aiAnalysis as string || '';
          const confidenceScore = software.answers.confidenceScore as number || 70;
          
          console.log("Datos encontrados:", {
            validation: !!answers,
            result: validationResult,
            aiAnalysis: !!riskAnalysis,
            confidenceScore
          });
          
          setSelectedAIAnalysis({
            software,
            answers,
            riskAnalysis,
            isApproved,
            confidenceScore
          });
        }
        
        setAiAnalysisModalVisible(true);
      } catch (error) {
        console.error("Error al procesar los datos del análisis:", error);
        toast.error('Error al cargar el análisis de IA: formato de datos incorrecto');
      }
    } else {
      console.log("No se encontraron datos de validación");
      toast.error('No hay datos de validación disponibles para este software');
    }
  }, []);

  // Helper para manejar la definición de tipos en map
  const handleSoftwareAction = (action: (software: ExtendedSoftware) => void) => {
    return (software: any) => {
      action(convertToExtendedSoftware(software));
    };
  };

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
                          color: software.answers?.validation ? 'info' : 'ghost',
                          text: software.answers?.validation ? 'Ver análisis IA' : 'Ver respuestas',
                          onClick: () => handleSoftwareAction(showAIAnalysis)(software),
                          disabled: !software.answers
                        },
                        {
                          color: 'error',
                          text: t('remove'),
                          onClick: () => {
                            handleSoftwareAction((s) => {
                              setSelectedSoftware(s);
                              setConfirmationDialogVisible(true);
                            })(software);
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
              body={pendingSoftware.map((software) => {
                return {
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
                              onClick: () => handleSoftwareAction(startValidation)(software),
                            },
                            {
                              color: 'info',
                              text: 'AI Validate',
                              onClick: () => handleSoftwareAction(startAIValidation)(software),
                              loading: isAIValidating
                            },
                            {
                              color: 'warning',
                              text: t('deny'),
                              onClick: () => handleSoftwareAction(denySoftware)(software),
                            },
                            {
                              color: 'error',
                              text: t('remove'),
                              onClick: () => {
                                handleSoftwareAction((s) => {
                                  setSelectedSoftware(s);
                                  setConfirmationDialogVisible(true);
                                })(software);
                              },
                            },
                          ],
                        }]
                      : []),
                  ],
                };
              })}
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
          initialValues={
            aiAnalysisResult?.answers || 
            validationQuestions.reduce((values, q) => {
              return { ...values, [q.id]: 'unknown' };
            }, {})
          }
          validationSchema={ValidationSchema}
          onSubmit={(values) => {
            if (softwareToValidate && aiAnalysisResult) {
              // Si hay análisis de IA, guardar todo
              const enrichedAnswers = {
                ...softwareToValidate.answers,
                validation: values,
                validationResult: obtenerValorAprobacion(values) ? 'approved' : 'denied',
                validatedAt: new Date().toISOString(),
                validatedBy: session?.user?.email || 'unknown',
                aiAnalysis: aiAnalysisResult.riskAnalysis,
                confidenceScore: aiAnalysisResult.confidenceScore,
                // Añadir estructura estandarizada para guardar el análisis
                iaValidation: {
                  isApproved: obtenerValorAprobacion(values),
                  riskAnalysis: aiAnalysisResult.riskAnalysis,
                  confidenceScore: aiAnalysisResult.confidenceScore,
                  validatedAt: new Date().toISOString()
                }
              };
              processValidationWithAI(enrichedAnswers, softwareToValidate);
            } else if (softwareToValidate) {
              // Si no hay análisis de IA, usar la función normal
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
                  
                  {/* Mostrar análisis de IA si está disponible */}
                  {aiAnalysisResult && (
                    <div className={`p-3 ${aiAnalysisResult.isApproved 
                      ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500' 
                      : 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'} rounded-md mb-4`}>
                      <h4 className={`font-bold ${aiAnalysisResult.isApproved 
                        ? 'text-green-700 dark:text-green-300' 
                        : 'text-red-700 dark:text-red-300'} mb-2 flex items-center`}>
                        {aiAnalysisResult.isApproved 
                          ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Recomendación de IA: APROBAR
                            </>
                          ) 
                          : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Recomendación de IA: RECHAZAR
                            </>
                          )
                        } (Confianza: {aiAnalysisResult.confidenceScore}%)
                      </h4>
                      
                      {/* Resumen de respuestas críticas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                        {validationQuestions
                          .filter(q => q.criticalForApproval)
                          .map(q => {
                            const answer = aiAnalysisResult.answers[q.id];
                            const isRisk = (q.id === QuestionState.PRIVACY_POLICY && answer === 'no') ||
                                          (q.id === QuestionState.VULNERABILIDADES_ACTIVAS && answer === 'yes') ||
                                          (q.id === QuestionState.VERSIONES_TROYANIZADAS && answer === 'yes');
                            
                            return (
                              <div 
                                key={q.id} 
                                className={`text-xs p-2 rounded ${
                                  isRisk 
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' 
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                }`}
                              >
                                <span className="font-semibold">{q.question}</span>: {
                                  q.options.find(o => o.value === answer)?.label || 'Desconocido'
                                }
                              </div>
                            );
                        })}
                      </div>
                      
                      <div className="text-sm whitespace-pre-wrap border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                        {aiAnalysisResult.riskAnalysis}
                      </div>
                      
                      <div className="flex justify-between mt-3">
                        <Button
                          size="sm"
                          color={aiAnalysisResult.isApproved ? "success" : "error"}
                          onClick={() => {
                            if (softwareToValidate) {
                              processValidationResult(aiAnalysisResult.answers, softwareToValidate);
                            }
                          }}
                        >
                          {aiAnalysisResult.isApproved ? "Aceptar recomendación y APROBAR" : "Aceptar recomendación y RECHAZAR"}
                        </Button>
                        
                        <Button
                          size="sm"
                          color="ghost"
                          onClick={() => {
                            // Permite al usuario editar las respuestas manualmente en vez de aceptar automáticamente
                            toast.success("Puede editar las respuestas manualmente antes de finalizar la validación");
                          }}
                        >
                          Revisar recomendación
                        </Button>
                      </div>
                    </div>
                  )}
                  
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

      {/* Modal para visualizar análisis de IA */}
      <Modal open={aiAnalysisModalVisible}>
        <Button 
          className="absolute right-2 top-2" 
          size="sm" 
          shape="circle" 
          onClick={() => setAiAnalysisModalVisible(false)}
        >
          ✕
        </Button>
        <Modal.Header>
          <h3 className="font-bold text-lg">
            {selectedAIAnalysis?.riskAnalysis 
              ? `Análisis de IA: ${selectedAIAnalysis?.software.softwareName}` 
              : `Respuestas de validación: ${selectedAIAnalysis?.software.softwareName}`}
            {selectedAIAnalysis && (
              <span className={`ml-2 px-2 py-1 text-sm rounded-full ${
                selectedAIAnalysis.isApproved 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
              }`}>
                {selectedAIAnalysis.isApproved ? 'APROBADO' : 'RECHAZADO'}
              </span>
            )}
          </h3>
        </Modal.Header>
        <Modal.Body>
          {selectedAIAnalysis ? (
            <div className="space-y-4">
              {/* Mensaje si no hay análisis de IA disponible */}
              {!selectedAIAnalysis.riskAnalysis && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-3 rounded-md">
                  <div className="flex items-center text-yellow-700 dark:text-yellow-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">Software validado sin análisis de IA</span>
                  </div>
                  <p className="text-sm mt-1">Este software fue validado manualmente o con una versión anterior del sistema que no guardaba los detalles completos del análisis. A continuación se muestran las respuestas disponibles.</p>
                </div>
              )}
              
              {/* Información básica del software */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md mb-4">
                <p><strong>Nombre:</strong> {selectedAIAnalysis.software.softwareName}</p>
                <p><strong>Versión:</strong> {selectedAIAnalysis.software.version || '-'}</p>
                <p><strong>Fuente:</strong> {selectedAIAnalysis.software.downloadSource || '-'}</p>
                <p><strong>SHA256:</strong> {selectedAIAnalysis.software.sha256 || '-'}</p>
                <p><strong>Confianza del análisis:</strong> {selectedAIAnalysis.confidenceScore || 'No disponible'}%</p>
                <p><strong>Estado:</strong> {selectedAIAnalysis.software.status}</p>
                <p><strong>Fecha de validación:</strong> {selectedAIAnalysis.software.answers?.validatedAt ? new Date(selectedAIAnalysis.software.answers.validatedAt).toLocaleString() : '-'}</p>
                <p><strong>Validado por:</strong> {selectedAIAnalysis.software.answers?.validatedBy || 'Sistema de IA'}</p>
              </div>
              
              {/* Resumen de respuestas críticas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                {validationQuestions
                  .filter(q => q.criticalForApproval)
                  .map(q => {
                    const answer = selectedAIAnalysis.answers[q.id];
                    const isRisk = (q.id === QuestionState.PRIVACY_POLICY && answer === 'no') ||
                                  (q.id === QuestionState.VULNERABILIDADES_ACTIVAS && answer === 'yes') ||
                                  (q.id === QuestionState.VERSIONES_TROYANIZADAS && answer === 'yes');
                    
                    return (
                      <div 
                        key={q.id} 
                        className={`text-xs p-2 rounded ${
                          isRisk 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' 
                            : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        }`}
                      >
                        <span className="font-semibold">{q.question}</span>: {
                          q.options.find(o => o.value === answer)?.label || 'Desconocido'
                        }
                      </div>
                    );
                })}
              </div>
              
              {/* Todas las respuestas */}
              <div className="border rounded-md overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-700 p-2 font-medium">
                  Respuestas completas
                </div>
                <div className="divide-y">
                  {validationQuestions.map(q => (
                    <div key={q.id} className="p-3 flex justify-between">
                      <span className="text-sm">{q.question}</span>
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                        selectedAIAnalysis.answers[q.id] === 'yes'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                          : selectedAIAnalysis.answers[q.id] === 'no'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'
                      }`}>
                        {q.options.find(o => o.value === selectedAIAnalysis.answers[q.id])?.label || 'Desconocido'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Análisis textual completo */}
              {selectedAIAnalysis.riskAnalysis ? (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Análisis detallado</h4>
                  <div className="text-sm whitespace-pre-wrap p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                    {selectedAIAnalysis.riskAnalysis}
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No hay análisis detallado disponible para este software. Posiblemente fue validado con una versión anterior del sistema.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No hay datos disponibles</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No se encontró información del análisis de IA para este software.
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Actions>
          <Button 
            onClick={() => setAiAnalysisModalVisible(false)} 
            color="ghost"
          >
            Cerrar
          </Button>
        </Modal.Actions>
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