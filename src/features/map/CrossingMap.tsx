import { useState } from 'react'
import { api } from '../../lib/api-client'
import cameraPinsGeoJson from './khaoyai304-camera-pins.geojson?raw'
import { coverageLabels, type Camera, type Profile, type Site } from '../../lib/model'
import { Header, Result, useLoad } from '../../lib/ui'
import './map.css'

type CameraPin = {
  geometry: { coordinates: [number, number] }
  properties: {
    cameraCode: string
    crossingCode: Site
    mediaType: 'photo' | 'video'
    locationName: string
    simulated?: boolean
  }
}

const cameraPins = (JSON.parse(cameraPinsGeoJson) as { features: CameraPin[] }).features

const crossingHeaderPositions: Record<Site, [number, number]> = {
  C: [14.2, 48.5],
  B: [47.5, 58.0],
  A: [82.5, 54.5],
}

const pinPositions: Record<string, [number, number]> = {
  'C-P1': [9.2, 56.5],
  'C-V1': [18.8, 56.5],
  'C-V2': [9.2, 64.5],
  'C-P2': [18.8, 64.5],
  'B-P1': [42.5, 66.0],
  'B-V1': [52.2, 66.0],
  'B-V2': [42.5, 74.0],
  'B-P2': [52.2, 74.0],
  'A-P1': [77.5, 62.5],
  'A-V1': [87.2, 62.5],
  'A-V2': [77.5, 70.5],
  'A-P2': [87.2, 70.5],
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M9.4 4.5 7.8 6.5H5A2.5 2.5 0 0 0 2.5 9v9A2.5 2.5 0 0 0 5 20.5h14a2.5 2.5 0 0 0 2.5-2.5V9A2.5 2.5 0 0 0 19 6.5h-2.8l-1.6-2H9.4Zm2.6 4.7a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6Zm0 1.8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M4.5 6.5A2.5 2.5 0 0 0 2 9v6a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 16 15v-1.3l4.2 2.6a1 1 0 0 0 1.5-.86V8.56a1 1 0 0 0-1.5-.86L16 10.3V9a2.5 2.5 0 0 0-2.5-2.5h-9Z" />
    </svg>
  )
}

function TunnelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 19V11a9 9 0 0 1 18 0v8" />
      <path d="M7 19v-6a5 5 0 0 1 10 0v6" fill="currentColor" fillOpacity="0.28" />
      <path d="M2 19h20" />
    </svg>
  )
}

function PinPointIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
    </svg>
  )
}

function CrosshairIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
  )
}

export function MapPage({ profile }: { profile: Profile }) {
  const [site, setSite] = useState('')
  const [camera, setCamera] = useState('')
  const data = useLoad(api.map, [])
  return (
    <>
      <Header eyebrow="ทางหลวงหมายเลข 304" title="แผนที่ตำแหน่งกล้อง" icon="map">
        เลือกทางลอดบนแผนที่เพื่อดูตำแหน่งและสถานะของกล้องในพื้นที่ที่คุณมีสิทธิ์
      </Header>
      <Result result={data}>
        {(cameras) => (
          <CrossingMap
            siteIds={profile.siteIds}
            site={site}
            cameras={cameras}
            cameraId={camera}
            onChange={(id) => {
              setSite(id)
              setCamera('')
            }}
            onCamera={setCamera}
          />
        )}
      </Result>
    </>
  )
}

export function CrossingMap({
  siteIds,
  site,
  onChange,
  cameras,
  cameraId,
  onCamera,
  showSiteFilter = true,
  reviewedCameraIds,
}: {
  siteIds: Site[]
  site: string
  onChange: (id: string) => void
  cameras: Camera[]
  cameraId: string
  onCamera: (id: string) => void
  showSiteFilter?: boolean
  reviewedCameraIds?: ReadonlySet<string>
}) {
  const cameraByCode = new Map(cameras.map((camera) => [camera.id, camera]))
  const pins = cameraPins.filter(({ properties }) =>
    siteIds.includes(properties.crossingCode) &&
    (!site || properties.crossingCode === site) &&
    cameras.some((camera) => camera.id === properties.cameraCode && camera.siteId === properties.crossingCode),
  )
  const visibleSites = siteIds.filter((id) => !site || id === site)
  const selectedPin = pins.find(({ properties }) => properties.cameraCode === cameraId)
  const selectedCamera = selectedPin ? cameraByCode.get(selectedPin.properties.cameraCode) : undefined
  const selectedCameras = cameras.filter((camera) => camera.siteId === site)
  const hasCoverageStatus = !reviewedCameraIds && cameras.some((camera) => camera.coverageStatus !== undefined)

  const underpassLabel = (crossingCode: Site) => {
    const cam = cameras.find((item) => item.siteId === crossingCode && item.underpassName)
    return cam?.underpassName || `ทางลอด ${crossingCode}`
  }

  const locationLabel = (pin: CameraPin) => {
    const cam = cameraByCode.get(pin.properties.cameraCode)
    const defaultUnderpass = `ทางลอด ${pin.properties.crossingCode}`
    if (
      cam?.position &&
      cam.position !== cam.id &&
      cam.position !== defaultUnderpass &&
      cam.position !== cam.underpassName
    ) {
      return cam.position
    }
    return pin.properties.locationName
  }

  const coordinatesLabel = (pin: CameraPin) => {
    const cam = cameraByCode.get(pin.properties.cameraCode)
    if (typeof cam?.latitude === 'number' && typeof cam?.longitude === 'number') {
      return `${cam.latitude.toFixed(6)}, ${cam.longitude.toFixed(6)}`
    }
    return [...pin.geometry.coordinates].reverse().map((coordinate) => coordinate.toFixed(6)).join(', ')
  }

  const isSimulated = pins.every((pin) => {
    const cam = cameraByCode.get(pin.properties.cameraCode)
    return (cam?.latitude == null || cam?.longitude == null) && pin.properties.simulated !== false
  })

  return (
    <section className="panel crossing-map" aria-label="แผนที่ตำแหน่งกล้อง">
      <div className="map-coordinate-view" role="group" aria-label="ภาพแผนที่จำลองและหมุดกล้อง">
        <div className="map-overlay-top-left">
          {isSimulated && (
            <div className="map-sim-pill">
              <PinPointIcon />
              <span>พิกัดจำลอง</span>
            </div>
          )}

          {showSiteFilter && (
            <label className="map-crossing-filter">
              <span>เลือกทางลอด :</span>
              <select
                aria-label="ทางลอด"
                value={site}
                onChange={(event) => onChange(event.target.value)}
              >
                <option value="">ทุกทางลอด</option>
                {siteIds.map((id) => (
                  <option key={id} value={id}>
                    {underpassLabel(id)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="map-legend-pill" aria-label="ประเภทกล้องและสัญลักษณ์บนแผนที่">
            <span className="map-legend-item">
              <span className="map-legend-icon photo">
                <PhotoIcon />
              </span>
              <span>
                <strong>กล้องภาพนิ่ง</strong>
                <small>(Photo)</small>
              </span>
            </span>
            <span className="map-legend-item">
              <span className="map-legend-icon video">
                <VideoIcon />
              </span>
              <span>
                <strong>กล้องวิดีโอ</strong>
                <small>(Video)</small>
              </span>
            </span>
            <span className="map-legend-divider" aria-hidden="true" />
            <span className="map-legend-item">
              <span className="map-legend-icon tunnel">
                <TunnelIcon />
              </span>
              <span>
                <strong>ทางลอดสัตว์ป่า</strong>
              </span>
            </span>
          </div>
        </div>

        {visibleSites.map((crossingCode) => {
          const [left, top] = crossingHeaderPositions[crossingCode]
          const active = site === crossingCode
          return (
            <button
              key={crossingCode}
              type="button"
              className="map-crossing-header"
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-pressed={active}
              onClick={() => onChange(active ? '' : crossingCode)}
            >
              <TunnelIcon />
              <span>{underpassLabel(crossingCode)}</span>
            </button>
          )
        })}

        {pins.map((pin) => {
          const { cameraCode, crossingCode } = pin.properties
          const cam = cameraByCode.get(cameraCode)
          const mediaType: 'photo' | 'video' =
            cam ? (cam.kind === 'video' ? 'video' : 'photo') : pin.properties.mediaType
          const [left, top] = pinPositions[cameraCode] ?? crossingHeaderPositions[crossingCode]
          const isSelected = cameraId === cameraCode
          return (
            <button
              key={cameraCode}
              type="button"
              className="camera-map-marker"
              data-media={mediaType}
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-label={`${cameraCode} · ${locationLabel(pin)}`}
              aria-pressed={isSelected}
              title={`${cameraCode} · ${locationLabel(pin)}`}
              onClick={() => {
                if (site && site !== crossingCode) onChange(crossingCode)
                onCamera(isSelected ? '' : cameraCode)
              }}
            >
              <span className="camera-pin-teardrop">
                {mediaType === 'photo' ? <PhotoIcon /> : <VideoIcon />}
              </span>
              <span className="camera-pin-code">{cameraCode}</span>
            </button>
          )
        })}

        {!pins.length && <p className="map-empty">ไม่มีพิกัดกล้องในพื้นที่นี้</p>}

        {selectedPin && (
          <div
            className="camera-map-details"
            data-crossing={selectedPin.properties.crossingCode}
            role="region"
            aria-label={`รายละเอียดกล้อง ${selectedPin.properties.cameraCode}`}
          >
            <div className="camera-popover-head">
              <span
                className={
                  'camera-popover-badge ' +
                  ((selectedCamera ? selectedCamera.kind === 'video' : selectedPin.properties.mediaType === 'video')
                    ? 'video'
                    : 'photo')
                }
              >
                {(selectedCamera ? selectedCamera.kind === 'video' : selectedPin.properties.mediaType === 'video') ? (
                  <VideoIcon />
                ) : (
                  <PhotoIcon />
                )}
              </span>
              <h3>
                {selectedPin.properties.cameraCode} · {underpassLabel(selectedPin.properties.crossingCode)}
              </h3>
              <button
                type="button"
                className="camera-popover-close"
                aria-label="ปิดรายละเอียดกล้อง"
                onClick={() => onCamera('')}
              >
                ✕
              </button>
            </div>
            <p className="camera-popover-row">
              <PinPointIcon />
              <span>
                <strong>ตำแหน่ง:</strong> {locationLabel(selectedPin)} ·{' '}
                {(selectedCamera ? selectedCamera.kind === 'video' : selectedPin.properties.mediaType === 'video')
                  ? 'วิดีโอ'
                  : 'ภาพนิ่ง'}
              </span>
            </p>
            <p className="camera-popover-row">
              <CrosshairIcon />
              <span>
                <strong>พิกัด:</strong> {coordinatesLabel(selectedPin)}
              </span>
            </p>
          </div>
        )}
      </div>

      {hasCoverageStatus && (
        <div className="map-legend" aria-label="สถานะกล้อง">
          {Object.entries(coverageLabels).map(([status, label]) => (
            <span key={status}>
              <i className={'map-dot ' + status} />
              {label}
            </span>
          ))}
        </div>
      )}

      {site && (
        <div className="map-camera-list">
          <h3>กล้อง{underpassLabel(site as Site)}</h3>
          {selectedCameras.length ? (
            <div className="grid camera-grid">
              {selectedCameras.map((camera) => {
                const pin = cameraPins.find((item) => item.properties.cameraCode === camera.id)
                return (
                  <button
                    key={camera.id}
                    type="button"
                    className={camera.id === cameraId ? '' : 'secondary'}
                    aria-pressed={camera.id === cameraId}
                    onClick={() => onCamera(cameraId === camera.id ? '' : camera.id)}
                  >
                    <strong>
                      {camera.id} · {camera.kind === 'image' ? 'ภาพนิ่ง' : 'วิดีโอ'}
                    </strong>
                    <small>{pin ? locationLabel(pin) : camera.position}</small>
                    {reviewedCameraIds ? (
                      reviewedCameraIds.has(camera.id) && <small>มีผลตรวจที่บันทึก</small>
                    ) : (
                      <small>
                        <i className={'map-dot ' + (camera.coverageStatus ?? 'unknown')} />
                        {coverageLabels[camera.coverageStatus ?? 'unknown']}
                      </small>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <p>ไม่พบกล้องในทางลอดที่เลือก</p>
          )}
        </div>
      )}
    </section>
  )
}
