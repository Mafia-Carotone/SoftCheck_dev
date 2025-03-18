import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { useRouter } from 'next/router';
import { Software } from '@prisma/client';

export default function useSoftwareList() {
  const router = useRouter();
  const { slug } = router.query;

  const { data, error, mutate } = useSWR<{ data: Software[] }>(
    slug ? `/api/teams/${slug}/software` : null,
    fetcher
  );

  return {
    softwareList: data?.data,
    isLoading: !error && !data,
    isError: error,
    mutateSoftwareList: mutate,
  };
}