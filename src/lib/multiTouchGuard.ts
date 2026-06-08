// Pinch-zoom guard — module-level singleton.
// Initialized from MapGL canvas touch listeners; read by all layer click handlers.
// 300ms grace period after last finger lifts prevents accidental marker taps
// when the user ends a pinch gesture (fingers rarely lift simultaneously).

let _pinching = false
let _timer: ReturnType<typeof setTimeout> | null = null

export function markPinchStart(): void {
  _pinching = true
  if (_timer) { clearTimeout(_timer); _timer = null }
}

export function markPinchEnd(): void {
  if (_timer) clearTimeout(_timer)
  _timer = setTimeout(() => {
    _pinching = false
    _timer = null
  }, 300)
}

export function isPinching(): boolean {
  return _pinching
}
