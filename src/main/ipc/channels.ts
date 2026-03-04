export const IPC = {
  // Renderer → Main
  ANALYSE: 'analyse',
  DETECT_PICKS: 'detect-picks',
  SHOW_OVERLAY: 'show-overlay',
  CLOSE_OVERLAY: 'close-overlay',
  MOVE_OVERLAY: 'move-overlay',

  RESIZE_OVERLAY: 'resize-overlay',
  GET_PROVIDER_CONFIG: 'get-provider-config',
  SET_PROVIDER_CONFIG: 'set-provider-config',
  GET_USAGE: 'get-usage',

  // Main → Renderer
  ANALYSIS_RESULT: 'analysis-result',
  ANALYSIS_ERROR: 'analysis-error',
  ANALYSIS_LOADING: 'analysis-loading'
} as const
