// All application service logic now lives in @cookielab.io/klovi.
// Desktop delegates to the shared implementation.
export {
  getGeneralSettings,
  getPluginSettings,
  getProjects,
  getSession,
  getSessions,
  getStats,
  getSubAgent,
  getUpdateSettings,
  getVersion,
  isFirstLaunch,
  resetSettings,
  searchSessions,
  setVersion,
  updateGeneralSettings,
  updatePluginSetting,
  updateUpdateSettings,
} from "@cookielab.io/klovi/services/app-services";
