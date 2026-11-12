import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api-client'
import { Icon } from '../../lib/Icon'
import { thaiDate, type Media } from '../../lib/model'
import { message } from '../../lib/ui'

function useMediaLink(id: string, open: boolean) {
  const [attempt, setAttempt] = useState(0)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    let current = true
    let objectUrl = ''
    setUrl('')
    setError('')
    api.view(id).then(
      ({ url }) => {
        if (url.startsWith('blob:')) objectUrl = url
        if (current) setUrl(url)
        else if (objectUrl) URL.revokeObjectURL(objectUrl)
      },
      (error) => {
        if (current) setError(message(error))
      },
    )
    return () => {
      current = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, open, attempt])
  return { url, error, setError, retry: () => setAttempt((n) => n + 1) }
}

export function Evidence({ media, previews = false }: { media: Media[]; previews?: boolean }) {
  return (
    <div className="evidence">
      {media.map((file) => (
        <EvidenceFile key={file.id} file={file} preview={previews && file.kind === 'image'} />
      ))}
    </div>
  )
}

function EvidenceFile({ file, preview }: { file: Media; preview: boolean }) {
  const [opened, setOpened] = useState(preview)
  const { url, error, setError, retry } = useMediaLink(file.id, opened)
  return (
    <article className="media">
      {url &&
        (file.kind === 'image' ? (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={file.fileName} onError={() => setError('โหลดภาพไม่สำเร็จ')} />
          </a>
        ) : (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            aria-label={file.fileName}
            onError={() => setError('เล่นคลิปไม่สำเร็จ')}
          />
        ))}
      <strong>{file.fileName}</strong>
      <small>{thaiDate(file.capturedAt)}</small>
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
      {!opened ? (
        <button className="secondary" onClick={() => setOpened(true)}>
          {file.kind === 'image' ? 'เปิดภาพ' : 'เปิดคลิป'}
        </button>
      ) : error ? (
        <button className="secondary" onClick={retry}>
          ขอลิงก์อีกครั้ง
        </button>
      ) : (
        !url && <small role="status">กำลังเปิดหลักฐาน…</small>
      )}
    </article>
  )
}

export function EvidenceThumbnail({ file }: { file: Media }) {
  const { url, error, setError } = useMediaLink(file.id, file.kind === 'image')
  return (
    <span className="evidence-thumb">
      {url && !error ? (
        <img src={url} alt={file.fileName} loading="lazy" onError={() => setError('โหลดภาพไม่สำเร็จ')} />
      ) : (
        <span className="thumb-placeholder">
          <Icon name="camera" size={18} />
          {file.kind === 'video' ? 'คลิป' : error ? 'เปิดภาพไม่ได้' : 'ภาพนิ่ง'}
        </span>
      )}
      <small>
        {new Intl.DateTimeFormat('th-TH', {
          timeZone: 'Asia/Bangkok',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date(file.capturedAt))}
      </small>
    </span>
  )
}

export function EvidenceGallery({ media, cameraLabel }: { media: Media[]; cameraLabel: string }) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const stage = useRef<HTMLDivElement>(null)
  function select(next: number) {
    setIndex(next)
    setZoom(1)
  }
  const file = media[index]
  if (!file) return <p>ไม่มีไฟล์หลักฐาน</p>
  return (
    <>
      <div className="evidence-stage" ref={stage}>
        <GalleryFile key={file.id} file={file} zoom={zoom} />
        {file.kind === 'image' && (
          <>
            <div className="gallery-controls" aria-label="ปรับมุมมองภาพ">
              <button
                type="button"
                aria-label="ย่อภาพ"
                disabled={zoom <= 1}
                onClick={() => setZoom(zoom - 0.25)}
              >
                −
              </button>
              <button
                type="button"
                aria-label="ขยายภาพ"
                disabled={zoom >= 2}
                onClick={() => setZoom(zoom + 0.25)}
              >
                +
              </button>
              {document.fullscreenEnabled && (
                <button
                  type="button"
                  aria-label="สลับภาพเต็มหน้าจอ"
                  onClick={() => {
                    const action = document.fullscreenElement
                      ? document.exitFullscreen()
                      : stage.current?.requestFullscreen()
                    void action?.catch(() => {})
                  }}
                >
                  ⛶
                </button>
              )}
            </div>
            <div className="gallery-overlay">
              <span>{thaiDate(file.capturedAt)}</span>
              <span>{cameraLabel}</span>
            </div>
          </>
        )}
        {media.length > 1 && (
          <div className="gallery-navigation">
            <button
              type="button"
              aria-label="หลักฐานก่อนหน้า"
              disabled={index === 0}
              onClick={() => select(index - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="หลักฐานถัดไป"
              disabled={index === media.length - 1}
              onClick={() => select(index + 1)}
            >
              ›
            </button>
          </div>
        )}
      </div>
      <div className="split gallery-caption">
        <small>
          {file.fileName} · {thaiDate(file.capturedAt)}
        </small>
        <small>
          {index + 1} / {media.length}
        </small>
      </div>
      <div className="evidence-strip" aria-label="เลือกไฟล์หลักฐาน">
        {media.map((item, i) => (
          <button
            type="button"
            key={item.id}
            aria-label={'หลักฐาน ' + (i + 1) + ' ' + item.fileName}
            aria-pressed={i === index}
            onClick={() => select(i)}
          >
            <EvidenceThumbnail file={item} />
          </button>
        ))}
      </div>
    </>
  )
}

function GalleryFile({ file, zoom }: { file: Media; zoom: number }) {
  const { url, error, setError, retry } = useMediaLink(file.id, true)
  if (error)
    return (
      <div className="gallery-message" role="alert">
        {error} <button onClick={retry}>ลองอีกครั้ง</button>
      </div>
    )
  if (!url)
    return (
      <p className="gallery-message" role="status">
        กำลังเปิดหลักฐาน…
      </p>
    )
  return file.kind === 'image' ? (
    <a href={url} target="_blank" rel="noreferrer" aria-label={'เปิดภาพเต็ม ' + file.fileName}>
      <img
        src={url}
        alt={file.fileName}
        style={{ transform: 'scale(' + zoom + ')' }}
        onError={() => setError('โหลดภาพไม่สำเร็จ')}
      />
    </a>
  ) : (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      aria-label={file.fileName}
      onError={() => setError('เล่นคลิปไม่สำเร็จ')}
    />
  )
}
