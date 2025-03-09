import useSWR from 'swr';
import { Software } from '@prisma/client';
import { slug } from '@/lib/zod/primitives';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const useSoftwareList = () => {
  const { data, error, mutate } = useSWR<Software[]>(`/api/teams/${slug}/software`, fetcher);

  return {
    softwareList: data?.data || [],
    isLoading: !data && !error,
    isError: error,
    mutateSoftwareList: mutate,
  };
};

export default useSoftwareList;