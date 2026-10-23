/** Decode complete SSE events, including providers that omit the last blank line. */
export async function readEvents(body: ReadableStream<Uint8Array>, consume: (data: string) => boolean | void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  const line = (value: string) => {
    if (!value.trim()) {
      const payload = data.join('\n');
      data = [];
      return payload ? consume(payload) : false;
    }
    if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, '').replace(/\r$/, ''));
    return false;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const current = buffer.slice(0, end).replace(/\r$/, '');
        buffer = buffer.slice(end + 1);
        if (line(current)) return;
      }
      if (done) {
        if (buffer && line(buffer)) return;
        line('');
        return;
      }
    }
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
