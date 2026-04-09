export function getMobileVisibleDayCount(viewportWidth: number): 2 | 3 {
  return viewportWidth >= 390 ? 3 : 2;
}

export function getMobileDatePageRange(activeIndex: number, visibleDayCount: number, totalDayCount: number) {
  const safeTotalDayCount = Math.max(0, totalDayCount);
  const safeVisibleDayCount = Math.max(1, visibleDayCount);

  if (safeTotalDayCount === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
    };
  }

  const boundedActiveIndex = Math.min(Math.max(activeIndex, 0), safeTotalDayCount - 1);
  const startIndex = Math.floor(boundedActiveIndex / safeVisibleDayCount) * safeVisibleDayCount;

  return {
    startIndex,
    endIndex: Math.min(safeTotalDayCount, startIndex + safeVisibleDayCount),
  };
}

export function getSlotPointerDownBehavior(pointerType: string, hasBusyDetails: boolean) {
  return {
    shouldActivateBusySlotPreview: pointerType === 'touch' && hasBusyDetails,
    shouldBeginPaint: true,
  };
}
