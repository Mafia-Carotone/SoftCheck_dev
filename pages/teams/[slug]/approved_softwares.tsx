import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import type { NextPageWithLayout } from 'types';
import { useTranslation } from 'next-i18next';
import { Table } from 'react-daisyui';

const Products: NextPageWithLayout = () => {
  const { t } = useTranslation('common');


  const cols = [t('ID'), t('Software name'), t('Windows Executable'), t('MacOS Executable'), t('Software Version'), t('Approval Date')];

  return (
    <div className="space-y-3">
        <div className="p-3">
            <p className="text-sm">{'approved softwares web page'}</p>
            <p className="text-sm">{t('product-placeholder')}</p>
        </div>
        <Table
        //cols={cols}
        
        ></Table>
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
