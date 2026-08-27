type LoopsContactPayload = {
  email: string;
  source: string;
  [key: string]: unknown;
};

type LoopsEventPayload = {
  email: string;
  eventName: string;
  [key: string]: unknown;
};

export async function createLoopsContact(
  loopsApiKey: string | undefined,
  payload: LoopsContactPayload
) {
  if (!loopsApiKey) return;

  const response = await fetch('https://app.loops.so/api/v1/contacts/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loopsApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Loops contact create failed');
  }
}

export async function sendLoopsEvent(
  loopsApiKey: string | undefined,
  payload: LoopsEventPayload
) {
  if (!loopsApiKey) return;

  const response = await fetch('https://app.loops.so/api/v1/events/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loopsApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Loops event send failed');
  }
}
