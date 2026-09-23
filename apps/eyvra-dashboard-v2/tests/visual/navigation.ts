export function usePathname() {
  return window.location.pathname.includes("listings") ? "/listings" : "/command-center";
}
export function useSearchParams() {
  return new URLSearchParams(window.location.search);
}
