console.log("[analytics-queue:clear] Client analytics queue is stored on-device (AsyncStorage).");
console.log(
  "[analytics-queue:clear] This CLI cannot directly clear phone storage."
);
console.log(
  "[analytics-queue:clear] To clear queued client events, clear app storage in Expo Go (or reinstall Expo Go), then restart the app."
);
console.log(
  "[analytics-queue:clear] To clear server-side stored events, run `npm run analytics:reset`."
);

