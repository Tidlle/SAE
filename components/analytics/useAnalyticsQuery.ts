import { useCallback, useEffect, useState } from 'react';
import { queryAnalytics } from '../../lib/analytics';

type Query = Parameters<typeof queryAnalytics>[0];
type Data<K extends Query> = Awaited<ReturnType<typeof queryAnalytics<K>>>;

interface State<K extends Query> {
  data: Data<K> | null;
  loading: boolean;
  error: string;
}

// Busca uma consulta do painel quando os parâmetros mudam. Com `params` nulo, não busca (ex.: falta escolher a página).
export const useAnalyticsQuery = <K extends Query>(query: K, params: Parameters<typeof queryAnalytics<K>>[1] | null) => {
  const [state, setState] = useState<State<K>>({ data: null, loading: params !== null, error: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    if (params === null) {
      setState({ data: null, loading: false, error: '' });
      return;
    }
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    queryAnalytics(query, params)
      .then((data) => active && setState({ data: data as Data<K>, loading: false, error: '' }))
      .catch((problem) => active && setState({ data: null, loading: false, error: problem instanceof Error ? problem.message : 'Não foi possível carregar os dados.' }));
    return () => {
      active = false;
    };
    // `key` representa o conteúdo de `params`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, key, reloadKey]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);
  return { ...state, reload };
};
