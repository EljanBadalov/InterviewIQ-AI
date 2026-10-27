import { QueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { onSessionReset } from "./authScope";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => {
        const failure = error as AxiosError;
        if (failure.code === "ERR_CANCELED") return false;
        const status = failure.response?.status;
        return count < 1 && (status === undefined || status >= 500);
      },
      retryDelay: 500,
    },
    mutations: { retry: false },
  },
});

onSessionReset(() => {
  void queryClient.cancelQueries();
  queryClient.clear();
});
