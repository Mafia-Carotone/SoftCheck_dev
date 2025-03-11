import { useRouter } from 'next/router';
import Link from 'next/link';

const LanguageSelector = () => {
  const router = useRouter();
  const { pathname, asPath, query } = router;

  return (
    <div className="flex items-center space-x-2">
      <Link
        href={{ pathname, query }}
        as={asPath}
        locale={router.locale === 'en' ? 'es' : 'en'}
        className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        {router.locale === 'en' ? 'ES' : 'EN'}
      </Link>
    </div>
  );
};

export default LanguageSelector; 