export const TARGET_SAMPLE_RATE = 16000

export function mergeFloat32Chunks(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  return merged
}

export function downsampleAudioBuffer(buffer, inputSampleRate, outputSampleRate = TARGET_SAMPLE_RATE) {
  if (!buffer.length) return new Float32Array()
  if (inputSampleRate === outputSampleRate) return buffer
  if (inputSampleRate < outputSampleRate) {
    throw new Error(`Cannot upsample audio from ${inputSampleRate}Hz to ${outputSampleRate}Hz`)
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate
  const newLength = Math.round(buffer.length / sampleRateRatio)
  const result = new Float32Array(newLength)

  let offsetResult = 0
  let offsetBuffer = 0

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
    let accum = 0
    let count = 0

    for (let index = offsetBuffer; index < nextOffsetBuffer && index < buffer.length; index += 1) {
      accum += buffer[index]
      count += 1
    }

    result[offsetResult] = count > 0 ? accum / count : 0
    offsetResult += 1
    offsetBuffer = nextOffsetBuffer
  }

  return result
}

export function floatTo16BitPCM(float32Buffer) {
  const pcmBuffer = new Int16Array(float32Buffer.length)

  for (let index = 0; index < float32Buffer.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, float32Buffer[index]))
    pcmBuffer[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  return pcmBuffer
}

export function pcm16ToBase64(pcmBuffer) {
  const bytes = new Uint8Array(pcmBuffer.buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}