import useSWR from 'swr';
import { Software } from '@prisma/client';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const useSoftwareList = () => {
  const { data, error, mutate } = useSWR<Software[]>('/api/software', fetcher);

  return {
    softwareList: data,
    isLoading: !error && !data,
    isError: error,
    mutateSoftwareList: mutate,
  };
};

export default useSoftwareList;