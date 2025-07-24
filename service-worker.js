// Service Worker State
let timerId = null;
let timeRemaining = 25 * 60;
let workDuration = 25 * 60;
let breakDuration = 5 * 60;
let isWorking = true;
let isPaused = true;
let startCoords = null, lastCoords = null, endCoords = null, totalDistance = 0;

// Activate immediately
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Listen for commands from the page
self.addEventListener('message', ({ data }) => {
  const { command, settings, location } = data;
  switch (command) {
    case 'start': startTimer(); break;
    case 'pause': pauseTimer(); break;
    case 'reset': resetTimer(); broadcastUpdate(); break;
    case 'skip': skipSession(); break;
    case 'applySettings': applySettings(settings); broadcastUpdate(); break;
    case 'updateLocation': updateLocation(location); break;
  }
});

function countdown() {
  timeRemaining--;
  if (timeRemaining < 0) {
    finishSession(false);
  } else {
    broadcastTick();
  }
}

function startTimer() {
  if (isPaused) {
    isPaused = false;
    clearInterval(timerId);
    timerId = setInterval(countdown, 1000);
  }
}

function pauseTimer() {
  isPaused = true;
  clearInterval(timerId);
  timerId = null;
  broadcastUpdate();
}

function resetTimer() {
  pauseTimer();
  timeRemaining = isWorking ? workDuration : breakDuration;
  resetLocationState();
}

function skipSession() {
    finishSession(true);
}

function finishSession(skipped) {
    const elapsedSeconds = (isWorking ? workDuration : breakDuration) - timeRemaining;
    const command = skipped ? 'session-skipped' : 'session-finished';
    
    broadcastToClients({
        command,
        state: { duration: elapsedSeconds, startCoords, endCoords: endCoords || lastCoords, totalDistance }
    });

    const sessionType = isWorking ? 'Work' : 'Break';
    const nextSessionType = !isWorking ? 'Work' : 'Break';
    self.registration.showNotification(`Pomodoro: ${sessionType} Session Over!`, {
        body: `Time for your ${nextSessionType} session.`,
        icon: './icon-192.png'
    });

    isWorking = !isWorking;
    resetTimer();
    startTimer();
}

function applySettings(settings) {
  pauseTimer();
  workDuration = settings.workDuration;
  breakDuration = settings.breakDuration;
  isWorking = true;
  timeRemaining = workDuration;
  resetLocationState();
}

function updateLocation(locationData) {
    if(locationData.startCoords) startCoords = locationData.startCoords;
    if(locationData.lastCoords) lastCoords = locationData.lastCoords;
    if(locationData.endCoords) endCoords = locationData.endCoords;
    if(locationData.distanceIncrement) totalDistance += locationData.distanceIncrement;
}

function resetLocationState() {
    startCoords = null; lastCoords = null; endCoords = null; totalDistance = 0;
}

function broadcastState() {
  return { timeRemaining, workDuration, breakDuration, isWorking, isPaused };
}

function broadcastTick() {
  broadcastToClients({ command: 'tick', state: broadcastState() });
}

function broadcastUpdate() {
  broadcastToClients({ command: 'update', state: broadcastState() });
}

function broadcastToClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage(message));
  });
}