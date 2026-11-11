import { useEffect, useState } from 'react';
import { api } from '../../game/backend.js';
export default function useStudentsPage(
  { page, search = '', classFilter = 'all', sort = 'desc', rosterClass = '', membership = 'all' },
  revision = 0,
) {
  const [data, setData] = useState(null),
    [loadedKey, setLoadedKey] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const key = JSON.stringify([page, search, classFilter, sort, rosterClass, membership, revision]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(
      () =>
        api('students_page', undefined, {
          page,
          search,
          classFilter,
          sort,
          rosterClass,
          membership,
        })
          .then((result) => {
            if (current) {
              if (
                !Array.isArray(result.students) ||
                !Number.isInteger(result.page) ||
                !Number.isInteger(result.pages)
              )
                throw Error('Danh sách học sinh chưa tải được.');
              setData(result);
              setLoadedKey(key);
            }
          })
          .catch((failure) => {
            if (current) setError(failure.message);
          })
          .finally(() => {
            if (current) setLoading(false);
          }),
      150,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [page, search, classFilter, sort, rosterClass, membership, revision]);
  return { data, loading: loading || (!error && key !== loadedKey), error };
}
