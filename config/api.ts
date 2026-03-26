import Constants from "expo-constants";

// For development: Detect the machine's local IP automatically so it works on real devices
// For production: Use your backend's actual deployment URL
const debuggerHost = Constants.expoConfig?.hostUri;
const localIp = debuggerHost ? debuggerHost.split(":")[0] : "localhost";

const DEV_API_URL = `http://${localIp}:5000`;
const PROD_API_URL = "https://your-production-backend.com"; // 👈 Replace when deploying

export const BASE_URL = __DEV__ ? `${DEV_API_URL}/api` : `${PROD_API_URL}/api`;
export const SOCKET_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
