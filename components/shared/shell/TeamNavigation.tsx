import { Cog6ToothIcon, CodeBracketIcon, DocumentCheckIcon, CircleStackIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { NavigationProps, MenuItem } from './NavigationItems';

interface NavigationItemsProps extends NavigationProps {
  slug: string;
}

const TeamNavigation = ({ slug, activePathname }: NavigationItemsProps) => {
  const { t } = useTranslation('common');

  const menus: MenuItem[] = [
    {
      name: t('add-software'),
      href: `/teams/${slug}/add_sftware.tsx`,
      icon: DocumentCheckIcon,
      active: activePathname === `/teams/${slug}/add_sftware.tsx`,
    },
    { 
      name: t('approved-softwares'),
      href: `/teams/${slug}/approved_softwares.tsx`,
      icon: CircleStackIcon,
      active: activePathname === `/teams/${slug}/approved_softwares.tsx`,
    },
    {
      name: t('settings'),
      href: `/teams/${slug}/settings`,
      icon: Cog6ToothIcon,
      active:
        activePathname?.startsWith(`/teams/${slug}`) &&
        !activePathname.includes('products'),
    },
  ];

  return <NavigationItems menus={menus} />;
};

export default TeamNavigation;
