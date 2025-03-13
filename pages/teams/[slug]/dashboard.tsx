import { useState, useEffect } from 'react';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { Card, Badge, Table } from 'react-daisyui';
import { Loading, Error } from '@/components/shared';
import useSoftwareList from 'hooks/useSoftwareList';

const Dashboard = () => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { isLoading, isError, softwareList } = useSoftwareList();
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  useEffect(() => {
    // Simulamos carga de noticias
    const timer = setTimeout(() => {
      const dummyNews = generateDummyNews(softwareList || []);
      setNewsItems(dummyNews);
      setIsLoadingNews(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [softwareList]);

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Error message={isError.message} />;
  }

  if (!softwareList) {
    return null;
  }

  // Calcular estadísticas
  const totalSoftware = softwareList.length;
  const approvedSoftware = softwareList.filter(software => software.approved).length;
  const notApprovedSoftware = totalSoftware - approvedSoftware;
  const approvedPercentage = totalSoftware > 0 ? Math.round((approvedSoftware / totalSoftware) * 100) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium leading-none tracking-tight mb-4">{t('dashboard')}</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title={t('total-software')} 
          value={totalSoftware} 
          color="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
        />
        <StatsCard 
          title={t('approved-software')} 
          value={approvedSoftware} 
          percentage={approvedPercentage} 
          color="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
        />
        <StatsCard 
          title={t('denied-software')} 
          value={notApprovedSoftware} 
          percentage={100 - approvedPercentage}
          color="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
        />
      </div>

      {/* Pie Chart */}
      <div className="card bg-base-100 shadow-xl transform transition-all duration-200 border-gray-200 dark:border-gray-700 rounded-2xl">
        <div className="card-body">
          <h3 className="card-title">{t('software-distribution')}</h3>
          <div className="flex justify-center py-4">
            {/* Gráfico de pastel simplificado */}
            <div className="relative w-48 h-48">
              {/* Fondo completo rojo (denegados) */}
              <div className="absolute inset-0 rounded-full bg-red-500"></div>
              
              {/* Porción verde que se ajusta según el porcentaje de aprobados */}
              <div 
                className="absolute inset-0 rounded-full bg-green-500 origin-center"
                style={{
                  clipPath: approvedSoftware > 0 
                    ? `polygon(50% 50%, 50% 0%, ${approvedSoftware === totalSoftware 
                      ? '50% 100%, 50% 0%' 
                      : `100% 0%, 100% 100%, 0% 100%, 0% 0%`})`
                    : 'none',
                  transform: `rotate(${(100 - approvedPercentage) * 3.6}deg)`,
                }}
              ></div>
              
              {/* Círculo interior blanco para crear efecto donut */}
              <div className="absolute rounded-full bg-base-100" style={{
                top: '25%',
                left: '25%',
                width: '50%',
                height: '50%',
              }}></div>
              
              {/* Texto central con porcentaje */}
              <div className="absolute inset-0 flex items-center justify-center font-bold text-xl">
                <div className="text-center">
                  <span className="text-green-500">{approvedPercentage}%</span>
                  <br />
                  <span className="text-xs text-gray-500">{t('approved')}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 mr-2"></div>
              <span>{t('approved')} ({approvedSoftware})</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 mr-2"></div>
              <span>{t('denied')} ({notApprovedSoftware})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Software */}
      <div className="card bg-base-100 shadow-xl transform transition-all duration-200 border-gray-200 dark:border-gray-700 rounded-2xl">
        <div className="card-body">
          <h3 className="card-title">{t('latest-software')}</h3>
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>{t('name')}</th>
                  <th>{t('version')}</th>
                  <th>{t('status')}</th>
                  <th>{t('approval-date')}</th>
                </tr>
              </thead>
              <tbody>
                {[...softwareList]
                  .sort((a, b) => new Date(b.approvalDate).getTime() - new Date(a.approvalDate).getTime())
                  .slice(0, 5)
                  .map((software) => (
                    <tr key={software.id}>
                      <td>{software.softwareName}</td>
                      <td>{software.version}</td>
                      <td>
                        {software.approved ? (
                          <Badge color="success">{t('approved')}</Badge>
                        ) : (
                          <Badge color="error">{t('denied')}</Badge>
                        )}
                      </td>
                      <td>{new Date(software.approvalDate).toLocaleDateString()}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* News Related to Software */}
      <div className="card bg-base-100 shadow-xl transform transition-all duration-200 border-gray-200 dark:border-gray-700 rounded-2xl">
        <div className="card-body">
          <h3 className="card-title">{t('Cybersecurity news')}</h3>
          {isLoadingNews ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>{t('date')}</th>
                    <th>{t('software')}</th>
                    <th>{t('title')}</th>
                    <th>{t('source')}</th>
                  </tr>
                </thead>
                <tbody>
                  {newsItems.map((news, index) => (
                    <tr key={index}>
                      <td>{news.date}</td>
                      <td>{news.software}</td>
                      <td>
                        <a 
                          href={news.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {news.title}
                        </a>
                      </td>
                      <td>{news.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente para mostrar una tarjeta de estadísticas
const StatsCard = ({ title, value, percentage, color }: { title: string, value: number, percentage?: number, color: string }) => {
  return (
    <div className={`card ${color} shadow-xl transform transition-all duration-200 border-gray-200 dark:border-gray-700 rounded-2xl`}>
      <div className="card-body">
        <h3 className="card-title">{title}</h3>
        <div className="text-center">
          <p className="text-4xl font-bold">{value}</p>
          {percentage !== undefined && (
            <div className="text-sm mt-2">
              {percentage}% del total
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Función para generar noticias de ejemplo basadas en el software existente
function generateDummyNews(softwareList: any[]) {
  const news: Array<{
    date: string;
    software: string;
    title: string;
    source: string;
    url: string;
  }> = [];
  const sources = ['TechCrunch', 'The Verge', 'Wired', 'ArsTechnica', 'ZDNet'];
  const dates = [
    '2023-05-15', '2023-06-22', '2023-07-10', 
    '2023-08-05', '2023-09-18', '2023-10-27',
    '2023-11-14', '2023-12-03', '2024-01-20',
    '2024-02-11', '2024-03-08', '2024-04-17'
  ];
  
  // Solo usar software con nombres para generar noticias
  const validSoftware = softwareList.filter(sw => sw.softwareName && sw.softwareName.trim() !== '');
  
  if (validSoftware.length === 0) {
    return [
      {
        date: '2024-04-25',
        software: 'General',
        title: 'El mercado de software empresarial crece un 15% en 2024',
        source: 'Forbes',
        url: 'https://www.forbes.com'
      },
      {
        date: '2024-04-15',
        software: 'General',
        title: 'Nuevas regulaciones de ciberseguridad afectarán al software empresarial',
        source: 'Bloomberg',
        url: 'https://www.bloomberg.com'
      }
    ];
  }
  
  // Generar noticias basadas en software existente
  for (let i = 0; i < Math.min(10, validSoftware.length * 2); i++) {
    const randomSoftware = validSoftware[Math.floor(Math.random() * validSoftware.length)];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    const randomDate = dates[Math.floor(Math.random() * dates.length)];
    
    const headlines = [
      `Nueva actualización de ${randomSoftware.softwareName} soluciona vulnerabilidades críticas`,
      `${randomSoftware.softwareName} anuncia integración con herramientas de IA`,
      `Descubren fallo de seguridad en versiones antiguas de ${randomSoftware.softwareName}`,
      `${randomSoftware.softwareName} mejora su interfaz en la última versión`,
      `Empresa desarrolladora de ${randomSoftware.softwareName} anuncia nuevas características`
    ];
    
    const randomHeadline = headlines[Math.floor(Math.random() * headlines.length)];
    
    news.push({
      date: randomDate,
      software: randomSoftware.softwareName,
      title: randomHeadline,
      source: randomSource,
      url: `https://www.${randomSource.toLowerCase().replace(' ', '')}.com/article/${randomSoftware.softwareName.toLowerCase().replace(' ', '-')}`
    });
  }
  
  // Ordenar por fecha (más reciente primero)
  return news.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getServerSideProps({
  locale,
}: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default Dashboard; 