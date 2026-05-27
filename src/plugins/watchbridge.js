/**
 * WatchBridge Capacitor plugin
 *
 * Receives "watchRun" events fired by the native WatchBridgePlugin
 * when the Apple Watch sends a completed run to the iPhone.
 *
 * Usage:
 *   import WatchBridge from '@/plugins/watchbridge'
 *   WatchBridge.addListener('watchRun', (run) => { ... })
 */
import { registerPlugin } from '@capacitor/core'

const WatchBridge = registerPlugin('WatchBridge')

export default WatchBridge
