const ONBOARDING_KEY = "breakdownAssistOnboarding";

const readOnboardingState = () => {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeOnboardingState = (state) => {
  try {
    window.localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage failures and continue.
  }
};

export const markOnboardingPending = (uid) => {
  if (!uid) return;

  const state = readOnboardingState();
  state[uid] = true;
  writeOnboardingState(state);
};

export const clearOnboardingPending = (uid) => {
  if (!uid) return;

  const state = readOnboardingState();
  delete state[uid];
  writeOnboardingState(state);
};

export const isOnboardingPending = (uid) => {
  if (!uid) return false;

  const state = readOnboardingState();
  return Boolean(state[uid]);
};
