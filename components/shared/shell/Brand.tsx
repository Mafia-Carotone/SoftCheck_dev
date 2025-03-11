import app from '@/lib/app';
import Image from 'next/image';
import useTheme from 'hooks/useTheme';
import Link from 'next/link';

const Brand = () => {
  const { theme } = useTheme();
  return (
    <div className="flex pt-6 shrink-0 items-center text-xl font-bold gap-2 dark:text-gray-100">
      <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
        <Image
          src={theme !== 'dark' ? app.logoUrl : '/logowhite.png'}
          alt={app.name}
          width={30}
          height={30}
        />
        {app.name}
      </Link>
    </div>
  );
};

export default Brand;
