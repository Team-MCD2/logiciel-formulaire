const crypto = require('crypto');

const API_URL = 'http://localhost:3000/api';
const FORM_ID = 'YOUR_FORM_ID_HERE'; // Replace with a valid form ID
const NUM_REQUESTS = 10; // Number of parallel requests

async function sha256(str) {
  const hash = crypto.createHash('sha256');
  hash.update(str);
  return hash.digest('hex');
}

async function solveChallenge(challenge, difficulty) {
  let nonce = 0;
  const prefix = '0'.repeat(difficulty);
  while (true) {
    const hash = await sha256(`${challenge}:${nonce}`);
    if (hash.startsWith(prefix)) {
      return nonce.toString();
    }
    nonce++;
  }
}

async function submitForm(id) {
  try {
    // 1. Get challenge
    console.log(`[Request ${id}] Fetching challenge...`);
    const challengeRes = await fetch(`${API_URL}/challenge`);
    if (!challengeRes.ok) {
      throw new Error(`Failed to fetch challenge: ${challengeRes.status}`);
    }
    const { challenge, timestamp, difficulty } = await challengeRes.json();
    
    // 2. Solve challenge
    console.log(`[Request ${id}] Solving PoW challenge...`);
    const nonce = await solveChallenge(challenge, difficulty);

    // 3. Submit payload
    console.log(`[Request ${id}] Submitting payload...`);
    const payload = {
      nom: `Test User ${id}`,
      email: `test${id}@example.com`,
      message: `Ceci est le message test numéro ${id} envoyé en parallèle.`,
      _lang: 'fr',
      pow_challenge: challenge,
      pow_timestamp: timestamp,
      pow_nonce: nonce
    };

    const submitRes = await fetch(`${API_URL}/submit/${FORM_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000' // Change this to your frontend origin to test CORS
      },
      body: JSON.stringify(payload)
    });

    const result = await submitRes.json();
    
    if (submitRes.ok) {
      console.log(`✅ [Request ${id}] Success:`, result);
    } else {
      console.log(`❌ [Request ${id}] Failed (${submitRes.status}):`, result.code, result.error, result.remedy);
    }
  } catch (err) {
    console.error(`🚨 [Request ${id}] Error:`, err.message);
  }
}

async function runParallelTests() {
  if (FORM_ID === 'YOUR_FORM_ID_HERE') {
    console.error('PLEASE UPDATE FORM_ID BEFORE RUNNING');
    return;
  }
  
  console.log(`Starting ${NUM_REQUESTS} parallel requests...`);
  const promises = [];
  for (let i = 1; i <= NUM_REQUESTS; i++) {
    promises.push(submitForm(i));
  }
  await Promise.all(promises);
  console.log('All parallel requests finished.');
}

runParallelTests();
