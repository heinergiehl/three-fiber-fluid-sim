import type { Pointer } from '../types';

export class PointerTracker {
  private pointers = new Map<number, Pointer>();

  get all(): Pointer[] {
    return Array.from(this.pointers.values());
  }

  pointerDown(id: number, x: number, y: number, color: [number, number, number]): void {
    this.pointers.set(id, {
      id,
      down: true,
      moved: false,
      x,
      y,
      dx: 0,
      dy: 0,
      color,
      lastX: x,
      lastY: y,
    });
  }

  pointerMove(id: number, x: number, y: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) {
      return;
    }
    pointer.dx = x - pointer.lastX;
    pointer.dy = y - pointer.lastY;
    pointer.lastX = x;
    pointer.lastY = y;
    pointer.x = x;
    pointer.y = y;
    pointer.moved = true;
  }

  pointerUp(id: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) {
      return;
    }
    pointer.down = false;
    pointer.moved = false;
  }

  resetMoved(): void {
    for (const pointer of this.pointers.values()) {
      pointer.moved = false;
    }
  }

  dispose(): void {
    this.pointers.clear();
  }
}
