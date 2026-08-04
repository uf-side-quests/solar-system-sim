export type ScreenPoint = Readonly<{ x: number; y: number }>;

export function rayToViewportEdge(
  origin: ScreenPoint,
  direction: ScreenPoint,
  viewportWidth: number,
  viewportHeight: number,
  margin: number,
): ScreenPoint {
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= margin * 2 ||
    viewportHeight <= margin * 2
  ) {
    throw new Error("Sun guide viewport must contain its margin");
  }
  const directionLength = Math.hypot(direction.x, direction.y);
  if (!Number.isFinite(directionLength) || directionLength <= 0) {
    throw new Error("Sun guide direction must be positive and finite");
  }
  const normalized = {
    x: direction.x / directionLength,
    y: direction.y / directionLength,
  };
  const candidates: number[] = [];
  if (normalized.x > 0) {
    candidates.push((viewportWidth - margin - origin.x) / normalized.x);
  } else if (normalized.x < 0) {
    candidates.push((margin - origin.x) / normalized.x);
  }
  if (normalized.y > 0) {
    candidates.push((viewportHeight - margin - origin.y) / normalized.y);
  } else if (normalized.y < 0) {
    candidates.push((margin - origin.y) / normalized.y);
  }
  const forwardIntersections = candidates.filter(
    (distance) => Number.isFinite(distance) && distance >= 0,
  );
  const edgeDistance = Math.min(...forwardIntersections);
  if (!Number.isFinite(edgeDistance)) {
    throw new Error("Sun guide ray does not intersect the viewport");
  }
  return {
    x: origin.x + normalized.x * edgeDistance,
    y: origin.y + normalized.y * edgeDistance,
  };
}

export function pointInsideViewport(
  point: ScreenPoint,
  viewportWidth: number,
  viewportHeight: number,
  margin: number,
): boolean {
  return (
    point.x >= margin &&
    point.x <= viewportWidth - margin &&
    point.y >= margin &&
    point.y <= viewportHeight - margin
  );
}
