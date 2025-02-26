import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import type { NextPageWithLayout } from 'types';
import { useTranslation } from 'next-i18next';
// import { Table } from 'react-daisyui';
import { useSession } from 'next-auth/react';
import { Software } from '@prisma/client';


import { Error, LetterAvatar, Loading } from '@/components/shared';
import { Team, TeamMember } from '@prisma/client';
import useCanAccess from 'hooks/useCanAccess';
import useTeamMembers, { TeamMemberWithUser } from 'hooks/useTeamMembers';
import { Button } from 'react-daisyui';
import toast from 'react-hot-toast';

import { InviteMember } from '@/components/invitation';
// import UpdateMemberRole from './UpdateMemberRole';
import { defaultHeaders } from '@/lib/common';
import type { ApiResponse } from 'types';
// import ConfirmationDialog from '../shared/ConfirmationDialog';
import { useState } from 'react';
import { Table } from '@/components/shared/table/Table';


const Softwares = ({ softwares }: { software: Software }) => {
    const { data: session } = useSession();
    const { t } = useTranslation('common');
    const { canAccess } = useCanAccess();
    const [visible, setVisible] = useState(false);
    const { isLoading, isError, softwares} = useS(
      softwares.slug
    );
  
    if (isLoading) {
      return <Loading />;
    }
  
    if (isError) {
      return <Error message={isError.message} />;
    }
  
    if (!softwares) {
      return null;
    }


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
        cols={cols}
        body={softwares.map((software) => {
            return {
              id: software.id,
              cells: [
                {
                  wrap: true,
                  element: (
                    <div className="flex items-center justify-start space-x-2">
                      <span>{software.user.name}</span>
                    </div>
                  ),
                  minWidth: 200,
                },
                { wrap: true, text: software.user.email, minWidth: 250 },
                {
                  element: canUpdateRole(member) ? (
                    <UpdateMemberRole team={team} member={member} />
                  ) : (
                    <span>{member.role}</span>
                  ),
                },
                {
                  buttons: canRemoveMember(member)
                    ? [
                        {
                          color: 'error',
                          text: t('remove'),
                          onClick: () => {
                            setSelectedMember(member);
                            setConfirmationDialogVisible(true);
                          },
                        },
                      ]
                    : [],
                },
              ],
            };
          })}
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
