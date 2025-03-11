import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import type { NextPageWithLayout } from 'types';
import { useTranslation } from 'next-i18next';
import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { slug } from '@/lib/zod/primitives';
import { Team } from '@prisma/client';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';

// Estado para controlar el flujo del cuestionario
enum QuestionState {
  PRIVACY_POLICY = 0,
  CERTIFICACIONES_SEC = 1,
  VULNERABILIDADES_ACTIVAS = 2,
  QUIEN_LO_DESARROLLA = 3,
  FRECUENCIA_UPDATE = 4,
  VULNERABILIDADES_ANTIGUAS = 5,
  VERSIONES_TROYANIZADAS = 6,
  RESULT = 7
}

// Declarar jsPDF para TypeScript
declare global {
  interface Window {
    jspdf: any;
  }
}

// Extender jsPDF para TypeScript
interface jsPDF {
  autoTable: (options: any) => jsPDF;
  save: (filename: string) => void;
  internal: {
    pageSize: {
      width: number;
      height: number;
    };
    getNumberOfPages: () => number;
  };
  setPage: (pageNumber: number) => void;
}

const Products: NextPageWithLayout = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [currentState, setCurrentState] = useState<QuestionState>(QuestionState.PRIVACY_POLICY);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ approved: string, message?: string }>({ approved: '' });
  const [softwareName, setSoftwareName] = useState<string>('');
  const [softwareID, setID] = useState<string>(() => {
    // Generar un ID único al inicio
    return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  });
  const [softwareWindowsEXE, setWindowsEXE] = useState<string>('');
  const [softwareMacosEXE, setMacosEXE] = useState<string>('');
  const [softwareVersion, setVersion] = useState<string>('');
  const [addedToDatabase, setAddedToDatabase] = useState<boolean>(false);

  // Función para avanzar al siguiente estado
  const nextState = () => {
    setCurrentState(prevState => prevState + 1 as QuestionState);
  };

  // Función para manejar selección de respuesta
  const handleAnswer = (key: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [key]: value
    }));
    nextState();
  };

  // Función para obtener el valor de aprobación (adaptada del script)
  const obtenerValorAprobacion = (vulnerabilidades_activas: string, quien_lo_desarrolla: string, frecuencia_update: string, vulnerabilidades_antiguas: string) => {
    // Ajustamos la frecuencia_update para que coincida con los términos del algoritmo
    let frecuencia = frecuencia_update;
    if (frecuencia_update === "Mensual") {
      frecuencia = "Menos de 1 mes";
    }
    
    // Condición específica solicitada
    if (quien_lo_desarrolla === "Multinacional" && vulnerabilidades_activas === "Si" && frecuencia === "Menos de 1 mes") {
      return { approved: "No", message: "Vuelve a pedirlo dentro de un mes" };
    } else if (quien_lo_desarrolla === "Comunidad" && ["Menos de 1 mes", "1-3 meses"].includes(vulnerabilidades_antiguas)) {
      return { approved: "No", message: "" };
    } else if (quien_lo_desarrolla === "Multinacional" && vulnerabilidades_antiguas === "Menos de 1 mes") {
      return { approved: "No", message: "" };
    } else if (vulnerabilidades_activas === "Si" || quien_lo_desarrolla === "Dev unico" || frecuencia_update === "Anual") {
      return { approved: "No", message: "" };
    }
    return { approved: "Si" };
  };

  // Función para añadir el software a la base de datos
  const addToDatabase = async () => {
    if (!router.isReady) {
      toast.error("Espere un momento mientras se carga la página");
      return;
    }

    const teamSlug = router.query.slug;
    console.log("Team slug:", teamSlug); // Debugging

    if (!teamSlug || typeof teamSlug !== 'string') {
      toast.error("Error: No se pudo determinar el equipo");
      return;
    }

    // Validación de campos obligatorios
    if (!softwareName || !softwareName.trim()) {
      toast.error("El nombre del software es obligatorio");
      return;
    }

    if (!softwareVersion || !softwareVersion.trim()) {
      toast.error("La versión del software es obligatoria");
      return;
    }

    if (!softwareID) {
      toast.error("Error: No se pudo generar el ID del software");
      return;
    }

    // Construir el payload
    const payload = {
      id: softwareID,
      softwareName: softwareName.trim(),
      version: softwareVersion.trim(),
      windowsEXE: softwareWindowsEXE?.trim() || null,
      macosEXE: softwareMacosEXE?.trim() || null,
      answers: answers || {},
      approved: result.approved === "Si",
      teamId: teamSlug // Añadir el teamId usando el slug
    };

    console.log("Sending payload:", payload); // Debugging

    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/software`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log("Response status:", response.status); // Debugging
      const data = await response.json();
      console.log("Response data:", data); // Debugging

      if (!response.ok) {
        throw new Error(data.error?.message || 'Error al añadir el software a la base de datos');
      }

      setAddedToDatabase(true);
      toast.success('Software añadido con éxito');
      
    } catch (error: any) {
      console.error('Error al crear software:', error);
      toast.error(error.message || 'Error al conectar con la base de datos');
    }
  };

  // Función para reiniciar el cuestionario
  const resetQuiz = () => {
    setCurrentState(QuestionState.PRIVACY_POLICY);
    setAnswers({});
    setResult({ approved: '' });
    setSoftwareName('');
    setID(Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join(''));
    setWindowsEXE('');
    setMacosEXE('');
    setVersion('');
    setAddedToDatabase(false);
  };

  // Efecto para calcular el resultado cuando se han respondido todas las preguntas
  useEffect(() => {
    if (currentState === QuestionState.RESULT) {
      const aprobacion = obtenerValorAprobacion(
        answers.vulnerabilidades_activas,
        answers.quien_lo_desarrolla,
        answers.frecuencia_update,
        answers.vulnerabilidades_antiguas
      );
      
      let mensaje = aprobacion.message || "";
      if (aprobacion.approved === "Si" && answers.versiones_troyanizadas === "Si") {
        mensaje += " Existen versiones troyanizadas, debes enviar el enlace de descarga oficial.";
      }
      
      setResult({ approved: aprobacion.approved, message: mensaje });
    }
  }, [currentState, answers]);
/*
  // Función para descargar reporte en formato PDF
  const handleDownloadPDF = () => {
    try {
      // @ts-ignore - Necesario porque jsPDF y jspdf-autotable no tienen tipos TS definidos completamente
      const doc = new jsPDF();
      
      // Título y subtítulo
      doc.setFontSize(18);
      doc.text("Evaluación de Software", 14, 20);
      
      doc.setFontSize(12);
      const resultadoText = `Resultado: ${result.approved === "Si" ? "APROBADO" : "NO APROBADO"}`;
      doc.text(resultadoText, 14, 30);
      
      if (result.message) {
        doc.text(`Comentario: ${result.message}`, 14, 38);
      }
      
      // Datos para la tabla
      const tableData = [
        ["Política de privacidad", answers.privacy_policy || "N/A"],
        ["Certificaciones de seguridad", answers.certificaciones_sec || "N/A"],
        ["Vulnerabilidades activas", answers.vulnerabilidades_activas || "N/A"],
        ["Desarrollador", answers.quien_lo_desarrolla || "N/A"],
        ["Frecuencia de actualización", answers.frecuencia_update || "N/A"],
        ["Vulnerabilidades antiguas", answers.vulnerabilidades_antiguas || "N/A"],
        ["Versiones troyanizadas", answers.versiones_troyanizadas || "N/A"]
      ];
      
      // @ts-ignore - Necesario por el uso de autotable
      doc.autoTable({
        startY: 45,
        head: [["Pregunta", "Respuesta"]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [66, 133, 244] }
      });
      
      // Agregar fecha al pie de página
      const today = new Date();
      const dateStr = today.toLocaleDateString();
      const pageCount = doc.internal.getNumberOfPages();
      
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(`Fecha de evaluación: ${dateStr}`, 14, doc.internal.pageSize.height - 10);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
      }
      
      // Guardar PDF
      doc.save("evaluacion_software.pdf");
      
    } catch (error) {
      console.error("Error al generar PDF:", error);
      alert("Hubo un error al generar el PDF. Por favor, inténtelo de nuevo.");
    }
  };
  */
  // Función para descargar reporte en formato TXT
  const handleDownloadTXT = () => {
    try {
      // Construir el contenido del texto
      let content = "REPORTE DE EVALUACIÓN DE SOFTWARE\n";
      content += "====================================\n\n";
      content += `RESULTADO: ${result.approved === "Si" ? "APROBADO" : "NO APROBADO"}\n`;
      
      if (result.message) {
        content += `COMENTARIO: ${result.message}\n`;
      }
      
      content += "\nRESPUESTAS:\n";
      content += "------------------------------------\n";
      content += `Política de privacidad: ${answers.privacy_policy || "N/A"}\n`;
      content += `Certificaciones de seguridad: ${answers.certificaciones_sec || "N/A"}\n`;
      content += `Vulnerabilidades activas: ${answers.vulnerabilidades_activas || "N/A"}\n`;
      content += `Desarrollador: ${answers.quien_lo_desarrolla || "N/A"}\n`;
      content += `Frecuencia de actualización: ${answers.frecuencia_update || "N/A"}\n`;
      content += `Vulnerabilidades antiguas: ${answers.vulnerabilidades_antiguas || "N/A"}\n`;
      content += `Versiones troyanizadas: ${answers.versiones_troyanizadas || "N/A"}\n`;
      content += "\n------------------------------------\n";
      content += `Fecha de evaluación: ${new Date().toLocaleDateString()}\n`;
      
      // Crear el blob y descargar
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "evaluacion_software.txt";
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

  // Renderizado del progreso
  const renderProgress = () => {
    if (currentState === QuestionState.RESULT) return null;
    
    const totalSteps = 7; // Total de preguntas
    const currentStep = currentState + 1;
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

  // Renderizado de preguntas según el estado actual
  const renderQuestion = () => {
    switch (currentState) {
      case QuestionState.PRIVACY_POLICY:
        return (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">¿Tiene política de privacidad?</h3>
            <div className="space-y-3">
              {["Tiene", "No tiene"].map(option => (
                <button
                  key={option}
                  onClick={() => handleAnswer('privacy_policy', option)}
                  className="w-full p-3 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      
      case QuestionState.CERTIFICACIONES_SEC:
        return (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">¿Cuenta con certificaciones de seguridad?</h3>
            <div className="space-y-3">
              {["Si", "No"].map(option => (
                <button
                  key={option}
                  onClick={() => handleAnswer('certificaciones_sec', option)}
                  className="w-full p-3 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      
      case QuestionState.VULNERABILIDADES_ACTIVAS:
        return (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">¿Existen vulnerabilidades activas?</h3>
            <div className="space-y-3">
              {["Si", "No"].map(option => (
                <button
                  key={option}
                  onClick={() => handleAnswer('vulnerabilidades_activas', option)}
                  className="w-full p-3 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      
      case QuestionState.QUIEN_LO_DESARROLLA:
        return (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">¿Quién desarrolló el software?</h3>
            <div className="space-y-3">
              {["Comunidad", "Multinacional", "Dev unico"].map(option => (
                <button
                  key={option}
                  onClick={() => handleAnswer('quien_lo_desarrolla', option)}
                  className="w-full p-3 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      
      case QuestionState.FRECUENCIA_UPDATE:
        return (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">¿Con qué frecuencia se actualiza?</h3>
            <div className="space-y-3">
              {["Mensual", "Trimestral", "Anual"].map(option => (
                <button
                  key={option}
                  onClick={() => handleAnswer('frecuencia_update', option)}
                  className="w-full p-3 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      
      case QuestionState.VULNERABILIDADES_ANTIGUAS:
        return (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">¿Cuando se reportaron las vulnerabilidades antiguas?</h3>
            <div className="space-y-3">
              {["Menos de 1 mes", "1-3 meses", "Más de 3 meses"].map(option => (
                <button
                  key={option}
                  onClick={() => handleAnswer('vulnerabilidades_antiguas', option)}
                  className="w-full p-3 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      
      case QuestionState.VERSIONES_TROYANIZADAS:
        return (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">¿Existen versiones troyanizadas del software?</h3>
            <div className="space-y-3">
              {["Si", "No"].map(option => (
                <button
                  key={option}
                  onClick={() => handleAnswer('versiones_troyanizadas', option)}
                  className="w-full p-3 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      
      case QuestionState.RESULT:
        return (
          <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-center mb-6">Resultado de la evaluación</h2>
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${
                result.approved === "Si" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              } mb-4`}>
                <span className="text-3xl font-bold">{result.approved}</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {result.approved === "Si" ? "Software Aprobado" : "Software No Aprobado"}
              </h3>
              {result.message && (
                <p className="text-gray-700">{result.message}</p>
              )}
            </div>
            
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Descargar reporte:</h3>
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleDownloadPDF()}
                  className="flex-1 p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Descargar PDF
                </button>
                <button 
                  onClick={() => handleDownloadTXT()}
                  className="flex-1 p-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Descargar TXT
                </button>
              </div>
            </div>
            
            {result.approved === "Si" && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Añadir a la base de datos:</h3>
                {!addedToDatabase ? (
                  <div className="space-y-3">


                    <div className="flex flex-col">
                      <label htmlFor="softwareName" className="mb-2 text-sm font-medium text-gray-700">
                        Nombre del software
                      </label>
                      <input
                        id="softwareName"
                        type="text"
                        className="p-3 border rounded-lg focus:border-blue-500"
                        placeholder="Introduzca el nombre del software"
                        value={softwareName}
                        onChange={(e) => setSoftwareName(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="windowsEXE" className="mb-2 text-sm font-medium text-gray-700">
                        Ejecutable en Windows (.exe)
                      </label>
                      <input
                        id="windowsEXE"
                        type="text"
                        className="p-3 border rounded-lg focus:border-blue-500"
                        placeholder="Nombre del archivo .exe"
                        value={softwareWindowsEXE}
                        onChange={(e) => setWindowsEXE(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="macosEXE" className="mb-2 text-sm font-medium text-gray-700">
                        Ejecutable en MacOS (.dmg)
                      </label>
                      <input
                        id="macosEXE"
                        type="text"
                        className="p-3 border rounded-lg focus:border-blue-500"
                        placeholder="Nombre del archivo .dmg"
                        value={softwareMacosEXE}
                        onChange={(e) => setMacosEXE(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="windowsEXE" className="mb-2 text-sm font-medium text-gray-700">
                        Versión del software
                      </label>
                      <input
                        id="version"
                        type="text"
                        className="p-3 border rounded-lg focus:border-blue-500"
                        placeholder="Versión del software"
                        value={softwareVersion}
                        onChange={(e) => setVersion(e.target.value)}
                      />
                    </div>


                    <button
                      onClick={addToDatabase}
                      className="w-full p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Añadir a base de datos
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-green-100 text-green-800 rounded-lg">
                    <p className="font-medium">¡Software añadido correctamente!</p>
                    <p className="text-sm mt-1">Se ha añadido "{softwareName}" a la base de datos.</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Resumen de respuestas:</h3>
              <div className="space-y-2">
                <div className="p-3 border rounded">
                  <p className="font-medium">Política de privacidad:</p>
                  <p>{answers.privacy_policy}</p>
                </div>
                <div className="p-3 border rounded">
                  <p className="font-medium">Certificaciones de seguridad:</p>
                  <p>{answers.certificaciones_sec}</p>
                </div>
                <div className="p-3 border rounded">
                  <p className="font-medium">Vulnerabilidades activas:</p>
                  <p>{answers.vulnerabilidades_activas}</p>
                </div>
                <div className="p-3 border rounded">
                  <p className="font-medium">Desarrollador:</p>
                  <p>{answers.quien_lo_desarrolla}</p>
                </div>
                <div className="p-3 border rounded">
                  <p className="font-medium">Frecuencia de actualización:</p>
                  <p>{answers.frecuencia_update}</p>
                </div>
                <div className="p-3 border rounded">
                  <p className="font-medium">Vulnerabilidades antiguas:</p>
                  <p>{answers.vulnerabilidades_antiguas}</p>
                </div>
                <div className="p-3 border rounded">
                  <p className="font-medium">Versiones troyanizadas???</p>
                  <p>{answers.versiones_troyanizadas}</p>
                </div>
              </div>
            </div>
            
            <button 
              onClick={resetQuiz}
              className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reiniciar Evaluación
            </button>
          </div>
        );
      
      default:
        return <div>Error en el cuestionario.</div>;
    }
  };

  return (
    <div className="p-3">
      <h1 className="text-2xl font-bold mb-4">Add a new software</h1>
      <p className="text-sm mb-6">Completa el siguiente cuestionario para evaluar si el software puede ser añadido.</p>
      
      <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
        {renderProgress()}
        {renderQuestion()}
      </div>
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

export default Products;