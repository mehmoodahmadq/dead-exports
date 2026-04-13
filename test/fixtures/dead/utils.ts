export function usedHelper(x: number): number {
  return x * 2;
}

export function deadHelper(x: number): number {
  return x * 3;
}

export const DEAD_CONSTANT = "nobody uses me";

export default function deadDefault() {
  return "also dead";
}
