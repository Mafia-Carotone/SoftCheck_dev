import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import type { NextPageWithLayout } from 'types';
import { useTranslation } from 'next-i18next';
import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { slug } from '@/lib/zod/primitives';
import { Team } from '@prisma/client';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { PDFDocument, rgb } from 'pdf-lib';
import { TeamTab } from '@/components/team';
import useTeam from 'hooks/useTeam';
import { Loading, Error } from '@/components/shared';
import { Button, Card, Form, Input, Modal } from 'react-daisyui';
import { useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';

// Extender jsPDF con autoTable
(jsPDF as any).API.autoTable = autoTable;

// Importar desde el archivo centralizado en lugar de definir localmente
import { QuestionState, ValidationQuestion, validationQuestions, obtenerValorAprobacion } from '@/lib/validation/software-validation';

// Definir los estados de flujo de la aplicación
enum FlowState {
  INITIAL_DATA = -1, // Nuevo estado para ingresar datos del software
  VALIDATION = 0,    // Estado para el cuestionario de validación
  RESULT = 7         // Estado para mostrar el resultado
}

const Products: NextPageWithLayout = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation('common');
  const { isLoading, isError, team } = useTeam();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado principal para controlar el flujo de la aplicación
  const [flowState, setFlowState] = useState<FlowState>(FlowState.INITIAL_DATA);
  
  // Estado para las preguntas de validación
  const [currentQuestion, setCurrentQuestion] = useState<QuestionState>(QuestionState.PRIVACY_POLICY);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  // Estados para los datos básicos del software
  const [softwareName, setSoftwareName] = useState('');
  const [version, setVersion] = useState('');
  const [downloadSource, setDownloadSource] = useState('');
  const [launcher, setLauncher] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [sha256, setSha256] = useState('');
  const [md5, setMd5] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  
  // Función para validar los datos iniciales del software
  const validateInitialData = (): boolean => {
    if (!softwareName.trim()) {
      toast.error('El nombre del software es obligatorio');
      return false;
    }
    
    return true;
  };
  
  // Función para iniciar el proceso de validación después de capturar datos iniciales
  const startValidation = () => {
    if (validateInitialData()) {
      setFlowState(FlowState.VALIDATION);
      setCurrentQuestion(QuestionState.PRIVACY_POLICY);
    }
  };
  
  // Función para avanzar a la siguiente pregunta de validación
  const nextQuestion = () => {
    if (currentQuestion < QuestionState.RESULT) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Si llegamos al final de las preguntas, mostrar el resultado
      setFlowState(FlowState.RESULT);
    }
  };
  
  // Función para manejar las respuestas de validación
  const handleAnswer = (key: string, value: string) => {
    setAnswers({ ...answers, [key]: value });
    
    // Si es la última pregunta, pasar a resultados
    if (currentQuestion === QuestionState.VERSIONES_TROYANIZADAS) {
      setFlowState(FlowState.RESULT);
    } else {
      nextQuestion();
    }
  };
  
  // Usar la función centralizada para determinar si se aprueba
  const determinarAprobacion = () => {
    return obtenerValorAprobacion(answers);
  };
  
  // Función para agregar el software a la base de datos
  const addToDatabase = async () => {
    if (!team) return;
    
    try {
      toast.loading(t('adding-software'), { id: 'add-software' });
      
      // Determinar el estado basado en la evaluación
      const isApproved = determinarAprobacion();
      const finalStatus = isApproved ? 'approved' : 'denied';
      
      // Calcular fileSize en bytes si se proporcionó
      const fileSizeInBytes = fileSize.trim() 
        ? parseInt(fileSize) * 1024 * 1024  // Convertir MB a bytes
        : null;
      
      // Crear los datos del software
      const softwareData = {
        id: uuidv4(),
        teamId: team.id,
        userId: session?.user?.id || '',
        softwareName,
        version: version || null,
        downloadSource: downloadSource || null,
        launcher: launcher || null,
        fileSize: fileSizeInBytes,
        sha256: sha256 || null,
        md5: md5 || null,
        requestedBy: requestedBy || null,
        status: finalStatus,
        answers
      };
      
      // Llamar a la API para crear el software
      const response = await fetch(`/api/teams/${team.slug}/software`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(softwareData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw Error(data.error?.message || 'Error al añadir el software');
      }
      
      toast.success(t('software-added'), { id: 'add-software' });
      
      // Resetear el estado después de agregar el software
      resetForm();
      
    } catch (error: any) {
      console.error('Error al añadir software:', error);
      toast.error(error.message || t('error-adding-software'), { id: 'add-software' });
    }
  };
  
  // Función para reiniciar todo el formulario
  const resetForm = () => {
    // Resetear datos básicos
    setSoftwareName('');
    setVersion('');
    setDownloadSource('');
    setLauncher('');
    setFileSize('');
    setSha256('');
    setMd5('');
    setRequestedBy('');
    
    // Resetear validación
    setAnswers({});
    setCurrentQuestion(QuestionState.PRIVACY_POLICY);
    
    // Volver al inicio
    setFlowState(FlowState.INITIAL_DATA);
  };

  // Función para descargar reporte en formato PDF
  const handleDownloadPDF = async () => {
    try {
      // Crear un nuevo documento PDF
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const { width, height } = page.getSize();

      // Título y subtítulo
      page.drawText('Evaluación de Software', {
        x: 50,
        y: height - 50,
        size: 18,
        color: rgb(0, 0, 0),
      });

      const resultadoText = `Resultado: ${determinarAprobacion() ? "APROBADO" : "NO APROBADO"}`;
      page.drawText(resultadoText, {
        x: 50,
        y: height - 80,
        size: 12,
        color: rgb(0, 0, 0),
      });

      // Información básica del software
      page.drawText(`Software: ${softwareName}`, {
        x: 50,
        y: height - 110,
        size: 10,
        color: rgb(0, 0, 0),
      });

      if (version) {
        page.drawText(`Versión: ${version}`, {
          x: 50,
          y: height - 130,
          size: 10,
          color: rgb(0, 0, 0),
        });
      }

      // Datos para la tabla de respuestas
      let yPosition = height - 160;
      
      // Dibujar las respuestas de validación
      Object.entries(answers).forEach(([key, value]) => {
        const question = validationQuestions.find(q => q.id.toString() === key);
        if (question) {
          const option = question.options.find(o => o.value === value);
          const answerText = option ? option.label : value;
          
          page.drawText(`${question.question}: ${answerText}`, {
            x: 50,
            y: yPosition,
            size: 10,
            color: rgb(0, 0, 0),
          });
          yPosition -= 20;
        }
      });

      // Guardar PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evaluacion_${softwareName.replace(/\s+/g, '_')}.pdf`;
      link.click();

      // Liberar el objeto URL
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);

    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Hubo un error al generar el PDF. Por favor, inténtelo de nuevo.');
    }
  };
  
  // Función para descargar reporte en formato TXT
  const handleDownloadTXT = () => {
    try {
      // Construir el contenido del texto
      let content = "REPORTE DE EVALUACIÓN DE SOFTWARE\n";
      content += "====================================\n\n";
      content += `Software: ${softwareName}\n`;
      if (version) content += `Versión: ${version}\n`;
      if (downloadSource) content += `Fuente: ${downloadSource}\n`;
      content += "\n";
      content += `RESULTADO: ${determinarAprobacion() ? "APROBADO" : "NO APROBADO"}\n`;
      
      content += "\nRESPUESTAS DE VALIDACIÓN:\n";
      content += "------------------------------------\n";
      
      // Agregar cada respuesta al texto
      Object.entries(answers).forEach(([key, value]) => {
        const question = validationQuestions.find(q => q.id.toString() === key);
        if (question) {
          const option = question.options.find(o => o.value === value);
          const answerText = option ? option.label : value;
          content += `${question.question}: ${answerText}\n`;
        }
      });
      
      content += "\n------------------------------------\n";
      content += `Fecha de evaluación: ${new Date().toLocaleDateString()}\n`;
      
      // Crear el blob y descargar
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `evaluacion_${softwareName.replace(/\s+/g, '_')}.txt`;
      link.click();
      
      // Liberar el objeto URL
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error("Error al generar TXT:", error);
      alert("Hubo un error al generar el archivo TXT. Por favor, inténtelo de nuevo.");
    }
  };

  // Renderizado del progreso de validación
  const renderProgress = () => {
    if (flowState !== FlowState.VALIDATION) return null;
    
    const totalSteps = 7; // Total de preguntas de validación
    const currentStep = currentQuestion + 1;
    const progressPercentage = (currentStep / totalSteps) * 100;
    
    return (
      <div className="mb-6">
        <div className="flex justify-between mb-1">
          <span className="text-sm text-gray-500">Pregunta {currentStep} de {totalSteps}</span>
          <span className="text-sm text-gray-500">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>
    );
  };

  // Renderizado del formulario inicial para datos del software
  const renderInitialDataForm = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold mb-4">Información del Software</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Por favor, introduzca la información básica del software que desea añadir.
          Los campos marcados con * son obligatorios.
        </p>
        
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Nombre del Software*</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={softwareName}
            onChange={(e) => setSoftwareName(e.target.value)}
            placeholder="Ej: Microsoft Office"
            required
          />
        </div>
        
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Versión</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="Ej: 2021"
          />
        </div>
        
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Fuente de descarga</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={downloadSource}
            onChange={(e) => setDownloadSource(e.target.value)}
            placeholder="Ej: https://microsoft.com/office"
          />
        </div>
        
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Launcher</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={launcher}
            onChange={(e) => setLauncher(e.target.value)}
            placeholder="Ej: office365.exe"
          />
        </div>
        
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Tamaño del archivo (MB)</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            value={fileSize}
            onChange={(e) => setFileSize(e.target.value)}
            placeholder="Ej: 1024"
          />
        </div>
        
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">SHA256 (opcional)</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={sha256}
            onChange={(e) => setSha256(e.target.value)}
            placeholder="Hash SHA256 del archivo"
          />
        </div>
        
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">MD5 (opcional)</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={md5}
            onChange={(e) => setMd5(e.target.value)}
            placeholder="Hash MD5 del archivo"
          />
        </div>
        
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Solicitado por</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={requestedBy}
            onChange={(e) => setRequestedBy(e.target.value)}
            placeholder="Nombre de quien solicita"
          />
        </div>
        
        <div className="pt-4 flex justify-end">
          <Button 
            color="primary" 
            onClick={startValidation}
          >
            Continuar a Validación
          </Button>
        </div>
      </div>
    );
  };

  // Renderizado de preguntas según el estado actual
  const renderValidationQuestion = () => {
    // Encontrar la pregunta actual
    const questionData = validationQuestions.find(q => q.id === currentQuestion);
    
    if (!questionData) return null;
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{questionData.question}</h3>
        <div className="space-y-2">
          {questionData.options.map((option) => (
            <button
              key={option.value}
              className="w-full p-3 text-left border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleAnswer(currentQuestion.toString(), option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Renderizado del resultado final
  const renderResult = () => {
    const isApproved = determinarAprobacion();
    
    return (
      <div className="space-y-4">
        <div className={`text-center p-4 rounded-lg ${isApproved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <h3 className="text-xl font-bold">
            {isApproved ? 'Software Aprobado' : 'Software No Aprobado'}
          </h3>
          <p className="mt-2">
            {isApproved 
              ? 'El software cumple con los criterios de seguridad y puede ser añadido a la base de datos.' 
              : 'El software no cumple con los criterios mínimos de seguridad.'}
          </p>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mt-4">
          <h4 className="font-medium mb-2">Resumen de la evaluación:</h4>
          <ul className="space-y-1 text-sm">
            {Object.entries(answers).map(([key, value]) => {
              const question = validationQuestions.find(q => q.id.toString() === key);
              if (!question) return null;
              
              const option = question.options.find(o => o.value === value);
              const answerText = option ? option.label : value;
              
              return (
                <li key={key} className="flex justify-between">
                  <span className="font-medium">{question.question.substring(0, 40)}...</span>
                  <span className={`
                    ${value === 'yes' && question.id !== QuestionState.VULNERABILIDADES_ACTIVAS && question.id !== QuestionState.VERSIONES_TROYANIZADAS ? 'text-green-600' : ''}
                    ${value === 'no' && (question.id === QuestionState.VULNERABILIDADES_ACTIVAS || question.id === QuestionState.VERSIONES_TROYANIZADAS) ? 'text-green-600' : ''}
                    ${value === 'yes' && (question.id === QuestionState.VULNERABILIDADES_ACTIVAS || question.id === QuestionState.VERSIONES_TROYANIZADAS) ? 'text-red-600' : ''}
                    ${value === 'no' && question.id !== QuestionState.VULNERABILIDADES_ACTIVAS && question.id !== QuestionState.VERSIONES_TROYANIZADAS ? 'text-red-600' : ''}
                    ${value === 'unknown' ? 'text-yellow-600' : ''}
                  `}>
                    {answerText}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        
        <div className="pt-4 flex flex-wrap gap-2 justify-between">
          <div>
            <Button color="ghost" onClick={resetForm} className="mr-2">
              Comenzar de nuevo
            </Button>
            <Button color="accent" onClick={handleDownloadPDF} className="mr-2">
              Descargar PDF
            </Button>
            <Button color="accent" onClick={handleDownloadTXT}>
              Descargar TXT
            </Button>
          </div>
          
          <Button 
            color="primary" 
            onClick={addToDatabase}
          >
            Añadir a la base de datos
          </Button>
        </div>
      </div>
    );
  };

  // Renderizado según el estado del flujo
  const renderContent = () => {
    if (isLoading) {
      return <Loading />;
    }

    if (isError) {
      return <Error message={isError.message} />;
    }

    if (!team) {
      return <Error message="Equipo no encontrado" />;
    }
    
    return (
      <div className="p-3">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Añadir nuevo software</h1>
        <p className="text-sm mb-6 text-gray-700 dark:text-gray-300">
          Complete la información y el cuestionario para evaluar si el software puede ser añadido.
        </p>
        
        <div className="max-w-lg mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          {renderProgress()}
          
          {flowState === FlowState.INITIAL_DATA && renderInitialDataForm()}
          {flowState === FlowState.VALIDATION && renderValidationQuestion()}
          {flowState === FlowState.RESULT && renderResult()}
        </div>
      </div>
    );
  };

  return renderContent();
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

export default Products;