import Link from 'next/link';
import { type ReactElement } from 'react';
import { useTranslation } from 'next-i18next';
import type { NextPageWithLayout } from 'types';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import FAQSection from '@/components/defaultLanding/FAQSection';
import HeroSection from '@/components/defaultLanding/HeroSection';
import FeatureSection from '@/components/defaultLanding/FeatureSection';
import PricingSection from '@/components/defaultLanding/PricingSection';
import useTheme from 'hooks/useTheme';
import env from '@/lib/env';
import Head from 'next/head';
import Image from 'next/image';
import app from '@/lib/app';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

const Home: NextPageWithLayout = () => {
  const { t } = useTranslation('common');
  const { theme, toggleTheme } = useTheme();
  const selectedTheme = theme === 'dark' ? 
    { icon: SunIcon } : 
    { icon: MoonIcon };

  return (
    <>
      <Head>
        <title>{t('homepage-title')}</title>
      </Head>

      <div className="container mx-auto">
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="container mx-auto">
            <div className="navbar backdrop-blur-sm bg-base-100/70 px-4 sm:px-6 shadow-sm">
              <div className="flex-1">
                <Link href="/" className="btn btn-ghost text-xl normal-case flex items-center gap-2 hover:bg-transparent">
                  <Image
                    src={app.logoUrl}
                    alt={app.name}
                    width={30}
                    height={30}
                    className="transition-transform hover:scale-110"
                  />
                  {app.name}
                </Link>
              </div>
              <div className="flex-none">
                <div className="flex items-center gap-2 sm:gap-4">
                  <ul className="menu menu-horizontal flex items-center gap-2 sm:gap-4">
                    {env.darkModeEnabled && (
                      <li>
                        <button
                          className="bg-transparent hover:bg-base-200/50 p-2 rounded-lg flex items-center justify-center transition-colors"
                          onClick={toggleTheme}
                        >
                          <selectedTheme.icon className="w-5 h-5" />
                        </button>
                      </li>
                    )}
                    <li>
                      <Link
                        href="/auth/join"
                        className="btn btn-primary btn-md py-3 px-4 sm:px-6 text-white hover:scale-105 transform transition-all duration-200"
                      >
                        {t('sign-up')}
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/auth/login"
                        className="btn btn-primary dark:border-zinc-600 dark:border-2 dark:text-zinc-200 btn-outline py-3 px-4 sm:px-6 btn-md hover:scale-105 transform transition-all duration-200"
                      >
                        {t('sign-in')}
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Espaciador para compensar la navbar fija */}
        <div className="h-20"></div>
        
        <HeroSection />
        <div className="divider"></div>
        <FeatureSection />
        <div className="divider"></div>
        <PricingSection />
        <div className="divider"></div>
        <FAQSection />
      </div>
    </>
  );
};

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  // Redirect to login page if landing page is disabled
  if (env.hideLandingPage) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: true,
      },
    };
  }

  const { locale } = context;

  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
};

Home.getLayout = function getLayout(page: ReactElement) {
  return <>{page}</>;
};

export default Home;
