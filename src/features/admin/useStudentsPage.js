import { useEffect, useRef, useState } from 'react';
import { api } from '../../game/backend.js';
export default function useStudentsPage(
  { page, search = '', classFilter = 'all', sort = 'desc', rosterClass = '', membership = 'all' },
  revision = 0,
) {
  const [data, setData] = useState(null),
    [loadedKey, setLoadedKey] = useState(''),
    [loading, setLoading] = useState(true),
    [starRevision, setStarRevision] = useState(0),
    [error, setError] = useState('');
  const currentData = useRef(data);
  currentData.current = data;
  const key = JSON.stringify([
    page,
    search,
    classFilter,
    sort,
    rosterClass,
    membership,
    revision,
    starRevision,
  ]);
  useEffect(() => {
    const refresh = (event) => {
      const { userId, stars } = event.detail || {};
      if (Number.isFinite(stars)) {
        setData(
          (current) =>
            current && {
              ...current,
              students: current.students.map((s) => (s.user_id === userId ? { ...s, stars } : s)),
            },
        );
      } else if (currentData.current?.students.some((s) => s.user_id === userId)) {
        setStarRevision((n) => n + 1);
      }
    };
    const refreshPage = () => setStarRevision((n) => n + 1);
    const visible = () => {
      if (!document.hidden) refreshPage();
    };
    window.addEventListener('tipy-points-changed', refresh);
    window.addEventListener('focus', refreshPage);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('tipy-points-changed', refresh);
      window.removeEventListener('focus', refreshPage);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
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
  }, [page, search, classFilter, sort, rosterClass, membership, revision, starRevision]);
  return { data, loading: loading || (!error && key !== loadedKey), error };
}
