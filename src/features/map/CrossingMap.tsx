import { useState } from 'react'
import { api } from '../../lib/api-client'
import cameraPinsGeoJson from './khaoyai304-camera-pins.geojson?raw'
import { coverageLabels, type Camera, type Profile, type Site } from '../../lib/model'
import { Badge, Header, Result, useLoad } from '../../lib/ui'
import './map.css'

type CameraPin = {
  geometry: { coordinates: [number, number] }
  properties: { cameraCode: string; crossingCode: Site; mediaType: 'photo' | 'video'; locationName: string }
}

const cameraPins = (JSON.parse(cameraPinsGeoJson) as { features: CameraPin[] }).features

const crossingPositions: Record<Site, [number, number]> = { C: [14, 56], B: [48, 66], A: [82.5, 62] }

function CameraMap({ pins, selected, showLabels, onSelect }: {
  pins: CameraPin[]
  selected: string
  showLabels: boolean
  onSelect: (pin: CameraPin) => void
}) {
  return (
    <div className="map-coordinate-view" role="group" aria-label="ภาพแผนที่จำลองและหมุดกล้อง">
      {pins.map((pin) => {
        const { cameraCode, crossingCode, mediaType, locationName } = pin.properties
        const [left, top] = crossingPositions[crossingCode]
        const group = pins.filter(({ properties }) => properties.crossingCode === crossingCode)
        const offset = group.indexOf(pin) - (group.length - 1) / 2
        return (
          <button key={cameraCode} type="button" className="camera-map-marker" data-media={mediaType}
            style={{ left: `calc(${left}% + ${offset * 1.35}rem)`, top: `calc(${top}% + ${offset * 0.9}rem)` }}
            aria-label={cameraCode + ' · ' + locationName} aria-pressed={selected === cameraCode}
            title={cameraCode} onClick={() => onSelect(pin)}>
            {showLabels && <span>{cameraCode}</span>}
          </button>
        )
      })}
      {!pins.length && <p className="map-empty">ไม่มีพิกัดกล้องในพื้นที่นี้</p>}
    </div>
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
  const pins = cameraPins.filter(({ properties }) =>
    siteIds.includes(properties.crossingCode) &&
    (!site || properties.crossingCode === site) &&
    cameras.some((camera) => camera.id === properties.cameraCode && camera.siteId === properties.crossingCode),
  )
  const selectedPin = pins.find(({ properties }) => properties.cameraCode === cameraId)
  const selectedCameras = cameras.filter((camera) => camera.siteId === site)
  return (
    <section className="panel crossing-map">
      <div className="split map-heading">
        <h2>แผนที่ตำแหน่งกล้อง</h2>
        <Badge>พิกัดจำลอง</Badge>
      </div>
      {showSiteFilter && <label className="map-crossing-filter">
        ทางลอด
        <select value={site} onChange={(event) => onChange(event.target.value)}>
          <option value="">ทุกทางลอด</option>
          {siteIds.map((id) => <option key={id} value={id}>ทางลอด {id}</option>)}
        </select>
      </label>}
      <CameraMap pins={pins} selected={cameraId} showLabels={!!site || siteIds.length === 1}
        onSelect={({ properties }) => {
          if (site !== properties.crossingCode) onChange(properties.crossingCode)
          onCamera(properties.cameraCode)
        }} />

      {selectedPin && (
        <div className="camera-map-details">
          <h3>{selectedPin.properties.cameraCode} · ทางลอด {selectedPin.properties.crossingCode}</h3>
          <p>{selectedPin.properties.locationName} · {selectedPin.properties.mediaType === 'photo' ? 'ภาพนิ่ง' : 'วิดีโอ'}</p>
          <p>พิกัดจำลอง {[...selectedPin.geometry.coordinates].reverse().map((coordinate) => coordinate.toFixed(6)).join(', ')}</p>
        </div>
      )}

      <div className="map-legend" aria-label="ประเภทกล้องบนแผนที่">
        <span><i className="map-dot map-photo-dot" />ภาพนิ่ง</span>
        <span><i className="map-dot map-video-dot" />วิดีโอ</span>
      </div>

      {!reviewedCameraIds && <div className="map-legend" aria-label="สถานะกล้อง">
        {Object.entries(coverageLabels).map(([status, label]) => (
          <span key={status}>
            <i className={'map-dot ' + status} />
            {label}
          </span>
        ))}
      </div>}
      {site && (
        <div className="map-camera-list">
          <h3>กล้องทางลอด {site}</h3>
          {selectedCameras.length ? (
            <div className="grid camera-grid">
              {selectedCameras.map((camera) => (
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
                  <small>{camera.position}</small>
                  {reviewedCameraIds ? (
                    reviewedCameraIds.has(camera.id) && <small>มีผลตรวจที่บันทึก</small>
                  ) : <small>
                    <i className={'map-dot ' + (camera.coverageStatus ?? 'unknown')} />
                    {coverageLabels[camera.coverageStatus ?? 'unknown']}
                  </small>}
                </button>
              ))}
            </div>
          ) : (
            <p>ไม่พบกล้องในทางลอดที่เลือก</p>
          )}
        </div>
      )}
    </section>
  )
}
