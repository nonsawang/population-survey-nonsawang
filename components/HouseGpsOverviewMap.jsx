'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function createPinIcon(color, isActive) {
  const size = isActive ? 28 : 20;
  const border = isActive ? '3px solid #1e293b' : '2px solid white';
  return L.divIcon({
    className: '',
    html: `<span style="display:block;background:${color};border:${border};border-radius:50%;width:${size}px;height:${size}px;box-shadow:0 2px 6px rgba(0,0,0,0.45);transition:all .15s;"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapViewportController({ rows, activeRow }) {
  const map = useMap();

  useEffect(() => {
    if (activeRow && Number.isFinite(Number(activeRow.latitude)) && Number.isFinite(Number(activeRow.longitude))) {
      const newLat = Number(activeRow.latitude);
      const newLng = Number(activeRow.longitude);
      const oldLat = Number(activeRow.old_latitude);
      const oldLng = Number(activeRow.old_longitude);
      const hasOld =
        activeRow.old_latitude !== null &&
        activeRow.old_latitude !== '' &&
        Number.isFinite(oldLat) &&
        Number.isFinite(oldLng) &&
        oldLat !== 0 &&
        oldLng !== 0;

      if (hasOld && (Math.abs(newLat - oldLat) > 0.0001 || Math.abs(newLng - oldLng) > 0.0001)) {
        const bounds = L.latLngBounds([
          [newLat, newLng],
          [oldLat, oldLng],
        ]);
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 19 });
      } else {
        map.setView([newLat, newLng], 18, { animate: true });
      }
      return;
    }

    const validPoints = (rows || [])
      .filter((r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)))
      .map((r) => [Number(r.latitude), Number(r.longitude)]);

    if (validPoints.length === 1) {
      map.setView(validPoints[0], 17);
    } else if (validPoints.length > 1) {
      const bounds = L.latLngBounds(validPoints);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
    }
  }, [map, rows, activeRow]);

  return null;
}

export default function HouseGpsOverviewMap({
  rows,
  activeId,
  onSelectRow,
  onApproveRow,
  readyIds = [],
   onEditRow,
  busy,
  distanceInfo,
}) {
  const validRows = (rows || []).filter(
    (r) =>
      Number.isFinite(Number(r.latitude)) &&
      Number.isFinite(Number(r.longitude)) &&
      Math.abs(Number(r.latitude)) <= 90 &&
      Math.abs(Number(r.longitude)) <= 180
  );

  const activeRow = validRows.find((r) => r.id === activeId) || null;
  const defaultCenter = validRows.length
    ? [Number(validRows[0].latitude), Number(validRows[0].longitude)]
    : [16.185, 102.825];

  const getPinColor = (row) => {
    if (row.state === 'conflict') return '#dc2626'; // แดง
    if (row.state === 'sent') return '#16a34a'; // เขียว
    if ((row.state === 'pending' && row.approved_at) || row.state === 'processing') return '#0284c7'; // ฟ้า
    if (row.state === 'pending' && !row.approved_at) return '#f59e0b'; // ส้ม
    return '#64748b'; // เทา
  };

  return (
    <div className="border rounded-3 overflow-hidden mb-3 bg-light">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 px-3 py-2 bg-white border-bottom small">
        <div className="fw-semibold">
          <i className="fa-solid fa-map-location-dot text-primary me-1" />
          แผนที่ภาพรวมพิกัดในหน้านี้ ({validRows.length} จุด)
          {activeRow && (
            <span className="ms-2 badge bg-primary-subtle text-primary border border-primary-subtle">
              กำลังดู: บ้าน {activeRow.address} หมู่ {activeRow.moo}
            </span>
          )}
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap" style={{ fontSize: '.78rem' }}>
          <span>
            <span
              className="d-inline-block rounded-circle me-1"
              style={{ width: 10, height: 10, background: '#f59e0b' }}
            />
            รออนุมัติ
          </span>
          <span>
            <span
              className="d-inline-block rounded-circle me-1"
              style={{ width: 10, height: 10, background: '#0284c7' }}
            />
            อนุมัติแล้ว รอ LAN
          </span>
          <span>
            <span
              className="d-inline-block rounded-circle me-1"
              style={{ width: 10, height: 10, background: '#16a34a' }}
            />
            ส่ง HOSxP แล้ว
          </span>
          <span>
            <span
              className="d-inline-block rounded-circle me-1"
              style={{ width: 10, height: 10, background: '#dc2626' }}
            />
            ต้องตรวจสอบ
          </span>
          {activeRow && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none"
              onClick={() => onSelectRow(null)}
            >
              ดูทั้งหน้า
            </button>
          )}
        </div>
      </div>

      <MapContainer center={defaultCenter} zoom={15} style={{ height: 320, width: '100%' }}>
        <TileLayer
          attribution="© Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <MapViewportController rows={validRows} activeRow={activeRow} />

        {validRows.map((row) => {
          const isActive = row.id === activeId;
          const newLat = Number(row.latitude);
          const newLng = Number(row.longitude);
          const oldLat = Number(row.old_latitude);
          const oldLng = Number(row.old_longitude);
          const hasOld =
            row.old_latitude !== null &&
            row.old_latitude !== '' &&
            Number.isFinite(oldLat) &&
            Number.isFinite(oldLng) &&
            oldLat !== 0 &&
            oldLng !== 0 &&
            Math.abs(oldLat) <= 90 &&
            Math.abs(oldLng) <= 180;
          const dist = distanceInfo ? distanceInfo(row) : null;

          return (
            <div key={row.id}>
              {hasOld && isActive && (
                <>
                  <CircleMarker
                    center={[oldLat, oldLng]}
                    radius={8}
                    pathOptions={{ color: '#64748b', fillColor: '#94a3b8', fillOpacity: 0.85 }}
                  >
                    <Popup>
                      <strong>พิกัด HOSxP เดิม</strong>
                      <br />
                      บ้าน {row.address} หมู่ {row.moo}
                      <br />
                      {oldLat.toFixed(6)}, {oldLng.toFixed(6)}
                    </Popup>
                  </CircleMarker>
                  <Polyline
                    positions={[
                      [oldLat, oldLng],
                      [newLat, newLng],
                    ]}
                    pathOptions={{ color: '#facc15', weight: 3, dashArray: '6, 6' }}
                  />
                </>
              )}
              <Marker
                position={[newLat, newLng]}
                icon={createPinIcon(getPinColor(row), isActive)}
                eventHandlers={{
                  click: () => onSelectRow(row.id),
                }}
              >
                <Popup>
                  <div style={{ minWidth: 190 }}>
                    <div className="fw-bold mb-1">
                      บ้านเลขที่ {row.address} หมู่ {row.moo}
                    </div>
                    <div className="small text-muted mb-1">
                      ผู้ปักหมุด: {row.actor_name || row.actor || '-'}
                      <br />
                      พิกัดใหม่: {newLat.toFixed(6)}, {newLng.toFixed(6)}
                      {dist && (
                        <>
                          <br />
                          <span>{dist.label}</span>
                        </>
                      )}
                    </div>
                    <div className="d-flex gap-1 mt-2">
                      {row.state === 'pending' && !row.approved_at && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary py-1 px-2"
                          disabled={busy || !readyIds.includes(row.id)}
                          onClick={() => onApproveRow(row)}
                        >
                          ✅ อนุมัติส่ง
                        </button>
                      )}
                      {['pending', 'sent', 'conflict'].includes(row.state) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-1 px-2"
                          disabled={busy}
                          onClick={() => onEditRow(row)}
                        >
                          แก้ไขหมุด
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
