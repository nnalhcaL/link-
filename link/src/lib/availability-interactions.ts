export function shouldInspectBusySlotBeforeToggle(
  pointerType: string,
  hasBusyDetails: boolean,
  activeBusySlotKey: string | null,
  slotKey: string,
) {
  return pointerType === 'touch' && hasBusyDetails && activeBusySlotKey !== slotKey;
}
