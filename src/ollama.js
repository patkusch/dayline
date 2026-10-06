// Ask a model running on this machine to turn the digest into a short standup.
// Nothing leaves the computer: the address is localhost unless you set OLLAMA_HOST.
export async function summarize(markdown, { model, host = process.env.OLLAMA_HOST || 'http://localhost:11434' } = {}) {
  const prompt = 'Write a short standup from these notes, in plain English, first person. '
    + 'Three parts: Done, In progress, Blocked. One line each. Use only what the notes say; do not invent anything.\n\n' + markdown;
  let res;
  try {
    res = await fetch(`${host}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, prompt, stream: false }) });
  } catch {
    throw new Error(`Could not reach a model at ${host}. Start Ollama, or leave out --summarize to get the plain digest.`);
  }
  if (!res.ok) throw new Error(`The model server answered ${res.status}. Check that "${model}" is installed (ollama pull ${model}).`);
  const body = await res.json();
  return String(body.response || '').trim();
}
