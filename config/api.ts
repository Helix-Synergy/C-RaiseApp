import Constants from "expo-constants";

// For development: Detect the machine's local IP automatically so it works on real devices
// For production: Use your backend's actual deployment URL
const debuggerHost = Constants.expoConfig?.hostUri;
const localIp = debuggerHost ? debuggerHost.split(":")[0] : "localhost";

const DEV_API_URL = "https://c-raise-backend.onrender.com";
const PROD_API_URL = "https://c-raise-backend.onrender.com";

export const BASE_URL = `${PROD_API_URL}/api`;
export const SOCKET_URL = PROD_API_URL;
