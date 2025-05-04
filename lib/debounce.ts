/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last time it was invoked.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>): void => {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Creates a throttled function that only invokes the provided function
 * at most once per every specified wait period.
 *
 * @param func The function to throttle
 * @param wait The number of milliseconds to throttle invocations to
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let lastCall = 0
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>): void => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCall

    if (timeSinceLastCall >= wait) {
      // If enough time has passed, call the function immediately
      lastCall = now
      func(...args)
    } else {
      // Otherwise, schedule it to be called after the remaining time
      if (timeout !== null) {
        clearTimeout(timeout)
      }

      timeout = setTimeout(() => {
        lastCall = Date.now()
        func(...args)
      }, wait - timeSinceLastCall)
    }
  }
}
