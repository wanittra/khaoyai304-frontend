import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
import coreUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
import modelUrl from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url'

let worker: Worker | undefined
let queue: Promise<unknown> = Promise.resolve()

const stampRegions = [
  [0.71, 0.961, 0.29, 0.039],
  // Cuddeback prints light text on a dark strip at the lower left.
  [0.05, 0.958, 0.36, 0.04, true],
  [0.04, 0.947, 0.45, 0.053],
  [0, 0.92, 1, 0.08],
  [0, 0, 1, 0.15],
  [0, 0.85, 1, 0.15],
  [0, 0, 1, 1],
] as const

function stampDate(text: string) {
  const normalized = text.replace(/[–—−]/g, '-').toUpperCase()
  const pattern = /(?<!\d)(\d{4}|\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4}|\d{1,2})\s*(?:T\s*)?(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\s*([AP]\.?\s*M\.?)?(?![\d:]|\s*[AP])/g
  for (const [, first, middle, last, hourText, minute, second = '00', period] of normalized.matchAll(pattern)) {
    const yearFirst = first.length === 4
    if (!yearFirst && last.length === 1) continue
    const dayFirst = !yearFirst && Number(first) > 12
    const year = yearFirst ? first : last.length === 2 ? '20' + last : last
    const month = yearFirst || dayFirst ? middle : first
    const day = yearFirst ? last : dayFirst ? first : middle
    let hour = Number(hourText)
    if (period) {
      if (hour < 1 || hour > 12) continue
      hour = hour % 12 + (period.startsWith('P') ? 12 : 0)
    }
    const date = year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0')
      + 'T' + String(hour).padStart(2, '0') + ':' + minute + ':' + second
    const utc = new Date(date + 'Z')
    if (Number.isFinite(utc.getTime()) && utc.toISOString().slice(0, 19) === date) return date
  }
  return undefined
}

async function recognizeStamp(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    if (!worker) {
      worker = await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: new URL(workerUrl, document.baseURI).href,
        corePath: new URL(coreUrl, document.baseURI).href,
        langPath: new URL('.', new URL(modelUrl, document.baseURI)).href,
        workerBlobURL: false,
      })
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: '0123456789-/:. APMT',
      })
    }

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return undefined
    for (const [left, top, width, height, invert] of stampRegions) {
      const cropWidth = width * bitmap.width
      const cropHeight = height * bitmap.height
      const scale = Math.max(0.65, Math.min(3, 1400 / cropWidth))
      const padding = 12
      canvas.width = Math.ceil(cropWidth * scale) + 2 * padding
      canvas.height = Math.ceil(cropHeight * scale) + 2 * padding
      context.fillStyle = 'white'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.filter = invert ? 'invert(1) contrast(2)' : 'none'
      context.drawImage(bitmap, left * bitmap.width, top * bitmap.height, cropWidth, cropHeight,
        padding, padding, cropWidth * scale, cropHeight * scale)
      await worker.setParameters({
        tessedit_pageseg_mode: height >= 0.15 ? PSM.SPARSE_TEXT : PSM.SINGLE_LINE,
      })
      const { data } = await worker.recognize(canvas)
      const date = data.confidence >= 65 ? stampDate(data.text) : undefined
      if (date) return date
    }
    return undefined
  } finally {
    bitmap.close()
  }
}

export function readImageStamp(file: File) {
  const result = queue.then(() => recognizeStamp(file))
  queue = result.catch(() => undefined)
  return result
}
