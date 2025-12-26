export type Pointer = {
  id: number;
  down: boolean;
  moved: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: [number, number, number];
  lastX: number;
  lastY: number;
};
