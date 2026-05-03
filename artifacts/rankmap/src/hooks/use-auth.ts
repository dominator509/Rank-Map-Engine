import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";

export function useAuth() {
  const { data: user, isLoading, error } = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
  };
}
