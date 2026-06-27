import { useEffect, useState } from "react";

type State<T> = { loading: boolean; data?: T; error?: Error };

/** 의존성 변경 시 비동기 함수를 실행하고 stale 결과를 버리는 작은 훅. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): State<T> {
  const [state, setState] = useState<State<T>>({ loading: true });

  useEffect(() => {
    let alive = true;
    // 로딩 표시는 비동기로 (effect 내 동기 setState 회피).
    Promise.resolve()
      .then(() => alive && setState({ loading: true }))
      .then(fn)
      .then((data) => alive && setState({ loading: false, data }))
      .catch((error) => alive && setState({ loading: false, error: error as Error }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
