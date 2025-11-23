// Minimal stub hook
export function useCurrentUser() {
  return {
    user: {
      id: null as string | null,
      role: null as string | null,
      name: null as string | null,
      email: null as string | null,
      isEarlyAdopter: false as boolean,
    },
  };
}
