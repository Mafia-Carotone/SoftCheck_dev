import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { ShieldCheckIcon, CheckBadgeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const HeroSection = () => {
  const { t } = useTranslation('common');
  return (
    <div className="relative min-h-[calc(12vh-1px)]">
      {/* Main content */}
      <div className="hero-content text-center py-24 mx-auto mb-0">
        <div className="max-w-7xl">
          <h1 className="text-6xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            Your Complete Security Solution
          </h1>
          <p className="py-6 text-2xl font-normal text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
            Concerned about your enterprise software security? Discover how we can help you keep your company protected and efficient, with complete control over your applications.
          </p>
          <div className="flex items-center justify-center mt-8">
            <Link
              href="/auth/join"
              className="btn btn-primary btn-lg px-8 no-underline hover:scale-105 transform transition-transform duration-200 shadow-lg hover:shadow-primary/20 text-white hover:text-white"
            >
              Get Started
            </Link>
          </div>
          
          {/* Featured characteristics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8 max-w-4xl mx-auto">
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
              <ShieldCheckIcon className="w-12 h-12 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Guaranteed Protection</h3>
              <p className="text-gray-600 dark:text-gray-300">We detect and prevent risks before they affect your business</p>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
              <CheckBadgeIcon className="w-12 h-12 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Smart Decisions</h3>
              <p className="text-gray-600 dark:text-gray-300">We evaluate each software automatically for your peace of mind</p>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
              <ArrowPathIcon className="w-12 h-12 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Always Updated</h3>
              <p className="text-gray-600 dark:text-gray-300">Keep your software up to date without worries or extra effort</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
