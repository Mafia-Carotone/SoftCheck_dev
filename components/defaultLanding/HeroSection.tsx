import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { ShieldCheckIcon, CheckBadgeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const HeroSection = () => {
  const { t } = useTranslation('common');
  return (
    <div className="relative min-h-[calc(100vh-1px)]">
      {/* Contenido principal */}
      <div className="hero-content text-center py-24">
        <div className="max-w-7xl">
          <h1 className="text-6xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            {t('enterprise-saas-kit')}
          </h1>
          <p className="py-6 text-2xl font-normal text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
            Automatiza la gestión de software empresarial. Mantén tu empresa segura y eficiente con un control total sobre las aplicaciones.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <Link
              href="/auth/join"
              className="btn btn-primary btn-lg px-8 no-underline hover:scale-105 transform transition-transform duration-200 shadow-lg hover:shadow-primary/20 text-white hover:text-white"
            >
              {t('get-started')}
            </Link>
            <Link
              href="https://github.com/boxyhq/saas-starter-kit"
              className="btn btn-outline btn-lg px-8 hover:scale-105 transform transition-transform duration-200"
            >
              GitHub
            </Link>
          </div>
          
          {/* Características destacadas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-4xl mx-auto">
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
              <ShieldCheckIcon className="w-12 h-12 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Seguridad Garantizada</h3>
              <p className="text-gray-600 dark:text-gray-300">Evaluación automática de riesgos en software</p>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
              <CheckBadgeIcon className="w-12 h-12 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Aprobación Inteligente</h3>
              <p className="text-gray-600 dark:text-gray-300">Proceso automatizado basado en políticas</p>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
              <ArrowPathIcon className="w-12 h-12 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Gestión Continua</h3>
              <p className="text-gray-600 dark:text-gray-300">Monitoreo y actualización automática</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
