import useSWR from 'swr';
import { Software } from '@prisma/client';
import { useRouter } from 'next/router';

interface ApiResponse<T> {
  data: T;
  error?: {
    message: string;
  };
}

interface SoftwareResponse {
  data: Software[];
  error?: {
    message: string;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const useSoftwareList = () => {
  const router = useRouter();
  const teamSlug = router.query.slug as string;
  
  const { data, error, mutate } = useSWR<SoftwareResponse>(
    teamSlug ? `/api/teams/${teamSlug}/software` : null,
    fetcher
  );

  return {
    softwareList: data?.data || [],
    isLoading: !data && !error,
    isError: error,
    mutateSoftwareList: mutate,
  };
};

export default useSoftwareList;