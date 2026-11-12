import { backend } from '../../lib/backend-api'

type UploadFile = { file: File; capturedAt: string }

export async function uploadPhotoBatch({
  batchId,
  roundId,
  cameraId,
  photos,
}: {
  batchId: string
  roundId: string
  cameraId: string
  photos: UploadFile[]
}) {
  const form = new FormData()
  form.set('batchId', batchId)
  form.set('roundId', roundId)
  form.set('cameraId', cameraId)

  for (const { file, capturedAt } of photos) {
    form.append('file', file)
    form.append('capturedAt', capturedAt)
  }

  const receipt = await backend.upload(form)
  if (receipt.status !== 'queued' || typeof receipt.batchId !== 'string' || !receipt.batchId) throw new Error('ระบบยังไม่ยืนยันการรับไฟล์')
  return receipt
}
