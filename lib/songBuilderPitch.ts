/** Lightweight autocorrelation pitch estimate and correlation score for reviewable local transcription. */
export function estimateSongPitchWithConfidence(samples: Float32Array, sampleRate: number): { pitch: number; confidence: number } | null {
  const stride = Math.max(1, Math.floor(samples.length / 1024));
  const reduced = new Float32Array(Math.floor(samples.length / stride));
  let energy = 0;
  for (let i = 0; i < reduced.length; i += 1) {
    let total = 0;
    for (let j = 0; j < stride; j += 1) total += samples[i * stride + j] ?? 0;
    reduced[i] = total / stride;
    energy += reduced[i] * reduced[i];
  }
  if (!reduced.length || Math.sqrt(energy / reduced.length) < 0.018) return null;
  const rate = sampleRate / stride;
  const minLag = Math.max(2, Math.floor(rate / 1100));
  const maxLag = Math.min(reduced.length - 4, Math.floor(rate / 35));
  let bestLag = 0;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let cross = 0;
    let left = 0;
    let right = 0;
    for (let i = 0; i < reduced.length - lag; i += 2) {
      const a = reduced[i];
      const b = reduced[i + lag];
      cross += a * b;
      left += a * a;
      right += b * b;
    }
    const score = cross / Math.sqrt(Math.max(1e-9, left * right));
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  if (!bestLag || bestScore < 0.74) return null;
  return { pitch: Math.round(69 + 12 * Math.log2((rate / bestLag) / 440)), confidence: Math.max(0, Math.min(1, bestScore)) };
}

export function estimateSongPitch(samples: Float32Array, sampleRate: number): number | null {
  return estimateSongPitchWithConfidence(samples, sampleRate)?.pitch ?? null;
}

/** Local spectral peak pass for suggesting several simultaneous pitches from a short clip. */
export function estimateSongPitches(samples: Float32Array, sampleRate: number, maxNotes = 6): number[] {
  const size = 2 ** Math.floor(Math.log2(samples.length));
  if (size < 1024 || !Number.isFinite(sampleRate) || sampleRate <= 0) return [];

  const real = new Float64Array(size);
  const imag = new Float64Array(size);
  let energy = 0;
  for (let index = 0; index < size; index += 1) {
    const sample = samples[index] ?? 0;
    energy += sample * sample;
    real[index] = sample * (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1)));
  }
  if (Math.sqrt(energy / size) < 0.008) return [];

  // In-place radix-2 FFT.
  for (let i = 1, j = 0; i < size; i += 1) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);
    for (let offset = 0; offset < size; offset += length) {
      let twiddleReal = 1;
      let twiddleImag = 0;
      const half = length >> 1;
      for (let index = 0; index < half; index += 1) {
        const even = offset + index;
        const odd = even + half;
        const oddReal = real[odd] * twiddleReal - imag[odd] * twiddleImag;
        const oddImag = real[odd] * twiddleImag + imag[odd] * twiddleReal;
        real[odd] = real[even] - oddReal;
        imag[odd] = imag[even] - oddImag;
        real[even] += oddReal;
        imag[even] += oddImag;
        const nextReal = twiddleReal * stepReal - twiddleImag * stepImag;
        twiddleImag = twiddleReal * stepImag + twiddleImag * stepReal;
        twiddleReal = nextReal;
      }
    }
  }

  const magnitude = new Float64Array(size >> 1);
  let maximum = 0;
  for (let bin = 1; bin < magnitude.length; bin += 1) {
    const value = Math.hypot(real[bin], imag[bin]);
    magnitude[bin] = value;
    maximum = Math.max(maximum, value);
  }
  if (!maximum) return [];

  const peaks: Array<{ midi: number; frequency: number; strength: number }> = [];
  const minBin = Math.max(2, Math.floor((440 * 2 ** ((28 - 69) / 12) * size) / sampleRate));
  const maxBin = Math.min(magnitude.length - 2, Math.ceil((440 * 2 ** ((96 - 69) / 12) * size) / sampleRate));
  for (let bin = minBin; bin <= maxBin; bin += 1) {
    const strength = magnitude[bin];
    if (strength < maximum * 0.09 || strength < magnitude[bin - 1] || strength < magnitude[bin + 1]) continue;
    const left = Math.log(Math.max(1e-12, magnitude[bin - 1]));
    const center = Math.log(Math.max(1e-12, strength));
    const right = Math.log(Math.max(1e-12, magnitude[bin + 1]));
    const denominator = left - 2 * center + right;
    const adjustment = Math.abs(denominator) < 1e-9 ? 0 : Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / denominator));
    const frequency = ((bin + adjustment) * sampleRate) / size;
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
    if (midi >= 28 && midi <= 96) peaks.push({ midi, frequency, strength });
  }

  const ranked = peaks.sort((left, right) => right.strength - left.strength);
  const selected: typeof ranked = [];
  for (const peak of ranked) {
    if (selected.some((item) => Math.abs(item.midi - peak.midi) <= 1)) continue;
    const harmonic = selected.some((item) => {
      if (item.frequency >= peak.frequency) return false;
      const ratio = peak.frequency / item.frequency;
      const nearest = Math.round(ratio);
      return nearest >= 2 && nearest <= 6 && Math.abs(ratio - nearest) < 0.035 && item.strength >= peak.strength * 0.22;
    });
    if (!harmonic) selected.push(peak);
    if (selected.length >= maxNotes) break;
  }
  return selected.map((item) => item.midi).sort((left, right) => left - right);
}

export function songPitchName(midi: number): string {
  return `${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
